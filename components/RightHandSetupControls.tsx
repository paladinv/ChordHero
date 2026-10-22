"use client";
import LocalizedCopy from "./LocalizedCopy";
import { RIGHT_HAND_PROGRESSIONS as PROGRESSIONS, RIGHT_HAND_ROUND_OPTIONS as ROUND_OPTIONS } from "../lib/rightHandPracticePresets";

type Sound = "click" | "guitar" | "both" | "silent";
type Props = { roundSeconds: number; soundMode: Sound; progressionId: string; customProgression: string; onRound: (seconds: number) => void; onSound: (sound: Sound) => void; onProgression: (id: string) => void; onCustom: (value: string) => void };
export default function RightHandSetupControls(props: Props) {
  return <div className="session-setup" aria-label="Practice round settings">
    <div><span className="label"><LocalizedCopy id="round" /></span><div className="segmented compact">{ROUND_OPTIONS.map((option) => <button key={option.seconds} type="button" className={props.roundSeconds === option.seconds ? "active" : ""} onClick={() => props.onRound(option.seconds)}>{option.label}</button>)}</div></div>
    <div><label className="label" htmlFor="right-hand-sound">Hear</label><select id="right-hand-sound" value={props.soundMode} onChange={(event) => props.onSound(event.target.value as Sound)}><option value="both">Guitar + click</option><option value="guitar">Guitar demo</option><option value="click">Click only</option><option value="silent">Visual only</option></select></div>
    <div><label className="label" htmlFor="right-hand-backing">Chord context</label><select id="right-hand-backing" value={props.progressionId} onChange={(event) => props.onProgression(event.target.value)}>{PROGRESSIONS.map((progression) => <option key={progression.id} value={progression.id}>{progression.label}</option>)}</select></div>
    {props.progressionId === "custom" ? <div className="custom-progression-field"><label className="label" htmlFor="custom-progression">Custom chords</label><input id="custom-progression" value={props.customProgression} onChange={(event) => props.onCustom(event.target.value)} placeholder="G C Em D" aria-describedby="custom-progression-help" /><small id="custom-progression-help">2–8 chord symbols, e.g. G C Em D</small></div> : null}
  </div>;
}
