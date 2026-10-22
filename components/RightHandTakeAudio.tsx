"use client";
import { useEffect, useRef } from "react";
import { PRACTICE_STATE_EVENT, readPracticePlatformState } from "../lib/practicePlatform";
export default function RightHandTakeAudio({ src, label, disabled, onBeforePlay }: { src: string; label: string; disabled: boolean; onBeforePlay?: () => void | Promise<void> }) {
  const ref = useRef<HTMLAudioElement>(null);
  const isolating = useRef(false);
  useEffect(() => {
    const element = ref.current;
    const silence = () => { if (!isolating.current) ref.current?.pause(); };
    const exclusive = (event: Event) => { if ((event as CustomEvent).detail !== ref.current) silence(); };
    const preferences = () => { const audio = ref.current; if (!audio) return; const settings = readPracticePlatformState().accessibility; audio.volume = Math.max(0, Math.min(1, settings.audioVolume)); audio.muted = settings.audioMuted; if (settings.audioMuted || settings.audioVolume <= 0) silence(); };
    preferences(); window.addEventListener(PRACTICE_STATE_EVENT, preferences); window.addEventListener("chord-hero:right-hand-review-playback", exclusive); window.addEventListener("chord-hero:right-hand-capture", silence); window.addEventListener("chord-hero:right-hand-live-mic", silence);
    return () => { element?.pause(); window.removeEventListener(PRACTICE_STATE_EVENT, preferences); window.removeEventListener("chord-hero:right-hand-review-playback", exclusive); window.removeEventListener("chord-hero:right-hand-capture", silence); window.removeEventListener("chord-hero:right-hand-live-mic", silence); };
  }, [src]);
  useEffect(() => { if (disabled) ref.current?.pause(); }, [disabled]);
  return <audio ref={ref} controls preload="metadata" src={src} aria-label={label} onPlay={async () => { const audio = ref.current; const settings = readPracticePlatformState().accessibility; if (!audio) return; audio.volume = Math.max(0, Math.min(1, settings.audioVolume)); audio.muted = settings.audioMuted; if (disabled || settings.audioMuted || settings.audioVolume <= 0) { audio.pause(); return; } window.dispatchEvent(new CustomEvent("chord-hero:right-hand-review-playback", { detail: audio })); isolating.current = true; try { await onBeforePlay?.(); } catch { audio.pause(); } finally { isolating.current = false; } }} />;
}
