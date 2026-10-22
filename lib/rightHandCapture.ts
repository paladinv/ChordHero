import { useCallback, useEffect, useRef } from "react";

/** Owns every temporary microphone, clock and timer for one recording operation. */
export function useRightHandCapture(exerciseId: string) {
  const generation = useRef(0);
  const busy = useRef(false);
  const stream = useRef<MediaStream | null>(null);
  const context = useRef<AudioContext | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timers = useRef(new Set<number>());
  const cleanup = useCallback(() => {
    generation.current += 1; busy.current = false;
    timers.current.forEach(window.clearTimeout); timers.current.clear();
    if (recorder.current) { recorder.current.onstop = null; if (recorder.current.state === "recording") recorder.current.stop(); }
    recorder.current = null; stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null;
    if (context.current && context.current.state !== "closed") void context.current.close(); context.current = null;
  }, []);
  useEffect(() => cleanup, [cleanup, exerciseId]);
  const begin = () => { if (busy.current) return null; cleanup(); busy.current = true; return generation.current; };
  const valid = (token: number) => generation.current === token;
  const microphone = async (token: number) => {
    const next = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    if (!valid(token)) { next.getTracks().forEach((track) => track.stop()); return null; }
    stream.current = next; return next;
  };
  const later = (token: number, callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => { timers.current.delete(timer); if (valid(token)) callback(); }, delay);
    timers.current.add(timer); return timer;
  };
  return { begin, valid, microphone, later, cleanup, busy, stream, context, recorder };
}
