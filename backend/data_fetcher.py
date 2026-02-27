import ccxt
import pandas as pd

def get_historical_data(symbol: str = "BTC/USDT", timeframe: str = "1d", limit: int = 100):
    """
    Connects to the Binance exchange via ccxt and fetches historical OHLCV data.
    Returns the data as a list of dictionaries suitable for TradingView Lightweight Charts.
    """
    try:
        exchange = ccxt.binance()
        # Fetch OHLCV data: [timestamp, open, high, low, close, volume]
        ohlcv = exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
        
        # Format the data for the frontend chart (Lightweight Charts expects time in seconds)
        formatted_data = []
        for row in ohlcv:
            formatted_data.append({
                "time": int(row[0] / 1000), # Convert ms to s
                "open": row[1],
                "high": row[2],
                "low": row[3],
                "close": row[4],
                "value": row[4], # Use close as line value if needed
            })
        return formatted_data
    except Exception as e:
        print(f"Error fetching data: {e}")
        return []

if __name__ == "__main__":
    # Test fetch
    data = get_historical_data()
    print(f"Fetched {len(data)} candles. Latest: {data[-1] if data else 'None'}")
