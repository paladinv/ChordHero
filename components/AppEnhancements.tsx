"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const AccessibilityPanel = dynamic(() => import("./AccessibilityPanel"), {
  ssr: false,
  loading: () => <div className="accessibility-panel accessibility-panel-loading" role="status">Loading controls…</div>
});

const STORAGE_KEY = "chord-hero:practice-platform:v1";

function applySavedPreferences() {
  try {
    const state = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    const preferences = state?.accessibility;
    if (!preferences) return;
    const root = document.documentElement;
    root.dataset.motion = preferences.reducedMotion ? "reduced" : "full";
    root.dataset.contrast = preferences.highContrast ? "high" : "standard";
    root.dataset.handedness = preferences.handedness === "left" ? "left" : "right";
    root.style.setProperty("--diagram-scale", String(Number(preferences.diagramScale) || 1));
    root.style.setProperty("--audio-volume", String(preferences.audioMuted ? 0 : Number(preferences.audioVolume) || 0.8));
  } catch {
    // Malformed local settings should never stop the global shell from loading.
  }
}

export default function AppEnhancements() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    applySavedPreferences();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then(() => setOfflineReady(true)).catch(() => setOfflineReady(false));
    }
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => window.removeEventListener("beforeinstallprompt", onInstall);
  }, []);

  return (
    <div className="app-enhancements">
      <button className="accessibility-trigger" type="button" onClick={() => setSettingsOpen((open) => !open)} aria-expanded={settingsOpen} aria-controls="accessibility-panel">
        <span aria-hidden="true">Aa</span> Accessibility
      </button>
      {settingsOpen ? <AccessibilityPanel offlineReady={offlineReady} installPrompt={installPrompt} onInstallHandled={() => setInstallPrompt(null)} onClose={() => setSettingsOpen(false)} /> : null}
    </div>
  );
}
