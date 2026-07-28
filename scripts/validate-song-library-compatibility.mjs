import assert from 'node:assert/strict';

// This is the intentionally small wire contract shared by the web local store,
// iOS SwiftData export, and Android Room export. Keep this test dependency-free
// so it can run in CI without a browser, Xcode, or Gradle runtime.
const fixture = {
  schemaVersion: 2,
  songs: [{ id: 'traditional:amazing-grace', title: 'Amazing Grace', artist: 'Traditional', origin: 'public-domain' }],
  collections: [{ id: 'library:practice', name: 'Practice', songIDs: ['traditional:amazing-grace'], orderedSongIDs: ['traditional:amazing-grace'] }],
  progress: [{ songId: 'traditional:amazing-grace', sectionMastery: { verse: 0.75 }, streak: 2 }],
  queues: [{ id: 'queue:default', name: 'Today', songIDs: ['traditional:amazing-grace'] }],
  recordings: [{ id: 'recording:1', songId: 'traditional:amazing-grace', sectionID: 'verse', durationMs: 1200, waveform: [0, 0.5, 1] }],
  sharedAccess: [{ libraryId: 'library:practice', accountId: 'account:owner', role: 'owner' }],
};

const requiredArrays = ['songs', 'collections', 'progress', 'queues', 'recordings', 'sharedAccess'];
assert.equal(fixture.schemaVersion, 2);
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
for (const access of decoded.sharedAccess) assert.ok(['owner', 'editor', 'viewer'].includes(access.role), `invalid permission ${access.role}`);

console.log(`Song Library compatibility contract is valid: schema v${decoded.schemaVersion}, ${decoded.songs.length} song, ${decoded.recordings.length} recording.`);
