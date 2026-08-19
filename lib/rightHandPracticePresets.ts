export const RIGHT_HAND_PROGRESSIONS = [
  { id: "off", label: "No backing", chords: [] },
  { id: "gcd", label: "G – C – D – G", chords: ["G", "C", "D", "G"] },
  { id: "pop-g", label: "I–V–vi–IV in G", chords: ["G", "D", "Em", "C"] },
  { id: "pop-c", label: "I–V–vi–IV in C", chords: ["C", "G", "Am", "F"] },
  { id: "blues-a", label: "12-bar colors in A", chords: ["A7", "D7", "A7", "E7"] },
  { id: "custom", label: "Custom progression", chords: [] }
] as const;

export const RIGHT_HAND_ROUND_OPTIONS = [
  { seconds: 30, label: "30 sec" }, { seconds: 60, label: "1 min" },
  { seconds: 180, label: "3 min" }, { seconds: 0, label: "Free" }
] as const;

export const RIGHT_HAND_GUIDED_PATHS: ReadonlyArray<{ id: string; title: string; description: string; exercises: readonly string[] }> = [
  { id: "steady-strummer", title: "First week of strumming", description: "Pulse → down-up motion → rests → mutes", exercises: ["strum-quarter-downs", "strum-eighth-engine", "strum-space", "strum-first-mute"] },
  { id: "accurate-pick", title: "Alternate-picking accuracy", description: "Single string → crossing → skipping → triplets", exercises: ["pick-single-string", "pick-two-string", "pick-inside-out", "pick-triplet-roll"] },
  { id: "fingerstyle-foundation", title: "Fingerstyle foundations", description: "Thumb → P–i–m–a → pinches → Travis picking", exercises: ["finger-thumb", "finger-pima", "finger-pinches", "finger-travis"] },
  { id: "groove-colors", title: "Six style milestone tour", description: "Reggae → funk → shuffle → bluegrass → bossa → Travis", exercises: ["strum-reggae", "strum-funk", "strum-backbeat", "pick-crosspicking", "finger-syncopated-pinch", "finger-travis"] }
] as const;
