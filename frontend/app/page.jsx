'use client';
import { Activity, LayoutDashboard, Settings, TrendingUp } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { useTrade } from '../context/TradeContext';
import SuggestionPanel from '../components/SuggestionPanel';
import TradeExecutionPanel from '../components/TradeExecutionPanel';
import PortfolioWidget from '../components/PortfolioWidget';

// ChartWidget must be dynamically imported (no SSR - it uses window/DOM)
const ChartWidget = dynamic(() => import('../components/ChartWidget'), { ssr: false });

export default function Home() {
    const { updatePrice, currentPrice } = useTrade();

    const [chartData, setChartData] = useState([]);
    const [latestCandle, setLatestCandle] = useState(null);
    const [aiAnalysis, setAiAnalysis] = useState(null);
    const [loading, setLoading] = useState(true);

    const [timeframe, setTimeframe] = useState('1h');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Fetch Data from Python Backend
    useEffect(() => {
        setLoading(true);
        setLatestCandle(null); // Reset candle on timeframe change
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/market-data?symbol=BTC/USDT&timeframe=${timeframe}&limit=100`)
            .then(res => res.json())
            .then(payload => {
                if (payload.status === "success" && payload.data.length > 0) {
                    setChartData(payload.data);
                    updatePrice(payload.data[payload.data.length - 1].close);
                }
            })
            .catch(err => console.error("Error fetching market data:", err))
            .finally(() => setLoading(false));

        // Fetch AI Analysis from Python Backend
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/suggestions?symbol=BTC/USDT`)
            .then(res => res.json())
            .then(payload => {
                if (payload.status === "success") {
                    setAiAnalysis(payload.data);
                }
            })
            .catch(err => console.error("Error fetching AI data:", err));

        // Poll every 5 seconds for the latest candle (for real-time chart updates)
        const interval = setInterval(() => {
            fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/market-data?symbol=BTC/USDT&timeframe=${timeframe}&limit=2`)
                .then(res => res.json())
                .then(payload => {
                    if (payload.status === "success" && payload.data.length > 0) {
                        const newCandle = payload.data[payload.data.length - 1];
                        updatePrice(newCandle.close);
                        setLatestCandle(newCandle); // Push latest candle to chart
                    }
                });
        }, 5000);

        return () => clearInterval(interval);

    }, [timeframe]);

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Sidebar Navigation */}
            <aside className="w-20 lg:w-48 border-r border-border bg-surface shrink-0 flex flex-col items-center lg:items-start py-8 transition-all relative z-10">
                <div className="flex items-center justify-center lg:justify-start w-full px-6 mb-12">
                    <TrendingUp className="text-primary w-8 h-8 lg:mr-3" />
                    <h1 className="hidden lg:block text-lg font-bold tracking-wider">TWM  <span className="text-xs text-background font-mono bg-primary px-2 py-0.5 rounded ml-1 font-bold">AI</span></h1>
                </div>

                <nav className="flex-1 w-full space-y-2 px-3">
                    <NavItem icon={<LayoutDashboard />} label="Dashboard" active />
                    <NavItem icon={<Activity />} label="AI Markets" />
                    <NavItem icon={<Settings />} label="Settings" />
                </nav>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col p-4 lg:p-6 space-y-6 overflow-y-auto w-full relative z-0">
                {/* Header Ribbon */}
                <header className="flex items-center justify-between glass-card p-4">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-3">
                            BTC/USDT
                            <span className="text-sm font-normal text-textMuted bg-surface border border-white/5 py-1 px-3 rounded-full">Bitcoin</span>
                        </h2>
                    </div>
                    <div className="flex gap-4 items-center">
                        <div className="px-4 py-2 bg-background border border-border rounded-lg text-sm font-mono tracking-widest text-textMuted hidden md:block">
                            MARK PRICE: <span className="text-textMain font-bold">
                                {mounted ? `$${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '...'}
                            </span>
                        </div>
                        {aiAnalysis ? (
                            <div className={`px-4 py-2 ${aiAnalysis.action === 'BUY' ? 'bg-buy/10 text-buy border-buy/20 shadow-[0_0_15px_rgba(0,230,118,0.1)]' : aiAnalysis.action === 'SELL' ? 'bg-sell/10 text-sell border-sell/20 shadow-[0_0_15px_rgba(255,61,0,0.1)]' : 'bg-surface text-amber-500 border-border'} rounded-lg font-mono font-medium border flex items-center gap-2 text-sm`}>
                                <span className={`w-2 h-2 rounded-full ${aiAnalysis.action === 'BUY' ? 'bg-buy animate-pulse-slow' : aiAnalysis.action === 'SELL' ? 'bg-sell animate-pulse-slow' : 'bg-amber-500'}`}></span>
                                {aiAnalysis.action}
                            </div>
                        ) : (
                            <div className="px-4 py-2 bg-surface text-textMuted rounded-lg font-mono font-medium border border-border flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full border-t border-textMuted animate-spin"></span>
                                AI Wait
                            </div>
                        )}
                    </div>
                </header>

                {/* Dashboard Grid - Complex Layout */}
                <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-[700px]">
                    {/* Left Column (Chart + Portfolio) */}
                    <div className="flex-1 flex flex-col gap-6">
                        {/* Chart Area */}
                        <div className="flex-1 glass-panel rounded-2xl flex flex-col overflow-hidden relative border border-white/5 min-h-[400px]">
                            <div className="p-4 border-b border-border/50 flex justify-between items-center bg-surface/80">
                                <h3 className="font-semibold text-textMuted text-xs tracking-wide uppercase">Market Chart</h3>
                                <div className="flex gap-2 text-[10px] font-mono text-textMuted flex-wrap justify-end max-w-[200px] sm:max-w-none">
                                    <button onClick={() => setTimeframe('1m')} className={`px-2 py-1 rounded transition-colors ${timeframe === '1m' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-background hover:text-primary'}`}>1M</button>
                                    <button onClick={() => setTimeframe('3m')} className={`px-2 py-1 rounded transition-colors ${timeframe === '3m' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-background hover:text-primary'}`}>3M</button>
                                    <button onClick={() => setTimeframe('5m')} className={`px-2 py-1 rounded transition-colors ${timeframe === '5m' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-background hover:text-primary'}`}>5M</button>
                                    <button onClick={() => setTimeframe('15m')} className={`px-2 py-1 rounded transition-colors ${timeframe === '15m' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-background hover:text-primary'}`}>15M</button>
                                    <button onClick={() => setTimeframe('1h')} className={`px-2 py-1 rounded transition-colors ${timeframe === '1h' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-background hover:text-primary'}`}>1H</button>
                                    <button onClick={() => setTimeframe('1d')} className={`px-2 py-1 rounded transition-colors ${timeframe === '1d' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-background hover:text-primary'}`}>1D</button>
                                </div>
                            </div>
                            <div className="flex-1 bg-background/50 relative">
                                {loading ? (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-8 h-8 rounded-full border-t-2 border-primary animate-spin"></div>
                                    </div>
                                ) : (
                                    <ChartWidget data={chartData} latestCandle={latestCandle} />
                                )}
                            </div>
                        </div>
                        {/* Portfolio Area */}
                        <div className="h-[250px] lg:h-[300px] glass-panel rounded-2xl flex flex-col overflow-hidden border border-white/5 shadow-xl">
                            <PortfolioWidget />
                        </div>
                    </div>

                    {/* Right Column (Execution + AI) */}
                    <div className="w-full xl:w-[400px] flex flex-col gap-6">
                        {/* Execution Panel */}
                        <div className="glass-panel rounded-2xl flex flex-col overflow-hidden border border-white/5 shadow-lg">
                            <TradeExecutionPanel />
                        </div>

                        {/* AI Suggestions Panel */}
                        <div className="flex-1 glass-panel rounded-2xl flex flex-col overflow-hidden border border-white/5 min-h-[400px]">
                            <div className="p-4 border-b border-border/50 bg-surface/80 flex items-center justify-between">
                                <h3 className="font-semibold text-textMuted text-xs tracking-wide uppercase">AI Strategy Engine</h3>
                                <span className="text-[10px] font-mono text-primary border border-primary/30 rounded px-2 py-0.5 bg-primary/10">v2.0 Beta</span>
                            </div>
                            <SuggestionPanel data={aiAnalysis} loading={loading} />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

function NavItem({ icon, label, active = false }) {
    return (
        <a href="#" className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 group ${active ? 'bg-primary/10 text-primary font-medium border border-primary/20 shadow-inner' : 'text-textMuted border border-transparent hover:bg-white/5 hover:text-textMain hover:border-white/10'}`}>
            <span className={`${active ? 'text-primary' : 'text-textMuted group-hover:text-textMain'}`}>{icon}</span>
            <span className="hidden lg:block text-sm">{label}</span>
        </a>
    );
}
