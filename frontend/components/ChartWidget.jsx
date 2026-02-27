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
            crosshair: {
                mode: 1, // Magnet Mode
            },
            rightPriceScale: {
                borderColor: '#1f242f',
            },
            timeScale: {
                borderColor: '#1f242f',
                timeVisible: true,
            },
        });

        const candlestickSeries = chart.addCandlestickSeries({
            upColor: '#00e676',
            downColor: '#ff3d00',
            borderVisible: false,
            wickUpColor: '#00e676',
            wickDownColor: '#ff3d00'
        });

        chartRef.current = chart;
        seriesRef.current = candlestickSeries;

        // Handle Resize
        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                    height: chartContainerRef.current.clientHeight
                });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, []);

    // 2. Update Series Data (initial full load)
    useEffect(() => {
        if (seriesRef.current && data && data.length > 0) {
            seriesRef.current.setData(data);
            chartRef.current?.timeScale().fitContent();
        }
    }, [data]);

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
            {/* Fullscreen Toggle Button */}
            <button
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                className="absolute top-3 right-3 z-20 p-1.5 rounded-md bg-surface/80 border border-white/10 text-textMuted hover:text-primary hover:border-primary/40 transition-all backdrop-blur-sm shadow-md"
            >
                {isFullscreen ? (
                    // Compress icon
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 9L4 4m0 0h5m-5 0v5M15 9l5-5m0 0h-5m5 0v5M9 15l-5 5m0 0h5m-5 0v-5M15 15l5 5m0 0h-5m5 0v-5" />
                    </svg>
                ) : (
                    // Expand icon
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5M20 8V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5M20 16v4m0 0h-4m4 0l-5-5" />
                    </svg>
                )}
            </button>

            {/* Chart container */}
            <div ref={chartContainerRef} className="w-full h-full absolute inset-0 pb-6" />
        </div>
    );
}
