"use client";
import { useEffect, useState } from "react";
import { RIGHT_HAND_GUIDED_PATHS } from "../lib/rightHandPracticePresets";
import { RIGHT_HAND_EXERCISES, type RightHandExercise } from "../lib/rightHandExercises";
import type { ExerciseProgress } from "../lib/rightHandPracticeRuntime";
import { PRACTICE_STATE_EVENT, readPracticePlatformState } from "../lib/practicePlatform";
import { readRightHandCourseResume, rightHandCourseProgress, writeRightHandCourseResume } from "../lib/rightHandCourses";

export default function RightHandCourses({ activeId, onActive, progress, onSelect }: { activeId: string | null; onActive: (id: string) => void; progress: Record<string, ExerciseProgress>; onSelect: (exercise: RightHandExercise) => void }) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState(() => readPracticePlatformState().events);
  useEffect(() => {
    let saved = readRightHandCourseResume(RIGHT_HAND_GUIDED_PATHS);
    if (!saved) {
      try {
        const legacyId = localStorage.getItem("chord-hero:right-hand:course:v1");
        const legacyCourse = RIGHT_HAND_GUIDED_PATHS.find((course) => course.id === legacyId);
        if (legacyCourse) { saved = { courseId: legacyCourse.id, nextIndex: 0, updatedAt: new Date(0).toISOString() }; writeRightHandCourseResume(saved.courseId, saved.nextIndex); }
      } catch { /* Resume is optional. */ }
    }
    if (saved) {
      const course = RIGHT_HAND_GUIDED_PATHS.find((item) => item.id === saved.courseId);
      if (course) {
        onActive(course.id);
        const exercise = RIGHT_HAND_EXERCISES.find((item) => item.id === course.exercises[saved.nextIndex]);
        if (exercise) onSelect(exercise);
      }
    }
    const refresh = () => setEvents(readPracticePlatformState().events);
    window.addEventListener(PRACTICE_STATE_EVENT, refresh);
    return () => window.removeEventListener(PRACTICE_STATE_EVENT, refresh);
  }, [onActive, onSelect]);
  const active = RIGHT_HAND_GUIDED_PATHS.find((course) => course.id === activeId);
  const resume = (course: typeof RIGHT_HAND_GUIDED_PATHS[number]) => {
    const status = rightHandCourseProgress(course, progress, events);
    const exercise = RIGHT_HAND_EXERCISES.find((item) => item.id === course.exercises[status.nextIndex]);
    if (!exercise) return;
    onActive(course.id); writeRightHandCourseResume(course.id, status.nextIndex);
    onSelect(exercise); setOpen(false);
  };
  const activeStatus = active ? rightHandCourseProgress(active, progress, events) : null;
  const activeCourseId = active?.id ?? null;
  const nextIndex = activeStatus?.nextIndex ?? -1;
  useEffect(() => { if (activeCourseId && nextIndex >= 0) writeRightHandCourseResume(activeCourseId, nextIndex); }, [activeCourseId, nextIndex]);
  return <section className="practice-paths right-hand-courses" aria-label="Local guided courses"><div className="course-launch"><button className="practice-paths-toggle" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}><span><span className="label">Guided courses · saved on this device</span><strong>{active?.title ?? "Not sure where to start?"}</strong></span><span>{open ? "Hide courses" : "Choose a course"}</span></button>{active ? <button type="button" onClick={() => resume(active)}>Continue {activeStatus?.nextKind === "recorded-check" ? "recorded checkpoint" : activeStatus?.nextKind === "review" ? "course review" : "course"}</button> : null}</div>{activeStatus ? <p>{activeStatus.practised}/{activeStatus.lessons.length} lessons practised · {activeStatus.recorded}/{activeStatus.lessons.length} accepted recorded timing checkpoints. Free exercise selection stays available.</p> : null}{open ? <div className="practice-path-grid">{RIGHT_HAND_GUIDED_PATHS.map((course) => {
    const status = rightHandCourseProgress(course, progress, events);
    return <article key={course.id} className={activeId === course.id ? "active" : ""}><h3>{course.title}</h3><p>{course.description}</p><ol>{status.lessons.map((lesson) => <li key={lesson.exerciseId}><span>{RIGHT_HAND_EXERCISES.find((exercise) => exercise.id === lesson.exerciseId)?.title}</span><small>{lesson.practised ? "Practised" : "Practice pending"}{lesson.selfRatedClean ? " · self-rated controlled" : ""} · {lesson.recorded ? "recorded timing ≥80%" : "recorded check pending"}</small></li>)}</ol><button type="button" onClick={() => resume(course)}>{status.practised ? "Resume" : "Start"} · lesson {status.nextIndex + 1}</button></article>;
  })}<p className="course-evidence-note">A completed round marks practice, not mastery. Recorded checkpoints use accepted microphone score events; they do not prove pick motion, string identity or chord-transition mechanics. Microphone checks are optional and never lock lessons.</p></div> : null}</section>;
}
