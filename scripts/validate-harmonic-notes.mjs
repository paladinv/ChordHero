const NOTE_INDEX = new Map([
  ["C", 0], ["C#", 1], ["Db", 1], ["D", 2], ["D#", 3], ["Eb", 3], ["E", 4], ["F", 5],
  ["F#", 6], ["Gb", 6], ["G", 7], ["G#", 8], ["Ab", 8], ["A", 9], ["A#", 10], ["Bb", 10], ["B", 11]
]);
const ROOTS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64];
const pitchClass = (midi) => ((midi % 12) + 12) % 12;
const normalizeNote = (note) => note?.replace(/♯/g, "#").replace(/♭/g, "b");

export function validateChordQualityDefinitions(definitions) {
  if (!Array.isArray(definitions) || definitions.length === 0) throw new Error("Chord quality definitions must be a non-empty array.");
  const ids = new Set();
  const aliases = new Map();
  for (const quality of definitions) {
    if (!quality || typeof quality.id !== "string" || !/^[A-Za-z][A-Za-z0-9]*$/.test(quality.id) || ids.has(quality.id)) {
      throw new Error(`Malformed or duplicate chord quality id: ${quality?.id}`);
    }
    ids.add(quality.id);
    if (typeof quality.label !== "string" || !quality.label.trim() || typeof quality.suffix !== "string" || !Array.isArray(quality.aliases) || quality.aliases.some((alias) => typeof alias !== "string")) {
      throw new Error(`Chord quality ${quality.id} has malformed naming or aliases.`);
    }
    for (const field of ["intervals", "essential", "optional"]) {
      if (!Array.isArray(quality[field]) || quality[field].some((interval) => !Number.isInteger(interval) || interval < 0 || interval > 11) || new Set(quality[field]).size !== quality[field].length) {
        throw new Error(`Chord quality ${quality.id} has malformed ${field} intervals.`);
      }
    }
    const intervals = new Set(quality.intervals);
    const essential = new Set(quality.essential);
    const optional = new Set(quality.optional);
    if (!intervals.has(0) || !essential.has(0) || [...essential, ...optional].some((interval) => !intervals.has(interval)) || [...essential].some((interval) => optional.has(interval)) || [...intervals].some((interval) => !essential.has(interval) && !optional.has(interval))) {
      throw new Error(`Chord quality ${quality.id} must include the root interval 0 as essential and partition all intervals into essential and optional tones.`);
    }
    for (const alias of quality.aliases) {
      const key = alias.toLowerCase().replace(/[♭]/g, "b").replace(/[♯]/g, "#").replace(/[\s_]/g, "").replace(/(?<=[a-z])-(?=[a-z])/g, "");
      const owner = aliases.get(key);
      if (key && owner && owner !== quality.id) throw new Error(`Chord quality alias ${alias} is ambiguous between ${owner} and ${quality.id}.`);
      if (key) aliases.set(key, quality.id);
    }
  }
  return definitions;
}

export function validateHarmonicReviewBaseline(baseline) {
  if (!baseline || baseline.schemaVersion !== 1 || baseline.policy !== "review-required-unresolved" || !Array.isArray(baseline.entries)) {
    throw new Error("Harmonic review baseline must use schemaVersion 1 and policy review-required-unresolved.");
  }
  const ids = new Set();
  for (const entry of baseline.entries) {
    if (!entry || typeof entry.id !== "string" || !entry.id || ids.has(entry.id) || entry.reviewRequired !== true || entry.status !== "unresolved" || !Array.isArray(entry.missingIntervals) || entry.missingIntervals.length === 0 || entry.missingIntervals.some((interval) => !Number.isInteger(interval) || interval < 0 || interval > 11) || new Set(entry.missingIntervals).size !== entry.missingIntervals.length) {
      throw new Error(`Malformed or duplicate review-required harmonic baseline record: ${entry?.id}`);
    }
    ids.add(entry.id);
  }
  return baseline.entries;
}

export function validateHarmonicNotes(entries, qualityDefinitions, report = console.warn, reviewBaseline = { schemaVersion: 1, policy: "review-required-unresolved", entries: [] }) {
  validateChordQualityDefinitions(qualityDefinitions);
  const baselineEntries = validateHarmonicReviewBaseline(reviewBaseline);
  const baselineByID = new Map(baselineEntries.map((entry) => [entry.id, new Set(entry.missingIntervals)]));
  const qualityByID = new Map(qualityDefinitions.map((quality) => [quality.id, quality]));
  const rootsSeen = new Map();
  const malformed = [];
  const partialNotes = [];
  const unreviewedPartialNotes = [];
  const slashBassWarnings = [];
  let complete = 0;

  for (const entry of entries) {
    const root = NOTE_INDEX.get(normalizeNote(entry.root));
    const quality = qualityByID.get(entry.quality);
    const frets = entry.chord?.frets;
    const fingers = entry.chord?.fingers;
    const barre = entry.chord?.barre;
    const badBarre = barre !== undefined && barre !== null && (!Number.isInteger(barre.fret) || barre.fret < 1 || barre.fret > 24 || !Number.isInteger(barre.from) || !Number.isInteger(barre.to) || barre.from < 0 || barre.to > 5 || barre.from > barre.to);
    const isMalformed = root === undefined || !quality || !Array.isArray(frets) || frets.length !== 6 || frets.some((fret) => !Number.isInteger(fret) || fret < -1 || fret > 24) || !Array.isArray(fingers) || fingers.length !== 6 || fingers.some((finger) => finger !== null && ![1, 2, 3, 4].includes(finger)) || (Array.isArray(frets) && Array.isArray(fingers) && frets.some((fret, index) => fret > 0 && fingers[index] === null)) || badBarre || !entry.chord?.name || !["standard", "inverted"].includes(entry.inversion);
    if (isMalformed) {
      malformed.push(entry.id);
      report(`Malformed chord chart: ${entry.id} has invalid root, quality, six-string fret/finger data, or inversion metadata.`);
      continue;
    }

    const rootName = normalizeNote(entry.root);
    const rootPC = NOTE_INDEX.get(rootName);
    const familyKey = `${rootPC}:${quality.id}`;
    rootsSeen.set(familyKey, (rootsSeen.get(familyKey) ?? 0) + 1);
    const notes = frets.flatMap((fret, index) => fret < 0 ? [] : [pitchClass(OPEN_STRING_MIDI[index] + fret)]);
    const intervals = new Set(notes.map((note) => (note - rootPC + 12) % 12));
    const missing = quality.intervals.filter((interval) => !intervals.has(interval));
    if (missing.length) {
      const essentialMissing = quality.essential.filter((interval) => !intervals.has(interval));
      const optionalMissing = quality.optional.filter((interval) => !intervals.has(interval));
      const detail = { id: entry.id, root: rootName, quality: quality.id, missing, essentialMissing, optionalMissing };
      partialNotes.push(detail);
      const baselineMissing = baselineByID.get(entry.id);
      const newlyMissing = missing.filter((interval) => !baselineMissing?.has(interval));
      if (!baselineMissing || newlyMissing.length) unreviewedPartialNotes.push({ ...detail, newIntervals: newlyMissing.length ? newlyMissing : missing });
      report(`${baselineMissing && !newlyMissing.length ? "Review-required legacy gap (unresolved)" : "Unbaselined partial-tone gap"}: ${entry.id} (${entry.chord.name}) omits ${essentialMissing.length ? `essential interval(s) ${essentialMissing.join(", ")}` : "no essential tones"}${optionalMissing.length ? `; optional color interval(s) ${optionalMissing.join(", ")} omitted` : ""}.`);
    } else {
      complete += 1;
    }

    const slashName = entry.chord.name.split("/");
    if (slashName.length > 2 || (entry.inversion === "inverted" && slashName.length !== 2)) {
      malformed.push(entry.id);
      report(`Malformed chord chart: ${entry.id} inversion metadata and chord symbol disagree.`);
      continue;
    }
    if (slashName.length === 2) {
      const slashBass = NOTE_INDEX.get(normalizeNote(slashName[1]));
      const bassIndex = frets.findIndex((fret) => fret >= 0);
      const actualBass = bassIndex < 0 ? undefined : pitchClass(OPEN_STRING_MIDI[bassIndex] + frets[bassIndex]);
      if (slashBass === undefined || actualBass !== slashBass) {
        slashBassWarnings.push(entry.id);
        report(`Incorrect slash bass: ${entry.id} is labeled ${entry.chord.name}, but its lowest sounding string does not match the slash bass.`);
      }
    }
  }

  const coverage = ROOTS.flatMap((root) => qualityDefinitions.map((quality) => {
    const pitch = NOTE_INDEX.get(root);
    const count = rootsSeen.get(`${pitch}:${quality.id}`) ?? 0;
    return { root, quality: quality.id, count, missing: count === 0 };
  }));
  const missingCombinations = coverage.filter((cell) => cell.missing);
  return { total: entries.length, complete, partial: partialNotes.length, partialNotes, unreviewedPartialNotes, malformed, bassWarnings: slashBassWarnings.length, slashBassWarnings, coverage, missingCombinations };
}
