"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChordDiagram, { Chord } from "../../components/ChordDiagram";
import { LEVELS } from "../../lib/chords";
import { playRecordedClick } from "../../lib/recordedAudio";

type TrainerStatus = "idle" | "preview" | "countIn" | "running" | "paused" | "complete";
type FeedbackRating = "clean" | "missed" | "needsWork";
type DrillMode = "random" | "barre" | "pair";
type Pace = number | "manual";
type Subdivision = "change" | "quarter" | "eighth";

type TransitionRecord = {
  clean: number;
  missed: number;
  needsWork: number;
  score: number;
  previousScore: number;
};

type TrainerStats = {
  cleanStreak: number;
  bestCleanStreak: number;
  bestCleanRound: number;
  bestPaceSeconds: number | null;
};

type TrainerPersistence = {
  version: 1;
  transitions: Record<string, TransitionRecord>;
  stats: TrainerStats;
};

type RoundConfig = {
  length: number;
  pace: Pace;
  drillLabel: string;
};

const STORAGE_KEY = "chord-hero.trainer.v1";
const DEFAULT_STATS: TrainerStats = {
  cleanStreak: 0,
  bestCleanStreak: 0,
  bestCleanRound: 0,
  bestPaceSeconds: null
};
const DEFAULT_PERSISTENCE: TrainerPersistence = { version: 1, transitions: {}, stats: DEFAULT_STATS };
const RATING_SCORE: Record<FeedbackRating, number> = { clean: 1, needsWork: 0.45, missed: 0 };
const RATING_LABEL: Record<FeedbackRating, string> = {
  clean: "Clean",
  missed: "Missed",
  needsWork: "Needs work"
};
const TICK_MS = 120;

function clampNumber(value: unknown, minimum: number, maximum: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function parsePersistence(raw: string | null): TrainerPersistence {
  if (!raw || raw.length > 200_000) return DEFAULT_PERSISTENCE;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULT_PERSISTENCE;
    const source = parsed as Partial<TrainerPersistence>;
    const statsSource = source.stats && typeof source.stats === "object" ? source.stats : DEFAULT_STATS;
    const stats: TrainerStats = {
      cleanStreak: clampNumber(statsSource.cleanStreak, 0, 100_000, 0),
      bestCleanStreak: clampNumber(statsSource.bestCleanStreak, 0, 100_000, 0),
      bestCleanRound: clampNumber(statsSource.bestCleanRound, 0, 100, 0),
      bestPaceSeconds:
        statsSource.bestPaceSeconds === null
          ? null
          : clampNumber(statsSource.bestPaceSeconds, 2, 8, 3)
    };
    const transitions: Record<string, TransitionRecord> = {};
    if (source.transitions && typeof source.transitions === "object") {
      Object.entries(source.transitions)
        .slice(0, 500)
        .forEach(([key, value]) => {
          if (!value || typeof value !== "object" || key.length > 80) return;
          const record = value as Partial<TransitionRecord>;
          transitions[key] = {
            clean: clampNumber(record.clean, 0, 100_000, 0),
            missed: clampNumber(record.missed, 0, 100_000, 0),
            needsWork: clampNumber(record.needsWork, 0, 100_000, 0),
            score: clampNumber(record.score, 0, 1, 0.5),
            previousScore: clampNumber(record.previousScore, 0, 1, 0.5)
          };
        });
    }
    return { version: 1, transitions, stats };
  } catch {
    return DEFAULT_PERSISTENCE;
  }
}

function transitionKey(previous: Chord | null, current: Chord) {
  return `${previous?.name ?? "Start"} → ${current.name}`;
}

function weightedChoice(chords: Chord[], previous: Chord, records: Record<string, TransitionRecord>) {
  const candidates = chords.filter((chord) => chord.name !== previous.name);
  const pool = candidates.length ? candidates : chords;
  const weighted = pool.map((chord) => {
    const record = records[transitionKey(previous, chord)];
    if (!record) return { chord, weight: 1.5 };
    const attempts = record.clean + record.missed + record.needsWork;
    const difficulty = attempts ? (record.missed * 1.25 + record.needsWork * 0.7) / attempts : 0.5;
    return { chord, weight: Math.max(0.35, 0.55 + difficulty * 4 + (1 - record.score)) };
  });
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let target = Math.random() * total;
  for (const item of weighted) {
    target -= item.weight;
    if (target <= 0) return item.chord;
  }
  return weighted[weighted.length - 1].chord;
}

function buildSequence(
  chords: Chord[],
  length: number,
  records: Record<string, TransitionRecord>,
  pair: [Chord, Chord] | null
) {
  if (pair) return Array.from({ length }, (_, index) => pair[index % 2]);
  if (!chords.length) return [];
  const sequence = [chords[Math.floor(Math.random() * chords.length)]];
  while (sequence.length < length) {
    sequence.push(weightedChoice(chords, sequence[sequence.length - 1], records));
  }
  return sequence;
}

function summarizeFeedback(feedback: Record<number, FeedbackRating>) {
  return Object.values(feedback).reduce(
    (summary, rating) => ({ ...summary, [rating]: summary[rating] + 1 }),
    { clean: 0, missed: 0, needsWork: 0 }
  );
}

export default function TrainerPage() {
  const [status, setStatus] = useState<TrainerStatus>("idle");
  const [levelIndex, setLevelIndex] = useState(0);
  const [roundLength, setRoundLength] = useState(10);
  const [pace, setPace] = useState<Pace>(3);
  const [drillMode, setDrillMode] = useState<DrillMode>("random");
  const [pairFrom, setPairFrom] = useState("");
  const [pairTo, setPairTo] = useState("");
  const [previewEnabled, setPreviewEnabled] = useState(false);
  const [adaptivePacing, setAdaptivePacing] = useState(false);
  const [largeDiagrams, setLargeDiagrams] = useState(false);
  const [metronomeOn, setMetronomeOn] = useState(true);
  const [subdivision, setSubdivision] = useState<Subdivision>("change");
  const [volume, setVolume] = useState(0.25);
  const [sequence, setSequence] = useState<Chord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [countInBeat, setCountInBeat] = useState(3);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [feedback, setFeedback] = useState<Record<number, FeedbackRating>>({});
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number | null>(null);
  const [persistence, setPersistence] = useState<TrainerPersistence>(DEFAULT_PERSISTENCE);
  const [roundConfig, setRoundConfig] = useState<RoundConfig>({ length: 10, pace: 3, drillLabel: "Random level" });
  const [pausedFrom, setPausedFrom] = useState<"countIn" | "running">("running");

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deadlineRef = useRef(0);
  const resumeRemainingRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const persistenceRef = useRef(DEFAULT_PERSISTENCE);
  const persistenceLoadedRef = useRef(false);
  const feedbackRef = useRef<Record<number, FeedbackRating>>({});
  const ratedIndicesRef = useRef(new Set<number>());
  const roundFinishedRef = useRef(false);
  const runtimePaceRef = useRef(3);
  const cleanRecoveryRef = useRef(0);
  const metronomeRef = useRef({ on: true, subdivision: "change" as Subdivision, volume: 0.25 });

  const activeLevel = LEVELS[levelIndex];
  const chordNames = useMemo(() => activeLevel.chords.map((chord) => chord.name), [activeLevel.chords]);
  const effectivePairFrom = chordNames.includes(pairFrom) ? pairFrom : chordNames[0] ?? "";
  const effectivePairTo =
    chordNames.includes(pairTo) && pairTo !== effectivePairFrom
      ? pairTo
      : chordNames.find((name) => name !== effectivePairFrom) ?? effectivePairFrom;
  const currentChord = currentIndex >= 0 ? sequence[currentIndex] ?? null : null;
  const previousChord = currentIndex > 0 ? sequence[currentIndex - 1] : null;
  const history = currentIndex >= 0 ? sequence.slice(0, currentIndex + 1) : [];
  const selectedChord = selectedHistoryIndex === null ? null : sequence[selectedHistoryIndex] ?? null;
  const settingsLocked = status !== "idle";

  useEffect(() => {
    metronomeRef.current = { on: metronomeOn, subdivision, volume };
  }, [metronomeOn, subdivision, volume]);

  const ensurePersistenceLoaded = useCallback(() => {
    if (persistenceLoadedRef.current) return persistenceRef.current;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Privacy modes can expose localStorage while rejecting reads.
    }
    const loaded = parsePersistence(stored);
    persistenceLoadedRef.current = true;
    persistenceRef.current = loaded;
    setPersistence(loaded);
    return loaded;
  }, []);

  const savePersistence = useCallback((next: TrainerPersistence) => {
    persistenceRef.current = next;
    setPersistence(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Training remains fully usable when storage is unavailable or full.
    }
  }, []);

  const ensureAudioContext = useCallback(async () => {
    if (!audioContextRef.current) audioContextRef.current = new AudioContext();
    if (audioContextRef.current.state === "suspended") await audioContextRef.current.resume();
    return audioContextRef.current;
  }, []);

  const playClick = useCallback(
    async (accent = false) => {
      const settings = metronomeRef.current;
      if (!settings.on) return;
      try {
        const context = await ensureAudioContext();
        const played = await playRecordedClick(context, { accent, volume: settings.volume });
        if (played) return;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "square";
        oscillator.frequency.value = accent ? 1200 : 900;
        gain.gain.value = 0.0001;
        oscillator.connect(gain);
        gain.connect(context.destination);
        const now = context.currentTime;
        gain.gain.exponentialRampToValueAtTime(Math.max(0.02, settings.volume), now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
        oscillator.start(now);
        oscillator.stop(now + 0.09);
      } catch {
        // Audio is optional; browser policy must not stop a practice round.
      }
    },
    [ensureAudioContext]
  );

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const finishRound = useCallback(() => {
    if (roundFinishedRef.current) return;
    roundFinishedRef.current = true;
    clearTimer();
    setSecondsLeft(0);
    const summary = summarizeFeedback(feedbackRef.current);
    const current = persistenceRef.current;
    const successful = summary.missed === 0 && summary.clean >= Math.ceil(roundConfig.length * 0.8);
    const bestPaceSeconds =
      successful && typeof roundConfig.pace === "number"
        ? current.stats.bestPaceSeconds === null
          ? roundConfig.pace
          : Math.min(current.stats.bestPaceSeconds, roundConfig.pace)
        : current.stats.bestPaceSeconds;
    savePersistence({
      ...current,
      stats: {
        ...current.stats,
        bestCleanRound: Math.max(current.stats.bestCleanRound, summary.clean),
        bestPaceSeconds
      }
    });
    setStatus("complete");
  }, [clearTimer, roundConfig.length, roundConfig.pace, savePersistence]);

  useEffect(() => {
    clearTimer();
    if (status === "countIn") {
      const duration = resumeRemainingRef.current ?? 1000;
      resumeRemainingRef.current = null;
      deadlineRef.current = Date.now() + duration;
      void playClick(countInBeat === 3);
      const tick = () => {
        const remaining = deadlineRef.current - Date.now();
        if (remaining <= 0) {
          if (countInBeat > 1) setCountInBeat((beat) => beat - 1);
          else {
            setCurrentIndex(0);
            setStatus("running");
          }
          return;
        }
        timerRef.current = setTimeout(tick, Math.min(TICK_MS, remaining));
      };
      timerRef.current = setTimeout(tick, Math.min(TICK_MS, duration));
      return clearTimer;
    }

    if (status !== "running" || currentIndex < 0) return;
    if (roundConfig.pace === "manual") {
      setSecondsLeft(0);
      void playClick(true);
      return;
    }

    const duration = resumeRemainingRef.current ?? runtimePaceRef.current * 1000;
    resumeRemainingRef.current = null;
    const startedAt = Date.now();
    deadlineRef.current = startedAt + duration;
    let lastDisplayedSecond = Math.ceil(duration / 1000);
    let lastSubdivisionBeat = 0;
    setSecondsLeft(lastDisplayedSecond);
    void playClick(true);

    const tick = () => {
      const now = Date.now();
      const remaining = Math.max(0, deadlineRef.current - now);
      const displayedSecond = Math.ceil(remaining / 1000);
      if (displayedSecond !== lastDisplayedSecond) {
        lastDisplayedSecond = displayedSecond;
        setSecondsLeft(displayedSecond);
      }

      const division = metronomeRef.current.subdivision;
      const beatDuration = division === "eighth" ? 500 : division === "quarter" ? 1000 : 0;
      if (beatDuration) {
        const beat = Math.floor((now - startedAt) / beatDuration);
        if (beat > lastSubdivisionBeat) {
          lastSubdivisionBeat = beat;
          void playClick(false);
        }
      }

      if (remaining <= 0) {
        if (currentIndex + 1 < sequence.length) setCurrentIndex((index) => index + 1);
        else finishRound();
        return;
      }
      timerRef.current = setTimeout(tick, Math.min(TICK_MS, remaining));
    };
    timerRef.current = setTimeout(tick, Math.min(TICK_MS, duration));
    return clearTimer;
  }, [clearTimer, countInBeat, currentIndex, finishRound, playClick, roundConfig.pace, sequence.length, status]);

  useEffect(() => () => {
    clearTimer();
    void audioContextRef.current?.close();
  }, [clearTimer]);

  const beginCountIn = useCallback(() => {
    resumeRemainingRef.current = null;
    setCountInBeat(3);
    setStatus("countIn");
  }, []);

  const startRound = useCallback(async () => {
    const saved = ensurePersistenceLoaded();
    if (metronomeOn) await ensureAudioContext();
    const barreChords = activeLevel.chords.filter((chord) => Boolean(chord.barre));
    const drillChords = drillMode === "barre" && barreChords.length ? barreChords : activeLevel.chords;
    const fromChord = activeLevel.chords.find((chord) => chord.name === effectivePairFrom);
    const toChord = activeLevel.chords.find((chord) => chord.name === effectivePairTo);
    const pair = drillMode === "pair" && fromChord && toChord ? ([fromChord, toChord] as [Chord, Chord]) : null;
    const nextSequence = buildSequence(drillChords, roundLength, saved.transitions, pair);
    const drillLabel =
      drillMode === "pair"
        ? `${effectivePairFrom} → ${effectivePairTo}`
        : drillMode === "barre"
          ? barreChords.length
            ? "Barre chords"
            : "Random level (no barre chords in this level)"
          : "Adaptive random level";
    const nextConfig = { length: roundLength, pace, drillLabel };
    setRoundConfig(nextConfig);
    setSequence(nextSequence);
    setCurrentIndex(-1);
    setFeedback({});
    feedbackRef.current = {};
    ratedIndicesRef.current = new Set();
    roundFinishedRef.current = false;
    runtimePaceRef.current = typeof pace === "number" ? pace : 3;
    cleanRecoveryRef.current = 0;
    setSelectedHistoryIndex(null);
    setSecondsLeft(0);
    if (previewEnabled) setStatus("preview");
    else beginCountIn();
  }, [activeLevel.chords, beginCountIn, drillMode, effectivePairFrom, effectivePairTo, ensureAudioContext, ensurePersistenceLoaded, metronomeOn, pace, previewEnabled, roundLength]);

  const resetRound = useCallback(() => {
    clearTimer();
    resumeRemainingRef.current = null;
    roundFinishedRef.current = false;
    setStatus("idle");
    setSequence([]);
    setCurrentIndex(-1);
    setSecondsLeft(0);
    setFeedback({});
    feedbackRef.current = {};
    ratedIndicesRef.current = new Set();
    setSelectedHistoryIndex(null);
  }, [clearTimer]);

  const pauseRound = () => {
    if (status !== "running" && status !== "countIn") return;
    resumeRemainingRef.current = Math.max(1, deadlineRef.current - Date.now());
    setPausedFrom(status);
    setStatus("paused");
  };

  const resumeRound = () => setStatus(pausedFrom);

  const rateCurrentChord = (rating: FeedbackRating) => {
    if (!currentChord || currentIndex < 0 || ratedIndicesRef.current.has(currentIndex)) return;
    ratedIndicesRef.current.add(currentIndex);
    const loaded = ensurePersistenceLoaded();
    const key = transitionKey(previousChord, currentChord);
    const oldRecord = loaded.transitions[key] ?? {
      clean: 0,
      missed: 0,
      needsWork: 0,
      score: 0.5,
      previousScore: 0.5
    };
    const nextRecord: TransitionRecord = {
      ...oldRecord,
      clean: oldRecord.clean + (rating === "clean" ? 1 : 0),
      missed: oldRecord.missed + (rating === "missed" ? 1 : 0),
      needsWork: oldRecord.needsWork + (rating === "needsWork" ? 1 : 0),
      previousScore: oldRecord.score,
      score: oldRecord.score * 0.75 + RATING_SCORE[rating] * 0.25
    };
    const nextStreak = rating === "clean" ? loaded.stats.cleanStreak + 1 : 0;
    const nextPersistence: TrainerPersistence = {
      version: 1,
      transitions: { ...loaded.transitions, [key]: nextRecord },
      stats: {
        ...loaded.stats,
        cleanStreak: nextStreak,
        bestCleanStreak: Math.max(loaded.stats.bestCleanStreak, nextStreak)
      }
    };
    const nextFeedback = { ...feedbackRef.current, [currentIndex]: rating };
    feedbackRef.current = nextFeedback;
    setFeedback(nextFeedback);
    savePersistence(nextPersistence);

    if (adaptivePacing && typeof roundConfig.pace === "number") {
      if (rating === "missed") {
        runtimePaceRef.current = Math.min(8, runtimePaceRef.current + 1);
        cleanRecoveryRef.current = 0;
      } else if (rating === "needsWork") {
        runtimePaceRef.current = Math.min(8, runtimePaceRef.current + 0.5);
        cleanRecoveryRef.current = 0;
      } else {
        cleanRecoveryRef.current += 1;
        if (cleanRecoveryRef.current >= 3) {
          runtimePaceRef.current = Math.max(roundConfig.pace, runtimePaceRef.current - 0.5);
          cleanRecoveryRef.current = 0;
        }
      }
    }
  };

  const feedbackSummary = useMemo(() => summarizeFeedback(feedback), [feedback]);
  const flaggedTransitions = useMemo(
    () =>
      Object.entries(feedback)
        .filter(([, rating]) => rating !== "clean")
        .map(([index, rating]) => {
          const sequenceIndex = Number(index);
          return {
            key: transitionKey(sequence[sequenceIndex - 1] ?? null, sequence[sequenceIndex]),
            rating
          };
        }),
    [feedback, sequence]
  );
  const mostImproved = useMemo(() => {
    const entries = Object.entries(persistence.transitions).filter(([key]) => !key.startsWith("Start "));
    return entries.sort(([, left], [, right]) => right.score - right.previousScore - (left.score - left.previousScore))[0];
  }, [persistence.transitions]);
  const recommendedAction = flaggedTransitions.length
    ? `Repeat ${flaggedTransitions[0].key} as a focused pair at a comfortable pace.`
    : Object.keys(feedback).length < roundConfig.length
      ? "Rate every change next round so adaptive practice can target weak transitions."
      : "No weak changes flagged. Try the next faster pace or a longer round.";

  const statusLabel =
    status === "running"
      ? roundConfig.pace === "manual"
        ? "Manual"
        : "Live"
      : status === "countIn"
        ? `Count-in ${countInBeat}`
        : status === "paused"
          ? "Paused"
          : status === "preview"
            ? "Preview"
            : "Ready";

  return (
    <main className={`page focused-page trainer-page ${largeDiagrams ? "trainer-large-diagrams" : ""}`}>
      <section className="studio-heading trainer-heading">
        <div>
          <span className="tag">Trainer</span>
          <h1>Practice the transitions that need you most.</h1>
          <p>Build an adaptive round, mark each change honestly, and turn every miss into the next useful drill.</p>
        </div>
        <div className="studio-session-note" aria-label="Trainer format">
          <span className="label">Round format</span>
          <strong>{pace === "manual" ? "Manual pace" : `${pace} seconds`} · {roundLength} chords</strong>
          <span>Defaults stay at 3 seconds and 10 chords. Accuracy still comes first.</span>
        </div>
      </section>

      <section className="panel trainer-workspace">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Level {levelIndex + 1}: {activeLevel.name}</p>
            <h2>{activeLevel.description}</h2>
          </div>
          <div className="status" aria-live="polite">
            <span className="badge">{Math.max(0, currentIndex + 1)}/{roundConfig.length}</span>
            <span className={`badge ${status === "running" ? "live" : ""}`}>{statusLabel}</span>
            <span className="badge muted">
              {status === "running" && typeof roundConfig.pace === "number" ? `${secondsLeft}s remaining` : roundConfig.drillLabel}
            </span>
          </div>
        </div>

        <div className="trainer-settings-grid" aria-label="Round setup">
          <label>Level
            <select value={levelIndex} onChange={(event) => setLevelIndex(Number(event.target.value))} disabled={settingsLocked}>
              {LEVELS.map((level, index) => <option key={level.name} value={index}>{level.name}</option>)}
            </select>
          </label>
          <label>Round length
            <select value={roundLength} onChange={(event) => setRoundLength(Number(event.target.value))} disabled={settingsLocked}>
              {[5, 10, 20].map((length) => <option key={length} value={length}>{length} chords</option>)}
            </select>
          </label>
          <label>Pace
            <select value={pace} onChange={(event) => setPace(event.target.value === "manual" ? "manual" : Number(event.target.value))} disabled={settingsLocked}>
              <option value="manual">Manual / non-timed</option>
              {[2, 3, 4, 5, 6, 7, 8].map((seconds) => <option key={seconds} value={seconds}>{seconds} seconds</option>)}
            </select>
          </label>
          <label>Drill
            <select value={drillMode} onChange={(event) => setDrillMode(event.target.value as DrillMode)} disabled={settingsLocked}>
              <option value="random">Adaptive random level</option>
              <option value="barre">Barre chords only</option>
              <option value="pair">Focused chord pair</option>
            </select>
          </label>
          {drillMode === "pair" && <>
            <label>From
              <select value={effectivePairFrom} onChange={(event) => setPairFrom(event.target.value)} disabled={settingsLocked}>
                {chordNames.map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
            <label>To
              <select value={effectivePairTo} onChange={(event) => setPairTo(event.target.value)} disabled={settingsLocked}>
                {chordNames.filter((name) => name !== effectivePairFrom).map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
          </>}
        </div>

        <div className="trainer-options">
          <label><input type="checkbox" checked={previewEnabled} onChange={(event) => setPreviewEnabled(event.target.checked)} disabled={settingsLocked} /> Preview sequence first</label>
          <label><input type="checkbox" checked={adaptivePacing} onChange={(event) => setAdaptivePacing(event.target.checked)} disabled={settingsLocked || pace === "manual"} /> Slow down after misses</label>
          <label><input type="checkbox" checked={largeDiagrams} onChange={(event) => setLargeDiagrams(event.target.checked)} /> Large diagrams</label>
        </div>

        {status === "preview" ? (
          <div className="trainer-preview" aria-label="Round preview">
            <div><span className="label">Sequence preview</span><h3>Review the route before the count-in.</h3></div>
            <ol>{sequence.map((chord, index) => <li key={`${chord.name}-${index}`}><span>{index + 1}</span>{chord.name}</li>)}</ol>
            <button className="btn primary" onClick={beginCountIn}>Begin 3-beat count-in</button>
          </div>
        ) : status === "countIn" ? (
          <div className="trainer-count-in" role="timer" aria-live="assertive">
            <span>Get ready</span><strong>{countInBeat}</strong><p>First chord: {sequence[0]?.name}</p>
          </div>
        ) : (
          <div className="trainer-transition-stage" key={currentIndex}>
            <div className="trainer-previous-chord">
              <span className="label">Previous</span>
              <h3>{previousChord?.name ?? (currentChord ? "Start" : "—")}</h3>
              {previousChord ? <ChordDiagram chord={previousChord} largeChart={largeDiagrams} /> : <div className="diagram-empty" />}
            </div>
            <span className="trainer-transition-arrow" aria-hidden="true">→</span>
            <div className="trainer-current-chord">
              <span className="label">Current chord</span>
              <h3>{currentChord?.name ?? "Press start"}</h3>
              {currentChord ? <ChordDiagram chord={currentChord} largeChart={largeDiagrams} /> : <div className="diagram-empty" />}
            </div>
          </div>
        )}

        {currentChord && status !== "preview" && status !== "countIn" && (
          <div className="trainer-feedback" role="group" aria-label={`Rate ${currentChord.name}`}>
            <span className="label">How was this change?</span>
            {(["clean", "needsWork", "missed"] as FeedbackRating[]).map((rating) => (
              <button key={rating} className={`btn trainer-rating rating-${rating} ${feedback[currentIndex] === rating ? "selected" : ""}`} onClick={() => rateCurrentChord(rating)} disabled={Boolean(feedback[currentIndex]) || status === "paused"} aria-pressed={feedback[currentIndex] === rating}>{RATING_LABEL[rating]}</button>
            ))}
            {feedback[currentIndex] && <span className="trainer-feedback-saved" aria-live="polite">Saved once for this change.</span>}
          </div>
        )}

        <div className="controls trainer-controls">
          <button className="btn primary" onClick={() => void startRound()} disabled={status !== "idle"}>Start round</button>
          <button className="btn" onClick={pauseRound} disabled={status !== "running" && status !== "countIn"}>Pause</button>
          <button className="btn" onClick={resumeRound} disabled={status !== "paused"}>Resume</button>
          {roundConfig.pace === "manual" && status === "running" && <button className="btn primary" onClick={() => currentIndex + 1 < sequence.length ? setCurrentIndex((index) => index + 1) : finishRound()}>Next chord</button>}
          <button className="btn ghost" onClick={resetRound}>Reset</button>
        </div>

        <div className="trainer-metronome">
          <label><input type="checkbox" checked={metronomeOn} onChange={(event) => setMetronomeOn(event.target.checked)} /> Metronome sound</label>
          <label>Subdivision
            <select value={subdivision} onChange={(event) => setSubdivision(event.target.value as Subdivision)} disabled={!metronomeOn}>
              <option value="change">Chord changes only</option><option value="quarter">Every second</option><option value="eighth">Eighth-note pulse</option>
            </select>
          </label>
          <label>Volume <input type="range" min="0" max="0.6" step="0.05" value={volume} onChange={(event) => setVolume(Number(event.target.value))} disabled={!metronomeOn} aria-label="Metronome volume" /></label>
        </div>
      </section>

      <section className="trainer-stats" aria-label="Trainer progress">
        <div><span>Clean streak</span><strong>{persistence.stats.cleanStreak}</strong></div>
        <div><span>Best streak</span><strong>{persistence.stats.bestCleanStreak}</strong></div>
        <div><span>Best clean round</span><strong>{persistence.stats.bestCleanRound}</strong></div>
        <div><span>Fastest successful pace</span><strong>{persistence.stats.bestPaceSeconds ? `${persistence.stats.bestPaceSeconds}s` : "—"}</strong></div>
        <div><span>Most improved</span><strong>{mostImproved && mostImproved[1].score > mostImproved[1].previousScore ? mostImproved[0] : "Keep rating"}</strong></div>
      </section>

      <section className="trainer-review-grid">
        <div className="history">
          <div><h2>Chord history</h2><p>Ratings stay attached to the exact sequence item you played.</p></div>
          <div className="history-grid">
            {!history.length ? <div className="history-empty">No chords yet. Start a round to begin.</div> : history.map((chord, index) => (
              <button key={`${chord.name}-${index}`} className={`history-item ${selectedHistoryIndex === index ? "active" : ""}`} type="button" onClick={() => setSelectedHistoryIndex(index)} aria-label={`Inspect chord ${index + 1}, ${chord.name}${feedback[index] ? `, rated ${RATING_LABEL[feedback[index]]}` : ""}`}>
                <span className="history-count">{String(index + 1).padStart(2, "0")}</span><span className="history-name">{chord.name}</span>{feedback[index] && <span className={`history-rating rating-${feedback[index]}`}>{RATING_LABEL[feedback[index]]}</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="selected">
          <div><h2>Selected chord</h2><p>Review any completed change without interrupting the round.</p></div>
          <div className="selected-card"><div className="selected-info"><span className="label">Selected</span><h3>{selectedChord?.name ?? "None yet"}</h3></div><div className="diagram-wrap">{selectedChord ? <ChordDiagram chord={selectedChord} largeChart={largeDiagrams} /> : <div className="diagram-empty" />}</div></div>
        </div>
      </section>

      {status === "complete" && (
        <div className="modal trainer-recap-modal" role="dialog" aria-modal="true" aria-labelledby="trainer-recap-title">
          <div className="modal-card">
            <span className="modal-badge">Round recap</span><h2 id="trainer-recap-title">Practice complete</h2>
            <div className="trainer-recap-counts"><span><strong>{feedbackSummary.clean}</strong> Clean</span><span><strong>{feedbackSummary.needsWork}</strong> Needs work</span><span><strong>{feedbackSummary.missed}</strong> Missed</span></div>
            <p><strong>{roundConfig.drillLabel}</strong> · {roundConfig.pace === "manual" ? "Manual pace" : `${roundConfig.pace}s base pace`} · {roundConfig.length} chords</p>
            {flaggedTransitions.length > 0 && <div className="trainer-flagged"><span className="label">Flagged transitions</span><ul>{flaggedTransitions.map((item, index) => <li key={`${item.key}-${index}`}>{item.key} — {RATING_LABEL[item.rating]}</li>)}</ul></div>}
            <p className="trainer-recommendation"><strong>Recommended next:</strong> {recommendedAction}</p>
            <div className="modal-actions"><button className="btn primary" onClick={resetRound}>Adjust and practice again</button><button className="btn ghost" onClick={resetRound}>Close recap</button></div>
          </div>
        </div>
      )}
    </main>
  );
}
