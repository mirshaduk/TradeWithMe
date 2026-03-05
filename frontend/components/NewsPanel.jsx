'use client';
import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Newspaper, RefreshCw, ExternalLink, Minus } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const CACHE_MS = 5 * 60 * 1000; // 5 min

export default function NewsPanel({ currencies = 'BTC,ETH,SOL' }) {
    const [news, setNews] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/api/news?currencies=${currencies}`);
            const d = await res.json();
            if (d.status === 'success') setNews(d.data);
        } catch (e) { console.error('News fetch failed:', e); }
        finally { setLoading(false); }
    }, [currencies]);

    useEffect(() => {
        load();
        const iv = setInterval(load, CACHE_MS);
        return () => clearInterval(iv);
    }, [load]);

    const sentimentColor = news?.sentiment > 0.1 ? 'text-buy' : news?.sentiment < -0.1 ? 'text-sell' : 'text-amber-400';
    const sentimentBg = news?.sentiment > 0.1 ? 'bg-buy/10 border-buy/20' : news?.sentiment < -0.1 ? 'bg-sell/10 border-sell/20' : 'bg-amber-500/10 border-amber-500/20';

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-border/50 bg-surface/80 shrink-0">
                <h3 className="text-xs font-semibold text-textMuted uppercase tracking-wide flex items-center gap-2">
                    <Newspaper className="w-3.5 h-3.5 text-primary" />
                    Crypto News
                </h3>
                <div className="flex items-center gap-2">
                    {news && (
                        <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${sentimentBg} ${sentimentColor}`}>
                            {news.sentiment_label}
                        </span>
                    )}
                    <button onClick={load} className="text-textMuted hover:text-primary transition-colors">
                        <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Sentiment bar */}
            {news && (
                <div className="px-3 py-2 border-b border-border/30 bg-surface/40 shrink-0">
                    <div className="flex justify-between text-[9px] text-textMuted mb-1">
                        <span>🐻 Bearish ({news.bear_count})</span>
                        <span className={`font-bold ${sentimentColor}`}>{(news.sentiment * 100).toFixed(0)}% Score</span>
                        <span>Bullish ({news.bull_count}) 🐂</span>
                    </div>
                    <div className="h-1 bg-sell/30 rounded-full overflow-hidden">
                        <div className="h-full bg-buy/70 rounded-full transition-all"
                            style={{ width: `${((news.sentiment + 1) / 2) * 100}%` }} />
                    </div>
                </div>
            )}

            {/* News list */}
            <div className="flex-1 overflow-y-auto divide-y divide-white/5">
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 rounded-full border-t border-primary animate-spin" />
                    </div>
                ) : news?.headlines?.length === 0 ? (
                    <p className="text-center text-textMuted text-xs py-8">No news available</p>
                ) : (
                    news?.headlines?.map((h, i) => (
                        <a key={i} href={h.url} target="_blank" rel="noreferrer"
                            className="flex flex-col gap-1 p-3 hover:bg-white/3 transition-colors group">
                            <div className="flex items-start gap-2">
                                {h.sentiment === 'bullish' ? <TrendingUp className="w-3 h-3 text-buy shrink-0 mt-0.5" /> :
                                    h.sentiment === 'bearish' ? <TrendingDown className="w-3 h-3 text-sell shrink-0 mt-0.5" /> :
                                        <Minus className="w-3 h-3 text-textMuted shrink-0 mt-0.5" />}
                                <p className="text-[11px] text-textMain leading-snug group-hover:text-primary transition-colors line-clamp-2">
                                    {h.title}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 ml-5 text-[9px] text-textMuted">
                                <span>{h.source}</span>
                                <span>·</span>
                                <span>{h.bull_votes > 0 ? `🐂${h.bull_votes}` : ''} {h.bear_votes > 0 ? `🐻${h.bear_votes}` : ''}</span>
                            </div>
                        </a>
                    ))
                )}
            </div>
        </div>
    );
}
