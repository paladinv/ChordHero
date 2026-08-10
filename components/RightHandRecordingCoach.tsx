"use client";

import { useEffect, useRef, useState } from "react";
import { analyzePracticeRecording, type RecordingAnalysis } from "../lib/songRecordingAnalysis";
import { saveRecording } from "../lib/songRecording";

type Props = {
  bpm: number;
  subdivisionsPerBeat: number;
  expectedSteps: number;
  exerciseId: string;
  onAnalysis: (analysis: RecordingAnalysis) => void;
  onLoopTrouble: (step: number) => void;
};

export default function RightHandRecordingCoach({ bpm, subdivisionsPerBeat, expectedSteps, exerciseId, onAnalysis, onLoopTrouble }: Props) {
  const [status, setStatus] = useState<"idle" | "recording" | "analysing" | "ready" | "error">("idle");
  const [analysis, setAnalysis] = useState<RecordingAnalysis | null>(null);
  const [audioURL, setAudioURL] = useState("");
  const [message, setMessage] = useState("Record an 8-second take after allowing microphone access.");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioURL) URL.revokeObjectURL(audioURL);
  }, [audioURL]);

  const stop = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setStatus("error"); setMessage("Microphone recording is not supported in this browser."); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      streamRef.current = stream;
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setStatus("analysing");
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          const nextURL = URL.createObjectURL(blob);
          setAudioURL((previous) => { if (previous) URL.revokeObjectURL(previous); return nextURL; });
          const next = await analyzePracticeRecording(blob, { referenceBpm: bpm, subdivisionsPerBeat, expectedSteps });
          await saveRecording(`right-hand:${exerciseId}:latest`, blob);
          setAnalysis(next); onAnalysis(next); setStatus("ready");
          setMessage(next.timingTendency === "steady" ? "Attacks sit close to the pulse." : `Your take trends ${next.timingTendency}. Use the trouble loop before raising tempo.`);
        } catch {
          setStatus("error"); setMessage("This take could not be decoded. Try recording again in a quieter room.");
        }
      };
      recorder.start(); setStatus("recording"); setMessage("Recording… play the displayed pattern for eight seconds.");
      timeoutRef.current = window.setTimeout(stop, 8000);
    } catch {
      setStatus("error"); setMessage("Microphone permission was not granted. You can keep practising without recording.");
    }
  };

  return (
    <section className="recording-coach" aria-labelledby="recording-coach-title">
      <div><span className="label">Listen back</span><h3 id="recording-coach-title">Timing & chord-attack coach</h3><p>{message}</p></div>
      <div className="recording-actions">
        <button type="button" onClick={status === "recording" ? stop : () => void start()} disabled={status === "analysing"}>{status === "recording" ? "Stop & score" : status === "analysing" ? "Analysing…" : analysis ? "Record another take" : "Record 8-sec take"}</button>
        {audioURL ? <audio controls preload="metadata" src={audioURL} aria-label="Your latest right-hand take" /> : null}
      </div>
      {analysis ? (
        <div className="recording-scores">
          <span><strong>{analysis.timingScore}%</strong> timing</span><span><strong>{analysis.chordAttackScore}%</strong> attack clarity</span><span><strong>{analysis.averageOffsetMs > 0 ? "+" : ""}{analysis.averageOffsetMs} ms</strong> average offset</span>
          {analysis.troubleBeats.length ? <button type="button" onClick={() => onLoopTrouble(analysis.troubleBeats[0] % expectedSteps)}>Loop first trouble spot</button> : <small>No large timing misses detected.</small>}
          <p>{analysis.analysisNote}</p>
        </div>
      ) : null}
    </section>
  );
}
