"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createRevisionSyncClient } from "../../lib/songSyncClient";
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
    const assignment: PracticeAssignment = {
      id: crypto.randomUUID(), studentName: studentName.trim() || "Student", title: assignmentTitle.trim(),
      instructions: "Complete the linked practice task and share your next report.", area: assignmentArea,
      targetMinutes: 10, createdAt: now, updatedAt: now
    };
    updatePracticePlatformState((current) => ({ ...current, assignments: [...current.assignments, assignment] }));
    setMessage("Assignment saved locally and included in exports.");
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

      <section className="practice-hub-columns">
        <article className="practice-hub-panel">
          <span className="label">Teacher / student workspace</span><h2>Assignments that travel</h2><p>Create assignments locally, then export or share a progress report. No account or hidden upload is required.</p>
          <form className="assignment-form" onSubmit={addAssignment}>
            <label>Student<input value={studentName} onChange={(event) => setStudentName(event.target.value)} /></label>
            <label>Assignment<input required value={assignmentTitle} onChange={(event) => setAssignmentTitle(event.target.value)} /></label>
            <label>Focus<select value={assignmentArea} onChange={(event) => setAssignmentArea(event.target.value as PracticeArea)}>{Object.entries(AREA_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <button type="submit">Save assignment</button>
          </form>
          <div className="assignment-list">
            {state.assignments.slice(-4).reverse().map((assignment) => <div key={assignment.id}><strong>{assignment.title}</strong><span>{assignment.studentName} · {AREA_LABELS[assignment.area]} · {assignment.targetMinutes} min</span></div>)}
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
