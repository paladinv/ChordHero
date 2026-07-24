import fs from "node:fs";
import path from "node:path";

const directory = path.join(process.cwd(), "shared/content/v1");
const read = (name) => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
const chords = read("chords.json");
const rightHand = read("right-hand.json");
const songs = read("songs.json");
const settings = read("settings.json");
const fail = (message) => { throw new Error(message); };

for (const document of [chords, rightHand, settings]) {
  if (document.schemaVersion !== 1) fail("Chord, right-hand, and settings documents must use schemaVersion 1");
}
if (songs.schemaVersion !== 2) fail("The songs document must use schemaVersion 2");

const chordIDs = new Set();
for (const entry of chords.chordLibrary) {
  if (!entry.id || chordIDs.has(entry.id)) fail(`Duplicate or missing chord id: ${entry.id}`);
  chordIDs.add(entry.id);
  if (entry.chord.frets.length !== 6 || entry.chord.fingers.length !== 6) fail(`${entry.id} must define six strings`);
  if (entry.chord.frets.some((fret) => !Number.isInteger(fret) || fret < -1)) fail(`${entry.id} has an invalid fret`);
  if (entry.chord.fingers.some((finger) => finger !== null && ![1, 2, 3, 4].includes(finger))) fail(`${entry.id} has an invalid finger`);
  if (entry.chord.barre && (entry.chord.barre.from < 0 || entry.chord.barre.to > 5 || entry.chord.barre.from > entry.chord.barre.to)) fail(`${entry.id} has an invalid barre`);
}
if (chordIDs.size !== 346) fail(`Expected the web app's 346 chord voicings, found ${chordIDs.size}`);
for (const level of chords.levels) for (const id of level.chordIds) if (!chordIDs.has(id)) fail(`Unknown level chord ${id}`);
for (const pack of chords.progressionPacks) for (const id of pack.chordIds) if (!chordIDs.has(id)) fail(`Unknown pack chord ${id}`);
if (chords.levels.length !== 4) fail("Expected four trainer levels");
if (chords.progressionPacks.length !== 4) fail("Expected four built-in progression packs");

const exerciseIDs = new Set(rightHand.exercises.map((exercise) => exercise.id));
if (exerciseIDs.size !== 30) fail(`Expected 30 unique right-hand exercises, found ${exerciseIDs.size}`);
const songIDs = new Set();
const techniques = new Set(["strumming", "fingerpicking", "plectrum"]);
for (const song of songs.songs) {
  if (!song.id || songIDs.has(song.id)) fail(`Duplicate or missing song id: ${song.id}`);
  songIDs.add(song.id);
  if (!song.title || !song.artist || !song.license || !song.sections?.length) fail(`Song ${song.id} is missing required metadata or sections`);
  if (!Array.isArray(song.variations) || song.variations.length < 3) fail(`Song ${song.id} needs at least three variations`);
  const variationIDs = new Set();
  for (const variation of song.variations) {
    if (!variation.id || variationIDs.has(variation.id)) fail(`Duplicate variation in ${song.id}`);
    variationIDs.add(variation.id);
    if (!techniques.has(variation.technique)) fail(`Unsupported technique ${variation.technique} in ${song.id}`);
  }
}
if (songs.songs.length !== 50) fail(`Expected 50 songs, found ${songs.songs.length}`);
if (settings.tunings.length !== 4) fail("Expected four tunings");

console.log("Shared content is valid: 346 chords, 4 levels, 4 packs, 30 exercises, 50 songs, 4 tunings.");
