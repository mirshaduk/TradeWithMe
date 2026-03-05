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
        <div className="p-4 flex-1 space-y-4 overflow-y-auto w-full">
            {/* AI Reasoning */}
            <div className="p-3 rounded-xl border border-border bg-surface/30 shadow-inner">
                <p className="text-xs leading-relaxed text-textMuted">{reason}</p>
            </div>

            {/* Dynamic Signal Card */}
            <div className={`p-4 rounded-xl border ${panelStyle} relative overflow-hidden transition-all duration-500 shadow-lg`}>
                <div className={`absolute top-0 left-0 w-1 h-full ${action === 'BUY' ? 'bg-buy shadow-[0_0_10px_#00e676]' : action === 'SELL' ? 'bg-sell shadow-[0_0_10px_#ff3d00]' : 'bg-textMuted'}`}></div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                    <div className="flex items-center gap-2">
                        <h4 className={`${titleStyle} font-bold text-base tracking-wide`}>{titleText}</h4>
                        {data.model_version && (
                            <span className="text-[9px] font-mono text-primary border border-primary/30 rounded px-1.5 py-0.5 bg-primary/10">v{data.model_version}</span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <span className="font-mono text-xs bg-surface px-2 py-1.5 rounded text-textMain border border-border shadow-inner">
                            Conf: <span className={confidence > 75 ? 'text-primary drop-shadow-md font-bold' : 'text-textMain'}>{confidence}%</span>
                        </span>
                        {action !== 'HOLD' && action !== 'EXIT' && (
                            <button onClick={handleCopyTrade}
                                className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors border shadow-md
                                    ${action === 'BUY' ? 'bg-buy/20 text-buy border-buy/40 hover:bg-buy hover:text-white' : 'bg-sell/20 text-sell border-sell/40 hover:bg-sell hover:text-white'}`}>
                                Copy Trade
                            </button>
                        )}
                    </div>
                </div>

                {/* Indicator Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs font-mono bg-black/20 p-3 rounded-lg border border-white/5">
                    <div>
                        <p className="text-textMuted text-[9px] uppercase tracking-wider mb-0.5">Mark Price</p>
                        <p className="text-base">${current_price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"}</p>
                    </div>
                    <div>
                        <p className="text-textMuted text-[9px] uppercase tracking-wider mb-0.5">RSI (14)</p>
                        <p className={`font-bold ${data.rsi > 70 ? 'text-sell' : data.rsi < 30 ? 'text-buy' : 'text-textMain'}`}>{data.rsi?.toFixed(1) || '—'}</p>
                    </div>
                    <div>
                        <p className="text-textMuted text-[9px] uppercase tracking-wider mb-0.5">Bollinger %</p>
                        <p className={data.bb_pct > 0.8 ? 'text-sell' : data.bb_pct < 0.2 ? 'text-buy' : 'text-textMain'}>{data.bb_pct != null ? `${(data.bb_pct * 100).toFixed(1)}%` : '—'}</p>
                    </div>
                    <div>
                        <p className="text-textMuted text-[9px] uppercase tracking-wider mb-0.5">ATR Volatility</p>
                        <p className="text-textMain">{data.atr != null ? `${(data.atr * 100).toFixed(2)}%` : '—'}</p>
                    </div>
                    <div>
                        <p className="text-textMuted text-[9px] uppercase tracking-wider mb-0.5">SMA 5</p>
                        <p className="text-textMuted">${sma_5?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                        <p className="text-textMuted text-[9px] uppercase tracking-wider mb-0.5">SMA 20</p>
                        <p className="text-textMuted">${sma_20?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>
            </div>

            {/* Feature Importance Bar Chart */}
            {data.feature_importances && Object.keys(data.feature_importances).length > 0 && (
                <div className="bg-surface/30 border border-border/50 rounded-xl p-3">
                    <p className="text-[9px] uppercase tracking-widest text-textMuted mb-2 font-mono">Top AI Drivers</p>
                    <div className="space-y-1.5">
                        {Object.entries(data.feature_importances).map(([feat, val]) => (
                            <div key={feat} className="flex items-center gap-2">
                                <span className="text-[9px] text-textMuted font-mono w-20 truncate shrink-0">{feat}</span>
                                <div className="flex-1 h-1.5 bg-background rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-700"
                                        style={{ width: `${(val * 100 / (Object.values(data.feature_importances)[0] || 1)) * 100}%` }}
                                    />
                                </div>
                                <span className="text-[9px] text-textMuted font-mono w-8 text-right">{(val * 100).toFixed(1)}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
