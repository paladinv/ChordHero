import { emptyPracticePlatformState, mergePracticePlatformStates, normalizePracticePlatformState, type PracticePlatformState } from "./practicePlatform";
import { DEFAULT_LEARNING_STATE, normalizeLearningState, type HandPreference, type LearningState, type PracticeGoal } from "./chordLearning";
import type { HarmonicRole } from "./harmony";

export type PracticeStat = {
  seconds: number;
  reps: number;
  misses?: number;
  nextReviewAt?: string;
  strength?: number;
};

export type PracticeStats = Record<string, PracticeStat>;

export type LearningSkill = "beginner" | "intermediate" | "advanced";

export type LearningPreferences = HandPreference;

export type TeacherFeedback = {
  id: string;
  body: string;
  author: string;
  createdAt: string;
};

export type InstrumentProfile = {
  scaleLengthInches: number;
  action: "low" | "medium" | "high";
  tuningId: string;
  updatedAt: string;
};

export type TeacherAssignment = {
  id: string;
  studentId: string;
  title: string;
  description: string;
  chordIds: string[];
  dueAt?: string;
  completedAt?: string;
  teacherComments?: string;
  feedbackHistory: TeacherFeedback[];
  updatedAt: string;
};

export type StudentProfile = {
  id: string;
  name: string;
  favorites: string[];
  recents: string[];
  practiceStats: PracticeStats;
  userNotes: Record<string, string>;
  stringMistakes: Record<string, number[]>;
  instrumentProfile: InstrumentProfile;
  learningState: LearningState;
  learningPreferences: LearningPreferences;
  learningGoals: PracticeGoal[];
  learningComposerRoles: HarmonicRole[];
  updatedAt: string;
};

export type StudentCloudState = {
  profiles: StudentProfile[];
  assignments: TeacherAssignment[];
  practicePlatform?: PracticePlatformState;
};

export const DEFAULT_INSTRUMENT_PROFILE: InstrumentProfile = {
  scaleLengthInches: 25.5,
  action: "medium",
  tuningId: "standard",
  updatedAt: ""
};

export const DEFAULT_LEARNING_PREFERENCES: LearningPreferences = {
  handSpanCm: 19,
  targetSkill: "beginner"
};

export const createStudentProfile = (id: string, name: string, now = new Date().toISOString()): StudentProfile => ({
  id,
  name,
  favorites: [],
  recents: [],
  practiceStats: {},
  userNotes: {},
  stringMistakes: {},
  instrumentProfile: { ...DEFAULT_INSTRUMENT_PROFILE, updatedAt: now },
  learningState: { ...DEFAULT_LEARNING_STATE, handPreference: { ...DEFAULT_LEARNING_STATE.handPreference } },
  learningPreferences: { ...DEFAULT_LEARNING_PREFERENCES },
  learningGoals: [],
  learningComposerRoles: [],
  updatedAt: now
});

const latestBy = <T extends { id: string; updatedAt: string }>(local: T[], remote: T[]) => {
  const merged = new Map<string, T>();
  [...local, ...remote].forEach((item) => {
    const previous = merged.get(item.id);
    if (!previous || item.updatedAt >= previous.updatedAt) merged.set(item.id, item);
  });
  return [...merged.values()];
};

const mergeProfile = (local: StudentProfile, remote: StudentProfile): StudentProfile => {
  const newest = remote.updatedAt >= local.updatedAt ? remote : local;
  const newestLearningState = remote.updatedAt >= local.updatedAt ? remote.learningState : local.learningState;
  const learningGoals = mergeLearningGoals(local.learningState.goals, remote.learningState.goals);
  const learningComposerRoles = [...new Set([...local.learningState.composerRoles, ...remote.learningState.composerRoles])].slice(0, 12) as HarmonicRole[];
  const learningState: LearningState = {
    ...newestLearningState,
    goals: learningGoals,
    composerRoles: learningComposerRoles
  };
  return {
    ...newest,
    favorites: [...new Set([...local.favorites, ...remote.favorites])],
    recents: [...new Set([...local.recents, ...remote.recents])].slice(0, 12),
    practiceStats: newest.practiceStats,
    userNotes: newest.userNotes,
    stringMistakes: newest.stringMistakes,
    instrumentProfile: newest.instrumentProfile,
    learningState,
    learningPreferences: learningState.handPreference,
    learningGoals,
    learningComposerRoles
  };
};

const mergeLearningGoals = (local: PracticeGoal[] = [], remote: PracticeGoal[] = []) => {
  const merged = new Map<string, PracticeGoal>();
  [...local, ...remote].forEach((goal) => merged.set(goal.id, goal));
  return [...merged.values()].slice(0, 12);
};

const normalizeTimestamp = (value: unknown): string | undefined => {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return undefined;
  return new Date(value).toISOString();
};

export function normalizeTeacherFeedback(value: unknown): TeacherFeedback | null {
  if (!value || typeof value !== "object") return null;
  const feedback = value as Partial<TeacherFeedback>;
  const createdAt = normalizeTimestamp(feedback.createdAt);
  if (typeof feedback.id !== "string" || typeof feedback.body !== "string" || !feedback.body.trim() || typeof feedback.author !== "string" || !createdAt) return null;
  return {
    id: feedback.id.slice(0, 80),
    body: feedback.body.trim().slice(0, 500),
    author: feedback.author.trim().slice(0, 120) || "Teacher",
    createdAt
  };
}

export function normalizeTeacherAssignment(value: unknown): TeacherAssignment | null {
  if (!value || typeof value !== "object") return null;
  const assignment = value as Partial<TeacherAssignment>;
  if (typeof assignment.id !== "string" || typeof assignment.studentId !== "string" || typeof assignment.title !== "string") return null;
  return {
    id: assignment.id,
    studentId: assignment.studentId,
    title: assignment.title,
    description: typeof assignment.description === "string" ? assignment.description : "",
    chordIds: Array.isArray(assignment.chordIds) ? assignment.chordIds.filter((id): id is string => typeof id === "string").slice(0, 80) : [],
    dueAt: typeof assignment.dueAt === "string" ? assignment.dueAt : undefined,
    completedAt: typeof assignment.completedAt === "string" ? assignment.completedAt : undefined,
    teacherComments: typeof assignment.teacherComments === "string" ? assignment.teacherComments.slice(0, 1000) : undefined,
    feedbackHistory: Array.isArray(assignment.feedbackHistory) ? assignment.feedbackHistory.map(normalizeTeacherFeedback).filter((feedback): feedback is TeacherFeedback => Boolean(feedback)).slice(-20) : [],
    updatedAt: normalizeTimestamp(assignment.updatedAt) ?? new Date(0).toISOString()
  };
}

export function mergeStudentCloudStates(local: StudentCloudState, remote: StudentCloudState): StudentCloudState {
  const profileById = new Map<string, StudentProfile>();
  latestBy(local.profiles, remote.profiles).forEach((profile) => profileById.set(profile.id, profile));
  local.profiles.forEach((profile) => {
    const remoteProfile = remote.profiles.find((item) => item.id === profile.id);
    if (remoteProfile) profileById.set(profile.id, mergeProfile(profile, remoteProfile));
  });
  return {
    profiles: [...profileById.values()],
    assignments: latestBy(local.assignments, remote.assignments),
    practicePlatform: mergePracticePlatformStates(
      local.practicePlatform ?? emptyPracticePlatformState(),
      remote.practicePlatform ?? emptyPracticePlatformState()
    )
  };
}

export function normalizeStudentCloudState(value: unknown): StudentCloudState {
  if (!value || typeof value !== "object") return { profiles: [], assignments: [], practicePlatform: emptyPracticePlatformState() };
  const source = value as Partial<StudentCloudState>;
  return {
    profiles: Array.isArray(source.profiles) ? source.profiles.filter((profile): profile is StudentProfile => Boolean(profile && typeof profile === "object" && typeof (profile as Partial<StudentProfile>).id === "string")).map(normalizeStudentProfile) : [],
    assignments: Array.isArray(source.assignments) ? source.assignments.map(normalizeTeacherAssignment).filter((assignment): assignment is TeacherAssignment => Boolean(assignment)) : [],
    practicePlatform: normalizePracticePlatformState(source.practicePlatform)
  };
}

export function normalizeStudentProfile(value: Partial<StudentProfile> & Pick<StudentProfile, "id">): StudentProfile {
  const now = new Date().toISOString();
  return {
    ...createStudentProfile(value.id, value.name ?? "Student", value.updatedAt ?? now),
    ...value,
    favorites: Array.isArray(value.favorites) ? value.favorites : [],
    recents: Array.isArray(value.recents) ? value.recents : [],
    practiceStats: value.practiceStats ?? {},
    userNotes: value.userNotes ?? {},
    stringMistakes: value.stringMistakes ?? {},
    instrumentProfile: { ...DEFAULT_INSTRUMENT_PROFILE, ...(value.instrumentProfile ?? {}), updatedAt: value.instrumentProfile?.updatedAt ?? now },
    learningState: normalizeLearningState(value.learningState ?? {
      learningKey: DEFAULT_LEARNING_STATE.learningKey,
      songKey: DEFAULT_LEARNING_STATE.songKey,
      songFamily: DEFAULT_LEARNING_STATE.songFamily,
      handPreference: value.learningPreferences,
      goals: value.learningGoals,
      composerRoles: value.learningComposerRoles
    }),
    learningPreferences: normalizeLearningState(value.learningState ?? { handPreference: value.learningPreferences }).handPreference,
    learningGoals: normalizeLearningState(value.learningState ?? { goals: value.learningGoals }).goals,
    learningComposerRoles: normalizeLearningState(value.learningState ?? { composerRoles: value.learningComposerRoles }).composerRoles,
    updatedAt: value.updatedAt ?? now
  };
}
