import React from 'react';
import { useTrade } from '../context/TradeContext';

export default function SuggestionPanel({ data, loading }) {
    const { setCopyTradeParams } = useTrade();

    if (loading || !data) {
        return (
            <div className="flex-1 space-y-6 overflow-y-auto w-full flex items-center justify-center min-h-[300px]">
                <div className="flex flex-col items-center justify-center opacity-50">
                    <div className="w-8 h-8 rounded-full border-t-2 border-primary animate-spin mb-4"></div>
                    <p className="text-sm font-mono tracking-widest text-primary animate-pulse">ANALYZING MARKET...</p>
                </div>
            </div>
        );
    }

    const { action, confidence, current_price, reason, sma_5, sma_20 } = data;

    // Dynamic styling based on action
    let panelStyle = "border-border bg-surface/30";
    let titleStyle = "text-textMain";
    let titleText = "HOLD POSITION";

    if (action === "BUY") {
        panelStyle = "border-buy/30 bg-buy/5";
        titleStyle = "text-buy";
        titleText = "BUY SIGNAL";
    } else if (action === "SELL") {
        panelStyle = "border-sell/30 bg-sell/5";
        titleStyle = "text-sell";
        titleText = "SELL SIGNAL";
    } else if (action === "EXIT") {
        panelStyle = "border-amber-500/30 bg-amber-500/5";
        titleStyle = "text-amber-500";
        titleText = "EXIT POSITION";
    }

    const handleCopyTrade = () => {
        if (action === "HOLD" || action === "EXIT") return;

        // Calculate a basic default 2:1 Reward/Risk ratio based on 1% Stop Loss for the mock copy
        const rRatio = 0.01;
        let tpData = '';
        let slData = '';

        if (action === "BUY") {
            tpData = (current_price * (1 + (rRatio * 2))).toFixed(2);
            slData = (current_price * (1 - rRatio)).toFixed(2);
        } else if (action === "SELL") {
            tpData = (current_price * (1 - (rRatio * 2))).toFixed(2);
            slData = (current_price * (1 + rRatio)).toFixed(2);
        }

        setCopyTradeParams({
            type: action === "BUY" ? "LONG" : "SHORT",
            tp: tpData,
            sl: slData
        });
    };

    return (
        <div className="p-6 flex-1 space-y-6 overflow-y-auto w-full">
            <div className="space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-textMuted flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                        Real-Time Analysis
                    </span>
                    <span className="text-xs text-textMuted font-mono">Live</span>
                </div>
                <div className="p-4 rounded-xl border border-border bg-surface/30 shadow-inner">
                    <p className="text-sm leading-relaxed text-textMuted">{reason}</p>
                </div>
            </div>

            {/* Dynamic Signal Card */}
            <div className={`p-5 rounded-xl border ${panelStyle} relative overflow-hidden group transition-all duration-500 shadow-lg`}>
                {/* Neon Indicator Bar */}
                <div className={`absolute top-0 left-0 w-1 h-full ${action === 'BUY' ? 'bg-buy shadow-[0_0_10px_#00e676]' : action === 'SELL' ? 'bg-sell shadow-[0_0_10px_#ff3d00]' : 'bg-textMuted'}`}></div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 sm:gap-0">
                    <h4 className={`${titleStyle} font-bold text-lg tracking-wide`}>{titleText}</h4>
                    <div className="flex gap-2">
                        <span className="font-mono text-sm bg-surface px-2 py-1.5 rounded text-textMain border border-border shadow-inner">
                            Confidence: <span className={confidence > 75 ? 'text-primary drop-shadow-md' : 'text-textMain'}>{confidence}%</span>
                        </span>
                        {action !== 'HOLD' && action !== 'EXIT' && (
                            <button
                                onClick={handleCopyTrade}
                                className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors border shadow-md
                                    ${action === 'BUY' ? 'bg-buy/20 text-buy border-buy/40 hover:bg-buy hover:text-white' : 'bg-sell/20 text-sell border-sell/40 hover:bg-sell hover:text-white'}`}
                            >
                                Copy Trade
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-y-6 gap-x-4 text-sm bg-black/20 p-4 rounded-lg border border-white/5">
                    <div>
                        <p className="text-textMuted text-[10px] uppercase tracking-wider mb-1">Current Price</p>
                        <p className="font-mono text-lg">${current_price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}</p>
                    </div>
                    <div>
                        <p className="text-textMuted text-[10px] uppercase tracking-wider mb-1">Action</p>
                        <p className={`font-mono font-bold tracking-widest ${titleStyle}`}>{action}</p>
                    </div>
                    <div>
                        <p className="text-textMuted text-[10px] uppercase tracking-wider mb-1">SMA (5 Period)</p>
                        <p className="font-mono text-xs text-textMuted">${sma_5?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                        <p className="text-textMuted text-[10px] uppercase tracking-wider mb-1">SMA (20 Period)</p>
                        <p className="font-mono text-xs text-textMuted">${sma_20?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
