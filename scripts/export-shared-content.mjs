import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);

const root = process.cwd();
const outputDirectory = path.join(root, "shared/content/v1");
fs.mkdirSync(outputDirectory, { recursive: true });

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

function readLiteral(relativePath, variableName) {
  const filename = path.join(root, relativePath);
  const sourceText = fs.readFileSync(filename, "utf8");
  const sourceFile = ts.createSourceFile(filename, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer;
  sourceFile.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const declaration of node.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === variableName) initializer = declaration.initializer;
    }
  });
  if (!initializer) throw new Error(`Could not find ${variableName} in ${relativePath}`);
  const printed = ts.createPrinter().printNode(ts.EmitHint.Expression, initializer, sourceFile);
  const output = ts.transpileModule(`module.exports = ${printed};`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports }, { filename });
  return JSON.parse(JSON.stringify(module.exports));
}

const chords = loadTypeScriptModule("lib/chords.ts");
const rightHand = loadTypeScriptModule("lib/rightHandExercises.ts");
const songs = JSON.parse(fs.readFileSync(path.join(root, "shared/content/v1/songs.json"), "utf8"));
const chordIdByName = new Map(chords.CHORD_LIBRARY.map((entry) => [entry.chord.name, entry.id]));

const files = {
  "chords.json": {
    schemaVersion: 1,
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
  "settings.json": {
    schemaVersion: 1,
    tunings: readLiteral("components/ChordLibraryExplorer.tsx", "TUNINGS"),
    sampleVoices: readLiteral("components/ChordLibraryExplorer.tsx", "SAMPLE_VOICES"),
    rightHandPatterns: readLiteral("components/ChordLibraryExplorer.tsx", "RIGHT_HAND_PATTERNS")
  }
};

for (const [name, value] of Object.entries(files)) {
  fs.writeFileSync(path.join(outputDirectory, name), `${JSON.stringify(value, null, 2)}\n`);
}

console.log(`Exported shared content to ${path.relative(root, outputDirectory)}`);
