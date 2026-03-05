'use client';
import { Activity, LayoutDashboard, Settings, TrendingUp, RefreshCw, Zap, TrendingDown, Minus } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const COINS = {
    'BTC/USDT': { name: 'Bitcoin', color: '#F7931A', short: 'BTC' },
    'ETH/USDT': { name: 'Ethereum', color: '#627EEA', short: 'ETH' },
    'SOL/USDT': { name: 'Solana', color: '#9945FF', short: 'SOL' },
    'BNB/USDT': { name: 'BNB', color: '#F3BA2F', short: 'BNB' },
    'XRP/USDT': { name: 'XRP', color: '#00AAE4', short: 'XRP' },
    'DOGE/USDT': { name: 'Dogecoin', color: '#C2A633', short: 'DOGE' },
    'ADA/USDT': { name: 'Cardano', color: '#0033AD', short: 'ADA' },
    'AVAX/USDT': { name: 'Avalanche', color: '#E84142', short: 'AVAX' },
};

function SignalBadge({ action }) {
    if (action === 'BUY') return <span className="flex items-center gap-1 text-buy font-bold text-xs font-mono"><TrendingUp className="w-3 h-3" />BUY</span>;
    if (action === 'SELL') return <span className="flex items-center gap-1 text-sell font-bold text-xs font-mono"><TrendingDown className="w-3 h-3" />SELL</span>;
    return <span className="flex items-center gap-1 text-textMuted text-xs font-mono"><Minus className="w-3 h-3" />HOLD</span>;
}

function ConfidenceBar({ value, action }) {
    const color = action === 'BUY' ? '#00e676' : action === 'SELL' ? '#ff3d00' : '#666';
    return (
        <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, background: color }} />
        </div>
    );
}

export default function AIMarkets() {
    const [signals, setSignals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [scanning, setScanning] = useState(false);

    const runScan = useCallback(async () => {
        setScanning(true);
        try {
            const res = await fetch(`${API}/api/market-scan`);
            const payload = await res.json();
            if (payload.status === 'success') {
                setSignals(payload.data);
                setLastUpdated(new Date());
            }
        } catch (err) {
            console.error('Market scan failed:', err);
        } finally {
            setLoading(false);
            setScanning(false);
        }
    }, []);

    useEffect(() => {
        runScan();
        const interval = setInterval(runScan, 60000); // Auto-refresh every 60s
        return () => clearInterval(interval);
    }, [runScan]);

    const buySignals = signals.filter(s => s.action === 'BUY');
    const sellSignals = signals.filter(s => s.action === 'SELL');
    const holdSignals = signals.filter(s => s.action === 'HOLD');
    const topOpportunity = signals.find(s => s.action !== 'HOLD' && s.confidence >= 60);

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Sidebar */}
            <aside className="w-20 lg:w-48 border-r border-border bg-surface shrink-0 flex flex-col items-center lg:items-start py-8 transition-all relative z-10">
                <div className="flex items-center justify-center lg:justify-start w-full px-6 mb-12">
                    <TrendingUp className="text-primary w-8 h-8 lg:mr-3" />
                    <h1 className="hidden lg:block text-lg font-bold tracking-wider">TWM <span className="text-xs text-background font-mono bg-primary px-2 py-0.5 rounded ml-1 font-bold">AI</span></h1>
                </div>
                <nav className="flex-1 w-full space-y-2 px-3">
                    <Link href="/" className="flex items-center gap-3 p-3 rounded-xl transition-all duration-300 group text-textMuted border border-transparent hover:bg-white/5 hover:text-textMain hover:border-white/10">
                        <LayoutDashboard className="w-5 h-5 shrink-0" />
                        <span className="hidden lg:block text-sm">Dashboard</span>
                    </Link>
                    <Link href="/markets" className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 text-primary font-medium border border-primary/20 shadow-inner">
                        <Activity className="w-5 h-5 shrink-0" />
                        <span className="hidden lg:block text-sm">AI Markets</span>
                    </Link>
                    <a href="#" className="flex items-center gap-3 p-3 rounded-xl transition-all text-textMuted border border-transparent hover:bg-white/5 hover:text-textMain hover:border-white/10">
                        <Settings className="w-5 h-5 shrink-0" />
                        <span className="hidden lg:block text-sm">Settings</span>
                    </a>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col p-4 lg:p-6 space-y-6 overflow-y-auto">
                {/* Header */}
                <header className="flex items-center justify-between glass-card p-4">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-3">
                            AI Market Scanner
                            <span className="text-sm font-normal text-textMuted bg-surface border border-white/5 py-1 px-3 rounded-full">8 Pairs</span>
                        </h2>
                        <p className="text-textMuted text-xs mt-1">
                            {lastUpdated ? `Last scan: ${lastUpdated.toLocaleTimeString()}` : 'Scanning...'}
                            <span className="ml-2 text-primary/60">• Auto-refreshes every 60s</span>
                        </p>
                    </div>
                    <button onClick={runScan} disabled={scanning}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-sm font-bold hover:bg-primary/20 transition-all disabled:opacity-50">
                        <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
                        {scanning ? 'Scanning...' : 'Scan Now'}
                    </button>
                </header>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="glass-panel p-4 rounded-xl border border-buy/20 bg-buy/5 text-center">
                        <p className="text-[10px] uppercase tracking-widest text-textMuted mb-1">Buy Signals</p>
                        <p className="text-3xl font-bold text-buy">{buySignals.length}</p>
                    </div>
                    <div className="glass-panel p-4 rounded-xl border border-sell/20 bg-sell/5 text-center">
                        <p className="text-[10px] uppercase tracking-widest text-textMuted mb-1">Sell Signals</p>
                        <p className="text-3xl font-bold text-sell">{sellSignals.length}</p>
                    </div>
                    <div className="glass-panel p-4 rounded-xl border border-border text-center">
                        <p className="text-[10px] uppercase tracking-widest text-textMuted mb-1">Neutral</p>
                        <p className="text-3xl font-bold text-textMuted">{holdSignals.length}</p>
                    </div>
                </div>

                {/* Top Opportunity Alert */}
                {topOpportunity && (
                    <div className={`glass-panel p-4 rounded-xl border ${topOpportunity.action === 'BUY' ? 'border-buy/40 bg-buy/5' : 'border-sell/40 bg-sell/5'} flex items-center gap-4`}>
                        <Zap className={`w-8 h-8 shrink-0 ${topOpportunity.action === 'BUY' ? 'text-buy' : 'text-sell'}`} />
                        <div>
                            <p className="text-xs text-textMuted uppercase tracking-widest mb-0.5">Top Opportunity</p>
                            <p className="font-bold text-textMain">
                                {COINS[topOpportunity.symbol]?.name || topOpportunity.symbol} —
                                <span className={topOpportunity.action === 'BUY' ? ' text-buy' : ' text-sell'}> {topOpportunity.action}</span>
                                <span className="text-textMuted text-sm font-normal"> at {topOpportunity.confidence}% confidence</span>
                            </p>
                            <p className="text-xs text-textMuted mt-1">{topOpportunity.reason?.slice(0, 100)}...</p>
                        </div>
                    </div>
                )}

                {/* Signal Grid */}
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-textMuted">
                        <div className="w-12 h-12 rounded-full border-t-2 border-primary animate-spin" />
                        <p className="text-sm">AI is analyzing 8 markets...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {signals.map(sig => {
                            const coin = COINS[sig.symbol] || { name: sig.symbol, color: '#888', short: sig.symbol };
                            const isBuy = sig.action === 'BUY';
                            const isSell = sig.action === 'SELL';
                            return (
                                <div key={sig.symbol}
                                    className={`glass-panel rounded-xl border p-4 transition-all hover:scale-[1.02] duration-300 ${isBuy ? 'border-buy/30 shadow-[0_0_20px_rgba(0,230,118,0.05)]' :
                                            isSell ? 'border-sell/30 shadow-[0_0_20px_rgba(255,61,0,0.05)]' :
                                                'border-border'
                                        }`}>
                                    {/* Coin Header */}
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-background"
                                                style={{ background: coin.color }}>
                                                {coin.short.slice(0, 2)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm">{coin.short}</p>
                                                <p className="text-[9px] text-textMuted">{coin.name}</p>
                                            </div>
                                        </div>
                                        <SignalBadge action={sig.action} />
                                    </div>

                                    {/* Price */}
                                    <p className="font-mono text-lg font-bold mb-1">
                                        ${sig.current_price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) || '—'}
                                    </p>

                                    {/* Confidence Bar */}
                                    <div className="mb-2">
                                        <div className="flex justify-between text-[9px] text-textMuted mb-1">
                                            <span>AI Confidence</span>
                                            <span className="font-mono">{sig.confidence}%</span>
                                        </div>
                                        <ConfidenceBar value={sig.confidence} action={sig.action} />
                                    </div>

                                    {/* Mini Indicators */}
                                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] font-mono border-t border-white/5 pt-2 mt-2">
                                        <div className="flex justify-between">
                                            <span className="text-textMuted">RSI</span>
                                            <span className={sig.rsi > 70 ? 'text-sell' : sig.rsi < 30 ? 'text-buy' : 'text-textMain'}>
                                                {sig.rsi?.toFixed(1) || '—'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-textMuted">BB%</span>
                                            <span>{sig.bb_pct != null ? `${(sig.bb_pct * 100).toFixed(0)}%` : '—'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-textMuted">MACD</span>
                                            <span className={sig.macd > 0 ? 'text-buy' : 'text-sell'}>
                                                {sig.macd != null ? (sig.macd > 0 ? '▲' : '▼') : '—'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-textMuted">ATR</span>
                                            <span>{sig.atr != null ? `${(sig.atr * 100).toFixed(2)}%` : '—'}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
