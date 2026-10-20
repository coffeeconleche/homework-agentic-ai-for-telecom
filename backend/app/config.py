"""Load server configuration without exposing credentials to the browser."""

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Settings:
    api_key: str = field(default="", repr=False)
    base_url: str = "https://api.deepseek.com"
    model: str = "deepseek-flash"
    reasoning_effort: str = "max"
    database_path: Path = ROOT / "data/stockai.sqlite3"
    knowledge_path: Path = ROOT / "knowledge"

    @classmethod
    def from_env(cls):
        load_dotenv(ROOT / ".env")
        database = Path(os.getenv("DATABASE_PATH", "data/stockai.sqlite3"))
        effort = os.getenv("DEEPSEEK_REASONING_EFFORT", "max")
        if effort not in {"low", "high", "max"}:
            raise ValueError("DEEPSEEK_REASONING_EFFORT must be low, high, or max")
        return cls(
            api_key=os.getenv("DEEPSEEK_API_KEY") or os.getenv("DEEPSEEK-API-KEY", ""),
            base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
            model=os.getenv("DEEPSEEK_MODEL", "deepseek-flash"),
            reasoning_effort=effort,
            database_path=database if database.is_absolute() else ROOT / database,
        )
