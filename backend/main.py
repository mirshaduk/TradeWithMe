from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn
import os
from data_fetcher import get_historical_data
from ai_engine import generate_suggestions, get_feature_importances
from database import (
    init_db, get_balance, set_balance,
    get_positions, save_position, delete_position,
    get_history, save_history_entry
)

app = FastAPI(title="TradeWithMe AI API")

# Initialize local SQLite DB on startup
init_db()

# Configure CORS - allow both local dev and production Vercel URL
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        FRONTEND_URL,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Market Data & AI ──────────────────────────────────────────────────────

@app.get("/")
def read_root():
    return {"message": "Welcome to TradeWithMe API"}

@app.get("/api/market-data")
def get_market_data(symbol: str = "BTC/USDT", timeframe: str = "1d", limit: int = 100):
    data = get_historical_data(symbol, timeframe, limit)
    return {"status": "success", "data": data}

@app.get("/api/suggestions")
def get_ai_suggestions(symbol: str = "BTC/USDT"):
    suggestions = generate_suggestions(symbol)
    return {"status": "success", "data": suggestions}

@app.get("/api/feature-importances")
def get_importances():
    """Returns the top features the AI uses to make decisions."""
    importances = get_feature_importances()
    return {"status": "success", "data": importances}

@app.get("/api/market-scan")
def market_scan():
    """
    Scans multiple crypto symbols in parallel and returns AI signals for each.
    Used by the AI Markets scanner page.
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed

    SYMBOLS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT",
               "DOGE/USDT", "ADA/USDT", "AVAX/USDT"]

    results = []

    def scan_symbol(sym):
        try:
            data = generate_suggestions(sym)
            data["symbol"] = sym
            return data
        except Exception as e:
            return {"symbol": sym, "action": "HOLD", "confidence": 0,
                    "reason": f"Error: {str(e)}", "current_price": 0}

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(scan_symbol, s): s for s in SYMBOLS}
        for future in as_completed(futures):
            results.append(future.result())

    # Sort: BUY first, then SELL, then HOLD; highest confidence first within each
    order = {"BUY": 0, "SELL": 1, "HOLD": 2}
    results.sort(key=lambda x: (order.get(x.get("action", "HOLD"), 2), -x.get("confidence", 0)))

    return {"status": "success", "data": results}

# ─── Portfolio Persistence ─────────────────────────────────────────────────

@app.get("/api/portfolio")
def get_portfolio():
    """Load saved portfolio state from local SQLite DB."""
    return {
        "status": "success",
        "data": {
            "balance": get_balance(),
            "positions": get_positions(),
            "history": get_history()
        }
    }

class BalanceUpdate(BaseModel):
    balance: float

@app.post("/api/portfolio/balance")
def update_balance(body: BalanceUpdate):
    """Save updated balance to local DB."""
    set_balance(body.balance)
    return {"status": "success", "balance": body.balance}

# ─── Positions ────────────────────────────────────────────────────────────

class PositionModel(BaseModel):
    id: str
    type: str
    margin: float
    leverage: int
    entryPrice: float
    tp: Optional[float] = None
    sl: Optional[float] = None
    openedAt: str

@app.post("/api/positions")
def open_position(pos: PositionModel):
    """Save a newly opened position to local DB."""
    save_position(pos.dict())
    return {"status": "success"}

@app.delete("/api/positions/{position_id}")
def close_position_db(position_id: str):
    """Remove a closed position from the DB."""
    delete_position(position_id)
    return {"status": "success"}

# ─── History ──────────────────────────────────────────────────────────────

class HistoryEntry(BaseModel):
    id: str
    type: str
    margin: float
    leverage: int
    entryPrice: float
    closePrice: Optional[float] = None
    tp: Optional[float] = None
    sl: Optional[float] = None
    pnl: float
    reason: Optional[str] = "Market Close"
    openedAt: str
    closedAt: str

@app.post("/api/history")
def add_history(entry: HistoryEntry):
    """Save a closed trade to trade history in local DB."""
    save_history_entry(entry.dict())
    return {"status": "success"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
