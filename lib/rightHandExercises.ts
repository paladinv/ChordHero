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

export const TECHNIQUE_DETAILS: Record<
  RightHandTechnique,
  { label: string; shortLabel: string; description: string; symbol: string }
> = {
  strumming: {
    label: "Strumming",
    shortLabel: "Strum",
    description: "Build a relaxed, even groove with downstrokes, upstrokes, accents, and mutes.",
    symbol: "↕"
  },
  plectrum: {
    label: "Plectrum picking",
    shortLabel: "Pick",
    description: "Train string accuracy, alternate picking, crossing, and fast flatpick control.",
    symbol: "△"
  },
  fingerpicking: {
    label: "Fingerpicking",
    shortLabel: "Finger",
    description: "Coordinate thumb and fingers through arpeggios, pinches, independence, and syncopation.",
    symbol: "pima"
  }
};

export const DIFFICULTY_DETAILS: Record<
  RightHandDifficulty,
  { label: string; description: string }
> = {
  beginner: { label: "Beginner", description: "Steady motion and clean contact" },
  intermediate: { label: "Intermediate", description: "Syncopation and string changes" },
  expert: { label: "Expert", description: "Speed, accents, and independence" }
};

export const RIGHT_HAND_EXERCISES: RightHandExercise[] = [
  {
    id: "strum-quarter-downs", technique: "strumming", difficulty: "beginner",
    title: "Four on the floor", focus: "Even downstrokes",
    coaching: "Let the forearm guide a small, loose motion. Brush through the strings instead of digging in.",
    bpm: 72, subdivision: "Quarter notes", pattern: ["D!", "D", "D", "D"]
  },
  {
    id: "strum-eighth-engine", technique: "strumming", difficulty: "beginner",
    title: "Eighth-note engine", focus: "Continuous down-up motion",
    coaching: "Keep your hand moving like a pendulum. Down on the numbers, up on every ‘and’.",
    bpm: 68, subdivision: "Eighth notes", pattern: ["D!", "U", "D", "U", "D!", "U", "D", "U"]
  },
  {
    id: "strum-space", technique: "strumming", difficulty: "beginner",
    title: "Leave some air", focus: "Missing the strings on purpose",
    coaching: "Keep the strumming hand moving through rests. The silent stroke still has a direction.",
    bpm: 64, subdivision: "Eighth notes", pattern: ["D!", "·", "D", "U", "D!", "·", "D", "U"]
  },
  {
    id: "strum-first-mute", technique: "strumming", difficulty: "beginner",
    title: "First percussive mute", focus: "Chord and muted strum",
    coaching: "Release fretting pressure just before X, then land a light, scratchy stroke across the strings.",
    bpm: 70, subdivision: "Eighth notes", pattern: ["D!", "U", "X", "U", "D!", "U", "X", "U"]
  },
  {
    id: "strum-pop-groove", technique: "strumming", difficulty: "intermediate",
    title: "Classic pop groove", focus: "Syncopated eighth notes",
    coaching: "The hand never stops. Ghost through the dots and make the final upstroke light.",
    bpm: 88, subdivision: "Eighth notes", pattern: ["D!", "·", "D", "U", "·", "U", "D", "U"]
  },
  {
    id: "strum-backbeat", technique: "strumming", difficulty: "intermediate",
    title: "Backbeat snap", focus: "Accents on beats two and four",
    coaching: "Use a wider stroke for accents, not a tighter grip. Keep every other stroke compact.",
    bpm: 92, subdivision: "Eighth notes", pattern: ["D", "U", "D!", "U", "D", "U", "D!", "U"]
  },
  {
    id: "strum-sixteenth", technique: "strumming", difficulty: "intermediate",
    title: "Sixteenth-note pocket", focus: "D D U U D U phrasing",
    coaching: "Count 1 e & a. The wrist keeps all four subdivisions even when the strings are skipped.",
    bpm: 72, subdivision: "Sixteenth notes", pattern: ["D!", "·", "D", "U", "·", "U", "D", "U", "D!", "·", "D", "U", "·", "U", "D", "U"]
  },
  {
    id: "strum-reggae", technique: "strumming", difficulty: "intermediate",
    title: "Offbeat chops", focus: "Short upstroke accents",
    coaching: "Stay loose on the down motion and snap a short chord on each upstroke.",
    bpm: 82, subdivision: "Eighth notes", pattern: ["·", "U!", "·", "U!", "·", "U!", "·", "U!"]
  },
  {
    id: "strum-accent-grid", technique: "strumming", difficulty: "expert",
    title: "Moving accent grid", focus: "Accent displacement",
    coaching: "Keep the pulse unchanged while the loud stroke moves across the sixteenth-note grid.",
    bpm: 96, subdivision: "Sixteenth notes", pattern: ["D!", "U", "D", "U", "D", "U!", "D", "U", "D", "U", "D!", "U", "D", "U", "D", "U!"]
  },
  {
    id: "strum-funk", technique: "strumming", difficulty: "expert",
    title: "Funk scratch circuit", focus: "Muted sixteenths and chord stabs",
    coaching: "Make X strokes dry and tiny. The chord accents should pop out without interrupting the wrist.",
    bpm: 104, subdivision: "Sixteenth notes", pattern: ["D!", "X", "U", "X", "D", "X", "U!", "X", "D!", "X", "U", "X", "D", "U!", "X", "U"]
  },

  {
    id: "pick-single-string", technique: "plectrum", difficulty: "beginner",
    title: "Single-string alternate", focus: "Down-up consistency",
    coaching: "Expose only a few millimetres of pick and let it glide across the fourth string.",
    bpm: 70, subdivision: "Eighth notes", pattern: ["4D!", "4U", "4D", "4U", "4D!", "4U", "4D", "4U"]
  },
  {
    id: "pick-two-string", technique: "plectrum", difficulty: "beginner",
    title: "Two-string shuttle", focus: "Simple string crossing",
    coaching: "Move from the wrist and aim for the space between strings three and four.",
    bpm: 64, subdivision: "Eighth notes", pattern: ["4D!", "4U", "3D", "3U", "4D!", "4U", "3D", "3U"]
  },
  {
    id: "pick-descending", technique: "plectrum", difficulty: "beginner",
    title: "Six-to-one descent", focus: "One clean stroke per string",
    coaching: "Pause the pick just beyond each string. Accuracy matters more than volume.",
    bpm: 60, subdivision: "Quarter notes", pattern: ["6D!", "5D", "4D", "3D", "2D", "1D"]
  },
  {
    id: "pick-rest-stroke", technique: "plectrum", difficulty: "beginner",
    title: "Pick and breathe", focus: "Timing with rests",
    coaching: "Stop the sound cleanly on the dots without tensing the picking hand.",
    bpm: 68, subdivision: "Eighth notes", pattern: ["5D!", "·", "5U", "·", "4D!", "·", "4U", "·"]
  },
  {
    id: "pick-inside-out", technique: "plectrum", difficulty: "intermediate",
    title: "Inside / outside crossing", focus: "Changing escape direction",
    coaching: "Notice which crossings trap the pick. Use a shallow stroke and the smallest useful motion.",
    bpm: 82, subdivision: "Eighth notes", pattern: ["4D!", "3U", "4D", "3U", "3D!", "4U", "3D", "4U"]
  },
  {
    id: "pick-string-skip", technique: "plectrum", difficulty: "intermediate",
    title: "String-skip ladder", focus: "Crossing over one string",
    coaching: "Track the target string with a small forearm shift; keep the pick stroke itself compact.",
    bpm: 76, subdivision: "Eighth notes", pattern: ["6D!", "4U", "5D", "3U", "4D!", "2U", "3D", "1U"]
  },
  {
    id: "pick-triplet-roll", technique: "plectrum", difficulty: "intermediate",
    title: "Three-string triplet roll", focus: "Alternate picking across groups of three",
    coaching: "Accent the first note of each triplet so the rhythmic grouping stays audible.",
    bpm: 74, subdivision: "Triplets", pattern: ["5D!", "4U", "3D", "5U!", "4D", "3U", "5D!", "4U", "3D", "5U!", "4D", "3U"]
  },
  {
    id: "pick-pedal-tone", technique: "plectrum", difficulty: "intermediate",
    title: "Pedal-tone weave", focus: "Return to one anchor string",
    coaching: "Let string five feel like home. Keep the travelling strokes the same size.",
    bpm: 86, subdivision: "Sixteenth notes", pattern: ["5D!", "4U", "5D", "3U", "5D!", "2U", "5D", "1U"]
  },
  {
    id: "pick-burst", technique: "plectrum", difficulty: "expert",
    title: "Sixteenth-note bursts", focus: "Fast motion with deliberate resets",
    coaching: "Play each four-note burst with one relaxed gesture, then completely release tension on the rest.",
    bpm: 112, subdivision: "Sixteenth notes", pattern: ["3D!", "3U", "3D", "3U", "·", "·", "·", "·", "2D!", "2U", "2D", "2U", "·", "·", "·", "·"]
  },
  {
    id: "pick-crosspicking", technique: "plectrum", difficulty: "expert",
    title: "Crosspicking loop", focus: "Rolling alternate pattern",
    coaching: "Use a gentle curved pick path so every string change clears cleanly at speed.",
    bpm: 108, subdivision: "Sixteenth notes", pattern: ["4D!", "3U", "2D", "3U", "4D", "3U", "2D!", "3U", "2D", "3U", "4D", "3U", "2D!", "3U", "4D", "3U"]
  },

  {
    id: "finger-thumb", technique: "fingerpicking", difficulty: "beginner",
    title: "Steady thumb", focus: "Bass-string control",
    coaching: "Rest the fingers lightly near the top strings and move the thumb from its base joint.",
    bpm: 64, subdivision: "Quarter notes", pattern: ["P6!", "P5", "P4", "P5"]
  },
  {
    id: "finger-pima", technique: "fingerpicking", difficulty: "beginner",
    title: "P–i–m–a staircase", focus: "Assign one finger per string",
    coaching: "Thumb plays the bass; index, middle, and ring own strings three, two, and one.",
    bpm: 60, subdivision: "Eighth notes", pattern: ["P5!", "i3", "m2", "a1", "P5!", "i3", "m2", "a1"]
  },
  {
    id: "finger-pinches", technique: "fingerpicking", difficulty: "beginner",
    title: "Bass and treble pinches", focus: "Simultaneous attacks",
    coaching: "Bring thumb and fingers gently toward the palm at the same time; do not yank upward.",
    bpm: 58, subdivision: "Quarter notes", pattern: ["P6+ima!", "·", "P5+im", "·", "P4+ima!", "·", "P5+im", "·"]
  },
  {
    id: "finger-broken-chord", technique: "fingerpicking", difficulty: "beginner",
    title: "Open broken chord", focus: "Even four-note arpeggio",
    coaching: "Prepare the next fingertip on its string before it is due.",
    bpm: 66, subdivision: "Eighth notes", pattern: ["P5!", "i3", "m2", "a1", "m2", "i3", "P4", "i3"]
  },
  {
    id: "finger-travis", technique: "fingerpicking", difficulty: "intermediate",
    title: "Travis-picking core", focus: "Alternating bass under melody",
    coaching: "Make the thumb automatic and quieter than the melody fingers.",
    bpm: 78, subdivision: "Eighth notes", pattern: ["P6!", "m2", "P4", "i3", "P6!", "m2", "P4", "i3"]
  },
  {
    id: "finger-inside-out", technique: "fingerpicking", difficulty: "intermediate",
    title: "Inside-out arpeggio", focus: "Finger independence",
    coaching: "Keep unused fingers hovering close to their strings instead of lifting away.",
    bpm: 74, subdivision: "Eighth notes", pattern: ["P5!", "m2", "i3", "a1", "P4!", "m2", "i3", "a1"]
  },
  {
    id: "finger-rolling-six", technique: "fingerpicking", difficulty: "intermediate",
    title: "Six-note rolling pattern", focus: "Flowing compound meter",
    coaching: "Feel two large pulses per bar, each containing three evenly spaced notes.",
    bpm: 72, subdivision: "Triplets", pattern: ["P6!", "i3", "m2", "a1", "m2", "i3", "P4!", "i3", "m2", "a1", "m2", "i3"]
  },
  {
    id: "finger-syncopated-pinch", technique: "fingerpicking", difficulty: "intermediate",
    title: "Syncopated pinch", focus: "Offbeat melody accents",
    coaching: "Keep the thumb on the beat while the pinches lean into the spaces between beats.",
    bpm: 80, subdivision: "Eighth notes", pattern: ["P6!", "im2+3", "P4", "·", "P6!", "im2+3", "P4", "a1"]
  },
  {
    id: "finger-thumb-independence", technique: "fingerpicking", difficulty: "expert",
    title: "Thumb independence grid", focus: "Bass ostinato with displaced melody",
    coaching: "Lock the thumb to the pulse. Treat the upper voice like a separate musician.",
    bpm: 94, subdivision: "Sixteenth notes", pattern: ["P6!", "·", "i3", "P4", "·", "m2!", "P6", "·", "a1!", "P4", "·", "i3", "P6", "m2!", "P4", "·"]
  },
  {
    id: "finger-cascade", technique: "fingerpicking", difficulty: "expert",
    title: "P–i–m–a cascade", focus: "Fast rolling independence",
    coaching: "Plant each group lightly, release in sequence, and keep the hand shape unchanged.",
    bpm: 108, subdivision: "Sixteenth notes", pattern: ["P6!", "i3", "m2", "a1", "P5", "i3", "m2", "a1", "P4!", "i3", "m2", "a1", "P5", "i3", "m2", "a1"]
  }
];
