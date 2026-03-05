'use client';
import {
    TrendingUp, LayoutDashboard, Activity, Settings, FlaskConical, BarChart2,
    Save, RotateCcw, Bot
} from 'lucide-react';
import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const SIDEBAR_LINKS = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/markets', label: 'AI Markets', icon: Activity },
    { href: '/performance', label: 'Performance', icon: BarChart2 },
    { href: '/backtest', label: 'Backtest', icon: FlaskConical },
    { href: '/settings', label: 'Settings', icon: Settings, active: true },
];

function Slider({ label, value, min, max, step = 1, unit = '', onChange, desc }) {
    return (
        <div className="space-y-2">
            <div className="flex justify-between text-xs">
                <span className="text-textMuted">{label}</span>
                <span className="font-mono font-bold text-textMain">{value}{unit}</span>
            </div>
            <input type="range" min={min} max={max} step={step} value={value}
                onChange={e => onChange(Number(e.target.value))}
                className="w-full accent-primary" />
            <div className="flex justify-between text-[9px] text-textMuted">
                <span>{min}{unit}</span><span className="text-center opacity-60">{desc}</span><span>{max}{unit}</span>
            </div>
        </div>
    );
}

function Toggle({ label, checked, onChange, desc }) {
    return (
        <div className="flex items-center justify-between py-2">
            <div>
                <p className="text-sm text-textMain">{label}</p>
                <p className="text-[10px] text-textMuted">{desc}</p>
            </div>
            <button onClick={() => onChange(!checked)}
                className={`w-10 h-5 rounded-full transition-all relative ${checked ? 'bg-primary' : 'bg-surface border border-border'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? 'left-5' : 'left-0.5'}`} />
            </button>
        </div>
    );
}

export default function SettingsPage() {
    const [settings, setSettings] = useState(null);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        fetch(`${API}/api/settings`)
            .then(r => r.json())
            .then(p => { if (p.status === 'success') setSettings(p.data); });
    }, []);

    const save = async () => {
        await fetch(`${API}/api/settings`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const set = (section, key, val) =>
        setSettings(s => ({ ...s, [section]: { ...s[section], [key]: val } }));

    if (!settings) return (
        <div className="flex items-center justify-center h-screen">
            <div className="w-10 h-10 rounded-full border-t-2 border-primary animate-spin" />
        </div>
    );

    const at = settings.autoTrader;
    const nt = settings.notifications;

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
                <header className="flex items-center justify-between glass-card p-4">
                    <div>
                        <h2 className="text-2xl font-bold">Settings</h2>
                        <p className="text-textMuted text-xs mt-1">Configure AI auto-trader parameters — saved to your local PC</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={save}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-bold transition-all ${saved ? 'bg-buy/20 text-buy border-buy/30' : 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'}`}>
                            <Save className="w-4 h-4" /> {saved ? 'Saved!' : 'Save Settings'}
                        </button>
                    </div>
                </header>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Auto-Trader Config */}
                    <div className="glass-panel rounded-xl border border-white/5 p-6 space-y-6">
                        <div className="flex items-center gap-2 border-b border-border/50 pb-3">
                            <Bot className="w-5 h-5 text-primary" />
                            <h3 className="font-bold text-sm uppercase tracking-wider text-textMuted">AI Auto-Trader</h3>
                        </div>
                        <Slider label="Min AI Confidence" value={at.minConfidence} min={50} max={95} unit="%"
                            desc="Higher = fewer, better trades"
                            onChange={v => set('autoTrader', 'minConfidence', v)} />
                        <Slider label="Margin per Trade" value={at.marginPct} min={0.5} max={10} step={0.5} unit="%"
                            desc="% of balance per position"
                            onChange={v => set('autoTrader', 'marginPct', v)} />
                        <Slider label="Leverage" value={at.leverage} min={1} max={50} unit="×"
                            desc="Futures leverage multiplier"
                            onChange={v => set('autoTrader', 'leverage', v)} />
                        <Slider label="Take Profit" value={at.tpPct} min={0.5} max={10} step={0.1} unit="%"
                            desc="% from entry to TP"
                            onChange={v => set('autoTrader', 'tpPct', v)} />
                        <Slider label="Stop Loss" value={at.slPct} min={0.2} max={5} step={0.1} unit="%"
                            desc="% from entry to SL"
                            onChange={v => set('autoTrader', 'slPct', v)} />
                        <Slider label="Max Open Positions" value={at.maxOpenTrades} min={1} max={10}
                            desc="Simultaneous open trades"
                            onChange={v => set('autoTrader', 'maxOpenTrades', v)} />
                        <Slider label="Scan Interval" value={at.pollIntervalSec} min={10} max={300} step={5} unit="s"
                            desc="Seconds between AI checks"
                            onChange={v => set('autoTrader', 'pollIntervalSec', v)} />
                    </div>

                    {/* Notifications */}
                    <div className="space-y-6">
                        <div className="glass-panel rounded-xl border border-white/5 p-6 space-y-4">
                            <h3 className="font-bold text-sm uppercase tracking-wider text-textMuted border-b border-border/50 pb-3">Desktop Notifications</h3>
                            <Toggle label="Trade Opened" checked={nt.onTradeOpen} onChange={v => set('notifications', 'onTradeOpen', v)}
                                desc="Alert when AI opens a new position" />
                            <Toggle label="Take Profit Hit" checked={nt.onTpHit} onChange={v => set('notifications', 'onTpHit', v)}
                                desc="Alert when a trade hits TP ✅" />
                            <Toggle label="Stop Loss Hit" checked={nt.onSlHit} onChange={v => set('notifications', 'onSlHit', v)}
                                desc="Alert when a trade hits SL ⚠️" />
                        </div>

                        {/* R:R Preview */}
                        <div className="glass-panel rounded-xl border border-white/5 p-6">
                            <h3 className="font-bold text-sm uppercase tracking-wider text-textMuted border-b border-border/50 pb-3 mb-4">Strategy Preview</h3>
                            <div className="space-y-2 text-xs font-mono">
                                <div className="flex justify-between"><span className="text-textMuted">Reward:Risk Ratio</span><span className="font-bold text-primary">{(at.tpPct / at.slPct).toFixed(2)}:1</span></div>
                                <div className="flex justify-between"><span className="text-textMuted">Max risk per trade</span><span className="text-sell">{(at.marginPct * at.leverage * at.slPct / 100).toFixed(2)}% of pos</span></div>
                                <div className="flex justify-between"><span className="text-textMuted">Break-even win rate</span><span>{(100 / (1 + at.tpPct / at.slPct)).toFixed(1)}%</span></div>
                                <div className="flex justify-between"><span className="text-textMuted">Scan frequency</span><span>Every {at.pollIntervalSec}s</span></div>
                                <div className="flex justify-between"><span className="text-textMuted">Min confidence</span><span>{at.minConfidence}%</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
