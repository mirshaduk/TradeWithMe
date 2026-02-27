'use client';
import React, { useState, useEffect } from 'react';
import { useTrade } from '../context/TradeContext';

export default function TradeExecutionPanel() {
    const { currentPrice, executeTrade, copyTradeParams, setCopyTradeParams } = useTrade();

    const [margin, setMargin] = useState(1000); // Default $1,000 margin
    const [leverage, setLeverage] = useState(10); // Default 10x
    const [tp, setTp] = useState('');
    const [sl, setSl] = useState('');
    const [error, setError] = useState(null);
    const [isCopied, setIsCopied] = useState(false);

    // Auto-fill from AI Suggestion
    useEffect(() => {
        if (copyTradeParams) {
            setTp(copyTradeParams.tp);
            setSl(copyTradeParams.sl);
            setIsCopied(true);

            // Clear copied flag after a 2 seconds animation
            setTimeout(() => {
                setIsCopied(false);
                setCopyTradeParams(null);
            }, 2000);
        }
    }, [copyTradeParams, setCopyTradeParams]);

    const handleTrade = (type) => {
        setError(null);
        const result = executeTrade({
            type,
            margin: Number(margin),
            leverage: Number(leverage),
            tp: tp ? Number(tp) : null,
            sl: sl ? Number(sl) : null,
            entryPrice: currentPrice
        });

        if (!result.success) {
            setError(result.error);
        } else {
            // Clear TP/SL on success
            setTp('');
            setSl('');
        }
    };

    return (
        <div className="p-4 flex flex-col h-full bg-surface/50">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-textMain text-sm">Place Order</h3>
                <span className="text-xs text-textMuted font-mono bg-background px-2 py-1 rounded">Mock Trade</span>
            </div>

            {error && <div className="text-xs text-sell mb-2">{error}</div>}

            <div className="space-y-4 flex-1">
                {/* Margin & Leverage */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-textMuted uppercase mb-1 block">Margin (USD)</label>
                        <input
                            type="number"
                            value={margin}
                            onChange={(e) => setMargin(e.target.value)}
                            className="w-full bg-background border border-border text-textMain rounded px-3 py-2 text-sm focus:outline-none focus:border-primary"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-textMuted uppercase mb-1 block">Leverage (x)</label>
                        <input
                            type="number"
                            value={leverage}
                            onChange={(e) => setLeverage(e.target.value)}
                            className="w-full bg-background border border-border text-textMain rounded px-3 py-2 text-sm focus:outline-none focus:border-primary"
                        />
                    </div>
                </div>

                {/* Position Value Display */}
                <div className="flex justify-between text-xs text-textMuted bg-black/20 p-2 rounded border border-white/5">
                    <span>Position Size:</span>
                    <span className="font-mono text-textMain">${(margin * leverage).toLocaleString()}</span>
                </div>

                {/* Take Profit & Stop Loss */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-textMuted uppercase mb-1 block">Take Profit (TP)</label>
                        <input
                            type="number"
                            placeholder="Optional"
                            value={tp}
                            onChange={(e) => setTp(e.target.value)}
                            className={`w-full bg-background border text-textMain rounded px-3 py-2 text-sm focus:outline-none transition-all duration-300 ${isCopied ? 'border-buy shadow-[0_0_10px_#00e676]' : 'border-border focus:border-buy'}`}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-textMuted uppercase mb-1 block">Stop Loss (SL)</label>
                        <input
                            type="number"
                            placeholder="Optional"
                            value={sl}
                            onChange={(e) => setSl(e.target.value)}
                            className={`w-full bg-background border text-textMain rounded px-3 py-2 text-sm focus:outline-none transition-all duration-300 ${isCopied ? 'border-sell shadow-[0_0_10px_#ff3d00]' : 'border-border focus:border-sell'}`}
                        />
                    </div>
                </div>

                {isCopied && (
                    <div className="mt-2 text-primary text-xs font-mono animate-pulse text-center w-full">
                        🤖 AI Ratios Copied
                    </div>
                )}
            </div>

            {/* Execution Buttons */}
            <div className="grid grid-cols-2 gap-4 mt-6">
                <button
                    onClick={() => handleTrade('LONG')}
                    className="py-3 bg-buy/10 text-buy border border-buy/30 hover:bg-buy hover:text-white rounded-lg font-bold tracking-wider transition-colors">
                    LONG
                </button>
                <button
                    onClick={() => handleTrade('SHORT')}
                    className="py-3 bg-sell/10 text-sell border border-sell/30 hover:bg-sell hover:text-white rounded-lg font-bold tracking-wider transition-colors">
                    SHORT
                </button>
            </div>
        </div>
    );
}
