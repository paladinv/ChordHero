"use client";

import { useMemo, useState } from "react";
import type { LibrarySong, SongComposition, SongCompositionEvent, SongCompositionMeasure, SongCompositionSection, SongCompositionTrack } from "@/lib/songLibrary";
import { alignSectionLyrics, checkComposition, editMeasure, eventLabel, pasteMeasures, suggestHarmonicChords, suggestVoicings, TECHNIQUES } from "@/lib/songBuilderEditing";
import { writeAcrossBars } from "@/lib/songBuilderStudio";
import { eventMidiPitches, measureQuarterBeats, SONG_BUILDER_DRUMS, songBuilderDrumName } from "@/lib/songBuilder";
import { createSongBuilderAudio } from "@/lib/songBuilderAudio";

export type PracticeSettings = { enabled: boolean; start: number; end: number; beat: number; countIn: boolean; increase: number; maximum: number };
export type ScoreSettings = { barsPerLine: number; trackId: string; diagrams: boolean; sectionBreaks: boolean; paper: "letter" | "a4"; orientation: "landscape" | "portrait" };
type Props = {
  workspace: "compose" | "arrange" | "practice" | "export";
  song: LibrarySong; composition: SongComposition; section: SongCompositionSection; track: SongCompositionTrack; measureIndex: number;
  selectedEventId: string; onSelectEvent: (id: string) => void; onChange: (composition: SongComposition) => void;
  onMessage: (message: string) => void; onLocate: (sectionId: string, trackId: string, measureIndex: number) => void;
  practice: PracticeSettings; onPractice: (settings: PracticeSettings) => void; score: ScoreSettings; onScore: (settings: ScoreSettings) => void;
  onDownload: (format: "midi" | "musicxml") => void; onImport: (file: File) => void;
  onRevision: (name: string) => void; onRestore: (composition: SongComposition) => void;
};

export default function SongBuilderTools(props: Props) {
  const { song, composition, section, track, measureIndex, selectedEventId, onSelectEvent, onChange, practice, onPractice, score, onScore } = props;
  const [rangeStart, setRangeStart] = useState(1); const [rangeEnd, setRangeEnd] = useState(1);
  const [clipboard, setClipboard] = useState<SongCompositionMeasure[]>([]); const [transpose, setTranspose] = useState(0); const [shift, setShift] = useState(0);
  const [revisionName, setRevisionName] = useState("");
  const measures = section.measuresByTrack[track.id] ?? [];
  const measure = measures[measureIndex]; const event = measure?.events.find((item) => item.id === selectedEventId);
  const issues = useMemo(() => checkComposition(composition), [composition]);
  const previous = measures.flatMap((bar, barIndex) => bar.events.filter((item) => item.kind === "chord" && (barIndex < measureIndex || barIndex === measureIndex && item.startBeat < (event?.startBeat ?? Infinity))).map((item) => ({ item, barIndex }))).sort((left, right) => left.barIndex - right.barIndex || left.item.startBeat - right.item.startBeat).at(-1)?.item.voicing;
  const chord = event?.kind === "chord" ? event.chord ?? "C" : "C";
  const voicings = useMemo(() => suggestVoicings(track, chord, previous), [track, chord, previous]);
  const harmonicChords = useMemo(() => suggestHarmonicChords(composition.key, chord), [composition.key, chord]);
  const fretted = ["guitar", "ukulele", "bass"].includes(track.instrument);
  const changeEvent = (patch: Partial<SongCompositionEvent>) => { if (!event)return;try{if(patch.durationBeats!==undefined||patch.startBeat!==undefined)onChange(writeAcrossBars(composition,section.id,track.id,measureIndex,{...event,...patch},event.id));else onChange(editMeasure(composition, section.id, track.id, measureIndex, (current) => ({ ...current, events: current.events.map((item) => item.id === event.id ? { ...item, ...patch } : item) })));}catch(error){props.onMessage(error instanceof Error?error.message:"Could not update the event.");} };
  const changeTrack = (id: string, patch: Partial<SongCompositionTrack>) => onChange({ ...composition, tracks: composition.tracks.map((item) => item.id === id ? { ...item, ...patch } : item) });
  const number = (value: string, min: number, max: number, fallback: number) => Math.max(min, Math.min(max, Number(value) || fallback));
  async function previewVoicing(voicing: Array<number | null>) {
    const audio = createSongBuilderAudio();
    try { const pitches = eventMidiPitches(track, { id: "preview", kind: "chord", chord, voicing, startBeat: 0, durationBeats: 1 }); await audio.prepare(pitches, false, [track.instrument]); pitches.forEach((midi, i) => audio.play(midi, audio.context.currentTime + i * 0.025, 1, track.instrument, false, track)); }
    catch { props.onMessage("This browser could not play the chord preview."); }
    finally { window.setTimeout(() => audio.close(), 1800); }
  }

  return <section className="song-builder-card card builder-tools" aria-label="Composition tools">
    <h2>Composition tools</h2>
    <details open data-tool="compose"><summary>Edit notes and measures</summary>
      <p>Click a written event in the grid or choose it here. Change its settings directly; use Delete event to remove it.</p>
      <div className="song-builder-fields">
        <label>Event in current bar<select value={event?.id ?? ""} onChange={(e) => onSelectEvent(e.target.value)}><option value="">Select an event</option>{measure?.events.map((item) => <option key={item.id} value={item.id}>Beat {Number((item.startBeat + 1).toFixed(3))}: {track.instrument === "percussion" && item.kind === "note" ? songBuilderDrumName(item.midiPitches?.[0] ?? 36) : eventLabel(item)}</option>)}</select></label>
        {event ? <>
          <label>Start beat<input type="number" min={1} max={measureQuarterBeats(section.timeSignature ?? composition.timeSignature) + 1} step={1 / 12} value={event.startBeat + 1} onChange={(e) => changeEvent({ startBeat: Math.max(0, Math.min(measureQuarterBeats(section.timeSignature ?? composition.timeSignature) - 1 / 96, (Number(e.target.value) || 1) - 1)) })}/></label>
          <label>Length in quarter beats<input type="number" min={1 / 96} max={16} step={1 / 12} value={event.durationBeats} onChange={(e) => changeEvent({ durationBeats: number(e.target.value, 1 / 96, 16, 1) })}/></label>
          {event.kind === "chord" ? <label>Chord symbol<input value={event.chord ?? ""} onChange={(e) => changeEvent({ chord: e.target.value, voicing: undefined, midiPitches: undefined })}/></label> : event.kind === "note" ? fretted ? <>
            <label>Note string<input type="number" min={1} max={track.tuning.length} value={event.string ?? 1} onChange={(e) => changeEvent({ string: number(e.target.value, 1, track.tuning.length, 1), fret: event.fret ?? 0, midiPitches: undefined })}/></label>
            <label>Note fret<input type="number" min={0} max={24} value={event.fret ?? 0} onChange={(e) => changeEvent({ fret: number(e.target.value, 0, 24, 0), string: event.string ?? 1, midiPitches: undefined })}/></label>
          </> : track.instrument === "percussion" ? <label>Drum sound<select value={event.midiPitches?.[0] ?? 36} onChange={(e) => changeEvent({ midiPitches: [Number(e.target.value)], string: undefined, fret: undefined })}>{SONG_BUILDER_DRUMS.map((drum) => <option key={drum.pitch} value={drum.pitch}>{drum.label} · MIDI {drum.pitch}</option>)}</select></label> : <label>Pitch · MIDI number<input type="number" min={0} max={127} value={event.midiPitches?.[0] ?? 60} onChange={(e) => changeEvent({ midiPitches: [number(e.target.value, 0, 127, 60)], string: undefined, fret: undefined })}/></label> : null}
          {event.kind === "note" ? <label>Lyric or syllable<input maxLength={120} value={event.lyric ?? ""} placeholder="Align a word to this note" onChange={(e) => changeEvent({ lyric: e.target.value || undefined })}/></label> : null}
          {event.kind === "chord" ? <div className="song-builder-wide"><strong>Harmony ideas in {composition.key}</strong><p>In-key triads. Selecting one changes this chord and keeps its timing.</p><div className="builder-harmony-suggestions">{harmonicChords.map((idea) => <button key={idea.chord} type="button" className="btn" onClick={() => { const shape = suggestVoicings(track, idea.chord, previous)[0]; changeEvent({ chord: idea.chord, voicing: shape, midiPitches: undefined }); }}>{idea.roman} · {idea.chord}</button>)}</div></div> : null}
          <label>Technique<select value={event.technique ?? ""} onChange={(e) => changeEvent({ technique: e.target.value as SongCompositionEvent["technique"] || undefined })}><option value="">None</option>{TECHNIQUES.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Tuplet<select value={event.tuplet ?? ""} onChange={(e) => { const tuplet = Number(e.target.value) || undefined; changeEvent({ tuplet, durationBeats: tuplet ? (tuplet === 3 ? 1 : 2) / tuplet : 0.5 }); }}><option value="">None</option><option value={3}>Triplet eighth</option><option value={5}>Quintuplet eighth</option><option value={7}>Septuplet eighth</option></select></label>
          <label className="song-builder-check"><input type="checkbox" checked={event.tie ?? false} onChange={(e) => changeEvent({ tie: e.target.checked })}/>Tie to next matching note</label>
          <label className="song-builder-check"><input type="checkbox" checked={event.accent ?? false} onChange={(e) => changeEvent({ accent: e.target.checked })}/>Accent</label>
          <button type="button" className="btn" onClick={() => changeEvent({ durationBeats: Math.min(16, event.durationBeats * 1.5) })}>Dot duration ×1.5</button>
          <button type="button" className="btn" onClick={() => { onChange(editMeasure(composition, section.id, track.id, measureIndex, (current) => ({ ...current, events: current.events.filter((item) => item.id !== event.id) }))); onSelectEvent(""); }}>Delete event</button>
        </> : null}
      </div>
      {event?.kind === "chord" ? <div><h3>Suggested chord diagrams</h3><p>Ranked for a small hand stretch and a short move from the previous chord.</p><div className="builder-voicings">{voicings.map((frets) => <div key={frets.join()}><svg role="img" aria-label={`${chord} frets ${frets.map((fret) => fret ?? "X").join(" ")}`} viewBox="0 0 130 110"><text x="65" y="12" textAnchor="middle">{chord}</text>{frets.map((fret, i) => <g key={i}><line x1={15 + i * 100 / Math.max(1, frets.length - 1)} y1="28" x2={15 + i * 100 / Math.max(1, frets.length - 1)} y2="96" stroke="currentColor"/>{fret ? <circle cx={15 + i * 100 / Math.max(1, frets.length - 1)} cy={36 + ((fret - Math.max(1, Math.min(...frets.filter((f): f is number => f !== null && f > 0)))) * 17)} r="5" fill="currentColor"/> : null}<text x={15 + i * 100 / Math.max(1, frets.length - 1)} y="24" textAnchor="middle">{fret ?? "×"}</text></g>)}{[0, 1, 2, 3, 4].map((row) => <line key={row} x1="15" y1={28 + row * 17} x2="115" y2={28 + row * 17} stroke="currentColor"/>)}</svg><button className="btn" type="button" onClick={() => changeEvent({ voicing: frets, midiPitches: undefined })}>Use shape</button><button className="btn" type="button" onClick={() => void previewVoicing(frets)}>Hear shape</button></div>)}</div></div> : null}
      <h3>Copy a passage</h3><div className="song-builder-fields">
        <label>First bar<input type="number" min={1} max={measures.length} value={rangeStart} onChange={(e) => setRangeStart(number(e.target.value, 1, measures.length, 1))}/></label>
        <label>Last bar<input type="number" min={rangeStart} max={measures.length} value={rangeEnd} onChange={(e) => setRangeEnd(number(e.target.value, rangeStart, measures.length, rangeStart))}/></label>
        <button className="btn" type="button" onClick={() => { const copied = structuredClone(measures.slice(rangeStart - 1, Math.max(rangeStart, rangeEnd))).map((measure) => ({ ...measure, events: measure.events.map((event) => ({ ...event, midiPitches: eventMidiPitches(track, event) })) })); setClipboard(copied); props.onMessage(`Copied ${copied.length} bars. Choose a track, section, and destination bar to paste.`); }}>Copy bars</button>
        <label>Transpose semitones<input type="number" min={-24} max={24} value={transpose} onChange={(e) => setTranspose(number(e.target.value, -24, 24, 0))}/></label>
        <label>Shift quarter beats<input type="number" min={-16} max={16} step={0.25} value={shift} onChange={(e) => setShift(number(e.target.value, -16, 16, 0))}/></label>
        <button className="btn" type="button" disabled={!clipboard.length || measureIndex + clipboard.length > 512} onClick={() => { onChange(pasteMeasures(composition, section.id, track.id, measureIndex, clipboard, transpose, shift)); props.onMessage(`Pasted ${clipboard.length} bars at bar ${measureIndex + 1}. Check the composition for fret and timing issues.`); }}>Paste at selected bar</button>
      </div>
    </details>
    <details data-tool="practice"><summary>Track mixer</summary><div className="builder-mixer">{composition.tracks.map((item) => <fieldset key={item.id}>
      <legend>{item.name}</legend>
      <label>Volume<input type="range" min={0} max={1} step={0.05} value={item.volume ?? 1} onChange={(e) => changeTrack(item.id, { volume: Number(e.target.value) })}/></label>
      <label>Pan<input type="range" min={-1} max={1} step={0.1} value={item.pan ?? 0} onChange={(e) => changeTrack(item.id, { pan: Number(e.target.value) })}/></label>
      {item.instrument !== "percussion" ? <label>Sound<select value={item.sound ?? "clean"} onChange={(e) => changeTrack(item.id, { sound: e.target.value as SongCompositionTrack["sound"] })}>{["clean", "warm", "bright", "synth"].map((sound) => <option key={sound}>{sound}</option>)}</select></label> : null}
      <label>Reverb · {Math.round((item.reverb ?? 0) * 100)}%<input type="range" min={0} max={1} step={0.05} value={item.reverb ?? 0} onChange={(e) => changeTrack(item.id, { reverb: Number(e.target.value) })}/></label>
      <label className="song-builder-check"><input type="checkbox" checked={item.muted ?? false} onChange={(e) => changeTrack(item.id, { muted: e.target.checked })}/>Mute</label>
      <label className="song-builder-check"><input type="checkbox" checked={item.solo ?? false} onChange={(e) => changeTrack(item.id, { solo: e.target.checked })}/>Solo</label>
    </fieldset>)}</div></details>
    <details data-tool="compose"><summary>Time lyrics to the melody</summary><p>Distribute the section words across note events on the selected track. Edit individual syllables in the event controls.</p><button className="btn" type="button" onClick={() => { onChange(alignSectionLyrics(composition, section.id, track.id)); props.onMessage(`Lyrics aligned across the notes in ${track.name}.`); }}>Align section lyrics to {track.name}</button></details>
    <details data-tool="practice"><summary>Practice a passage</summary><div className="song-builder-fields">
      <label className="song-builder-check"><input type="checkbox" checked={practice.enabled} onChange={(e) => onPractice({ ...practice, enabled: e.target.checked })}/>Use bars from the selected playback range</label>
      <label>Start bar<input type="number" min={1} value={practice.start} onChange={(e) => onPractice({ ...practice, start: number(e.target.value, 1, 32768, 1) })}/></label>
      <label>End bar<input type="number" min={practice.start} value={practice.end} onChange={(e) => onPractice({ ...practice, end: number(e.target.value, practice.start, 32768, practice.start) })}/></label>
      <label>Start beat<input type="number" min={1} max={16} step={0.25} value={practice.beat} onChange={(e) => onPractice({ ...practice, beat: number(e.target.value, 1, 16, 1) })}/></label>
      <label className="song-builder-check"><input type="checkbox" checked={practice.countIn} onChange={(e) => onPractice({ ...practice, countIn: e.target.checked })}/>Count in</label>
      <label>Increase each loop · %<input type="number" min={0} max={20} value={practice.increase} onChange={(e) => onPractice({ ...practice, increase: number(e.target.value, 0, 20, 0) })}/></label>
      <label>Maximum tempo · %<input type="number" min={50} max={200} value={practice.maximum} onChange={(e) => onPractice({ ...practice, maximum: number(e.target.value, 50, 200, 120) })}/></label>
      <label>Swing · {Math.round((composition.swing ?? 0) * 100)}%<input type="range" min={0} max={0.5} step={0.05} value={composition.swing ?? 0} onChange={(e) => onChange({ ...composition, swing: Number(e.target.value) })}/></label>
      <label>Humanize playback · {Math.round(composition.humanize ?? 0)}%<input type="range" min={0} max={100} step={5} value={composition.humanize ?? 0} onChange={(e) => onChange({ ...composition, humanize: Number(e.target.value) })}/></label>
    </div><p>Use Shift+click or drag across the bar buttons to select a passage. Click a grid position, then “Start here” to practice from that beat.</p></details>
    <details data-tool="export"><summary>Score layout and file exchange</summary><div className="song-builder-fields">
      <label>Measures per line<select value={score.barsPerLine} onChange={(e) => onScore({ ...score, barsPerLine: Number(e.target.value) })}>{[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}</select></label>
      <label>PDF paper<select value={score.paper} onChange={(e) => onScore({ ...score, paper: e.target.value as ScoreSettings["paper"] })}><option value="letter">Letter</option><option value="a4">A4</option></select></label>
      <label>PDF orientation<select value={score.orientation} onChange={(e) => onScore({ ...score, orientation: e.target.value as ScoreSettings["orientation"] })}><option value="landscape">Landscape</option><option value="portrait">Portrait</option></select></label>
      <label>Instrument part<select value={score.trackId} onChange={(e) => onScore({ ...score, trackId: e.target.value })}><option value="">All tracks</option>{composition.tracks.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="song-builder-check"><input type="checkbox" checked={score.diagrams} onChange={(e) => onScore({ ...score, diagrams: e.target.checked })}/>Include chord diagrams</label>
      <label className="song-builder-check"><input type="checkbox" checked={score.sectionBreaks} onChange={(e) => onScore({ ...score, sectionBreaks: e.target.checked })}/>Start sections on a new page</label>
      <label className="song-builder-check"><input type="checkbox" checked={section.pageBreak ?? false} onChange={(e) => onChange({ ...composition, sections: composition.sections.map((item) => item.id === section.id ? { ...item, pageBreak: e.target.checked } : item) })}/>Page break before this section</label>
      <button className="btn" type="button" onClick={() => props.onDownload("midi")}>Download MIDI</button><button className="btn" type="button" onClick={() => props.onDownload("musicxml")}>Download MusicXML</button>
      <label>Import MIDI or MusicXML<input type="file" accept=".mid,.midi,.musicxml,.xml,.mxl,.json" onChange={(e) => { const file = e.target.files?.[0]; if (file) props.onImport(file); e.target.value = ""; }}/></label>
    </div><p>Imports create a new song. Use MusicXML (.xml/.musicxml/.mxl), MIDI format 0/1, or portable composition JSON. Expressive audio effects are previewed; MIDI exports include pitched notes and percussion hits.</p></details>
    <details data-tool="arrange"><summary>Version history and recovery</summary><div className="song-builder-fields"><label>Revision name<input maxLength={80} value={revisionName} onChange={(e) => setRevisionName(e.target.value)}/></label><button className="btn" type="button" onClick={() => { props.onRevision(revisionName.trim() || "Named revision"); setRevisionName(""); }}>Save revision</button></div><p>Recent autosaves and named revisions are kept with Song Library backups. Restoring a revision can be undone.</p><ul>{song.builderRevisions?.slice().reverse().map((revision) => <li key={revision.id}><button type="button" className="btn" onClick={() => props.onRestore(revision.composition)}>Restore {revision.name} · {new Date(revision.savedAt).toLocaleString()}</button></li>)}</ul></details>
    <details><summary>Composition checks · {issues.length} {issues.length === 1 ? "note" : "notes"}</summary>{issues.length ? <ul>{issues.slice(0, 100).map((issue, i) => <li key={i}><button type="button" className="text-button" onClick={() => props.onLocate(issue.sectionId, issue.trackId, issue.measureIndex)}>{issue.message}</button></li>)}</ul> : <p>No timing, overlap, pitch-range, voicing, or cross-track unison issues found.</p>}</details>
  </section>;
}
