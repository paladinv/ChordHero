export type AdaptivePreference = "comfort" | "challenge";
export function adaptTrainerPace(pace: number, recovery: number, rating: "clean" | "missed" | "needsWork", preference: AdaptivePreference, base: number) {
  if (rating === "missed") return { pace: Math.min(8, pace + (preference === "comfort" ? 1 : 0.5)), recovery: 0 };
  if (rating === "needsWork") return { pace: Math.min(8, pace + (preference === "comfort" ? 0.5 : 0.25)), recovery: 0 };
  const nextRecovery = recovery + 1;
  return nextRecovery >= (preference === "comfort" ? 3 : 2)
    ? { pace: Math.max(base, pace - 0.5), recovery: 0 }
    : { pace, recovery: nextRecovery };
}
