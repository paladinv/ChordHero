"use client";
import { useEffect, useRef, useState } from "react";
import { deleteBuilderTake, listBuilderTakes, saveBuilderTake, type BuilderTake } from "@/lib/songBuilderTakes";
export default function SongBuilderRecorder({ songId, signature, onPlay, onReplay, onStop, onMessage }: {
  songId: string;
  signature: string;
  onPlay: () => Promise<number>;
  onReplay: () => Promise<void>;
  onStop: () => void;
  onMessage: (text: string) => void;
}) {
  const [takes, setTakes] = useState<BuilderTake[]>([]);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState("");
  const [url, setUrl] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const alive = useRef(true);
  const take = takes.find(item => item.id === selected);
  const [loadingTakes, setLoadingTakes] = useState(true);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    alive.current = true; return () => {
      alive.current = false; if (recorder.current?.state === "recording")
        recorder.current.stop(); stream.current?.getTracks().forEach(track => track.stop());
    };
  }, []);
  useEffect(() => {
    let cancelled = false; setLoadingTakes(true); setLoadError(""); listBuilderTakes(songId).then(items => {
      if (!cancelled) {
        setTakes(items);
        setSelected(items.at(-1)?.id ?? "");
        setLoadingTakes(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setLoadError("Recording storage is unavailable in this browser.");
        setLoadingTakes(false);
      }
    }); return () => { cancelled = true; };
  }, [songId]);
  useEffect(() => {
    if (!take) {
      setUrl("");
      return;
    } const next = URL.createObjectURL(take.blob); setUrl(next); return () => URL.revokeObjectURL(next);
  }, [take]);
  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      onMessage("This browser does not support microphone recording.");
      return;
    } if (takes.length >= 20) {
      onMessage("Export or remove a take before recording more (20 takes per song).");
      return;
    } setBusy(true); try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true } });
      if (!alive.current) { stream.current.getTracks().forEach(track => track.stop()); return; }
      const next = new MediaRecorder(stream.current);
      recorder.current = next;
      const chunks: BlobPart[] = [];
      let offset = 0;
      next.ondataavailable = event => {
        if (event.data.size)
          chunks.push(event.data);
      };
      next.onerror = () => onMessage("Recording failed. Please try again.");
      next.onstop = async () => {
        stream.current?.getTracks().forEach(track => track.stop()); if (alive.current) {
          setRecording(false);
          onStop();
        } const saved: BuilderTake = { id: crypto.randomUUID(), songId, name: `Take ${takes.length + 1}`, notes: "", createdAt: new Date().toISOString(), offset, signature, blob: new Blob(chunks, { type: next.mimeType }) }; try {
          await saveBuilderTake(saved);
          if (alive.current) {
            setTakes(current => [...current, saved]);
            setSelected(saved.id);
            onMessage("Take saved on this device. Use headphones to keep the backing out of the microphone.");
          }
        }
        catch {
          if (alive.current)
            onMessage("The take could not be saved. Check available browser storage.");
        }
      };
      next.start();
      setRecording(true);
      const began = performance.now();
      offset = await onPlay() + (performance.now() - began) / 1000;
    }
    catch (error) {
      recorder.current?.state === "recording" && recorder.current.stop();
      stream.current?.getTracks().forEach(track => track.stop());
      onMessage(error instanceof Error ? error.message : "Microphone could not start.");
    }
    finally {
      setBusy(false);
    }
  }
  async function update(patch: Partial<BuilderTake>) {
    if (!take)
      return; const next = { ...take, ...patch }; try {
        await saveBuilderTake(next);
        setTakes(current => current.map(item => item.id === next.id ? next : item));
      }
    catch {
      onMessage("Could not save take notes.");
    }
  }
  return <section className="song-builder-card card" aria-label="Practice recording" data-song-id={songId}>
    <h2>Record a practice take</h2>
    <p>Use headphones. The microphone starts only when you select Record. Takes stay on this device; composition backups do not include their audio.</p>
    <button className="btn primary" type="button" disabled={busy} onClick={() => recording ? recorder.current?.stop() : void start()}>{busy ? "Preparing…" : recording ? "Stop recording" : "Record with arrangement"}</button>
    <p role="status">{loadingTakes ? "Loading takes…" : loadError || `${takes.length} saved takes`}</p>
    <label>Saved take<select value={selected} onChange={e => { player.current?.pause(); onStop(); setSelected(e.target.value); }}>
      <option value="">Choose a take</option>{takes.map(item => <option key={item.id} value={item.id}>{item.name} · {new Date(item.createdAt).toLocaleString()}</option>)}</select>
    </label>{take ? <>
      <label>Take name<input key={take.id + "name"} defaultValue={take.name} onBlur={e => void update({ name: e.target.value.slice(0, 80) })} />
      </label>
      <label>Practice notes<textarea key={take.id} defaultValue={take.notes} onBlur={e => void update({ notes: e.target.value.slice(0, 4000) })} />
      </label>
      <audio ref={player} controls src={url} onPause={onStop} onEnded={onStop} />
      <button className="btn" type="button" onClick={async () => {
        try {
          await onReplay();
          if (player.current) {
            player.current.currentTime = Math.min(take.offset, player.current.duration || take.offset);
            await player.current.play();
          }
        }
        catch {
          onMessage("Could not replay the take.");
        }
      }}>Replay with score</button>
      <a className="btn" href={url} download={`${take.name.replace(/[^a-z0-9-]/gi, "-")}.${take.blob.type.includes("mp4") ? "m4a" : "webm"}`}>Download take</a>
      <button className="btn" type="button" onClick={async () => {
        try {
          await deleteBuilderTake(take.id);
          setTakes(current => current.filter(item => item.id !== take.id));
          setSelected("");
        }
        catch {
          onMessage("Could not remove the take.");
        }
      }}>Remove take</button>{take.signature !== signature ? <p role="status">The score has changed since this take was recorded. Alignment may differ.</p> : null}</> : null}</section>;
}
