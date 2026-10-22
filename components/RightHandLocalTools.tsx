"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { RightHandExercise } from "../lib/rightHandExercises";
import { PRACTICE_STATE_EVENT, readPracticePlatformState, updatePracticePlatformState, type PracticePlatformState } from "../lib/practicePlatform";
import { RIGHT_HAND_AUDIO_BUNDLE, RIGHT_HAND_BUNDLE_CACHE, RIGHT_HAND_LIBRARY_PATH, rightHandLibraryJson } from "../lib/rightHandLearning";
import { feedbackAttachmentFromInput, rightHandTeacherExport } from "../lib/rightHandTeacher";

type BundleStatus = { checked: number; bytes: number; missing: string[]; shell: boolean; library: boolean };
const initialStatus: BundleStatus = { checked: 0, bytes: 0, missing: [], shell: false, library: false };
const RightHandBackupTools = dynamic(() => import("./RightHandBackupTools"), { ssr: false });
export default function RightHandLocalTools({ exercise }: { exercise: RightHandExercise }) {
  const [state, setState] = useState<PracticePlatformState>(() => readPracticePlatformState());
  const [student, setStudent] = useState("");
  const [minutes, setMinutes] = useState(10);
  const [tempo, setTempo] = useState(72);
  const [score, setScore] = useState(80);
  const [due, setDue] = useState("");
  const [instructions, setInstructions] = useState("");
  const [feedbackNote, setFeedbackNote] = useState("");
  const [attachmentKind, setAttachmentKind] = useState<"audioLink" | "videoLink" | "recordingReference">("audioLink");
  const [attachmentLabel, setAttachmentLabel] = useState("");
  const [attachmentTarget, setAttachmentTarget] = useState("");
  const [attachmentTimestamp, setAttachmentTimestamp] = useState(0);
  const [attachmentConsent, setAttachmentConsent] = useState<"shared" | "redacted">("redacted");
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const verified = async (cache: Cache, asset: { path: string; bytes: number }) => {
    try { const response = await cache.match(asset.path); return Boolean(response?.ok && (await response.arrayBuffer()).byteLength === asset.bytes); } catch { return false; }
  };
  useEffect(() => { const update = () => setState(readPracticePlatformState()); window.addEventListener(PRACTICE_STATE_EVENT, update); return () => window.removeEventListener(PRACTICE_STATE_EVENT, update); }, []);
  const inspect = async () => {
    if (!("caches" in window)) throw new Error("CacheStorage is unavailable in this browser.");
    const cache = await caches.open(RIGHT_HAND_BUNDLE_CACHE);
    let bytes = 0; const missing: string[] = [];
    for (const asset of RIGHT_HAND_AUDIO_BUNDLE) {
      if (!await verified(cache, asset)) { missing.push(asset.path); continue; }
      bytes += asset.bytes;
    }
    const libraryResponse = await cache.match(RIGHT_HAND_LIBRARY_PATH);
    const library = Boolean(libraryResponse?.ok && await libraryResponse.text() === rightHandLibraryJson());
    const scripts = Array.from(document.scripts).map((script) => script.src).filter((src) => src.startsWith(location.origin));
    const shell = Boolean((await caches.match("/right-hand"))?.ok) && scripts.length > 0 && (await Promise.all(scripts.map(async (src) => Boolean((await caches.match(src))?.ok)))).every(Boolean);
    setStatus({ checked: RIGHT_HAND_AUDIO_BUNDLE.length, bytes, missing, library, shell });
    return { missing, library, shell };
  };
  const download = async (onlyPath?: string) => {
    setBusy(true); setMessage("Checking and downloading audio…");
    const failures: string[] = [];
    try {
      if (!("caches" in window)) throw new Error("CacheStorage is unavailable in this browser.");
      const cache = await caches.open(RIGHT_HAND_BUNDLE_CACHE);
      let bytes = 0;
      for (let index = 0; index < RIGHT_HAND_AUDIO_BUNDLE.length; index++) {
        const asset = RIGHT_HAND_AUDIO_BUNDLE[index];
        if (await verified(cache, asset) || (onlyPath && onlyPath !== asset.path)) continue;
        try {
          const response = await fetch(asset.path, { cache: "reload" });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const body = await response.arrayBuffer();
          if (body.byteLength !== asset.bytes) throw new Error(`expected ${asset.bytes}, received ${body.byteLength} bytes`);
          await cache.put(asset.path, new Response(body, { headers: { "Content-Type": response.headers.get("content-type") ?? "audio/mpeg" } }));
          setFileErrors((current) => { const next = { ...current }; delete next[asset.path]; return next; });
          bytes += body.byteLength;
        } catch (error) { const reason = error instanceof Error ? error.message : "download failed"; failures.push(`${asset.path}: ${reason}`); setFileErrors((current) => ({ ...current, [asset.path]: reason })); }
        setMessage(`${index + 1}/${RIGHT_HAND_AUDIO_BUNDLE.length} checked · ${bytes.toLocaleString()} bytes downloaded${failures.length ? ` · ${failures.length} failed` : ""}`);
      }
      await cache.put(RIGHT_HAND_LIBRARY_PATH, new Response(rightHandLibraryJson(), { headers: { "Content-Type": "application/json" } }));
      const result = await inspect();
      setMessage(failures.length ? `Download failures: ${failures.join("; ")}` : result.missing.length ? "Some audio did not verify. Retry download." : "Audio and exercise library verified in this browser cache.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Offline preparation failed."); }
    finally { setBusy(false); }
  };
  const exportReport = (includeSharedAttachments = false) => {
    const blob = new Blob([JSON.stringify(rightHandTeacherExport(state.assignments, state.events, { includeSharedAttachments }), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "right-hand-teacher-report.json"; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const addFeedback = (assignmentId: string) => {
    const attachment = attachmentLabel.trim() ? feedbackAttachmentFromInput({ kind: attachmentKind, label: attachmentLabel, ...(attachmentKind === "recordingReference" ? { recordingId: attachmentTarget } : { url: attachmentTarget }), timestampSeconds: attachmentTimestamp, consentNote: attachmentConsent === "shared" ? "Learner consented to share this reference." : "Reference redacted from exports unless consent is granted.", consent: attachmentConsent }) : null;
    if (attachmentLabel.trim() && !attachment) { setMessage("Use an HTTPS link or saved recording reference, with a timestamp from 0–86400 seconds."); return; }
    updatePracticePlatformState((current) => ({ ...current, assignments: current.assignments.map((item) => item.id !== assignmentId ? item : { ...item, updatedAt: new Date().toISOString(), feedbackAttachments: [...(item.feedbackAttachments ?? []), ...(attachment ? [attachment] : [])].slice(-20), feedbackNotes: [...(item.feedbackNotes ?? []), ...(feedbackNote.trim() ? [{ id: crypto.randomUUID(), body: feedbackNote.trim().slice(0, 1000), createdAt: new Date().toISOString() }] : [])].slice(-20) }) }));
    setFeedbackNote(""); setAttachmentLabel(""); setAttachmentTarget(""); setAttachmentTimestamp(0); setMessage("Timestamped teacher feedback saved locally.");
  };
  return <div className="learning-local-grid"><section className="learning-card"><h3>Prepare an offline practice bundle</h3><p>9 recorded audio files: {RIGHT_HAND_AUDIO_BUNDLE.reduce((sum, item) => sum + item.bytes, 0).toLocaleString()} bytes. Exercise library: {new TextEncoder().encode(rightHandLibraryJson()).byteLength.toLocaleString()} bytes. No recordings are downloaded or cached.</p><div className="learning-actions"><button type="button" disabled={busy} onClick={() => void download()}>{busy ? "Preparing…" : "Download / repair bundle"}</button><button type="button" disabled={busy} onClick={() => void inspect().then(() => setMessage("Readiness checked from cache.")).catch((error) => setMessage(String(error)))}>Check readiness</button></div><p role="status">{message}</p>{status.checked ? <><p>Audio {status.missing.length === 0 ? "ready" : `missing ${status.missing.length}`} · {status.bytes.toLocaleString()} bytes verified · library {status.library ? "ready" : "not cached"} · current page/scripts {status.shell ? "found in cache" : "not fully cached"}.</p>{status.missing.map((path) => <div className="learning-file-retry" key={path}><small>{path} · {fileErrors[path] ?? "missing or unverified"}</small><button type="button" disabled={busy} onClick={() => void download(path)}>Retry this file</button></div>)}</> : null}<p>Repair skips every already-verified audio file. Failed or wrong-size downloads never replace a valid cached file.</p><p>The drill library is bundled with the app. This prepares its audio, not a guaranteed offline installation: browser eviction, uncached routes/chunks, and online media can still require a connection. Open the studio once online, then verify it in airplane mode.</p><details><summary>Exact audio manifest</summary>{RIGHT_HAND_AUDIO_BUNDLE.map((asset) => <small key={asset.path}>{asset.path} · {asset.bytes.toLocaleString()} bytes</small>)}</details></section>
    <section className="learning-card"><h3>Local teacher view</h3><p>Assignments and results on this browser only. No teacher account, student login, remote sharing or identity verification. A student name is a label; results on a shared browser are not attributable to a person.</p><form onSubmit={(event) => { event.preventDefault(); const now = new Date().toISOString(); updatePracticePlatformState((current) => ({ ...current, assignments: [...current.assignments, { id: crypto.randomUUID(), studentName: student.trim() || "Local learner", title: exercise.title, instructions: instructions.trim(), area: "rightHand", itemId: exercise.id, targetMinutes: minutes, targetTempo: tempo, targetScore: score, dueAt: due ? new Date(`${due}T23:59:59`).toISOString() : undefined, createdAt: now, updatedAt: now, feedbackNotes: [] }] })); setMessage("Assignment saved locally."); }}><label>Learner label<input maxLength={80} value={student} onChange={(event) => setStudent(event.target.value)} /></label><label>Minutes<input type="number" min={1} max={120} required value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} /></label><label>Target BPM<input type="number" min={40} max={180} required value={tempo} onChange={(event) => setTempo(Number(event.target.value))} /></label><label>Timing goal %<input type="number" min={0} max={100} required value={score} onChange={(event) => setScore(Number(event.target.value))} /></label><label>Due date<input type="date" value={due} onChange={(event) => setDue(event.target.value)} /></label><label>Instructions<textarea maxLength={1500} value={instructions} onChange={(event) => setInstructions(event.target.value)} /></label><button type="submit">Assign selected drill</button></form><div className="learning-actions"><button type="button" onClick={() => exportReport()}>Export redacted assignments & results</button><button type="button" onClick={() => exportReport(true)}>Export consented references</button></div>
    {state.assignments.filter((item) => item.area === "rightHand").slice(-12).reverse().map((assignment) => {
      const results = state.events.filter((item) => item.area === "rightHand" && (!assignment.itemId || item.itemId === assignment.itemId) && item.reviewAccepted !== false && Date.parse(item.practisedAt) >= Date.parse(assignment.createdAt) && (!assignment.dueAt || Date.parse(item.practisedAt) <= Date.parse(assignment.dueAt)));
      const minutesActual = results.reduce((sum, item) => sum + item.seconds, 0) / 60;
      const measured = results.filter((item) => item.recordingId && item.reviewAccepted === true && item.score !== undefined);
      const goalTakes = measured.filter((item) => (item.tempo ?? 0) >= (assignment.targetTempo ?? 0) && (item.score ?? 0) >= (assignment.targetScore ?? 0));
      return <article key={assignment.id} className="learning-assignment"><strong>{assignment.studentName} · {assignment.title}</strong><p>{assignment.instructions}</p><small>{assignment.dueAt ? `Due ${new Date(assignment.dueAt).toLocaleDateString()}` : "No due date"} · results since assignment{assignment.dueAt ? " through due date" : ""}</small><p>Practice: {minutesActual.toFixed(1)} / {assignment.targetMinutes} min · accepted recorded takes: {measured.length} · meeting {assignment.targetTempo ?? "—"} BPM and {assignment.targetScore ?? "—"}%: {goalTakes.length}</p>{measured.length ? <p>Latest measured: {measured.at(-1)?.tempo} BPM · {measured.at(-1)?.score}% timing</p> : <p>No accepted recorded timing evidence yet. Self-rated rounds count toward practice time only.</p>}{assignment.feedbackNotes?.map((note) => <p key={note.id}><small>{new Date(note.createdAt).toLocaleString()}</small> · {note.body}</p>)}{assignment.feedbackAttachments?.map((attachment) => <p key={attachment.id}><small>{new Date(attachment.createdAt).toLocaleString()} · {attachment.timestampSeconds ?? 0}s · {attachment.consent === "shared" ? "consented" : "redacted"}</small> {attachment.url ? <a href={attachment.url} target="_blank" rel="noreferrer">{attachment.label}</a> : <span>{attachment.label} ({attachment.recordingId})</span>}</p>)}<details><summary>Add timestamped feedback</summary><label>Note<textarea maxLength={1000} value={feedbackNote} onChange={(event) => setFeedbackNote(event.target.value)} /></label><label>Attachment type<select value={attachmentKind} onChange={(event) => setAttachmentKind(event.target.value as typeof attachmentKind)}><option value="audioLink">HTTPS audio link</option><option value="videoLink">HTTPS video link</option><option value="recordingReference">Local recording reference</option></select></label><label>Label<input maxLength={160} value={attachmentLabel} onChange={(event) => setAttachmentLabel(event.target.value)} /></label><label>{attachmentKind === "recordingReference" ? "Recording ID" : "HTTPS URL"}<input value={attachmentTarget} onChange={(event) => setAttachmentTarget(event.target.value)} placeholder={attachmentKind === "recordingReference" ? "right-hand:…" : "https://…"} /></label><label>Timestamp (seconds)<input type="number" min={0} max={86400} value={attachmentTimestamp} onChange={(event) => setAttachmentTimestamp(Number(event.target.value))} /></label><label>Consent<select value={attachmentConsent} onChange={(event) => setAttachmentConsent(event.target.value as typeof attachmentConsent)}><option value="redacted">Redact target in export</option><option value="shared">Learner consented to share target</option></select></label><button type="button" onClick={() => addFeedback(assignment.id)}>Save feedback locally</button></details></article>;
    })}</section><RightHandBackupTools /></div>;
}
