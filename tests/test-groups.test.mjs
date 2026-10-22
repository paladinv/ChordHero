import test from "node:test";
import assert from "node:assert/strict";
import { allGroups, selectGroupsForPaths } from "../scripts/test-groups.mjs";

test("shared content runs web validation and both native content loaders", () => {
  assert.deepEqual(
    selectGroupsForPaths(["shared/content/v1/settings.json"]),
    ["web:content", "web:build-performance", "android:instrumented", "ios:unit"],
  );
  assert.deepEqual(
    selectGroupsForPaths(["shared/content/v1/chords.json"]),
    ["web:content", "web:library-search", "web:build-performance", "android:instrumented", "ios:unit"],
  );
});

test("domain source files select focused web checks", () => {
  assert.deepEqual(selectGroupsForPaths(["lib/harmony.ts"]), ["web:harmony", "web:types"]);
  assert.deepEqual(selectGroupsForPaths(["lib/librarySearchSafety.ts"]), ["web:library-search", "web:types"]);
  assert.deepEqual(selectGroupsForPaths(["lib/chordLab.ts"]), ["web:chord-library", "web:types"]);
});

test("Android unit, feature, and acceptance test paths select their matching groups", () => {
  assert.deepEqual(selectGroupsForPaths(["android/app/src/test/java/com/example/RulesTest.kt"]), ["android:unit"]);
  assert.deepEqual(selectGroupsForPaths(["android/app/src/main/java/com/example/features/LibraryScreen.kt"]), ["android:unit", "android:instrumented"]);
  assert.deepEqual(
    selectGroupsForPaths(["android/app/src/main/java/com/codingmonkey/chordhero/data/ContentRepository.kt"]),
    ["android:unit", "android:instrumented"],
  );
  assert.deepEqual(selectGroupsForPaths(["android/app/src/androidTest/java/com/example/ContentTest.kt"]), ["android:instrumented"]);
});

test("iOS unit and UI test paths remain separate", () => {
  assert.deepEqual(selectGroupsForPaths(["ios/ChordHero/Tests/ContentAndRulesTests.swift"]), ["ios:unit"]);
  assert.deepEqual(selectGroupsForPaths(["ios/ChordHero/UITests/ChordHeroUITests.swift"]), ["ios:ui"]);
});

test("deleted paths are classified by path and documentation-only edits select no tests", () => {
  assert.deepEqual(selectGroupsForPaths(["lib/harmony.ts"]), ["web:harmony", "web:types"]);
  assert.deepEqual(selectGroupsForPaths(["docs/mobile-use-cases.md", "README.md"]), []);
});

test("unrecognized paths safely select the complete suite", () => {
  assert.deepEqual(selectGroupsForPaths(["scripts/new-validator.mjs"]), allGroups);
  assert.deepEqual(selectGroupsForPaths(["some/new/source.file"]), allGroups);
});

test("tracked and untracked paths can be passed through the same selector", () => {
  assert.deepEqual(selectGroupsForPaths(["tests/web/library-search.test.mjs"]), ["web:library-search"]);
  assert.deepEqual(selectGroupsForPaths(["tests/web/song-library.test.mjs"]), ["web:song-library"]);
  assert.deepEqual(selectGroupsForPaths(["tests/web/trainer-adaptive.test.mjs"]), ["web:trainer-adaptive"]);
});

test("Trainer adaptive pacing changes select rule and type checks", () => {
  assert.deepEqual(selectGroupsForPaths(["lib/trainerAdaptive.ts"]), ["web:trainer-adaptive", "web:types"]);
});


test("Song Builder edits select composition regression and type checks", () => {
  assert.deepEqual(selectGroupsForPaths(["lib/songBuilderExchange.ts"]), ["web:song-builder", "web:types"]);
  assert.deepEqual(selectGroupsForPaths(["scripts/validate-song-builder.mjs"]), ["web:song-builder"]);
});

test("right-hand learning and audio changes select focused validators", () => {
  for (const file of ["lib/rightHandLearning.ts", "lib/rightHandPracticeRefinement.ts", "lib/rightHandSessionContinuity.ts", "lib/useRightHandLearningPreferences.ts", "components/RightHandLearningJourney.tsx", "components/RightHandLocalTools.tsx", "components/RightHandTransferCheck.tsx", "components/RightHandRoutineBuilder.tsx", "components/RightHandSessionRecap.tsx"]) {
    assert.deepEqual(selectGroupsForPaths([file]), ["web:right-hand-learning", "web:types"]);
  }
  for (const file of ["lib/rightHandAudioEvidence.ts", "lib/rightHandAudioEvaluation.ts", "lib/rightHandTimingReview.ts", "lib/songRecordingAnalysis.ts", "lib/rightHandTakeLibrary.ts", "components/RightHandRecordingResults.tsx", "components/RightHandAudioEvaluation.tsx"]) {
    assert.deepEqual(selectGroupsForPaths([file]), ["web:right-hand-audio", "web:types"]);
  }
  assert.deepEqual(selectGroupsForPaths(["scripts/validate-right-hand-learning.mjs"]), ["web:right-hand-learning"]);
  assert.deepEqual(selectGroupsForPaths(["scripts/validate-right-hand-audio-evidence.mjs"]), ["web:right-hand-audio"]);
  assert.deepEqual(selectGroupsForPaths(["scripts/validate-right-hand-review-controls.mjs"]), ["web:right-hand-audio"]);
});
