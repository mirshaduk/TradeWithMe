'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';

const TradeContext = createContext();

export function useTrade() {
    return useContext(TradeContext);
}

export function TradeProvider({ children }) {
    const [balance, setBalance] = useState(100000); // $100k starting mock balance
    const [positions, setPositions] = useState([]);
    const [history, setHistory] = useState([]);
    const [currentPrice, setCurrentPrice] = useState(0);
    const [copyTradeParams, setCopyTradeParams] = useState(null); // For AI 1-Click execution

    // Update live market price (called when chart data updates)
    const updatePrice = (price) => {
        setCurrentPrice(price);
    };

    // Helper to calculate PnL based on current price
    const calcPnL = (pos, priceToUse) => {
        const posValue = pos.margin * pos.leverage;
        if (pos.type === 'LONG') {
            return (posValue / pos.entryPrice) * (priceToUse - pos.entryPrice);
        } else {
            return (posValue / pos.entryPrice) * (pos.entryPrice - priceToUse);
        }
    };

    // Auto-close positions if TP or SL is hit
    useEffect(() => {
        if (currentPrice === 0 || positions.length === 0) return;

        setPositions(prev => {
            const remaining = [];
            let realizedPnL = 0;
            let closedPositions = [];

            prev.forEach(pos => {
                let closePrice = null;
                let reason = null;

                if (pos.type === 'LONG') {
                    if (pos.tp && currentPrice >= pos.tp) { closePrice = pos.tp; reason = 'Take Profit hit'; }
                    else if (pos.sl && currentPrice <= pos.sl) { closePrice = pos.sl; reason = 'Stop Loss hit'; }
                } else if (pos.type === 'SHORT') {
                    if (pos.tp && currentPrice <= pos.tp) { closePrice = pos.tp; reason = 'Take Profit hit'; }
                    else if (pos.sl && currentPrice >= pos.sl) { closePrice = pos.sl; reason = 'Stop Loss hit'; }
                }

                if (closePrice) {
                    const pnl = calcPnL(pos, closePrice);
                    realizedPnL += (pos.margin + pnl);
                    closedPositions.push({ ...pos, closePrice, pnl, reason, closedAt: new Date().toISOString() });
                } else {
                    remaining.push(pos);
                }
            });

            if (closedPositions.length > 0) {
                setBalance(b => b + realizedPnL);
                setHistory(h => [...closedPositions, ...h]);
            }
            return remaining;
        });
    }, [currentPrice]); // eslint-disable-line react-hooks/exhaustive-deps

    const executeTrade = ({ type, margin, leverage, tp, sl, entryPrice }) => {
        if (balance < margin) return { success: false, error: 'Insufficient funds' };
        if (!entryPrice && currentPrice === 0) return { success: false, error: 'Market price unavailable' };

        setBalance(b => b - margin);

        const actualEntry = entryPrice || currentPrice;

        const newPosition = {
            id: Date.now().toString(),
            type, // 'LONG' | 'SHORT'
            margin: parseFloat(margin),
            leverage: parseInt(leverage),
            entryPrice: actualEntry,
            tp: tp ? parseFloat(tp) : null,
            sl: sl ? parseFloat(sl) : null,
            openedAt: new Date().toISOString()
        };

        setPositions(prev => [newPosition, ...prev]);
        return { success: true };
    };

    const closePosition = (id) => {
        setPositions(prev => {
            const pos = prev.find(p => p.id === id);
            if (!pos) return prev;

            const pnl = calcPnL(pos, currentPrice);
            setBalance(b => b + pos.margin + pnl);
            setHistory(h => [{ ...pos, closePrice: currentPrice, pnl, reason: 'Market Close', closedAt: new Date().toISOString() }, ...h]);

            return prev.filter(p => p.id !== id);
        });
    };

    // Calculate total floating Pnl
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
            setCopyTradeParams
        }}>
            {children}
        </TradeContext.Provider>
    );
}
