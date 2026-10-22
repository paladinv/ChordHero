"use client";
import { useEffect, useMemo, useState } from "react";
import type { LibrarySong, SongComposition, SongCompositionEvent, SongCompositionSection, SongCompositionTrack, SongLibraryState } from "@/lib/songLibrary";
import { eventMidiPitches } from "@/lib/songBuilder";
import { editMeasure, pasteMeasures } from "@/lib/songBuilderEditing";
import { generatePattern, portableSong, RHYTHM_VALUES, suggestFingerings, writeAcrossBars, type PatternKind } from "@/lib/songBuilderStudio";
import { renderSongWav } from "@/lib/songBuilderWav";
import { applyChordProgression, chordsForProgression, PROGRESSION_PATTERNS, type ProgressionPattern } from "@/lib/songBuilderProgressions";
import SongBuilderCapture, { type CapturedSongNote } from "./SongBuilderCapture";
import SongBuilderSync from "./SongBuilderSync";
import { addSongAnnotation, normalizeComposition } from "@/lib/songLibrary";
const BUILDER_TEMPLATES_STORAGE_KEY = "chord-hero-song-builder-templates-v1";
export type BuilderWorkspace = "compose" | "arrange" | "practice" | "export";
type Props = {
  sharedPhrases: NonNullable<LibrarySong["builderPhrases"]>;
  library: SongLibraryState;
  song: LibrarySong;
  composition: SongComposition;
  section: SongCompositionSection;
  track: SongCompositionTrack;
  measureIndex: number;
  eventId: string;
  workspace: BuilderWorkspace;
  startBeat: number;
  onCapture: (note: CapturedSongNote) => void;
  onLocate: (sectionId: string, trackId: string, measureIndex: number) => void;
  onChange: (composition: SongComposition) => void;
  onSaveSong: (song: LibrarySong) => void;
  onApplyLibrary: (state: SongLibraryState) => void;
  onMessage: (text: string) => void;
  onDownload: (blob: Blob, name: string) => void;
};
export default function SongBuilderStudio({ sharedPhrases, library, song, composition, section, track, measureIndex, eventId, workspace, startBeat, onCapture, onLocate, onChange, onSaveSong, onApplyLibrary, onMessage, onDownload }: Props) {
  const [pattern, setPattern] = useState<PatternKind>("strum");
  const [sourceId, setSourceId] = useState("");
  const [phraseName, setPhraseName] = useState("");
  const [phraseBars, setPhraseBars] = useState(1);
  const [arrangementName, setArrangementName] = useState("");
  const [wavBusy, setWavBusy] = useState(false);
  const [wavPart, setWavPart] = useState("");
  const [dotted, setDotted] = useState(false);
  const [rest, setRest] = useState(false);
  const [tie, setTie] = useState(false);
  const [bytes, setBytes] = useState(0);
  const [quota, setQuota] = useState("");
  const [lastBackup, setLastBackup] = useState("");
  const [progression, setProgression] = useState<ProgressionPattern>("pop");
  const [compareId, setCompareId] = useState("");
  const [annotationDraft, setAnnotationDraft] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [personalTemplates, setPersonalTemplates] = useState<Array<{ id: string; name: string; savedAt: string; composition: SongComposition }>>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  useEffect(() => { setPattern((current) => track.instrument === "percussion" ? current.startsWith("drum-") ? current : "drum-rock" : current.startsWith("drum-") ? "strum" : current); }, [track.instrument]);
  const events = section.measuresByTrack[track.id]?.[measureIndex]?.events ?? [];
  const event = events.find(item => item.id === eventId);
  const previous = events.filter(item => item.startBeat < (event?.startBeat ?? 0)).at(-1)?.fret ?? 0;
  const fingerings = useMemo(() => event?.kind === "note" ? suggestFingerings(track, event, previous) : [], [event, track, previous]);
  const versions = useMemo(() => [
    ...(song.builderArrangements ?? []).map((item) => ({ id: `arrangement:${item.id}`, name: item.name, composition: item.composition, savedAt: "" })),
    ...(song.builderRevisions ?? []).map((item) => ({ id: `revision:${item.id}`, name: item.name, composition: item.composition, savedAt: item.savedAt })),
  ].slice().reverse(), [song.builderArrangements, song.builderRevisions]);
  const comparedVersion = versions.find((item) => item.id === compareId);
  const barAnnotations = useMemo(() => library.annotations.filter((item) => item.songId === song.id && item.sectionId === section.id && item.marker?.measure === measureIndex + 1), [library.annotations, song.id, section.id, measureIndex]);
  const progressionPreview = useMemo(() => {
    try { return chordsForProgression(composition.key, progression).join(" · "); }
    catch { return "Choose a supported major or minor key."; }
  }, [composition.key, progression]);
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(BUILDER_TEMPLATES_STORAGE_KEY) ?? "[]") as Array<{ id?: unknown; name?: unknown; savedAt?: unknown; composition?: unknown }>;
      setPersonalTemplates(Array.isArray(raw) ? raw.slice(-24).flatMap((item) => { const value = normalizeComposition(item?.composition); return value ? [{ id: String(item.id || crypto.randomUUID()).slice(0, 100), name: String(item.name || "Personal template").slice(0, 80), savedAt: String(item.savedAt || ""), composition: value }] : []; }) : []);
    } catch { setPersonalTemplates([]); }
    setTemplatesLoaded(true);
  }, []);
  useEffect(() => {
    if (!templatesLoaded) return;
    try { localStorage.setItem(BUILDER_TEMPLATES_STORAGE_KEY, JSON.stringify(personalTemplates.slice(-24))); }
    catch { onMessage("Personal templates could not be saved. Browser storage may be full."); }
  }, [personalTemplates, templatesLoaded, onMessage]);
  const differences = useMemo(() => {
    if (!comparedVersion) return [];
    const previousComposition = comparedVersion.composition;
    const changes: Array<{ sectionId: string; trackId: string; measureIndex: number; label: string; current: string; previous: string; canLocate: boolean }> = [];
    const eventLabel = (item: SongCompositionEvent) => item.kind === "rest" ? "rest" : item.kind === "chord" ? item.chord ?? "chord" : `${item.midiPitches?.join("/") ?? `${item.string ?? "?"}:${item.fret ?? "?"}`} note`;
    const sectionIds = [...new Set([...composition.sections.map((item) => item.id), ...previousComposition.sections.map((item) => item.id)])];
    const trackIds = [...new Set([...composition.tracks.map((item) => item.id), ...previousComposition.tracks.map((item) => item.id)])];
    for (const sectionId of sectionIds) {
      const currentSection = composition.sections.find((item) => item.id === sectionId);
      const oldSection = previousComposition.sections.find((item) => item.id === sectionId);
      for (const trackId of trackIds) {
        const currentTrack = composition.tracks.find((item) => item.id === trackId);
        const oldTrack = previousComposition.tracks.find((item) => item.id === trackId);
        const currentMeasures = currentSection?.measuresByTrack[trackId] ?? [];
        const oldMeasures = oldSection?.measuresByTrack[trackId] ?? [];
        for (let index = 0; index < Math.max(currentMeasures.length, oldMeasures.length); index += 1) {
          const current = currentMeasures[index]?.events.map((item) => `${eventLabel(item)} @ ${Number((item.startBeat + 1).toFixed(2))} · ${Number(item.durationBeats.toFixed(2))} beats`).join(", ") ?? "—";
          const previousValue = oldMeasures[index]?.events.map((item) => `${eventLabel(item)} @ ${Number((item.startBeat + 1).toFixed(2))} · ${Number(item.durationBeats.toFixed(2))} beats`).join(", ") ?? "—";
          if (current !== previousValue) changes.push({ sectionId, trackId, measureIndex: index, label: `${currentSection?.title ?? oldSection?.title ?? "Removed section"} · ${currentTrack?.name ?? oldTrack?.name ?? "Removed track"} · bar ${index + 1}`, current, previous: previousValue, canLocate: Boolean(currentSection && currentTrack) });
        }
      }
    }
    return changes;
  }, [composition, comparedVersion]);
  const metadataDifferences = comparedVersion ? [
    ["Key", composition.key, comparedVersion.composition.key],
    ["Tempo", `${composition.bpm} BPM`, `${comparedVersion.composition.bpm} BPM`],
    ["Meter", composition.timeSignature, comparedVersion.composition.timeSignature],
  ].filter(([, current, previous]) => current !== previous) : [];
  useEffect(() => {
    try {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!;
        total += new Blob([key, localStorage.getItem(key) ?? ""]).size;
      }
      setBytes(total);
      setLastBackup(localStorage.getItem("chord-builder-last-backup") ?? "");
    }
    catch { } navigator.storage?.estimate?.().then(estimate => setQuota(`${((estimate.usage ?? 0) / 1048576).toFixed(1)} MB of ${((estimate.quota ?? 0) / 1048576).toFixed(0)} MB browser quota`)).catch(() => { });
  }, [song]);
  useEffect(() => setAnnotationDraft(""), [song.id, section.id, measureIndex]);
  const update = (patch: Partial<SongCompositionEvent>) => {
    if (event)
      onChange(editMeasure(composition, section.id, track.id, measureIndex, measure => ({ ...measure, events: measure.events.map(item => item.id === event.id ? { ...item, ...patch } : item) })));
  };
  function rhythm(beats: number) {
    if (!event) {
      onMessage("Select a note or rest in the grid or score first.");
      return;
    } try {
      onChange(writeAcrossBars(composition, section.id, track.id, measureIndex, { ...event, kind: rest ? "rest" : event.kind === "rest" ? "note" : event.kind, string: event.string ?? 1, fret: event.fret ?? 0, durationBeats: beats * (dotted ? 1.5 : 1), tie }, event.id));
    }
    catch (error) {
      onMessage(String(error));
    }
  }
  async function wav() {
    setWavBusy(true); try {
      onDownload(await renderSongWav(song, wavPart || undefined), `${song.title.replace(/[^a-z0-9-]/gi, "-")}${wavPart ? "-" + composition.tracks.find(item => item.id === wavPart)?.name : ""}.wav`);
      onMessage("WAV audio rendered and downloaded.");
    }
      catch (error) {
        onMessage(error instanceof Error ? error.message : "Audio export failed.");
      }
      finally {
      setWavBusy(false);
    }
  }
  return <section className="song-builder-card card builder-studio" aria-label="Song creation studio">
    {workspace === "compose" ? <>
      <h2>Rhythm and expression</h2>
      <div className="builder-rhythm-palette" role="group" aria-label="Rhythm palette">{RHYTHM_VALUES.map(value => <button className="btn" type="button" key={value.label} onClick={() => rhythm(value.beats)} aria-label={`Set ${value.label.toLowerCase()} duration`}>
        <b aria-hidden="true">{value.symbol}</b>{value.label}</button>)}<label>
          <input type="checkbox" checked={dotted} onChange={e => setDotted(e.target.checked)} />Dotted</label>
        <label>
          <input type="checkbox" checked={rest} onChange={e => setRest(e.target.checked)} />Rest</label>
        <label>
          <input type="checkbox" checked={tie} onChange={e => setTie(e.target.checked)} />Tie onward</label>
      </div>
      <p>Choose a value for the selected event. Notes crossing a barline split automatically into tied fragments.</p>{event ? <div className="song-builder-fields">
        <label>Bend amount · semitones<input type="number" min={-12} max={12} step={.5} value={event.bendSemitones ?? 2} onChange={e => update({ bendSemitones: Math.max(-12, Math.min(12, Number(e.target.value))) })} />
        </label>
        <label>Slide destination fret<input type="number" min={0} max={24} value={event.slideToFret ?? event.fret ?? 0} onChange={e => update({ slideToFret: Math.max(0, Math.min(24, Number(e.target.value))) })} />
        </label>
        <label>Connect technique to<select value={event.connectedTo ?? ""} onChange={e => update({ connectedTo: e.target.value || undefined })}>
          <option value="">No connection</option>{section.measuresByTrack[track.id]?.flatMap((bar, index) => bar.events.filter(item => item.id !== event.id && item.kind !== "rest").map(item => <option key={item.id} value={item.id}>Bar {index + 1} beat {item.startBeat + 1} · {item.chord ?? `${item.string}:${item.fret}`}</option>))}</select>
        </label>
        <label>Strum time per string · ms<input type="number" min={0} max={500} step={5} value={Math.round((event.strumSeconds ?? .012) * 1000)} onChange={e => update({ strumSeconds: Math.max(0, Math.min(.5, Number(e.target.value) / 1000)) })} />
        </label>
        <label>Dynamics<select value={event.dynamic ?? ""} onChange={e => update({ dynamic: e.target.value as SongCompositionEvent["dynamic"] || undefined })}>
          <option value="">Default</option>{["pp", "p", "mp", "mf", "f", "ff"].map(item => <option key={item}>{item}</option>)}</select>
        </label>
        <label>Articulation<select value={event.articulation ?? ""} onChange={e => update({ articulation: e.target.value as SongCompositionEvent["articulation"] || undefined })}>
          <option value="">Normal</option>{["staccato", "tenuto", "marcato"].map(item => <option key={item}>{item}</option>)}</select>
        </label>
        <label>Velocity<input type="range" min={.05} max={1} step={.05} value={event.velocity ?? .75} onChange={e => update({ velocity: Number(e.target.value) })} />
        </label>
        <label>
          <input type="checkbox" checked={event.grace ?? false} onChange={e => update({ grace: e.target.checked })} />Grace note before beat</label>
      </div> : null}
      <details>
        <summary>Build a progression from the selected key</summary>
        <div className="song-builder-fields">
          <label>Progression<select value={progression} onChange={(item) => setProgression(item.target.value as ProgressionPattern)}>{PROGRESSION_PATTERNS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <p>{PROGRESSION_PATTERNS.find((item) => item.id === progression)?.feel}</p>
          <p><strong>Chord sequence:</strong> {progressionPreview}</p>
          <button className="btn" type="button" onClick={() => {
            try { onChange(applyChordProgression(composition, section.id, track.id, progression)); onMessage(`Added the ${PROGRESSION_PATTERNS.find((item) => item.id === progression)?.name} progression to ${section.title}.`); }
            catch (error) { onMessage(error instanceof Error ? error.message : "Could not build that progression."); }
          }}>Apply to {section.title}</button>
        </div>
        <p>Replaces chord events in the selected track’s first progression bars. Existing melody and rhythm notes are kept; missing bars are added automatically.</p>
      </details>
      <SongBuilderCapture composition={composition} sectionId={section.id} track={track} measureIndex={measureIndex} startBeat={startBeat} onCapture={onCapture} onMessage={onMessage} onTempoDetected={(bpm) => { onChange({ ...composition, bpm }); onMessage(`Composition tempo updated to ${bpm} BPM. Review the transcription timing before importing.`); }} />
      {fingerings.length ? <>
        <h3>Playable melody positions</h3>
        <p>Closest positions to the previous fret appear first. Pitches are preserved when changing positions.</p>
        <div className="builder-inline-actions">{fingerings.map(fingering => <button className="btn" type="button" key={fingering.string} onClick={() => update({ string: fingering.string, fret: fingering.fret, midiPitches: undefined })}>String {fingering.string} · fret {fingering.fret} · move {fingering.distance}</button>)}</div>
      </> : event?.kind === "note" ? <p>No playable position for {eventMidiPitches(track, event).join(", ")} in this tuning.</p> : null}
      <details className="builder-bar-notes">
        <summary>Notes and collaboration for bar {measureIndex + 1} · {barAnnotations.length}</summary>
        <p>Bar notes are included in the local Song Library and travel when you sync or export a library backup.</p>
        <label>New note for this bar<textarea rows={2} maxLength={500} value={annotationDraft} onChange={(e) => setAnnotationDraft(e.target.value)} placeholder="Leave a rehearsal or editing note" /></label>
        <button className="btn" type="button" disabled={!annotationDraft.trim()} onClick={() => { onApplyLibrary(addSongAnnotation(library, { songId: song.id, sectionId: section.id, marker: { measure: measureIndex + 1, beat: startBeat + 1 }, body: annotationDraft.trim() })); setAnnotationDraft(""); onMessage(`Note added to ${section.title}, bar ${measureIndex + 1}.`); }}>Add bar note</button>
        {barAnnotations.length ? <ul>{barAnnotations.map((item) => <li key={item.id}><span>{item.body}</span><small>{new Date(item.createdAt).toLocaleString()}</small><button className="text-button" type="button" onClick={() => onApplyLibrary({ ...library, annotations: library.annotations.filter((note) => note.id !== item.id) })}>Remove</button></li>)}</ul> : <p>No notes for this bar yet.</p>}
      </details>
      <details>
        <summary>{track.instrument === "percussion" ? "Generate a drum groove" : "Generate a chord-aware pattern"}</summary>
        <div className="song-builder-fields">
          <label>Chord source track<select value={sourceId || composition.tracks[0].id} onChange={e => setSourceId(e.target.value)}>{composition.tracks.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          </label>
          <label>Pattern<select value={pattern} onChange={e => setPattern(e.target.value as PatternKind)}>
            {track.instrument === "percussion" ? <><option value="drum-pop">Pop backbeat</option><option value="drum-rock">Rock backbeat</option><option value="drum-shuffle">Shuffle ride</option><option value="drum-half-time">Half-time groove</option><option value="drum-disco">Disco four-on-the-floor</option></> : <><option value="strum">Alternating strum</option><option value="fingerpick">Fingerpicking</option><option value="bass">Root and fifth bass</option></>}
          </select>
          </label>
          <button className="btn" type="button" onClick={() => {
            try {
              onChange(generatePattern(composition, section.id, sourceId || composition.tracks[0].id, track.id, pattern));
              onMessage(`Generated ${pattern.replace("drum-", "").replace(/-/g, " ")} pattern on ${track.name}. Undo restores its previous notes.`);
            }
            catch (error) {
              onMessage(String(error));
            }
          }}>Replace selected track part with pattern</button>
        </div>
        <p>{track.instrument === "percussion" ? "Drum grooves use common kick, snare, hi-hat, ride, and shuffle placements across the section. The selected track is replaced." : "Uses the selected section’s chord progression. The selected track is the destination."}</p>
      </details>
      <details>
        <summary>Personal phrase library</summary>
        <div className="song-builder-fields">
          <label>Phrase name<input value={phraseName} maxLength={80} onChange={e => setPhraseName(e.target.value)} />
          </label>
          <label>Bars from selected bar<input type="number" min={1} max={32} value={phraseBars} onChange={e => setPhraseBars(Math.max(1, Math.min(32, Number(e.target.value) || 1)))} />
          </label>
          <button className="btn" type="button" onClick={() => { const measures = structuredClone(section.measuresByTrack[track.id].slice(measureIndex, measureIndex + phraseBars)).map(bar => ({ ...bar, events: bar.events.map(item => ({ ...item, midiPitches: eventMidiPitches(track, item) })) })); onSaveSong({ ...song, builderPhrases: [...(song.builderPhrases ?? []), { id: crypto.randomUUID(), name: phraseName.trim() || "My phrase", tuning: track.tuning, capo: track.capo, measures }].slice(-40) }); setPhraseName(""); }}>Save phrase</button>
        </div>{sharedPhrases.map(phrase => <div className="builder-inline-actions" key={phrase.id}>
          <strong>{phrase.name} · {phrase.measures.length} bars</strong>
          <button className="btn" type="button" onClick={() => onChange(pasteMeasures(composition, section.id, track.id, measureIndex, phrase.measures))}>Insert phrase here</button>{song.builderPhrases?.some(item => item.id === phrase.id) ? <button className="btn" type="button" onClick={() => onSaveSong({ ...song, builderPhrases: song.builderPhrases?.filter(item => item.id !== phrase.id) })}>Remove phrase</button> : null}</div>)}</details>
    </> : null}
    {workspace === "arrange" ? <>
      <h2>Arrangement variations</h2>
      <p>Save acoustic, simplified, fingerstyle, or live arrangements within this song. Loading a version can be undone.</p>
      <div className="song-builder-fields">
        <label>Arrangement name<input value={arrangementName} onChange={e => setArrangementName(e.target.value)} maxLength={80} placeholder="Acoustic" />
        </label>
        <button className="btn" type="button" onClick={() => { onSaveSong({ ...song, builderArrangements: [...(song.builderArrangements ?? []), { id: crypto.randomUUID(), name: arrangementName.trim() || "My arrangement", composition }].slice(-12) }); setArrangementName(""); }}>Save arrangement</button>
      </div>{song.builderArrangements?.map(item => <div className="builder-inline-actions" key={item.id}>
        <strong>{item.name}</strong>
        <button className="btn" type="button" onClick={() => onChange(item.composition)}>Load arrangement</button>
        <button className="btn" type="button" onClick={() => onSaveSong({ ...song, builderArrangements: song.builderArrangements?.filter(version => version.id !== item.id) })}>Remove arrangement</button>
      </div>)}
      <details className="builder-personal-templates">
        <summary>Personal composition templates · {personalTemplates.length}</summary>
        <p>Save a reusable arrangement with its sections, tracks, tuning, tempo, and groove. Templates stay in this browser.</p>
        <div className="song-builder-fields"><label>Template name<input maxLength={80} value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="My starting arrangement" /></label><button className="btn" type="button" disabled={personalTemplates.length >= 24} onClick={() => { const template = { id: crypto.randomUUID(), name: templateName.trim() || `${song.title} template`, savedAt: new Date().toISOString(), composition: structuredClone(composition) }; setPersonalTemplates((items) => [...items, template].slice(-24)); setTemplateName(""); onMessage(`Saved ${template.name} to personal templates.`); }}>Save current composition as template</button></div>
        {personalTemplates.map((item) => <div className="builder-inline-actions" key={item.id}><strong>{item.name}</strong><span className="song-builder-muted">{item.composition.tracks.length} tracks · {item.composition.sections.length} sections · {item.composition.bpm} BPM</span><button className="btn" type="button" onClick={() => { onChange(structuredClone(item.composition)); onMessage(`Loaded ${item.name}. Undo restores the previous arrangement.`); }}>Load template</button><button className="text-button" type="button" onClick={() => setPersonalTemplates((items) => items.filter((template) => template.id !== item.id))}>Remove</button></div>)}
      </details>
      <details className="builder-arrangement-compare">
        <summary>Compare with a saved arrangement or revision</summary>
        <label>Saved version<select value={compareId} onChange={(e) => setCompareId(e.target.value)}><option value="">Choose a saved version</option>{versions.map((item) => <option key={item.id} value={item.id}>{item.name}{item.savedAt ? ` · ${new Date(item.savedAt).toLocaleString()}` : ""}</option>)}</select></label>
        {comparedVersion ? <><p>{metadataDifferences.length ? metadataDifferences.map(([label, current, previous]) => `${label}: ${previous} → ${current}`).join(" · ") : "Key, tempo, and meter match."} · {differences.length} changed {differences.length === 1 ? "bar" : "bars"} compared with {comparedVersion.name}.</p>{differences.length ? <ul>{differences.slice(0, 24).map((item) => <li key={`${item.sectionId}-${item.trackId}-${item.measureIndex}`}>{item.canLocate ? <button className="text-button" type="button" onClick={() => onLocate(item.sectionId, item.trackId, item.measureIndex)}>{item.label}</button> : <strong>{item.label}</strong>}<span><strong>Current:</strong> {item.current} <strong>Saved:</strong> {item.previous}</span></li>)}</ul> : <p>These arrangements have the same written events.</p>}</> : versions.length ? null : <p>Save an arrangement or revision to compare it with the current song.</p>}
      </details>
      </> : null}
    {workspace === "export" ? <>
      <h2>Audio and portable composition</h2>
      <div className="song-builder-fields">
        <label>WAV part<select value={wavPart} onChange={e => setWavPart(e.target.value)}>
          <option value="">Current mix</option>{composition.tracks.map(item => <option value={item.id} key={item.id}>{item.name} stem</option>)}</select>
        </label>
        <button className="btn" type="button" disabled={wavBusy} onClick={() => void wav()}>{wavBusy ? "Rendering audio…" : "Download WAV"}</button>
        <button className="btn" type="button" onClick={() => {
          onDownload(new Blob([JSON.stringify(portableSong(song), null, 2)], { type: "application/json" }), `${song.title.replace(/[^a-z0-9-]/gi, "-")}.chordsong.json`); const now = new Date().toISOString(); try {
            localStorage.setItem("chord-builder-last-backup", now);
          }
            catch { } setLastBackup(now);
        }}>Download portable composition</button>
        <button className="btn" type="button" onClick={async () => {
          const file = new File([JSON.stringify(portableSong(song), null, 2)], `${song.title.replace(/[^a-z0-9-]/gi, "-")}.chordsong.json`, { type: "application/json" });
          try {
            if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ title: song.title, text: `Song composition by ${song.artist}`, files: [file] });
            else { onDownload(file, file.name); onMessage("This browser cannot attach composition files to its share sheet. The portable file was downloaded so you can send it."); }
          } catch (error) { if (error instanceof Error && error.name !== "AbortError") onMessage("Could not open the share sheet. Download the portable composition instead."); }
        }}>Share composition file</button>
      </div>
      <p>Composition files include phrases and arrangement variations. Recorded takes are downloaded separately. WAV export renders up to ten minutes.</p>
      <h3>Storage and backups</h3>
      <p>Local text data: {(bytes / 1048576).toFixed(2)} MB. {quota}</p>
      <p>{lastBackup ? `Last composition backup: ${new Date(lastBackup).toLocaleString()}` : "No composition backup downloaded yet."}</p>{!lastBackup || Date.now() - Date.parse(lastBackup) > 7 * 86400000 ? <p role="status">Download a composition file or Song Library backup to keep a copy outside this browser.</p> : null}<a className="btn" href="/song-library">Open library backups</a>
      <SongBuilderSync library={library} onApply={onApplyLibrary} onMessage={onMessage} />
    </> : null}
  </section>;
}
