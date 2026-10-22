"use client";
import { useEffect, useRef, useState } from "react";
import { aggregateEvaluationCohorts, compareReferenceOnsets, parseEvaluationManifest, type EvaluationSample } from "../lib/rightHandAudioEvaluation";
import { downloadLocalAudio } from "./RightHandStorageManager";

const example = { version: 1, samples: [{ file: "my-consented-take.wav", device: "Phone model / microphone", browser: "Browser and version", pickup: "built-in microphone", noise: "quiet room", instrument: "acoustic", expectedTempoBpm: 80, expectedOnsetsMs: [1200, 1950, 2700, 3450], expectedChords: ["C"], consent: { granted: true, scope: "local-evaluation", source: "Replace with actual performer permission provenance", date: "2026-10-19" } }] };
export default function RightHandAudioEvaluation() {
  const [samples, setSamples] = useState<EvaluationSample[]>([]); const [files, setFiles] = useState<File[]>([]); const [consent, setConsent] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("Not evaluated: no consented real-recording dataset has been supplied."); const [report, setReport] = useState<object | null>(null);
  const generation = useRef(0); useEffect(() => () => { generation.current++; }, []);
  const evaluate = async () => {
    if (!consent || !samples.length || busy) return;
    setBusy(true); setReport(null);
    const token = ++generation.current;
    try {
      const { analyzePracticeRecording } = await import("../lib/songRecordingAnalysis");
      const results = [];
      for (const sample of samples) {
        const file = files.find((item) => item.name === sample.file);
        if (!file) throw new Error(`Select the audio file ${sample.file}.`);
        if (file.size > 20 * 1024 * 1024) throw new Error("Each evaluation recording must be 20 MiB or smaller.");
        const analysis = await analyzePracticeRecording(file, { referenceBpm: sample.expectedTempoBpm, expectedFirstOnsetMs: sample.expectedOnsetsMs[0], expectedSteps: sample.expectedOnsetsMs.length, instrumentProfile: sample.instrument, expectedChordProgression: sample.expectedChords, pitchScoringMode: sample.expectedChords?.length ? "quality" : "timing", maxDurationMs: 30000 });
        if (token !== generation.current) return;
        const detectedOnsets = analysis.allOnsetMs ?? analysis.onsetMs;
        const onsetMetrics = compareReferenceOnsets(sample.expectedOnsetsMs, detectedOnsets);
        const intervals = detectedOnsets.slice(1).map((ms, i) => ms - detectedOnsets[i]).sort((a, b) => a - b);
        const medianInterval = intervals[Math.floor(intervals.length / 2)];
        const observedAttackRateBpm = medianInterval > 0 ? Math.round(60000 / medianInterval * 10) / 10 : null;
        const referenceIntervals = sample.expectedOnsetsMs.slice(1).map((ms, i) => ms - sample.expectedOnsetsMs[i]).sort((a, b) => a - b);
        const referenceAttackRate = 60000 / referenceIntervals[Math.floor(referenceIntervals.length / 2)];
        const labels = analysis.harmonicEvidence;
        const chordLabelAgreementPercent = labels.length ? Math.round(labels.filter((item) => item.expectedChord === item.detectedChord).length / labels.length * 100) : null;
        results.push({ file: sample.file, bytes: file.size, device: sample.device, browser: sample.browser, pickup: sample.pickup, noise: sample.noise, instrument: sample.instrument, consent: sample.consent, referenceTempoBpm: sample.expectedTempoBpm, onsetMetrics, observedAttackRateBpm, attackRateErrorPercent: observedAttackRateBpm === null ? null : Math.round(Math.abs(observedAttackRateBpm - referenceAttackRate) / referenceAttackRate * 100), chordLabelAgreementPercent, chordEvidenceCount: labels.length, chordAgreementCount: labels.filter((item) => item.expectedChord === item.detectedChord).length, suitability: analysis.recordingSuitability, note: "Attack rate is not tempo when rhythms contain rests/subdivisions. Chord agreement only covers retained evidence; it is not a whole-take accuracy score." });
      }
      setReport({ version: 1, evaluatedAt: new Date().toISOString(), processing: "local browser only; no upload", sampleCount: results.length, devices: [...new Set(results.map((item) => item.device))], ...aggregateEvaluationCohorts(results), results, limitations: "Only supplied recordings are measured; small cohorts do not establish general accuracy. User-supplied annotations and consent are not independently verified. Results do not validate buzz, string identity, or general device accuracy. No diagnostic accuracy is claimed." });
      setMessage(`Evaluated ${results.length} supplied recordings across ${new Set(results.map((item) => item.device)).size} device labels. Export the measured report below.`);
    } catch (error) { if (token === generation.current) setMessage(error instanceof Error ? error.message : "Evaluation failed; no report was generated."); } finally { if (token === generation.current) setBusy(false); }
  };
  return <details className="beat-timing-report"><summary>Consented real-recording evaluation · local only</summary><p>Import your own annotated recordings to measure onset error, coverage and retained chord-label agreement across devices. Up to 12 recordings, 20 MiB and 30 seconds each. Nothing is uploaded or added to your take library. Do not include private information in device labels.</p><button type="button" onClick={() => downloadLocalAudio(new Blob([JSON.stringify(example, null, 2)], { type: "application/json" }), "right-hand-evaluation-manifest-example.json")}>Download manifest example</button><p><label>Manifest JSON <input type="file" accept="application/json,.json" disabled={busy} onChange={(event) => { setSamples([]); setReport(null); const file = event.target.files?.[0]; if (file && file.size > 1048576) { setMessage("Manifest must be 1 MiB or smaller."); return; } if (file) void file.text().then((text) => { setSamples(parseEvaluationManifest(JSON.parse(text))); setMessage("Manifest accepted. Select matching audio files and confirm consent."); }).catch((error) => setMessage(error instanceof Error ? error.message : "Invalid manifest.")); }} /></label></p><p><label>Matching audio files <input type="file" accept="audio/*" multiple disabled={busy} onChange={(event) => { setFiles(Array.from(event.target.files ?? []).slice(0, 12)); setReport(null); }} /></label></p><label><input type="checkbox" checked={consent} disabled={busy} onChange={(event) => setConsent(event.target.checked)} /> I have permission from every recorded performer for this local evaluation and the manifest&apos;s consent records are accurate.</label><p><button type="button" disabled={busy || !consent || !samples.length || !files.length} onClick={() => void evaluate()}>{busy ? "Evaluating locally…" : "Evaluate selected recordings"}</button>{report ? <button type="button" onClick={() => downloadLocalAudio(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }), "right-hand-real-recording-report.json")}>Export measured report</button> : null}</p><p role="status">{message}</p>{report ? <pre style={{ overflowX: "auto", maxHeight: 360 }}>{JSON.stringify(report, null, 2)}</pre> : null}</details>;
}
