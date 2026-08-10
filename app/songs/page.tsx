"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChordDiagram from "../../components/ChordDiagram";
import { CHORD_LOOKUP } from "../../lib/chords";
import { playRecordedClick } from "../../lib/recordedAudio";
import sharedSongContent from "../../shared/content/v1/songs.json";
import { readSongLibraryState, simplifyChord, transposeChord } from "../../lib/songLibrary";

type Song = {
  id?: string;
  title: string;
  artist?: string;
  source: string;
  license?: string;
  difficulty: string;
  bpm: number;
  chords: string[];
  strumPattern: string;
  strumFeel: string;
  key?: string;
  timeSignature?: string;
  variations?: SongVariation[];
  sections?: { id: string; title: string; blocks: { type: string; chords?: string[] }[] }[];
};

type SongVariation = { id: string; name: string; technique: string; key: string; timeSignature: string; bpm: number; tuningId: string; capo: number; pattern: string; feel: string };
type VoiceRecognition = { continuous: boolean; lang: string; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; start: () => void; stop: () => void };
type VoiceRecognitionConstructor = new () => VoiceRecognition;
type WebMidiInput = { name?: string; onmidimessage: ((event: { data?: Uint8Array }) => void) | null };
type WebMidiAccess = { inputs: Map<string, WebMidiInput> };

type SharedSong = Omit<Song, "chords" | "strumPattern" | "strumFeel"> & { id: string; sections: { id: string; title: string; blocks: { type: string; chords?: string[] }[] }[]; variations: SongVariation[] };

const LEGACY_SONGS: Song[] = [
  {
    title: "Amazing Grace",
    source: "Public domain hymn",
    difficulty: "easy",
    bpm: 80,
    chords: ["G", "C", "G", "D", "G", "Em", "G", "D", "G"],
    strumPattern: "D - D - D - D -",
    strumFeel: "Slow 4/4, let the chords ring."
  },
  {
    title: "Oh! Susanna",
    source: "Public domain folk",
    difficulty: "easy",
    bpm: 92,
    chords: ["C", "F", "C", "G", "C", "F", "C", "G", "C"],
    strumPattern: "D D U U D U",
    strumFeel: "Classic pop feel at 8th notes."
  },
  {
    title: "This Little Light of Mine",
    source: "Traditional spiritual",
    difficulty: "easy",
    bpm: 96,
    chords: ["G", "C", "G", "D", "G", "C", "G", "D", "G"],
    strumPattern: "D - D U - U D U",
    strumFeel: "Gospel swing; keep the upstrokes light."
  },
  {
    title: "Scarborough Fair",
    source: "Traditional English ballad",
    difficulty: "medium",
    bpm: 84,
    chords: ["Am", "C", "Am", "G", "Am", "C", "Am", "Em"],
    strumPattern: "D - D - D U - U",
    strumFeel: "Gentle folk ballad."
  },
  {
    title: "Greensleeves",
    source: "Traditional English folk",
    difficulty: "medium",
    bpm: 88,
    chords: ["Am", "G", "F", "E", "Am", "C", "G", "E", "Am"],
    strumPattern: "D - D U - U D U",
    strumFeel: "Waltz-like flow, keep the bass strong."
  },
  {
    title: "When the Saints Go Marching In",
    source: "Traditional jazz standard",
    difficulty: "easy",
    bpm: 100,
    chords: ["C", "F", "C", "G", "C", "F", "C", "G", "C"],
    strumPattern: "D D D D",
    strumFeel: "March feel, accent beats 1 and 3."
  },
  {
    title: "House of the Rising Sun (Trad.)",
    source: "Traditional folk",
    difficulty: "medium",
    bpm: 78,
    chords: ["Am", "C", "D", "F", "Am", "C", "E", "E"],
    strumPattern: "D - D - D U - U",
    strumFeel: "Slow arpeggiated vibe; strum softly."
  },
  {
    title: "Skip to My Lou",
    source: "Traditional American folk",
    difficulty: "easy",
    bpm: 104,
    chords: ["G", "C", "G", "D", "G", "C", "G", "D", "G"],
    strumPattern: "D D U U D U",
    strumFeel: "Bright, bouncy folk."
  },
  {
    title: "The Red River Valley",
    source: "Traditional folk",
    difficulty: "easy",
    bpm: 90,
    chords: ["G", "C", "G", "D", "G", "C", "G", "D", "G"],
    strumPattern: "D - D - D - D -",
    strumFeel: "Ballad timing, let chords ring."
  },
  {
    title: "Shenandoah",
    source: "Traditional folk",
    difficulty: "medium",
    bpm: 72,
    chords: ["G", "D", "Em", "C", "G", "D", "G"],
    strumPattern: "D - D - D U - U",
    strumFeel: "Slow, wide strums."
  },
  {
    title: "The Bear Went Over the Mountain",
    source: "Traditional folk",
    difficulty: "easy",
    bpm: 102,
    chords: ["C", "G", "C", "F", "C", "G", "C"],
    strumPattern: "D D U U D U",
    strumFeel: "Playful campfire groove."
  },
  {
    title: "Auld Lang Syne",
    source: "Traditional Scottish",
    difficulty: "medium",
    bpm: 80,
    chords: ["G", "C", "G", "D", "G", "C", "G", "D", "G"],
    strumPattern: "D - D - D - D -",
    strumFeel: "Slow, stately feel."
  }
];

const LEGACY_CHORD_TIPS: Record<
  string,
  { fingering: string; transition: string; commonMistake: string }
> = {
  C: {
    fingering: "Index on B1, middle on D2, ring on A3. Let high E ring.",
    transition: "Pivot your ring finger when moving between C and Am/F.",
    commonMistake: "Mute the high E string; keep it open."
  },
  G: {
    fingering: "Ring on low E3, middle on A2, pinky on high E3.",
    transition: "Keep ring/pinky planted when moving to D or Em.",
    commonMistake: "Letting the B string mute; curl your fingers."
  },
  D: {
    fingering: "Index on G2, ring on B3, middle on high E2.",
    transition: "Make a triangle shape and lift together for quick changes.",
    commonMistake: "Low strings ringing; mute low E/A."
  },
  Em: {
    fingering: "Middle on A2, ring on D2.",
    transition: "Slide from G by dropping the middle finger first.",
    commonMistake: "Pressing too hard; keep it relaxed."
  },
  Am: {
    fingering: "Index on B1, middle on D2, ring on G2.",
    transition: "From C, keep the index on B1 and pivot.",
    commonMistake: "B string muted; keep knuckles arched."
  },
  F: {
    fingering: "Barre at 1st fret, ring on A3, pinky on D3, middle on G2.",
    transition: "Practice mini-barre on B/E first, then add bass.",
    commonMistake: "Buzzing on high strings; roll index slightly."
  },
  E: {
    fingering: "Index on G1, middle on A2, ring on D2.",
    transition: "Move as a block from Em (add index).",
    commonMistake: "Muted G string; keep index arched."
  },
  A: {
    fingering: "Index on D2, middle on G2, ring on B2.",
    transition: "Keep fingers compact to avoid muting high E.",
    commonMistake: "High E muted; angle fingers toward the nut."
  }
};

// The literals above remain temporarily as an authoring/reference source; both web and native
// runtime behavior is driven by the versioned cross-platform content contract.
const SONGS: Song[] = (sharedSongContent.songs as unknown as SharedSong[]).map((song) => ({
  ...song,
  chords: song.sections.flatMap((section) => section.blocks.flatMap((block) => block.type === "chords" ? block.chords ?? [] : [])),
  strumPattern: song.variations[0]?.pattern ?? "D - D -",
  strumFeel: song.variations[0]?.feel ?? "Practice the changes slowly."
}));
const CHORD_TIPS = sharedSongContent.chordTips as Record<
  string,
  { fingering: string; transition: string; commonMistake: string }
>;

void LEGACY_SONGS;
void LEGACY_CHORD_TIPS;

export default function SongsPage() {
  const [songIndex, setSongIndex] = useState(0);
  const [songStep, setSongStep] = useState(0);
  const [songStatus, setSongStatus] = useState<"idle" | "countin" | "running" | "paused">("idle");
  const [metronomeOn, setMetronomeOn] = useState(true);
  const [songTempoBpm, setSongTempoBpm] = useState(SONGS[0]?.bpm ?? 90);
  const [songBeatsPerChord, setSongBeatsPerChord] = useState(4);
  const [songBeat, setSongBeat] = useState(0);
  const [songCountIn, setSongCountIn] = useState(4);
  const [variationId, setVariationId] = useState(SONGS[0]?.variations?.[0]?.id ?? "");
  const [transpose, setTranspose] = useState(0);
  const [largePrint, setLargePrint] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [simplifyMode, setSimplifyMode] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [midiStatus, setMidiStatus] = useState("MIDI pedal not connected");
  const [loopSectionId, setLoopSectionId] = useState<string | null>(null);
  const [setlistSongIds, setSetlistSongIds] = useState<string[]>([]);

  const songTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const midiCleanupRef = useRef<(() => void) | null>(null);

  const activeSong = SONGS[songIndex];
  const activeVariation = activeSong.variations?.find((variation) => variation.id === variationId) ?? activeSong.variations?.[0];
  const displayedChords = activeSong.chords.map((chord) => transposeChord(simplifyMode ? simplifyChord(chord) : chord, transpose));
  const sectionRanges = useMemo(() => {
    let cursor = 0;
    return (activeSong.sections ?? []).map((section) => { const length = section.blocks.flatMap((block) => block.type === "chords" ? block.chords ?? [] : []).length; const range = { ...section, start: cursor, end: Math.max(cursor, cursor + length - 1) }; cursor += length; return range; });
  }, [activeSong]);
  const loopRange = sectionRanges.find((section) => section.id === loopSectionId);
  const loopStart = loopRange?.start;
  const loopEnd = loopRange?.end;
  const currentSongChordName = displayedChords[Math.min(Math.max(songStep, loopRange?.start ?? 0), loopRange?.end ?? displayedChords.length - 1)];
  const currentSongChord = CHORD_LOOKUP.get(currentSongChordName) ?? null;
  const songTempoMs = Math.round(60000 / songTempoBpm);

  const resetSong = useCallback(() => {
    setSongStep(loopStart ?? 0); setSongBeat(0); setSongCountIn(4); setSongStatus("idle");
  }, [loopStart]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedSongId = params.get("songId");
    const nextIndex = Math.max(0, SONGS.findIndex((song) => song.id === requestedSongId));
    const requestedVariationId = params.get("variationId");
    const requestedSetlistId = params.get("setlistId");
    if (requestedSetlistId) setSetlistSongIds(readSongLibraryState().setlists.find((setlist) => setlist.id === requestedSetlistId)?.entries.map((entry) => entry.songId) ?? []);
    if (requestedSongId && SONGS[nextIndex]) {
      setSongIndex(nextIndex);
      setSongTempoBpm(SONGS[nextIndex].bpm);
      setVariationId(requestedVariationId ?? SONGS[nextIndex].variations?.[0]?.id ?? "");
      setTranspose(Number(params.get("transpose") ?? 0));
      setLargePrint(params.get("largePrint") === "1");
      setHandsFree(params.get("handsFree") === "1");
      setSimplifyMode(params.get("simplify") === "1");
    }
  }, []);

  useEffect(() => {
    if (!handsFree) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.code === "Space") { event.preventDefault(); setSongStatus((status) => status === "running" || status === "countin" ? "paused" : "running"); }
      if (event.key.toLowerCase() === "r") resetSong();
    };
    window.addEventListener("keydown", handleKey);
    const Recognition = (window as Window & { webkitSpeechRecognition?: VoiceRecognitionConstructor }).webkitSpeechRecognition;
    const recognition = Recognition ? new Recognition() : null;
    if (recognition) {
      recognition.continuous = true; recognition.lang = "en-US";
      recognition.onresult = (event) => { const command = event.results[event.results.length - 1][0].transcript.toLowerCase(); if (command.includes("pause")) setSongStatus("paused"); else if (command.includes("resume") || command.includes("start")) setSongStatus("running"); else if (command.includes("reset")) resetSong(); setVoiceStatus(`Heard: ${command}`); };
      try { recognition.start(); } catch { setVoiceStatus("Use Space to pause/resume; voice control is unavailable."); }
    } else setVoiceStatus("Use Space to pause/resume; voice control is unavailable.");
    return () => { window.removeEventListener("keydown", handleKey); try { recognition?.stop(); } catch { /* no-op */ } };
  }, [handsFree, resetSong]);

  const enableMidi = useCallback(async () => {
    const requestMidi = (navigator as Navigator & { requestMIDIAccess?: () => Promise<WebMidiAccess> }).requestMIDIAccess;
    if (!requestMidi) { setMidiStatus("Web MIDI is unavailable in this browser."); return; }
    try {
      const access = await requestMidi.call(navigator);
      const inputs = [...access.inputs.values()];
      const onMessage = (event: { data?: Uint8Array }) => { const data = event.data ?? new Uint8Array(); const status = data[0] & 0xf0; const note = data[1]; if (status !== 0x90 || !data[2]) return; if (note === 60) setSongStatus((value) => value === "running" || value === "countin" ? "paused" : "running"); else if (note === 62) setSongStep((value) => Math.min(value + 1, displayedChords.length - 1)); else if (note === 64) resetSong(); };
      inputs.forEach((input) => { input.onmidimessage = onMessage; });
      midiCleanupRef.current = () => inputs.forEach((input) => { input.onmidimessage = null; });
      setMidiStatus(inputs.length ? `${inputs.length} MIDI input${inputs.length === 1 ? "" : "s"} ready · C4 play/pause · D4 next · E4 reset` : "MIDI access granted; no inputs found.");
    } catch { setMidiStatus("MIDI permission was not granted."); }
  }, [displayedChords.length, resetSong]);

  useEffect(() => () => { midiCleanupRef.current?.(); }, []);

  const advanceToNextSong = () => {
    const setlistPosition = setlistSongIds.indexOf(activeSong?.id ?? "");
    const queuedSongId: string | undefined = setlistPosition >= 0 && setlistSongIds.length > 0 ? setlistSongIds[(setlistPosition + 1) % setlistSongIds.length] : undefined;
    const queuedIndex = queuedSongId === undefined ? -1 : SONGS.findIndex((song) => song.id === queuedSongId);
    const nextIndex = queuedIndex >= 0 ? queuedIndex : (songIndex + 1) % SONGS.length;
    setSongIndex(nextIndex);
    setSongTempoBpm(SONGS[nextIndex]?.bpm ?? 90);
    setVariationId(SONGS[nextIndex]?.variations?.[0]?.id ?? "");
    setTranspose(0);
    resetSong();
  };

  const ensureAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const playClick = useCallback(async (frequency = 900) => {
    if (!metronomeOn) return;
    const ctx = await ensureAudioContext();
    const played = await playRecordedClick(ctx, { accent: frequency >= 900, volume: 0.25 });
    if (played) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = frequency;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.3, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.09);
  }, [ensureAudioContext, metronomeOn]);

  useEffect(() => {
    if (songStatus !== "running" && songStatus !== "countin") return;
    if (songTimer.current) {
      clearInterval(songTimer.current);
    }
    songTimer.current = setInterval(() => {
      if (songStatus === "countin") {
        setSongCountIn((previous) => {
          const next = previous - 1;
          if (next <= 0) {
            setSongStatus("running");
            setSongBeat(0);
            return 0;
          }
          return next;
        });
        return;
      }
      setSongBeat((previousBeat) => {
        const nextBeat = previousBeat + 1;
        if (nextBeat >= songBeatsPerChord) {
          setSongStep((previousStep) => {
            const nextStep = previousStep + 1;
            if (nextStep > (loopEnd ?? displayedChords.length - 1)) {
              if (loopStart !== undefined) return loopStart;
              setSongStatus("paused");
              return previousStep;
            }
            return nextStep;
          });
          return 0;
        }
        return nextBeat;
      });
    }, songTempoMs);
    return () => {
      if (songTimer.current) {
        clearInterval(songTimer.current);
      }
    };
  }, [displayedChords.length, loopEnd, loopStart, songBeatsPerChord, songStatus, songTempoMs]);

  useEffect(() => {
    if (!metronomeOn) return;
    if (songStatus === "running" || songStatus === "countin") {
      playClick(songBeat === 0 ? 900 : 700);
    }
  }, [metronomeOn, playClick, songStatus, songBeat, songCountIn]);

  const handleSongStart = async () => {
    await ensureAudioContext();
    setSongStep(loopStart ?? 0);
    setSongBeat(0);
    setSongCountIn(4);
    setSongStatus("countin");
  };

  return (
    <main className={`page focused-page songs-page ${largePrint ? "song-coach-large-print" : ""}`}>
      <section className="studio-heading songs-heading">
        <div>
          <span className="tag">Song Coach</span>
          <h1>Turn chord changes into music.</h1>
          <p>Choose a traditional tune, set a comfortable tempo, and follow the progression one change at a time.</p>
        </div>
        <div className="studio-session-note" aria-label="Play-along recommendation">
          <span className="label">A good first pass</span>
          <strong>{activeSong.title} · {activeSong.bpm} BPM</strong>
          <span>Listen through once, then join after the four-count.</span>
        </div>
      </section>

      <section className="song-coach song-coach-page">
        <div className="song-card">
          <div className="song-meta">
            <label className="label" htmlFor="song-select">
              Choose a song
            </label>
            <select
              id="song-select"
              value={songIndex}
              onChange={(event) => {
                const nextIndex = Number(event.target.value);
                setSongIndex(nextIndex);
                setSongTempoBpm(SONGS[nextIndex]?.bpm ?? 90);
                setVariationId(SONGS[nextIndex]?.variations?.[0]?.id ?? "");
                setTranspose(0);
                setSongStep(0);
                setSongBeat(0);
                setSongCountIn(4);
                setSongStatus("idle");
              }}
            >
              {SONGS.map((song, index) => (
                <option key={song.title} value={index}>
                  {song.title} - {song.difficulty}
                </option>
              ))}
            </select>
            <p className="song-source">{activeSong.source}</p>
            <p className="song-source">{activeSong.artist ?? "Traditional"} · {activeSong.key ?? "C"} · {activeSong.timeSignature ?? "4/4"}</p>
            <div className="beats-control">
              <span className="label">Arrangement</span>
              <div className="chip-row">
                {(activeSong.variations ?? []).map((variation) => (
                  <button key={variation.id} type="button" className={`chip ${activeVariation?.id === variation.id ? "active" : ""}`} onClick={() => { setVariationId(variation.id); setSongTempoBpm(variation.bpm); }}>
                    {variation.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="tempo-control">
              <label className="label" htmlFor="song-tempo">
                Tempo: {songTempoBpm} BPM
              </label>
              <input
                id="song-tempo"
                type="range"
                min={60}
                max={140}
                step={2}
                value={songTempoBpm}
                onChange={(event) => setSongTempoBpm(Number(event.target.value))}
              />
            </div>
            <div className="beats-control">
              <span className="label">Transpose</span>
              <div className="chip-row">
                {[-2, -1, 0, 1, 2].map((semitones) => <button key={semitones} type="button" className={`chip ${transpose === semitones ? "active" : ""}`} onClick={() => { setTranspose(semitones); setSongStatus("idle"); }}>{semitones === 0 ? "Original" : `${semitones > 0 ? "+" : ""}${semitones}`}</button>)}
              </div>
            </div>
            <div className="beats-control">
              <span className="label">Beats per chord</span>
              <div className="chip-row">
                {[2, 4, 6].map((beats) => (
                  <button
                    key={beats}
                    type="button"
                    className={`chip ${songBeatsPerChord === beats ? "active" : ""}`}
                    onClick={() => setSongBeatsPerChord(beats)}
                  >
                    {beats} beats
                  </button>
                ))}
              </div>
            </div>
            <div className="beats-control">
              <span className="label">Section loop</span>
              <div className="chip-row"><button type="button" className={`chip ${loopSectionId === null ? "active" : ""}`} onClick={() => setLoopSectionId(null)}>Full song</button>{sectionRanges.map((section) => <button key={section.id} type="button" className={`chip ${loopSectionId === section.id ? "active" : ""}`} onClick={() => { setLoopSectionId(section.id); setSongStep(section.start); setSongStatus("idle"); }}>{section.title}</button>)}</div>
            </div>
            <div className="song-controls">
              <button className="btn primary" onClick={handleSongStart}>
                Start lesson
              </button>
              <button
                className="btn"
                onClick={() => setSongStatus("paused")}
                disabled={songStatus !== "running" && songStatus !== "countin"}
              >
                Pause
              </button>
              <button
                className="btn"
                onClick={() => setSongStatus("running")}
                disabled={songStatus !== "paused"}
              >
                Resume
              </button>
              <button className="btn ghost" onClick={resetSong}>
                Reset
              </button>
              <button
                className={`btn ${metronomeOn ? "primary" : ""}`}
                onClick={() => setMetronomeOn((previous) => !previous)}
              >
                {metronomeOn ? "Metronome on" : "Metronome off"}
              </button>
              <button className={`btn ${handsFree ? "primary" : ""}`} onClick={() => setHandsFree((value) => !value)} aria-pressed={handsFree}>{handsFree ? "Hands-free on" : "Hands-free mode"}</button>
              <button className="btn" onClick={() => void enableMidi()}>Connect MIDI pedal</button>
              <button className="btn" onClick={() => window.print()}>Print lead sheet</button>
            </div>
            {(handsFree || midiStatus !== "MIDI pedal not connected") && <p className="muted" role="status">{voiceStatus || "Space pauses/resumes. Say start, pause, resume, or reset."} · {midiStatus}</p>}
            <div className="song-guidance">
              <div className="song-guidance-card">
                <span className="label">Strumming pattern</span>
                <p className="strum-pattern">{activeVariation?.pattern ?? activeSong.strumPattern}</p>
                <p className="muted">{activeVariation?.feel ?? activeSong.strumFeel}</p>
              </div>
              <div className="song-guidance-card">
                <span className="label">Count-in</span>
                <p className="muted">4 clicks before we start. Tap start, then get ready.</p>
              </div>
            </div>
          </div>
          <div className="song-progress">
            <span className="label">Current chord</span>
            <h3>{currentSongChordName}</h3>
            <p>
              Step {Math.min(songStep + 1, displayedChords.length)} of {displayedChords.length} -
              Beat {songBeat + 1} of {songBeatsPerChord}
            </p>
            {songStatus === "countin" && (
              <div className="count-in">
                <span className="label">Count-in</span>
                <p>Starting in {songCountIn}...</p>
              </div>
            )}
            <div className="diagram-wrap">
              {currentSongChord ? <ChordDiagram chord={currentSongChord} /> : <div className="diagram-empty" />}
            </div>
            {CHORD_TIPS[currentSongChordName] && (
              <div className="song-tip">
                <span className="label">Chord tips</span>
                <p>
                  <strong>Fingering:</strong> {CHORD_TIPS[currentSongChordName].fingering}
                </p>
                <p>
                  <strong>Transition:</strong> {CHORD_TIPS[currentSongChordName].transition}
                </p>
                <p>
                  <strong>Common mistake:</strong> {CHORD_TIPS[currentSongChordName].commonMistake}
                </p>
              </div>
            )}
            <div className="song-chords">
              {displayedChords.map((chord, index) => (
                <span
                  key={`${chord}-${index}`}
                  className={`song-chip ${index === songStep ? "active" : ""}`}
                >
                  {chord}
                </span>
              ))}
            </div>
            {songStatus === "paused" && <button className="btn primary next-song-button" type="button" onClick={advanceToNextSong}>Launch next song · {SONGS[(songIndex + 1) % SONGS.length]?.title}</button>}
          </div>
        </div>
      </section>
    </main>
  );
}
