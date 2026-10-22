import type { LibrarySong, SongComposition, SongCompositionEvent, SongCompositionTrack, SongInstrument } from "./songLibrary";
import { barBeatSeconds, barSecondsBeat, buildSongTimeline, createSongComposition, eventMidiPitches, measureQuarterBeats, meterParts } from "./songBuilder";

const uid = () => crypto.randomUUID();
const supportedMeter = (value: string) => /^(?:[1-9]|1[0-6])\/(?:2|4|8|16)$/.test(value);
const importedTempo = (value: number) => Math.max(40, Math.min(240, Math.round(value)));
const pitchXml = (midi: number, prefix = "") => {
  const pitch = ((midi % 12) + 12) % 12;
  const steps = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"];
  return `<${prefix}step>${steps[pitch]}</${prefix}step>${[1, 3, 6, 8, 10].includes(pitch) ? `<${prefix}alter>1</${prefix}alter>` : ""}<${prefix}octave>${Math.floor(midi / 12) - 1}</${prefix}octave>`;
};
const escapeXml = (text: string) => text.replace(/[<>&"']/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[character]!));
const ppq = 6720;
function variable(value: number) { let number = Math.max(0, Math.round(value)); const bytes = [number & 127]; while ((number >>= 7) > 0) bytes.unshift((number & 127) | 128); return bytes; }
const be = (value: number, length: number) => Array.from({ length }, (_, i) => (value >>> ((length - i - 1) * 8)) & 255);
const ascii = (value: string) => [...value].map((character) => character.charCodeAt(0));
const meta = (type: number, bytes: number[]) => [255, type, ...variable(bytes.length), ...bytes];
function midiTrack(events: { tick: number; bytes: number[]; priority?: number }[]) {
  events.sort((a, b) => a.tick - b.tick || (a.priority ?? 1) - (b.priority ?? 1));
  let last = 0; const bytes: number[] = [];
  for (const event of events) { bytes.push(...variable(event.tick - last), ...event.bytes); last = event.tick; }
  bytes.push(0, 255, 47, 0);
  return [...ascii("MTrk"), ...be(bytes.length, 4), ...bytes];
}

function validateExchange(song: LibrarySong) {
  if (!song.composition) throw new Error("Create a composition first.");
  for (const section of song.composition.sections) for (const track of song.composition.tracks) {
    const beats = measureQuarterBeats(section.timeSignature ?? song.composition.timeSignature);
    for (const measure of section.measuresByTrack[track.id] ?? []) for (const event of measure.events) {
      if (event.startBeat < 0 || event.durationBeats <= 0 || !event.grace && event.startBeat + event.durationBeats > (measure.beats ?? beats) + 0.001) throw new Error("Fix events outside their measure before exporting MIDI or MusicXML. Use ties for notes crossing barlines.");
      if (eventMidiPitches(track, event).some((pitch) => pitch < 0 || pitch > 127)) throw new Error("Fix pitches outside MIDI range 0–127 before exporting.");
    }
  }
}

export function exportMidi(song: LibrarySong): Blob {
  validateExchange(song);
  if (!song.composition) throw new Error("Create a composition first.");
  if (song.composition.tracks.length > 15) throw new Error("MIDI supports up to 15 tracks, including percussion.");
  const timeline = buildSongTimeline(song);
  let tick = 0;
  const starts = new Map<number, number>();
  const conductor: { tick: number; bytes: number[] }[] = [{ tick: 0, bytes: meta(3, [...new TextEncoder().encode(song.title)]) }];
  timeline.bars.forEach((bar) => {
    starts.set(bar.index, tick);
    const { numerator, denominator } = meterParts(bar.meter);
    for (const mark of bar.tempoChanges ?? []) conductor.push({ tick: tick + Math.round(mark.beat * ppq), bytes: meta(81, be(Math.round(60000000 / mark.bpm),3)) });
    conductor.push({ tick, bytes: meta(81, be(Math.round(60000000 / bar.bpm), 3)) }, { tick, bytes: meta(88, [numerator, Math.log2(denominator), 24, 8]) });
    if (bar.measureIndex === 0) conductor.push({ tick, bytes: meta(6, [...new TextEncoder().encode(bar.sectionTitle)]) });
    tick += bar.measureBeats * ppq;
  });
  const melodicChannels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15];
  let melodicChannelIndex = 0;
  const tracks = song.composition.tracks.map((track) => {
    const channel = track.instrument === "percussion" ? 9 : melodicChannels[melodicChannelIndex++];
    const program = track.instrument === "bass" ? 33 : track.instrument === "ukulele" ? 24 : track.instrument === "piano" ? 0 : track.instrument === "vocals" ? 54 : 27;
    const events = [{ tick: 0, bytes: meta(3, [...new TextEncoder().encode(track.name)]) }, ...(track.instrument === "percussion" ? [] : [{ tick: 0, bytes: [192 | channel, program] }]), { tick: 0, bytes: [176 | channel, 7, Math.round((track.muted || song.composition!.tracks.some((item) => item.solo) && !track.solo ? 0 : track.volume ?? 1) * 127)] }, { tick: 0, bytes: [176 | channel, 10, Math.round(((track.pan ?? 0) + 1) * 63.5)] }];
    const secondsToTicks = (seconds: number) => { const bar = timeline.bars.find((item) => seconds >= item.startsAt && seconds < item.startsAt + item.duration) ?? timeline.bars.at(-1)!; return Math.round((starts.get(bar.index) ?? 0) + barSecondsBeat(bar, Math.max(0,seconds - bar.startsAt)) * ppq); };
    timeline.events.filter((cue) => cue.track.id === track.id).forEach((cue) => cue.pitches.forEach((pitch) => {
      events.push({ tick: secondsToTicks(cue.at), bytes: [144 | channel, pitch, cue.event.accent ? 115 : 90] }, { tick: secondsToTicks(cue.at + cue.duration), bytes: [128 | channel, pitch, 0] });
    }));
    return midiTrack(events);
  });
  return new Blob([new Uint8Array([...ascii("MThd"), 0, 0, 0, 6, 0, 1, ...be(tracks.length + 1, 2), ...be(ppq, 2), ...midiTrack(conductor), ...tracks.flat()])], { type: "audio/midi" });
}

function pitchEvent(track: SongCompositionTrack, pitches: number[], startBeat: number, durationBeats: number): SongCompositionEvent {
  const pitch = pitches[0];
  const candidates = ["guitar", "ukulele", "bass"].includes(track.instrument) ? track.tuning.flatMap((open, index) => { const fret = pitch - open - track.capo; return fret >= 0 && fret <= 24 ? [{ string: track.tuning.length - index, fret }] : []; }).sort((a, b) => a.fret - b.fret) : [];
  return { id: uid(), kind: "note", startBeat, durationBeats, midiPitches: pitches, ...candidates[0] };
}

export function importMidi(buffer: ArrayBuffer): { title: string; artist: string; composition: SongComposition; warnings: string[] } {
  const data = new Uint8Array(buffer); const view = new DataView(buffer); let position = 0;
  const read = () => { if (position >= data.length) throw new Error("The MIDI file is truncated."); return data[position++]; };
  const number = (length: number) => { let value = 0; for (let i = 0; i < length; i++) value = value * 256 + read(); return value; };
  const text = (length: number) => new TextDecoder().decode(data.slice(position, position += length));
  const variableRead = () => { let value = 0; for (let i = 0; i < 4; i++) { const byte = read(); value = value * 128 + (byte & 127); if (!(byte & 128)) return value; } throw new Error("Invalid MIDI variable length."); };
  if (text(4) !== "MThd") throw new Error("Choose a standard MIDI file.");
  const headerLength = number(4); const format = number(2); const trackCount = number(2); const division = number(2); position += headerLength - 6;
  if (headerLength < 6 || format > 1 || division & 32768 || !division) throw new Error("Use a format 0 or 1 MIDI file with musical beat timing.");
  type Note = { pitch: number; start: number; duration: number };
  const parts: { name: string; channel: number; program: number; notes: Note[] }[] = [];
  const tempos: { at: number; bpm: number }[] = []; const meters: { at: number; value: string }[] = [];
  const warnings: string[] = []; let title = "Imported MIDI";
  for (let t = 0; t < trackCount; t++) {
    if (text(4) !== "MTrk") throw new Error("Invalid MIDI track.");
    const size = number(4); const end = position + size; if (end > data.length) throw new Error("The MIDI track is truncated.");
    let time = 0; let running = 0; let name = `Track ${t + 1}`;
    const programs = new Map<number, number>(); const byChannel = new Map<number, Note[]>(); const active = new Map<string, number[]>();
    while (position < end) {
      time += variableRead(); let status = read();
      if (status < 128) { if (!running) throw new Error("Invalid MIDI running status."); position--; status = running; } else if (status < 240) running = status;
      if (status === 255) {
        const type = read(); const length = variableRead(); const payload = position; if (position + length > end) throw new Error("Invalid MIDI metadata.");
        if (type === 3) { name = new TextDecoder().decode(data.slice(position, position + length)); if (t === 0) title = name; }
        if (type === 81 && length === 3) tempos.push({ at: time / division, bpm: 60000000 / (view.getUint8(payload) * 65536 + view.getUint8(payload + 1) * 256 + view.getUint8(payload + 2)) });
        if (type === 88 && length >= 2) meters.push({ at: time / division, value: `${data[payload]}/${2 ** data[payload + 1]}` });
        position += length; running = 0; continue;
      }
      if (status === 240 || status === 247) { const length = variableRead(); position += length; running = 0; continue; }
      if (status >= 240) throw new Error("Unsupported MIDI system event.");
      const channel = status & 15; const command = status >> 4; const a = read(); const b = command === 12 || command === 13 ? 0 : read();
      if (command === 12) programs.set(channel, a);
      const key = `${channel}:${a}`;
      if (command === 9 && b > 0) { const queue = active.get(key) ?? []; queue.push(time); active.set(key, queue); }
      if (command === 8 || command === 9 && b === 0) {
        const start = active.get(key)?.shift(); if (start !== undefined) { const notes = byChannel.get(channel) ?? []; notes.push({ pitch: a, start: start / division, duration: Math.max(1 / 96, (time - start) / division) }); byChannel.set(channel, notes); }
      }
    }
    if ([...active.values()].some((queue) => queue.length)) warnings.push(`${name}: unterminated notes were skipped.`);
    byChannel.forEach((notes, channel) => parts.push({ name, channel, program: programs.get(channel) ?? 24, notes }));
  }
  if (!parts.length) throw new Error("No playable notes found.");
  if (parts.length > 15) throw new Error("Import up to 15 MIDI parts, including percussion.");
  if (meters.some((change) => !supportedMeter(change.value))) throw new Error("This MIDI meter is unsupported. Use 1–16 beats with a half, quarter, eighth, or sixteenth-note denominator.");
  if (tempos.some((change) => change.bpm < 40 || change.bpm > 240)) warnings.push("Tempos outside 40–240 BPM were adjusted to the supported composition range.");
  const composition = createSongComposition("C", importedTempo(tempos[0]?.bpm ?? 120), meters[0]?.value ?? "4/4");
  composition.tracks = parts.map((part) => { const instrument: SongInstrument = part.channel === 9 ? "percussion" : part.program >= 32 && part.program <= 39 ? "bass" : part.program <= 7 ? "piano" : part.program >= 52 && part.program <= 55 ? "vocals" : "guitar"; const tuning = instrument === "bass" ? [28, 33, 38, 43] : instrument === "piano" ? [36, 48, 60, 72, 84] : instrument === "vocals" ? [48, 60, 72, 84] : instrument === "percussion" ? [36, 38, 42, 45, 46, 49, 51] : [40, 45, 50, 55, 59, 64]; return { ...composition.tracks[0], id: uid(), name: part.name, instrument, tuning, tuningLabel: instrument === "piano" ? "MIDI range · C2–C6" : instrument === "vocals" ? "MIDI range · C3–C6" : instrument === "percussion" ? "General MIDI drum map" : "Standard" }; });
  composition.sections = [];
  tempos.sort((a, b) => a.at - b.at); meters.sort((a, b) => a.at - b.at);
  const maxBeat = parts.reduce((end, part) => part.notes.reduce((last, note) => Math.max(last, note.start + note.duration), end), 0);
  let at = 0; let bars = 0; let previousSettings = "";
  while (at < maxBeat && bars++ < 512) {
    const bpm = importedTempo(tempos.filter((change) => change.at <= at + 0.001).at(-1)?.bpm ?? composition.bpm);
    const meter = meters.filter((change) => change.at <= at + 0.001).at(-1)?.value ?? composition.timeSignature;
    const beats = measureQuarterBeats(meter); const settings = `${bpm}:${meter}`;
    if (settings !== previousSettings) { composition.sections.push({ id: uid(), title: `Imported part ${composition.sections.length + 1}`, kind: "other", repeats: 1, bpm, timeSignature: meter, measuresByTrack: Object.fromEntries(composition.tracks.map((track) => [track.id, []])) }); previousSettings = settings; }
    if (composition.sections.length > 64) throw new Error("Import up to 64 tempo/meter sections at a time.");
    const section = composition.sections.at(-1)!;
    composition.tracks.forEach((track, i) => {
      const notes = parts[i].notes.filter((note) => note.start < at + beats - 0.0001 && note.start + note.duration > at + 0.0001);
      if (notes.length > 128) throw new Error("This MIDI measure has more than 128 note events. Simplify the part before importing.");
      section.measuresByTrack[track.id].push({ id: uid(), tempoChanges: tempos.filter(change=>change.at>at+.001&&change.at<at+beats-.001).map(change=>({beat:change.at-at,bpm:importedTempo(change.bpm)})), events: notes.map((note) => ({ ...pitchEvent(track, [note.pitch], Math.max(0, note.start - at), Math.min(at + beats, note.start + note.duration) - Math.max(at, note.start)), tie: note.start + note.duration > at + beats + 0.001 })) });
    });
    if (meters.some((change) => change.at > at + 0.001 && change.at < at + beats - 0.001)) warnings.push("A meter change inside a measure was applied at the next measure boundary.");
    at += beats;
  }
  if (at < maxBeat) warnings.push("Only the first 512 measures were imported.");
  return { title, artist: "Imported MIDI", composition, warnings: [...new Set(warnings)] };
}

export function exportMusicXml(song: LibrarySong) {
  validateExchange(song);
  if (!song.composition) throw new Error("Create a composition first.");
  const composition = song.composition; const bars = buildSongTimeline(song).bars;
  const parts = composition.tracks.map((track, index) => {
    const measures = bars.map((bar, barIndex) => {
      const { numerator, denominator } = meterParts(bar.meter);
      const fretted = ["guitar", "ukulele", "bass"].includes(track.instrument);
      let body = `<attributes><divisions>6720</divisions><time><beats>${numerator}</beats><beat-type>${denominator}</beat-type></time><clef><sign>${track.instrument === "bass" ? "F" : track.instrument === "percussion" ? "percussion" : "G"}</sign><line>${track.instrument === "bass" ? 4 : 2}</line></clef>${barIndex === 0 && fretted ? `<staff-details>${track.tuning.map((midi, string) => `<staff-tuning line="${string + 1}">${pitchXml(midi, "tuning-")}</staff-tuning>`).join("")}<capo>${track.capo}</capo></staff-details>` : ""}${track.instrument === "guitar" ? "<transpose><diatonic>0</diatonic><chromatic>0</chromatic><octave-change>-1</octave-change></transpose>" : ""}</attributes><direction><direction-type><words>${escapeXml(bar.sectionTitle)}</words></direction-type><sound tempo="${bar.bpm}"/></direction>`;
      for(const mark of bar.tempoChanges??[]) body += `<direction><offset sound="yes">${Math.round(mark.beat*6720)}</offset><sound tempo="${mark.bpm}"/></direction>`;
      const events = [...bar.events.filter((cue) => cue.track.id === track.id)].sort((a, b) => a.event.startBeat - b.event.startBeat);
      let cursor = 0;
      const rest = (beats: number) => `<note><rest/><duration>${Math.round(beats * 6720)}</duration></note>`;
      for (const cue of events) {
        const event = cue.event;
        if (event.startBeat > cursor) body += rest(event.startBeat - cursor);
        if (event.startBeat < cursor) body += `<backup><duration>${Math.round((cursor - event.startBeat) * 6720)}</duration></backup>`;
        if (event.chord) {
          const root = event.chord.match(/^([A-G])([#b]?)/);
          if (root) body += `<harmony><root><root-step>${root[1]}</root-step>${root[2] ? `<root-alter>${root[2] === "#" ? 1 : -1}</root-alter>` : ""}</root><kind text="${escapeXml(event.chord)}">other</kind></harmony>`;
        }
        if(event.dynamic) body += `<direction><direction-type><dynamics><${event.dynamic}/></dynamics></direction-type></direction>`;
        if (event.technique) body += `<direction><direction-type><words>${event.technique}</words></direction-type></direction>`;
        const pitches = eventMidiPitches(track, event);
        if (!pitches.length) body += rest(event.durationBeats);
        pitches.forEach((midi, i) => {
          const written = midi + (track.instrument === "guitar" ? 12 : 0);
          const pitchClass = written % 12; const steps = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"];
          const alter = [1, 3, 6, 8, 10].includes(pitchClass) ? "<alter>1</alter>" : "";
          const previousBar = bars[barIndex - 1];
          const tiedFrom = [...(previousBar?.events ?? []), ...events].some((other) => other !== cue && other.track.id === track.id && other.event.tie && Math.abs(other.at + other.duration - cue.at) < 0.01 && other.pitches.includes(midi));
          const voicingIndex = event.voicing?.findIndex((fret, string) => fret !== null && track.tuning[string] + track.capo + fret === midi) ?? -1;
          const stringNumber = voicingIndex >= 0 ? track.tuning.length - voicingIndex : event.string;
          const fretNumber = voicingIndex >= 0 ? event.voicing![voicingIndex] : event.fret;
          const technical = `${stringNumber ? `<string>${stringNumber}</string><fret>${fretNumber ?? 0}</fret>` : ""}${event.technique === "hammer-on" ? '<hammer-on type="start">H</hammer-on>' : event.technique === "pull-off" ? '<pull-off type="start">P</pull-off>' : event.technique === "bend" ? `<bend><bend-alter>${event.bendSemitones??2}</bend-alter></bend>` : ""}`;
          const instrumentRef = track.instrument === "percussion" ? `<instrument id="I${index + 1}"/>` : "";
          body += `<note>${event.grace?"<grace/>":""}${i ? "<chord/>" : ""}<pitch><step>${steps[pitchClass]}</step>${alter}<octave>${Math.floor(written / 12) - 1}</octave></pitch>${instrumentRef}${event.grace?"":`<duration>${Math.round(event.durationBeats * 6720)}</duration>`}${tiedFrom ? '<tie type="stop"/>' : ""}${event.tie ? '<tie type="start"/>' : ""}${event.tuplet ? `<time-modification><actual-notes>${event.tuplet}</actual-notes><normal-notes>${event.tuplet === 3 ? 2 : 4}</normal-notes></time-modification>` : ""}<notations>${event.articulation?`<articulations><${event.articulation}/></articulations>`:""}${tiedFrom ? '<tied type="stop"/>' : ""}${event.tie ? '<tied type="start"/>' : ""}${technical ? `<technical>${technical}</technical>` : ""}</notations>${event.lyric || event.chord ? `<lyric><text>${escapeXml(event.lyric || event.chord || "")}</text></lyric>` : ""}</note>`;
        });
        cursor = event.startBeat + (event.grace?0:event.durationBeats);
      }
      if (cursor < bar.measureBeats) body += rest(bar.measureBeats - cursor);
      return `<measure number="${barIndex + 1}"${bar.measureBeats<measureQuarterBeats(bar.meter)?' implicit="yes"':""}>${body}</measure>`;
    }).join("");
    return `<part id="P${index + 1}">${measures}</part>`;
  }).join("");
  return new Blob([`<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><work><work-title>${escapeXml(song.title)}</work-title></work><identification><creator type="composer">${escapeXml(song.artist)}</creator></identification><part-list>${composition.tracks.map((track, i) => `<score-part id="P${i + 1}"><part-name>${escapeXml(track.name)}</part-name><score-instrument id="I${i + 1}"><instrument-name>${track.instrument}</instrument-name></score-instrument>${track.instrument === "percussion" ? `<midi-instrument id="I${i + 1}"><midi-channel>10</midi-channel><midi-program>1</midi-program></midi-instrument>` : ""}</score-part>`).join("")}</part-list>${parts}</score-partwise>`], { type: "application/vnd.recordare.musicxml+xml" });
}

function expandedMeasures(part:Element){
 const written=[...part.querySelectorAll(":scope > measure")]; const result:Element[]=[];let index=0;let start=0;let pass=1;let ending:number[]=[];let steps=0;let activeRepeat=false;
 while(index<written.length&&steps++<4096){const measure=written[index];if(measure.querySelector('repeat[direction="forward"]')){if(activeRepeat&&index!==start)throw new Error("Nested repeat structures need to be expanded in the source score before importing.");if(!activeRepeat){start=index;pass=1;activeRepeat=true;}}
 const opening=measure.querySelector('ending[type="start"]');if(opening)ending=(opening.getAttribute("number")??"").split(/[, ]+/).map(Number);
 if(!ending.length||ending.includes(pass))result.push(measure);
 if(result.length>512)throw new Error("Expanded repeats exceed 512 measures.");
 const backward=measure.querySelector('repeat[direction="backward"]');const inEnding=ending.length>0;if(backward&&Number(backward.getAttribute("times"))>32)throw new Error("A repeat may run up to 32 times.");if(backward&&pass<Math.min(32,Number(backward.getAttribute("times"))||2)){pass++;activeRepeat=true;index=start;ending=[];continue;}
 if(measure.querySelector('ending[type="stop"],ending[type="discontinue"]'))ending=[];
 if(backward){activeRepeat=false;if(!inEnding){pass=1;start=index+1;}}index++;
 }
 if(steps>=4096)throw new Error("The repeat structure is too complex.");return result;
}

export function importMusicXml(text: string) {
  const document = new DOMParser().parseFromString(text, "application/xml");
  if (document.querySelector("parsererror") || document.documentElement.tagName !== "score-partwise") throw new Error("Choose an uncompressed score-partwise MusicXML file (.musicxml or .xml).");
  const parts = [...document.querySelectorAll("score-partwise > part")];
  if (!parts.length || parts.length > 15) throw new Error("Import between 1 and 15 MusicXML parts.");
  const composition = createSongComposition(); const warnings = new Set<string>();
  const tracks = parts.map((part) => {
    const definition = [...document.querySelectorAll("score-part")].find((entry) => entry.getAttribute("id") === part.getAttribute("id"));
    const bass = part.querySelector("clef > sign")?.textContent === "F";
    const instrumentName = `${definition?.querySelector("instrument-name")?.textContent ?? ""} ${definition?.querySelector("part-name")?.textContent ?? ""}`;
    const ukulele = /ukulele/i.test(instrumentName);
    const piano = /piano|keyboard/i.test(instrumentName);
    const vocals = /vocal|voice/i.test(instrumentName);
    const percussion = part.querySelector("clef > sign")?.textContent?.toLowerCase() === "percussion" || /drum|percussion/i.test(instrumentName);
    const tuning = [...part.querySelectorAll("measure:first-child staff-tuning")].sort((a, b) => Number(a.getAttribute("line")) - Number(b.getAttribute("line"))).map((entry) => {
      const step = entry.querySelector("tuning-step")?.textContent ?? "C";
      return (Number(entry.querySelector("tuning-octave")?.textContent) + 1) * 12 + ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[step] ?? 0) + Number(entry.querySelector("tuning-alter")?.textContent ?? 0);
    });
    const instrument: SongInstrument = percussion ? "percussion" : bass ? "bass" : ukulele ? "ukulele" : piano ? "piano" : vocals ? "vocals" : "guitar";
    const fallback = instrument === "bass" ? [28, 33, 38, 43] : instrument === "ukulele" ? [67, 60, 64, 69] : instrument === "piano" ? [36, 48, 60, 72, 84] : instrument === "vocals" ? [48, 60, 72, 84] : instrument === "percussion" ? [36, 38, 42, 45, 46, 49, 51] : [40, 45, 50, 55, 59, 64];
    return { ...composition.tracks[0], id: uid(), name: definition?.querySelector("part-name")?.textContent || "Imported track", instrument, tuning: instrument === "piano" || instrument === "vocals" || instrument === "percussion" ? fallback : tuning.length >= 4 && tuning.length <= 7 ? tuning : fallback, tuningLabel: tuning.length ? "Imported tuning" : instrument === "piano" ? "MIDI range · C2–C6" : instrument === "vocals" ? "MIDI range · C3–C6" : instrument === "percussion" ? "General MIDI drum map" : "Standard", capo: Number(part.querySelector("staff-details > capo")?.textContent) || 0 };
  });
  composition.tracks = tracks; composition.sections = [];
  const partMeasures = parts.map(expandedMeasures);
  const measureTotal = Math.max(...partMeasures.map((measures) => measures.length));
  if (!measureTotal) throw new Error("This MusicXML file contains no measures.");
  if (measureTotal > 512) throw new Error("Import up to 512 measures at a time.");
  const originalTiming=new WeakMap<Element,{bpm:number;meter:string}>();
  const trackDynamics:Array<SongCompositionEvent["dynamic"]>=tracks.map(()=>undefined);
  const divisions = tracks.map(() => 1); const transposition = tracks.map(() => 0); let meter = "4/4"; let bpm = 90; let settings = "";
  for (let measureIndex = 0; measureIndex < measureTotal; measureIndex++) {
    const first = partMeasures[0][measureIndex];
    const beats = first?.querySelector("time > beats")?.textContent; const beatType = first?.querySelector("time > beat-type")?.textContent;
    if (beats && beatType) { meter = `${beats}/${beatType}`; if (!supportedMeter(meter)) throw new Error("This MusicXML meter is unsupported. Use 1–16 beats and a half, quarter, eighth, or sixteenth-note denominator."); }
    const firstChildren=first?[...first.children]:[];const firstNoteIndex=firstChildren.findIndex(child=>child.tagName==="note");
    const header=firstChildren.slice(0,firstNoteIndex<0?firstChildren.length:firstNoteIndex).find(child=>child.tagName==="direction"&&child.querySelector("sound[tempo]")&&Number(child.querySelector("offset")?.textContent??0)===0);
    const original=first?originalTiming.get(first):undefined;
    bpm = original?.bpm ?? (Number(header?.querySelector("sound")?.getAttribute("tempo")) || bpm);
    meter = original?.meter ?? meter;
    if (bpm < 40 || bpm > 240) warnings.add("Tempos outside 40–240 BPM were adjusted to the supported composition range.");
    bpm = importedTempo(bpm);
    if(first&&!original)originalTiming.set(first,{bpm,meter});
    if (`${meter}:${bpm}` !== settings) { composition.sections.push({ id: uid(), title: `Imported part ${composition.sections.length + 1}`, kind: "other", repeats: 1, timeSignature: meter, bpm, measuresByTrack: Object.fromEntries(tracks.map((track) => [track.id, []])) }); settings = `${meter}:${bpm}`; }
    if (composition.sections.length > 64) throw new Error("Import up to 64 tempo/meter sections at a time.");
    const section = composition.sections.at(-1)!;
    tracks.forEach((track, trackIndex) => {
      const measure = partMeasures[trackIndex][measureIndex]; const tempoChanges:Array<{beat:number;bpm:number}>=[]; let maxCursor=0; const events: SongCompositionEvent[] = []; let cursor = 0; let lastStart = 0; const harmonies = new Map<number, string>(); let technique: SongCompositionEvent["technique"];
      if (measure) {
        divisions[trackIndex] = Number(measure.querySelector("attributes > divisions")?.textContent) || divisions[trackIndex];
        // MusicXML transpose describes sounding pitch; clef octave markings describe notation.
        // https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/transpose/
        const transpose = measure.querySelector("attributes > transpose");
        if (transpose) transposition[trackIndex] = Number(transpose.querySelector("chromatic")?.textContent ?? 0) + 12 * Number(transpose.querySelector("octave-change")?.textContent ?? 0);
        for (const child of [...measure.children]) {
          const grace = Boolean(child.querySelector("grace"));
          const duration = grace ? 1/8 : Number(child.querySelector(":scope > duration")?.textContent) / divisions[trackIndex];
          if (child.tagName === "backup") { cursor -= duration; continue; }
          if (child.tagName === "forward") { cursor += duration; continue; }
          if (child.tagName === "harmony") {
            const root = child.querySelector("root-step")?.textContent ?? "C";
            const alteration = Number(child.querySelector("root-alter")?.textContent ?? 0);
            const kind = child.querySelector("kind"); const label = kind?.getAttribute("text") ?? "";
            const suffix = ({ major: "", minor: "m", dominant: "7", "major-seventh": "maj7", "minor-seventh": "m7", diminished: "dim", augmented: "aug" } as Record<string, string>)[kind?.textContent ?? ""] ?? label;
            harmonies.set(cursor, /^[A-G](?:#|b)?/.test(label) ? label : `${root}${alteration === 1 ? "#" : alteration === -1 ? "b" : ""}${suffix}`); continue;
          }
          if (child.tagName === "direction") { const dynamic=child.querySelector("dynamics")?.firstElementChild?.tagName;if(dynamic&&["pp","p","mp","mf","f","ff"].includes(dynamic))trackDynamics[trackIndex]=dynamic as SongCompositionEvent["dynamic"]; const tempo=Number(child.querySelector("sound")?.getAttribute("tempo")); if(tempo){const beat=cursor+Number(child.querySelector("offset")?.textContent??0)/divisions[trackIndex];tempoChanges.push({beat,bpm:importedTempo(tempo)});} const words = child.querySelector("words")?.textContent; technique = (["hammer-on", "pull-off", "slide", "bend", "vibrato", "palm-mute", "strum-up", "strum-down"] as const).find((item) => item === words); continue; }
          if (child.tagName !== "note") continue;
          
          const chord = Boolean(child.querySelector(":scope > chord")); const startBeat = chord ? lastStart : cursor;
          let event: SongCompositionEvent;
          if (child.querySelector("rest")) event = { id: uid(), kind: "rest", startBeat, durationBeats: duration };
          else {
            const step = child.querySelector("pitch > step")?.textContent ?? "C";
            const midi = (Number(child.querySelector("pitch > octave")?.textContent) + 1) * 12 + ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[step] ?? 0) + Number(child.querySelector("pitch > alter")?.textContent ?? 0) + transposition[trackIndex];
            event = pitchEvent(track, [midi], startBeat, duration);
            const string = Number(child.querySelector("technical > string")?.textContent); const fret = child.querySelector("technical > fret");
            if (string && fret) { event.string = string; event.fret = Number(fret.textContent); }
            const symbol = harmonies.get(startBeat);
            if (symbol) { event.kind = "chord"; event.chord = symbol; event.voicing = track.tuning.map((_, i) => event.string === track.tuning.length - i ? event.fret ?? null : null); }
            event.technique = technique; technique=undefined;
            event.tie = Boolean(child.querySelector('tie[type="start"]'));
            event.tuplet = Number(child.querySelector("actual-notes")?.textContent) || undefined;
            if (child.querySelector("hammer-on")) event.technique = "hammer-on";
            else if (child.querySelector("pull-off")) event.technique = "pull-off";
            else if (child.querySelector("bend")) event.technique = "bend";
            else if (child.querySelector("slide")) event.technique = "slide";
          }
          event.grace=grace;
          event.dynamic=trackDynamics[trackIndex];
          const importedLyric = child.querySelector("lyric text")?.textContent?.trim();
          if (importedLyric && importedLyric !== event.chord) event.lyric = importedLyric.slice(0, 120);
          const articulation=child.querySelector("articulations")?.firstElementChild?.tagName;if(articulation&&["staccato","tenuto","marcato"].includes(articulation))event.articulation=articulation as SongCompositionEvent["articulation"];
          if (duration > 0) {
            const group = event.kind === "chord" ? events.find((item) => item.kind === "chord" && item.startBeat === event.startBeat && item.durationBeats === event.durationBeats && item.chord === event.chord) : undefined;
            if (group) { group.midiPitches = [...(group.midiPitches ?? []), ...(event.midiPitches ?? [])]; group.voicing = group.voicing?.map((fret, i) => event.voicing?.[i] ?? fret); }
            else events.push(event);
          }
          if (!chord) { lastStart = cursor; if(!grace)cursor += duration; } maxCursor=Math.max(maxCursor,cursor);
        }

      }
      if (events.length > 128) throw new Error("This MusicXML measure has more than 128 events. Simplify the part before importing.");
      section.measuresByTrack[track.id].push({ id: uid(), events, beats: measure?.getAttribute("implicit")==="yes"&&maxCursor>0?maxCursor:undefined, tempoChanges:tempoChanges.filter(mark=>mark.beat>=0&&mark.beat<(maxCursor||measureQuarterBeats(meter))) });
    });
    bpm=section.measuresByTrack[tracks[0].id].at(-1)?.tempoChanges?.at(-1)?.bpm??bpm;
  }
  composition.bpm = composition.sections[0]?.bpm ?? 90; composition.timeSignature = composition.sections[0]?.timeSignature ?? "4/4";
  return { title: document.querySelector("work-title, movement-title")?.textContent || "Imported score", artist: document.querySelector("creator")?.textContent || "Imported MusicXML", composition, warnings: [...warnings] };
}
