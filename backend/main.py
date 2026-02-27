from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from data_fetcher import get_historical_data
from ai_engine import generate_suggestions

app = FastAPI(title="TradeWithMe AI API")

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

@app.get("/")
def read_root():
    return {"message": "Welcome to TradeWithMe API"}

@app.get("/api/market-data")
def get_market_data(symbol: str = "BTC/USDT", timeframe: str = "1d", limit: int = 100):
    """
    Fetches historical OHLCV market data for the given symbol.
    """
    data = get_historical_data(symbol, timeframe, limit)
    return {"status": "success", "data": data}

@app.get("/api/suggestions")
def get_ai_suggestions(symbol: str = "BTC/USDT"):
    """
    Generates AI trading suggestions based on recent market data.
    """
    suggestions = generate_suggestions(symbol)
    return {"status": "success", "data": suggestions}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
