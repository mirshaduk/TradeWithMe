'use client';
import { TradeProvider } from '../context/TradeContext';

export function Providers({ children }) {
    return (
        <TradeProvider>
            {children}
        </TradeProvider>
    );
}
