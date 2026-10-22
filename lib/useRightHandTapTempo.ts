"use client";
import { useCallback, useRef } from "react";

export function useRightHandTapTempo(setTempo: (value: number) => void) {
  const taps = useRef<number[]>([]);
  return useCallback(() => {
    const now = performance.now();
    const next = [...taps.current.filter((tap) => now - tap < 2500), now].slice(-5);
    taps.current = next;
    if (next.length < 2) return;
    const gaps = next.slice(1).map((tap, index) => tap - next[index]);
    setTempo(Math.max(40, Math.min(180, Math.round(60000 / (gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length)))));
  }, [setTempo]);
}
