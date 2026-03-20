import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Chrono Healer',
  description: 'Intelligently schedule sleep, light, and caffeine to beat jet lag.',
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#6366F1',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
