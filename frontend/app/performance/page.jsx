'use client';
import {
    TrendingUp, LayoutDashboard, Activity, Settings, FlaskConical,
    BarChart2, Trophy, TrendingDown, Target, AlertTriangle, RefreshCw
} from 'lucide-react';
import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const SIDEBAR_LINKS = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/markets', label: 'AI Markets', icon: Activity },
    { href: '/performance', label: 'Performance', icon: BarChart2, active: true },
    { href: '/backtest', label: 'Backtest', icon: FlaskConical },
    { href: '/settings', label: 'Settings', icon: Settings },
];

function StatCard({ label, value, sub, color = 'text-textMain', icon: Icon }) {
    return (
        <div className="glass-panel rounded-xl border border-white/5 p-4">
            <div className="flex items-center gap-2 mb-2">
                {Icon && <Icon className={`w-4 h-4 ${color}`} />}
                <p className="text-[10px] uppercase tracking-widest text-textMuted">{label}</p>
            </div>
            <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
            {sub && <p className="text-[10px] text-textMuted mt-1">{sub}</p>}
        </div>
    );
}

function MiniEquityChart({ data }) {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const w = 600; const h = 120;
    const pts = data.map((v, i) =>
        `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`
    ).join(' ');
    const isUp = data[data.length - 1] >= data[0];
    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-28" preserveAspectRatio="none">
            <polyline points={pts} fill="none" stroke={isUp ? '#00e676' : '#ff3d00'} strokeWidth="2" />
        </svg>
    );
}

export default function Performance() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/api/performance`);
            const payload = await res.json();
            if (payload.status === 'success') setData(payload.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const noTrades = !data || data.total_trades === 0;

    return (
        <div className="flex h-screen overflow-hidden">
            <aside className="w-20 lg:w-48 border-r border-border bg-surface shrink-0 flex flex-col items-center lg:items-start py-8">
                <div className="flex items-center justify-center lg:justify-start w-full px-6 mb-10">
                    <TrendingUp className="text-primary w-8 h-8 lg:mr-3" />
                    <h1 className="hidden lg:block text-lg font-bold tracking-wider">TWM <span className="text-xs text-background bg-primary px-2 py-0.5 rounded ml-1">AI</span></h1>
                </div>
                <nav className="flex-1 w-full space-y-2 px-3">
                    {SIDEBAR_LINKS.map(({ href, label, icon: Icon, active }) => (
                        <a key={href} href={href} className={`flex items-center gap-3 p-3 rounded-xl transition-all text-sm ${active ? 'bg-primary/10 text-primary font-medium border border-primary/20' : 'text-textMuted border border-transparent hover:bg-white/5 hover:text-textMain'}`}>
                            <Icon className="w-5 h-5 shrink-0" /><span className="hidden lg:block">{label}</span>
                        </a>
                    ))}
                </nav>
            </aside>

            <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
                <header className="flex items-center justify-between glass-card p-4">
                    <div>
                        <h2 className="text-2xl font-bold">AI Performance Dashboard</h2>
                        <p className="text-textMuted text-xs mt-1">Based on all closed paper trades in your local history</p>
                    </div>
                    <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-sm font-bold hover:bg-primary/20">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                </header>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center py-32">
                        <div className="w-10 h-10 rounded-full border-t-2 border-primary animate-spin" />
                    </div>
                ) : noTrades ? (
                    <div className="glass-panel rounded-xl border border-border p-12 text-center text-textMuted">
                        <BarChart2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p className="font-semibold">No trade history yet</p>
                        <p className="text-xs mt-1">Enable AI Auto-Trading on the Dashboard to start generating performance data.</p>
                    </div>
                ) : (
                    <>
                        {/* KPI Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <StatCard label="Win Rate" value={`${data.win_rate}%`} icon={Trophy}
                                color={data.win_rate >= 50 ? 'text-buy' : 'text-sell'}
                                sub={`${data.total_trades} total trades`} />
                            <StatCard label="Profit Factor" value={data.profit_factor}
                                icon={Target} color={data.profit_factor >= 1 ? 'text-buy' : 'text-sell'}
                                sub="Gross wins / gross losses" />
                            <StatCard label="Total PnL" value={`$${data.total_pnl?.toLocaleString()}`}
                                icon={data.total_pnl >= 0 ? TrendingUp : TrendingDown}
                                color={data.total_pnl >= 0 ? 'text-buy' : 'text-sell'} />
                            <StatCard label="Avg R:R" value={`${data.rr_ratio}:1`}
                                icon={BarChart2} sub={`Avg win $${data.avg_win} / Avg loss $${data.avg_loss}`} />
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <StatCard label="TP Hits" value={data.tp_count} icon={Target} color="text-buy" />
                            <StatCard label="SL Hits" value={data.sl_count} icon={AlertTriangle} color="text-sell" />
                            <StatCard label="Best Trade" value={`+$${data.best_trade?.pnl?.toFixed(2)}`} color="text-buy" />
                            <StatCard label="Worst Trade" value={`$${data.worst_trade?.pnl?.toFixed(2)}`} color="text-sell" />
                        </div>

                        {/* Equity Curve */}
                        <div className="glass-panel rounded-xl border border-white/5 p-4">
                            <p className="text-xs uppercase tracking-widest text-textMuted mb-3">Account Equity Curve</p>
                            <MiniEquityChart data={data.equity_curve} />
                        </div>

                        {/* Trade History Table */}
                        <div className="glass-panel rounded-xl border border-white/5 overflow-hidden">
                            <div className="p-4 border-b border-border/50">
                                <p className="text-xs uppercase tracking-widest text-textMuted">Recent Closed Trades</p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs font-mono">
                                    <thead>
                                        <tr className="bg-surface text-textMuted text-[10px] uppercase tracking-wider">
                                            <th className="px-4 py-2 text-left">Type</th>
                                            <th className="px-4 py-2 text-right">Entry</th>
                                            <th className="px-4 py-2 text-right">Close</th>
                                            <th className="px-4 py-2 text-right">PnL</th>
                                            <th className="px-4 py-2 text-left">Reason</th>
                                            <th className="px-4 py-2 text-left">Closed</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.recent_trades?.map((t, i) => (
                                            <tr key={i} className="border-t border-white/5 hover:bg-white/2">
                                                <td className={`px-4 py-2 font-bold ${t.type === 'LONG' ? 'text-buy' : 'text-sell'}`}>{t.type}</td>
                                                <td className="px-4 py-2 text-right text-textMuted">${t.entry_price?.toLocaleString()}</td>
                                                <td className="px-4 py-2 text-right text-textMuted">${t.close_price?.toLocaleString()}</td>
                                                <td className={`px-4 py-2 text-right font-bold ${t.pnl >= 0 ? 'text-buy' : 'text-sell'}`}>
                                                    {t.pnl >= 0 ? '+' : ''}${t.pnl?.toFixed(2)}
                                                </td>
                                                <td className={`px-4 py-2 ${t.reason === 'Take Profit' ? 'text-buy' : t.reason === 'Stop Loss' ? 'text-sell' : 'text-textMuted'}`}>{t.reason}</td>
                                                <td className="px-4 py-2 text-textMuted">{t.closed_at ? new Date(t.closed_at).toLocaleString() : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
