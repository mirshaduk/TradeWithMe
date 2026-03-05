'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const TradeContext = createContext();
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function useTrade() {
    return useContext(TradeContext);
}

export function TradeProvider({ children }) {
    const [balance, setBalance] = useState(100000);
    const [positions, setPositions] = useState([]);
    const [history, setHistory] = useState([]);
    const [currentPrice, setCurrentPrice] = useState(0);
    const [copyTradeParams, setCopyTradeParams] = useState(null);
    const [dbLoaded, setDbLoaded] = useState(false);

    // ─── Load saved state from SQLite on startup ────────────────────────────
    useEffect(() => {
        fetch(`${API}/api/portfolio`)
            .then(res => res.json())
            .then(payload => {
                if (payload.status === 'success') {
                    const { balance: savedBalance, positions: savedPositions, history: savedHistory } = payload.data;
                    setBalance(savedBalance);
                    // Map snake_case DB columns back to camelCase for the frontend
                    setPositions(savedPositions.map(p => ({
                        id: p.id,
                        type: p.type,
                        margin: p.margin,
                        leverage: p.leverage,
                        entryPrice: p.entry_price,
                        tp: p.tp,
                        sl: p.sl,
                        openedAt: p.opened_at,
                    })));
                    setHistory(savedHistory.map(h => ({
                        id: h.id,
                        type: h.type,
                        margin: h.margin,
                        leverage: h.leverage,
                        entryPrice: h.entry_price,
                        closePrice: h.close_price,
                        tp: h.tp,
                        sl: h.sl,
                        pnl: h.pnl,
                        reason: h.reason,
                        openedAt: h.opened_at,
                        closedAt: h.closed_at,
                    })));
                    console.log('[DB] Portfolio loaded from local storage');
                }
            })
            .catch(err => console.warn('[DB] Could not load portfolio (backend may not be ready):', err))
            .finally(() => setDbLoaded(true));
    }, []);

    // ─── Update live market price ────────────────────────────────────────────
    const updatePrice = useCallback((price) => {
        setCurrentPrice(price);
    }, []);

    // ─── Helper: Calculate PnL ───────────────────────────────────────────────
    const calcPnL = useCallback((pos, priceToUse) => {
        const posValue = pos.margin * pos.leverage;
        if (pos.type === 'LONG') {
            return (posValue / pos.entryPrice) * (priceToUse - pos.entryPrice);
        } else {
            return (posValue / pos.entryPrice) * (pos.entryPrice - priceToUse);
        }
    }, []);

    // ─── Auto-close positions if TP or SL is hit ────────────────────────────
    useEffect(() => {
        if (currentPrice === 0 || positions.length === 0) return;

        setPositions(prev => {
            const remaining = [];
            let realizedReturn = 0;
            const closedOnes = [];

            prev.forEach(pos => {
                let closePrice = null;
                let reason = null;

                if (pos.type === 'LONG') {
                    if (pos.tp && currentPrice >= pos.tp) { closePrice = pos.tp; reason = 'Take Profit'; }
                    else if (pos.sl && currentPrice <= pos.sl) { closePrice = pos.sl; reason = 'Stop Loss'; }
                } else {
                    if (pos.tp && currentPrice <= pos.tp) { closePrice = pos.tp; reason = 'Take Profit'; }
                    else if (pos.sl && currentPrice >= pos.sl) { closePrice = pos.sl; reason = 'Stop Loss'; }
                }

                if (closePrice) {
                    const pnl = calcPnL(pos, closePrice);
                    const closedEntry = { ...pos, closePrice, pnl, reason, closedAt: new Date().toISOString() };
                    closedOnes.push(closedEntry);
                    realizedReturn += pos.margin + pnl;

                    // Persist to DB
                    fetch(`${API}/api/positions/${pos.id}`, { method: 'DELETE' });
                    fetch(`${API}/api/history`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(closedEntry)
                    });
                } else {
                    remaining.push(pos);
                }
            });

            if (closedOnes.length > 0) {
                setBalance(b => {
                    const newBalance = b + realizedReturn;
                    fetch(`${API}/api/portfolio/balance`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ balance: newBalance })
                    });
                    return newBalance;
                });
                setHistory(h => [...closedOnes, ...h]);
            }

            return remaining;
        });
    }, [currentPrice]); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Execute Trade ───────────────────────────────────────────────────────
    const executeTrade = useCallback(({ type, margin, leverage, tp, sl, entryPrice }) => {
        if (balance < margin) return { success: false, error: 'Insufficient funds' };
        if (!entryPrice && currentPrice === 0) return { success: false, error: 'Market price unavailable' };

        const actualEntry = entryPrice || currentPrice;
        const newPosition = {
            id: Date.now().toString(),
            type,
            margin: parseFloat(margin),
            leverage: parseInt(leverage),
            entryPrice: actualEntry,
            tp: tp ? parseFloat(tp) : null,
            sl: sl ? parseFloat(sl) : null,
            openedAt: new Date().toISOString()
        };

        const newBalance = balance - margin;

        // Update local state
        setBalance(newBalance);
        setPositions(prev => [newPosition, ...prev]);

        // Persist to DB
        fetch(`${API}/api/positions`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newPosition)
        });
        fetch(`${API}/api/portfolio/balance`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ balance: newBalance })
        });

        return { success: true };
    }, [balance, currentPrice]);

    // ─── Close Position Manually ─────────────────────────────────────────────
    const closePosition = useCallback((id) => {
        setPositions(prev => {
            const pos = prev.find(p => p.id === id);
            if (!pos) return prev;

            const pnl = calcPnL(pos, currentPrice);
            const closedEntry = {
                ...pos, closePrice: currentPrice, pnl,
                reason: 'Market Close', closedAt: new Date().toISOString()
            };
            const newBalance = balance + pos.margin + pnl;

            setBalance(newBalance);
            setHistory(h => [closedEntry, ...h]);

            // Persist to DB
            fetch(`${API}/api/positions/${id}`, { method: 'DELETE' });
            fetch(`${API}/api/history`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(closedEntry)
            });
            fetch(`${API}/api/portfolio/balance`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ balance: newBalance })
            });

            return prev.filter(p => p.id !== id);
        });
    }, [balance, currentPrice, calcPnL]);

    const floatingPnL = positions.reduce((acc, pos) => acc + calcPnL(pos, currentPrice), 0);

    return (
        <TradeContext.Provider value={{
            balance,
            positions,
            history,
            currentPrice,
            updatePrice,
            executeTrade,
            closePosition,
            floatingPnL,
            calcPnL,
            copyTradeParams,
            setCopyTradeParams,
            dbLoaded
        }}>
            {children}
        </TradeContext.Provider>
    );
}
