"use client";

type Drill = { first: string; second: string; distractors: [string, string]; answer: string; phase: "preview" | "distract1" | "distract2" | "quiz" | "done" };

export default function TrainerDelayedRecall({ message, drill, choice, setChoice, start, advance, submit, reset }: {
  message: string; drill: Drill | null; choice: string; setChoice: (value: string) => void; start: () => void; advance: () => void; submit: () => void; reset: () => void;
}) {
  return <section className="trainer-delayed-recall" aria-label="Delayed recall mini-drill">
    <div><span className="label">Delayed recall · two unrelated shapes</span><p>{message || "Untimed memory check; it creates no transition rating."}</p></div>
    {!drill ? <button className="btn" type="button" onClick={start}>Start delayed recall</button> : <div className="trainer-recall-drill">
      {drill.phase === "preview" && <><strong>{drill.first} → {drill.second}</strong><span>Preview the target pair, then step through two unrelated shapes.</span><button className="btn primary" type="button" onClick={advance}>Begin unrelated shape 1</button></>}
      {drill.phase === "distract1" && <><strong>{drill.distractors[0]}</strong><span>Play this unrelated shape, then continue without rating it.</span><button className="btn primary" type="button" onClick={advance}>Next unrelated shape</button></>}
      {drill.phase === "distract2" && <><strong>{drill.distractors[1]}</strong><span>Play this second unrelated shape, then choose the destination from memory.</span><button className="btn primary" type="button" onClick={advance}>Reveal destination choices</button></>}
      {drill.phase === "quiz" && <><strong>Which destination follows the preview pair?</strong><span>The answer stays hidden until you commit.</span><select aria-label="Delayed recall destination" value={choice} onChange={(event) => setChoice(event.target.value)}><option value="">Choose destination</option>{Array.from(new Set([drill.answer, ...drill.distractors])).map((name) => <option key={name}>{name}</option>)}</select><button className="btn primary" type="button" onClick={submit} disabled={!choice}>Check choice</button></>}
      {drill.phase === "done" && <strong>{message}</strong>}<button className="btn ghost" type="button" onClick={reset}>Reset</button>
    </div>}
  </section>;
}
