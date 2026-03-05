'use client';
import {
    TrendingUp, LayoutDashboard, Activity, Settings, FlaskConical, BarChart2,
    Play, Loader2, CheckCircle, AlertTriangle
} from 'lucide-react';
import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const SIDEBAR_LINKS = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/markets', label: 'AI Markets', icon: Activity },
    { href: '/performance', label: 'Performance', icon: BarChart2 },
    { href: '/backtest', label: 'Backtest', icon: FlaskConical, active: true },
    { href: '/settings', label: 'Settings', icon: Settings },
];

const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT'];
const TIMEFRAMES = ['1h', '4h', '1d'];

function MiniEquityChart({ data, startBalance = 100000 }) {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const w = 800; const h = 160;
    const pts = data.map((v, i) =>
        `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`
    ).join(' ');
    const isUp = data[data.length - 1] >= startBalance;
    const fillData = [...pts.split(' ')].join(' ');
    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-36" preserveAspectRatio="none">
            <defs>
                <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isUp ? '#00e676' : '#ff3d00'} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={isUp ? '#00e676' : '#ff3d00'} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polygon points={`0,${h} ${fillData} ${w},${h}`} fill="url(#eq)" />
            <polyline points={pts} fill="none" stroke={isUp ? '#00e676' : '#ff3d00'} strokeWidth="2" />
        </svg>
    );
}

function StatPill({ label, value, good }) {
    return (
        <div className="glass-panel rounded-xl border border-white/5 p-4 text-center">
            <p className="text-[9px] uppercase tracking-widest text-textMuted mb-1">{label}</p>
            <p className={`text-xl font-bold font-mono ${good === true ? 'text-buy' : good === false ? 'text-sell' : 'text-textMain'}`}>{value}</p>
        </div>
    );
}

export default function BacktestPage() {
    const [config, setConfig] = useState({
        symbol: 'BTC/USDT', timeframe: '1h', lookback: 500,
        tp_pct: 1.5, sl_pct: 0.8, leverage: 10,
        margin_pct: 2, min_confidence: 60
    });
    const [result, setResult] = useState(null);
    const [running, setRunning] = useState(false);
    const [error, setError] = useState(null);

    const run = async () => {
        setRunning(true); setError(null); setResult(null);
        try {
            const res = await fetch(`${API}/api/backtest`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            const payload = await res.json();
            if (payload.status === 'success') setResult(payload.data);
            else setError(payload.detail || 'Backtest failed');
        } catch (e) { setError(e.message); }
        finally { setRunning(false); }
    };

    const set = (k, v) => setConfig(c => ({ ...c, [k]: v }));

    return (
        <div className="flex h-screen overflow-hidden">
            <aside className="w-20 lg:w-48 border-r border-border bg-surface shrink-0 flex flex-col items-center lg:items-start py-8">
                <div className="flex items-center justify-center lg:justify-start w-full px-6 mb-10">
                    <TrendingUp className="text-primary w-8 h-8 lg:mr-3" />
                    <h1 className="hidden lg:block text-lg font-bold tracking-wider">TWM <span className="text-xs text-background bg-primary px-2 py-0.5 rounded ml-1">AI</span></h1>
                </div>
                <nav className="flex-1 w-full space-y-2 px-3">
                    {SIDEBAR_LINKS.map(({ href, label, icon: Icon, active }) => (
                        <a key={href} href={href} className={`flex items-center gap-3 p-3 rounded-xl transition-all text-sm ${active ? 'bg-primary/10 text-primary border border-primary/20' : 'text-textMuted border border-transparent hover:bg-white/5 hover:text-textMain'}`}>
                            <Icon className="w-5 h-5 shrink-0" /><span className="hidden lg:block">{label}</span>
                        </a>
                    ))}
                </nav>
            </aside>

            <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
                <header className="glass-card p-4">
                    <h2 className="text-2xl font-bold">Strategy Backtester</h2>
                    <p className="text-textMuted text-xs mt-1">Simulate the AI's strategy on historical data to see how it would have performed</p>
                </header>

                {/* Config Panel */}
                <div className="glass-panel rounded-xl border border-white/5 p-5">
                    <h3 className="text-xs uppercase tracking-widest text-textMuted mb-4">Backtest Configuration</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                        <div>
                            <label className="text-[10px] text-textMuted uppercase tracking-wider block mb-1">Symbol</label>
                            <select value={config.symbol} onChange={e => set('symbol', e.target.value)}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-textMain">
                                {SYMBOLS.map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] text-textMuted uppercase tracking-wider block mb-1">Timeframe</label>
                            <select value={config.timeframe} onChange={e => set('timeframe', e.target.value)}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-textMain">
                                {TIMEFRAMES.map(t => <option key={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] text-textMuted uppercase tracking-wider block mb-1">Candle Lookback</label>
                            <input type="number" value={config.lookback} min={100} max={1000} step={50}
                                onChange={e => set('lookback', Number(e.target.value))}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-textMain" />
                        </div>
                        <div>
                            <label className="text-[10px] text-textMuted uppercase tracking-wider block mb-1">Min Confidence</label>
                            <input type="number" value={config.min_confidence} min={50} max={95}
                                onChange={e => set('min_confidence', Number(e.target.value))}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-textMain" />
                        </div>
                        <div>
                            <label className="text-[10px] text-textMuted uppercase tracking-wider block mb-1">TP %</label>
                            <input type="number" value={config.tp_pct} min={0.1} max={20} step={0.1}
                                onChange={e => set('tp_pct', Number(e.target.value))}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-textMain" />
                        </div>
                        <div>
                            <label className="text-[10px] text-textMuted uppercase tracking-wider block mb-1">SL %</label>
                            <input type="number" value={config.sl_pct} min={0.1} max={10} step={0.1}
                                onChange={e => set('sl_pct', Number(e.target.value))}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-textMain" />
                        </div>
                        <div>
                            <label className="text-[10px] text-textMuted uppercase tracking-wider block mb-1">Leverage</label>
                            <input type="number" value={config.leverage} min={1} max={100}
                                onChange={e => set('leverage', Number(e.target.value))}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-textMain" />
                        </div>
                        <div>
                            <label className="text-[10px] text-textMuted uppercase tracking-wider block mb-1">Margin %</label>
                            <input type="number" value={config.margin_pct} min={0.5} max={20} step={0.5}
                                onChange={e => set('margin_pct', Number(e.target.value))}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-textMain" />
                        </div>
                    </div>
                    <button onClick={run} disabled={running}
                        className="flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-background font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-60 shadow-lg shadow-primary/20">
                        {running ? <><Loader2 className="w-4 h-4 animate-spin" /> Running Backtest...</> : <><Play className="w-4 h-4" /> Run Backtest</>}
                    </button>
                </div>

                {error && (
                    <div className="glass-panel rounded-xl border border-sell/30 p-4 flex items-center gap-3 text-sell">
                        <AlertTriangle className="w-5 h-5 shrink-0" /><p className="text-sm">{error}</p>
                    </div>
                )}

                {running && (
                    <div className="flex flex-col items-center justify-center py-16 text-textMuted gap-4">
                        <Loader2 className="w-12 h-12 animate-spin text-primary" />
                        <p>Simulating AI trades over {config.lookback} candles of {config.symbol} {config.timeframe} data...</p>
                        <p className="text-xs">This may take 15-30 seconds for the AI to analyse all signals.</p>
                    </div>
                )}

                {result && !running && (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <StatPill label="Total Trades" value={result.total_trades} />
                            <StatPill label="Win Rate" value={`${result.win_rate}%`} good={result.win_rate >= 50} />
                            <StatPill label="Profit Factor" value={result.profit_factor} good={result.profit_factor >= 1} />
                            <StatPill label="Total Return" value={`${result.return_pct}%`} good={result.return_pct >= 0} />
                            <StatPill label="Final Balance" value={`$${result.final_balance?.toLocaleString()}`} good={result.final_balance >= 100000} />
                            <StatPill label="Avg R:R" value={`${result.rr_ratio}:1`} good={result.rr_ratio >= 1} />
                            <StatPill label="Best Trade" value={`+$${result.best_trade?.pnl?.toFixed(2)}`} good />
                            <StatPill label="Worst Trade" value={`$${result.worst_trade?.pnl?.toFixed(2)}`} good={false} />
                        </div>

                        <div className="glass-panel rounded-xl border border-white/5 p-4">
                            <p className="text-xs uppercase tracking-widest text-textMuted mb-3">Backtest Equity Curve</p>
                            <MiniEquityChart data={result.equity_curve} />
                        </div>

                        {result.trades?.length > 0 && (
                            <div className="glass-panel rounded-xl border border-white/5 overflow-hidden">
                                <p className="text-xs uppercase tracking-widest text-textMuted p-4 border-b border-border/50">Trade Log (last {result.trades.length} trades)</p>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs font-mono">
                                        <thead>
                                            <tr className="bg-surface text-textMuted text-[10px] uppercase tracking-wider">
                                                <th className="px-4 py-2 text-left">Type</th>
                                                <th className="px-4 py-2 text-right">Entry</th>
                                                <th className="px-4 py-2 text-right">Exit</th>
                                                <th className="px-4 py-2 text-right">PnL</th>
                                                <th className="px-4 py-2 text-left">Exit Reason</th>
                                                <th className="px-4 py-2 text-right">Conf</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {result.trades.map((t, i) => (
                                                <tr key={i} className="border-t border-white/5 hover:bg-white/2">
                                                    <td className={`px-4 py-2 font-bold ${t.type === 'LONG' ? 'text-buy' : 'text-sell'}`}>{t.type}</td>
                                                    <td className="px-4 py-2 text-right text-textMuted">${t.entry?.toLocaleString()}</td>
                                                    <td className="px-4 py-2 text-right text-textMuted">${t.exit?.toLocaleString()}</td>
                                                    <td className={`px-4 py-2 text-right font-bold ${t.pnl >= 0 ? 'text-buy' : 'text-sell'}`}>
                                                        {t.pnl >= 0 ? '+' : ''}${t.pnl?.toFixed(2)}
                                                    </td>
                                                    <td className={`px-4 py-2 ${t.reason === 'TP' ? 'text-buy' : t.reason === 'SL' ? 'text-sell' : 'text-textMuted'}`}>{t.reason}</td>
                                                    <td className="px-4 py-2 text-right text-textMuted">{t.confidence}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
