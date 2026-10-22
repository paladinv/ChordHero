import type { ExerciseProgress } from "./rightHandPracticeRuntime";
import type { PracticeResult } from "./practicePlatform";
import { isValidRightHandTrendEvidence } from "./rightHandTrends";

export type RightHandCourse = { id: string; title: string; description: string; exercises: readonly string[] };
export type RightHandCourseResume = { courseId: string; nextIndex: number; updatedAt: string };
export const RIGHT_HAND_COURSE_RESUME_KEY = "chord-hero:right-hand:course-resume:v1";

export function readRightHandCourseResume(courses: readonly RightHandCourse[]): RightHandCourseResume | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(RIGHT_HAND_COURSE_RESUME_KEY) ?? "null") as Partial<RightHandCourseResume> | null;
    const course = courses.find((item) => item.id === value?.courseId);
    if (!course || typeof value?.nextIndex !== "number" || !Number.isFinite(value.nextIndex)) return null;
    return { courseId: course.id, nextIndex: Math.max(0, Math.min(course.exercises.length - 1, Math.floor(value.nextIndex))), updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString() };
  } catch { return null; }
}

export function writeRightHandCourseResume(courseId: string, nextIndex: number) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(RIGHT_HAND_COURSE_RESUME_KEY, JSON.stringify({ courseId, nextIndex: Math.max(0, Math.floor(nextIndex)), updatedAt: new Date().toISOString() })); } catch { /* Local course continuity is optional. */ }
}

export function rightHandCourseProgress(course: RightHandCourse, progress: Record<string, ExerciseProgress>, events: readonly PracticeResult[], now = Date.now()) {
  const recorded = new Set(events.filter((event) => isValidRightHandTrendEvidence(event) && (event.score ?? 0) >= 80 && Number.isFinite(Date.parse(event.practisedAt)) && Date.parse(event.practisedAt) <= now).map((event) => event.itemId));
  const lessons = course.exercises.map((exerciseId) => ({ exerciseId, practised: (progress[exerciseId]?.sessions ?? 0) > 0, selfRatedClean: (progress[exerciseId]?.cleanSessions ?? 0) > 0, recorded: recorded.has(exerciseId) }));
  const unfinished = lessons.findIndex((lesson) => !lesson.practised);
  const unchecked = lessons.findIndex((lesson) => !lesson.recorded);
  return { lessons, practised: lessons.filter((lesson) => lesson.practised).length, recorded: lessons.filter((lesson) => lesson.recorded).length, nextIndex: unfinished >= 0 ? unfinished : unchecked >= 0 ? unchecked : 0, nextKind: unfinished >= 0 ? "practice" as const : unchecked >= 0 ? "recorded-check" as const : "review" as const };
}
