"use client";

import { useCallback, useState } from "react";
import {
  DEFAULT_ACCESSIBILITY,
  readPracticePlatformState,
  updatePracticePlatformState,
  type AccessibilityPreferences
} from "../lib/practicePlatform";
import { LANGUAGE_OPTIONS, useLocale, type LocalePreference } from "../lib/localeClient";

type Props = {
  offlineReady: boolean;
  installPrompt: Event | null;
  onInstallHandled: () => void;
  onClose: () => void;
};

function applyPreferences(preferences: AccessibilityPreferences) {
  const root = document.documentElement;
  root.dataset.motion = preferences.reducedMotion ? "reduced" : "full";
  root.dataset.contrast = preferences.highContrast ? "high" : "standard";
  root.dataset.colorblind = preferences.colorBlindSafe ? "safe" : "standard";
  root.dataset.spacing = preferences.dyslexiaSpacing ? "wide" : "standard";
  root.dataset.handedness = preferences.handedness;
  root.style.setProperty("--diagram-scale", String(preferences.diagramScale));
  root.style.setProperty("--audio-volume", String(preferences.audioMuted ? 0 : preferences.audioVolume));
}

export default function AccessibilityPanel({ offlineReady, installPrompt, onInstallHandled, onClose }: Props) {
  const { preference, setPreference, t, formatPercent } = useLocale();
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(() => {
    if (typeof window === "undefined") return DEFAULT_ACCESSIBILITY;
    return readPracticePlatformState().accessibility;
  });

  const update = useCallback((next: Partial<AccessibilityPreferences>) => {
    setPreferences((previous) => {
      const value = { ...previous, ...next };
      applyPreferences(value);
      updatePracticePlatformState((state) => ({ ...state, accessibility: value }));
      return value;
    });
  }, []);

  const install = async () => {
    const prompt = installPrompt as Event & { prompt?: () => Promise<void> };
    await prompt.prompt?.();
    onInstallHandled();
  };

  return (
    <section className="accessibility-panel" id="accessibility-panel" aria-label={t("accessibility")}>
      <header><strong>{t("makeYours")}</strong><button type="button" onClick={onClose} aria-label={t("close")}>×</button></header>
      <label className="stacked"><span>{t("displayLanguage")}</span><select value={preference} aria-label={t("selectLanguage")} onChange={(event) => setPreference(event.target.value as LocalePreference)}>
        <option value="auto">{t("deviceLanguage")}</option>
        {LANGUAGE_OPTIONS.map(([code, name]) => <option value={code} key={code}>{name}</option>)}
      </select></label>
      <label><span>{t("reducedMotion")}</span><input type="checkbox" checked={preferences.reducedMotion} onChange={(event) => update({ reducedMotion: event.target.checked })} /></label>
      <label><span>{t("highContrast")}</span><input type="checkbox" checked={preferences.highContrast} onChange={(event) => update({ highContrast: event.target.checked })} /></label>
      <label><span>{t("colorBlindSafe")}</span><input type="checkbox" checked={preferences.colorBlindSafe} onChange={(event) => update({ colorBlindSafe: event.target.checked })} /></label>
      <label><span>{t("dyslexiaSpacing")}</span><input type="checkbox" checked={preferences.dyslexiaSpacing} onChange={(event) => update({ dyslexiaSpacing: event.target.checked })} /></label>
      <label><span>{t("leftHandedDemos")}</span><input type="checkbox" checked={preferences.handedness === "left"} onChange={(event) => update({ handedness: event.target.checked ? "left" : "right" })} /></label>
      <label className="stacked"><span>{t("diagramSize")} · {formatPercent(preferences.diagramScale)}</span><input type="range" min="0.85" max="1.35" step="0.05" value={preferences.diagramScale} onChange={(event) => update({ diagramScale: Number(event.target.value) })} /></label>
      <label className="stacked"><span>{t("audio")} · {formatPercent(preferences.audioMuted ? 0 : preferences.audioVolume)}</span><input type="range" min="0" max="1" step="0.05" value={preferences.audioVolume} disabled={preferences.audioMuted} onChange={(event) => update({ audioVolume: Number(event.target.value) })} /></label>
      <label><span>{t("muteAudio")}</span><input type="checkbox" checked={preferences.audioMuted} onChange={(event) => update({ audioMuted: event.target.checked })} /></label>
      <label><span>{t("haptics")}</span><input type="checkbox" checked={preferences.haptics} onChange={(event) => update({ haptics: event.target.checked })} /></label>
      <footer>
        <small>{offlineReady ? t("offlineReady") : t("offlinePending")}</small>
        {installPrompt ? <button type="button" onClick={() => void install()}>{t("installApp")}</button> : null}
      </footer>
    </section>
  );
}
