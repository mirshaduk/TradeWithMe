"""
settings.py — Persistent settings manager for TradeWithMe.
Stores user-configurable auto-trader parameters in ~/tradewithme_settings.json
"""
import json
import os

SETTINGS_PATH = os.path.join(os.path.expanduser("~"), "tradewithme_settings.json")

DEFAULT_SETTINGS = {
    "autoTrader": {
        "enabled": True,
        "minConfidence": 70,
        "marginPct": 2,
        "leverage": 10,
        "tpPct": 1.5,
        "slPct": 0.8,
        "maxOpenTrades": 3,
        "pollIntervalSec": 30,
        "symbol": "BTC/USDT"
    },
    "notifications": {
        "onTradeOpen": True,
        "onTpHit": True,
        "onSlHit": True
    },
    "display": {
        "defaultTimeframe": "1h",
        "theme": "dark"
    }
}


def get_settings() -> dict:
    if os.path.exists(SETTINGS_PATH):
        try:
            with open(SETTINGS_PATH, "r") as f:
                saved = json.load(f)
            # Deep merge with defaults (add any new keys from defaults)
            merged = {**DEFAULT_SETTINGS}
            for section, vals in saved.items():
                if section in merged:
                    merged[section] = {**merged[section], **vals}
            return merged
        except Exception:
            pass
    return DEFAULT_SETTINGS.copy()


def save_settings(settings: dict) -> dict:
    with open(SETTINGS_PATH, "w") as f:
        json.dump(settings, f, indent=2)
    return settings
