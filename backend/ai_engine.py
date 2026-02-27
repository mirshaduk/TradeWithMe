import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from data_fetcher import get_historical_data
import warnings
warnings.filterwarnings('ignore') # Suppress sklearn feature name warnings

class AITradingEngine:
    def __init__(self):
        self.model = RandomForestClassifier(n_estimators=100, random_state=42, class_weight="balanced")
        self.is_trained = False
        
    def _calculate_indicators(self, df):
        """
        Calculates Technical Indicators to serve as Features for the ML model.
        """
        # Moving Averages
        df["SMA_5"] = df["close"].rolling(window=5).mean()
        df["SMA_20"] = df["close"].rolling(window=20).mean()
        df["SMA_50"] = df["close"].rolling(window=50).mean()
        
        # MACD
        exp1 = df['close'].ewm(span=12, adjust=False).mean()
        exp2 = df['close'].ewm(span=26, adjust=False).mean()
        df['MACD'] = exp1 - exp2
        df['Signal_Line'] = df['MACD'].ewm(span=9, adjust=False).mean()
        
        # RSI
        delta = df['close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        df['RSI'] = 100 - (100 / (1 + rs))
        
        # Price Rate of Change
        df['ROC'] = df['close'].pct_change(periods=5) * 100
        
        return df.dropna()

    def train_model(self, symbol="BTC/USDT"):
        """
        Fetches a larger dataset, calculates indicators, labels the data (Buy/Sell/Hold), 
        and trains the Random Forest classifier.
        """
        print(f"Training AI Model for {symbol}...")
        raw_data = get_historical_data(symbol, timeframe="1h", limit=500)
        if len(raw_data) < 100:
            print("Not enough data to train.")
            return False
            
        df = pd.DataFrame(raw_data)
        df = self._calculate_indicators(df)
        
        # Labeling Logic: Look 3 periods ahead. 
        # If price goes up by at least 0.5%, it's a BUY (1)
        # If price drops by at least 0.5%, it's a SELL (-1)
        # Otherwise HOLD (0)
        df['Future_Return'] = df['close'].shift(-3) / df['close'] - 1
        
        conditions = [
            (df['Future_Return'] > 0.005),
            (df['Future_Return'] < -0.005)
        ]
        choices = [1, -1]
        df['Target'] = np.select(conditions, choices, default=0)
        
        # Drop the rows with NaN future targets
        df = df.dropna()
        
        # Features and Target
        features = ['SMA_5', 'SMA_20', 'SMA_50', 'MACD', 'Signal_Line', 'RSI', 'ROC']
        X = df[features]
        y = df['Target']
        
        # Train
        self.model.fit(X, y)
        self.is_trained = True
        print("Model Training Complete.")
        return True

    def generate_suggestions(self, symbol="BTC/USDT"):
        """
        Predicts the current market action using the trained ML model.
        """
        if not self.is_trained:
            # First time running, train the model
            self.train_model(symbol)
            
        # Fetch recent data to predict right now
        data = get_historical_data(symbol, timeframe="1h", limit=100)
        if len(data) < 50: 
            return {"action": "HOLD", "confidence": 0, "reason": "Insufficient data"}
            
        df = pd.DataFrame(data)
        df = self._calculate_indicators(df)
        
        if df.empty:
            return {"action": "HOLD", "confidence": 0, "reason": "Failed to calculate indicators"}
            
        latest_row = df.iloc[-1]
        
        # Prepare feature vector for prediction
        features = ['SMA_5', 'SMA_20', 'SMA_50', 'MACD', 'Signal_Line', 'RSI', 'ROC']
        X_pred = pd.DataFrame([latest_row[features]])
        
        # Predict class and probability
        prediction = self.model.predict(X_pred)[0]
        probabilities = self.model.predict_proba(X_pred)[0]
        
        confidence = round(max(probabilities) * 100, 1)
        
        action = "HOLD"
        if prediction == 1:
            action = "BUY"
        elif prediction == -1:
            action = "SELL"
            
        # Construct Reason based on strongest indicators
        reason_parts = [f"Machine Learning model predicts {action} with {confidence}% confidence."]
        
        if latest_row['RSI'] > 70:
            reason_parts.append("Warning: Asset is overbought (RSI > 70).")
        elif latest_row['RSI'] < 30:
            reason_parts.append("Signal: Asset is oversold (RSI < 30).")
            
        if latest_row['MACD'] > latest_row['Signal_Line']:
            reason_parts.append("MACD is showing bullish momentum.")
        else:
            reason_parts.append("MACD is showing bearish momentum.")

        return {
            "symbol": symbol,
            "action": action,
            "confidence": confidence,
            "reason": " ".join(reason_parts),
            "current_price": latest_row["close"],
            "sma_5": latest_row["SMA_5"],
            "sma_20": latest_row["SMA_20"]
        }

# Singleton instance to persist the model in memory while the server runs
engine = AITradingEngine()

def generate_suggestions(symbol: str = "BTC/USDT"):
    """
    Wrapper function used by the FastAPI route
    """
    return engine.generate_suggestions(symbol)

if __name__ == "__main__":
    print(generate_suggestions("BTC/USDT"))
