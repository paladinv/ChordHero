"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export default function RightHandTapCalibration({ disabled, offset, onChange, onBeforeStart, onActiveChange }: { disabled: boolean; offset?: number; onChange: (offset?: number) => void; onBeforeStart: () => void; onActiveChange: (active: boolean) => void }) {
  const [targets, setTargets] = useState<number[]>([]);
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState("");
  const taps = useRef<number[]>([]);
  const context = useRef<AudioContext | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const generation = useRef(0);
  const stop = useCallback(() => { generation.current++; if (timer.current) clearTimeout(timer.current); if (context.current?.state !== "closed") void context.current?.close(); context.current = null; onActiveChange(false); }, [onActiveChange]);
  useEffect(() => () => stop(), [stop]);
  useEffect(() => { if (disabled) { stop(); setTargets([]); } }, [disabled, stop]);
  const begin = async () => {
    if (context.current) return;
    onBeforeStart(); onActiveChange(true); const token = ++generation.current;
    try {
      const clock = new AudioContext(); context.current = clock;
      if (clock.state === "suspended") await clock.resume();
      if (token !== generation.current) return;
      const first = clock.currentTime + .8; const now = performance.now();
      const next = Array.from({ length: 6 }, (_, index) => now + (first - clock.currentTime + index * .65) * 1000);
      next.forEach((_, index) => {
        const oscillator = clock.createOscillator(); const gain = clock.createGain(); const at = first + index * .65;
        oscillator.frequency.value = index ? 660 : 880; gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(.18, at + .004); gain.gain.exponentialRampToValueAtTime(.0001, at + .055);
        oscillator.connect(gain).connect(clock.destination); oscillator.start(at); oscillator.stop(at + .07);
      });
      taps.current = []; setCount(0); setTargets(next); setMessage("Tap once with each of six clicks. This estimates click-to-tap compensation, including your reaction time.");
      timer.current = window.setTimeout(() => { stop(); setTargets([]); setMessage("Tap calibration ended. Try again if fewer than six taps were registered."); }, 5200);
    } catch { stop(); setTargets([]); setMessage("Timing calibration could not start on this device."); }
  };
  const tap = () => {
    if (taps.current.length >= targets.length) return;
    taps.current.push(performance.now()); setCount(taps.current.length);
    if (taps.current.length !== targets.length) return;
    const values = taps.current.map((time, index) => time - targets[index]).filter((value) => value >= 0 && value <= 500).sort((a, b) => a - b);
    stop(); setTargets([]);
    if (values.length < 4 || values[values.length - 1] - values[0] > 180) { setMessage("Taps were inconsistent. Try again once per click."); return; }
    const value = Math.round(values[Math.floor(values.length / 2)]); onChange(value);
    setMessage(`Tap compensation saved: ${value} ms. Recalibrate after changing headphones; this is an estimate, including your tap response.`);
  };
  return <div><button type="button" onClick={targets.length ? tap : () => void begin()} disabled={disabled}>{targets.length ? `Tap with click · ${count}/6` : offset === undefined ? "Calibrate timing" : `Timing offset ${offset} ms`}</button>{offset !== undefined && !targets.length ? <button type="button" disabled={disabled} onClick={() => { onChange(); setMessage("Tap compensation cleared."); }}>Clear timing offset</button> : null}<small role="status">{message}</small></div>;
}
