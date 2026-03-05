"""
database.py — Local SQLite persistence for TradeWithMe.
Stores portfolio balance, open positions, and trade history on the user's PC.
The .db file is stored in the user's home directory: ~/tradewithme_data.db
"""
import sqlite3
import os
import json
from datetime import datetime

# Store the database in the user's home directory so it persists
DB_PATH = os.path.join(os.path.expanduser("~"), "tradewithme_data.db")

def get_db():
    """Get a database connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Return rows as dicts
    return conn

def init_db():
    """Initialize the database tables if they don't exist."""
    conn = get_db()
    cursor = conn.cursor()

    # Portfolio settings (balance etc.)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS portfolio (
            id INTEGER PRIMARY KEY,
            balance REAL NOT NULL DEFAULT 100000.0,
            updated_at TEXT NOT NULL
        )
    """)

    # Open/active positions
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS positions (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            margin REAL NOT NULL,
            leverage INTEGER NOT NULL,
            entry_price REAL NOT NULL,
            tp REAL,
            sl REAL,
            opened_at TEXT NOT NULL
        )
    """)

    # Closed trade history
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS history (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            margin REAL NOT NULL,
            leverage INTEGER NOT NULL,
            entry_price REAL NOT NULL,
            close_price REAL,
            tp REAL,
            sl REAL,
            pnl REAL NOT NULL,
            reason TEXT,
            opened_at TEXT NOT NULL,
            closed_at TEXT NOT NULL
        )
    """)

    # AI feedback weights (sample-level reweighting for next retrain)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS feedback_weights (
            id INTEGER PRIMARY KEY,
            feature_snapshot TEXT NOT NULL,
            action TEXT NOT NULL,
            outcome REAL NOT NULL,
            weight REAL NOT NULL DEFAULT 1.0,
            created_at TEXT NOT NULL
        )
    """)

    # Insert default portfolio if not exists
    cursor.execute("SELECT COUNT(*) FROM portfolio")
    if cursor.fetchone()[0] == 0:
        cursor.execute(
            "INSERT INTO portfolio (balance, updated_at) VALUES (?, ?)",
            (100000.0, datetime.utcnow().isoformat())
        )

    conn.commit()
    conn.close()
    print(f"[DB] Database initialized at: {DB_PATH}")

# ─── Portfolio ────────────────────────────────────────────────────────────────

def get_balance() -> float:
    conn = get_db()
    row = conn.execute("SELECT balance FROM portfolio WHERE id = 1").fetchone()
    conn.close()
    return row["balance"] if row else 100000.0

def set_balance(new_balance: float):
    conn = get_db()
    conn.execute(
        "UPDATE portfolio SET balance = ?, updated_at = ? WHERE id = 1",
        (new_balance, datetime.utcnow().isoformat())
    )
    conn.commit()
    conn.close()

# ─── Positions ────────────────────────────────────────────────────────────────

def get_positions() -> list:
    conn = get_db()
    rows = conn.execute("SELECT * FROM positions ORDER BY opened_at DESC").fetchall()
    conn.close()
    return [dict(row) for row in rows]

def save_position(pos: dict):
    conn = get_db()
    conn.execute("""
        INSERT OR REPLACE INTO positions 
        (id, type, margin, leverage, entry_price, tp, sl, opened_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        pos["id"], pos["type"], pos["margin"], pos["leverage"],
        pos["entryPrice"], pos.get("tp"), pos.get("sl"), pos["openedAt"]
    ))
    conn.commit()
    conn.close()

def delete_position(position_id: str):
    conn = get_db()
    conn.execute("DELETE FROM positions WHERE id = ?", (position_id,))
    conn.commit()
    conn.close()

# ─── History ──────────────────────────────────────────────────────────────────

def get_history() -> list:
    conn = get_db()
    rows = conn.execute("SELECT * FROM history ORDER BY closed_at DESC").fetchall()
    conn.close()
    return [dict(row) for row in rows]

def save_history_entry(entry: dict):
    conn = get_db()
    conn.execute("""
        INSERT OR REPLACE INTO history 
        (id, type, margin, leverage, entry_price, close_price, tp, sl, pnl, reason, opened_at, closed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        entry["id"], entry["type"], entry["margin"], entry["leverage"],
        entry["entryPrice"], entry.get("closePrice"), entry.get("tp"), entry.get("sl"),
        entry["pnl"], entry.get("reason", "Market Close"),
        entry["openedAt"], entry.get("closedAt", datetime.utcnow().isoformat())
    ))
    conn.commit()
    conn.close()
