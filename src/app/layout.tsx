import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar';

export const metadata: Metadata = {
  title: 'Chrono Healer — Offline Jet Lag & Circadian Companion',
  description: 'Intelligently schedule sleep, light exposure, melatonin, caffeine, and meals to eliminate jet lag—100% offline in the air.',
  manifest: './manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Chrono Healer',
  },
  icons: {
    icon: './icon.svg',
    apple: './icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#07090E',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
