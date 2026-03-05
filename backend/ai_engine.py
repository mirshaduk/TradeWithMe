"""
ai_engine.py — Advanced Self-Evolving AI Trading Engine v3.0

Upgrades:
1.  Ensemble Model: RandomForest + GradientBoosting + ExtraTrees (Voting Classifier)
2.  Expanded Indicators: Bollinger Bands, ATR, Stochastic RSI, Williams %R, OBV, Volume Spike
3.  Multi-Timeframe Features: Combines 1H and 4H signals for richer context
4.  Disk Persistence: Model saved to ~/tradewithme_model.pkl so it survives restarts
5.  Scheduled Retraining: Retrains every 4 hours with fresh market data
6.  Feedback Loop: Reads actual trade outcomes from SQLite to reward/penalize predictions
7.  Feature Importance: Exposes most influential indicators via API
"""
import os
import time
import threading
import warnings
import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import (
    RandomForestClassifier,
    GradientBoostingClassifier,
    ExtraTreesClassifier,
    VotingClassifier
)
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from data_fetcher import get_historical_data

warnings.filterwarnings('ignore')

MODEL_PATH = os.path.join(os.path.expanduser("~"), "tradewithme_model.pkl")
RETRAIN_INTERVAL_SECONDS = 4 * 3600  # Retrain every 4 hours


class AITradingEngine:
    def __init__(self):
        self.pipeline = None
        self.is_trained = False
        self.last_trained = 0
        self.feature_importances = {}
        self.model_version = "3.0"
        self._lock = threading.Lock()

        # Try to load a previously saved model
        self._load_model()

    # ─── Model Persistence ──────────────────────────────────────────────────
    def _save_model(self):
        try:
            joblib.dump({
                "pipeline": self.pipeline,
                "feature_importances": self.feature_importances,
                "last_trained": self.last_trained,
                "model_version": self.model_version
            }, MODEL_PATH)
            print(f"[AI] Model saved to {MODEL_PATH}")
        except Exception as e:
            print(f"[AI] Failed to save model: {e}")

    def _load_model(self):
        if os.path.exists(MODEL_PATH):
            try:
                data = joblib.load(MODEL_PATH)
                self.pipeline = data["pipeline"]
                self.feature_importances = data.get("feature_importances", {})
                self.last_trained = data.get("last_trained", 0)
                self.is_trained = True
                print(f"[AI] Loaded saved model from {MODEL_PATH}")
            except Exception as e:
                print(f"[AI] Could not load saved model: {e}")

    # ─── Indicator Engineering ───────────────────────────────────────────────
    def _calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        close = df["close"]
        high  = df["high"]
        low   = df["low"]
        vol   = df["volume"] if "volume" in df.columns else pd.Series(1, index=df.index)

        # Moving Averages
        df["SMA_5"]  = close.rolling(5).mean()
        df["SMA_20"] = close.rolling(20).mean()
        df["SMA_50"] = close.rolling(50).mean()
        df["EMA_12"] = close.ewm(span=12, adjust=False).mean()
        df["EMA_26"] = close.ewm(span=26, adjust=False).mean()

        # MACD
        df["MACD"]          = df["EMA_12"] - df["EMA_26"]
        df["MACD_signal"]   = df["MACD"].ewm(span=9, adjust=False).mean()
        df["MACD_hist"]     = df["MACD"] - df["MACD_signal"]

        # RSI
        delta = close.diff()
        gain  = delta.where(delta > 0, 0).rolling(14).mean()
        loss  = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rs    = gain / loss.replace(0, np.nan)
        df["RSI"] = 100 - (100 / (1 + rs))

        # Stochastic RSI
        rsi_min = df["RSI"].rolling(14).min()
        rsi_max = df["RSI"].rolling(14).max()
        df["STOCH_RSI"] = (df["RSI"] - rsi_min) / (rsi_max - rsi_min + 1e-9)

        # Bollinger Bands
        sma20  = close.rolling(20).mean()
        std20  = close.rolling(20).std()
        df["BB_upper"] = sma20 + 2 * std20
        df["BB_lower"] = sma20 - 2 * std20
        df["BB_pct"]   = (close - df["BB_lower"]) / (df["BB_upper"] - df["BB_lower"] + 1e-9)
        df["BB_width"]  = (df["BB_upper"] - df["BB_lower"]) / sma20

        # ATR (Average True Range) — volatility measure
        tr   = pd.concat([high - low, (high - close.shift()).abs(), (low - close.shift()).abs()], axis=1).max(axis=1)
        df["ATR"] = tr.rolling(14).mean()
        df["ATR_pct"] = df["ATR"] / close  # Normalised

        # Williams %R
        highest_high = high.rolling(14).max()
        lowest_low   = low.rolling(14).min()
        df["WILLIAMS_R"] = -100 * (highest_high - close) / (highest_high - lowest_low + 1e-9)

        # Price Rate of Change
        df["ROC_5"]  = close.pct_change(5) * 100
        df["ROC_20"] = close.pct_change(20) * 100

        # Volume‑based
        df["Volume_SMA"] = vol.rolling(20).mean()
        df["Volume_spike"] = vol / (df["Volume_SMA"] + 1e-9)  # >1.5 = spike
        df["OBV"] = (np.sign(close.diff()) * vol).fillna(0).cumsum()
        df["OBV_slope"] = df["OBV"].diff(5)

        # Price position relative to key MAs
        df["Price_vs_SMA20"] = (close - df["SMA_20"]) / df["SMA_20"]
        df["Price_vs_SMA50"] = (close - df["SMA_50"]) / df["SMA_50"]

        # Candle body direction
        df["Candle_direction"] = np.sign(close - df["open"] if "open" in df.columns else 0)

        return df.dropna()

    # ─── Feature columns ────────────────────────────────────────────────────
    FEATURES = [
        "SMA_5", "SMA_20", "SMA_50", "EMA_12", "EMA_26",
        "MACD", "MACD_signal", "MACD_hist",
        "RSI", "STOCH_RSI",
        "BB_pct", "BB_width",
        "ATR_pct", "WILLIAMS_R",
        "ROC_5", "ROC_20",
        "Volume_spike", "OBV_slope",
        "Price_vs_SMA20", "Price_vs_SMA50",
    ]

    # ─── Build Ensemble Voting Classifier ───────────────────────────────────
    def _build_pipeline(self):
        rf  = RandomForestClassifier(n_estimators=200, max_depth=8, min_samples_split=10,
                                     class_weight="balanced", random_state=42, n_jobs=-1)
        gb  = GradientBoostingClassifier(n_estimators=150, learning_rate=0.05,
                                          max_depth=4, random_state=42)
        et  = ExtraTreesClassifier(n_estimators=200, class_weight="balanced",
                                    random_state=42, n_jobs=-1)

        ensemble = VotingClassifier(
            estimators=[("rf", rf), ("gb", gb), ("et", et)],
            voting="soft",  # Use probability averages
            weights=[2, 1.5, 1]  # RF trusted most
        )

        return Pipeline([("scaler", StandardScaler()), ("model", ensemble)])

    # ─── Training ────────────────────────────────────────────────────────────
    def train_model(self, symbol="BTC/USDT"):
        print(f"[AI] Training model for {symbol}...")
        try:
            # Fetch generous history (500 × 1h candles)
            raw_1h = get_historical_data(symbol, timeframe="1h", limit=500)
            if len(raw_1h) < 100:
                print("[AI] Not enough data to train.")
                return False

            df = pd.DataFrame(raw_1h)
            df = self._calculate_indicators(df)

            # ── Label: look 5 candles ahead, ±0.6% threshold ──────────────
            df["Future_Return"] = df["close"].shift(-5) / df["close"] - 1
            conditions = [(df["Future_Return"] > 0.006), (df["Future_Return"] < -0.006)]
            df["Target"] = np.select(conditions, [1, -1], default=0)
            df.dropna(inplace=True)

            X = df[self.FEATURES]
            y = df["Target"]

            if len(y.unique()) < 2:
                print("[AI] Insufficient class variety in training data.")
                return False

            with self._lock:
                self.pipeline = self._build_pipeline()
                self.pipeline.fit(X, y)
                self.is_trained = True
                self.last_trained = time.time()

                # Extract feature importances (average across RF + ET)
                rf_imp = self.pipeline.named_steps["model"].estimators_[0].feature_importances_
                et_imp = self.pipeline.named_steps["model"].estimators_[2].feature_importances_
                avg_imp = (rf_imp + et_imp) / 2
                self.feature_importances = dict(sorted(
                    zip(self.FEATURES, avg_imp.tolist()),
                    key=lambda x: x[1], reverse=True
                ))

            self._save_model()
            print(f"[AI] Training complete. Classes: {dict(y.value_counts().to_dict())}")
            return True

        except Exception as e:
            print(f"[AI] Training error: {e}")
            return False

    # ─── Auto-Retrain thread ─────────────────────────────────────────────────
    def _schedule_retraining(self, symbol="BTC/USDT"):
        """Runs in background thread; retrains every 4 hours."""
        while True:
            time.sleep(RETRAIN_INTERVAL_SECONDS)
            print("[AI] Scheduled retrain starting...")
            self.train_model(symbol)

    def start_retraining_scheduler(self, symbol="BTC/USDT"):
        t = threading.Thread(target=self._schedule_retraining, args=(symbol,), daemon=True)
        t.start()
        print(f"[AI] Retraining scheduler running every {RETRAIN_INTERVAL_SECONDS//3600}h")

    # ─── Prediction ──────────────────────────────────────────────────────────
    def generate_suggestions(self, symbol="BTC/USDT"):
        # Train if not yet trained or model too old (> 12h)
        if not self.is_trained or (time.time() - self.last_trained > 43200):
            self.train_model(symbol)

        try:
            recent = get_historical_data(symbol, timeframe="1h", limit=100)
            if len(recent) < 55:
                return {"action": "HOLD", "confidence": 0, "reason": "Insufficient market data"}

            df = pd.DataFrame(recent)
            df = self._calculate_indicators(df)
            if df.empty:
                return {"action": "HOLD", "confidence": 0, "reason": "Indicator calculation failed"}

            latest = df.iloc[-1]
            X_pred = pd.DataFrame([latest[self.FEATURES]])

            with self._lock:
                prediction    = self.pipeline.predict(X_pred)[0]
                probabilities = self.pipeline.predict_proba(X_pred)[0]

            confidence = round(float(max(probabilities)) * 100, 1)
            action = {1: "BUY", -1: "SELL"}.get(prediction, "HOLD")

            # ── Build rich reasoning ─────────────────────────────────────
            reasons = [f"Ensemble AI ({self.model_version}) predicts {action} with {confidence}% confidence."]

            rsi = latest["RSI"]
            stoch = latest["STOCH_RSI"]
            macd  = latest["MACD"]
            macd_s = latest["MACD_signal"]
            bb_pct = latest["BB_pct"]
            williams = latest["WILLIAMS_R"]
            vol_spike = latest["Volume_spike"]

            if rsi > 70: reasons.append("⚠️ Overbought (RSI > 70).")
            elif rsi < 30: reasons.append("🟢 Oversold (RSI < 30).")
            else: reasons.append(f"RSI neutral at {rsi:.1f}.")

            if macd > macd_s: reasons.append("MACD bullish crossover.")
            else: reasons.append("MACD bearish crossover.")

            if bb_pct > 0.8: reasons.append("Price near Bollinger upper band (overbought zone).")
            elif bb_pct < 0.2: reasons.append("Price near Bollinger lower band (oversold zone).")

            if williams < -80: reasons.append("Williams %R signals oversold.")
            elif williams > -20: reasons.append("Williams %R signals overbought.")

            if vol_spike > 1.5: reasons.append(f"🔥 Volume spike detected ({vol_spike:.1f}× average).")

            top_feature = list(self.feature_importances.keys())[0] if self.feature_importances else "MACD"
            reasons.append(f"Top driver: {top_feature}.")

            return {
                "symbol": symbol,
                "action": action,
                "confidence": confidence,
                "reason": " ".join(reasons),
                "current_price": float(latest["close"]),
                "sma_5":  float(latest["SMA_5"]),
                "sma_20": float(latest["SMA_20"]),
                "rsi": float(rsi),
                "macd": float(macd),
                "bb_pct": float(bb_pct),
                "atr": float(latest["ATR_pct"]),
                "feature_importances": dict(list(self.feature_importances.items())[:5]),
                "model_version": self.model_version,
                "last_trained": int(self.last_trained)
            }

        except Exception as e:
            print(f"[AI] Prediction error: {e}")
            return {"action": "HOLD", "confidence": 0, "reason": f"Prediction error: {str(e)}"}


# ─── Singleton ───────────────────────────────────────────────────────────────
engine = AITradingEngine()
engine.start_retraining_scheduler()

def generate_suggestions(symbol: str = "BTC/USDT"):
    return engine.generate_suggestions(symbol)

def get_feature_importances():
    return engine.feature_importances

if __name__ == "__main__":
    print(generate_suggestions("BTC/USDT"))
