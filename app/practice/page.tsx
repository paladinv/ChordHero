"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createRevisionSyncClient } from "../../lib/songSyncClient";
import { RIGHT_HAND_EXERCISES, TECHNIQUE_DETAILS, type RightHandTechnique } from "../../lib/rightHandExercises";
import {
  PRACTICE_STATE_EVENT,
  buildDailyPracticePlan,
  emptyPracticePlatformState,
  ensureDailyPracticePlan,
  mergePracticePlatformStates,
  practiceReportText,
  readPracticePlatformState,
  updatePracticePlatformState,
  writePracticePlatformState,
  type PracticeArea,
  type PracticeAssignment,
  type PracticePlatformState
} from "../../lib/practicePlatform";

const AREA_LABELS: Record<PracticeArea, string> = { chords: "Chords", songs: "Songs", rightHand: "Right hand" };

export default function PracticePage() {
  const [state, setState] = useState<PracticePlatformState>(() => emptyPracticePlatformState());
  const [studentName, setStudentName] = useState("Student");
  const [assignmentTitle, setAssignmentTitle] = useState("Steady rhythm check-in");
  const [assignmentArea, setAssignmentArea] = useState<PracticeArea>("rightHand");
  const [message, setMessage] = useState("Your data stays on this device unless you export or connect sync.");
  const [syncURL, setSyncURL] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [feedbackKind, setFeedbackKind] = useState<"audioLink" | "videoLink" | "recordingReference">("audioLink");
  const [feedbackValue, setFeedbackValue] = useState("");
  const [feedbackTimestamp, setFeedbackTimestamp] = useState("0:00");

  useEffect(() => {
    ensureDailyPracticePlan();
    const refresh = () => setState(readPracticePlatformState());
    refresh();
    window.addEventListener(PRACTICE_STATE_EVENT, refresh);
    return () => window.removeEventListener(PRACTICE_STATE_EVENT, refresh);
  }, []);

  const today = useMemo(() => buildDailyPracticePlan(state), [state]);
  const completed = today.tasks.filter((task) => task.completedAt).length;
  const recent = useMemo(() => state.events.slice(-6).reverse(), [state.events]);
  const historyMetrics = useMemo(() => {
    const rightHand = state.events.filter((item) => item.area === "rightHand");
    const scored = rightHand.filter((item) => typeof item.score === "number");
    let cleanStreak = 0;
    for (const item of [...rightHand].reverse()) { if ((item.score ?? 0) >= 85 && (item.misses ?? 0) <= 1) cleanStreak += 1; else break; }
    const areaSeconds = (["chords", "songs", "rightHand"] as PracticeArea[]).map((area) => ({ area, seconds: state.events.filter((item) => item.area === area).reduce((sum, item) => sum + item.seconds, 0) }));
    const totalAreaSeconds = Math.max(1, areaSeconds.reduce((sum, item) => sum + item.seconds, 0));
    const exerciseTechnique = new Map(RIGHT_HAND_EXERCISES.map((exercise) => [exercise.id, exercise.technique]));
    const techniqueSeconds = (["strumming", "plectrum", "fingerpicking"] as RightHandTechnique[]).map((technique) => ({
      technique,
      seconds: rightHand.filter((item) => exerciseTechnique.get(item.itemId) === technique).reduce((sum, item) => sum + item.seconds, 0)
    }));
    const totalTechniqueSeconds = Math.max(1, techniqueSeconds.reduce((sum, item) => sum + item.seconds, 0));
    return {
      totalMinutes: Math.round(state.events.reduce((sum, item) => sum + item.seconds, 0) / 60),
      consistency: scored.length ? Math.round(scored.reduce((sum, item) => sum + (item.score ?? 0), 0) / scored.length) : 0,
      tempoCeiling: Math.max(0, ...rightHand.map((item) => item.tempo ?? 0)),
      cleanStreak,
      balance: areaSeconds.map((item) => ({ ...item, percent: Math.round(item.seconds / totalAreaSeconds * 100) })),
      techniqueBalance: techniqueSeconds.map((item) => ({ ...item, percent: Math.round(item.seconds / totalTechniqueSeconds * 100) }))
    };
  }, [state.events]);

  const toggleTask = useCallback((taskId: string) => {
    updatePracticePlatformState((current) => ({
      ...current,
      plans: current.plans.map((plan) => plan.date !== today.date ? plan : {
        ...plan,
        tasks: plan.tasks.map((task) => task.id !== taskId ? task : {
          ...task,
          completedAt: task.completedAt ? undefined : new Date().toISOString()
        })
      })
    }));
  }, [today.date]);

  const addAssignment = (event: FormEvent) => {
    event.preventDefault();
    const now = new Date().toISOString();
    let attachment: PracticeAssignment["feedbackAttachments"] = [];
    if (feedbackValue.trim()) {
      const value = feedbackValue.trim();
      if (feedbackKind !== "recordingReference" && !/^https:\/\//i.test(value)) { setMessage("Feedback media links must use HTTPS. No assignment was saved."); return; }
      const [minutes, seconds] = feedbackTimestamp.split(":").map(Number);
      const timestampSeconds = Number.isFinite(minutes + seconds) ? Math.max(0, minutes * 60 + seconds) : 0;
      attachment = [{ id: crypto.randomUUID(), kind: feedbackKind, label: feedbackKind === "audioLink" ? "Teacher audio feedback" : feedbackKind === "videoLink" ? "Teacher video feedback" : "Local recording feedback", url: feedbackKind === "recordingReference" ? undefined : value, recordingId: feedbackKind === "recordingReference" ? value : undefined, createdAt: now, consentNote: "Attached by the teacher; Chord Hero does not upload or inspect this media.", timestampSeconds }];
    }
    const assignment: PracticeAssignment = {
      id: crypto.randomUUID(), studentName: studentName.trim() || "Student", title: assignmentTitle.trim(),
      instructions: "Complete the linked practice task and share your next report.", area: assignmentArea,
      targetMinutes: 10, createdAt: now, updatedAt: now, feedbackAttachments: attachment
    };
    updatePracticePlatformState((current) => ({ ...current, assignments: [...current.assignments, assignment] }));
    setMessage("Assignment saved locally and included in exports.");
    setFeedbackValue("");
  };

  const shareReport = async () => {
    const text = practiceReportText(state, studentName);
    if (navigator.share) {
      await navigator.share({ title: "Chord Hero practice report", text });
      return;
    }
    await navigator.clipboard.writeText(text);
    setMessage("Practice report copied to the clipboard.");
  };

  const exportWorkspace = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `chord-hero-practice-${today.date}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
    setMessage("Portable practice workspace exported. It contains progress and assignments, but no audio recordings.");
  };

  const sync = async () => {
    if (!syncURL.trim()) return;
    setSyncing(true);
    try {
      const client = createRevisionSyncClient<PracticePlatformState>(syncURL.trim(), "practice-platform", "current-device-profile");
      let revision = 0;
      let remote = state;
      try {
        const pulled = await client.pull();
        revision = pulled.revision;
        remote = pulled.state;
      } catch {
        // A new optional sync endpoint can start from the local revision.
      }
      const merged = mergePracticePlatformStates(state, remote);
      const pushed = await client.push(merged, revision);
      writePracticePlatformState(pushed.state);
      setMessage(`Synced revision ${pushed.revision}. The endpoint is optional; Chord Hero remains fully local without it.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sync could not be completed.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <main className="page focused-page practice-hub-page">
      <section className="studio-heading dashboard-hero">
        <div><span className="tag">Today&apos;s practice</span><h1>A balanced session, ready when you are.</h1><p>Chord changes, right-hand control, and a song are brought into one short plan. Recommendations adapt from saved scores and missed beats.</p></div>
        <div className="studio-session-note"><span className="label">Daily progress</span><strong>{completed} / {today.tasks.length} complete</strong><span>{today.tasks.reduce((sum, task) => sum + task.minutes, 0)} planned minutes · local-first</span></div>
      </section>

      <section className="daily-plan-grid" aria-label="Daily practice plan">
        {today.tasks.map((task, index) => (
          <article className={`daily-plan-card ${task.completedAt ? "complete" : ""}`} key={task.id}>
            <header><span className="label">{String(index + 1).padStart(2, "0")} · {AREA_LABELS[task.area]}</span><strong>{task.minutes} min</strong></header>
            <h2>{task.title}</h2><p>{task.reason}</p>
            <footer><label><input type="checkbox" checked={Boolean(task.completedAt)} onChange={() => toggleTask(task.id)} /> Done today</label><Link href={task.href}>Start →</Link></footer>
          </article>
        ))}
      </section>

      <section className="practice-history-panel" aria-labelledby="practice-history-title">
        <header><div><span className="label">Practice history</span><h2 id="practice-history-title">Consistency and balance</h2></div><p>Scores are local estimates and self-ratings, useful for trends rather than grading.</p></header>
        <div className="history-metrics"><span><strong>{historyMetrics.totalMinutes}</strong> minutes</span><span><strong>{historyMetrics.consistency || "—"}{historyMetrics.consistency ? "%" : ""}</strong> timing consistency</span><span><strong>{historyMetrics.tempoCeiling || "—"}</strong> BPM ceiling</span><span><strong>{historyMetrics.cleanStreak}</strong> clean streak</span></div>
        <div className="history-balance-groups"><div><span className="label">Across the app</span><div className="technique-balance" aria-label="Practice area balance">{historyMetrics.balance.map((item) => <div key={item.area}><span>{AREA_LABELS[item.area]} <b>{item.percent}%</b></span><i><b style={{ width: `${item.percent}%` }} /></i></div>)}</div></div><div><span className="label">Right-hand technique</span><div className="technique-balance" aria-label="Right-hand technique balance">{historyMetrics.techniqueBalance.map((item) => <div key={item.technique}><span>{TECHNIQUE_DETAILS[item.technique].label} <b>{item.percent}%</b></span><i><b style={{ width: `${item.percent}%` }} /></i></div>)}</div></div></div>
        <div className="weekly-balance-goal"><div><span className="label">Weekly right-hand balance goal</span><strong>{historyMetrics.techniqueBalance.every((item) => item.percent >= state.weeklyRightHandGoal.minimumTechniquePercent) ? "Technique mix on target" : "One technique needs attention"}</strong><small>{state.weeklyRightHandGoal.targetMinutes} min total · at least {state.weeklyRightHandGoal.minimumTechniquePercent}% per technique</small></div><label>Minutes<input type="number" min={10} max={420} step={5} value={state.weeklyRightHandGoal.targetMinutes} onChange={(event) => updatePracticePlatformState((current) => ({ ...current, weeklyRightHandGoal: { ...current.weeklyRightHandGoal, targetMinutes: Math.max(10, Number(event.target.value)) } }))} /></label><label>Minimum share<select value={state.weeklyRightHandGoal.minimumTechniquePercent} onChange={(event) => updatePracticePlatformState((current) => ({ ...current, weeklyRightHandGoal: { ...current.weeklyRightHandGoal, minimumTechniquePercent: Number(event.target.value) } }))}><option value={15}>15%</option><option value={20}>20%</option><option value={25}>25%</option><option value={30}>30%</option></select></label></div>
      </section>

      <section className="practice-hub-columns">
        <article className="practice-hub-panel">
          <span className="label">Teacher / student workspace</span><h2>Assignments that travel</h2><p>Create assignments locally, then export or share a progress report. No account or hidden upload is required.</p>
          <form className="assignment-form" onSubmit={addAssignment}>
            <label>Student<input value={studentName} onChange={(event) => setStudentName(event.target.value)} /></label>
            <label>Assignment<input required value={assignmentTitle} onChange={(event) => setAssignmentTitle(event.target.value)} /></label>
            <label>Focus<select value={assignmentArea} onChange={(event) => setAssignmentArea(event.target.value as PracticeArea)}>{Object.entries(AREA_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Feedback type<select value={feedbackKind} onChange={(event) => setFeedbackKind(event.target.value as typeof feedbackKind)}><option value="audioLink">Audio link</option><option value="videoLink">Video link</option><option value="recordingReference">Local recording ID</option></select></label>
            <label>Optional feedback<input value={feedbackValue} onChange={(event) => setFeedbackValue(event.target.value)} placeholder={feedbackKind === "recordingReference" ? "right-hand:exercise:take" : "https://…"} /></label>
            <label>Review timestamp<input value={feedbackTimestamp} onChange={(event) => setFeedbackTimestamp(event.target.value)} pattern="[0-9]+:[0-5][0-9]" placeholder="0:24" /></label>
            <button type="submit">Save assignment</button>
          </form>
          <div className="assignment-list">
            {state.assignments.slice(-4).reverse().map((assignment) => <div key={assignment.id}><span><strong>{assignment.title}</strong><small>{assignment.studentName} · {AREA_LABELS[assignment.area]} · {assignment.targetMinutes} min</small></span>{assignment.feedbackAttachments?.length ? <span className="assignment-feedback">{assignment.feedbackAttachments.map((attachment) => <span key={attachment.id}>{attachment.url ? <a href={`${attachment.url}${attachment.timestampSeconds ? `#t=${attachment.timestampSeconds}` : ""}`} target="_blank" rel="noreferrer">{attachment.label}</a> : <code>{attachment.recordingId}</code>}{attachment.timestampSeconds ? <small> at {Math.floor(attachment.timestampSeconds / 60)}:{String(attachment.timestampSeconds % 60).padStart(2, "0")}</small> : null}</span>)}</span> : <small>No media feedback</small>}</div>)}
            {!state.assignments.length ? <small>No assignments yet.</small> : null}
          </div>
          <div className="report-actions"><button type="button" onClick={() => void shareReport()}>Share progress report</button><button type="button" onClick={exportWorkspace}>Export workspace JSON</button></div>
        </article>

        <article className="practice-hub-panel">
          <span className="label">Optional device sync</span><h2>Use your own sync endpoint</h2><p>Connect the existing revision-safe sync format when you have an authenticated endpoint. Local practice continues offline if sync is unavailable.</p>
          <div className="sync-form"><label>Sync server URL<input type="url" inputMode="url" placeholder="https://your-server.example" value={syncURL} onChange={(event) => setSyncURL(event.target.value)} /></label><button type="button" disabled={!syncURL || syncing} onClick={() => void sync()}>{syncing ? "Syncing…" : "Sync now"}</button></div>
          <span className="label">Recent practice</span>
          <div className="recent-practice-list">{recent.map((event) => <div key={event.id}><strong>{event.title}</strong><span>{AREA_LABELS[event.area]} · {Math.max(1, Math.round(event.seconds / 60))} min{event.score ? ` · ${event.score}%` : ""}</span></div>)}{!recent.length ? <small>Scores and completed rounds will appear here.</small> : null}</div>
        </article>
      </section>
      <p className="practice-message" role="status">{message}</p>
    </main>
  );
}
