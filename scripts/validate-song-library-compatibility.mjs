import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const ts = require("typescript");
// Compile in memory so cross-module TypeScript imports match the app bundler.
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
const { emptySongLibraryState, migrateSongLibraryState, prepareSongLibraryForSync, createSongPracticePreset, resolveSongAnnotation, inspectSongLibraryCleanup, applySongLibraryCleanup, recordPracticeOutcome, explainPracticePriority, suggestFamiliarChordAlternatives } = require("../lib/songLibrary.ts");
const { mergeLibraryStates } = require("../lib/songSync.ts");
const { duplicatePairs, duplicateMergeCarryover, mergeDuplicateSongs, inspectBackup, inspectBackupCompatibility, updateSongCare, normalizeLibraryCare, createIntegrityBackup, readIntegrityBackup, mergeRestoredLibrary } = require("../lib/songLibraryCare.ts");
const { chordFunctionLabels, buildSongRecallPrompts, spellChordName, estimateTempoFromTaps, songSecondsAtBookmark, auditSongArrangement } = require("../lib/songLibraryLearning.ts");

const legacySong = {
  id: "traditional:amazing-grace",
  title: "Amazing Grace",
  artist: "Traditional",
  source: "Public domain",
  license: "Public domain",
  difficulty: "beginner",
  bpm: 80,
  key: "G",
  timeSignature: "3/4",
  tags: ["traditional"],
  sections: [{ id: "verse", title: "Verse", blocks: [] }],
  variations: [{ id: "open", name: "Open", technique: "strumming", key: "G", timeSignature: "3/4", bpm: 80, tuningId: "standard", capo: 0, pattern: "D - D U", feel: "Steady" }],
};
const legacyCollection = {
  id: "library:practice",
  name: "Practice",
  description: "",
  songIds: [legacySong.id],
  createdAt: "2026-08-09T17:00:00.000Z",
  updatedAt: "2026-08-09T17:00:00.000Z",
};

for (const version of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
  const migrated = migrateSongLibraryState({
    version,
    songs: [legacySong],
    collections: [legacyCollection],
    recentSongIds: Array.from({ length: 20 }, (_, index) => `song-${index}`),
  });
  assert.equal(migrated.version, 11, `v${version} input upgrades to the current version`);
  assert.equal(migrated.songs[0]?.id, legacySong.id, `v${version} preserves songs`);
  assert.equal(migrated.collections[0]?.songIds[0], legacySong.id, `v${version} preserves collection membership`);
  assert.equal(migrated.recentSongIds.length, 12, `v${version} applies the current recent-song bound`);

  const reloaded = migrateSongLibraryState(JSON.parse(JSON.stringify(migrated)));
  assert.equal(JSON.stringify(reloaded.songs), JSON.stringify(migrated.songs), `v${version} songs survive serialization and reload`);
  assert.equal(JSON.stringify(reloaded.collections), JSON.stringify(migrated.collections), `v${version} collections survive serialization and reload`);
}

for (const invalid of [null, {}, { schemaVersion: 7, songs: [legacySong], collections: [] }, { version: 12, songs: [legacySong], collections: [] }, { version: 8, songs: {}, collections: [] }]) {
  const recovered = migrateSongLibraryState(invalid);
  const empty = emptySongLibraryState();
  assert.equal(recovered.version, 11, "invalid input recovers to current empty state");
  assert.deepEqual(recovered.songs, empty.songs);
  assert.deepEqual(recovered.collections, empty.collections);
}

console.log("Song Library production migration is valid for versions v1-v11.");

assert.deepEqual(chordFunctionLabels("Am", "C"), { nashville: "6m", roman: "vi", inKey: true, explanation: "The root fits the major scale for C." });
assert.deepEqual(chordFunctionLabels("D/F#", "G"), { nashville: "5/7", roman: "V/VII", inKey: true, explanation: "The root fits the major scale for G." });
assert.deepEqual(chordFunctionLabels("F#dim7", "G"), { nashville: "7°7", roman: "vii°7", inKey: true, explanation: "The root fits the major scale for G." });
assert.equal(chordFunctionLabels("F#", "C").inKey, false);
assert.equal(spellChordName("C#/F#", "flats", "C"), "Db/Gb");
assert.equal(spellChordName("Bb/Eb", "sharps", "C"), "A#/D#");
assert.equal(estimateTempoFromTaps([0, 0.5, 1, 1.5]), 120);
assert.equal(estimateTempoFromTaps([0, 0.5]), undefined);
const recallSong = { ...legacySong, key: "C", sections: [{ id: "verse", title: "Verse", blocks: [{ type: "lyrics", lines: ["First line", "Second line"] }, { type: "chords", chords: ["C", "G", "Am", "F"] }] }] };
assert.equal(buildSongRecallPrompts(recallSong, "verse", "lyrics").length, 2);
assert.equal(buildSongRecallPrompts(recallSong, "verse", "chords")[2].answer, "Am");
const extendedMigration = migrateSongLibraryState({ ...emptySongLibraryState(), preferences: { playabilityProfile: { maxFretSpan: 99, maxFret: -2, avoidBarre: true, preferredMode: "barre" }, chordSpelling: "flats", voiceCommandsEnabled: true, previewMuted: false, songDisplays: { s: { chords: false, lyrics: true, tab: false } } }, sectionBookmarks: [{ id: "beat", songId: "s", sectionId: "v", label: "Beat marker", marker: { measure: 2, beat: 999 } }], backingTracks: [{ id: "stem", songId: "s", name: "Bass", instrument: "bass", mimeType: "audio/mpeg", sizeBytes: 1024, offsetMs: -500, alignmentBpm: 120, alignmentBookmarkId: "beat", rightsConfirmedAt: "2026-10-20T00:00:00.000Z", createdAt: "2026-10-20T00:00:00.000Z" }, { id: "too-large", songId: "s", name: "Oversized", instrument: "other", mimeType: "audio/mpeg", sizeBytes: 50_000_001, offsetMs: 0, rightsConfirmedAt: "", createdAt: "" }] });
assert.deepEqual(extendedMigration.preferences.playabilityProfile, { maxFretSpan: 6, maxFret: 1, avoidBarre: true, preferredMode: "barre" });
assert.equal(extendedMigration.sectionBookmarks[0].marker.beat, 64);
assert.equal(extendedMigration.backingTracks.length, 1, "audio metadata over the local per-file limit is rejected");
assert.equal(extendedMigration.backingTracks[0].offsetMs, -500, "signed audio offset survives migration");
assert.equal(extendedMigration.preferences.songDisplays.s.chords, false);
assert.equal(extendedMigration.preferences.voiceCommandsEnabled, true);
assert.equal(migrateSongLibraryState(JSON.parse(JSON.stringify(extendedMigration))).backingTracks[0].id, "stem", "backing track metadata survives persistence reload");
const preset = createSongPracticePreset({ name: "Slow verse", songId: legacySong.id, variationId: "open", tempoBpm: 0, transpose: 30, sectionId: "verse", metronome: true, largePrint: false, simplifyMode: false, display: { chords: true, lyrics: true, tab: true } }, "2026-10-21T00:00:00.000Z");
assert.equal(preset.tempoBpm, 90, "practice presets clamp invalid tempo to a safe default");
assert.equal(preset.transpose, 24, "practice presets clamp transpose range");
const presetState = migrateSongLibraryState({ ...emptySongLibraryState(), practicePresets: [preset], annotations: [{ id: "uncertain", songId: legacySong.id, sectionId: "verse", kind: "uncertain-chord", marker: { measure: 2, beat: 2.3333 }, body: "Check this voicing", createdAt: "2026-10-20T00:00:00.000Z", updatedAt: "2026-10-20T00:00:00.000Z" }] });
assert.equal(presetState.practicePresets[0].id, preset.id, "practice presets survive schema-v10 migration");
assert.equal(presetState.annotations[0].marker.beat, 2.333, "annotation beat markers are bounded to millibeat precision");
assert.equal(presetState.annotations[0].kind, "uncertain-chord");
assert.equal(resolveSongAnnotation(presetState, "uncertain", true, "2026-10-21T00:00:00.000Z").annotations[0].resolvedAt, "2026-10-21T00:00:00.000Z");
const outcomeState = recordPracticeOutcome({
  ...emptySongLibraryState(),
  practiceProgress: [{
    songId: recallSong.id,
    sectionsCompleted: [],
    practiceCount: 2,
    sectionMastery: { verse: 35 },
    sectionReviews: { verse: { sectionId: "verse", dueAt: "2026-10-20T00:00:00.000Z", intervalDays: 1, repetitions: 1, ease: 2.5, lapses: 0 } },
  }],
}, recallSong.id, "needs-work", "2026-10-21T00:00:00.000Z");
assert.equal(outcomeState.practiceProgress[0].outcomeCounts["needs-work"], 1);
assert.equal(outcomeState.practiceProgress[0].lastOutcome, "needs-work");
assert.equal(outcomeState.practiceProgress[0].practiceCount, 3);
const priorities = explainPracticePriority(outcomeState.practiceProgress, [recallSong], Date.parse("2026-10-21T00:00:00.000Z"));
assert.ok(priorities[0].reasons.some((reason) => reason.includes("Weakest tracked section")));
assert.ok(priorities[0].reasons.some((reason) => reason.includes("review")));
assert.ok(priorities[0].reasons.some((reason) => reason.includes("needing work")));
assert.deepEqual(suggestFamiliarChordAlternatives(recallSong, ["C"]), [{ original: "F", suggestion: "C" }]);
const preferenceMigration = migrateSongLibraryState({ ...emptySongLibraryState(), version: 10, preferences: { familiarChords: ["C", "C", " G "], dashboardCards: ["health", "resume", "health"], onboarding: { instrument: "ukulele", goal: "learn-songs", completedAt: "2026-10-21T00:00:00.000Z" } } });
assert.equal(preferenceMigration.version, 11);
assert.deepEqual(preferenceMigration.preferences.familiarChords, ["C", "G"]);
assert.deepEqual(preferenceMigration.preferences.dashboardCards, ["health", "resume"]);
assert.equal(preferenceMigration.preferences.onboarding.instrument, "ukulele");
assert.deepEqual(migrateSongLibraryState(JSON.parse(JSON.stringify(outcomeState))).practiceProgress[0].outcomeCounts, outcomeState.practiceProgress[0].outcomeCounts);
const syncMerged = mergeLibraryStates(
  { ...emptySongLibraryState(), preferences: { ...emptySongLibraryState().preferences, familiarChords: ["C"], onboarding: preferenceMigration.preferences.onboarding }, practiceProgress: outcomeState.practiceProgress, practicePresets: [preset] },
  { ...emptySongLibraryState(), preferences: { ...emptySongLibraryState().preferences, familiarChords: ["G"], dashboardCards: ["health"] }, practiceProgress: outcomeState.practiceProgress, practicePresets: [] },
);
assert.deepEqual(syncMerged.preferences.familiarChords, ["C", "G"]);
assert.deepEqual(syncMerged.preferences.dashboardCards, ["health"]);
assert.equal(syncMerged.preferences.onboarding.instrument, "ukulele");
assert.equal(syncMerged.practicePresets[0].id, preset.id);
const cleanupState = { ...emptySongLibraryState(), songs: [legacySong], drafts: [{ id: "old", title: "Old idea", idea: "", chordIdeas: [], createdAt: "2020-01-01T00:00:00.000Z", updatedAt: "2020-01-01T00:00:00.000Z" }], annotations: [{ id: "orphan", songId: "missing", sectionId: "gone", body: "orphan", createdAt: "", updatedAt: "" }], videoReferences: [{ id: "broken-video", songId: "missing", title: "Broken ref", source: "source-link", url: "https://example.test", createdAt: "" }] };
const cleanupFindings = inspectSongLibraryCleanup(cleanupState, [legacySong], Date.parse("2026-10-21T00:00:00.000Z"));
assert.equal(cleanupFindings.length, 3, "cleanup preview reports stale drafts and broken metadata references");
const cleaned = applySongLibraryCleanup(cleanupState, cleanupFindings.map((item) => item.id), [legacySong], "2026-10-21T00:00:00.000Z");
assert.equal(cleaned.drafts[0].archivedAt, "2026-10-21T00:00:00.000Z", "cleanup archives stale drafts instead of deleting them");
assert.equal(cleaned.annotations.length, 0);
assert.equal(cleaned.videoReferences.length, 0);
assert.equal(cleanupState.drafts.length, 1, "cleanup returns an immutable copy and leaves original data intact");
assert.deepEqual(auditSongArrangement(recallSong), []);
const malformedSong = { ...recallSong, sections: [{ id: "x", title: "Verse", blocks: [{ type: "chords", chords: ["H#"] }] }] };
assert.ok(auditSongArrangement(malformedSong).some((issue) => issue.includes("chord symbol")));
const mappedSong = { ...legacySong, composition: { version: 1, key: "G", bpm: 80, timeSignature: "4/4", subdivision: 4, tracks: [{ id: "g", name: "Guitar", instrument: "guitar", tuning: [40, 45, 50, 55, 59, 64], tuningLabel: "Standard", capo: 0, muted: false, volume: 1, pan: 0, solo: false, sound: "clean", reverb: 0 }], sections: [{ id: "verse", title: "Verse", kind: "verse", repeats: 1, measuresByTrack: { g: [{ id: "m1", events: [] }, { id: "m2", events: [] }] } }] } };
assert.equal(songSecondsAtBookmark(mappedSong, { id: "bm", songId: mappedSong.id, sectionId: "verse", label: "b2", marker: { measure: 2, beat: 3 }, createdAt: "", updatedAt: "" }, 120), 3);
console.log("Learning tools: spelling, in-key explanations, tap tempo, measure alignment, arrangement audit, display/privacy preferences, and backing-track metadata passed.");

const duplicate = { ...legacySong, id: "copy", variations: legacySong.variations.map(v => ({ ...v, id: "copy-open" })) };
let careState = { ...emptySongLibraryState(), songs: [legacySong, duplicate], practiceQueues: [{id:"q",name:"Q",songIds:[legacySong.id,"copy"],createdAt:"",updatedAt:""}], recordings: [{id:"audio",songId:"copy",durationMs:1000,mimeType:"audio/webm",createdAt:""}], practiceProgress: [{songId:legacySong.id,practiceCount:2,sectionsCompleted:[]},{songId:"copy",practiceCount:3,sectionsCompleted:["verse"]}] };
assert.equal(duplicatePairs(careState.songs).length,1);
const merged = mergeDuplicateSongs(careState, legacySong, duplicate);
assert.equal(merged.songs.length,1);
assert.equal(merged.recordings[0].id,"audio");
assert.equal(merged.recordings[0].songId,legacySong.id);
assert.deepEqual(merged.practiceQueues[0].songIds,[legacySong.id]);
assert.equal(merged.practiceProgress[0].practiceCount,5);
const carryover = duplicateMergeCarryover(legacySong,duplicate,careState);
assert.equal(carryover.records.find(([label])=>label==="Recordings")?.[1],1);
assert.equal(carryover.records.find(([label])=>label==="Queue memberships")?.[1],1);
careState = updateSongCare(careState,legacySong.id,{privateNote:"private",sharedNote:"band",locked:true},"Approved");
assert.throws(()=>mergeDuplicateSongs(careState,legacySong,duplicate),/Unlock/);
assert.equal(prepareSongLibraryForSync(careState).libraryCare.songs[0].privateNote,"");
assert.equal(prepareSongLibraryForSync(careState).libraryCare.songs[0].sharedNote,"band");
assert.equal(migrateSongLibraryState(JSON.parse(JSON.stringify(careState))).libraryCare.songs[0].privateNote,"private");
assert.equal(normalizeLibraryCare({attendance:Array.from({length:600},()=>({name:"a"}))}).attendance.length,500);
assert.ok(inspectBackup({version:99,songs:[],collections:[]}).length);
assert.ok(inspectBackup({version:8,songs:[legacySong,legacySong],collections:[]}).includes("Duplicate song IDs."));
assert.deepEqual(inspectBackup(merged),[]);
const compatibility = inspectBackupCompatibility({ ...emptySongLibraryState(), version: 8, futureField: true, preferences: { futurePreference: true }, backingTracks: [{ id: "stem" }], videoReferences: [{ source: "local-reference" }] });
assert.equal(compatibility.sourceVersion, 8);
assert.deepEqual(compatibility.unsupportedFields, ["Library: futureField", "Preferences: futurePreference"]);
assert.equal(compatibility.audioMetadataCount, 1);
assert.equal(compatibility.localVideoReferenceCount, 1);
const careMigration=migrateSongLibraryState({...emptySongLibraryState(),libraryCare:{events:[{id:"gig",kind:"gig",date:"2026-10-21T19:00:00.000Z",title:"Show"}],healthAcknowledgements:[{songId:legacySong.id,issue:"No lyrics",note:"Instrumental",acknowledgedAt:"2026-10-20T12:00:00.000Z"}]}});
assert.equal(careMigration.libraryCare.events[0].title,"Show");
assert.equal(careMigration.libraryCare.healthAcknowledgements[0].note,"Instrumental");
const checksummed=JSON.parse(await createIntegrityBackup(careMigration));
assert.equal((await readIntegrityBackup(checksummed)).integrity,"verified");
checksummed.payload.songs.push(legacySong);
await assert.rejects(()=>readIntegrityBackup(checksummed),/checksum mismatch/i);
const localSong={...legacySong,title:"Local edit"};
const restoreCurrent={...emptySongLibraryState(),songs:[localSong]};
const restoreBackup={...emptySongLibraryState(),songs:[legacySong,{...duplicate,title:"A different song"}]};
const restored=mergeRestoredLibrary(restoreCurrent,restoreBackup);
assert.equal(restored.songs.filter(song=>song.id===legacySong.id).length,1,"same-ID restore conflicts must not duplicate records");
assert.equal(restored.songs.find(song=>song.id===legacySong.id).title,"Local edit","current song wins same-ID conflicts");
assert.equal(restored.songs.some(song=>song.id==="copy"),true,"non-conflicting backup songs are restored");
console.log("Library maintenance: merge references, locks, privacy, backup integrity, and persistence passed.");
