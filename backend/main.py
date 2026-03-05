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

# ─── Performance Dashboard ─────────────────────────────────────────────────

@app.get("/api/performance")
def get_performance():
    """Compute AI trading stats from the local trade history."""
    from settings_manager import get_settings
    trades = get_history()
    if not trades:
        return {"status": "success", "data": {"total_trades": 0}}

    pnls    = [t["pnl"] for t in trades]
    wins    = [p for p in pnls if p > 0]
    losses  = [p for p in pnls if p <= 0]
    tp_wins = [t for t in trades if t.get("reason") == "Take Profit"]
    sl_hits = [t for t in trades if t.get("reason") == "Stop Loss"]

    avg_win  = round(sum(wins) / len(wins), 2)   if wins   else 0
    avg_loss = round(abs(sum(losses)/len(losses)),2) if losses else 0

    # Build equity curve (running balance from $100k start)
    equity = []
    running = get_balance()  # current balance
    for t in reversed(trades):  # history is newest-first
        running -= t["pnl"]
    for t in reversed(trades):
        running += t["pnl"]
        equity.append(round(running, 2))

    best  = max(trades, key=lambda t: t["pnl"])
    worst = min(trades, key=lambda t: t["pnl"])

    return {
        "status": "success",
        "data": {
            "total_trades":   len(trades),
            "win_rate":       round(len(wins)/len(pnls)*100, 1),
            "profit_factor":  round(sum(wins)/max(abs(sum(losses)),0.01), 2),
            "total_pnl":      round(sum(pnls), 2),
            "avg_win":        avg_win,
            "avg_loss":       avg_loss,
            "rr_ratio":       round(avg_win/max(avg_loss,0.01), 2),
            "tp_count":       len(tp_wins),
            "sl_count":       len(sl_hits),
            "best_trade":     best,
            "worst_trade":    worst,
            "equity_curve":   equity,
            "recent_trades":  list(reversed(trades))[:20],
        }
    }

# ─── Settings ─────────────────────────────────────────────────────────────

from settings_manager import get_settings, save_settings

@app.get("/api/settings")
def fetch_settings():
    return {"status": "success", "data": get_settings()}

@app.post("/api/settings")
def update_settings(body: dict):
    saved = save_settings(body)
    return {"status": "success", "data": saved}

# ─── Backtesting ──────────────────────────────────────────────────────────

from backtester import run_backtest

class BacktestRequest(BaseModel):
    symbol:       str   = "BTC/USDT"
    timeframe:    str   = "1h"
    lookback:     int   = 500
    tp_pct:       float = 1.5
    sl_pct:       float = 0.8
    leverage:     int   = 10
    margin_pct:   float = 2.0
    min_confidence: float = 60.0

@app.post("/api/backtest")
def run_backtest_api(req: BacktestRequest):
    result = run_backtest(
        symbol=req.symbol, timeframe=req.timeframe, lookback=req.lookback,
        tp_pct=req.tp_pct, sl_pct=req.sl_pct, leverage=req.leverage,
        margin_pct=req.margin_pct, min_confidence=req.min_confidence
    )
    return {"status": "success", "data": result}

# ─── News Feed ────────────────────────────────────────────────────────────────

from news_feed import get_news

@app.get("/api/news")
def news_endpoint(currencies: str = "BTC,ETH,SOL", limit: int = 20):
    """Return latest crypto news headlines with sentiment scores."""
    data = get_news(currencies=currencies, limit=limit)
    return {"status": "success", "data": data}

# ─── AI Feedback Status ───────────────────────────────────────────────────────

@app.get("/api/feedback-status")
def feedback_status():
    """Returns the last feedback loop stats (how many trades were used in last retrain)."""
    if os.path.exists(FEEDBACK_PATH):
        with open(FEEDBACK_PATH) as f:
            return {"status": "success", "data": json.load(f)}
    return {"status": "success", "data": {"trades_used": 0, "bars_reweighted": 0}}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
