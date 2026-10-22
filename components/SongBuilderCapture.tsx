"use client";

import { useEffect, useRef, useState } from "react";
import type { SongComposition, SongCompositionTrack } from "@/lib/songLibrary";
import { estimateSongPitch, estimateSongPitchWithConfidence, estimateSongPitches, songPitchName } from "@/lib/songBuilderPitch";

type MidiMessage = { data: Uint8Array };
type MidiInputPort = { id: string; name?: string; onmidimessage: ((event: MidiMessage) => void) | null };
type MidiAccessLike = { inputs: { values: () => IterableIterator<MidiInputPort> }; onstatechange: (() => void) | null };
export type CapturedSongNote = { pitch: number | number[]; startBeat: number; durationBeats: number; velocity: number; sectionId: string; trackId: string; measureIndex: number };
type Props = {
  composition: SongComposition;
  sectionId: string;
  track: SongCompositionTrack;
  measureIndex: number;
  startBeat: number;
  onCapture: (note: CapturedSongNote) => void;
  onMessage: (message: string) => void;
  onTempoDetected?: (bpm: number) => void;
};

type TranscribedNote = { pitch: number; startSeconds: number; durationSeconds: number; confidence?: number; stability?: number };
type QuantizeChoice = "off" | "composition" | "quarter" | "eighth" | "triplet" | "sixteenth";

function estimateTempoFromEnvelope(energies: number[], frameSeconds: number) {
  if (energies.length < 24 || frameSeconds <= 0) return null;
  const flux = energies.map((value, index) => Math.max(0, value - (energies[index - 1] ?? 0)));
  let best = { bpm: 0, score: 0 };
  for (let bpm = 50; bpm <= 200; bpm += 1) {
    const lag = Math.round(60 / bpm / frameSeconds);
    if (lag < 2 || lag >= flux.length / 2) continue;
    let score = 0;
    let energy = 0;
    for (let index = lag; index < flux.length; index += 1) {
      score += flux[index] * flux[index - lag];
      energy += flux[index] * flux[index];
    }
    const normalized = score / Math.max(1e-9, energy);
    if (normalized > best.score) best = { bpm, score: normalized };
  }
  return best.score >= 0.08 ? best.bpm : null;
}

function quantizeBeat(value: number, choice: QuantizeChoice, subdivision: number) {
  if (choice === "off") return Math.max(0, Number(value.toFixed(3)));
  const step = choice === "composition" ? 4 / subdivision : choice === "quarter" ? 1 : choice === "eighth" ? 0.5 : choice === "triplet" ? 1 / 3 : 0.25;
  return Math.max(0, Number((Math.round(value / step) * step).toFixed(3)));
}

export default function SongBuilderCapture({ composition, sectionId, track, measureIndex, startBeat, onCapture, onMessage, onTempoDetected }: Props) {
  const [inputs, setInputs] = useState<Array<{ id: string; name: string }>>([]);
  const [inputId, setInputId] = useState("");
  const [midiReady, setMidiReady] = useState(false);
  const [midiArmed, setMidiArmed] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [micStatus, setMicStatus] = useState("Microphone is off.");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreview, setAudioPreview] = useState("");
  const [waveform, setWaveform] = useState<number[]>([]);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioPosition, setAudioPosition] = useState(0);
  const [detectedTempo, setDetectedTempo] = useState<number | null>(null);
  const [transcription, setTranscription] = useState<TranscribedNote[]>([]);
  const [transcriptionMode, setTranscriptionMode] = useState<"melody" | "polyphonic">("melody");
  const [quantize, setQuantize] = useState<QuantizeChoice>("composition");
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptionStatus, setTranscriptionStatus] = useState("Choose a short audio recording to suggest a single-note melody.");
  const accessRef = useRef<MidiAccessLike | null>(null);
  const activeNotes = useRef(new Map<number, { at: number; velocity: number }>());
  const captureStart = useRef({ at: 0, beat: 0, sectionId, trackId: track.id, measureIndex });
  const onCaptureRef = useRef(onCapture);
  const beatSecondsRef = useRef(60 / composition.bpm);
  const subdivisionRef = useRef(composition.subdivision);
  const quantizeRef = useRef(quantize);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micTimerRef = useRef<number | null>(null);
  const finishMicNoteRef = useRef<(at?: number) => void>(() => undefined);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentMicNote = useRef<{ pitch: number; at: number; velocity: number } | null>(null);
  const candidatePitch = useRef<{ pitch: number | null; count: number } | null>(null);

  onCaptureRef.current = onCapture;
  beatSecondsRef.current = 60 / (composition.bpm || 90);
  subdivisionRef.current = composition.subdivision;
  quantizeRef.current = quantize;

  const commit = (pitch: number, at: number, end: number, velocity: number) => {
    const rawStart = captureStart.current.beat + (at - captureStart.current.at) / 1000 / beatSecondsRef.current;
    const rawEnd = captureStart.current.beat + (end - captureStart.current.at) / 1000 / beatSecondsRef.current;
    const choice = quantizeRef.current;
    const start = quantizeBeat(rawStart, choice, subdivisionRef.current);
    const finish = quantizeBeat(rawEnd, choice, subdivisionRef.current);
    const minimum = choice === "off" ? 0.0625 : choice === "composition" ? 4 / subdivisionRef.current : choice === "quarter" ? 1 : choice === "eighth" ? 0.5 : choice === "triplet" ? 1 / 3 : 0.25;
    onCaptureRef.current({ pitch, startBeat: start, durationBeats: Math.max(minimum, finish - start), velocity: Math.max(0.05, Math.min(1, velocity)), sectionId: captureStart.current.sectionId, trackId: captureStart.current.trackId, measureIndex: captureStart.current.measureIndex });
  };

  useEffect(() => () => { if (audioPreview) URL.revokeObjectURL(audioPreview); }, [audioPreview]);

  function chooseAudio(file?: File) {
    if (audioPreview) URL.revokeObjectURL(audioPreview);
    setAudioFile(file ?? null);
    setTranscription([]);
    setWaveform([]);
    setDetectedTempo(null);
    setAudioDuration(0);
    setAudioPosition(0);
    setAudioPreview(file ? URL.createObjectURL(file) : "");
    setTranscriptionStatus(file ? `${file.name} selected. Audio will be analyzed locally in this browser.` : "Choose a short audio recording to suggest a single-note melody.");
  }

  async function analyzeAudio() {
    if (!audioFile) return;
    if (audioFile.size > 25_000_000) { setTranscriptionStatus("Choose an audio file smaller than 25 MB."); return; }
    if (typeof AudioContext === "undefined") { setTranscriptionStatus("Audio analysis is unavailable in this browser."); return; }
    setTranscribing(true);
    setTranscriptionStatus("Analyzing pitch locally…");
    let context: AudioContext | undefined;
    try {
      context = new AudioContext();
      const decoded = await context.decodeAudioData(await audioFile.arrayBuffer());
      if (decoded.duration > 30) throw new Error("Choose a clip up to 30 seconds long so the note suggestions stay responsive.");
      const channel = decoded.getChannelData(0);
      const windowSize = Math.min(8192, 2 ** Math.floor(Math.log2(channel.length)));
      if (windowSize < 1024) throw new Error("Choose a recording at least a fraction of a second long.");
      const hop = Math.max(1024, Math.floor(windowSize / 2));
      const frame = new Float32Array(windowSize);
      const candidates: Array<{ pitch: number | null; confidence: number; pitches: number[]; at: number; energy: number }> = [];
      for (let offset = 0; offset + windowSize <= channel.length; offset += hop) {
        frame.set(channel.subarray(offset, offset + windowSize));
        let energy = 0;
        for (const sample of frame) energy += sample * sample;
        const estimate = transcriptionMode === "melody" ? estimateSongPitchWithConfidence(frame, decoded.sampleRate) : null;
        candidates.push({ pitch: estimate?.pitch ?? null, confidence: estimate?.confidence ?? 0, pitches: transcriptionMode === "polyphonic" ? estimateSongPitches(frame, decoded.sampleRate) : [], at: offset / decoded.sampleRate, energy: Math.sqrt(energy / frame.length) });
      }
      const buckets = 180;
      const points = Array.from({ length: buckets }, (_, index) => {
        const from = Math.floor(index * channel.length / buckets);
        const to = Math.max(from + 1, Math.floor((index + 1) * channel.length / buckets));
        let peak = 0;
        for (let sample = from; sample < Math.min(channel.length, to); sample += 1) peak = Math.max(peak, Math.abs(channel[sample]));
        return peak;
      });
      setWaveform(points);
      setAudioDuration(decoded.duration);
      setDetectedTempo(estimateTempoFromEnvelope(candidates.map((item) => item.energy), hop / decoded.sampleRate));
      const notes: TranscribedNote[] = [];
      if (transcriptionMode === "polyphonic") {
        const active = new Map<number, { startSeconds: number; frames: number }>();
        const finish = (pitch: number, end: number) => { const note = active.get(pitch); if (note && note.frames >= 2 && end - note.startSeconds >= 0.09) notes.push({ pitch, startSeconds: note.startSeconds, durationSeconds: end - note.startSeconds, stability: note.frames }); active.delete(pitch); };
        for (const frameCandidate of candidates) {
          const present = new Set(frameCandidate.pitches);
          for (const pitch of [...active.keys()]) if (!present.has(pitch)) finish(pitch, frameCandidate.at);
          for (const pitch of present) {
            const note = active.get(pitch);
            if (note) note.frames += 1;
            else active.set(pitch, { startSeconds: frameCandidate.at, frames: 1 });
          }
        }
        for (const pitch of [...active.keys()]) finish(pitch, decoded.duration);
      } else {
        const state: { active: { pitch: number; startSeconds: number; frames: number; confidenceTotal: number } | null } = { active: null };
        const finish = (end: number) => { const active = state.active; if (active && active.frames >= 2 && end - active.startSeconds >= 0.09) notes.push({ pitch: active.pitch, startSeconds: active.startSeconds, durationSeconds: end - active.startSeconds, confidence: active.confidenceTotal / active.frames }); state.active = null; };
        for (let index = 0; index < candidates.length; index += 1) {
          const current = candidates[index];
          const next = candidates[index + 1];
          const stable = current.pitch !== null && next?.pitch === current.pitch ? current.pitch : null;
          const active = state.active;
          const activePitch: number | undefined = active?.pitch;
          if (stable !== null && activePitch !== stable) { finish(current.at); state.active = { pitch: stable, startSeconds: current.at, frames: 1, confidenceTotal: current.confidence }; }
          else if (stable !== null && active) { active.frames += 1; active.confidenceTotal += current.confidence; }
          else if (active && current.pitch !== active.pitch) finish(current.at);
        }
        finish(decoded.duration);
      }
      notes.sort((left, right) => left.startSeconds - right.startSeconds || left.pitch - right.pitch);
      setTranscription(notes);
      const tempoText = estimateTempoFromEnvelope(candidates.map((item) => item.energy), hop / decoded.sampleRate);
      setTranscriptionStatus(notes.length ? `${notes.length} ${transcriptionMode === "polyphonic" ? "pitch" : "note"} suggestions found. Review pitch and timing before adding them.${tempoText ? ` Beat estimate: about ${tempoText} BPM.` : ""}` : `No clear ${transcriptionMode === "polyphonic" ? "pitches" : "single-note line"} detected. Try a cleaner recording or the other analysis mode.`);
    } catch (error) {
      setTranscriptionStatus(error instanceof Error ? error.message : "Could not decode this audio file.");
    } finally {
      await context?.close().catch(() => undefined);
      setTranscribing(false);
    }
  }

  function importTranscription() {
    const beatSeconds = 60 / (composition.bpm || 90);
    const groups: TranscribedNote[][] = [];
    for (const note of transcription) {
      const current = groups.at(-1);
      if (transcriptionMode === "polyphonic" && current && Math.abs(current[0].startSeconds - note.startSeconds) <= 0.09) current.push(note);
      else groups.push([note]);
    }
    for (const group of groups) {
      const note = group[0];
      const noteStartBeat = quantizeBeat(startBeat + note.startSeconds / beatSeconds, quantize, composition.subdivision);
      const noteEndBeat = quantizeBeat(startBeat + (note.startSeconds + note.durationSeconds) / beatSeconds, quantize, composition.subdivision);
      const minimum = quantize === "off" ? 0.0625 : quantize === "composition" ? 4 / composition.subdivision : quantize === "quarter" ? 1 : quantize === "eighth" ? 0.5 : quantize === "triplet" ? 1 / 3 : 0.25;
      onCapture({ pitch: group.length > 1 ? group.map((item) => item.pitch) : note.pitch, startBeat: noteStartBeat, durationBeats: Math.max(minimum, noteEndBeat - noteStartBeat), velocity: 0.72, sectionId, trackId: track.id, measureIndex });
    }
    setTranscriptionStatus(`${transcription.length} note suggestions added to ${track.name}.`);
    setTranscription([]);
  }

  async function connectMidi() {
    const request = (navigator as Navigator & { requestMIDIAccess?: (options?: { sysex: boolean }) => Promise<MidiAccessLike> }).requestMIDIAccess;
    if (!request) { onMessage("This browser does not support MIDI input. Try a Chromium-based browser over HTTPS or localhost."); return; }
    try {
      const access = await request.call(navigator, { sysex: false });
      accessRef.current = access;
      const refresh = () => {
        const next = [...access.inputs.values()].map((input) => ({ id: input.id, name: input.name || "MIDI device" }));
        setInputs(next);
        setInputId((current) => next.some((input) => input.id === current) ? current : next[0]?.id ?? "");
      };
      access.onstatechange = refresh;
      refresh();
      setMidiReady(true);
      onMessage("MIDI input is ready. Arm capture, then play notes on your connected device.");
    } catch {
      onMessage("MIDI access was unavailable. Check browser permission and the connected device.");
    }
  }

  useEffect(() => {
    const input = [...(accessRef.current?.inputs.values() ?? [])].find((item) => item.id === inputId);
    if (!input) return;
    input.onmidimessage = ({ data }) => {
      if (!midiArmed || data.length < 3) return;
      const command = data[0] & 0xf0;
      const pitch = data[1];
      const velocity = data[2] / 127;
      const now = performance.now();
      if (command === 0x90 && velocity > 0) {
        activeNotes.current.set(pitch, { at: now, velocity });
      } else if (command === 0x80 || command === 0x90 && velocity === 0) {
        const active = activeNotes.current.get(pitch);
        if (active) { commit(pitch, active.at, now, active.velocity); activeNotes.current.delete(pitch); }
      }
    };
    return () => { input.onmidimessage = null; };
  }, [inputId, midiArmed, startBeat, composition.bpm, composition.subdivision]);

  function endMidiCapture() {
    const now = performance.now();
    activeNotes.current.forEach((note, pitch) => commit(pitch, note.at, now, note.velocity));
    activeNotes.current.clear();
    setMidiArmed(false);
  }

  function armMidiCapture() {
    activeNotes.current.clear();
    captureStart.current = { at: performance.now(), beat: startBeat, sectionId, trackId: track.id, measureIndex };
    setMidiArmed(true);
  }

  function finishMicNote(at = performance.now()) {
    const current = currentMicNote.current;
    if (current) commit(current.pitch, current.at, at, current.velocity);
    currentMicNote.current = null;
  }
  finishMicNoteRef.current = finishMicNote;

  async function startMicrophone() {
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === "undefined") { setMicStatus("Microphone capture is unavailable in this browser."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0;
      context.createMediaStreamSource(stream).connect(analyser);
      streamRef.current = stream;
      contextRef.current = context;
      analyserRef.current = analyser;
      captureStart.current = { at: performance.now(), beat: startBeat, sectionId, trackId: track.id, measureIndex };
      currentMicNote.current = null;
      candidatePitch.current = null;
      setMicActive(true);
      setMicStatus("Listening for a single-note melody. Audio stays in this browser and is not saved.");
      const samples = new Float32Array(analyser.fftSize);
      micTimerRef.current = window.setInterval(() => {
        analyser.getFloatTimeDomainData(samples);
        const detected = estimateSongPitch(samples, context.sampleRate);
        const now = performance.now();
        const previous = candidatePitch.current;
        candidatePitch.current = { pitch: detected, count: previous?.pitch === detected ? (previous.count + 1) : 1 };
        const stable = candidatePitch.current.count >= 2 ? detected : null;
        const active = currentMicNote.current;
        if (stable !== null && active?.pitch !== stable) {
          finishMicNote(now);
          currentMicNote.current = { pitch: stable, at: now - 80, velocity: 0.72 };
          setMicStatus(`Detected ${songPitchName(stable)} · play one note at a time.`);
        } else if (stable === null && active && now - active.at > 180) {
          finishMicNote(now - 100);
        }
      }, 80);
    } catch {
      setMicStatus("Microphone permission was denied or the input device could not be opened.");
    }
  }

  function stopMicrophone() {
    if (micTimerRef.current !== null) window.clearInterval(micTimerRef.current);
    micTimerRef.current = null;
    finishMicNote();
    streamRef.current?.getTracks().forEach((item) => item.stop());
    streamRef.current = null;
    void contextRef.current?.close();
    contextRef.current = null;
    analyserRef.current = null;
    setMicActive(false);
    setMicStatus("Microphone is off.");
  }

  useEffect(() => () => {
    const now = performance.now();
    activeNotes.current.forEach((note, pitch) => commit(pitch, note.at, now, note.velocity));
    activeNotes.current.clear();
    finishMicNoteRef.current(now);
    accessRef.current && (accessRef.current.onstatechange = null);
    if (micTimerRef.current !== null) window.clearInterval(micTimerRef.current);
    streamRef.current?.getTracks().forEach((item) => item.stop());
    void contextRef.current?.close();
  }, []);

  return <details className="builder-capture" data-tool="compose">
      <summary>Enter notes from an instrument or microphone</summary>
    <p>MIDI capture records note timing, pitch, and velocity. Audio-file analysis can suggest a melody or several simultaneous pitches. Captured notes are added to {track.name} starting at the selected beat.</p>
    <div className="builder-capture-settings">
      <label>Capture timing<select value={quantize} onChange={(event) => setQuantize(event.target.value as QuantizeChoice)}><option value="composition">Snap to composition grid</option><option value="quarter">Quarter notes</option><option value="eighth">Eighth notes</option><option value="triplet">Triplets</option><option value="sixteenth">Sixteenth notes</option><option value="off">Keep detected timing</option></select></label>
      <p className="song-builder-muted">This affects MIDI capture and imported audio suggestions. You can change it before adding a transcription.</p>
    </div>
    <div className="song-builder-fields">
      <div className="builder-capture-control">
        <strong>Keyboard or MIDI instrument</strong>
        <div className="builder-inline-actions"><button className="btn" type="button" onClick={() => void connectMidi()}>{midiReady ? "Refresh MIDI devices" : "Connect MIDI"}</button>
          {inputs.length ? <label>MIDI input<select value={inputId} onChange={(event) => setInputId(event.target.value)}>{inputs.map((input) => <option value={input.id} key={input.id}>{input.name}</option>)}</select></label> : <span className="song-builder-muted">{midiReady ? "No MIDI devices found." : "Not connected"}</span>}
          <button className="btn primary" type="button" disabled={!inputs.length} aria-pressed={midiArmed} onClick={() => midiArmed ? endMidiCapture() : armMidiCapture()}>{midiArmed ? "Stop MIDI capture" : "Arm MIDI capture"}</button>
        </div>
      </div>
      <div className="builder-capture-control">
        <strong>Transcribe an audio clip</strong>
        <p className="song-builder-muted">Analysis stays in this browser. Melody mode follows one pitch; polyphonic mode suggests several stable pitches at once. Review each result before adding it.</p>
        <label>Analysis mode<select value={transcriptionMode} onChange={(event) => setTranscriptionMode(event.target.value as "melody" | "polyphonic")}><option value="melody">Single-note melody</option><option value="polyphonic">Multiple simultaneous notes</option></select></label>
        <label>Audio file · up to 30 seconds<input type="file" accept="audio/*,.wav,.mp3,.ogg,.m4a" onChange={(event) => chooseAudio(event.target.files?.[0])} /></label>
        {audioPreview ? <>
          <audio ref={audioRef} controls preload="metadata" src={audioPreview} onLoadedMetadata={(event) => setAudioDuration(event.currentTarget.duration || audioDuration)} onTimeUpdate={(event) => setAudioPosition(event.currentTarget.currentTime)} onEnded={() => setAudioPosition(0)}>Audio preview is unavailable.</audio>
          {waveform.length ? <div className="builder-audio-waveform">
            <svg viewBox="0 0 900 72" role="img" aria-label="Waveform overview of the selected audio"><title>Audio waveform</title><line x1="0" y1="36" x2="900" y2="36" /><polyline points={waveform.map((peak, index) => `${Math.round(index / Math.max(1, waveform.length - 1) * 900)},${Math.round(36 - peak * 31)}`).join(" ")} /><polyline className="builder-audio-waveform-negative" points={waveform.map((peak, index) => `${Math.round(index / Math.max(1, waveform.length - 1) * 900)},${Math.round(36 + peak * 31)}`).join(" ")} /></svg>
            <label>Audio position · {audioPosition.toFixed(1)} / {audioDuration.toFixed(1)} sec<input aria-label="Seek audio preview" type="range" min={0} max={audioDuration || 1} step={0.05} value={Math.min(audioPosition, audioDuration || 0)} onChange={(event) => { const position = Number(event.target.value); if (audioRef.current) audioRef.current.currentTime = position; setAudioPosition(position); }} /></label>
          </div> : null}
        </> : null}
        <div className="builder-inline-actions"><button className="btn" type="button" disabled={!audioFile || transcribing} onClick={() => void analyzeAudio()}>{transcribing ? "Analyzing…" : "Suggest notes"}</button><button className="btn primary" type="button" disabled={!transcription.length} onClick={importTranscription}>Add {transcription.length || "suggested"} notes</button></div>
        {detectedTempo ? <p className="builder-tempo-detection">Beat estimate: <strong>about {detectedTempo} BPM</strong>. {detectedTempo === composition.bpm ? "This matches the current tempo." : <button className="text-button" type="button" onClick={() => { onTempoDetected?.(detectedTempo); setTranscriptionStatus(`Composition tempo set to ${detectedTempo} BPM. Review the note timing again before adding it.`); }}>Use {detectedTempo} BPM</button>}</p> : null}
        <span className="song-builder-muted" role="status" aria-live="polite">{transcriptionStatus}</span>
        {transcription.length ? <ol className="builder-transcription-list">{transcription.slice(0, 48).map((note, index) => <li key={`${note.startSeconds}-${note.pitch}-${index}`}>
          <label>Pitch<input aria-label={`Suggestion ${index + 1} pitch`} type="number" min={28} max={96} value={note.pitch} onChange={(event) => setTranscription((current) => current.map((item, position) => position === index ? { ...item, pitch: Math.max(28, Math.min(96, Number(event.target.value) || item.pitch)) } : item))} /><span>{songPitchName(note.pitch)} · {note.confidence !== undefined ? `${Math.round(note.confidence * 100)}% confidence` : `${note.stability ?? 1} stable windows`}</span></label>
          <label>Onset · sec<input aria-label={`Suggestion ${index + 1} onset seconds`} type="number" min={0} max={30} step={0.01} value={Number(note.startSeconds.toFixed(2))} onChange={(event) => setTranscription((current) => current.map((item, position) => position === index ? { ...item, startSeconds: Math.max(0, Math.min(30, Number(event.target.value) || 0)) } : item))} /></label>
          <label>Length · sec<input aria-label={`Suggestion ${index + 1} length seconds`} type="number" min={0.05} max={30} step={0.01} value={Number(note.durationSeconds.toFixed(2))} onChange={(event) => setTranscription((current) => current.map((item, position) => position === index ? { ...item, durationSeconds: Math.max(0.05, Math.min(30, Number(event.target.value) || 0.05)) } : item))} /></label>
          <button className="text-button" type="button" aria-label={`Remove ${songPitchName(note.pitch)} suggestion`} onClick={() => setTranscription((current) => current.filter((_, position) => position !== index))}>Remove</button>
        </li>)}</ol> : null}
      </div>
      <div className="builder-capture-control">
        <strong>Single-note microphone transcription</strong>
        <button className={`btn ${micActive ? "primary" : ""}`} type="button" aria-pressed={micActive} onClick={() => micActive ? stopMicrophone() : void startMicrophone()}>{micActive ? "Stop listening" : "Start microphone capture"}</button>
        <span className="song-builder-muted" role="status" aria-live="polite">{micStatus}</span>
      </div>
    </div>
  </details>;
}
