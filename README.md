# StockAI · The stockroom

An English-language inventory assistant inspired by [the original WhatsApp bot](https://github.com/coffeeconleche/stockai_agent).
React chat, two DeepSeek agents, LangGraph orchestration, a small RAG knowledge base,
and six tools. It runs locally with six fictional products and twelve initial transactions.
Users can record sample sales and purchases after reviewing a confirmation card.

## Run

Requirements: Python 3.11+, Node.js 22.12+ or a current LTS, npm, and a funded DeepSeek API key.

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.lock
```

If you do not already have `.env`, copy `.env.example` to `.env` and fill in your key.
Both `DEEPSEEK_API_KEY` and the existing `DEEPSEEK-API-KEY` spelling work. Keep the
existing `.env`; never put a key in a frontend `VITE_` variable.

Start the backend:

```sh
source .venv/bin/activate
uvicorn backend.app.main:app --reload --reload-dir backend --host 127.0.0.1 --port 8000
```

In a second terminal:

```sh
cd frontend
npm ci
npm run dev
```

Open [StockAI](http://127.0.0.1:5173/) with both servers running. [API documentation](http://127.0.0.1:8000/docs)
is also available. Vite proxies `/api` to FastAPI. Opening `frontend/index.html` through
`file://` will fail because Vite must serve and transform the React source.

Defaults: `DEEPSEEK_BASE_URL=https://api.deepseek.com`, `DEEPSEEK_MODEL=deepseek-flash`,
`DEEPSEEK_REASONING_EFFORT=max`, and `DATABASE_PATH=data/stockai.sqlite3`.
As of October 20, 2026, the rolling `deepseek-flash` alias serves **DeepSeek-V4.1-Flash-1017**;
it is not an immutable snapshot. Every LLM call enables thinking with max effort.
The OpenAI Python SDK is the API client; DeepSeek is the provider. There is no fallback
model or simulated answer. Calls incur provider charges and can take tens of seconds.
See [DeepSeek release notes](https://api-docs.deepseek.com/updates/) and
[thinking-mode settings](https://api-docs.deepseek.com/guides/thinking_mode/).

## Architecture

```text
React + TypeScript + Vite
        │ /api
FastAPI ── SQLite: products, transactions, conversation history and drafts
        │
Inventory agent (LangGraph: model → tools → model, or finish)
        ├── query_inventory
        ├── query_transactions
        ├── calculate
        ├── prepare_transaction → review card → user Confirm/Cancel → FastAPI → SQLite
        └── ask_policy_agent
                    │
             Policy researcher (its own LangGraph tool loop)
                    └── search_knowledge → SQLite FTS5/BM25 → Markdown passages
                    │
             Cited findings → Inventory agent → final answer
```

| Agent | Responsibility |
| --- | --- |
| Inventory agent | Stock and transaction facts, calculations, transaction drafts, user-facing answers, and decisions to delegate |
| Policy researcher | Retrieve documented rules, cite evidence, and identify missing information |

Both use DeepSeek with different prompts and tool permissions. Every message starts
with the Inventory agent. The model selects tool calls and can delegate to the researcher;
LangGraph conditional edges continue the tool loop or finish. A greeting can skip tools,
and a restocking plan can involve both agents and several tools. The roles and allowed
operations are defined in code; the exact calls and sequence are selected by the model.
There is no independent reviewer agent.

`backend/app/agents.py` owns orchestration, `tools.py` defines Pydantic-validated tool
contracts, `store.py` owns storage and retrieval, and `main.py` exposes the API.
`frontend/src/` contains the chat, transaction cards, activity, and source displays.

The header's **Stockroom / Studio** control switches appearances without resetting the
conversation, typed message, or transaction state. Stockroom is the original shop theme;
Studio is a dark interface with an adapted [Rare UI](https://rareui.com) fluid orb.
The choice is saved locally. No dependencies or remote component loaders were added.
See the [source/security review](docs/rare-ui-review.md) and
[third-party notices](frontend/THIRD_PARTY_NOTICES.md) for provenance and license details.

## RAG, tools, and state

The three English Markdown files in `knowledge/` contain fictional replenishment,
transaction, and demo-scope policies. Startup splits them by heading and indexes chunks
in SQLite FTS5. BM25 search returns up to four passages per search. The researcher uses
the passages to answer with filename citations. This is lexical RAG, with no embedding
model or external vector database. Synonym matching is limited. Restart after editing docs.

Inventory and transactions are structured SQLite data, separate from the policy documents.
Queries use parameterized SQL and return at most 50 rows. The calculator uses `Decimal`
with two-place rounding. No tool executes arbitrary SQL or code.

For a sale or purchase, the model resolves an existing product, quantity, and total price,
then prepares a draft. **Draft preparation does not change stock.** Only the user's
Confirm button records it. Cancel leaves stock untouched. Typed confirmations do not
save transactions. Confirmation atomically checks that stock still matches the preview,
updates stock, and inserts the transaction. It prevents negative stock and duplicate
saves on retries. Stale drafts must be cancelled and prepared again. The model receives
a trusted application status update so subsequent answers can account for the decision.

Successful chats and draft decisions persist in SQLite; localStorage retains the active
chat ID. Refresh restores pending, confirmed, and cancelled cards. Failed agent runs
save no partial turns or drafts. Activity and sources appear after completion, not live.
The backend retains DeepSeek's required `reasoning_content` privately for tool-enabled
continuations; public schemas expose only questions, answers, activity, sources, and cards.
`.env`, runtime data, evaluation reports, dependencies, and builds remain ignored by Git.

This is a single-user, single-worker localhost demo with no authentication or AWS dependency.
Each request permits 16 LLM calls total, 8 per agent invocation, and a 240-second timeout;
chats allow 30 turns. Product creation/editing, fractional units, transaction editing,
and multi-currency conversion are outside scope. Sample prices use PEN. Keep it on localhost.

## Demo walkthrough

| Demonstrates | Example question and what to show |
| --- | --- |
| Structured tool | “Which products are at or below their reorder point?” → inventory tool and Coffee, Milk, Peanuts |
| RAG | “What is our replenishment policy, including rules for perishable products? Cite your sources.” → researcher and expandable passages |
| Collaboration | “Check low-stock products, research our replenishment policy, and calculate a reorder plan and estimated cost. Flag missing information.” → both agents, inventory, RAG, calculator, and milk caveats |
| Sale | “Record a sale of 2 coffee bags for PEN 50 total.” → review the card, click Confirm, then ask for current coffee stock |
| Purchase/cancel | “Record a purchase of 3 coffee bags for PEN 55.50 total.” → click Cancel and show that stock stays unchanged |
| Missing details | “Record a sale of coffee.” → ask for quantity and price |
| Memory | After a plan: “What was the coffee estimate again?” |

On fresh data, coffee has 8 bags with a target of 30: 22 × PEN 18.50 = **PEN 407.00**.
Milk estimates should be provisional because expiry and demand data are missing.
Confirming the example sale changes coffee stock from 8 to 6. Later recommendations
reflect the updated inventory. A new conversation clears chat context, not inventory.
To use a separate fresh dataset, stop the backend, choose a new `DATABASE_PATH` in `.env`,
and restart. The previous database stays intact.

## Verification

From the repository root:

```sh
source .venv/bin/activate
python -m pytest -q
cd frontend
npm run build
cd ..
```

The offline tests exercise real LangGraph graphs with a scripted model boundary:
retrieval, delegation, calculations, private-field filtering, persistence, step limits,
errors, draft validation, confirmation/cancellation, concurrent retries, and stale stock.
They make no paid API calls. Python and npm lockfiles pin the tested dependencies.

An optional live evaluation checks actual DeepSeek routing and outputs against isolated,
temporary inventory, without changing the demo database:

```sh
python -m backend.evaluate_demo
# Or one scenario:
python -m backend.evaluate_demo --case collaboration
```

It checks greeting, inventory, RAG, collaboration, and transaction drafting. This makes
paid calls. The report at `data/demo-evaluation.json` contains answers, activity, sources,
and explicit checks, with no key or private reasoning. These are demo checks, not a
comprehensive quality benchmark; generated wording and tool order can vary.

## With more time

Add product management and transaction correction, improve retrieval using a measured
question set, and stream progress and answers. Authentication, multi-user isolation,
shared persistence, and deployment would be needed for real business use, but are
intentionally outside this local demo. The original project's AWS schema informed the
business context; this application does not read or modify its business records.
