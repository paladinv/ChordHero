"use client";

type SectionProps = {
  selected: boolean;
  enabled: boolean;
  locked: boolean;
  section: string;
  chunkSize: 4 | 8;
  pace: number;
  needsPractice: boolean;
  onToggle: (enabled: boolean) => void;
  onSection: (section: string) => void;
  onChunk: (size: 4 | 8) => void;
  onPace: (pace: number) => void;
  onStart: () => void;
};

export function SectionDrillControls({ selected, enabled, locked, section, chunkSize, pace, needsPractice, onToggle, onSection, onChunk, onPace, onStart }: SectionProps) {
  if (!selected) return null;
  return <div className="trainer-section-drill-control">
    <label className="trainer-inline-check"><input type="checkbox" checked={enabled} onChange={(event) => onToggle(event.target.checked)} disabled={locked} /> Section-focused drill</label>
    <small>Imported songs currently expose a flat chord route, so these are named practice chunks over that route—not claimed lyric boundaries.</small>
    {enabled && <>
      <label>Section<select value={section} onChange={(event) => onSection(event.target.value)} disabled={locked}><option value="verse">Verse</option><option value="chorus">Chorus</option><option value="bridge">Bridge</option><option value="turnaround">Turnaround</option></select></label>
      <label>Chunk<select value={chunkSize} onChange={(event) => onChunk(Number(event.target.value) as 4 | 8)} disabled={locked}><option value={4}>Up to 4 chords</option><option value={8}>Up to 8 chords</option></select></label>
      <label>Section pace<select value={pace} onChange={(event) => onPace(Number(event.target.value))} disabled={locked}>{[2, 3, 4, 5, 6, 7, 8].map((seconds) => <option key={seconds} value={seconds}>{seconds}s</option>)}</select></label>
      <button className="btn primary" type="button" onClick={onStart} disabled={locked}>Start section chunk</button>
      {needsPractice && <small role="status">Checkpoint: this section is marked needs practice.</small>}
    </>}
  </div>;
}

type PositionEntry = { id: string; position: string; chordName: string };
type PositionProps = { entries: PositionEntry[]; quiz: { targetId: string; choice: string; committed: boolean } | null; onStart: () => void; onChoice: (choice: string) => void; onCommit: () => void; onReset: () => void };

export function PositionQuizCard({ entries, quiz, onStart, onChoice, onCommit, onReset }: PositionProps) {
  if (!quiz) return <article><span className="label">Fretboard position recognition</span><p>Choose the catalogued position for a chord shape, then commit to reveal the answer.</p><button className="btn" type="button" onClick={onStart} disabled={!entries.length}>Start position quiz</button></article>;
  const target = entries.find((item) => item.id === quiz.targetId);
  if (!target) return null;
  return <article><span className="label">Fretboard position recognition</span><p>Choose the catalogued position for a chord shape, then commit to reveal the answer.</p><div className="trainer-position-quiz"><strong>{target.chordName} · position hidden</strong><select value={quiz.choice} onChange={(event) => onChoice(event.target.value)} disabled={quiz.committed}><option value="">Choose a catalog position</option>{entries.map((item) => <option key={item.id} value={item.position}>{item.position}</option>)}</select><button className="btn primary" type="button" onClick={onCommit} disabled={!quiz.choice || quiz.committed}>Commit answer</button>{quiz.committed && <p role="status">Catalog answer: <strong>{target.position}</strong> · {quiz.choice === target.position ? "Correct" : `You chose ${quiz.choice}`}. This is recognition practice, not fretboard measurement.</p>}<button className="btn ghost" type="button" onClick={onReset}>Reset quiz</button></div></article>;
}

export function TransitionTensionCheck({ value, onChange }: { value?: "relaxed" | "tense"; onChange: (value: "relaxed" | "tense") => void }) {
  return <div className="trainer-tension-check" role="group" aria-label="Optional transition tension self-check"><small>Optional self-check</small><button className={`btn ghost ${value === "relaxed" ? "selected" : ""}`} type="button" onClick={() => onChange("relaxed")}>Relaxed</button><button className={`btn ghost ${value === "tense" ? "selected" : ""}`} type="button" onClick={() => onChange("tense")}>Tense</button></div>;
}

export function SectionCheckpoint({ section, length, pace, marked, onMark }: { section: string; length: number; pace: number; marked: boolean; onMark: () => void }) {
  return <div className="trainer-section-checkpoint"><span className="label">Section checkpoint</span><p>{section[0].toUpperCase()}{section.slice(1)} · {length} chord chunk · {pace}s section pace</p><button className="btn" type="button" onClick={onMark}>{marked ? "Marked needs practice" : "Mark section needs practice"}</button></div>;
}

export function VoicePromptToggle({ enabled, locked, known, supported, onChange }: { enabled: boolean; locked: boolean; known: boolean; supported: boolean; onChange: (enabled: boolean) => void }) {
  return <><label><input type="checkbox" checked={enabled} onChange={(event) => onChange(event.target.checked)} disabled={locked || !supported} /> Voice prompts (count-in and chord changes)</label>{known && !supported && <small>Voice prompts are unavailable in this browser. The metronome remains available.</small>}</>;
}

export function TensionSummary({ checks }: { checks: Record<number, "relaxed" | "tense"> }) {
  const values = Object.values(checks);
  return values.length > 0 ? <p className="trainer-evidence-note">Self-reported transition check: {values.filter((value) => value === "relaxed").length} relaxed · {values.filter((value) => value === "tense").length} tense. This is a personal check-in, not measured physical tension.</p> : null;
}

export function SectionPreviewCheckpoint({ section, length, pace }: { section: string; length: number; pace: number }) {
  return <p role="status"><strong>Chunk checkpoint:</strong> {section} · {length} imported-route chords · {pace}s pace.</p>;
}

type HistoryRound = { id: string; drill: string; date: string; pace: number | "manual"; song: string; sequence: string[]; ratings: { clean: number; needsWork: number; missed: number }; freshCount?: number | null; freshClean?: number | null; repeatCount?: number | null; repeatClean?: number | null; effort?: string | null; criteria?: string[]; criteriaChecks?: Record<number, Record<string, boolean>> };
type HistoryProps = { rounds: HistoryRound[]; search: string; drill: string; result: string; drills: string[]; locked: boolean; canReplay: boolean; onSearch: (value: string) => void; onDrill: (value: string) => void; onResult: (value: "all" | "clean" | "flagged") => void; onReplay: (round: HistoryRound) => void; onStarter: () => void };

export function HistoryPanel({ rounds, search, drill, result, drills, locked, canReplay, onSearch, onDrill, onResult, onReplay, onStarter }: HistoryProps) {
  return <section className="panel trainer-completed-history" aria-label="Completed practice history"><div className="panel-header"><div><p className="eyebrow">Progress</p><h2>Completed practice history</h2><p>Search finished rounds by song, exact transition, tempo, or note. Daily totals above are aggregates, not completed rounds.</p></div><div className="trainer-inline-actions"><label>Search history<input type="search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="G → C, song, 6s…" /></label><label>Drill<select value={drill} onChange={(event) => onDrill(event.target.value)}><option value="all">All drills</option>{drills.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>Result<select value={result} onChange={(event) => onResult(event.target.value as "all" | "clean" | "flagged")}><option value="all">All results</option><option value="clean">Clean only</option><option value="flagged">Flagged</option></select></label></div></div>{rounds.length ? <div className="trainer-completed-list">{rounds.map((round) => <article key={round.id}><strong>{round.drill}</strong><span>{round.date} · {round.pace === "manual" ? "manual" : `${round.pace}s`} · {round.song || "no song"}</span><small>{round.sequence.slice(0, 6).join(" → ")} · {round.ratings.clean} clean / {round.ratings.needsWork} needs work / {round.ratings.missed} missed</small><small>{round.freshCount === null || round.freshCount === undefined ? "Fresh/repeat unknown (legacy or unrated)" : `Fresh ${round.freshClean ?? 0}/${round.freshCount} clean · repeat ${round.repeatClean ?? 0}/${round.repeatCount ?? 0} clean`}{round.effort ? ` · effort ${round.effort}` : " · effort not reported"}</small>{round.criteria?.length ? round.criteria.map((criterion) => { const values = Object.values(round.criteriaChecks ?? {}).map((check) => check[criterion]).filter((value): value is boolean => typeof value === "boolean"); return <small key={criterion}>{criterion}: {values.length ? `${values.filter(Boolean).length}/${values.length} self-reported passes` : "no self-report coverage"}</small>; }) : <small>Personal clean-criteria evidence unknown (legacy round).</small>}<button className="btn ghost" type="button" onClick={() => onReplay(round)} disabled={!canReplay}>Replay route</button></article>)}</div> : <div className="trainer-empty-report"><p>{search.trim() || drill !== "all" || result !== "all" ? "No completed round matches these filters." : "No completed rounds yet. Finish a short round and rate each change to create an honest local report."}</p><button className="btn primary" type="button" onClick={onStarter} disabled={locked}>Load a five-change drill</button></div>}</section>;
}
