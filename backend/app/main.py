"""Local single-user API. See the root README for startup commands."""

import asyncio
import logging
from collections import defaultdict
from contextlib import asynccontextmanager
from typing import Literal
from uuid import UUID

from fastapi import FastAPI, HTTPException
from openai import APIConnectionError, APIStatusError, APITimeoutError
from pydantic import BaseModel, Field, field_validator

from .agents import AgentLimitError, Assistant, DeepSeek
from .config import Settings
from .store import DraftNotFound, Store, TransactionConflict

logger = logging.getLogger(__name__)


class ChatRequest(BaseModel):
    conversation_id: UUID
    message: str = Field(min_length=1, max_length=4000)

    @field_validator("message")
    @classmethod
    def not_blank(cls, value):
        if not value.strip():
            raise ValueError("Message cannot be blank")
        return value.strip()


class Step(BaseModel):
    agent: str
    tool: str
    status: str


class Source(BaseModel):
    source: str
    title: str
    content: str


class TransactionDraft(BaseModel):
    id: UUID
    sku: str
    product: str
    unit: str
    currency: str
    kind: Literal["sale", "purchase"]
    quantity: int
    total: str
    stock_before: int
    stock_after: int
    status: Literal["pending", "confirmed", "cancelled"]
    transaction_id: int | None = None
    recorded_at: str | None = None


class TransactionDecision(BaseModel):
    decision: Literal["confirm", "cancel"]


class Turn(BaseModel):
    question: str
    answer: str
    steps: list[Step]
    sources: list[Source]
    transactions: list[TransactionDraft] = Field(default_factory=list)


class ChatResponse(Turn):
    conversation_id: UUID


class ConversationResponse(BaseModel):
    id: UUID
    turns: list[Turn]


def create_app(settings: Settings | None = None, provider=None):
    settings = settings or Settings.from_env()
    store = Store(settings.database_path, settings.knowledge_path)
    llm = provider or DeepSeek(settings)
    assistant = Assistant(store, llm)
    locks = defaultdict(asyncio.Lock)

    @asynccontextmanager
    async def lifespan(app):
        yield
        if provider is None:
            await llm.close()

    app = FastAPI(title="StockAI", version="0.1.0", lifespan=lifespan)

    @app.get("/api/health")
    async def health():
        return {"status": "ok", "llm_configured": bool(settings.api_key),
                "model": settings.model, "reasoning_effort": settings.reasoning_effort,
                "data_mode": "local-demo"}

    @app.post("/api/conversations", status_code=201)
    async def create_conversation():
        return {"id": store.create_conversation()}

    @app.get("/api/conversations/{conversation_id}", response_model=ConversationResponse)
    async def get_conversation(conversation_id: UUID):
        conversation = store.conversation(str(conversation_id))
        if conversation is None:
            raise HTTPException(404, "Conversation not found")
        return conversation

    @app.post("/api/chat", response_model=ChatResponse)
    async def chat(request: ChatRequest):
        if not settings.api_key and provider is None:
            raise HTTPException(503, "Set DEEPSEEK_API_KEY (or DEEPSEEK-API-KEY) in the root .env and restart the backend.")
        conversation_id = str(request.conversation_id)
        async with locks[conversation_id]:
            conversation = store.conversation(conversation_id)
            if conversation is None:
                raise HTTPException(404, "Conversation not found")
            if len(conversation["turns"]) >= 30:
                raise HTTPException(409, "This chat reached 30 turns. Start a new chat.")
            try:
                async with asyncio.timeout(240):
                    result = await assistant.run(conversation["messages"], request.message)
            except AgentLimitError as error:
                raise HTTPException(422, str(error)) from None
            except (APITimeoutError, TimeoutError):
                raise HTTPException(504, "The assistant took too long. Please retry with a narrower question.") from None
            except APIConnectionError:
                raise HTTPException(502, "Could not reach DeepSeek. Check your connection and backend configuration.") from None
            except APIStatusError as error:
                # Never return provider bodies, headers, credentials, or raw exception text.
                status = error.status_code
                detail = ("DeepSeek rejected the API key. Check the root .env." if status == 401 else
                          "DeepSeek reports insufficient balance. Check your API account." if status == 402 else
                          "DeepSeek is rate limiting requests. Please try again shortly." if status == 429 else
                          "DeepSeek could not complete this request. Check the model configuration and try again.")
                raise HTTPException(502, detail) from None
            except Exception:
                logger.error("Chat failed; internal details omitted to protect conversation data.")
                raise HTTPException(500, "The assistant encountered an unexpected error. Please try again.") from None
            turn = {"question": request.message, "answer": result["answer"],
                    "steps": result["steps"], "sources": result["sources"],
                    "transactions": result["transactions"]}
            store.save_turn(conversation_id, result["messages"], turn)
            return {"conversation_id": conversation_id, **turn}

    @app.post("/api/conversations/{conversation_id}/transactions/{draft_id}",
              response_model=ConversationResponse)
    async def decide_transaction(conversation_id: UUID, draft_id: UUID, request: TransactionDecision):
        async with locks[str(conversation_id)]:
            try:
                return store.decide_transaction(str(conversation_id), str(draft_id), request.decision)
            except DraftNotFound as error:
                raise HTTPException(404, str(error)) from None
            except TransactionConflict as error:
                raise HTTPException(409, str(error)) from None

    return app


app = create_app()
