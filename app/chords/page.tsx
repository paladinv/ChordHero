"use client";

import { useEffect, useMemo, useState } from "react";
import ChordDiagram from "../../components/ChordDiagram";
import {
  CHORD_DIFFICULTY_TAGS,
  CHORD_FUNCTION_KEYS,
  CHORD_LIBRARY,
  CHORD_LIBRARY_ROOTS,
  CHORD_QUALITY_OPTIONS,
  HARMONIC_FUNCTION_OPTIONS,
  LEVELS,
  PROGRESSION_PACKS,
  type ChordLibraryItem,
  type HarmonicRole
} from "../../lib/chords";

type Orientation = "right" | "left";
type Layout = "compact" | "full";
type PrintColumns = 2 | 3;
type Tuning = "standard" | "drop-d" | "dadgad" | "half-step";

type SavedChart = {
  id: string;
  name: string;
  selectedIds: string[];
  filters: {
    root: string;
    difficulty: string;
    quality: string;
    position: string;
    characteristic: string;
    key: string;
    role: string;
  };
  settings: {
    orientation: Orientation;
    highContrast: boolean;
    capo: number;
    tuning: Tuning;
    layout: Layout;
    columns: PrintColumns;
  };
};

const STORAGE_KEY = "chord-hero:chart-builder:v1";
const PAGE_SIZE = 36;
const STRINGS = ["low E", "A", "D", "G", "B", "high E"];
const NOTE_NAMES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_NAMES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const NOTE_INDEX: Record<string, number> = {
  C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4,
  "E#": 5, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11
};
const QUALITY_INTERVALS: Record<string, number[]> = {
  major: [0, 4, 7], minor: [0, 3, 7], dominant7: [0, 4, 7, 10], major7: [0, 4, 7, 11],
  minor7: [0, 3, 7, 10], sus2: [0, 2, 7], sus4: [0, 5, 7], add9: [0, 4, 7, 14]
};
const TUNING_LABELS: Record<Tuning, string> = {
  standard: "Standard · E A D G B E",
  "drop-d": "Drop D · D A D G B E",
  dadgad: "DADGAD · D A D G A D",
  "half-step": "Half-step down · Eb Ab Db Gb Bb Eb"
};

const signature = (entry: ChordLibraryItem) =>
  `${entry.chord.frets.join(",")}|${entry.chord.barre ? `${entry.chord.barre.fret}-${entry.chord.barre.from}-${entry.chord.barre.to}` : "none"}`;

const uniqueShapes = (entries: ChordLibraryItem[]) => {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = signature(entry);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const rootOf = (name: string) => name.match(/^[A-G](?:#|b)?/)?.[0] ?? name;

const transposeNote = (note: string, semitones: number, preferFlats = note.includes("b")) => {
  const index = NOTE_INDEX[note];
  if (index === undefined) return note;
  return (preferFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP)[(index + semitones) % 12];
};

const transposeChordName = (name: string, semitones: number) => {
  const parts = name.split("/");
  return parts.map((part) => {
    const root = rootOf(part);
    const suffix = part.slice(root.length);
    return `${transposeNote(root, semitones, root.includes("b"))}${suffix}`;
  }).join("/");
};

const enharmonicName = (name: string) => {
  const root = rootOf(name);
  if (!root.includes("#") && !root.includes("b")) return name;
  const alternative = transposeNote(root, 0, root.includes("#"));
  if (alternative === root) return name;
  return `${name} / ${alternative}${name.slice(root.length)}`;
};

const chordTones = (entry: ChordLibraryItem) => {
  const base = NOTE_INDEX[entry.root];
  const intervals = QUALITY_INTERVALS[entry.quality] ?? [0, 4, 7];
  if (base === undefined) return "See voicing";
  const names = entry.root.includes("b") ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  return Array.from(new Set(intervals.map((interval) => names[(base + interval) % 12]))).join(" · ");
};

const baseFret = (entry: ChordLibraryItem) => {
  const fretted = entry.chord.frets.filter((fret) => fret > 0);
  if (!fretted.length || Math.max(...fretted) <= 4) return 1;
  return entry.chord.barre?.fret ?? Math.min(...fretted);
};

const getFingerText = (entry: ChordLibraryItem) => {
  const fingers = entry.chord.fingers ?? [];
  const details = fingers.flatMap((finger, index) => finger ? [`${STRINGS[index]}: ${finger}`] : []);
  return details.length ? details.join(" · ") : "Use a relaxed fingering that keeps every marked note clear.";
};

const entryScore = (entry: ChordLibraryItem) =>
  (entry.position.toLowerCase().includes("open") ? 0 : 4) +
  (entry.difficultyTags.includes("beginner") ? 0 : 2) +
  (entry.difficultyTags.includes("barre") ? 3 : 0) +
  (entry.inversion === "inverted" ? 2 : 0);

const bestEntry = (items: ChordLibraryItem[]) => [...items].sort((a, b) => entryScore(a) - entryScore(b))[0];

const resolveRoles = (key: string, roles: HarmonicRole[]) => {
  const keyIndex = NOTE_INDEX[key] ?? 0;
  const scaleIntervals = [0, 2, 4, 5, 7, 9];
  const expectedQuality = ["major", "minor", "minor", "major", "major", "minor"];
  const names = key.includes("b") ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  return roles.flatMap((role) => {
    const contextual = CHORD_LIBRARY.filter((entry) => entry.functionContexts.some((context) => context.key === key && context.roles.includes(role)));
    if (contextual.length) return [bestEntry(contextual)];
    const roleIndex = HARMONIC_FUNCTION_OPTIONS.indexOf(role);
    const expectedRoot = names[(keyIndex + scaleIntervals[roleIndex]) % 12];
    const fallback = CHORD_LIBRARY.filter((entry) => NOTE_INDEX[entry.root] === NOTE_INDEX[expectedRoot] && entry.quality === expectedQuality[roleIndex]);
    return fallback.length ? [bestEntry(fallback)] : [];
  }).filter((entry): entry is ChordLibraryItem => Boolean(entry));
};

const levelEntries = (levelIndex: number) => uniqueShapes(LEVELS[levelIndex].chords.flatMap((chord) => {
  const exact = CHORD_LIBRARY.find((entry) => entry.chord.name === chord.name && entry.chord.frets.join(",") === chord.frets.join(","));
  return exact ? [exact] : [];
}));

const isSavedChart = (value: unknown): value is SavedChart => {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SavedChart>;
  return typeof item.id === "string" && typeof item.name === "string" && Array.isArray(item.selectedIds) &&
    item.selectedIds.every((id) => typeof id === "string") && Boolean(item.filters) && typeof item.filters === "object" &&
    typeof item.filters.root === "string" && typeof item.filters.difficulty === "string" &&
    typeof item.filters.quality === "string" && typeof item.filters.position === "string" &&
    typeof item.filters.characteristic === "string" && typeof item.filters.key === "string" &&
    typeof item.filters.role === "string" && Boolean(item.settings) && typeof item.settings === "object" &&
    (item.settings.orientation === "right" || item.settings.orientation === "left") &&
    typeof item.settings.highContrast === "boolean" && typeof item.settings.capo === "number" &&
    Boolean(item.settings.tuning && TUNING_LABELS[item.settings.tuning]) &&
    (item.settings.layout === "compact" || item.settings.layout === "full") &&
    (item.settings.columns === 2 || item.settings.columns === 3);
};

function ChartCard({
  entry, selected, comparing, orientation, highContrast, capo, tuning, layout, onToggle, onCompare, onAlternative, printable = false
}: {
  entry: ChordLibraryItem;
  selected: boolean;
  comparing: boolean;
  orientation: Orientation;
  highContrast: boolean;
  capo: number;
  tuning: Tuning;
  layout: Layout;
  onToggle?: () => void;
  onCompare?: () => void;
  onAlternative?: (id: string) => void;
  printable?: boolean;
}) {
  const name = enharmonicName(entry.chord.name);
  const sounded = capo ? enharmonicName(transposeChordName(entry.chord.name, capo)) : name;
  const muted = entry.chord.frets.flatMap((fret, index) => fret < 0 ? [STRINGS[index]] : []);
  return (
    <article id={`chart-card-${entry.id}`} className={`chart-card ${selected ? "selected" : ""} ${layout === "compact" ? "compact" : "full"}`}>
      <header className="chart-card-header">
        <div>
          <span className="label">{entry.qualityLabel} · {entry.position}</span>
          <h3>{name}</h3>
          {capo > 0 ? <p className="chart-sounding">Shape {name} · sounds {sounded} with capo {capo}</p> : null}
        </div>
        <span className="chart-difficulty">{entry.difficultyTags[0] ?? "intermediate"}</span>
      </header>
      <ChordDiagram chord={entry.chord} orientation={orientation} highContrast={highContrast} />
      <div className="chart-card-facts">
        <p><strong>Tones:</strong> {chordTones(entry)}</p>
        <p><strong>Fingers:</strong> {getFingerText(entry)}</p>
        <p><strong>Strings:</strong> {muted.length ? `Mute ${muted.join(", ")}` : "Let all six strings ring"} · base fret {baseFret(entry)}</p>
        <p><strong>Tuning:</strong> {TUNING_LABELS[tuning]}</p>
        {tuning !== "standard" ? <p className="chart-note">Diagram frets are the library shape; verify pitches for this tuning.</p> : null}
        {layout === "full" ? <>
          <p>{entry.mutingNotes[0] ?? entry.summary}</p>
          <p><strong>Focus:</strong> {entry.practiceFocus}</p>
        </> : null}
      </div>
      {!printable ? <div className="chart-card-actions">
        <button className="btn primary" type="button" onClick={onToggle}>{selected ? "Remove" : "Select"}</button>
        <button className={`btn ghost ${comparing ? "active" : ""}`} type="button" onClick={onCompare}>{comparing ? "Comparing" : "Compare"}</button>
      </div> : null}
      {entry.nearbyAlternatives.some((alternative) => alternative.targetId) ? <div className="chart-alternatives">
        <span className="label">Alternatives</span>
        {entry.nearbyAlternatives.flatMap((alternative) => alternative.targetId ? [
          printable ? <span key={alternative.targetId}>{alternative.label}</span> :
          <span key={alternative.targetId} className="chart-alternative">
            <a href={`#chart-card-${alternative.targetId}`}>{alternative.label}</a>
            <button type="button" onClick={() => onAlternative?.(alternative.targetId!)}>Add</button>
          </span>
        ] : [])}
      </div> : null}
      {printable ? <p className="chart-detail-link">Chord Hero detail: /library?chord={entry.id}</p> : null}
    </article>
  );
}

export default function ChordChartPage() {
  const [root, setRoot] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [quality, setQuality] = useState("all");
  const [position, setPosition] = useState("all");
  const [characteristic, setCharacteristic] = useState("all");
  const [functionKey, setFunctionKey] = useState("all");
  const [functionRole, setFunctionRole] = useState("all");
  const [presetIds, setPresetIds] = useState<string[] | null>(() => levelEntries(0).map((entry) => entry.id));
  const [presetName, setPresetName] = useState(`Level · ${LEVELS[0]?.name ?? "Open Chords"}`);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [orientation, setOrientation] = useState<Orientation>("right");
  const [highContrast, setHighContrast] = useState(false);
  const [capo, setCapo] = useState(0);
  const [tuning, setTuning] = useState<Tuning>("standard");
  const [layout, setLayout] = useState<Layout>("full");
  const [columns, setColumns] = useState<PrintColumns>(3);
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [savedCharts, setSavedCharts] = useState<SavedChart[]>([]);
  const [saveName, setSaveName] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
      if (Array.isArray(parsed)) setSavedCharts(parsed.filter(isSavedChart));
    } catch { setSavedCharts([]); }
  }, []);

  useEffect(() => {
    const prepare = () => setIsPrinting(true);
    const finish = () => setIsPrinting(false);
    window.addEventListener("beforeprint", prepare);
    window.addEventListener("afterprint", finish);
    return () => {
      window.removeEventListener("beforeprint", prepare);
      window.removeEventListener("afterprint", finish);
    };
  }, []);

  const filters = useMemo(() => ({ root, difficulty, quality, position, characteristic, functionKey, functionRole }), [root, difficulty, quality, position, characteristic, functionKey, functionRole]);

  const filteredEntries = useMemo(() => {
    const allowedIds = presetIds ? new Set(presetIds) : null;
    return uniqueShapes(CHORD_LIBRARY.filter((entry) => {
      if (allowedIds && !allowedIds.has(entry.id)) return false;
      if (root !== "all" && entry.root !== root) return false;
      if (difficulty !== "all" && !entry.difficultyTags.includes(difficulty as never)) return false;
      if (quality !== "all" && entry.quality !== quality) return false;
      if (position === "open" && !entry.position.toLowerCase().includes("open")) return false;
      if (position === "barre" && !entry.difficultyTags.includes("barre")) return false;
      if (position === "inverted" && entry.inversion !== "inverted") return false;
      if (characteristic === "open" && !entry.chord.frets.includes(0)) return false;
      if (characteristic === "barre" && !entry.chord.barre) return false;
      if (characteristic === "partial" && !entry.difficultyTags.includes("partial") && entry.chord.frets.filter((fret) => fret >= 0).length > 4) return false;
      if (functionKey !== "all" && !entry.functionContexts.some((context) => context.key === functionKey && (functionRole === "all" || context.roles.includes(functionRole as HarmonicRole)))) return false;
      return true;
    }));
  }, [presetIds, root, difficulty, quality, position, characteristic, functionKey, functionRole]);

  useEffect(() => setVisibleLimit(PAGE_SIZE), [filters, presetIds]);

  const displayedEntries = useMemo(() => filteredEntries.slice(0, visibleLimit), [filteredEntries, visibleLimit]);
  const selectedEntries = useMemo(() => uniqueShapes(selectedIds.flatMap((id) => {
    const entry = CHORD_LIBRARY.find((candidate) => candidate.id === id);
    return entry ? [entry] : [];
  })), [selectedIds]);
  const compareEntries = useMemo(() => compareIds.flatMap((id) => {
    const entry = CHORD_LIBRARY.find((candidate) => candidate.id === id);
    return entry ? [entry] : [];
  }), [compareIds]);
  const printEntries = selectedEntries.length ? selectedEntries : filteredEntries;

  const resetFilters = () => {
    setRoot("all"); setDifficulty("all"); setQuality("all"); setPosition("all");
    setCharacteristic("all"); setFunctionKey("all"); setFunctionRole("all");
  };

  const applyEntries = (name: string, entries: ChordLibraryItem[], key?: string) => {
    resetFilters();
    setPresetName(name);
    setPresetIds(uniqueShapes(entries).map((entry) => entry.id));
    if (key) setFunctionKey(key);
  };

  const selectNamedOpen = (names: string[]) => names.flatMap((name) => {
    const candidates = CHORD_LIBRARY.filter((entry) => entry.chord.name === name && entry.position.toLowerCase().includes("open"));
    return candidates.length ? [bestEntry(candidates)] : [];
  });

  const applyPracticalProgression = (label: string, roles: HarmonicRole[]) => {
    const key = functionKey === "all" ? "G" : functionKey;
    applyEntries(`${label} in ${key}`, resolveRoles(key, roles), key);
  };

  const toggleSelected = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const toggleCompare = (id: string) => setCompareIds((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 3 ? [...current, id] : [...current.slice(1), id]);
  const revealAlternative = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current : [...current, id]);
    setPresetIds((current) => current && !current.includes(id) ? [...current, id] : current);
  };

  const persistCharts = (next: SavedChart[]) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSavedCharts(next);
    } catch {
      setSaveStatus("This browser could not update local chart storage.");
    }
  };

  const saveChart = () => {
    const name = saveName.trim();
    if (!name) { setSaveStatus("Name your chart first."); return; }
    const chart: SavedChart = {
      id: `${Date.now()}`,
      name,
      selectedIds: selectedIds.filter((id) => CHORD_LIBRARY.some((entry) => entry.id === id)),
      filters: { root, difficulty, quality, position, characteristic, key: functionKey, role: functionRole },
      settings: { orientation, highContrast, capo, tuning, layout, columns }
    };
    persistCharts([...savedCharts, chart]);
    setSaveName("");
    setSaveStatus(`Saved “${name}”.`);
  };

  const loadChart = (chart: SavedChart) => {
    setSelectedIds(chart.selectedIds.filter((id) => CHORD_LIBRARY.some((entry) => entry.id === id)));
    setPresetIds(null); setPresetName(`Saved · ${chart.name}`);
    setRoot(CHORD_LIBRARY_ROOTS.includes(chart.filters.root) ? chart.filters.root : "all");
    setDifficulty(chart.filters.difficulty); setQuality(chart.filters.quality); setPosition(chart.filters.position);
    setCharacteristic(chart.filters.characteristic); setFunctionKey(CHORD_FUNCTION_KEYS.includes(chart.filters.key) ? chart.filters.key : "all");
    setFunctionRole(HARMONIC_FUNCTION_OPTIONS.includes(chart.filters.role as HarmonicRole) ? chart.filters.role : "all");
    setOrientation(chart.settings.orientation === "left" ? "left" : "right");
    setHighContrast(Boolean(chart.settings.highContrast)); setCapo(Math.min(7, Math.max(0, Number(chart.settings.capo) || 0)));
    setTuning(TUNING_LABELS[chart.settings.tuning] ? chart.settings.tuning : "standard");
    setLayout(chart.settings.layout === "compact" ? "compact" : "full"); setColumns(chart.settings.columns === 2 ? 2 : 3);
    setSaveStatus(`Loaded “${chart.name}”.`);
  };

  const printChart = () => {
    setIsPrinting(true);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.print()));
  };

  return (
    <main className={`page chords focused-page chart-builder ${highContrast ? "chart-builder-high-contrast" : ""}`}>
      <section className="studio-heading chords-hero">
        <div>
          <span className="tag">Chord Chart Builder</span>
          <h1>Build a useful chart, then print only what you need.</h1>
          <p>Start with a level, key, progression, or curated set. Filter the playable shapes, compare nearby grips, and save the result for a song or lesson.</p>
        </div>
        <div className="studio-session-note print-card">
          <span className="label">Current chart</span>
          <strong>{presetName}</strong>
          <span>{selectedIds.length ? `${selectedEntries.length} selected shape${selectedEntries.length === 1 ? "" : "s"} will print.` : `${filteredEntries.length} filtered shape${filteredEntries.length === 1 ? "" : "s"} will print.`}</span>
        </div>
      </section>

      <section className="chart-builder-controls" aria-label="Chord chart controls">
        <div className="chart-control-group">
          <div className="chart-control-heading"><div><span className="label">1 · Start</span><h2>Presets and progressions</h2></div><button className="btn ghost" type="button" onClick={() => { resetFilters(); setPresetIds(null); setPresetName("Original full library by root"); }}>Original level/root browser</button></div>
          <div className="chart-preset-row">
            <button className="btn" type="button" onClick={() => applyEntries("First 8 open chords", selectNamedOpen(["C", "A", "G", "E", "D", "Am", "Em", "Dm"]))}>First 8 open chords</button>
            <button className="btn" type="button" onClick={() => applyEntries("Essential barre chords", uniqueShapes(CHORD_LIBRARY.filter((entry) => entry.difficultyTags.includes("barre"))).slice(0, 8))}>Essential barre chords</button>
            <button className="btn" type="button" onClick={() => applyEntries("Campfire key of G", resolveRoles("G", ["I", "IV", "V", "vi"]), "G")}>Campfire G</button>
            {LEVELS.map((level, index) => <button className="btn" key={level.name} type="button" onClick={() => applyEntries(`Level · ${level.name}`, levelEntries(index))}>{level.name}</button>)}
          </div>
          <div className="chart-preset-row">
            {PROGRESSION_PACKS.map((pack) => <button className="btn ghost" key={pack.id} type="button" onClick={() => applyEntries(pack.title, pack.chordIds.flatMap((id) => { const entry = CHORD_LIBRARY.find((candidate) => candidate.id === id); return entry ? [entry] : []; }), pack.keyCenter)}>{pack.title}</button>)}
          </div>
          <div className="chart-preset-row">
            <button className="btn ghost" type="button" onClick={() => applyPracticalProgression("I–IV–V", ["I", "IV", "V"])}>I–IV–V</button>
            <button className="btn ghost" type="button" onClick={() => applyPracticalProgression("I–V–vi–IV", ["I", "V", "vi", "IV"])}>I–V–vi–IV</button>
            <button className="btn ghost" type="button" onClick={() => applyPracticalProgression("12-bar blues chords", ["I", "IV", "V"])}>Blues I–IV–V</button>
            <button className="btn ghost" type="button" onClick={() => applyPracticalProgression("ii–V–I", ["ii", "V", "I"])}>ii–V–I</button>
            <button className="btn primary" type="button" onClick={() => applyPracticalProgression("Common chords", ["I", "ii", "iii", "IV", "V", "vi"])}>Common I–vi</button>
          </div>
        </div>

        <div className="chart-control-group">
          <div className="chart-control-heading"><div><span className="label">2 · Refine</span><h2>Shape filters</h2></div><button className="btn ghost" type="button" onClick={resetFilters}>Reset filters</button></div>
          <div className="chart-filter-grid">
            <label>Root<select value={root} onChange={(event) => setRoot(event.target.value)}><option value="all">All roots</option>{CHORD_LIBRARY_ROOTS.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Difficulty<select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="all">All difficulty</option>{CHORD_DIFFICULTY_TAGS.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Quality<select value={quality} onChange={(event) => setQuality(event.target.value)}><option value="all">All qualities</option>{CHORD_QUALITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label>Position<select value={position} onChange={(event) => setPosition(event.target.value)}><option value="all">All positions</option><option value="open">Open position</option><option value="barre">Barre position</option><option value="inverted">Inverted</option></select></label>
            <label>Shape / ringing<select value={characteristic} onChange={(event) => setCharacteristic(event.target.value)}><option value="all">All shapes</option><option value="open">Open strings ring</option><option value="barre">Has a barre</option><option value="partial">Partial grip</option></select></label>
            <label>Key<select value={functionKey} onChange={(event) => setFunctionKey(event.target.value)}><option value="all">All keys</option>{CHORD_FUNCTION_KEYS.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label>Function<select value={functionRole} disabled={functionKey === "all"} onChange={(event) => setFunctionRole(event.target.value)}><option value="all">I ii iii IV V vi</option>{HARMONIC_FUNCTION_OPTIONS.map((value) => <option key={value}>{value}</option>)}</select></label>
          </div>
        </div>

        <div className="chart-control-group">
          <span className="label">3 · Display and print</span>
          <div className="chart-settings-grid">
            <label>Handedness<select value={orientation} onChange={(event) => setOrientation(event.target.value as Orientation)}><option value="right">Right-handed</option><option value="left">Left-handed</option></select></label>
            <label>Capo<select value={capo} onChange={(event) => setCapo(Number(event.target.value))}>{Array.from({ length: 8 }, (_, fret) => <option key={fret} value={fret}>{fret ? `Fret ${fret}` : "No capo"}</option>)}</select></label>
            <label>Tuning<select value={tuning} onChange={(event) => setTuning(event.target.value as Tuning)}>{Object.entries(TUNING_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Card detail<select value={layout} onChange={(event) => setLayout(event.target.value as Layout)}><option value="full">Full cards</option><option value="compact">Compact cards</option></select></label>
            <label>Print columns<select value={columns} onChange={(event) => setColumns(Number(event.target.value) as PrintColumns)}><option value={2}>2 columns</option><option value={3}>3 columns</option></select></label>
            <label className="chart-checkbox"><input type="checkbox" checked={highContrast} onChange={(event) => setHighContrast(event.target.checked)} />High contrast</label>
          </div>
          <p className="chart-tuning-note">{TUNING_LABELS[tuning]}. Tuning changes the display note only; shapes are not silently transposed.</p>
          <div className="chart-action-row">
            <button className="btn" type="button" onClick={() => setSelectedIds((current) => Array.from(new Set([...current, ...displayedEntries.map((entry) => entry.id)])))}>Select visible</button>
            <button className="btn ghost" type="button" onClick={() => { const visible = new Set(displayedEntries.map((entry) => entry.id)); setSelectedIds((current) => current.filter((id) => !visible.has(id))); }} disabled={!displayedEntries.some((entry) => selectedIds.includes(entry.id))}>Clear visible</button>
            <button className="btn ghost" type="button" onClick={() => setSelectedIds([])} disabled={!selectedIds.length}>Clear all</button>
            <button className="btn primary" type="button" onClick={printChart}>Print {selectedEntries.length ? `${selectedEntries.length} selected` : `${filteredEntries.length} filtered`}</button>
          </div>
        </div>

        <div className="chart-control-group chart-save-controls">
          <div><span className="label">Reusable charts</span><h2>Save for a song, lesson, or practice pack</h2></div>
          <div className="chart-save-row"><label><span className="visually-hidden">Chart name</span><input type="text" value={saveName} onChange={(event) => setSaveName(event.target.value)} placeholder="Chart name" maxLength={60} /></label><button className="btn primary" type="button" onClick={saveChart}>Save current chart</button></div>
          {saveStatus ? <p className="chart-save-status" role="status">{saveStatus}</p> : null}
          {savedCharts.length ? <div className="chart-saved-list">{savedCharts.map((chart) => <div key={chart.id}><strong>{chart.name}</strong><span>{chart.selectedIds.length} selected</span><button className="btn" type="button" onClick={() => loadChart(chart)}>Load</button><button className="btn ghost" type="button" onClick={() => persistCharts(savedCharts.filter((item) => item.id !== chart.id))}>Delete</button></div>)}</div> : <p className="muted">Saved charts stay in this browser.</p>}
        </div>
      </section>

      {compareEntries.length ? <section className="chart-compare-panel">
        <div className="chart-control-heading"><div><span className="label">Nearby-shape compare</span><h2>{compareEntries.map((entry) => entry.chord.name).join(" → ")}</h2></div><button className="btn ghost" type="button" onClick={() => setCompareIds([])}>Clear compare</button></div>
        <div className="chart-compare-summary">
          {compareEntries.slice(1).map((entry, index) => {
            const previous = compareEntries[index];
            const shared = entry.chord.frets.filter((fret, stringIndex) => fret === previous.chord.frets[stringIndex]).length;
            const movement = entry.chord.frets.reduce((sum, fret, stringIndex) => sum + Math.abs(Math.max(0, fret) - Math.max(0, previous.chord.frets[stringIndex])), 0);
            return <p key={entry.id}><strong>{previous.chord.name} → {entry.chord.name}:</strong> {shared} unchanged strings · {movement} total fret steps. {movement < 8 ? "A compact transition." : "Move slowly and release pressure between grips."}</p>;
          })}
          {compareEntries.length === 1 ? <p>Add one or two more cards to compare shared strings and approximate fret movement.</p> : null}
        </div>
      </section> : null}

      <section className="chord-section chart-screen-results">
        <div className="chord-section-header chart-results-header">
          <div><h2>{presetName}</h2><p>{filteredEntries.length} unique physical shape{filteredEntries.length === 1 ? "" : "s"}; showing {Math.min(displayedEntries.length, filteredEntries.length)}.</p></div>
          <span>{selectedEntries.length} selected · {compareEntries.length}/3 comparing</span>
        </div>
        {displayedEntries.length ? <div className="chart-results-grid">{displayedEntries.map((entry) => <ChartCard key={entry.id} entry={entry} selected={selectedIds.includes(entry.id)} comparing={compareIds.includes(entry.id)} orientation={orientation} highContrast={highContrast} capo={capo} tuning={tuning} layout={layout} onToggle={() => toggleSelected(entry.id)} onCompare={() => toggleCompare(entry.id)} onAlternative={revealAlternative} />)}</div> : <div className="chart-empty"><h3>No shapes match these filters.</h3><p>Reset one filter or choose another preset.</p></div>}
        {displayedEntries.length < filteredEntries.length ? <div className="chart-load-more"><button className="btn" type="button" onClick={() => setVisibleLimit((current) => current + PAGE_SIZE)}>Load {Math.min(PAGE_SIZE, filteredEntries.length - displayedEntries.length)} more</button></div> : null}
      </section>

      <section className={`chart-print-sheet chart-print-${columns}`} aria-label="Printable chord chart">
        <header className="chart-print-heading"><h1>{presetName}</h1><p>{TUNING_LABELS[tuning]} · {orientation === "left" ? "left" : "right"}-handed · {capo ? `capo ${capo}` : "no capo"}</p></header>
        {isPrinting ? printEntries.map((entry) => <ChartCard key={`print-${entry.id}`} entry={entry} selected={selectedIds.includes(entry.id)} comparing={false} orientation={orientation} highContrast={highContrast} capo={capo} tuning={tuning} layout={layout} printable />) : null}
      </section>
    </main>
  );
}
