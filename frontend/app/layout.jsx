import './globals.css';
import { Providers } from './providers';

export const metadata = {
    title: 'TradeWithMe | AI Crypto Platform',
    description: 'Self-evolving AI crypto trading suggestions platform.',
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body className="bg-background text-textMain min-h-screen">
                <Providers>
                    {children}
                </Providers>
            </body>
        </html>
    );
}
