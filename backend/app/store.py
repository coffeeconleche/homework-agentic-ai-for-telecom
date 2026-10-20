"""SQLite demo inventory, durable conversations, and lexical RAG retrieval."""

import json
import re
import sqlite3
from contextlib import closing
from decimal import Decimal
from pathlib import Path
from uuid import uuid4


class Store:
    def __init__(self, database_path: Path, knowledge_path: Path):
        self.database_path = database_path
        database_path.parent.mkdir(parents=True, exist_ok=True)
        with closing(self.connect()) as db, db:
            db.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS products (
                    sku TEXT PRIMARY KEY, name TEXT NOT NULL, unit TEXT NOT NULL,
                    stock INTEGER NOT NULL, reorder_point INTEGER NOT NULL,
                    target_stock INTEGER NOT NULL, unit_cost TEXT NOT NULL,
                    currency TEXT NOT NULL DEFAULT 'PEN'
                );
                CREATE TABLE IF NOT EXISTS transactions (
                    id INTEGER PRIMARY KEY, sku TEXT NOT NULL, kind TEXT NOT NULL,
                    quantity INTEGER NOT NULL, total TEXT NOT NULL, date TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY, messages TEXT NOT NULL DEFAULT '[]',
                    turns TEXT NOT NULL DEFAULT '[]'
                );
                CREATE VIRTUAL TABLE IF NOT EXISTS knowledge USING fts5(
                    source UNINDEXED, title, content,
                    tokenize='unicode61 remove_diacritics 2'
                );
            """)
            # Idempotent sample seed; these are fictional records, never AWS data.
            products = [
                ("COF-001", "Coffee", "250g bag", 8, 10, 30, "18.50", "PEN"),
                ("SUG-001", "Sugar", "1kg bag", 25, 10, 40, "3.80", "PEN"),
                ("PEA-001", "Peanuts", "500g bag", 4, 8, 24, "7.20", "PEN"),
                ("RIC-001", "Rice", "1kg bag", 35, 12, 50, "4.10", "PEN"),
                ("MIL-001", "Milk", "1L carton", 6, 10, 30, "4.50", "PEN"),
                ("TEA-001", "Tea", "20-bag box", 18, 6, 24, "5.00", "PEN"),
            ]
            for i, product in enumerate(products):
                inserted = db.execute(
                    "INSERT OR IGNORE INTO products VALUES (?,?,?,?,?,?,?,?)", product
                ).rowcount
                # Refresh demo display names without changing stock or transactions.
                db.execute("UPDATE products SET name = ? WHERE sku = ?", (product[1], product[0]))
                if inserted:
                    db.executemany("INSERT INTO transactions VALUES (?,?,?,?,?,?)", [
                        (i * 2 + 1, product[0], "purchase", product[3] + 5,
                         str((product[3] + 5) * Decimal(product[6])), "2026-10-01"),
                        (i * 2 + 2, product[0], "sale", 5,
                         str((5 * Decimal(product[6]) * Decimal("1.4")).quantize(Decimal("0.01"))), "2026-10-15"),
                    ])
            db.execute("DELETE FROM knowledge")
            for document in sorted(knowledge_path.glob("*.md")):
                for chunk in re.split(r"\n(?=## )", document.read_text()):
                    title = chunk.splitlines()[0].lstrip("# ")
                    db.execute("INSERT INTO knowledge VALUES (?,?,?)", (
                        document.name, title, chunk.strip(),
                    ))

    def connect(self):
        db = sqlite3.connect(self.database_path, timeout=10)
        db.row_factory = sqlite3.Row
        return db

    def inventory(self, query: str = "", low_stock_only: bool = False):
        # Literal substring matching; values never become SQL syntax.
        with closing(self.connect()) as db:
            rows = db.execute("""
                SELECT * FROM products
                WHERE (instr(lower(name), lower(?)) > 0 OR instr(lower(sku), lower(?)) > 0)
                AND (? = 0 OR stock <= reorder_point) ORDER BY sku LIMIT 50
            """, (query, query, low_stock_only)).fetchall()
            return [dict(row) for row in rows]

    def transactions(self, sku: str = "", kind: str = "all"):
        with closing(self.connect()) as db:
            rows = db.execute("""
                SELECT t.*, p.name, p.currency FROM transactions t
                JOIN products p USING (sku)
                WHERE (? = '' OR t.sku = ?) AND (? = 'all' OR t.kind = ?)
                ORDER BY t.date DESC, t.id DESC LIMIT 50
            """, (sku, sku, kind, kind)).fetchall()
            return [dict(row) for row in rows]

    def search_knowledge(self, query: str):
        # Construct FTS syntax ourselves: no raw user/model query syntax.
        stopwords = {"a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
                     "how", "in", "is", "it", "of", "on", "or", "our", "the", "to",
                     "what", "when", "which", "with"}
        terms = list(dict.fromkeys(term for term in re.findall(r"[^\W_]+", query.lower())
                                   if term not in stopwords))[:24]
        if not terms:
            return []
        expression = " OR ".join(f'"{term}"' for term in terms)
        with closing(self.connect()) as db:
            rows = db.execute("""
                SELECT source, title, content FROM knowledge
                WHERE knowledge MATCH ? ORDER BY bm25(knowledge) LIMIT 4
            """, (expression,)).fetchall()
            return [dict(row) for row in rows]

    def create_conversation(self):
        conversation_id = str(uuid4())
        with closing(self.connect()) as db, db:
            db.execute("INSERT INTO conversations(id) VALUES (?)", (conversation_id,))
        return conversation_id

    def conversation(self, conversation_id: str):
        with closing(self.connect()) as db:
            row = db.execute("SELECT * FROM conversations WHERE id = ?", (conversation_id,)).fetchone()
            if row is None:
                return None
            return {"id": row["id"], "messages": json.loads(row["messages"]),
                    "turns": json.loads(row["turns"])}

    def save_turn(self, conversation_id: str, messages: list, turn: dict):
        with closing(self.connect()) as db, db:
            row = db.execute("SELECT turns FROM conversations WHERE id = ?", (conversation_id,)).fetchone()
            turns = json.loads(row["turns"]) + [turn]
            db.execute("UPDATE conversations SET messages = ?, turns = ? WHERE id = ?", (
                json.dumps(messages), json.dumps(turns), conversation_id,
            ))
