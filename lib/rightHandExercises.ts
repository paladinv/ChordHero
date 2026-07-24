import sharedRightHandContent from "../shared/content/v1/right-hand.json";

export type RightHandTechnique = "strumming" | "plectrum" | "fingerpicking";
export type RightHandDifficulty = "beginner" | "intermediate" | "expert";

export type RightHandExercise = {
  id: string;
  technique: RightHandTechnique;
  difficulty: RightHandDifficulty;
  title: string;
  focus: string;
  coaching: string;
  bpm: number;
  subdivision: "Quarter notes" | "Eighth notes" | "Triplets" | "Sixteenth notes";
  pattern: string[];
};

type TechniqueDetail = { label: string; shortLabel: string; description: string; symbol: string };
type DifficultyDetail = { label: string; description: string };

export const TECHNIQUE_DETAILS = sharedRightHandContent.techniques as Record<
  RightHandTechnique,
  TechniqueDetail
>;

export const DIFFICULTY_DETAILS = sharedRightHandContent.difficulties as Record<
  RightHandDifficulty,
  DifficultyDetail
>;

export const RIGHT_HAND_EXERCISES = sharedRightHandContent.exercises as RightHandExercise[];
