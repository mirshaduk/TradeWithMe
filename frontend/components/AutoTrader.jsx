'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useTrade } from '../context/TradeContext';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ── Configuration ────────────────────────────────────────────────────────────
const AUTO_TRADE_CONFIG = {
    minConfidence: 70,    // Only trade if AI is ≥70% confident
    marginPct: 0.02,  // Use 2% of balance per trade
    leverage: 10,    // 10x futures leverage
    tpPct: 0.015, // Take Profit: 1.5% above/below entry
    slPct: 0.008, // Stop Loss:   0.8% below/above entry (≈2:1 R:R)
    pollIntervalMs: 30000, // Check for signals every 30 seconds
    maxOpenTrades: 3,     // Max simultaneous open positions
    symbol: 'BTC/USDT',
};

export default function AutoTrader({ enabled, onLog }) {
    const { executeTrade, positions, balance, currentPrice } = useTrade();
    const intervalRef = useRef(null);
    const lastActionRef = useRef(null); // Prevent duplicate trades on same signal

    const runAutoTrade = useCallback(async () => {
        if (!enabled) return;
        if (positions.length >= AUTO_TRADE_CONFIG.maxOpenTrades) {
            onLog?.({ type: 'info', msg: `Max open trades (${AUTO_TRADE_CONFIG.maxOpenTrades}) reached. Waiting...` });
            return;
        }

        try {
            const res = await fetch(`${API}/api/suggestions?symbol=${AUTO_TRADE_CONFIG.symbol}`);
            const payload = await res.json();
            if (payload.status !== 'success') return;

            const { action, confidence, current_price: price } = payload.data;

            // Skip HOLD signals or low confidence
            if (action === 'HOLD' || confidence < AUTO_TRADE_CONFIG.minConfidence) {
                onLog?.({ type: 'skip', msg: `Signal: ${action} (${confidence}% conf) — below threshold, skipping.` });
                return;
            }

            // Skip if we already acted on this same signal recently
            const signalKey = `${action}-${Math.round(price / 100)}`;
            if (lastActionRef.current === signalKey) {
                onLog?.({ type: 'skip', msg: `Same signal ${action} already executed. Waiting for new opportunity.` });
                return;
            }

            // Check if we already have an open position in the same direction
            const sameDirectionOpen = positions.some(p =>
                (action === 'BUY' && p.type === 'LONG') ||
                (action === 'SELL' && p.type === 'SHORT')
            );
            if (sameDirectionOpen) {
                onLog?.({ type: 'skip', msg: `Already have a ${action === 'BUY' ? 'LONG' : 'SHORT'} open. Skipping.` });
                return;
            }

            // Calculate position params
            const margin = Math.max(10, balance * AUTO_TRADE_CONFIG.marginPct);
            const entryPrice = price || currentPrice;
            const isLong = action === 'BUY';

            const tp = isLong
                ? entryPrice * (1 + AUTO_TRADE_CONFIG.tpPct)
                : entryPrice * (1 - AUTO_TRADE_CONFIG.tpPct);

            const sl = isLong
                ? entryPrice * (1 - AUTO_TRADE_CONFIG.slPct)
                : entryPrice * (1 + AUTO_TRADE_CONFIG.slPct);

            // Execute the paper trade
            const result = executeTrade({
                type: isLong ? 'LONG' : 'SHORT',
                margin: margin,
                leverage: AUTO_TRADE_CONFIG.leverage,
                entryPrice: entryPrice,
                tp: parseFloat(tp.toFixed(2)),
                sl: parseFloat(sl.toFixed(2)),
            });

            if (result.success) {
                lastActionRef.current = signalKey;
                onLog?.({
                    type: 'trade',
                    msg: `✅ AI opened ${isLong ? 'LONG' : 'SHORT'} $${margin.toFixed(0)} @ $${entryPrice.toLocaleString()} — TP: $${tp.toFixed(2)} | SL: $${sl.toFixed(2)} (${confidence}% conf)`
                });
            } else {
                onLog?.({ type: 'error', msg: `Trade failed: ${result.error}` });
            }

        } catch (err) {
            onLog?.({ type: 'error', msg: `Auto-trader error: ${err.message}` });
        }
    }, [enabled, positions, balance, currentPrice, executeTrade, onLog]);

    useEffect(() => {
        if (enabled) {
            onLog?.({ type: 'info', msg: '🤖 AI Auto-Trader activated. Scanning for opportunities...' });
            runAutoTrade(); // Run immediately on enable
            intervalRef.current = setInterval(runAutoTrade, AUTO_TRADE_CONFIG.pollIntervalMs);
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            onLog?.({ type: 'info', msg: '⏸️ AI Auto-Trader paused.' });
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

    return null; // Headless component — no UI rendered here
}
