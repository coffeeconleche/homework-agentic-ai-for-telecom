import json
from copy import deepcopy
from decimal import Decimal

import httpx
import pytest
from fastapi.testclient import TestClient
from openai import AuthenticationError

from backend.app.config import ROOT, Settings
from backend.app.main import create_app
from backend.app.store import Store
from backend.app.tools import Calculation, calculate


def reply(content):
    return {"role": "assistant", "content": content, "reasoning_content": "private reasoning fixture"}


def call(name, arguments, call_id="call-1"):
    return {"role": "assistant", "content": None, "reasoning_content": "private reasoning fixture",
            "tool_calls": [{"id": call_id, "type": "function", "function": {
                "name": name, "arguments": json.dumps(arguments),
            }}]}


class ScriptedProvider:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.requests = []

    async def complete(self, messages, tools):
        self.requests.append(deepcopy({"messages": messages, "tools": tools}))
        return next(self.responses)


@pytest.fixture
def settings(tmp_path):
    return Settings(database_path=tmp_path / "test.sqlite3", knowledge_path=ROOT / "knowledge")


@pytest.fixture
def store(settings):
    return Store(settings.database_path, settings.knowledge_path)


def test_seed_and_parameterized_inventory(store):
    assert len(store.inventory()) == 6
    assert {p["sku"] for p in store.inventory(low_stock_only=True)} == {"COF-001", "PEA-001", "MIL-001"}
    assert store.inventory("' OR 1=1 --") == []
    assert len(store.transactions(kind="sale")) == 6
    assert len(store.transactions(sku="COF-001")) == 2
    # Re-opening does not duplicate demo records or indexed passages.
    second = Store(store.database_path, ROOT / "knowledge")
    assert len(second.transactions()) == 12


def test_rag_returns_citable_passages_and_handles_query_syntax(store):
    passages = store.search_knowledge("perishable milk")
    assert any(p["source"] == "reordering.md" and "expiry" in p["content"] for p in passages)
    assert store.search_knowledge("unfindablexyz") == []
    assert store.search_knowledge('" AND ( *') == []


def test_decimal_arithmetic_and_validation():
    assert calculate("multiply", Decimal("18.50"), Decimal("22"))["result"] == "407.00"
    assert calculate("add", Decimal("0.1"), Decimal("0.2"))["result"] == "0.30"
    with pytest.raises(ValueError):
        calculate("divide", Decimal(1), Decimal(0))
    with pytest.raises(ValueError):
        Calculation.model_validate({"operation": "add", "a": "NaN", "b": "1"})


def test_real_graph_delegates_retrieves_calculates_and_persists(settings):
    provider = ScriptedProvider([
        call("query_inventory", {"query": "COF-001"}),
        call("ask_policy_agent", {"question": "How much coffee to reorder? Stock 8, target 30."}),
        call("search_knowledge", {"query": "reorder thresholds quantities"}),
        reply("Order target minus stock [reordering.md]."),
        call("calculate", {"operation": "multiply", "a": "22", "b": "18.50"}),
        reply("Order 22 bags of coffee, estimated PEN 407.00 [reordering.md]."),
        reply("The estimate was PEN 407.00 for 22 bags."),
    ])
    with TestClient(create_app(settings, provider)) as client:
        cid = client.post("/api/conversations").json()["id"]
        response = client.post("/api/chat", json={"conversation_id": cid, "message": "Plan a coffee restock"})
        assert response.status_code == 200, response.text
        data = response.json()
        assert {step["agent"] for step in data["steps"]} == {"Inventory agent", "Policy researcher"}
        assert [step["tool"] for step in data["steps"]] == [
            "query_inventory", "ask_policy_agent", "search_knowledge", "calculate",
        ]
        assert data["sources"] and "407.00" in data["answer"]
        assert "private reasoning fixture" not in response.text
        history = client.get(f"/api/conversations/{cid}")
        assert history.status_code == 200 and len(history.json()["turns"]) == 1
        assert "private reasoning fixture" not in history.text
        assert "messages" not in history.json()
        followup = client.post("/api/chat", json={"conversation_id": cid, "message": "What was that estimate?"})
        assert followup.status_code == 200
        assert len(client.get(f"/api/conversations/{cid}").json()["turns"]) == 2
    # Actual tool results and specialist answers are passed to the next model call.
    assert '"stock": 8' in provider.requests[1]["messages"][-1]["content"]
    assert any("Order target minus stock" in m.get("content", "")
               for m in provider.requests[4]["messages"] if m["role"] == "tool")
    assert provider.requests[1]["messages"][-2]["reasoning_content"] == "private reasoning fixture"
    assert any(m.get("reasoning_content") for m in provider.requests[-1]["messages"])
    # A new app instance can recover saved conversations after a restart.
    with TestClient(create_app(settings, ScriptedProvider([]))) as restarted:
        assert len(restarted.get(f"/api/conversations/{cid}").json()["turns"]) == 2


def test_greeting_skips_tools_and_researcher(settings):
    provider = ScriptedProvider([reply("Hello! How can I help with your inventory?")])
    with TestClient(create_app(settings, provider)) as client:
        cid = client.post("/api/conversations").json()["id"]
        result = client.post("/api/chat", json={"conversation_id": cid, "message": "Hello"}).json()
        assert result["steps"] == [] and result["sources"] == []
        assert len(provider.requests) == 1


def test_invalid_tool_arguments_return_error_to_model(settings):
    provider = ScriptedProvider([
        call("calculate", {"operation": "divide", "a": "10", "b": "0"}),
        reply("I could not divide by zero."),
    ])
    with TestClient(create_app(settings, provider)) as client:
        cid = client.post("/api/conversations").json()["id"]
        result = client.post("/api/chat", json={"conversation_id": cid, "message": "Divide 10 by 0"})
        assert result.status_code == 200
        assert result.json()["steps"][0]["status"] == "error"
        assert "error" in provider.requests[-1]["messages"][-1]["content"]


def test_turn_limit_stops_loop_and_does_not_save_partial_state(settings):
    provider = ScriptedProvider([call("query_inventory", {}) for _ in range(9)])
    with TestClient(create_app(settings, provider)) as client:
        cid = client.post("/api/conversations").json()["id"]
        response = client.post("/api/chat", json={"conversation_id": cid, "message": "Loop"})
        assert response.status_code == 422 and "step limit" in response.text
        assert client.get(f"/api/conversations/{cid}").json()["turns"] == []


def test_validation_missing_conversation_and_missing_key(settings):
    with TestClient(create_app(settings)) as client:
        cid = client.post("/api/conversations").json()["id"]
        assert client.post("/api/chat", json={"conversation_id": cid, "message": " "}).status_code == 422
        assert client.post("/api/chat", json={"conversation_id": cid, "message": "x" * 4001}).status_code == 422
        assert client.post("/api/chat", json={"conversation_id": cid, "message": "Hi"}).status_code == 503
        assert client.get("/api/conversations/00000000-0000-0000-0000-000000000000").status_code == 404
        assert not client.get("/api/health").json()["llm_configured"]


def test_provider_errors_are_sanitized_and_leave_history_unchanged(settings):
    class FailingProvider:
        async def complete(self, messages, tools):
            raise AuthenticationError("sensitive provider body", response=httpx.Response(
                401, request=httpx.Request("POST", "https://api.deepseek.com")), body=None)

    with TestClient(create_app(settings, FailingProvider())) as client:
        cid = client.post("/api/conversations").json()["id"]
        response = client.post("/api/chat", json={"conversation_id": cid, "message": "Hi"})
        assert response.status_code == 502
        assert "sensitive provider body" not in response.text
        assert client.get(f"/api/conversations/{cid}").json()["turns"] == []
