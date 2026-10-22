import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { preloadRightHandAudio } from "./recordedAudio";

/** Listening rounds are silent so the microphone cannot score the app's guitar. */
export function useRightHandAudioIsolation(contextRef: MutableRefObject<AudioContext | null>, pause: () => void) {
  const liveMic = useRef(false);
  const ensureAudio = useCallback(async () => {
    if (!contextRef.current) contextRef.current = new AudioContext();
    const context = contextRef.current;
    if (context.state === "suspended") await context.resume();
    await preloadRightHandAudio(context); return context;
  }, [contextRef]);
  const closeAudio = useCallback(async () => { pause(); const context = contextRef.current; contextRef.current = null; if (context && context.state !== "closed") await context.close(); }, [contextRef, pause]);
  const silenceForCapture = useCallback(async () => { window.dispatchEvent(new Event("chord-hero:right-hand-capture")); await closeAudio(); }, [closeAudio]);
  useEffect(() => {
    const toggle = (event: Event) => { liveMic.current = (event as CustomEvent<boolean>).detail; if (liveMic.current) void closeAudio(); };
    window.addEventListener("chord-hero:right-hand-live-mic", toggle);
    return () => window.removeEventListener("chord-hero:right-hand-live-mic", toggle);
  }, [closeAudio]);
  return { liveMic, silenceForCapture, ensureAudio };
}
