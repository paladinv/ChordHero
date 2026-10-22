"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ChordDiagram from "../../components/ChordDiagram";
import type { ChordLibraryItem } from "../../lib/chords";
import { chordStringMidiNotes } from "../../lib/chordChartEnhancements";
import { spellChordName, type ChordSpellingPreference } from "../../lib/chordChartShape";
import {
  INSTRUMENT_TUNINGS,
  buildSyntheticStrumPlan,
  analyzeVoicingCoverage,
  CHORD_FAMILY_QUALITIES,
  chordFamilyDifferential,
  chordLearningNote,
  compareChartVersions,
  explainOpenStringResonance,
  generateInstrumentVoicings,
  mapIdentityVoicings,
  mapShapeContacts,
  neckChordTones,
  type GeneratedVoicing,
  type AudioPreviewSettings,
  type SupportedInstrument,
} from "../../lib/chordChartDeepTools";

type InstrumentProfile = "guitar" | SupportedInstrument;
type VersionLike = {
  savedAt?: string;
  selectedIds: string[];
  practiceBpm: number;
  rhythmPattern: string;
  flashcards: string;
  annotations?: { notes?: string };
  tags?: string[];
};
type SavedChartLike = { name: string; selectedIds: string[]; settings: { practiceBpm: number; rhythmPattern: string; flashcards: string }; annotations?: { notes?: string }; tags?: string[]; history?: VersionLike[] };

const stringLabel = (count: number, index: number) => count === 4 ? ["G", "C", "E", "A"][index] : count === 7 ? ["low B", "E", "A", "D", "G", "B", "high E"][index] : ["low", "A", "D", "G", "B", "high"][index];
const midiFrequency = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

function GeneratedVoicingView({ voicing, instrument }: { voicing: GeneratedVoicing; instrument: SupportedInstrument }) {
  return <article className="chart-generated-voicing">
    <strong>Frets {voicing.frets.map((fret) => fret < 0 ? "×" : fret).join(" · ")}</strong>
    <div className="chart-generated-strings" role="img" aria-label={`${INSTRUMENT_TUNINGS[instrument].label} voicing. ${voicing.frets.map((fret, index) => `${stringLabel(voicing.frets.length, index)} ${fret < 0 ? "muted" : `fret ${fret}, ${voicing.notes[index]}, ${voicing.intervals[index]}`}`).join("; ")}.`}>
      {voicing.frets.map((fret, index) => <span key={index} className={voicing.intervals[index] === "R" ? "is-root" : ""}><small>{stringLabel(voicing.frets.length, index)}</small><b>{fret < 0 ? "×" : fret}</b><em>{voicing.notes[index]} · {voicing.intervals[index]}</em></span>)}
    </div>
    <small>Bass {voicing.bass} · complete {voicing.coverage.join("–")} formula · generated locally</small>
  </article>;
}

export default function ChordChartDeepTools({ selectedEntries, library, instrument, tuningNotes, capo, bpm, progressionEntries, savedCharts, comparedSavedCharts, audioSettings, onAudioSettingsChange, spellingKey, spellingPreference }: {
  selectedEntries: ChordLibraryItem[];
  library: ChordLibraryItem[];
  instrument: InstrumentProfile;
  tuningNotes: string[];
  capo: number;
  bpm: number;
  progressionEntries: ChordLibraryItem[];
  savedCharts: SavedChartLike[];
  comparedSavedCharts: SavedChartLike[];
  audioSettings: AudioPreviewSettings;
  onAudioSettingsChange: (settings: AudioPreviewSettings) => void;
  spellingKey: string;
  spellingPreference: ChordSpellingPreference;
}) {
  const [activeId, setActiveId] = useState("");
  const [intervalsVisible, setIntervalsVisible] = useState(false);
  const [neckVisible, setNeckVisible] = useState(false);
  const [generated, setGenerated] = useState<GeneratedVoicing[] | null>(null);
  const [familyVisible, setFamilyVisible] = useState(false);
  const [familyBaseline, setFamilyBaseline] = useState("major");
  const [compareShapeId, setCompareShapeId] = useState("");
  const [versionPair, setVersionPair] = useState("0:1");
  const [audioStatus, setAudioStatus] = useState("Synthetic progression audition is idle.");
  const [navigationStatus, setNavigationStatus] = useState("");
  const audioNodes = useRef<OscillatorNode[]>([]);
  const audioTimer = useRef<number | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const active = selectedEntries.find((entry) => entry.id === activeId) ?? selectedEntries[0] ?? null;
  const coverage = useMemo(() => active ? analyzeVoicingCoverage(active.chord.frets, tuningNotes, active.root, active.quality, capo) : null, [active, tuningNotes, capo]);
  const identityMap = useMemo(() => active ? mapIdentityVoicings(library, active) : [], [library, active]);
  const neck = useMemo(() => neckVisible && active ? neckChordTones(active.root, active.quality, tuningNotes, 12, capo) : [], [neckVisible, active, tuningNotes, capo]);
  const comparisonEntry = selectedEntries.find((entry) => entry.id === compareShapeId && entry.id !== active.id) ?? null;
  const activeContacts = useMemo(() => neckVisible && active ? mapShapeContacts(active.chord.frets, tuningNotes, active.root, capo, 12) : [], [neckVisible, active, tuningNotes, capo]);
  const comparisonContacts = useMemo(() => neckVisible && comparisonEntry ? mapShapeContacts(comparisonEntry.chord.frets, tuningNotes, comparisonEntry.root, capo, 12) : [], [neckVisible, comparisonEntry, tuningNotes, capo]);
  const family = useMemo(() => active && familyVisible ? chordFamilyDifferential(active.root, CHORD_FAMILY_QUALITIES, familyBaseline) : [], [active, familyVisible, familyBaseline]);
  const resonance = useMemo(() => active ? explainOpenStringResonance(active.chord.frets, tuningNotes, active.root, active.quality, capo) : [], [active, tuningNotes, capo]);

  const versions = useMemo(() => {
    if (comparedSavedCharts.length === 2) return comparedSavedCharts.map((chart) => ({ label: chart.name, snapshot: { selectedIds: chart.selectedIds, practiceBpm: chart.settings.practiceBpm, rhythmPattern: chart.settings.rhythmPattern, flashcards: chart.settings.flashcards, annotations: chart.annotations, tags: chart.tags } }));
    const chart = comparedSavedCharts[0] ?? savedCharts.find((item) => (item.history?.length ?? 0) > 0);
    if (!chart) return [];
    return [...(chart.history ?? []).map((history, index) => ({ label: `${chart.name} · saved ${index + 1}${history.savedAt ? ` · ${new Date(history.savedAt).toLocaleString()}` : ""}`, snapshot: history })), { label: `${chart.name} · current`, snapshot: { selectedIds: chart.selectedIds, practiceBpm: chart.settings.practiceBpm, rhythmPattern: chart.settings.rhythmPattern, flashcards: chart.settings.flashcards, annotations: chart.annotations, tags: chart.tags } }].slice(-8);
  }, [comparedSavedCharts, savedCharts]);
  const [beforeIndex, afterIndex] = versionPair.split(":").map(Number);
  const versionDiff = versions.length > 1 ? compareChartVersions(versions[beforeIndex]?.snapshot ?? versions[0].snapshot, versions[afterIndex]?.snapshot ?? versions[versions.length - 1].snapshot) : null;
  const nameFor = (id: string) => library.find((entry) => entry.id === id)?.chord.name ?? id;

  const stopAudio = () => {
    if (audioTimer.current !== null) window.clearTimeout(audioTimer.current);
    audioTimer.current = null;
    audioNodes.current.forEach((node) => { try { node.stop(); } catch { /* stopped */ } });
    audioNodes.current = [];
    if (audioContext.current) void audioContext.current.close();
    audioContext.current = null;
    setAudioStatus("Synthetic progression audition stopped; audio nodes released.");
  };
  useEffect(() => () => {
    if (audioTimer.current !== null) window.clearTimeout(audioTimer.current);
    audioNodes.current.forEach((node) => { try { node.stop(); } catch { /* stopped */ } });
    if (audioContext.current) void audioContext.current.close();
  }, []);

  const playProgression = () => {
    stopAudio();
    if (instrument !== "guitar") { setAudioStatus(`${INSTRUMENT_TUNINGS[instrument].label} is selected. Progression audio is disabled because the progression still contains six-string guitar voicings; generate individual verified shapes above instead.`); return; }
    const entries = (progressionEntries.length ? progressionEntries : selectedEntries).slice(0, 16);
    if (!entries.length) { setAudioStatus("Select chords or load a progression first."); return; }
    const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) { setAudioStatus("Web Audio is unavailable in this browser."); return; }
    const context = new AudioContextCtor(); audioContext.current = context;
    const beatSeconds = 60 / Math.max(30, Math.min(240, bpm));
    const chordSeconds = beatSeconds * 2;
    const nodes: OscillatorNode[] = [];
    entries.forEach((entry, chordIndex) => {
      const coverageNotes = chordStringMidiNotes(entry.chord.frets, tuningNotes, capo).flatMap((midi) => midi === null ? [] : [midi]);
      const plan = buildSyntheticStrumPlan(coverageNotes.slice(0, 7), audioSettings, chordIndex, 0.018);
      plan.forEach((event) => {
        const start = context.currentTime + 0.04 + chordIndex * chordSeconds + event.offset;
        const oscillator = context.createOscillator(); const gain = context.createGain(); const filter = context.createBiquadFilter();
        oscillator.type = event.oscillator; oscillator.frequency.value = midiFrequency(event.midi); filter.type = "lowpass"; filter.frequency.value = event.filterHz;
        const duration = Math.min(event.duration, chordSeconds * 0.9); gain.gain.setValueAtTime(0.0001, start); gain.gain.exponentialRampToValueAtTime(event.peakGain, start + 0.018); gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        oscillator.connect(filter).connect(gain).connect(context.destination); oscillator.start(start); oscillator.stop(start + duration + 0.04); nodes.push(oscillator);
      });
    });
    audioNodes.current = nodes;
    const totalMs = Math.ceil(entries.length * chordSeconds * 1000 + 200);
    audioTimer.current = window.setTimeout(() => { audioNodes.current = []; audioTimer.current = null; audioContext.current = null; setAudioStatus(`Finished ${entries.length}-chord synthetic audition at ${bpm} BPM.`); void context.close(); }, totalMs);
    setAudioStatus(`Playing ${entries.length} chart voicings at ${bpm} BPM (two beats each, synthetic tone).`);
  };

  const generate = () => {
    if (!active || instrument === "guitar") { setGenerated([]); return; }
    setGenerated(generateInstrumentVoicings(active.root, active.quality, instrument, 5));
  };
  const openVoicingCard = (id: string, name: string) => {
    const target = document.getElementById(`chart-card-${id}`);
    if (!target) { setNavigationStatus(`${name} is not currently rendered. Clear filters or expand that chord identity in Browse, then try again.`); return; }
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.focus({ preventScroll: true });
    setNavigationStatus(`Moved to the rendered ${name} chord card.`);
  };

  if (!active) return <section className="chart-control-group chart-deep-tools" aria-label="Chord map and analysis tools"><span className="label">Deeper chord tools</span><h2>Select a chord to inspect its neck map and voicing formula</h2></section>;
  return <section className="chart-control-group chart-deep-tools" aria-label="Deeper chord chart tools">
    <span className="label">Deeper chord tools · opt in</span>
    <div className="chart-control-heading"><div><h2>Map, hear, and compare the actual voicing</h2><p className="muted">All searches are local, capped, and run only after you open a view or request shapes.</p></div><label>Chord<select value={active.id} onChange={(event) => { setActiveId(event.target.value); setGenerated(null); }}>{selectedEntries.map((entry) => <option key={entry.id} value={entry.id}>{entry.chord.name} · {entry.position}</option>)}</select></label></div>

    <div className="chart-deep-grid">
      <article><h3>Interval diagram and coverage</h3><button className="btn" type="button" onClick={() => setIntervalsVisible((value) => !value)}>{intervalsVisible ? "Hide interval diagram" : "Show interval diagram"}</button>{intervalsVisible && coverage ? <><ChordDiagram chord={active.chord} contactLabels={coverage.contacts} /><p className="chart-evidence">{coverage.summary}</p><p className="muted">Root, third, fifth, and seventh receive distinct emphasis; omitted formula tones are named rather than silently treated as complete.</p></> : null}</article>

      <article><h3>Same identity across the neck</h3><ol className="chart-position-map">{identityMap.map((item) => <li key={item.id} className={item.selected ? "is-current" : ""}><span><strong>{item.name}</strong><span>{item.form} · {item.position} · {item.region}</span></span><button className="btn ghost" type="button" onClick={() => openVoicingCard(item.id, `${item.name} ${item.position}`)}>Open card</button></li>)}</ol><p className="muted">Form names appear only when the local position metadata explicitly names a CAGED form.</p><p className="chart-evidence" role="status" aria-live="polite">{navigationStatus}</p></article>

      <article><h3>{instrument === "guitar" ? "Alternate-instrument shapes" : `${INSTRUMENT_TUNINGS[instrument].label} shapes`}</h3>{instrument === "guitar" ? <p className="muted">Choose ukulele, baritone guitar, or seven-string guitar in Instrument settings to request playable shapes.</p> : <><button className="btn primary" type="button" onClick={generate}>Generate up to 5 playable shapes</button>{generated ? generated.length ? <div className="chart-generated-list">{generated.map((voicing) => <GeneratedVoicingView key={voicing.frets.join(",")} voicing={voicing} instrument={instrument} />)}</div> : <p role="status">No complete, four-fret-span voicing was found in the bounded search. No guidance-only shape is being presented as playable.</p> : <p className="muted">Generation checks every sounding pitch against the chord formula and rejects incomplete shapes.</p>}</>}</article>

      <article><h3>Chord-family differential drill</h3><button className="btn" type="button" onClick={() => setFamilyVisible((value) => !value)}>{familyVisible ? "Hide family" : "Build family from local formulas"}</button>{familyVisible ? <><label>Compare against<select value={familyBaseline} onChange={(event) => setFamilyBaseline(event.target.value)}>{CHORD_FAMILY_QUALITIES.map((quality) => <option key={quality} value={quality}>{quality}</option>)}</select></label><table className="chart-family-table"><thead><tr><th>Quality</th><th>Formula</th><th>Notes</th><th>Change from {familyBaseline}</th></tr></thead><tbody>{family.map((item) => <tr key={item.quality}><th>{item.quality}</th><td>{item.formula.join("–")}</td><td>{item.notes.map((note) => spellChordName(note, spellingKey, spellingPreference)).join(" ")}</td><td>{item.added.length || item.removed.length ? `${item.removed.length ? `remove ${item.removed.join(", ")}` : ""}${item.added.length ? ` add ${item.added.join(", ")}` : ""}` : "baseline"}</td></tr>)}</tbody></table></> : null}</article>

      <article className="chart-neck-panel"><h3>Neck-wide chord tones</h3><button className="btn" type="button" onClick={() => setNeckVisible((value) => !value)}>{neckVisible ? "Hide 12-fret map" : "Build 12-fret map"}</button>{neckVisible ? <><label>Compare a selected shape<select value={comparisonEntry?.id ?? ""} onChange={(event) => setCompareShapeId(event.target.value)}><option value="">No second shape</option>{selectedEntries.filter((entry) => entry.id !== active.id).map((entry) => <option key={entry.id} value={entry.id}>{spellChordName(entry.chord.name, spellingKey, spellingPreference)} · {entry.position}</option>)}</select></label><p className="muted" id="chart-neck-legend">A/B mark fretted contacts for the active/compared shape; R, 3, 5, and other intervals show all-neck chord-tone context. Contacts are physical fret positions, including capo.</p><div className="chart-neck-map" role="img" aria-describedby="chart-neck-legend" aria-label={`${spellChordName(active.chord.name, spellingKey, spellingPreference)}${comparisonEntry ? ` compared with ${spellChordName(comparisonEntry.chord.name, spellingKey, spellingPreference)}` : ""}: A and B show selected shape contacts; interval labels show chord-tone context from fret 0 through 12.`}><div className="chart-neck-frets" aria-hidden="true"><b>String</b>{Array.from({ length: 13 }, (_, fret) => <b key={fret}>{fret}</b>)}</div>{tuningNotes.map((open, string) => <div key={`${open}-${string}`}><b>{spellChordName(open, spellingKey, spellingPreference)}</b>{Array.from({ length: 13 }, (_, fret) => { const tone = neck.find((item) => item.string === string && item.fret === fret); const a = activeContacts.some((item) => item.string === string && item.fret === fret); const b = comparisonContacts.some((item) => item.string === string && item.fret === fret); const marker = a && b ? "A/B" : a ? "A" : b ? "B" : tone?.interval ?? "·"; return <span key={fret} className={`${tone?.root ? "is-root" : tone ? "is-tone" : ""}${a ? " is-shape-a" : ""}${b ? " is-shape-b" : ""}`} title={`${spellChordName(open, spellingKey, spellingPreference)}, fret ${fret}: ${marker}${tone ? ` · ${spellChordName(tone.note, spellingKey, spellingPreference)} ${tone.interval} all-neck chord tone` : ""}`} aria-hidden="true">{marker}</span>; })}</div>)}</div></> : null}</article>

      <article><h3>Card and progression sound</h3><div className="chart-settings-grid"><label>Strum direction<select value={audioSettings.direction} onChange={(event) => onAudioSettingsChange({ ...audioSettings, direction: event.target.value as AudioPreviewSettings["direction"] })}><option value="down">Down</option><option value="up">Up</option><option value="alternate">Alternate by chord</option></select></label><label>Articulation<select value={audioSettings.articulation} onChange={(event) => onAudioSettingsChange({ ...audioSettings, articulation: event.target.value as AudioPreviewSettings["articulation"] })}><option value="ring">Let ring</option><option value="short">Short</option><option value="muted">Muted</option></select></label><label>Synthetic tone<select value={audioSettings.tone} onChange={(event) => onAudioSettingsChange({ ...audioSettings, tone: event.target.value as AudioPreviewSettings["tone"] })}><option value="triangle">Triangle synthetic</option><option value="sine">Sine synthetic</option><option value="sawtooth">Bright saw synthetic</option></select></label></div><div className="chart-action-row"><button className="btn primary" type="button" onClick={playProgression} disabled={instrument !== "guitar"}>Play progression</button><button className="btn ghost" type="button" onClick={stopAudio}>Stop</button></div><p className="chart-evidence" role="status">{instrument === "guitar" ? audioStatus : `${INSTRUMENT_TUNINGS[instrument].label} selected: progression playback is disabled because its cards are six-string guitar voicings.`}</p><p className="muted">Controls also apply to card Strum and Arpeggio buttons. This is oscillator synthesis, not a sampled guitar. Playback is capped at 16 chords and releases nodes when stopped.</p></article>

      <article><h3>Chord-specific learning note</h3><p>{chordLearningNote(active)}</p>{resonance.length ? <div className="chart-tuning-warning"><strong>Open-string resonance conflict</strong>{resonance.map((item) => <p key={item.string}>{item.reason}</p>)}</div> : <p className="chart-evidence">Every open string used by this shape belongs to the chord formula.</p>}</article>

      <article><h3>Visual saved-version diff</h3>{versions.length > 1 ? <><div className="chart-settings-grid"><label>Before<select value={beforeIndex} onChange={(event) => setVersionPair(`${event.target.value}:${afterIndex}`)}>{versions.map((version, index) => <option key={`before-${index}`} value={index}>{version.label}</option>)}</select></label><label>After<select value={afterIndex} onChange={(event) => setVersionPair(`${beforeIndex}:${event.target.value}`)}>{versions.map((version, index) => <option key={`after-${index}`} value={index}>{version.label}</option>)}</select></label></div>{versionDiff ? <div className="chart-version-diff" aria-live="polite">{versionDiff.unchanged ? <p>No card, order, setting, tag, or note changes.</p> : <><div className="added"><strong>Added</strong>{versionDiff.added.map((id) => <span key={id}>+ {nameFor(id)}</span>)}</div><div className="removed"><strong>Removed</strong>{versionDiff.removed.map((id) => <span key={id}>− {nameFor(id)}</span>)}</div><div><strong>Moved</strong>{versionDiff.moved.map((item) => <span key={item.id}>{nameFor(item.id)} {item.from} → {item.to}</span>)}</div><div><strong>Settings</strong>{versionDiff.changedSettings.map((item) => <span key={item.key}>{item.key}: {item.before} → {item.after}</span>)}{versionDiff.notesChanged ? <span>Teacher/chart notes changed</span> : null}{versionDiff.tagAdded.map((tag) => <span key={`tag+${tag}`}>+ tag {tag}</span>)}{versionDiff.tagRemoved.map((tag) => <span key={`tag-${tag}`}>− tag {tag}</span>)}</div></>}</div> : null}</> : <p className="muted">Save at least two versions of a chart, or choose two saved charts with Compare, to see card-level changes.</p>}</article>
    </div>
  </section>;
}
