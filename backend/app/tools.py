"""Validated queries, calculations, and transaction drafts. No arbitrary code or SQL."""

import inspect
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Callable, Literal

from pydantic import BaseModel, ConfigDict, Field


class Arguments(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class InventoryQuery(Arguments):
    query: str = Field(default="", max_length=100, description="Product name or SKU; empty means all")
    low_stock_only: bool = False


class TransactionQuery(Arguments):
    sku: str = Field(default="", max_length=40)
    kind: Literal["all", "sale", "purchase"] = "all"


class Calculation(Arguments):
    operation: Literal["add", "subtract", "multiply", "divide"]
    a: Decimal = Field(ge=-1_000_000_000, le=1_000_000_000)
    b: Decimal = Field(ge=-1_000_000_000, le=1_000_000_000)


class Question(Arguments):
    question: str = Field(min_length=1, max_length=1500)


class KnowledgeQuery(Arguments):
    query: str = Field(min_length=1, max_length=300)


class TransactionDraftArguments(Arguments):
    sku: str = Field(min_length=1, max_length=40, description="Exact SKU from query_inventory")
    kind: Literal["sale", "purchase"]
    quantity: int = Field(strict=True, ge=1, le=10000, description="Number of complete product units")
    total: Decimal = Field(gt=0, le=1_000_000_000, decimal_places=2,
                           description="Total price in the product's currency, not the unit price")


def calculate(operation: str, a: Decimal, b: Decimal):
    if operation == "divide" and b == 0:
        raise ValueError("Cannot divide by zero")
    result = {"add": lambda: a + b, "subtract": lambda: a - b,
              "multiply": lambda: a * b, "divide": lambda: a / b}[operation]()
    return {"result": str(result.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "rounding": "2 decimal places, half up"}


@dataclass
class Tool:
    name: str
    description: str
    arguments: type[BaseModel]
    function: Callable[..., Any]

    def specification(self):
        return {"type": "function", "function": {
            "name": self.name, "description": self.description,
            "parameters": self.arguments.model_json_schema(),
        }}

    async def execute(self, arguments: str):
        parsed = self.arguments.model_validate_json(arguments)
        result = self.function(**parsed.model_dump())
        return await result if inspect.isawaitable(result) else result
