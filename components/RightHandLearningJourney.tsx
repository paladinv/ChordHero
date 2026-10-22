"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { RightHandExercise } from "../lib/rightHandExercises";
import { playRecordedBackingPulse, playRecordedClick, playRecordedGuitarStep, preloadRightHandAudio } from "../lib/recordedAudio";
import { readPracticeAudioPreferences, rightHandSubdivisionsPerBeat } from "../lib/rightHandPracticeRuntime";
import { PRACTICE_STATE_EVENT, readPracticePlatformState } from "../lib/practicePlatform";
import { memoryCallPattern, phrasingBars, rightHandReviewQueue } from "../lib/rightHandLearning";
import { PICK_ROUTES, stringCrossings } from "../lib/rightHandPracticeRefinement";

const RightHandLocalTools = dynamic(() => import("./RightHandLocalTools"), { ssr: false });
const RightHandTransferCheck = dynamic(() => import("./RightHandTransferCheck"), { ssr: false });
const RightHandQuickStart = dynamic(() => import("./RightHandQuickStart"), { ssr: false });
const RightHandTrends = dynamic(() => import("./RightHandTrends"), { ssr: false });
type Props = { exercise: RightHandExercise; bpm: number; progressionId: string; chordProgression: string[]; audioAllowed: boolean; onApplyTransfer: (bpm: number, progressionId: string) => void; onApplyTempo: (bpm: number) => void; onSelectExercise: (exercise: RightHandExercise) => void; onPause: () => void; onRecord: () => void };
type Phase = "idle" | "loading" | "count in" | "listen" | "prepare" | "respond" | "phrase" | "complete";

export default function RightHandLearningJourney(props: Props) {
  const [tab, setTab] = useState("start");
  const [comfort, setComfort] = useState(60);
  const [tapped, setTapped] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [beat, setBeat] = useState(0);
  const [bars, setBars] = useState<4 | 8>(4);
  const [reflection, setReflection] = useState("");
  const [route, setRoute] = useState<"alternate" | "economy">("alternate");
  const [thumbVolume, setThumbVolume] = useState(45);
  const [fingerVolume, setFingerVolume] = useState(85);
  const [events, setEvents] = useState(() => readPracticePlatformState().events);
  const contextRef = useRef<AudioContext | null>(null);
  const timersRef = useRef<number[]>([]);
  const generationRef = useRef(0);
  const tapsRef = useRef<number[]>([]);
  const progressionKey = props.chordProgression.join("|");
  const phrasePreview = phrasingBars(4, props.chordProgression).map((bar) => bar.chord).join("–");
  const stop = () => {
    generationRef.current += 1;
    timersRef.current.forEach(window.clearTimeout); timersRef.current = [];
    const context = contextRef.current; contextRef.current = null;
    if (context && context.state !== "closed") void context.close();
    setPhase("idle"); setBeat(0);
  };
  const stopRef = useRef(stop); stopRef.current = stop;
  useEffect(() => {
    const refresh = () => setEvents(readPracticePlatformState().events);
    const silence = () => stopRef.current();
    window.addEventListener(PRACTICE_STATE_EVENT, refresh);
    window.addEventListener("chord-hero:right-hand-storage", refresh);
    window.addEventListener("chord-hero:right-hand-capture", silence);
    window.addEventListener("chord-hero:right-hand-live-mic", silence);
    return () => { window.removeEventListener(PRACTICE_STATE_EVENT, refresh); window.removeEventListener("chord-hero:right-hand-storage", refresh); window.removeEventListener("chord-hero:right-hand-capture", silence); window.removeEventListener("chord-hero:right-hand-live-mic", silence); stopRef.current(); };
  }, []);
  useEffect(() => { stopRef.current(); }, [props.exercise.id]);
  useEffect(() => { stopRef.current(); }, [props.bpm, progressionKey]);
  const schedule = (callback: () => void, seconds: number) => { timersRef.current.push(window.setTimeout(callback, seconds * 1000)); };
  const complete = () => { setPhase("complete"); const context = contextRef.current; contextRef.current = null; if (context && context.state !== "closed") void context.close(); };
  const run = async (kind: "memory" | "phrase" | "crossing" | "balance") => {
    if (!props.audioAllowed) { setReflection("Close the recording coach before playing a reference."); return; }
    stop(); props.onPause(); setReflection(""); setPhase("loading");
    const generation = generationRef.current;
    const context = new AudioContext(); contextRef.current = context;
    try {
      await context.resume(); await preloadRightHandAudio(context);
      if (generation !== generationRef.current) return;
      const preferences = readPracticeAudioPreferences();
      if (preferences.audioMuted || preferences.audioVolume <= 0) throw new Error("Turn on practice audio to hear the reference.");
      const beatSeconds = 60 / props.bpm;
      const start = context.currentTime + .1;
      const volume = preferences.audioVolume * .2;
      setPhase("count in");
      for (let index = 0; index < 4; index++) {
        void playRecordedClick(context, { accent: index === 0, volume, when: start + index * beatSeconds });
        schedule(() => setBeat(index + 1), .1 + index * beatSeconds);
      }
      if (kind === "crossing" || kind === "balance") {
        const groups = kind === "crossing" ? PICK_ROUTES[route].map((token) => [{ token, gain: 1 }]) : [
          [{ token: "P6", gain: thumbVolume / 100 }, { token: "m2", gain: fingerVolume / 100 }], [{ token: "i3", gain: fingerVolume / 100 }],
          [{ token: "P4", gain: thumbVolume / 100 }, { token: "a1", gain: fingerVolume / 100 }], [{ token: "m2", gain: fingerVolume / 100 }],
          [{ token: "P6", gain: thumbVolume / 100 }, { token: "m2", gain: fingerVolume / 100 }], [{ token: "i3", gain: fingerVolume / 100 }],
          [{ token: "P4", gain: thumbVolume / 100 }, { token: "a1", gain: fingerVolume / 100 }], [{ token: "m2", gain: fingerVolume / 100 }]
        ];
        schedule(() => setPhase("listen"), .1 + 4 * beatSeconds);
        const sounded = await Promise.all(groups.flatMap((group, index) => group.filter(({ gain }) => gain > 0).map(({ token, gain }) => playRecordedGuitarStep(context, { token, technique: kind === "crossing" ? "plectrum" : "fingerpicking", accent: false, volume: volume * gain, when: start + (4 + index / 2) * beatSeconds }))));
        if (sounded.some((value) => !value)) throw new Error("Reference audio did not load fully. Retry after preparing the offline bundle.");
        if (generation !== generationRef.current) return;
        schedule(complete, .1 + 8 * beatSeconds);
      } else if (kind === "memory") {
        const perBeat = rightHandSubdivisionsPerBeat(props.exercise.subdivision);
        const tokens = memoryCallPattern(props.exercise);
        const duration = tokens.length / perBeat * beatSeconds;
        schedule(() => setPhase("listen"), .1 + 4 * beatSeconds);
        const sounded = await Promise.all(tokens.map((token, index) => playRecordedGuitarStep(context, { token, technique: props.exercise.technique, accent: token.endsWith("!"), volume, when: start + 4 * beatSeconds + index / perBeat * beatSeconds })));
        if (sounded.filter(Boolean).length !== tokens.filter((token) => token !== "·").length) throw new Error("Reference audio did not load fully. Check your connection or offline bundle.");
        if (generation !== generationRef.current) return;
        schedule(() => setPhase("prepare"), .1 + 4 * beatSeconds + duration);
        for (let index = 0; index < 4; index++) {
          void playRecordedClick(context, { accent: index === 0, volume, when: start + 4 * beatSeconds + duration + index * beatSeconds });
          schedule(() => setBeat(4 - index), .1 + 4 * beatSeconds + duration + index * beatSeconds);
        }
        schedule(() => setPhase("respond"), .1 + 8 * beatSeconds + duration);
        schedule(complete, .1 + 8 * beatSeconds + duration * 2);
      } else {
        const phrase = phrasingBars(bars, props.chordProgression);
        const tasks: Promise<unknown>[] = [];
        phrase.forEach((bar, barIndex) => {
          const when = start + (4 + barIndex * 4) * beatSeconds;
          tasks.push(playRecordedBackingPulse(context, bar.chord, when, volume * .45));
          bar.tokens.forEach((token, index) => tasks.push(playRecordedGuitarStep(context, { token, technique: "strumming", accent: token.endsWith("!"), volume, when: when + index * beatSeconds / 2 })));
          schedule(() => { setPhase("phrase"); setBeat(barIndex + 1); }, .1 + (4 + barIndex * 4) * beatSeconds);
        });
        const sounded = await Promise.all(tasks);
        const expected = phrase.length + phrase.reduce((sum, bar) => sum + bar.tokens.filter((token) => token !== "·").length, 0);
        if (sounded.filter(Boolean).length !== expected) throw new Error("Phrase audio did not load fully. Check your connection or offline bundle.");
        if (generation !== generationRef.current) return;
        schedule(complete, .1 + (4 + bars * 4) * beatSeconds);
      }
    } catch (error) { if (generation === generationRef.current) { stop(); setReflection(error instanceof Error ? error.message : "Audio unavailable. Please retry."); } }
  };
  const queue = rightHandReviewQueue(events);
  const hidden = phase === "respond" || phase === "prepare";
  return <section className="right-hand-learning" data-response-hidden={hidden} aria-label="Learning journey">
    <nav className="right-hand-advanced-nav" aria-label="Learning journey sections">{[["start", "Quick start"], ["memory", "Hear & repeat"], ["phrase", "Phrasing"], ["technique", "Crossing & balance"], ["transfer", "Transfer check"], ["review", "Spaced review"], ["local", "Offline & teacher"]].map(([id, label]) => <button type="button" key={id} aria-pressed={tab === id} className={tab === id ? "active" : ""} onClick={() => { stop(); setTab(id); }}>{label}</button>)}</nav>
    {tab === "technique" ? <div className="learning-card"><h3>String-crossing map</h3><p>1 is thinnest, 6 thickest. The selected drill stays unchanged; these two authored routes compare the same eight-note phrase.</p>{stringCrossings(props.exercise.pattern).length ? <ol>{stringCrossings(props.exercise.pattern).map((item) => <li key={item.step}>Step {item.step + 1}→{item.step + 2}: string {item.from}→{item.to}, {item.direction}, {item.strokes}{item.skip ? " · string skip" : ""}</li>)}</ol> : <p>Select a plectrum crossing drill to map its written contacts.</p>}<label>Compare pick route<select value={route} onChange={(event) => setRoute(event.target.value as typeof route)}><option value="alternate">Strict alternate · D U D U</option><option value="economy">Economy · follow crossing direction</option></select></label><code>{PICK_ROUTES[route].join(" ")}</code><p>Economy uses D as strings get thinner and U as they get thicker, including a direction change at the turnaround. Alternate changes stroke on every note. Listen for the same rhythm; audio alone does not prove the stroke used.</p><button type="button" disabled={phase !== "idle" && phase !== "complete"} onClick={() => void run("crossing")}>Hear route phrase with count-in</button><h3>Thumb under a singing melody</h3><p>Keep the bass quieter while the finger melody stays forward. The demo schedules bass and melody as separate sound layers, including simultaneous pinches.</p><label>Thumb target {thumbVolume}%<input type="range" min={0} max={100} value={thumbVolume} onChange={(event) => setThumbVolume(Number(event.target.value))} /></label><label>Finger melody target {fingerVolume}%<input type="range" min={0} max={100} value={fingerVolume} onChange={(event) => setFingerVolume(Number(event.target.value))} /></label><code>P6+m2 · i3 · P4+a1 · m2 · P6+m2 · i3 · P4+a1 · m2</code><div className="learning-actions"><button type="button" disabled={phase !== "idle" && phase !== "complete"} onClick={() => void run("balance")}>Hear separate-layer balance demo</button><button type="button" onClick={stop}>Stop</button></div><p role="status">{phase} {reflection}</p><small>These are listening targets, not microphone measurements. A single polyphonic mic cannot reliably separate thumb and finger loudness; compare your take by ear.</small></div> : null}
    {tab === "transfer" ? <RightHandTransferCheck exercise={props.exercise} bpm={props.bpm} progressionId={props.progressionId} chordProgression={props.chordProgression} onApply={props.onApplyTransfer} onRecord={() => { stop(); props.onRecord(); }} /> : null}
    {tab === "start" ? <div className="learning-card"><RightHandQuickStart exercise={props.exercise} bpm={tapped ? Math.max(40, Math.round(tapped * .8)) : comfort} progressionId={props.chordProgression.length ? props.progressionId : "gcd"} disabled={!props.audioAllowed} /><details><summary>Find a comfortable tempo or start one round</summary><p>↓ / D = downstroke; ↑ / U = upstroke; · = keep moving silently; ! = accent. String 1 is thinnest. p / i / m / a = thumb / index / middle / ring.</p><label>How comfortable are you?<select value={comfort} onChange={(event) => setComfort(Number(event.target.value))}><option value={48}>Brand new · 48 BPM</option><option value={60}>Some experience · 60 BPM</option><option value={76}>Comfortable pulse · 76 BPM</option></select></label><button type="button" onClick={() => { const now = performance.now(); const taps = [...tapsRef.current.filter((time) => now - time < 3000), now].slice(-5); tapsRef.current = taps; if (taps.length >= 3) setTapped(Math.max(40, Math.min(180, Math.round(60000 / ((now - taps[0]) / (taps.length - 1)))))); }}>Tap a relaxed pulse {tapped ? `· ${tapped} BPM` : "(at least 3 taps)"}</button><p>Suggested {tapped ? Math.max(40, Math.round(tapped * .8)) : comfort} BPM. This is a comfort suggestion, not a measured accuracy score.</p><button type="button" disabled={!props.audioAllowed} onClick={() => props.onApplyTempo(tapped ? Math.max(40, Math.round(tapped * .8)) : comfort)}>Apply tempo & start one round</button></details></div> : null}
    {tab === "memory" || tab === "phrase" ? <div className="learning-card"><h3>{tab === "memory" ? "Listen once. Answer from memory." : "Make a musical sentence"}</h3><p>{tab === "memory" ? "Hear the first bar of the selected drill, wait for four countdown clicks, then reproduce it in silence. No moving prompts during your answer." : `A four- or eight-bar ${phrasePreview} phrase from the selected progression. Change chords at each bar; leave the written spaces silent. The last bar resolves and rests.`}</p>{tab === "phrase" ? <label>Phrase length<select disabled={phase !== "idle" && phase !== "complete"} value={bars} onChange={(event) => setBars(Number(event.target.value) as 4 | 8)}><option value={4}>4 bars</option><option value={8}>8 bars</option></select></label> : null}
      {!hidden ? <div className="phrase-score">{tab === "phrase" ? phrasingBars(bars, props.chordProgression).map((bar, index) => <span key={index} className={phase === "phrase" && beat === index + 1 ? "active" : ""}><strong>{index + 1}. {bar.chord}</strong><code>{bar.tokens.join(" ")}</code></span>) : <code>{memoryCallPattern(props.exercise).join(" ")}</code>}</div> : <p>Pattern hidden. Keep your internal pulse.</p>}
      <p role="status">{phase === "prepare" ? `Your turn in ${beat}` : phase === "respond" ? "Your turn · no visual beat prompts" : phase === "phrase" ? `Bar ${beat} / ${bars}` : phase === "count in" ? `Count in ${beat}` : phase}</p><div className="learning-actions"><button type="button" disabled={phase !== "idle" && phase !== "complete"} onClick={() => void run(tab === "memory" ? "memory" : "phrase")}>{tab === "memory" ? "Hear call & answer" : "Play phrase demo"}</button><button type="button" onClick={stop}>Stop</button><button type="button" onClick={() => { stop(); props.onRecord(); }}>Open recording review</button></div>
      {phase === "complete" ? <div><p>No automatic score was recorded. How did it feel?</p>{["Steady and relaxed", "Lost the pulse", "Repeat more slowly"].map((label) => <button type="button" key={label} aria-pressed={reflection === label} onClick={() => setReflection(label)}>{label}</button>)}</div> : null}{reflection ? <p role="status">{reflection}</p> : null}</div> : null}
    {tab === "review" ? <div className="learning-card"><h3>Return after a little time away</h3><p>Review intervals: 1 → 3 → 7 → 14 days, advancing only on separate days with accepted recorded timing ≥80%. A lower result returns to 1 day. Disputed takes are excluded.</p>{queue.length ? queue.slice(0, 6).map((item) => <div className="learning-review-row" key={item.exercise.id}><div><strong>{item.exercise.title}</strong><small>{item.due ? "Due now" : `Due ${new Date(item.dueAt).toLocaleDateString()}`} · {item.intervalDays}-day interval · {item.latest.score}% on {new Date(item.latest.practisedAt).toLocaleDateString()}</small></div><button type="button" onClick={() => props.onSelectExercise(item.exercise)}>Review drill</button></div>) : <p>Record an analyzable take to seed the queue. Self-ratings do not advance this evidence-based schedule.</p>}</div> : null}
    {tab === "local" ? <><RightHandTrends events={events} /><RightHandLocalTools exercise={props.exercise} /></> : null}
  </section>;
}
