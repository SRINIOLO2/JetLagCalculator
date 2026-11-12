'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        // Service worker registration is best-effort in dev mode
      });
    }
  }, []);

  return null;
}
