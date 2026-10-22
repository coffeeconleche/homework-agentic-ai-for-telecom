"""Opt-in live demo checks. Uses the configured DeepSeek key and temporary sample data."""

import argparse
import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory

from .app.agents import Assistant, DeepSeek
from .app.config import ROOT, Settings
from .app.store import Store

CASES = {
    "greeting": "Say hello in one short English sentence.",
    "inventory": "Which products are at or below their reorder point? Use a short list.",
    "rag": "What is our replenishment policy, including rules for perishable products? Cite your sources.",
    "collaboration": "Check low-stock products, research our replenishment policy, and calculate a reorder plan and estimated cost. Flag missing information.",
    "transaction": "Record a sale of 2 coffee bags for PEN 50 total.",
}


def check_case(name: str, result: dict, store: Store):
    tools = {step["tool"] for step in result["steps"]}
    agents = {step["agent"] for step in result["steps"]}
    sources = {source["source"] for source in result["sources"]}
    answer = result["answer"].lower()
    checks = {"nonempty_answer": bool(answer),
              "tools_succeeded": all(step["status"] == "completed" for step in result["steps"])}
    if name == "greeting":
        checks["no_unnecessary_tools"] = not tools
    elif name == "inventory":
        checks["queried_inventory"] = "query_inventory" in tools
        checks["expected_products"] = all(product in answer for product in ("coffee", "milk", "peanuts"))
    elif name in {"rag", "collaboration"}:
        checks["two_agents"] = agents == {"Inventory agent", "Policy researcher"}
        checks["retrieved_policy"] = "search_knowledge" in tools and "reordering.md" in sources
        checks["cited_policy"] = "[reordering.md]" in answer
        checks["milk_caveat"] = "milk" in answer and any(word in answer for word in ("expiry", "expiration", "demand"))
        if name == "collaboration":
            checks["inventory_and_calculator"] = {"query_inventory", "calculate"} <= tools
            checks["coffee_cost"] = "407" in answer
            checks["peanut_cost"] = "144" in answer
    elif name == "transaction":
        drafts = result["transactions"]
        checks["prepared_draft"] = len(drafts) == 1 and drafts[0]["status"] == "pending"
        checks["correct_details"] = bool(drafts) and all(drafts[0][key] == value for key, value in {
            "sku": "COF-001", "kind": "sale", "quantity": 2, "total": "50.00",
        }.items())
        checks["stock_unchanged"] = store.inventory("COF-001")[0]["stock"] == 8
    return checks


async def evaluate(case: str, output: Path):
    settings = Settings.from_env()
    if not settings.api_key:
        raise SystemExit("Configure the DeepSeek key in the root .env before running live checks.")
    provider = DeepSeek(settings)
    report = {"model": settings.model, "reasoning_effort": settings.reasoning_effort,
              "checked_at": datetime.now(timezone.utc).isoformat(), "cases": []}
    try:
        with TemporaryDirectory(prefix="stockai-evaluation-") as directory:
            store = Store(Path(directory) / "demo.sqlite3", settings.knowledge_path)
            assistant = Assistant(store, provider)
            for name, question in CASES.items():
                if case != "all" and name != case:
                    continue
                try:
                    result = await asyncio.wait_for(assistant.run([], question), timeout=240)
                    checks = check_case(name, result, store)
                    entry = {"name": name, "question": question, "passed": all(checks.values()),
                             "checks": checks, **{key: result[key] for key in (
                                 "answer", "steps", "sources", "transactions",
                             )}}
                except Exception as error:
                    # Avoid provider response bodies or raw exception strings in reports.
                    entry = {"name": name, "passed": False, "error_type": type(error).__name__}
                report["cases"].append(entry)
                print(f"{name}: {'PASS' if entry['passed'] else 'FAIL'}", flush=True)
                output.parent.mkdir(parents=True, exist_ok=True)
                output.write_text(json.dumps(report, indent=2))
    finally:
        await provider.close()
    print(f"Report: {output}")
    return all(entry["passed"] for entry in report["cases"])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--case", choices=["all", *CASES], default="all")
    parser.add_argument("--output", type=Path, default=ROOT / "data/demo-evaluation.json")
    args = parser.parse_args()
    raise SystemExit(0 if asyncio.run(evaluate(args.case, args.output)) else 1)
