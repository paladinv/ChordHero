"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MidiTrigger = { type: "note" | "control"; number: number };
export type MidiConfig = { deviceId: "all" | string; channel: number; playPause: MidiTrigger; repeatLoop: MidiTrigger; markStep: MidiTrigger };
export type MidiInputInfo = { id: string; name: string };
export const DEFAULT_MIDI_CONFIG: MidiConfig = { deviceId: "all", channel: -1, playPause: { type: "note", number: 60 }, repeatLoop: { type: "note", number: 62 }, markStep: { type: "control", number: 20 } };
const MIDI_STORAGE_KEY = "chord-hero:right-hand:midi:v1";

type Props = { onToggle: () => void; onRepeatLoop: () => boolean; onMarkStep: () => string };
type MidiMessage = { data: Uint8Array };
type MidiInput = { id: string; name?: string; onmidimessage: ((event: MidiMessage) => void) | null };
type MidiAccess = { inputs: Map<string, MidiInput>; onstatechange?: (() => void) | null };

export function useRightHandMidi({ onToggle, onRepeatLoop, onMarkStep }: Props) {
  const [midiEnabled, setMidiEnabled] = useState(false);
  const [midiConfig, setMidiConfig] = useState<MidiConfig>(DEFAULT_MIDI_CONFIG);
  const [midiInputs, setMidiInputs] = useState<MidiInputInfo[]>([]);
  const [midiStatus, setMidiStatus] = useState("MIDI is off. Web MIDI can be configured when available.");
  const configRef = useRef(midiConfig);
  const callbacksRef = useRef({ onToggle, onRepeatLoop, onMarkStep });
  const cleanupRef = useRef<(() => void) | null>(null);
  configRef.current = midiConfig;
  callbacksRef.current = { onToggle, onRepeatLoop, onMarkStep };

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(MIDI_STORAGE_KEY) ?? "null") as Partial<MidiConfig> | null;
      if (saved && (saved.deviceId === "all" || typeof saved.deviceId === "string") && typeof saved.channel === "number") setMidiConfig((current) => ({ ...current, ...saved }));
    } catch { /* Optional local MIDI preference. */ }
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem(MIDI_STORAGE_KEY, JSON.stringify(midiConfig)); } catch { /* Optional local MIDI preference. */ }
  }, [midiConfig]);

  const disableMidi = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setMidiEnabled(false);
    setMidiStatus("MIDI is off. Web MIDI can be configured when available.");
  }, []);

  const enableMidi = useCallback(async () => {
    type MidiNavigator = Navigator & { requestMIDIAccess?: () => Promise<MidiAccess> };
    const request = (navigator as MidiNavigator).requestMIDIAccess;
    if (!request) { setMidiStatus("Web MIDI is not available in this browser."); return; }
    try {
      cleanupRef.current?.();
      const access = await request.call(navigator);
      const lastAction = new Map<string, number>();
      const trigger = (action: "playPause" | "repeatLoop" | "markStep") => {
        const now = performance.now();
        if (now - (lastAction.get(action) ?? 0) < 180) return;
        lastAction.set(action, now);
        if (action === "playPause") callbacksRef.current.onToggle();
        if (action === "repeatLoop" && !callbacksRef.current.onRepeatLoop()) setMidiStatus("Repeat ignored: mark a trouble loop first.");
        if (action === "markStep") setMidiStatus(callbacksRef.current.onMarkStep());
      };
      const bind = () => {
        access.inputs.forEach((input) => {
          input.onmidimessage = ({ data }) => {
            const [statusByte = 0, number = 0, value = 0] = data;
            const config = configRef.current;
            if (config.deviceId !== "all" && config.deviceId !== input.id) return;
            if (config.channel >= 0 && config.channel !== (statusByte & 0x0f)) return;
            const command = statusByte & 0xf0;
            if (value <= 0 || (command !== 0x90 && command !== 0xb0)) return;
            const kind = command === 0x90 ? "note" : "control";
            (Object.keys(config) as Array<keyof MidiConfig>).filter((key): key is "playPause" | "repeatLoop" | "markStep" => key !== "deviceId" && key !== "channel").forEach((action) => {
              if (config[action].type === kind && config[action].number === number) trigger(action);
            });
          };
        });
        setMidiInputs(Array.from(access.inputs.values()).map((input) => ({ id: input.id, name: input.name?.trim() || "Unnamed MIDI input" })));
      };
      bind();
      access.onstatechange = bind;
      cleanupRef.current = () => { access.inputs.forEach((input) => { input.onmidimessage = null; }); access.onstatechange = null; };
      setMidiEnabled(true);
      setMidiStatus("MIDI ready. Note-off/release messages are ignored; mappings are local to this page.");
    } catch { setMidiStatus("MIDI access could not be started. Check browser permission and device availability."); }
  }, []);

  useEffect(() => () => cleanupRef.current?.(), []);
  return { midiEnabled, midiConfig, midiInputs, midiStatus, setMidiConfig, enableMidi, disableMidi };
}
