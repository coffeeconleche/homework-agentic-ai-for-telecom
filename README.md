# StockAI · Web inventory assistant

A small first step from [StockAI's WhatsApp bot](https://github.com/coffeeconleche/stockai_agent)
to a web assistant. React chat, two DeepSeek agents coordinated by LangGraph, a local
knowledge base, and read-only inventory tools. The model chooses tools and delegation.

**Version 0.1:** runs locally with six fictional products and twelve transactions.
It does not connect to AWS business data or record inventory changes. The interface,
sample data, knowledge base, and both agents use English. There is no authentication:
keep the servers on localhost.

## Run

Requirements: Python 3.11+, Node.js 22.12+ (or a current LTS), npm, and a funded DeepSeek API key.
The checked-in lockfiles capture the tested Python and JavaScript dependencies.

From the repository root:

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.lock
```

If you do not already have `.env`, copy `.env.example` to `.env` and fill in your key.
The existing `DEEPSEEK-API-KEY` spelling is supported alongside `DEEPSEEK_API_KEY`.
Do not overwrite an existing `.env`. Keys are loaded by the backend only; never use a
`VITE_` environment variable for a secret.

Start the backend in one terminal:

```sh
source .venv/bin/activate
uvicorn backend.app.main:app --reload --reload-dir backend --host 127.0.0.1 --port 8000
```

Start the frontend in a second terminal:

```sh
cd frontend
npm ci
npm run dev
```

Open [StockAI](http://127.0.0.1:5173). API documentation is at
[localhost:8000/docs](http://127.0.0.1:8000/docs). Vite forwards `/api` to the backend;
no extra CORS configuration is necessary. The frontend production build is available
for verification, but serving a production frontend and API together is a later step.

Open the HTTP URL while both servers are running, rather than opening
`frontend/index.html` as a file. A `file://` page has a null origin and cannot load the
React source modules; Vite serves and transforms them. If you see a CORS error mentioning
`file:///src/main.tsx`, switch to `http://127.0.0.1:5173/`.

Default backend configuration:

```dotenv
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-flash
DEEPSEEK_REASONING_EFFORT=max
DATABASE_PATH=data/stockai.sqlite3
```

As of October 20, 2026, `deepseek-flash` serves **DeepSeek-V4.1-Flash-1017**.
This is a rolling provider alias, not an immutable model snapshot.
We send `thinking: {type: "enabled"}` and `reasoning_effort: "max"` on every LLM call.
See [DeepSeek's release notes](https://api-docs.deepseek.com/updates/) and
[thinking-mode API](https://api-docs.deepseek.com/guides/thinking_mode/).
The OpenAI Python SDK is only the HTTP client; the provider and model are DeepSeek.
There is no fallback model or simulated AI response. API calls incur provider charges;
max reasoning and multiple agent calls can take tens of seconds.

## Architecture

```text
React + TypeScript (Vite)
        │ /api/chat + conversation endpoints
FastAPI ── SQLite conversation history
        │
Inventory agent (LangGraph model → tools → model loop)
        ├── query_inventory ── SQLite demo products
        ├── query_transactions ── SQLite demo purchases / sales
        ├── calculate ── Decimal arithmetic
        └── ask_policy_agent (chosen by the model)
                    │
             Policy researcher (its own LangGraph tool loop)
                    └── search_knowledge ── FTS5 / BM25 → Markdown passages
                    │
             Cited policy answer → Inventory agent → final answer
```

`backend/app/agents.py` owns orchestration and role prompts; `tools.py` owns validated
tool contracts; `store.py` owns storage and retrieval; `main.py` exposes the API.
There is no keyword router. LangGraph conditional edges inspect the model's tool calls
to continue or finish. Simple questions can use one agent, and greetings need no tools.
For policies and recommendations, the Inventory agent can invoke the Policy researcher
as a tool, use its answer, and continue with calculations before replying.

### Agents

| Agent | Responsibility | Available tools |
| --- | --- | --- |
| Inventory agent | Stock facts, transaction reports, calculations, and the user-facing answer; decides when to delegate | `query_inventory`, `query_transactions`, `calculate`, `ask_policy_agent` |
| Policy researcher | Retrieve business rules, cite evidence, and flag missing information | `search_knowledge` |

Both agents use the same DeepSeek model, with distinct system instructions and tool
permissions. A shared per-request budget limits them to 16 LLM calls total and 8 per
agent invocation. Each completion allows 8,192 output tokens. Requests time out after
240 seconds. These limits bound work; they do not force a particular agent sequence.

### Tools, RAG, and state

Tool arguments use Pydantic validation, SQL is parameterized, and calculations use
`Decimal` with two-place rounding. No tool runs arbitrary code or model-generated SQL.
Queries return at most 50 rows, enough for the tiny sample dataset.

Three Markdown documents in `knowledge/` cover replenishment, transactions, and scope.
At startup, documents are split by heading and indexed in SQLite FTS5. BM25 search
returns up to four matching passages per search, with filenames and headings. The
researcher uses those passages to answer with citations. This is lexical RAG: no
embeddings, external vector database, or additional key. Synonym matching is limited;
queries and documents use English. Restart the backend after editing documents.

Successful conversations persist in SQLite; localStorage retains the active chat ID.
Refresh restores history, and failed requests do not save partial turns. Chats have a
30-turn limit. New chats start fresh while previous records remain local. Per-chat
locks serialize requests in one process; this is a single-user, single-worker prototype.

DeepSeek requires `reasoning_content` to be passed back with tool-enabled requests.
The backend retains it privately in SQLite, including between turns. Public API schemas
expose only questions, answers, tool activity, and sources. Activity appears after
completion rather than streaming. Retrieved sources are evidence to inspect, not a
guarantee that every generated claim is supported. `.gitignore` excludes credentials,
runtime data, dependencies, and builds.

## Example questions

| Demonstrates | Question |
| --- | --- |
| RAG + delegation | “What is our replenishment policy, including rules for perishable products? Cite your sources.” |
| Structured data | “Which products are at or below their reorder point?” |
| Transaction tool | “Show the sample coffee sales and their total revenue.” |
| Calculation | “What is the purchase cost of 22 coffee bags at PEN 18.50 each?” |
| Multiple agents + tools | “Check low-stock products, research our replenishment policy, and calculate a reorder plan and estimated cost. Flag missing information.” |
| Conversation memory | After the plan: “What was the coffee estimate again?” |
| Missing information | “What information is missing before we can confidently reorder milk?” |
| Honest scope | “Record a sale of five coffee bags.” → explains that writes are not available yet |

For the collaboration example, expect the Inventory agent to query stock, delegate to
the Policy researcher, and use calculations before synthesizing the result. Exact tool
order and wording can vary. The demo coffee estimate is 22 bags × PEN 18.50 = PEN 407.00.
Milk recommendations should flag missing expiry/demand data rather than present a
definitive order. Expand the response activity to inspect agents and sources.

## Verify

```sh
source .venv/bin/activate
python -m pytest -q
cd frontend
npm run build
```

Tests run without paid LLM calls. They execute the real LangGraph graphs with a scripted
model boundary to verify delegation, retrieval, tool results, private-field handling,
history across restart, bounded execution, argument validation, and sanitized provider
errors. Actual language quality and model-selected routing need live evaluation using
the example prompts above.

## Relation to the original project and next steps

The original system uses a Lambda container, DynamoDB transactions indexed by phone
number/date, and S3 for reports. Its numeric purchase/sale types map to the readable
`purchase` / `sale` values here. We reuse the business context rather than copy webhook,
billing, or WhatsApp-specific code. AWS was inspected read-only for the initial design;
the new application has no AWS dependency or credentials.

Next increments, in order:

1. Add product management and sale/purchase drafts with explicit confirmation,
   idempotency, stock validation, and an audit trail.
2. Add web authentication and a business/user mapping before implementing a DynamoDB
   storage adapter. A web user must not select an arbitrary phone number to access data.
3. Stream tool progress and final answers; add a small live agent evaluation set.
4. Improve retrieval, add document versioning, and measure whether embeddings
   improve retrieval before introducing a vector database.
5. Add deployment, shared persistent storage, rate limits, and multi-worker coordination.

No Git commits or pushes are made by setup or development commands. Review and commit
the source when you are ready; `.env`, dependencies, build output, and runtime data stay ignored.
