'use client';

// PWA bootstrapping: registers the service worker, listens for the browser's
// `beforeinstallprompt` event so we can show an "Install" button, and renders
// a small mode/connectivity indicator. Mounted from app/layout.tsx so it's
// always active.

import { useEffect, useState, useCallback } from 'react';
import { ArrowDownToLine, WifiOff, Cloud, HardDrive } from 'lucide-react';
import { getApiMode, setApiMode, type ApiMode } from '@/lib/api';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PwaShell() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [online, setOnline] = useState(true);
  const [mode, setMode] = useState<ApiMode>('local');

  useEffect(() => {
    setOnline(navigator.onLine);
    setMode(getApiMode());

    // Register the service worker. We do this lazily so dev-mode HMR doesn't
    // get stuck behind a stale cached bundle.
    if ('serviceWorker' in navigator) {
      const swPath = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/sw.js`;
      navigator.serviceWorker.register(swPath).catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[pwa] service worker registration failed:', err);
      });
    }

    // Browser tells us when the app is installable.
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // Treat the app as installed if it's already running standalone (PWA
    // launched from the home screen / app drawer).
    if (window.matchMedia?.('(display-mode: standalone)').matches) setInstalled(true);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      const result = await installEvent.userChoice;
      if (result.outcome === 'accepted') setInstalled(true);
    } catch {
      /* user dismissed or browser rejected */
    } finally {
      setInstallEvent(null);
    }
  }, [installEvent]);

  const toggleMode = useCallback(() => {
    const next: ApiMode = mode === 'local' ? 'remote' : 'local';
    setApiMode(next);
    setMode(next);
    // Reload so any active sessions / state derived from the previous mode
    // get rebuilt against the new backend.
    window.location.reload();
  }, [mode]);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 pointer-events-auto">
      {/* Mode + online badge */}
      <button
        onClick={toggleMode}
        title={
          mode === 'local'
            ? 'Compute runs in your browser. Click to switch to the remote backend.'
            : 'Compute runs on the server. Click to switch back to local (offline-capable).'
        }
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-full bg-neutral-900/80 backdrop-blur border border-white/10 text-neutral-300 hover:text-white hover:border-white/30 transition-colors"
      >
        {mode === 'local' ? <HardDrive className="w-3.5 h-3.5" /> : <Cloud className="w-3.5 h-3.5" />}
        <span className="font-mono">{mode}</span>
        {!online && <WifiOff className="w-3.5 h-3.5 text-amber-400" aria-label="offline" />}
      </button>

      {/* Install prompt (only when the browser offers it AND we're not already
          installed). Safari iOS never fires beforeinstallprompt -- there we'd
          need to instruct the user via Share -> Add to Home Screen. */}
      {installEvent && !installed && (
        <button
          onClick={handleInstall}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full bg-primary-600/90 text-white border border-primary-400/30 hover:bg-primary-500 transition-colors shadow-lg shadow-primary-500/20"
        >
          <ArrowDownToLine className="w-3.5 h-3.5" />
          App installieren
        </button>
      )}
    </div>
  );
}
