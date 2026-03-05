'use client';
import { createChart } from 'lightweight-charts';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTrade } from '../context/TradeContext';

export default function ChartWidget({ data, latestCandle }) {
    const { positions } = useTrade();
    const chartContainerRef = useRef();
    const wrapperRef = useRef();

    // Store instances to avoid recreation
    const chartRef = useRef(null);
    const seriesRef = useRef(null);
    const priceLinesRef = useRef([]);

    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showOverlays, setShowOverlays] = useState(true);

    // Chart instances
    const volumeSeriesRef = useRef(null);
    const smaSeriesRef = useRef(null);
    const bbUpperSeriesRef = useRef(null);
    const bbLowerSeriesRef = useRef(null);

    // Toggle fullscreen using the browser Fullscreen API
    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            wrapperRef.current?.requestFullscreen().catch(err => {
                console.warn('Fullscreen request failed:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }, []);

    // Watch for browser fullscreen change events (e.g. user presses Escape)
    useEffect(() => {
        const onFsChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
            // Resize chart after fullscreen toggle
            setTimeout(() => {
                if (chartContainerRef.current && chartRef.current) {
                    chartRef.current.applyOptions({
                        width: chartContainerRef.current.clientWidth,
                        height: chartContainerRef.current.clientHeight,
                    });
                }
            }, 100);
        };
        document.addEventListener('fullscreenchange', onFsChange);
        return () => document.removeEventListener('fullscreenchange', onFsChange);
    }, []);

    // 1. Initialize Chart once
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: 'solid', color: 'transparent' },
                textColor: '#a0a4b8',
            },
            grid: {
                vertLines: { color: '#1f242f' },
                horzLines: { color: '#1f242f' },
            },
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight || 400,
            crosshair: { mode: 1 },
            rightPriceScale: { borderColor: '#1f242f' },
            timeScale: { borderColor: '#1f242f', timeVisible: true },
        });

        const candlestickSeries = chart.addCandlestickSeries({
            upColor: '#00e676', downColor: '#ff3d00',
            borderVisible: false,
            wickUpColor: '#00e676', wickDownColor: '#ff3d00'
        });

        // Volume histogram (separate price scale, right side)
        const volumeSeries = chart.addHistogramSeries({
            color: '#26a69a',
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
        });
        chart.priceScale('volume').applyOptions({
            scaleMargins: { top: 0.85, bottom: 0 },
        });

        // SMA-20 line
        const smaSeries = chart.addLineSeries({
            color: '#4fc3f7',
            lineWidth: 1,
            title: 'SMA20',
            priceLineVisible: false,
            lastValueVisible: false,
        });

        // Bollinger Bands (upper + lower)
        const bbUpperSeries = chart.addLineSeries({
            color: 'rgba(123,97,255,0.6)',
            lineWidth: 1,
            lineStyle: 1,
            title: 'BB+',
            priceLineVisible: false,
            lastValueVisible: false,
        });
        const bbLowerSeries = chart.addLineSeries({
            color: 'rgba(255,152,0,0.6)',
            lineWidth: 1,
            lineStyle: 1,
            title: 'BB-',
            priceLineVisible: false,
            lastValueVisible: false,
        });

        chartRef.current = chart;
        seriesRef.current = candlestickSeries;
        volumeSeriesRef.current = volumeSeries;
        smaSeriesRef.current = smaSeries;
        bbUpperSeriesRef.current = bbUpperSeries;
        bbLowerSeriesRef.current = bbLowerSeries;

        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                    height: chartContainerRef.current.clientHeight
                });
            }
        };
        window.addEventListener('resize', handleResize);
        return () => { window.removeEventListener('resize', handleResize); chart.remove(); };
    }, []);

    // 2. Update Series Data: candles + volume + SMA + BB
    useEffect(() => {
        if (!seriesRef.current || !data || data.length === 0) return;

        seriesRef.current.setData(data);
        chartRef.current?.timeScale().fitContent();

        // Volume
        if (volumeSeriesRef.current) {
            const volData = data.map(c => ({
                time: c.time,
                value: c.volume || 0,
                color: c.close >= c.open ? 'rgba(0,230,118,0.4)' : 'rgba(255,61,0,0.4)'
            }));
            volumeSeriesRef.current.setData(volData);
        }

        if (!showOverlays) return;

        const closes = data.map(c => c.close);
        const N = 20;

        // SMA-20
        if (smaSeriesRef.current) {
            const smaData = data.slice(N - 1).map((c, i) => ({
                time: c.time,
                value: closes.slice(i, i + N).reduce((a, b) => a + b, 0) / N
            }));
            smaSeriesRef.current.setData(smaData);
        }

        // Bollinger Bands (20 period, 2σ)
        if (bbUpperSeriesRef.current && bbLowerSeriesRef.current) {
            const bbUpper = [], bbLower = [];
            for (let i = N - 1; i < data.length; i++) {
                const slice = closes.slice(i - N + 1, i + 1);
                const mean = slice.reduce((a, b) => a + b, 0) / N;
                const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / N);
                bbUpper.push({ time: data[i].time, value: mean + 2 * std });
                bbLower.push({ time: data[i].time, value: mean - 2 * std });
            }
            bbUpperSeriesRef.current.setData(bbUpper);
            bbLowerSeriesRef.current.setData(bbLower);
        }
    }, [data, showOverlays]);

    // 2b. Real-time candle streaming — update the last candle live (like TradingView)
    useEffect(() => {
        if (seriesRef.current && latestCandle) {
            try {
                seriesRef.current.update(latestCandle);
            } catch (e) {
                // Silently ignore update errors (e.g. if latest candle is older than existing data)
            }
        }
    }, [latestCandle]);

    // 3. Draw Paper Trading Entry, TP, and SL lines
    useEffect(() => {
        if (!seriesRef.current) return;

        // Clean up old lines
        priceLinesRef.current.forEach(line => {
            seriesRef.current.removePriceLine(line);
        });
        priceLinesRef.current = [];

        // Add new lines for active positions
        positions.forEach(pos => {
            // Entry Line
            const entryLine = seriesRef.current.createPriceLine({
                price: pos.entryPrice,
                color: pos.type === 'LONG' ? '#00e676' : '#ff3d00',
                lineWidth: 2,
                lineStyle: 0,
                axisLabelVisible: true,
                title: `ENTRY (${pos.type})`,
            });
            priceLinesRef.current.push(entryLine);

            // TP Line
            if (pos.tp) {
                const tpLine = seriesRef.current.createPriceLine({
                    price: pos.tp,
                    color: '#00e676',
                    lineWidth: 2,
                    lineStyle: 2,
                    axisLabelVisible: true,
                    title: 'TP ✓',
                });
                priceLinesRef.current.push(tpLine);
            }

            // SL Line
            if (pos.sl) {
                const slLine = seriesRef.current.createPriceLine({
                    price: pos.sl,
                    color: '#ff3d00',
                    lineWidth: 2,
                    lineStyle: 2,
                    axisLabelVisible: true,
                    title: 'SL ✗',
                });
                priceLinesRef.current.push(slLine);
            }
        });

    }, [positions]);

    return (
        <div
            ref={wrapperRef}
            className="w-full h-full relative flex-1 bg-background"
            style={{ minHeight: isFullscreen ? '100vh' : undefined }}
        >
            {/* Overlay Toggle + Fullscreen Button */}
            <div className="absolute top-3 right-3 z-20 flex gap-1">
                <button
                    onClick={() => setShowOverlays(o => !o)}
                    title="Toggle MA/BB overlays"
                    className={`px-2 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-wider border backdrop-blur-sm transition-all ${showOverlays ? 'bg-primary/20 text-primary border-primary/40' : 'bg-surface/80 border-white/10 text-textMuted hover:text-primary'}`}
                >
                    SMA·BB
                </button>
                <button
                    onClick={toggleFullscreen}
                    title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                    className="p-1.5 rounded-md bg-surface/80 border border-white/10 text-textMuted hover:text-primary hover:border-primary/40 transition-all backdrop-blur-sm shadow-md"
                >
                    {isFullscreen ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 9L4 4m0 0h5m-5 0v5M15 9l5-5m0 0h-5m5 0v5M9 15l-5 5m0 0h5m-5 0v-5M15 15l5 5m0 0h-5m5 0v-5" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5M20 8V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5M20 16v4m0 0h-4m4 0l-5-5" />
                        </svg>
                    )}
                </button>
            </div>

            {/* Chart container */}
            <div ref={chartContainerRef} className="w-full h-full absolute inset-0 pb-6" />
        </div>
    );
}
