'use client';
import React, { useState } from 'react';
import { useTrade } from '../context/TradeContext';

export default function PortfolioWidget() {
    const { balance, positions, history, currentPrice, closePosition, floatingPnL, calcPnL } = useTrade();

    const [tab, setTab] = useState('POSITIONS'); // POSITIONS | HISTORY
    const [mounted, setMounted] = useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    // Calculate account equity
    const equity = balance + floatingPnL;
    const pnlClass = floatingPnL >= 0 ? "text-buy" : "text-sell";
    const pnlPrefix = floatingPnL >= 0 ? "+" : "";

    if (!mounted) {
        return <div className="p-4 text-textMuted font-mono text-sm">Loading Portfolio...</div>;
    }

    return (
        <div className="flex flex-col h-full bg-surface/50">
            <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-background/50">
                <div>
                    <p className="text-[10px] text-textMuted uppercase tracking-wider mb-1">Portfolio Equity</p>
                    <h3 className="text-xl font-bold font-mono tracking-wide">
                        ${equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                    <span className={`text-xs tracking-widest font-mono ${pnlClass} drop-shadow-md`}>
                        {pnlPrefix}${floatingPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>

                <div className="mt-4 sm:mt-0 flex gap-2">
                    <button
                        onClick={() => setTab('POSITIONS')}
                        className={`px-3 py-1 rounded text-[10px] uppercase font-bold tracking-wider transition-colors ${tab === 'POSITIONS' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-background text-textMuted hover:text-textMain hover:bg-white/5'}`}>
                        Active ({positions.length})
                    </button>
                    <button
                        onClick={() => setTab('HISTORY')}
                        className={`px-3 py-1 rounded text-[10px] uppercase font-bold tracking-wider transition-colors ${tab === 'HISTORY' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-background text-textMuted hover:text-textMain hover:bg-white/5'}`}>
                        Closed
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto w-full custom-scrollbar">
                {tab === 'POSITIONS' ? (
                    positions.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-textMuted opacity-50 p-6 flex-col min-h-[150px]">
                            <span className="text-xl mb-2 grayscale opacity-30">📭</span>
                            <p className="text-[10px] uppercase tracking-widest font-mono">No Active Positions</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5 bg-background">
                            {positions.map(p => {
                                const posPnl = calcPnL(p, currentPrice);
                                const posClass = posPnl >= 0 ? 'text-buy' : 'text-sell';
                                const sign = posPnl >= 0 ? '+' : '';
                                const markPrice = currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                return (
                                    <div key={p.id} className="p-4 flex flex-col gap-3 group relative hover:bg-surface/30 transition-colors">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className={`font-bold font-mono px-2 py-0.5 rounded text-[10px] bg-surface flex items-center gap-1.5 border shadow-[0_0_10px_rgba(0,0,0,0.5)] ${p.type === 'LONG' ? 'text-buy border-buy/20' : 'text-sell border-sell/20'}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${p.type === 'LONG' ? 'bg-buy animate-pulse' : 'bg-sell animate-pulse'}`}></span>
                                                {p.type} {p.leverage}x
                                            </span>
                                            <button
                                                onClick={() => closePosition(p.id)}
                                                className="text-[10px] opacity-0 group-hover:opacity-100 bg-background border border-border px-2 py-1 rounded hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 transition-all">
                                                Market Close
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-2 xs:grid-cols-4 gap-4 text-xs font-mono">
                                            <div>
                                                <span className="text-textMuted text-[10px] uppercase block mb-1">Entry</span>
                                                <span className="text-textMain">${p.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </div>
                                            <div>
                                                <span className="text-textMuted text-[10px] uppercase block mb-1">Mark Price</span>
                                                <span className={`${currentPrice > p.entryPrice ? 'text-buy' : 'text-sell'}`}>${markPrice}</span>
                                            </div>
                                            <div>
                                                <span className="text-textMuted text-[10px] uppercase block mb-1">Margin</span>
                                                <span className="text-textMain">${p.margin.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <div>
                                                <span className="text-textMuted text-[10px] uppercase block mb-1">PnL (USD)</span>
                                                <span className={`${posClass} font-bold drop-shadow-md`}>{sign}${posPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )
                ) : (
                    history.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-textMuted opacity-50 p-6 flex-col min-h-[150px]">
                            <span className="text-xl mb-2 grayscale opacity-30">📜</span>
                            <p className="text-[10px] uppercase tracking-widest font-mono">No Trade History</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5 bg-background">
                            {history.map((h, idx) => {
                                const pnlClass = h.pnl >= 0 ? 'text-buy' : 'text-sell';
                                const sign = h.pnl >= 0 ? '+' : '';
                                return (
                                    <div key={`${h.id}-${idx}`} className="p-4 flex flex-col gap-2 opacity-70 hover:opacity-100 transition-opacity hover:bg-surface/30">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className={`font-bold border px-1.5 py-0.5 rounded text-[10px] ${h.type === 'LONG' ? 'text-buy border-buy/20' : 'text-sell border-sell/20'} bg-surface/50`}>
                                                {h.type} {h.leverage}x
                                            </span>
                                            <span className={`${pnlClass} font-mono font-bold text-sm`}>
                                                {sign}${h.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] text-textMuted font-mono mt-1">
                                            <span>Close: ${h.closePrice?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || 'N/A'}</span>
                                            <span className="bg-surface px-1.5 py-0.5 rounded border border-border shadow-inner">{h.reason}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
