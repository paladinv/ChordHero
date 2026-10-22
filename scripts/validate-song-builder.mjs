import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = mkdtempSync(path.join(os.tmpdir(), "chord-builder-check-"));
try {
  execFileSync(process.execPath, [require.resolve("typescript/bin/tsc"), "--outDir", output, "--noEmit", "false", "--incremental", "false", "--module", "commonjs", "--moduleResolution", "node", "--resolveJsonModule", "true", "--jsx", "react-jsx", "--esModuleInterop", "true", "--skipLibCheck", "true", "--target", "es2022", "lib/songBuilderStudio.ts", "lib/songBuilderZip.ts", "lib/songBuilderWav.ts", "lib/songBuilderEditing.ts", "lib/songBuilderExchange.ts", "lib/songBuilderExport.ts", "lib/songLibrary.ts"], { cwd: root, stdio: "inherit" });
} catch (error) { rmSync(output, { recursive: true, force: true }); throw error; }
const editing = require(path.join(output, 'lib/songBuilderEditing.js'));
const core = require(path.join(output, 'lib/songBuilder.js'));
const exchange = require(path.join(output, 'lib/songBuilderExchange.js'));
const library = require(path.join(output, 'lib/songLibrary.js'));
const studio = require(path.join(output,"lib/songBuilderStudio.js"));
const notation = require(path.join(output, 'lib/songBuilderExport.js'));
try {
  let composition = editing.createTemplate('Pop song');
  const track = composition.tracks[0]; const source = composition.sections[0]; const linked = composition.sections[2];
  const changed = editing.editMeasure(composition, linked.id, track.id, 0, (measure) => ({ ...measure, events: [{ id: 'tie-a', kind: 'note', string: 1, fret: 3, startBeat: 0, durationBeats: 2, tie: true }, { id: 'tie-b', kind: 'note', string: 1, fret: 3, startBeat: 2, durationBeats: 2 }] }));
  assert.equal(changed.sections[0].measuresByTrack[track.id][0].events[0].id, 'tie-a');
  assert.deepEqual(changed.sections[0].measuresByTrack, changed.sections[2].measuresByTrack);
  let song = { ...library.createManualSong({ title: 'Exchange QA', artist: 'QA', key: 'C', bpm: 90, timeSignature: '4/4', chords: [] }), composition: changed };
  const timeline = core.buildSongTimeline(song);
  assert.equal(timeline.events[0].duration, 4 * 60 / 90, 'tie joins playback without rewriting score');
  assert.equal(timeline.bars[0].events.length, 2);
  song.composition = { ...changed, swing: 0.3, tracks: [{ ...track, pan: -0.4, volume: 0.7, solo: true, sound: 'warm' }] };
  song.builderRevisions = [{ id: 'revision', name: 'Before chorus', savedAt: new Date().toISOString(), composition: song.composition }];
  const state = library.migrateSongLibraryState({ ...library.emptySongLibraryState(), songs: [song] });
  const reloaded = library.migrateSongLibraryState(JSON.parse(JSON.stringify(state))).songs[0];
  assert.equal(reloaded.composition.swing, 0.3); assert.equal(reloaded.composition.tracks[0].sound, 'warm'); assert.equal(reloaded.builderRevisions[0].composition.swing, 0.3);
  assert.throws(() => exchange.importMidi(new ArrayBuffer(0)), /MIDI/);
  const faster = core.buildSongTimeline({ ...song, composition: { ...song.composition, bpm: 240 } }, undefined, 2);
  assert.equal(faster.bars[0].bpm, 480, 'playback tempo scaling is independent of composition tempo bounds');
  const midi = exchange.exportMidi(song); const imported = exchange.importMidi(await midi.arrayBuffer());
  assert.equal(imported.composition.tracks.length, 1); assert.equal(imported.title, song.title);
  const importedTimeline = core.buildSongTimeline({ ...song, composition: imported.composition });
  assert.deepEqual(importedTimeline.events.flatMap((event) => event.pitches), core.buildSongTimeline(song).events.flatMap((event) => event.pitches));
  const xml = await exchange.exportMusicXml(song).text();
  assert(xml.includes('<harmony>')); assert(xml.includes('<staff-tuning')); assert(xml.includes('<tie type="start"/>'));
  const section = imported.composition.sections[0]; assert(section.measuresByTrack[imported.composition.tracks[0].id].length >= 12);
  const bad = { ...changed, sections: [{ ...source, measuresByTrack: { [track.id]: [{ id: 'bad', events: [{ id: 'bad-note', kind: 'note', string: 1, fret: 26, startBeat: 3, durationBeats: 2 }] }] } }] };
  const issues = editing.checkComposition(bad); assert(issues.some((issue) => /outside/.test(issue.message))); assert(issues.some((issue) => /playable/.test(issue.message)));
  assert(editing.suggestVoicings(track, 'C').length > 0);
  for (const name of editing.TEMPLATES) { const template = editing.createTemplate(name); assert(template.sections.length); assert(template.tracks.length); }
  for (const view of ['tab', 'staff', 'both']) { const pages = notation.notationPageGroups(song, timeline.bars, view, { barsPerLine: 2, diagrams: true }); assert(pages.length > 1); assert(pages.every((page) => page.reduce((sum, block) => sum + block.height, 0) <= 640)); }
  const copied = [{ id: 'copy', events: [{ id: 'copy-note', kind: 'note', string: 6, fret: 0, startBeat: 0, durationBeats: 1, midiPitches: [40] }] }];
  const bass = core.addCompositionTrack(changed, 'bass'); const bassId = bass.tracks[1].id;
  const pasted = editing.pasteMeasures(bass, source.id, bassId, 0, copied, 2, .5).sections[0].measuresByTrack[bassId][0].events[0];
  assert.equal(pasted.midiPitches[0], 42); assert.equal(pasted.startBeat, .5); assert(pasted.string <= 4); assert.equal(core.eventMidiPitches(bass.tracks[1], pasted)[0], 42);
  const split = studio.writeAcrossBars(changed,source.id,track.id,0,{id:"long",kind:"note",string:1,fret:2,startBeat:3,durationBeats:3});
  assert.equal(split.sections[0].measuresByTrack[track.id][0].events.find(event=>event.id==="long").durationBeats,1);
  assert(split.sections[0].measuresByTrack[track.id][1].events.some(event=>event.splitGroup==="long"&&event.durationBeats===2));
  const rewritten=studio.writeAcrossBars(split,source.id,track.id,0,{id:"long",kind:"note",string:1,fret:2,startBeat:3,durationBeats:1},"long");
  assert(!rewritten.sections[0].measuresByTrack[track.id][1].events.some(event=>event.splitGroup==="long"));
  const generated=studio.generatePattern(composition,source.id,track.id,track.id,"fingerpick");
  assert.equal(generated.sections[0].measuresByTrack[track.id][0].events.length,8);
  const portable=studio.readPortableSong(JSON.stringify(studio.portableSong(song)));assert.equal(portable.title,song.title);
  const timed=editing.editMeasure(changed,source.id,track.id,0,measure=>({...measure,tempoChanges:[{beat:2,bpm:180}]}));
  const timedTimeline=core.buildSongTimeline({...song,composition:timed});assert(Math.abs(timedTimeline.bars[0].duration-2)<.001);
  const timedMidi=exchange.importMidi(await exchange.exportMidi({...song,composition:timed}).arrayBuffer());
  assert(timedMidi.composition.sections[0].measuresByTrack[timedMidi.composition.tracks[0].id][0].tempoChanges.some(mark=>mark.beat===2&&mark.bpm===180));
  const band=core.addCompositionTrack(composition,"bass");const bassPattern=studio.generatePattern(band,source.id,track.id,band.tracks[1].id,"bass");
  assert.equal(core.eventMidiPitches(band.tracks[1],bassPattern.sections[0].measuresByTrack[band.tracks[1].id][0].events[0])[0]%12,0,"C chords generate C bass roots even if the guitar voicing starts on E");
  assert.equal(rewritten.sections[0].measuresByTrack[track.id][0].events.find(event=>event.id==="long").tie,false,"shortening an automatic tie group removes the outgoing tie");
  const precise=editing.editMeasure(changed,source.id,track.id,0,measure=>({...measure,events:[{id:"quint",kind:"note",string:1,fret:0,startBeat:.4,durationBeats:.4,tuplet:5}]}));
  const malformed=studio.portableSong(song);malformed.song.builderArrangements=[null];malformed.song.builderPhrases=[null];const safe=studio.readPortableSong(JSON.stringify(malformed));assert.equal(safe.builderArrangements.length,0);assert.equal(safe.builderPhrases.length,0);
  const preciseReload=library.migrateSongLibraryState({...library.emptySongLibraryState(),songs:[{...song,composition:precise}]}).songs[0];
  assert.equal(preciseReload.composition.sections[0].measuresByTrack[track.id][0].events[0].startBeat,.4);
  console.log('PASS: linked edits, ties, templates, voicings, cross-track paste, validation, migration/revisions, MIDI round-trip, pagination.');
} finally { rmSync(output, { recursive: true, force: true }); }
