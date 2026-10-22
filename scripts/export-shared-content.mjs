import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import { readComponentLiteral } from "./read-component-literal.mjs";

const require = createRequire(import.meta.url);

const root = process.cwd();
const outputDirectory = path.join(root, "shared/content/v1");
const checkOnly = process.argv.includes("--check");
if (!checkOnly) fs.mkdirSync(outputDirectory, { recursive: true });

function loadTypeScriptModule(relativePath) {
  const filename = path.join(root, relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true
    }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, require }, { filename });
  return JSON.parse(JSON.stringify(module.exports));
}

const chords = loadTypeScriptModule("lib/chords.ts");
const rightHand = loadTypeScriptModule("lib/rightHandExercises.ts");
const songs = JSON.parse(fs.readFileSync(path.join(root, "shared/content/v1/songs.json"), "utf8"));
const settingsDocument = JSON.parse(fs.readFileSync(path.join(root, "shared/content/v1/settings.json"), "utf8"));
const settings = {
  schemaVersion: settingsDocument.schemaVersion,
  tunings: readComponentLiteral(root, "components/ChordLibraryExplorer.tsx", "TUNINGS"),
  sampleVoices: readComponentLiteral(root, "components/ChordLibraryExplorer.tsx", "SAMPLE_VOICES"),
  rightHandPatterns: readComponentLiteral(root, "components/ChordLibraryExplorer.tsx", "RIGHT_HAND_PATTERNS")
};
const qualityDefinitions = JSON.parse(fs.readFileSync(path.join(root, "shared/content/v1/chord-qualities.json"), "utf8"));
const chordIdByName = new Map(chords.CHORD_LIBRARY.map((entry) => [entry.chord.name, entry.id]));

const files = {
  "chords.json": {
    schemaVersion: 1,
    qualityDefinitions,
    chordLibrary: chords.CHORD_LIBRARY,
    levels: chords.LEVELS.map((level) => ({
      name: level.name,
      description: level.description,
      chordIds: level.chords.map((chord) => chordIdByName.get(chord.name)).filter(Boolean)
    })),
    progressionPacks: chords.PROGRESSION_PACKS
  },
  "right-hand.json": {
    schemaVersion: 1,
    techniques: rightHand.TECHNIQUE_DETAILS,
    difficulties: rightHand.DIFFICULTY_DETAILS,
    exercises: rightHand.RIGHT_HAND_EXERCISES
  },
  "songs.json": {
    ...songs
  },
  "settings.json": settings
};

for (const [name, value] of Object.entries(files)) {
  const generated = `${JSON.stringify(value, null, 2)}\n`;
  const target = path.join(outputDirectory, name);
  if (checkOnly) {
    const existing = fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, "utf8")) : null;
    if (existing === null || JSON.stringify(existing) !== JSON.stringify(value)) {
      throw new Error(`Shared content export is not deterministic: ${name} differs from its generated form`);
    }
  } else {
    fs.writeFileSync(target, generated);
  }
}

console.log(`${checkOnly ? "Verified" : "Exported"} shared content ${checkOnly ? "deterministically" : `to ${path.relative(root, outputDirectory)}`}`);
