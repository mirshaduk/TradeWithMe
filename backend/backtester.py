"""
backtester.py — Historical backtesting engine for the AI trading strategy.
Simulates the AI's buy/sell signals on historical data and computes real metrics.
"""
import pandas as pd
import numpy as np
from data_fetcher import get_historical_data
from ai_engine import engine as ai_engine


def run_backtest(symbol: str = "BTC/USDT", timeframe: str = "1h",
                 lookback: int = 500, tp_pct: float = 1.5, sl_pct: float = 0.8,
                 leverage: int = 10, margin_pct: float = 2.0,
                 min_confidence: float = 60.0) -> dict:

    print(f"[BACKTEST] Running backtest for {symbol} over {lookback} {timeframe} candles...")

    # Fetch raw data
    raw = get_historical_data(symbol, timeframe=timeframe, limit=lookback)
    if len(raw) < 100:
        return {"error": "Not enough historical data"}

    df = pd.DataFrame(raw)
    df = ai_engine._calculate_indicators(df)
    df.reset_index(drop=True, inplace=True)

    features = ai_engine.FEATURES
    if not ai_engine.is_trained:
        ai_engine.train_model(symbol)

    # Predict signals for every bar
    X = df[features]
    predictions = ai_engine.pipeline.predict(X)
    probabilities = ai_engine.pipeline.predict_proba(X).max(axis=1) * 100

    # Simulate trades
    starting_balance = 100_000.0
    balance = starting_balance
    equity_curve = [balance]
    trades = []

    i = 0
    while i < len(df) - 1:
        pred = predictions[i]
        conf = probabilities[i]

        if conf < min_confidence or pred == 0:
            equity_curve.append(balance)
            i += 1
            continue

        is_long = pred == 1
        entry_price = df["close"].iloc[i]
        margin = balance * (margin_pct / 100)
        pos_value = margin * leverage

        tp_price = entry_price * (1 + tp_pct / 100) if is_long else entry_price * (1 - tp_pct / 100)
        sl_price = entry_price * (1 - sl_pct / 100) if is_long else entry_price * (1 + sl_pct / 100)

        # Scan forward to find TP/SL hit
        closed = False
        result_pnl = 0.0
        exit_reason = "End of Data"
        exit_price = entry_price
        exit_bar = i + 1

        for j in range(i + 1, min(i + 50, len(df))):
            candle_h = df["high"].iloc[j]
            candle_l = df["low"].iloc[j]

            if is_long:
                if candle_h >= tp_price:
                    exit_price = tp_price; exit_reason = "TP"; exit_bar = j; closed = True; break
                if candle_l <= sl_price:
                    exit_price = sl_price; exit_reason = "SL"; exit_bar = j; closed = True; break
            else:
                if candle_l <= tp_price:
                    exit_price = tp_price; exit_reason = "TP"; exit_bar = j; closed = True; break
                if candle_h >= sl_price:
                    exit_price = sl_price; exit_reason = "SL"; exit_bar = j; closed = True; break

        if not closed:
            exit_price = df["close"].iloc[min(i + 50, len(df) - 1)]
            exit_bar = min(i + 50, len(df) - 1)

        # Calculate PnL
        if is_long:
            result_pnl = (pos_value / entry_price) * (exit_price - entry_price)
        else:
            result_pnl = (pos_value / entry_price) * (entry_price - exit_price)

        balance += result_pnl
        balance = max(balance, 0)

        trades.append({
            "bar": int(i),
            "time": int(df["time"].iloc[i]) if "time" in df.columns else i,
            "type": "LONG" if is_long else "SHORT",
            "entry": round(float(entry_price), 2),
            "exit": round(float(exit_price), 2),
            "pnl": round(float(result_pnl), 2),
            "reason": exit_reason,
            "confidence": round(float(conf), 1),
            "balance": round(float(balance), 2)
        })

        # Fill equity curve up to exit bar
        for _ in range(exit_bar - i):
            equity_curve.append(balance)

        i = exit_bar + 1

    # Compute summary metrics
    if trades:
        pnls = [t["pnl"] for t in trades]
        wins  = [p for p in pnls if p > 0]
        losses = [p for p in pnls if p <= 0]

        win_rate     = round(len(wins) / len(pnls) * 100, 1)
        avg_win      = round(sum(wins) / len(wins), 2) if wins else 0
        avg_loss     = round(abs(sum(losses) / len(losses)), 2) if losses else 0
        profit_factor = round(sum(wins) / max(abs(sum(losses)), 0.01), 2)
        total_pnl    = round(sum(pnls), 2)
        max_dd       = round(min(pnls), 2)
        rr_ratio     = round(avg_win / max(avg_loss, 0.01), 2)
        best_trade   = max(trades, key=lambda t: t["pnl"])
        worst_trade  = min(trades, key=lambda t: t["pnl"])
    else:
        win_rate = avg_win = avg_loss = profit_factor = total_pnl = max_dd = rr_ratio = 0
        best_trade = worst_trade = None

    return {
        "symbol": symbol,
        "timeframe": timeframe,
        "total_trades": len(trades),
        "win_rate": win_rate,
        "profit_factor": profit_factor,
        "total_pnl": total_pnl,
        "avg_win": avg_win,
        "avg_loss": avg_loss,
        "rr_ratio": rr_ratio,
        "max_drawdown": max_dd,
        "final_balance": round(balance, 2),
        "return_pct": round((balance - starting_balance) / starting_balance * 100, 2),
        "best_trade": best_trade,
        "worst_trade": worst_trade,
        "equity_curve": [round(e, 2) for e in equity_curve[-500:]],  # Last 500 points
        "trades": trades[-50:]  # Last 50 trades for UI table
    }
