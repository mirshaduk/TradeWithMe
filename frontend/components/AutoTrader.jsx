'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useTrade } from '../context/TradeContext';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ── Defaults (used before settings load from API) ────────────────────────────
const DEFAULTS = {
    minConfidence: 70, marginPct: 2, leverage: 10,
    tpPct: 1.5, slPct: 0.8, pollIntervalSec: 30,
    maxOpenTrades: 3, symbol: 'BTC/USDT'
};

// ── Send a native desktop notification via Electron (no-op in browser) ───────
function notify(title, body) {
    if (typeof window !== 'undefined' && window.electronAPI?.notify) {
        window.electronAPI.notify(title, body);
    }
}

export default function AutoTrader({ enabled, onLog }) {
    const { executeTrade, positions, balance, currentPrice } = useTrade();
    const intervalRef = useRef(null);
    const lastActionRef = useRef(null);
    const [cfg, setCfg] = useState(DEFAULTS);

    // ── Load settings from backend ─────────────────────────────────────────
    useEffect(() => {
        fetch(`${API}/api/settings`)
            .then(r => r.json())
            .then(d => {
                if (d.status === 'success' && d.data.autoTrader) {
                    setCfg(d.data.autoTrader);
                    onLog?.({ type: 'info', msg: '⚙️ Settings loaded from your PC.' });
                }
            })
            .catch(() => onLog?.({ type: 'info', msg: '⚙️ Using default auto-trade settings.' }));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Main auto-trade logic ──────────────────────────────────────────────
    const runAutoTrade = useCallback(async () => {
        if (!enabled) return;
        if (positions.length >= cfg.maxOpenTrades) {
            onLog?.({ type: 'info', msg: `Max open trades (${cfg.maxOpenTrades}) reached. Waiting...` });
            return;
        }

        try {
            const res = await fetch(`${API}/api/suggestions?symbol=${cfg.symbol}`);
            const payload = await res.json();
            if (payload.status !== 'success') return;

            const { action, confidence, current_price: price } = payload.data;

            if (action === 'HOLD' || confidence < cfg.minConfidence) {
                onLog?.({ type: 'skip', msg: `Signal: ${action} (${confidence}% conf) — below ${cfg.minConfidence}% threshold, skipping.` });
                return;
            }

            const signalKey = `${action}-${Math.round(price / 100)}`;
            if (lastActionRef.current === signalKey) {
                onLog?.({ type: 'skip', msg: `Same signal ${action} already executed. Waiting for new opportunity.` });
                return;
            }

            const sameDirectionOpen = positions.some(p =>
                (action === 'BUY' && p.type === 'LONG') ||
                (action === 'SELL' && p.type === 'SHORT')
            );
            if (sameDirectionOpen) {
                onLog?.({ type: 'skip', msg: `Already have a ${action === 'BUY' ? 'LONG' : 'SHORT'} open. Skipping.` });
                return;
            }

            const margin = Math.max(10, balance * (cfg.marginPct / 100));
            const entryPrice = price || currentPrice;
            const isLong = action === 'BUY';

            const tp = isLong
                ? entryPrice * (1 + cfg.tpPct / 100)
                : entryPrice * (1 - cfg.tpPct / 100);
            const sl = isLong
                ? entryPrice * (1 - cfg.slPct / 100)
                : entryPrice * (1 + cfg.slPct / 100);

            const result = executeTrade({
                type: isLong ? 'LONG' : 'SHORT',
                margin,
                leverage: cfg.leverage,
                entryPrice,
                tp: parseFloat(tp.toFixed(2)),
                sl: parseFloat(sl.toFixed(2)),
            });

            if (result.success) {
                lastActionRef.current = signalKey;
                const msg = `✅ AI opened ${isLong ? 'LONG' : 'SHORT'} $${margin.toFixed(0)} @ $${entryPrice.toLocaleString()} — TP: $${tp.toFixed(2)} | SL: $${sl.toFixed(2)} (${confidence}% conf)`;
                onLog?.({ type: 'trade', msg });
                notify(`AI Opened ${isLong ? 'LONG 📈' : 'SHORT 📉'}`, `$${margin.toFixed(0)} @ $${entryPrice.toLocaleString()} | ${confidence}% confidence`);
            } else {
                onLog?.({ type: 'error', msg: `Trade failed: ${result.error}` });
            }

        } catch (err) {
            onLog?.({ type: 'error', msg: `Auto-trader error: ${err.message}` });
        }
    }, [enabled, positions, balance, currentPrice, executeTrade, onLog, cfg]);

    // ── Start/stop polling ─────────────────────────────────────────────────
    useEffect(() => {
        if (enabled) {
            onLog?.({ type: 'info', msg: `🤖 AI Auto-Trader ON — scanning every ${cfg.pollIntervalSec}s (min conf: ${cfg.minConfidence}%)` });
            runAutoTrade();
            intervalRef.current = setInterval(runAutoTrade, cfg.pollIntervalSec * 1000);
        } else {
            if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
            onLog?.({ type: 'info', msg: '⏸️ AI Auto-Trader paused.' });
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [enabled, cfg]); // eslint-disable-line react-hooks/exhaustive-deps

    return null;
}
