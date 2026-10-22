import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = (file) => readFileSync(new URL(`../lib/${file}.ts`, import.meta.url), "utf8");
const moduleUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const compile = (code) => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const content = JSON.parse(readFileSync(new URL("../shared/content/v1/right-hand.json", import.meta.url), "utf8"));
const exercises = content.exercises;
const exercise = exercises[0];
let sequence = 0;
const recorded = (overrides = {}) => { sequence += 1; return { id: `event-${sequence}`, area: "rightHand", itemId: exercise.id, title: exercise.title, practisedAt: "2026-10-20T12:00:00.000Z", seconds: 8, recordingId: `take-${sequence}`, reviewAccepted: true, score: 86, scoreReliability: "reliable", timingEvidenceCount: 4, expectedTimingCount: 4, rightHandContext: { tempo: 80, pattern: exercise.pattern, chordProgression: [], scoringMode: "timing", instrumentProfile: "acoustic", retained: true }, ...overrides }; };

const pure = async (file, replacements = []) => {
  let code = source(file);
  for (const [needle, replacement] of replacements) code = code.replace(needle, replacement);
  return import(moduleUrl(compile(code)));
};
const trend = await pure("rightHandTrends", [["import { RIGHT_HAND_EXERCISES, type RightHandTechnique } from \"./rightHandExercises\";", `const RIGHT_HAND_EXERCISES = ${JSON.stringify(exercises)};`]]);
const trendFunction = trend.isValidRightHandTrendEvidence.toString();
const courses = await pure("rightHandCourses", [["import { RIGHT_HAND_EXERCISES, type RightHandExercise } from \"./rightHandExercises\";", `const RIGHT_HAND_EXERCISES = ${JSON.stringify(exercises)};`], ["import { isValidRightHandTrendEvidence } from \"./rightHandTrends\";", `const isValidRightHandTrendEvidence = ${trendFunction};`]]);
const learning = await pure("rightHandLearning", [["import { RIGHT_HAND_EXERCISES, type RightHandExercise } from \"./rightHandExercises\";", `const RIGHT_HAND_EXERCISES = ${JSON.stringify(exercises)};`]]);
const teacher = await pure("rightHandTeacher");
const participants = await pure("rightHandParticipantValidation");
const recordingAnalysisURL = moduleUrl(compile(source("songRecordingAnalysis").replace('"./rightHandAudioEvidence"', JSON.stringify(moduleUrl(compile(source("rightHandAudioEvidence"))))).replace('"./rightHandTimingReview"', JSON.stringify(moduleUrl(compile(source("rightHandTimingReview"))))).replace('"./rightHandRecordingQuality"', JSON.stringify(moduleUrl(compile(source("rightHandRecordingQuality")))))));
const recordingAnalysis = await import(recordingAnalysisURL);
const pitch = await pure("rightHandPitchAnalysis");
const sessionSummarySource = source("rightHandSessionSummary").replace('import type { RecordingAnalysis } from "./songRecordingAnalysis";\n', "").replace('import { summarizeHarmonicListeningClues } from "./songRecordingAnalysis";', `const { summarizeHarmonicListeningClues } = await import(${JSON.stringify(recordingAnalysisURL)});`);
const sessionSummary = await import(moduleUrl(compile(sessionSummarySource)));

const progress = { [exercise.id]: { bestBpm: 80, sessions: 1, cleanSessions: 1, totalSeconds: 60, lastPracticed: "2026-10-20T12:00:00Z" } };
const course = { id: "test-course", title: "Test", description: "", exercises: [exercise.id, exercises[1].id] };
const courseStatus = courses.rightHandCourseProgress(course, progress, [recorded({ itemId: exercise.id })]);
assert.equal(courseStatus.practised, 1, "course counts completed practice separately from evidence");
assert.equal(courseStatus.recorded, 1, "course counts only accepted reliable timing evidence");
assert.equal(courseStatus.nextIndex, 1);
assert.equal(courseStatus.nextKind, "practice");
const limitedCourse = courses.rightHandCourseProgress(course, { [exercise.id]: { ...progress[exercise.id], sessions: 2 }, [exercises[1].id]: { ...progress[exercise.id], sessions: 1 } }, [recorded({ itemId: exercise.id, scoreReliability: "limited" })]);
assert.equal(limitedCourse.recorded, 0, "limited takes do not complete a recorded checkpoint");
assert.equal(limitedCourse.nextKind, "recorded-check");
assert.equal(courses.rightHandCourseProgress(course, progress, [recorded({ scoreReliability: undefined })]).recorded, 0, "recorded milestones require explicit reliable evidence");
const courseStorage = new Map();
globalThis.window = { localStorage: { getItem: (key) => courseStorage.get(key) ?? null, setItem: (key, value) => courseStorage.set(key, value) } };
courses.writeRightHandCourseResume(course.id, 1);
assert.deepEqual(courses.readRightHandCourseResume([course]), { courseId: course.id, nextIndex: 1, updatedAt: JSON.parse(courseStorage.get(courses.RIGHT_HAND_COURSE_RESUME_KEY)).updatedAt });
courseStorage.set(courses.RIGHT_HAND_COURSE_RESUME_KEY, JSON.stringify({ courseId: "unknown", nextIndex: 1, updatedAt: "2026-10-20T00:00:00Z" }));
assert.equal(courses.readRightHandCourseResume([course]), null, "unknown saved courses are ignored");
courseStorage.set(courses.RIGHT_HAND_COURSE_RESUME_KEY, JSON.stringify({ courseId: course.id, nextIndex: 99, updatedAt: "2026-10-20T00:00:00Z" }));
assert.equal(courses.readRightHandCourseResume([course]).nextIndex, course.exercises.length - 1, "saved course index is clamped to the course");
courseStorage.set(courses.RIGHT_HAND_COURSE_RESUME_KEY, JSON.stringify({ courseId: course.id, nextIndex: -4, updatedAt: "2026-10-20T00:00:00Z" }));
assert.equal(courses.readRightHandCourseResume([course]).nextIndex, 0, "negative saved course index is clamped");

const now = Date.parse("2026-10-21T00:00:00.000Z");
const trendEvents = [
  recorded({ id: "old", recordingId: "duplicate", practisedAt: "2026-10-01T12:00:00Z", score: 60 }),
  recorded({ id: "new", recordingId: "duplicate", practisedAt: "2026-10-02T12:00:00Z", score: 90 }),
  recorded({ id: "limited", recordingId: "limited", practisedAt: "2026-10-03T12:00:00Z", scoreReliability: "limited" }),
  recorded({ id: "unlabelled", recordingId: "unlabelled", practisedAt: "2026-10-03T13:00:00Z", scoreReliability: undefined }),
  recorded({ id: "disputed", recordingId: "disputed", practisedAt: "2026-10-04T12:00:00Z", reviewAccepted: false }),
  recorded({ id: "self", recordingId: undefined, practisedAt: "2026-10-05T12:00:00Z" }),
  recorded({ id: "boundary", recordingId: "boundary", practisedAt: "2026-10-07T00:00:00Z", score: 70 })
];
courseStorage.set("chord-hero:right-hand:recording-history:v2", JSON.stringify({ [exercise.id]: trendEvents.filter((event) => event.recordingId).map((event) => ({ id: event.recordingId })) }));
const weeks = trend.rightHandFourWeekTrend(trendEvents, now);
assert.equal(weeks.length, 4);
assert.deepEqual(weeks[1].techniques.strumming, { count: 1, average: 90 }, "duplicate takes use the latest valid recording");
assert.equal(weeks[1].techniques.strumming.count, 1, "low-quality, disputed and self-rated events are excluded");
assert.equal(weeks[1].techniques.strumming.average, 90);
assert.equal(weeks[0].from, now - 28 * 86_400_000);
assert.equal(trend.isValidRightHandTrendEvidence(recorded({ timingEvidenceCount: 3 })), false, "partial takes are excluded from like-for-like trends");
assert.equal(trend.isValidRightHandTrendEvidence(recorded({ rightHandContext: { ...recorded().rightHandContext, retained: false } })), false, "session-only takes are excluded from retained trends");
const cohortKey = trend.rightHandTrendCohortKey(recorded());
const cohortEvents = [recorded(), recorded({ rightHandContext: { ...recorded().rightHandContext, tempo: 92 } })];
courseStorage.set("chord-hero:right-hand:recording-history:v2", JSON.stringify({ [exercise.id]: cohortEvents.map((event) => ({ id: event.recordingId })) }));
assert.equal(trend.rightHandTrendCohorts(cohortEvents, now).length, 2, "unlike tempo cohorts stay separate");
assert.ok(cohortKey);
const retainedEvent = recorded({ recordingId: "retained-audio" });
courseStorage.delete("chord-hero:right-hand:recording-history:v2");
assert.equal(trend.rightHandTrendCohorts([retainedEvent], now).length, 0, "missing retained history fails closed");
courseStorage.set("chord-hero:right-hand:recording-history:v2", "not-json");
assert.equal(trend.rightHandTrendCohorts([retainedEvent], now).length, 0, "malformed retained history fails closed");
courseStorage.set("chord-hero:right-hand:recording-history:v2", JSON.stringify({ [exercise.id]: [{ id: "retained-audio" }] }));
assert.equal(trend.rightHandTrendCohorts([retainedEvent], now).length, 1, "a retained take joins its cohort");
courseStorage.set("chord-hero:right-hand:recording-history:v2", JSON.stringify({ [exercise.id]: [] }));
assert.equal(trend.rightHandTrendCohorts([retainedEvent], now).length, 0, "deleted or pruned take leaves its cohort");
courseStorage.set("chord-hero:right-hand:recording-history:v2", JSON.stringify({ [exercise.id]: [{ id: "retained-audio", reviewAccepted: false, analysis: { reviewAccepted: false } }] }));
assert.equal(trend.rightHandTrendCohorts([retainedEvent], now).length, 0, "disputed retained take leaves its cohort");
courseStorage.delete("chord-hero:right-hand:recording-history:v2");

assert.equal(pitch.chordTemplate("F#")?.root, 6, "sharp chord roots are supported");
assert.deepEqual(pitch.chordTemplate("A7")?.tones, [9, 1, 4, 7], "dominant seventh intervals are supported");
assert.deepEqual(pitch.chordTemplate("Bm7")?.tones, [11, 2, 6, 9], "minor seventh intervals are supported");
assert.deepEqual(pitch.chordTemplate("Dsus4")?.tones, [2, 7, 9], "suspended intervals are supported");
for (const chord of ["F#", "A7", "Bm7", "Dsus4"]) {
  const template = pitch.chordTemplate(chord);
  const chroma = Array.from({ length: 12 }, (_, note) => template?.tones.includes(note) ? 1 : 0);
  assert.equal(pitch.bestChord(chroma).chord, chord, `${chord} is represented in harmonic candidates`);
}
const clues = recordingAnalysis.summarizeHarmonicListeningClues([
  { step: 0, patternToken: "D", expectedMs: 0, observedMs: 0, expectedChord: "C", detectedChord: "C", confidence: 90 },
  { step: 4, patternToken: "D!", expectedMs: 500, observedMs: 510, expectedChord: "G", detectedChord: "D", confidence: 70 }
]);
assert.equal(clues.transitions[0].step, 4, "transition clue points to the written step");
assert.match(clues.mismatches[0].label, /D!/);
const recapAnalysis = { recordingId: "recap", reviewAccepted: true, scoreReliability: "reliable", recordingSuitability: "good", timingScore: 86, signalDiagnostics: { materiallyClipped: false }, practiceContext: { bpm: 80, pattern: ["D", "U", "D", "U"], chordProgression: ["C", "G"] }, analysisOptions: {}, beatTimings: [{ step: 0, status: "on-time", offsetMs: 0 }, { step: 1, status: "late", offsetMs: 42 }, { step: 2, status: "on-time", offsetMs: 0 }, { step: 3, status: "on-time", offsetMs: 0 }], troubleBeats: [1], harmonicEvidence: [{ step: 0, patternToken: "D", expectedMs: 0, observedMs: 0, expectedChord: "C", detectedChord: "C", confidence: 90 }, { step: 2, patternToken: "D", expectedMs: 500, observedMs: 510, expectedChord: "G", detectedChord: "C", confidence: 70 }] };
assert.equal(sessionSummary.nextRightHandAction(recapAnalysis, 4, 80, "Drill").kind, "timing", "timing hotspots retain priority over chord clues");
assert.match(sessionSummary.nextRightHandAction(recapAnalysis, 4, 80, "Drill").evidence, /one observed late timing miss/i, "one actual beat miss is enough to choose a timing loop");
const cleanTiming = { ...recapAnalysis, troubleBeats: [], beatTimings: recapAnalysis.beatTimings.map((beat) => ({ ...beat, status: "on-time" })) };
assert.equal(sessionSummary.nextRightHandAction(cleanTiming, 4, 80, "Drill").kind, "chord", "accepted full takes can suggest a chord listening clue");
assert.equal(sessionSummary.nextRightHandAction({ ...cleanTiming, harmonicEvidence: cleanTiming.harmonicEvidence.map((item) => ({ ...item, detectedChord: item.expectedChord })) }, 4, 80, "Drill").kind, "repeat", "clean chord transitions do not suggest a chord loop");
assert.equal(sessionSummary.nextRightHandAction({ ...cleanTiming, scoreReliability: "limited" }, 4, 80, "Drill").kind, "repeat", "partial takes cannot suggest chord actions");
assert.equal(sessionSummary.nextRightHandAction({ ...cleanTiming, reviewAccepted: false }, 4, 80, "Drill").kind, "repeat", "disputed takes cannot suggest chord actions");
const comparableCurrent = { ...cleanTiming, analysisOptions: { instrumentProfile: "acoustic", pitchScoringMode: "quality" } };
const comparablePrevious = { ...comparableCurrent, recordingId: "previous", analysisOptions: { instrumentProfile: "electric", pitchScoringMode: "timing" } };
assert.equal(sessionSummary.previousComparableTake(comparableCurrent, [{ id: "recap", createdAt: "2026-10-21T12:00:00Z", reviewAccepted: true, analysis: comparableCurrent }, { id: "previous", createdAt: "2026-10-20T12:00:00Z", reviewAccepted: true, analysis: comparablePrevious }]), null, "different instrument/scoring modes do not compare");

const phrase = learning.phrasingBars(4, ["Am", "F"]);
assert.deepEqual(phrase.map((bar) => bar.chord), ["Am", "F", "Am", "F"]);
assert.ok(phrase.at(-1).tokens.slice(1).every((token) => token === "·"));
assert.deepEqual(learning.phrasingBars(4, ["not-a-chord"]).map((bar) => bar.chord), ["G", "C", "Em", "D"], "invalid progression falls back to authored chords");

const validAttachment = teacher.feedbackAttachmentFromInput({ kind: "videoLink", label: "Bar 2 cue", url: "https://teacher.example/feedback", timestampSeconds: 24, consentNote: "Learner agreed", consent: "shared" });
assert.equal(validAttachment?.timestampSeconds, 24);
assert.equal(validAttachment?.consent, "shared");
assert.equal(teacher.feedbackAttachmentFromInput({ kind: "audioLink", label: "bad", url: "http://insecure.example", timestampSeconds: 0, consent: "shared" }), null);
assert.equal(teacher.feedbackAttachmentFromInput({ kind: "recordingReference", label: "bad", recordingId: "take", timestampSeconds: 86_401, consent: "shared" }), null);
const assignment = { id: "assignment", studentName: "Ada", title: "Drill", instructions: "", area: "rightHand", targetMinutes: 10, createdAt: "2026-10-20T00:00:00Z", updatedAt: "2026-10-20T00:00:00Z", feedbackAttachments: [validAttachment] };
const redacted = teacher.rightHandTeacherExport([assignment], [recorded()]);
assert.equal(redacted.assignments[0].student, "redacted");
assert.equal(redacted.assignments[0].feedbackAttachments[0].consent, "redacted");
assert.equal("url" in redacted.assignments[0].feedbackAttachments[0], false);
const consented = teacher.rightHandTeacherExport([assignment], [], { includeSharedAttachments: true });
assert.equal(consented.assignments[0].feedbackAttachments[0].url, validAttachment.url);

const manifest = { version: 1, samples: [
  { participantId: "p-cal", sessionId: "s1", split: "calibration", file: "cal.wav", device: "phone", guitar: "acoustic-a", microphone: "built-in", environment: "quiet-room", tuning: "standard", capo: 0, consent: { granted: true, scope: "local-participant-validation", source: "performer", date: "2026-10-20" } },
  { participantId: "p-val", sessionId: "s2", split: "validation", file: "val.wav", device: "laptop", guitar: "acoustic-b", microphone: "usb", environment: "treated-room", tuning: "standard", capo: 0, consent: { granted: true, scope: "local-participant-validation", source: "performer", date: "2026-10-20" } },
  { participantId: "p-held", sessionId: "s3", split: "held-out", file: "held.wav", device: "phone", guitar: "acoustic-a", microphone: "built-in", environment: "quiet-room", tuning: "standard", capo: 0, consent: { granted: true, scope: "local-participant-validation", source: "performer", date: "2026-10-20" } }
] };
const parsed = participants.parseParticipantValidationManifest(manifest);
assert.equal(participants.validateParticipantValidationProtocol(parsed).valid, true);
assert.equal(participants.validateParticipantValidationProtocol(parsed).setupCoverage.microphones, 2);
assert.equal(participants.validateParticipantValidationProtocol([...parsed, { ...parsed[0], file: "leak.wav", sessionId: "s4", split: "held-out" }]).valid, false, "participant leakage across splits is rejected");
assert.equal(participants.validateParticipantValidationProtocol([...parsed, { ...parsed[0], file: "session-leak.wav", sessionId: "s2", split: "held-out", participantId: "p-val" }]).valid, false, "session leakage across splits is rejected");
assert.throws(() => participants.parseParticipantValidationManifest({ ...manifest, samples: [{ ...manifest.samples[0], consent: { ...manifest.samples[0].consent, granted: false } }, ...manifest.samples.slice(1)] }), /consent/);
assert.throws(() => participants.parseParticipantValidationManifest({ ...manifest, samples: [{ ...manifest.samples[0], microphone: "" }, ...manifest.samples.slice(1)] }), /setup/);

console.log("Right-hand follow-ups: resumable course evidence, trend windows, chord phrasing, teacher consent exports and participant protocol passed.");
