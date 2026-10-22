import { execFileSync } from "node:child_process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const groupScripts = {
  "web:content": "test:web:content",
  "web:harmony": "test:web:harmony",
  "web:guitar3d:math": "test:web:guitar3d:math",
  "web:guitar3d:assets": "test:web:guitar3d:assets",
  "web:library-search": "test:web:library-search",
  "web:chord-library": "test:web:chord-library",
  "web:chart-arrangement": "test:web:chart-arrangement",
  "web:chord-chart-pitch": "test:web:chord-chart-pitch",
  "web:song-library": "test:web:song-library",
  "web:song-builder": "test:web:song-builder",
  "web:right-hand-learning": "test:web:right-hand-learning",
  "web:right-hand-audio": "test:web:right-hand-audio",
  "web:trainer-adaptive": "test:web:trainer-adaptive",
  "web:localization": "test:web:localization",
  "web:types": "test:web:types",
  "web:build-performance": "test:web:build-performance",
  "web:runner": "test:web:runner",
  "android:unit": "test:android:unit",
  "android:instrumented": "test:android:instrumented",
  "ios:unit": "test:ios:unit",
  "ios:ui": "test:ios:ui",
};

export const allGroups = Object.keys(groupScripts);

const groupResources = {
  "web:types": "web-build",
  "web:build-performance": "web-build",
  "android:unit": "android",
  "android:instrumented": "android",
  "ios:unit": "ios",
  "ios:ui": "ios",
};

const docsOnly = /^(docs\/|README(?:\..+)?$|AUDIO_SOURCES\.md$|LICENSE$|progress\.md$|android\/README\.md$|public\/audio\/README\.md$)/i;

function add(groups, ...names) {
  for (const name of names) groups.add(name);
}

export function selectGroupsForPaths(inputPaths) {
  const paths = inputPaths.map((value) => value.replaceAll("\\", "/").replace(/^\.\//, ""));
  if (!paths.length) return [];

  const selected = new Set();
  let unknown = false;

  for (const file of paths) {
    if (docsOnly.test(file)) continue;
    if (["package.json", "package-lock.json", "tsconfig.json", "next.config.js"].includes(file) || file.startsWith(".github/")) {
      return [...allGroups];
    }

    let matched = false;
    const match = (...names) => { matched = true; add(selected, ...names); };

    if (file.startsWith("shared/content/")) {
      match("web:content", "web:build-performance", "android:instrumented", "ios:unit");
      if (file.endsWith("/chords.json")) match("web:library-search");
    }
    if (file === "scripts/validate-shared-content.mjs" || file === "scripts/validate-harmonic-notes.mjs" || file === "scripts/export-shared-content.mjs") match("web:content");
    if (file === "lib/harmony.ts" || file === "scripts/validate-harmony.mjs") match("web:harmony");
    if (file === "lib/guitarTechnique3d.ts" || file === "scripts/validate-guitar-technique3d.mjs") match("web:guitar3d:math");
    if (file === "scripts/validate-guitar-technique3d-assets.mjs" || file.startsWith("components/guitar3d/") || file === "components/GuitarTechnique3D.tsx" || file.startsWith("public/models/guitar-technique/")) match("web:guitar3d:assets");
    if (file === "lib/librarySearchSafety.ts" || file === "scripts/validate-library-search-safety.mjs" || file === "tests/web/library-search.test.mjs") match("web:library-search");
    if (["lib/chordLab.ts", "lib/chordLibraryWorkspace.ts", "scripts/validate-chord-library-workspace.mjs"].includes(file)) match("web:chord-library");
    if (file === "lib/chordChartArrangement.ts" || file === "tests/web/chord-chart-arrangement.test.mjs") match("web:chart-arrangement");
    if (file === "lib/chordChartPitch.ts" || file === "tests/web/chord-chart-pitch.test.mjs") match("web:chord-chart-pitch");
    if (file === "lib/songLibrary.ts" || file.startsWith("app/song-library/") || file.startsWith("components/SongLibrary") || file === "scripts/validate-song-library-compatibility.mjs" || file === "tests/web/song-library.test.mjs") match("web:song-library");
    if (/^lib\/songBuilder.*\.ts$/.test(file) || /^components\/SongBuilder.*\.tsx$/.test(file) || file.startsWith("app/song-builder/") || file === "scripts/validate-song-builder.mjs" || file === "lib/songLibrary.ts") match("web:song-builder");
    if (/^lib\/rightHand(Learning|PracticeRefinement|SessionContinuity|Courses|Teacher|Trends|ParticipantValidation)\.[^/]+$/.test(file) || file === "lib/practicePlatformNormalization.ts" || file === "lib/useRightHandLearningPreferences.ts" || /^components\/RightHand(LearningJourney|LocalTools|SetupControls|PracticeHeader|TransferCheck|RoutineBuilder|SessionRecap|Courses|Trends)\.tsx$/.test(file) || file === "scripts/validate-right-hand-learning.mjs" || file === "scripts/validate-right-hand-followups.mjs") match("web:right-hand-learning");
    if (/^lib\/rightHandAudio(Evidence|Evaluation|Isolation)\.[^/]+$/.test(file) || file === "lib/rightHandTimingReview.ts" || file === "lib/songRecordingAnalysis.ts" || file === "lib/rightHandTakeLibrary.ts" || /^components\/RightHand(Recording.*|AudioEvaluation|StorageManager)\.tsx$/.test(file) || file === "scripts/validate-right-hand-audio-evidence.mjs" || file === "scripts/validate-right-hand-review-controls.mjs") match("web:right-hand-audio");
    if (file === "app/right-hand/page.tsx" || file === "lib/practicePlatform.ts" || file === "lib/rightHandPracticeRuntime.ts" || file === "shared/content/v1/right-hand.json") match("web:right-hand-learning", "web:right-hand-audio");
    if (file === "scripts/localization.mjs" || file === "lib/localization.tsx" || /^lib\/(featureCopy|pageCopy|rightHandCopy|surfaceCopy|trainerCopy|trainerUiCopy|uiCopy|uiCopyExtra)\.ts$/.test(file) || file.startsWith("components/Localized")) match("web:localization");
    if (file === "lib/trainerAdaptive.ts") match("web:trainer-adaptive", "web:types");
    if (file.startsWith("app/") || file.startsWith("components/") || file.startsWith("lib/")) match("web:types");
    if (file.startsWith("tests/test-groups.test.mjs")) match("web:runner");
    if (file.startsWith("tests/web/")) {
      if (file.includes("trainer-adaptive")) match("web:trainer-adaptive");
      else if (file.includes("library-search")) match("web:library-search");
      else if (file.includes("song-library")) match("web:song-library");
      else unknown = true;
    }
    if (file === "app/right-hand/page.tsx" || file === "components/RightHandRecordingCoach.tsx" || file === "lib/practicePlatform.ts" || file === "public/sw.js" || file === "scripts/check-performance-budget.mjs") match("web:build-performance");
    if (file.endsWith(".css") || file === "public/sw.js") match("web:build-performance");

    if (file.startsWith("android/")) {
      if (file.startsWith("android/app/src/test/")) match("android:unit");
      else if (file.startsWith("android/app/src/androidTest/")) match("android:instrumented");
      else if (file === "android/app/src/main/java/com/codingmonkey/chordhero/data/ContentRepository.kt") match("android:unit", "android:instrumented");
      else if (file.startsWith("android/app/src/main/java/") && /\/(domain|data|services)\//.test(file)) match("android:unit");
      else if (file.startsWith("android/app/src/main/") || file === "android/app/build.gradle.kts" || file === "android/build.gradle.kts" || file === "android/settings.gradle.kts" || file.startsWith("android/gradle/")) match("android:unit", "android:instrumented");
      else if (file === "android/gradlew" || file === "android/gradlew.bat") match("android:unit", "android:instrumented");
    }

    if (file.startsWith("ios/ChordHero/Tests/")) match("ios:unit");
    else if (file.startsWith("ios/ChordHero/UITests/")) match("ios:ui");
    else if (/^ios\/ChordHero\/Sources\/(Domain|Data|Services)\//.test(file)) match("ios:unit");
    else if (/^ios\/ChordHero\/Sources\/(App|Features|DesignSystem)\//.test(file)) match("ios:unit", "ios:ui");
    else if (file.startsWith("ios/ChordHero/Resources/") || file === "ios/ChordHero/project.yml" || file.startsWith("ios/ChordHero/ChordHero.xcodeproj/")) match("ios:unit", "ios:ui");

    if (file.startsWith("scripts/") && !matched && !file.startsWith("scripts/test-groups")) unknown = true;
    if (!matched) unknown = true;
  }

  return unknown ? [...allGroups] : allGroups.filter((group) => selected.has(group));
}

function collectChangedPaths(base) {
  const changed = execFileSync("git", ["diff", "--no-renames", "--name-only", "-z", base], { cwd: root, encoding: "utf8" })
    .split("\0").filter(Boolean);
  const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8" })
    .split("\0").filter(Boolean);
  return [...new Set([...changed, ...untracked])];
}

function parseOptions(args) {
  const options = { base: "HEAD", groups: [], list: false, concurrency: Number(process.env.TEST_CONCURRENCY) || 4 };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--list") options.list = true;
    else if (argument === "--base") options.base = args[++index];
    else if (argument.startsWith("--base=")) options.base = argument.slice("--base=".length);
    else if (argument === "--groups") options.groups = (args[++index] ?? "").split(",").filter(Boolean);
    else if (argument.startsWith("--groups=")) options.groups = argument.slice("--groups=".length).split(",").filter(Boolean);
    else if (argument === "--concurrency") options.concurrency = Number(args[++index]);
    else if (argument.startsWith("--concurrency=")) options.concurrency = Number(argument.slice("--concurrency=".length));
    else if (!argument.startsWith("--")) options.groups.push(...argument.split(",").filter(Boolean));
  }
  options.concurrency = Number.isFinite(options.concurrency) ? Math.max(1, Math.floor(options.concurrency)) : 4;
  return options;
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function runScript(script) {
  return new Promise((resolve) => {
    const child = spawn(npmCommand(), ["run", script], { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
    child.once("error", (error) => resolve({ code: 1, error }));
    child.once("close", (code) => resolve({ code: code ?? 1 }));
  });
}

async function runSelected(groups, concurrency) {
  const pending = [...groups];
  const failures = [];
  const activeResources = new Set();
  const workers = Array.from({ length: Math.min(concurrency, pending.length) }, async () => {
    while (pending.length) {
      const index = pending.findIndex((group) => !groupResources[group] || !activeResources.has(groupResources[group]));
      if (index < 0) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        continue;
      }
      const [group] = pending.splice(index, 1);
      const resource = groupResources[group];
      if (resource) activeResources.add(resource);
      console.log(`\n=== ${group} ===`);
      const result = await runScript(groupScripts[group]);
      if (resource) activeResources.delete(resource);
      if (result.code !== 0) failures.push({ group, result });
    }
  });
  await Promise.all(workers);

  if (failures.length) {
    for (const { group, result } of failures) {
      console.error(`FAIL ${group}; rerun with: npm run ${groupScripts[group]}`);
      if (result.error) console.error(result.error.message);
    }
    process.exitCode = 1;
  } else {
    console.log(`\nPASS ${groups.length} selected test group(s).`);
  }
}

async function main() {
  const [mode = "changed", ...args] = process.argv.slice(2);
  const options = parseOptions(args);
  let selected;

  if (mode === "all") selected = [...allGroups];
  else if (mode === "web") selected = allGroups.filter((group) => group.startsWith("web:"));
  else if (mode === "groups") selected = options.groups.length || !options.list ? options.groups : [...allGroups];
  else if (mode === "changed") {
    let paths;
    try {
      paths = collectChangedPaths(options.base);
    } catch (error) {
      console.warn(`Could not classify changes against ${options.base}; selecting all test groups. ${error.message}`);
      selected = [...allGroups];
    }
    if (!selected) {
      selected = selectGroupsForPaths(paths);
      if (paths.length && selected.length === allGroups.length) console.warn("The change set requires the full suite; selecting all test groups.");
      if (!paths.length) console.log("No changed files found; no test groups selected.");
    }
  } else {
    console.error("Usage: test-groups.mjs changed [--base REF] [--list] | all [--list] | web [--list] | groups --groups NAME,NAME [--list]");
    process.exitCode = 2;
    return;
  }

  const unknownGroups = selected.filter((group) => !groupScripts[group]);
  if (unknownGroups.length) {
    console.error(`Unknown test group(s): ${unknownGroups.join(", ")}`);
    console.error(`Available groups: ${allGroups.join(", ")}`);
    process.exitCode = 2;
    return;
  }
  console.log(`Selected groups (${selected.length}): ${selected.join(", ") || "none"}`);
  if (options.list || !selected.length) return;
  await runSelected(selected, options.concurrency);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
