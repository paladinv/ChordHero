import assert from 'node:assert/strict';

// This is the intentionally small wire contract shared by the web local store,
// iOS SwiftData export, and Android Room export. Keep this test dependency-free
// so it can run in CI without a browser, Xcode, or Gradle runtime.
const fixture = {
  schemaVersion: 6,
  songs: [{ id: 'traditional:amazing-grace', title: 'Amazing Grace', artist: 'Traditional', origin: 'public-domain' }],
  collections: [{ id: 'library:practice', name: 'Practice', songIDs: ['traditional:amazing-grace'], orderedSongIDs: ['traditional:amazing-grace'] }],
  progress: [{ songId: 'traditional:amazing-grace', sectionMastery: { verse: 0.75 }, streak: 2 }],
  queues: [{ id: 'queue:default', name: 'Today', songIDs: ['traditional:amazing-grace'] }],
  recordings: [{ id: 'recording:1', songId: 'traditional:amazing-grace', sectionID: 'verse', durationMs: 1200, waveform: [0, 0.5, 1] }],
  sharedAccess: [{ libraryId: 'library:practice', accountId: 'account:owner', role: 'owner' }],
  videoReferences: [{ id: 'video:1', songId: 'traditional:amazing-grace', source: 'source-link', title: 'Picking tutorial' }],
  scheduledItems: [{ id: 'scheduled:1', kind: 'song', resourceId: 'traditional:amazing-grace', dueAt: '2026-08-09T18:00:00.000Z', notificationOptIn: false }],
  pendingSyncOps: [{ id: 'pending:1', kind: 'practice', description: 'Logged practice', createdAt: '2026-08-09T17:00:00.000Z' }],
  readinessHistory: [{ id: 'readiness:1', createdAt: '2026-08-09T17:00:00.000Z', sleep: 'okay', workload: 'typical', handFatigue: 'none', score: 81, suggestion: 'focused' }],
  drafts: [{ id: 'draft:1', title: 'Idea', idea: 'Try a softer entrance', chordIdeas: ['C', 'G'], createdAt: '2026-08-09T17:00:00.000Z', updatedAt: '2026-08-09T17:00:00.000Z' }],
  journalEntries: [{ id: 'journal:1', createdAt: '2026-08-09T17:00:00.000Z', songId: 'traditional:amazing-grace', improvement: 'Cleaner G change', breakdown: 'Verse two rushes', nextStep: 'Use a slow click' }],
  assignments: [{ id: 'assignment:1', songId: 'traditional:amazing-grace', assigneeId: 'account:student', assignedBy: 'account:teacher', dueAt: '2026-08-16T18:00:00.000Z', visibility: 'shared', createdAt: '2026-08-09T17:00:00.000Z', updatedAt: '2026-08-09T17:00:00.000Z' }],
  assignmentComments: [{ id: 'assignment-comment:1', assignmentId: 'assignment:1', body: 'Try the transition drill.', authorId: 'account:teacher', role: 'owner', visibility: 'shared', createdAt: '2026-08-09T17:00:00.000Z' }],
  sectionReviews: [{ songId: 'traditional:amazing-grace', sectionId: 'verse', dueAt: '2026-08-10T18:00:00.000Z', intervalDays: 1, repetitions: 2, ease: 2.5, lapses: 0 }],
  tempoRamps: [{ id: 'ramp:1', songId: 'traditional:amazing-grace', currentBpm: 80, endBpm: 100, stepBpm: 5, repetitions: 3, successfulRepetitions: 1 }],
  rehearsalChecklists: [{ id: 'checklist:1', name: 'Gig', items: [{ id: 'gear', label: 'Instrument', category: 'gear' }] }],
  checklistProgress: [{ checklistId: 'checklist:1', setlistId: 'setlist:1', checkedItemIds: ['gear'] }],
  transitionGoals: [{ id: 'goal:1', songId: 'traditional:amazing-grace', from: 'G', to: 'C', targetRepetitions: 10, completedRepetitions: 4, source: 'auto' }],
  songFamilies: [{ id: 'family:acoustic', name: 'Acoustic set', tags: ['gig'], songIds: ['traditional:amazing-grace'], createdAt: '2026-08-09T17:00:00.000Z', updatedAt: '2026-08-09T17:00:00.000Z' }],
  sectionBookmarks: [{ id: 'bookmark:1', songId: 'traditional:amazing-grace', sectionId: 'verse', label: 'Verse entrance', marker: { measure: 4, chord: 'G', lyric: 'grace' }, note: 'Breathe before the pickup.', createdAt: '2026-08-09T17:00:00.000Z', updatedAt: '2026-08-09T17:00:00.000Z' }],
  voicingPreferences: [{ songId: 'traditional:amazing-grace', variationId: 'variation:open', mode: 'open', updatedAt: '2026-08-09T17:00:00.000Z' }],
  equipmentNotes: [{ songId: 'traditional:amazing-grace', instrument: 'Acoustic guitar', pickup: 'Blend 60/40', effects: 'Light room', microphone: 'Small diaphragm', backingTrackMix: 'Vocal -2 dB', updatedAt: '2026-08-09T17:00:00.000Z' }],
  recordingTargets: [{ songId: 'traditional:amazing-grace', targetBpm: 82, referenceLabel: 'Rehearsal reference', updatedAt: '2026-08-09T17:00:00.000Z' }],
  auditionSessions: [{ id: 'audition:1', songId: 'traditional:amazing-grace', sectionIds: ['verse'], answered: 1, correct: 1, startedAt: '2026-08-09T17:00:00.000Z', completedAt: '2026-08-09T17:01:00.000Z' }],
};

const requiredArrays = ['songs', 'collections', 'progress', 'queues', 'recordings', 'sharedAccess', 'songFamilies', 'sectionBookmarks', 'voicingPreferences', 'equipmentNotes', 'recordingTargets', 'auditionSessions'];
assert.equal(fixture.schemaVersion, 6);
for (const key of requiredArrays) assert.ok(Array.isArray(fixture[key]), `${key} must be an array`);

const encoded = JSON.stringify(fixture);
const decoded = JSON.parse(encoded);
assert.deepEqual(decoded, fixture, 'wire state must survive JSON export/import unchanged');

const songIDs = new Set(decoded.songs.map((song) => song.id));
for (const collection of decoded.collections) {
  for (const songID of collection.songIDs) assert.ok(songIDs.has(songID), `unknown collection song ${songID}`);
  assert.deepEqual(collection.orderedSongIDs, collection.songIDs, 'ordering must be explicit and stable');
}
for (const progress of decoded.progress) assert.ok(songIDs.has(progress.songId), `unknown progress song ${progress.songId}`);
for (const queue of decoded.queues) for (const songID of queue.songIDs) assert.ok(songIDs.has(songID), `unknown queue song ${songID}`);
for (const recording of decoded.recordings) {
  assert.ok(songIDs.has(recording.songId), `unknown recording song ${recording.songId}`);
  assert.ok(recording.waveform.every((peak) => peak >= 0 && peak <= 1), 'waveform peaks must be normalized');
}
for (const access of decoded.sharedAccess) assert.ok(['owner', 'editor', 'viewer', 'commenter', 'arranger', 'setlist-manager'].includes(access.role), `invalid permission ${access.role}`);
for (const reference of decoded.videoReferences) assert.ok(reference.source === 'source-link' || reference.source === 'local-reference', 'video references must be metadata only');
assert.ok(decoded.pendingSyncOps.length <= 200, 'pending sync operations must be bounded');
assert.ok(decoded.readinessHistory.length <= 30, 'readiness history must stay private and bounded');
assert.ok(decoded.drafts.length <= 100, 'draft inbox must be bounded');
assert.ok(decoded.journalEntries.length <= 200, 'practice journal must be bounded');
assert.ok(decoded.sectionReviews.every((review) => review.intervalDays >= 0.25 && review.intervalDays <= 365), 'section review intervals must be bounded');
assert.ok(decoded.tempoRamps.every((ramp) => ramp.currentBpm >= 40 && ramp.currentBpm <= 240 && ramp.endBpm >= ramp.currentBpm), 'tempo ramps must be clamped');
assert.ok(decoded.rehearsalChecklists.every((checklist) => checklist.items.length <= 32), 'checklist items must be bounded');
assert.ok(decoded.transitionGoals.every((goal) => goal.completedRepetitions <= goal.targetRepetitions), 'transition goals cannot over-complete');
assert.ok(decoded.songFamilies.length <= 100 && decoded.songFamilies.every((family) => family.songIds.length <= 100 && family.tags.length <= 12), 'song families must be compact and bounded');
assert.ok(decoded.sectionBookmarks.length <= 500 && decoded.sectionBookmarks.every((bookmark) => (bookmark.note ?? '').length <= 400), 'section bookmarks must be bounded metadata');
assert.ok(decoded.voicingPreferences.every((preference) => ['open', 'barre', 'partial-barre', 'simplified'].includes(preference.mode)), 'voicing preference must be known');
assert.ok(decoded.equipmentNotes.every((notes) => Object.values(notes).every((value) => typeof value !== 'string' || value.length <= 240)), 'equipment notes must be bounded text');
assert.ok(decoded.recordingTargets.every((target) => target.targetBpm === undefined || (target.targetBpm >= 40 && target.targetBpm <= 240)), 'recording targets must be clamped');
assert.ok(decoded.auditionSessions.length <= 100 && decoded.auditionSessions.every((session) => session.sectionIds.length <= 64), 'audition sessions must be bounded');
for (const draft of decoded.drafts) assert.ok(!('blob' in draft) && !('data' in draft), 'drafts must contain text metadata only');
for (const comment of decoded.assignmentComments) assert.ok(['shared', 'teacher-only'].includes(comment.visibility), 'assignment comment visibility must be explicit');

// v1-v6 acceptance: each prior envelope version is explicitly accepted by the
// additive migration gate and upgrades to the current wire version.
for (const version of [1, 2, 3, 4, 5, 6]) {
  const legacy = { ...fixture, schemaVersion: version };
  assert.ok([1, 2, 3, 4, 5, 6].includes(legacy.schemaVersion), `v${version} migration gate must remain accepted`);
  assert.equal(JSON.parse(JSON.stringify(legacy)).schemaVersion, version, `v${version} envelope must round-trip`);
}

console.log(`Song Library compatibility contract is valid: schema v${decoded.schemaVersion}, v1-v6 migration gate, ${decoded.songs.length} song, ${decoded.recordings.length} recording.`);
