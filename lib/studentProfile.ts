import { emptyPracticePlatformState, mergePracticePlatformStates, normalizePracticePlatformState, type PracticePlatformState } from "./practicePlatform";

export type PracticeStat = {
  seconds: number;
  reps: number;
  misses?: number;
  nextReviewAt?: string;
  strength?: number;
};

export type PracticeStats = Record<string, PracticeStat>;

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

export const createStudentProfile = (id: string, name: string, now = new Date().toISOString()): StudentProfile => ({
  id,
  name,
  favorites: [],
  recents: [],
  practiceStats: {},
  userNotes: {},
  stringMistakes: {},
  instrumentProfile: { ...DEFAULT_INSTRUMENT_PROFILE, updatedAt: now },
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
  return {
    ...newest,
    favorites: [...new Set([...local.favorites, ...remote.favorites])],
    recents: [...new Set([...local.recents, ...remote.recents])].slice(0, 12),
    practiceStats: newest.practiceStats,
    userNotes: newest.userNotes,
    stringMistakes: newest.stringMistakes,
    instrumentProfile: newest.instrumentProfile
  };
};

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
    profiles: Array.isArray(source.profiles) ? source.profiles.filter((profile): profile is StudentProfile => Boolean(profile && typeof profile.id === "string")) : [],
    assignments: Array.isArray(source.assignments) ? source.assignments.filter((assignment): assignment is TeacherAssignment => Boolean(assignment && typeof assignment.id === "string")) : [],
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
    updatedAt: value.updatedAt ?? now
  };
}
