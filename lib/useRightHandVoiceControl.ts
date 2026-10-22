"use client";
import { useCallback, useState } from "react";

type Props = { onToggle: () => void; setTempo: (update: (value: number) => number) => void };
type Recognition = { continuous: boolean; lang: string; start: () => void; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null };
type RecognitionConstructor = new () => Recognition;

export function useRightHandVoiceControl({ onToggle, setTempo }: Props) {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const enableVoiceControl = useCallback(() => {
    const voiceWindow = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
    const Constructor = voiceWindow.SpeechRecognition ?? voiceWindow.webkitSpeechRecognition;
    if (!Constructor) return false;
    const recognition = new Constructor();
    recognition.continuous = true; recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript ?? "").join(" ").toLowerCase();
      if (/\b(start|play|pause|stop)\b/.test(transcript)) onToggle();
      if (/\bfaster\b/.test(transcript)) setTempo((value) => Math.min(180, value + 2));
      if (/\bslower\b/.test(transcript)) setTempo((value) => Math.max(40, value - 2));
    };
    recognition.onend = () => setVoiceEnabled(false);
    recognition.start(); setVoiceEnabled(true); return true;
  }, [onToggle, setTempo]);
  return { voiceEnabled, enableVoiceControl };
}
