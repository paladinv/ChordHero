import { Chord } from "../components/ChordDiagram";

export type Level = {
  name: string;
  description: string;
  chords: Chord[];
};

export type DifficultyTag =
  | "beginner"
  | "barre"
  | "stretch"
  | "fast-change friendly"
  | "partial"
  | "color tone";

export type HarmonicRole = "I" | "ii" | "iii" | "IV" | "V" | "vi";

export type FunctionContext = {
  key: string;
  roles: HarmonicRole[];
  label: string;
};

export type NearbyAlternative = {
  label: string;
  type: "easier" | "capo" | "partial" | "color";
  description: string;
  targetId?: string;
};

export type ChordLibraryItem = {
  id: string;
  root: string;
  quality: string;
  qualityLabel: string;
  inversion: "standard" | "inverted";
  position: string;
  chord: Chord;
  difficultyTags: DifficultyTag[];
  summary: string;
  recommendedVariant: string;
  alternateFingerings: string[];
  functionContexts: FunctionContext[];
  mutingNotes: string[];
  avoidStrings: string[];
  nearbyAlternatives: NearbyAlternative[];
  practiceFocus: string;
};

export type ProgressionPack = {
  id: string;
  title: string;
  description: string;
  keyCenter: string;
  focus: string;
  chordIds: string[];
  progression: string[];
  rightHandPattern: string;
};

const makeContexts = (
  ...contexts: Array<[key: string, roles: HarmonicRole[], label: string]>
): FunctionContext[] => contexts.map(([key, roles, label]) => ({ key, roles, label }));

const makeChord = (chord: Chord): Chord => chord;

const CHORD_LIBRARY_ITEMS: ChordLibraryItem[] = [
  {
    id: "c-major-open",
    root: "C",
    quality: "major",
    qualityLabel: "Major",
    inversion: "standard",
    position: "Open shape",
    chord: makeChord({
      name: "C",
      frets: [-1, 3, 2, 0, 1, 0],
      fingers: [null, 3, 2, null, 1, null]
    }),
    difficultyTags: ["beginner", "fast-change friendly"],
    summary: "The campfire C shape with a warm open top end and easy access to nearby open chords.",
    recommendedVariant: "Use ring on A3, middle on D2, index on B1, with the high E left open.",
    alternateFingerings: [
      "Standard: 3-2-1 across A, D, and B strings.",
      "Keep the ring finger planted when moving between C and Am for cleaner changes."
    ],
    functionContexts: makeContexts(
      ["C", ["I"], "Home chord in the key of C."],
      ["G", ["IV"], "One of the most common support chords in key of G."]
    ),
    mutingNotes: ["Let the low E stay muted by your ring finger edge or avoid striking it."],
    avoidStrings: ["Avoid the low E string unless you intentionally want a C/E color."],
    nearbyAlternatives: [
      {
        label: "Cadd9",
        type: "color",
        description: "Swap the B1 finger to B3 for a brighter open color.",
        targetId: "c-add9-open"
      },
      {
        label: "C/G",
        type: "partial",
        description: "Add low G in the bass when you want a fuller root-and-fifth sound.",
        targetId: "c-over-g"
      },
      {
        label: "Capo-friendly G shape",
        type: "capo",
        description: "Capo 5 and play a G-family progression if you want more open resonance."
      }
    ],
    practiceFocus: "Train the ring finger pivot so C, Am, and F transitions stay relaxed."
  },
  {
    id: "c-major-barre",
    root: "C",
    quality: "major",
    qualityLabel: "Major",
    inversion: "standard",
    position: "A-shape barre",
    chord: makeChord({
      name: "C",
      frets: [-1, 3, 5, 5, 5, 3],
      barre: { fret: 3, from: 1, to: 5 },
      fingers: [null, 1, 3, 4, 4, 1]
    }),
    difficultyTags: ["barre", "stretch"],
    summary: "A tighter A-shape voicing that keeps the chord compact and balanced across the middle strings.",
    recommendedVariant: "Barre the A to high E strings at fret 3 with index, then stack ring or pinky across D/G/B at fret 5.",
    alternateFingerings: [
      "Single-finger mini-barre across D/G/B at fret 5 for quicker rhythm playing.",
      "Use ring on D/G/B separately if the mini-barre feels tense."
    ],
    functionContexts: makeContexts(
      ["C", ["I"], "A strong closed-position tonic in key of C."],
      ["G", ["IV"], "Great when you need a punchier IV in the key of G."]
    ),
    mutingNotes: ["Keep the low E muted so the voicing stays focused on the A-shape root."],
    avoidStrings: ["Avoid the low E unless you intentionally want a C/G-type extension."],
    nearbyAlternatives: [
      {
        label: "Open C",
        type: "easier",
        description: "Use the open shape when you want the same harmony with less hand tension.",
        targetId: "c-major-open"
      }
    ],
    practiceFocus: "Release the mini-barre pressure between strums so the fretting hand does not lock up."
  },
  {
    id: "c-add9-open",
    root: "C",
    quality: "add9",
    qualityLabel: "Add 9",
    inversion: "standard",
    position: "Open color tone",
    chord: makeChord({
      name: "Cadd9",
      frets: [-1, 3, 2, 0, 3, 0],
      fingers: [null, 2, 1, null, 3, null]
    }),
    difficultyTags: ["beginner", "color tone", "fast-change friendly"],
    summary: "A brighter, modern C voicing that keeps the top strings singing.",
    recommendedVariant: "Use index on D2, middle on A3, ring on B3 and let G and high E stay open.",
    alternateFingerings: [
      "Keep ring finger ready on B3 so you can move between G and Cadd9 with minimal motion."
    ],
    functionContexts: makeContexts(["C", ["I"], "A color-rich tonic option in the key of C."]),
    mutingNotes: ["Lightly touch the low E with the middle finger edge if needed."],
    avoidStrings: ["Avoid the low E to keep the add9 shimmer clean."],
    nearbyAlternatives: [
      {
        label: "Open C",
        type: "easier",
        description: "Drop back to plain C when the extra melody note is too exposed.",
        targetId: "c-major-open"
      }
    ],
    practiceFocus: "Use it in slow progressions to hear how the 9th changes the emotional color."
  },
  {
    id: "c-major7-open",
    root: "C",
    quality: "major7",
    qualityLabel: "Major 7",
    inversion: "standard",
    position: "Open shape",
    chord: makeChord({
      name: "Cmaj7",
      frets: [-1, 3, 2, 0, 0, 0],
      fingers: [null, 3, 2, null, null, null]
    }),
    difficultyTags: ["beginner", "color tone", "fast-change friendly"],
    summary: "A softer, jazzier C flavor that leaves the top three strings floating open.",
    recommendedVariant: "Use only ring on A3 and middle on D2, then let the upper strings ring freely.",
    alternateFingerings: ["Keep the hand close to an open C so you can alternate between C and Cmaj7 rhythmically."],
    functionContexts: makeContexts(["C", ["I"], "A mellow tonic color in the key of C."]),
    mutingNotes: ["Let the ring finger edge mute low E if your strum swings wide."],
    avoidStrings: ["Avoid the low E for the cleanest major-7 color."],
    nearbyAlternatives: [
      {
        label: "Open C",
        type: "easier",
        description: "Resolve back to C when you want a more grounded tonic sound.",
        targetId: "c-major-open"
      }
    ],
    practiceFocus: "Listen to how the open B changes the mood compared to a plain C chord."
  },
  {
    id: "c-minor-barre",
    root: "C",
    quality: "minor",
    qualityLabel: "Minor",
    inversion: "standard",
    position: "A-shape barre",
    chord: makeChord({
      name: "Cm",
      frets: [-1, 3, 5, 5, 4, 3],
      barre: { fret: 3, from: 1, to: 5 },
      fingers: [null, 1, 3, 4, 2, 1]
    }),
    difficultyTags: ["barre", "stretch"],
    summary: "The classic movable minor A-shape with a compact, slightly darker midrange.",
    recommendedVariant: "Use index barre at fret 3, ring and pinky on D/G5, and middle on B4.",
    alternateFingerings: ["Mini-barre D/G with ring and use pinky only on G if the full grip feels cramped."],
    functionContexts: makeContexts(["Bb", ["ii"], "A useful minor ii color in the key of Bb."]),
    mutingNotes: ["Mute the low E cleanly so the minor shape stays centered."],
    avoidStrings: ["Avoid the low E string unless you intentionally want a Cm/G sound."],
    nearbyAlternatives: [
      {
        label: "Capo at 3 with Am shapes",
        type: "capo",
        description: "If the barre is too heavy, capo 3 and think in an A-minor family."
      }
    ],
    practiceFocus: "Relax the index knuckle and build the grip from the middle strings outward."
  },
  {
    id: "c-dominant7-open",
    root: "C",
    quality: "dominant7",
    qualityLabel: "Dominant 7",
    inversion: "standard",
    position: "Open shape",
    chord: makeChord({
      name: "C7",
      frets: [-1, 3, 2, 3, 1, 0],
      fingers: [null, 3, 2, 4, 1, null]
    }),
    difficultyTags: ["beginner", "color tone"],
    summary: "A bluesier C sound that wants to pull forward into F or Fmaj7.",
    recommendedVariant: "Keep the C major hand, then add the pinky to G3 for the dominant color.",
    alternateFingerings: ["Use the pinky for G3 so the basic C shape remains intact underneath."],
    functionContexts: makeContexts(["F", ["V"], "A strong dominant chord in the key of F."]),
    mutingNotes: ["The low E should still stay muted to keep the bass centered on C."],
    avoidStrings: ["Avoid the low E string."],
    nearbyAlternatives: [
      {
        label: "C major",
        type: "easier",
        description: "Remove the pinky to simplify the grip and lose the dominant tension.",
        targetId: "c-major-open"
      }
    ],
    practiceFocus: "Hear how the Bb note wants to resolve when you move into an F-family chord."
  },
  {
    id: "c-over-g",
    root: "C",
    quality: "major",
    qualityLabel: "Major",
    inversion: "inverted",
    position: "2nd inversion",
    chord: makeChord({
      name: "C/G",
      frets: [3, 3, 2, 0, 1, 0],
      fingers: [3, 2, 1, null, 1, null]
    }),
    difficultyTags: ["stretch", "fast-change friendly"],
    summary: "A wider C sound with a strong low G bass that helps connect bass lines in key of G or C.",
    recommendedVariant: "Use ring on low E3, middle on A3, index on D2 and B1, with G and high E open.",
    alternateFingerings: ["Use pinky on low E3 if you want ring finger free for neighboring shapes."],
    functionContexts: makeContexts(
      ["C", ["I"], "A second-inversion tonic that still feels settled."],
      ["G", ["IV"], "Great for bass movement inside the key of G."]
    ),
    mutingNotes: ["Make sure the low E rings cleanly while the D string stays clear."],
    avoidStrings: ["Do not mute the low E here; the bass G is the point of the voicing."],
    nearbyAlternatives: [
      {
        label: "Open C",
        type: "easier",
        description: "Drop the low G if the bass stretch makes the change too slow.",
        targetId: "c-major-open"
      }
    ],
    practiceFocus: "Practice moving between G, C/G, and Em to hear smooth bass-line motion."
  },
  {
    id: "d-major-open",
    root: "D",
    quality: "major",
    qualityLabel: "Major",
    inversion: "standard",
    position: "Open shape",
    chord: makeChord({
      name: "D",
      frets: [-1, -1, 0, 2, 3, 2],
      fingers: [null, null, null, 1, 3, 2]
    }),
    difficultyTags: ["beginner", "fast-change friendly"],
    summary: "The tight triangle D shape that cuts through clearly on the top four strings.",
    recommendedVariant: "Index on G2, ring on B3, middle on high E2, leaving D open.",
    alternateFingerings: ["Some players use middle on G2 and index on high E2; keep whichever version stays compact."],
    functionContexts: makeContexts(
      ["G", ["V"], "The primary dominant in the key of G."],
      ["D", ["I"], "Home chord in the key of D."]
    ),
    mutingNotes: ["Mute low E and A with the fretting hand edge or a tighter right-hand strum."],
    avoidStrings: ["Avoid the low E and A strings."],
    nearbyAlternatives: [
      {
        label: "Dsus4",
        type: "color",
        description: "Lift the high E finger to add a suspended top note.",
        targetId: "d-sus4-open"
      }
    ],
    practiceFocus: "Lift and land all three fingers as one unit to speed up G-to-D changes."
  },
  {
    id: "d-sus4-open",
    root: "D",
    quality: "sus4",
    qualityLabel: "Suspended 4",
    inversion: "standard",
    position: "Open suspension",
    chord: makeChord({
      name: "Dsus4",
      frets: [-1, -1, 0, 2, 3, 3],
      fingers: [null, null, null, 1, 2, 3]
    }),
    difficultyTags: ["beginner", "color tone", "fast-change friendly"],
    summary: "A dramatic suspended D that resolves beautifully back into open D.",
    recommendedVariant: "Use three fingers in a row on G2, B3, and high E3 for the cleanest stretch.",
    alternateFingerings: ["Keep the G2 finger anchored and move only the top two fingers if you are alternating with D."],
    functionContexts: makeContexts(["G", ["V"], "A suspended dominant in the key of G."]),
    mutingNotes: ["Keep the low strings silent to let the upper suspension speak clearly."],
    avoidStrings: ["Avoid the low E and A strings."],
    nearbyAlternatives: [
      {
        label: "Open D",
        type: "easier",
        description: "Resolve the suspension by moving the high string from fret 3 back to fret 2.",
        targetId: "d-major-open"
      }
    ],
    practiceFocus: "Alternate two beats of Dsus4 with two beats of D to hear the release."
  },
  {
    id: "d-minor-open",
    root: "D",
    quality: "minor",
    qualityLabel: "Minor",
    inversion: "standard",
    position: "Open shape",
    chord: makeChord({
      name: "Dm",
      frets: [-1, -1, 0, 2, 3, 1],
      fingers: [null, null, null, 2, 3, 1]
    }),
    difficultyTags: ["beginner"],
    summary: "A compact minor shape with a dramatic top-string change from open D major.",
    recommendedVariant: "Middle on G2, ring on B3, index on high E1.",
    alternateFingerings: ["Land the index on E1 first, then drop the other two fingers together to avoid buzzing."],
    functionContexts: makeContexts(["C", ["ii"], "The classic ii chord in the key of C."]),
    mutingNotes: ["Stay on the top four strings so the minor color stays clear."],
    avoidStrings: ["Avoid the low E and A strings."],
    nearbyAlternatives: [
      {
        label: "Dm7",
        type: "easier",
        description: "Release the ring finger to soften the sound and reduce hand tension.",
        targetId: "d-minor7-open"
      }
    ],
    practiceFocus: "Use light pressure on the E1 note so the index finger does not collapse."
  },
  {
    id: "d-dominant7-open",
    root: "D",
    quality: "dominant7",
    qualityLabel: "Dominant 7",
    inversion: "standard",
    position: "Open shape",
    chord: makeChord({
      name: "D7",
      frets: [-1, -1, 0, 2, 1, 2],
      fingers: [null, null, null, 2, 1, 3]
    }),
    difficultyTags: ["beginner", "color tone"],
    summary: "A leaner dominant D shape that naturally pushes toward G.",
    recommendedVariant: "Use index on B1, middle on G2, ring on high E2.",
    alternateFingerings: ["Keep the D-shape triangle small so the B1 finger does not flatten."],
    functionContexts: makeContexts(["G", ["V"], "A classic V7 in the key of G."]),
    mutingNotes: ["Use a short strum to stay on the top four strings."],
    avoidStrings: ["Avoid the low E and A strings."],
    nearbyAlternatives: [
      {
        label: "Open D",
        type: "easier",
        description: "Use plain D when you want less harmonic tension.",
        targetId: "d-major-open"
      }
    ],
    practiceFocus: "Notice how the C note on B1 increases the pull into G."
  },
  {
    id: "d-minor7-open",
    root: "D",
    quality: "minor7",
    qualityLabel: "Minor 7",
    inversion: "standard",
    position: "Open shape",
    chord: makeChord({
      name: "Dm7",
      frets: [-1, -1, 0, 2, 1, 1],
      fingers: [null, null, null, 2, 1, 1]
    }),
    difficultyTags: ["beginner", "fast-change friendly"],
    summary: "A softer, easier D minor variant with a mini-barre on the top two strings.",
    recommendedVariant: "Use index mini-barre on B1 and high E1 with middle on G2.",
    alternateFingerings: ["Roll the index slightly toward the thumb side so both top strings ring."],
    functionContexts: makeContexts(["C", ["ii"], "A smooth ii color in the key of C."]),
    mutingNotes: ["Keep the right hand light so the low strings stay quiet."],
    avoidStrings: ["Avoid the low E and A strings."],
    nearbyAlternatives: [
      {
        label: "Dm",
        type: "color",
        description: "Add the ring finger back on B3 for a stronger pure minor sound.",
        targetId: "d-minor-open"
      }
    ],
    practiceFocus: "This is a good stepping-stone shape before tackling more crowded minor voicings."
  },
  {
    id: "d-over-fsharp",
    root: "D",
    quality: "major",
    qualityLabel: "Major",
    inversion: "inverted",
    position: "1st inversion",
    chord: makeChord({
      name: "D/F#",
      frets: [2, 0, 0, 2, 3, 2],
      fingers: [2, null, null, 1, 4, 3]
    }),
    difficultyTags: ["stretch", "fast-change friendly"],
    summary: "A bass-led inversion that helps connect G and Em progressions smoothly.",
    recommendedVariant: "Thumb or middle on low E2, index on G2, ring on high E2, pinky on B3.",
    alternateFingerings: [
      "Use the thumb on low E2 if it helps you keep the upper D shape more relaxed."
    ],
    functionContexts: makeContexts(["G", ["V"], "A dominant chord in the key of G with a walking bass."]),
    mutingNotes: ["Let the open A stay muted by your strum path; it does not belong in this voicing."],
    avoidStrings: ["Avoid the A string."],
    nearbyAlternatives: [
      {
        label: "Open D",
        type: "easier",
        description: "Skip the bass F# if the full stretch slows down the progression.",
        targetId: "d-major-open"
      }
    ],
    practiceFocus: "Use it between G and Em to hear the bass line move one step at a time."
  },
  {
    id: "e-major-open",
    root: "E",
    quality: "major",
    qualityLabel: "Major",
    inversion: "standard",
    position: "Open shape",
    chord: makeChord({
      name: "E",
      frets: [0, 2, 2, 1, 0, 0],
      fingers: [null, 2, 3, 1, null, null]
    }),
    difficultyTags: ["beginner", "fast-change friendly"],
    summary: "A full open E chord with strong bass support and lots of sympathetic resonance.",
    recommendedVariant: "Middle on A2, ring on D2, index on G1.",
    alternateFingerings: ["Keep the middle and ring close to the strings so Em-to-E changes stay quick."],
    functionContexts: makeContexts(
      ["E", ["I"], "Home chord in the key of E."],
      ["A", ["V"], "A strong dominant in key of A."]
    ),
    mutingNotes: ["All six strings can ring if each fretted note stays arched."],
    avoidStrings: ["No avoid notes here; focus on keeping the G string clear."],
    nearbyAlternatives: [
      {
        label: "E7",
        type: "color",
        description: "Lift the D-string finger for a looser dominant flavor.",
        targetId: "e-dominant7-open"
      }
    ],
    practiceFocus: "Switch between Em and E to train minimal movement in the fretting hand."
  },
  {
    id: "e-minor-open",
    root: "E",
    quality: "minor",
    qualityLabel: "Minor",
    inversion: "standard",
    position: "Open shape",
    chord: makeChord({
      name: "Em",
      frets: [0, 2, 2, 0, 0, 0],
      fingers: [null, 2, 3, null, null, null]
    }),
    difficultyTags: ["beginner", "fast-change friendly"],
    summary: "One of the easiest shapes on guitar, with a dark but open sound across all six strings.",
    recommendedVariant: "Middle on A2 and ring on D2, letting everything else ring.",
    alternateFingerings: ["Use index and middle if that makes the chord-to-E change cleaner for you."],
    functionContexts: makeContexts(
      ["G", ["vi"], "The relative minor in the key of G."],
      ["D", ["ii"], "A common ii chord in the key of D."]
    ),
    mutingNotes: ["All six strings may ring, but the B string still needs open-string clarity."],
    avoidStrings: ["No avoid notes; just keep the hand relaxed."],
    nearbyAlternatives: [
      {
        label: "Em7",
        type: "easier",
        description: "Lift the D-string finger to get an even lighter, more open variation.",
        targetId: "e-minor7-open"
      },
      {
        label: "Em/B",
        type: "partial",
        description: "Use the inversion when you want a walking bass line under the same harmony.",
        targetId: "em-over-b"
      }
    ],
    practiceFocus: "Let the arm weight do the work instead of squeezing the two fretted notes."
  },
  {
    id: "e-dominant7-open",
    root: "E",
    quality: "dominant7",
    qualityLabel: "Dominant 7",
    inversion: "standard",
    position: "Open shape",
    chord: makeChord({
      name: "E7",
      frets: [0, 2, 0, 1, 0, 0],
      fingers: [null, 2, null, 1, null, null]
    }),
    difficultyTags: ["beginner", "color tone"],
    summary: "A spicy open E sound that resolves naturally into A-family chords.",
    recommendedVariant: "Use middle on A2 and index on G1, letting the open D add the seventh.",
    alternateFingerings: ["Think of it as E major with the D-string finger removed."],
    functionContexts: makeContexts(["A", ["V"], "A classic V7 in the key of A."]),
    mutingNotes: ["Let all strings ring, but keep the G1 finger curved enough to free the open D."],
    avoidStrings: ["No avoid notes; the open strings are part of the color."],
    nearbyAlternatives: [
      {
        label: "E major",
        type: "easier",
        description: "Add the D-string finger back if the seventh sounds too exposed.",
        targetId: "e-major-open"
      }
    ],
    practiceFocus: "Use short strums and hear how the open D creates more urgency."
  },
  {
    id: "e-minor7-open",
    root: "E",
    quality: "minor7",
    qualityLabel: "Minor 7",
    inversion: "standard",
    position: "Open shape",
    chord: makeChord({
      name: "Em7",
      frets: [0, 2, 0, 0, 0, 0],
      fingers: [null, 1, null, null, null, null]
    }),
    difficultyTags: ["beginner", "fast-change friendly", "color tone"],
    summary: "A one-finger Em flavor that works beautifully in folk and singer-songwriter progressions.",
    recommendedVariant: "Use index or middle on A2 and keep the rest completely open.",
    alternateFingerings: ["Use middle if you want to move to C more cleanly; use index if you want to pivot into A7 shapes."],
    functionContexts: makeContexts(["G", ["vi"], "A softer relative-minor color in key of G."]),
    mutingNotes: ["All strings can ring; focus on open-string balance rather than force."],
    avoidStrings: ["No avoid notes here."],
    nearbyAlternatives: [
      {
        label: "Em major body",
        type: "color",
        description: "Add D2 back in for a fuller Em sound.",
        targetId: "e-minor-open"
      }
    ],
    practiceFocus: "Use this when you need speed and openness more than a dense minor sound."
  },
  {
    id: "em-over-b",
    root: "E",
    quality: "minor",
    qualityLabel: "Minor",
    inversion: "inverted",
    position: "2nd inversion",
    chord: makeChord({
      name: "Em/B",
      frets: [-1, 2, 2, 0, 0, 0],
      fingers: [null, 1, 2, null, null, null]
    }),
    difficultyTags: ["beginner", "fast-change friendly"],
    summary: "An Em voicing with the fifth in the bass, useful for soft bass movement in G and D progressions.",
    recommendedVariant: "Use index on A2 and middle on D2, then let the top three strings ring.",
    alternateFingerings: ["Use middle and ring if it sets up your next chord more comfortably."],
    functionContexts: makeContexts(
      ["G", ["vi"], "Still functions as vi in key of G, with a more active bass note."],
      ["D", ["ii"], "A gentler ii color in the key of D."]
    ),
    mutingNotes: ["Mute the low E so the B bass note remains the lowest pitch."],
    avoidStrings: ["Avoid the low E string."],
    nearbyAlternatives: [
      {
        label: "Open Em",
        type: "easier",
        description: "Use the full open version when you want the root back in the bass.",
        targetId: "e-minor-open"
      }
    ],
    practiceFocus: "Great for hearing bass movement without changing the upper chord color too much."
  },
  {
    id: "f-major-barre",
    root: "F",
    quality: "major",
    qualityLabel: "Major",
    inversion: "standard",
    position: "E-shape barre",
    chord: makeChord({
      name: "F",
      frets: [1, 3, 3, 2, 1, 1],
      barre: { fret: 1, from: 0, to: 5 },
      fingers: [1, 3, 4, 2, 1, 1]
    }),
    difficultyTags: ["barre", "stretch"],
    summary: "The full E-shape barre that strengthens the index finger and unlocks movable major chords.",
    recommendedVariant: "Index barring fret 1, middle on G2, ring on A3, pinky on D3.",
    alternateFingerings: [
      "Use a partial mini-barre first on B and high E, then add the bass strings once the top rings cleanly."
    ],
    functionContexts: makeContexts(
      ["C", ["IV"], "The classic IV chord in the key of C."],
      ["F", ["I"], "Home chord in the key of F."]
    ),
    mutingNotes: ["Roll the index slightly toward the thumb side to clear the top strings."],
    avoidStrings: ["No avoid strings, but watch that the A and D notes do not overpower the top half."],
    nearbyAlternatives: [
      {
        label: "Fmaj7",
        type: "easier",
        description: "Use the open major-7 version when the full barre is still too demanding.",
        targetId: "f-major7-open"
      },
      {
        label: "Capo 1 with E shapes",
        type: "capo",
        description: "Capo 1 and play E-family chords if you need the harmony without the full barre."
      }
    ],
    practiceFocus: "Build the chord from the top strings down before asking the low strings to ring."
  },
  {
    id: "f-major7-open",
    root: "F",
    quality: "major7",
    qualityLabel: "Major 7",
    inversion: "standard",
    position: "Open shape",
    chord: makeChord({
      name: "Fmaj7",
      frets: [-1, -1, 3, 2, 1, 0],
      fingers: [null, null, 3, 2, 1, null]
    }),
    difficultyTags: ["beginner", "color tone", "partial"],
    summary: "An easier F-family color that keeps the delicate top-string openness of the key of C.",
    recommendedVariant: "Ring on D3, middle on G2, index on B1, high E open.",
    alternateFingerings: ["Treat it like a partial F and keep the strum focused on the top four strings."],
    functionContexts: makeContexts(["C", ["IV"], "A lighter IV sound in the key of C."]),
    mutingNotes: ["Avoid the low two strings unless you specifically want a thicker arrangement."],
    avoidStrings: ["Avoid low E and A strings."],
    nearbyAlternatives: [
      {
        label: "Full F barre",
        type: "color",
        description: "Move to the full F when you need more weight and root support.",
        targetId: "f-major-barre"
      },
      {
        label: "F/A",
        type: "partial",
        description: "Use the inversion to keep the bass line moving up gently.",
        targetId: "f-over-a"
      }
    ],
    practiceFocus: "Use it as an on-ramp to full F while keeping the harmony musical right away."
  },
  {
    id: "f-over-a",
    root: "F",
    quality: "major",
    qualityLabel: "Major",
    inversion: "inverted",
    position: "1st inversion",
    chord: makeChord({
      name: "F/A",
      frets: [-1, 0, 3, 2, 1, 1],
      fingers: [null, null, 4, 3, 1, 1]
    }),
    difficultyTags: ["partial", "stretch"],
    summary: "A gentler F-family inversion that keeps A in the bass for stepwise motion from G to C.",
    recommendedVariant: "Use ring or pinky on D3, middle on G2, and mini-barre B1/high E1 with the index.",
    alternateFingerings: ["Use ring on D3 and let the thumb stay relaxed behind the neck for the mini-barre."],
    functionContexts: makeContexts(["C", ["IV"], "An inverted IV chord that softens the bass movement in key of C."]),
    mutingNotes: ["Do not hit the low E string; keep the bass centered on the open A."],
    avoidStrings: ["Avoid the low E string."],
    nearbyAlternatives: [
      {
        label: "Fmaj7",
        type: "easier",
        description: "Stay on the top four strings if the mini-barre plus bass feels crowded.",
        targetId: "f-major7-open"
      }
    ],
    practiceFocus: "Try it between C and G/B to hear how inversions smooth out the bass line."
  },
  {
    id: "g-major-open",
    root: "G",
    quality: "major",
    qualityLabel: "Major",
    inversion: "standard",
    position: "Open shape",
    chord: makeChord({
      name: "G",
      frets: [3, 2, 0, 0, 0, 3],
      fingers: [3, 2, null, null, null, 4]
    }),
    difficultyTags: ["beginner", "fast-change friendly"],
    summary: "The open G anchor shape used in countless beginner and folk progressions.",
    recommendedVariant: "Ring on low E3, middle on A2, pinky on high E3, leaving the middle strings open.",
    alternateFingerings: [
      "Use middle on low E3 and ring on high E3 if that helps your move into Cadd9 or Gsus4."
    ],
    functionContexts: makeContexts(
      ["G", ["I"], "Home chord in the key of G."],
      ["C", ["V"], "A strong dominant in the key of C."]
    ),
    mutingNotes: ["Keep the B string open and alive; it often disappears when the hand over-squeezes."],
    avoidStrings: ["No avoid strings; focus on not muting the open middle strings."],
    nearbyAlternatives: [
      {
        label: "Gsus4",
        type: "color",
        description: "Add a suspended top note without losing the familiar bass.",
        targetId: "g-sus4-open"
      },
      {
        label: "G/B",
        type: "partial",
        description: "Use the inversion when you want the bass line to rise into C.",
        targetId: "g-over-b"
      }
    ],
    practiceFocus: "Keep ring and pinky hovering close so G-to-Cadd9 can happen with almost no reset."
  },
  {
    id: "g-major-barre",
    root: "G",
    quality: "major",
    qualityLabel: "Major",
    inversion: "standard",
    position: "E-shape barre",
    chord: makeChord({
      name: "G",
      frets: [3, 5, 5, 4, 3, 3],
      barre: { fret: 3, from: 0, to: 5 },
      fingers: [1, 3, 4, 2, 1, 1]
    }),
    difficultyTags: ["barre", "stretch"],
    summary: "A movable closed G that adds punch and consistency high enough to project clearly.",
    recommendedVariant: "Index barre at fret 3, middle on G4, ring on A5, pinky on D5.",
    alternateFingerings: ["Use ring mini-barre on A and D if that suits your hand better."],
    functionContexts: makeContexts(
      ["G", ["I"], "A closed-position tonic in key of G."],
      ["C", ["V"], "Strong dominant option in key of C."]
    ),
    mutingNotes: ["Check that the high strings ring cleanly under the index barre."],
    avoidStrings: ["No avoid strings, but balance the bass against the upper melody notes."],
    nearbyAlternatives: [
      {
        label: "Open G",
        type: "easier",
        description: "Use the open shape when you want the same harmony with less hand fatigue.",
        targetId: "g-major-open"
      }
    ],
    practiceFocus: "Treat this as practice for every movable major chord built from the E shape."
  },
  {
    id: "g-sus4-open",
    root: "G",
    quality: "sus4",
    qualityLabel: "Suspended 4",
    inversion: "standard",
    position: "Open suspension",
    chord: makeChord({
      name: "Gsus4",
      frets: [3, 2, 0, 0, 1, 3],
      fingers: [3, 2, null, null, 1, 4]
    }),
    difficultyTags: ["beginner", "color tone", "fast-change friendly"],
    summary: "A suspended G color that keeps the shape familiar while adding tension on the B string.",
    recommendedVariant: "Keep the basic G frame and add the index to B1 for the suspended note.",
    alternateFingerings: ["If you use index on A2 for G, move the middle to B1 so the hand stays relaxed."],
    functionContexts: makeContexts(["G", ["I"], "A suspended tonic color in the key of G."]),
    mutingNotes: ["Let the open G and D strings ring fully so the suspension has space around it."],
    avoidStrings: ["No avoid strings here."],
    nearbyAlternatives: [
      {
        label: "Open G",
        type: "easier",
        description: "Release B1 to return to the plain G sound.",
        targetId: "g-major-open"
      }
    ],
    practiceFocus: "Alternate Gsus4 and G for rhythmic tension-and-release drills."
  },
  {
    id: "g-minor-barre",
    root: "G",
    quality: "minor",
    qualityLabel: "Minor",
    inversion: "standard",
    position: "E-shape barre",
    chord: makeChord({
      name: "Gm",
      frets: [3, 5, 5, 3, 3, 3],
      barre: { fret: 3, from: 0, to: 5 },
      fingers: [1, 3, 4, 1, 1, 1]
    }),
    difficultyTags: ["barre", "stretch"],
    summary: "A full minor barre grip with a dark, even voice across the strings.",
    recommendedVariant: "Index full barre at fret 3, ring on A5, pinky on D5.",
    alternateFingerings: ["Keep the index slightly rolled so the G and B strings stay clean under the barre."],
    functionContexts: makeContexts(["F", ["ii"], "A useful ii chord color in the key of F."]),
    mutingNotes: ["Keep the middle of the index firm enough to clear the center strings."],
    avoidStrings: ["No avoid strings."],
    nearbyAlternatives: [
      {
        label: "Capo 3 with Em shapes",
        type: "capo",
        description: "Capo 3 and think from Em if you want the harmony with a friendlier hand shape."
      }
    ],
    practiceFocus: "Use short holds and releases to build endurance instead of squeezing for long periods."
  },
  {
    id: "g-dominant7-open",
    root: "G",
    quality: "dominant7",
    qualityLabel: "Dominant 7",
    inversion: "standard",
    position: "Open shape",
    chord: makeChord({
      name: "G7",
      frets: [3, 2, 0, 0, 0, 1],
      fingers: [3, 2, null, null, null, 1]
    }),
    difficultyTags: ["beginner", "color tone"],
    summary: "A bluesy G with top-string tension that wants to resolve into C.",
    recommendedVariant: "Use index on high E1, middle on A2, ring on low E3.",
    alternateFingerings: ["Keep the index close so it can hop cleanly between G7 and C shapes."],
    functionContexts: makeContexts(["C", ["V"], "A textbook dominant 7 in the key of C."]),
    mutingNotes: ["Make sure the high E1 is clear; it is the defining color note."],
    avoidStrings: ["No avoid strings."],
    nearbyAlternatives: [
      {
        label: "Open G",
        type: "easier",
        description: "Lift the high-string finger when you want a less tense G sonority.",
        targetId: "g-major-open"
      }
    ],
    practiceFocus: "Hear how the F note on the top string creates motion toward C."
  },
  {
    id: "g-over-b",
    root: "G",
    quality: "major",
    qualityLabel: "Major",
    inversion: "inverted",
    position: "1st inversion",
    chord: makeChord({
      name: "G/B",
      frets: [-1, 2, 0, 0, 0, 3],
      fingers: [null, 1, null, null, null, 3]
    }),
    difficultyTags: ["beginner", "fast-change friendly"],
    summary: "A light G inversion with B in the bass, ideal for walking into C chords smoothly.",
    recommendedVariant: "Index on A2 and ring or pinky on high E3.",
    alternateFingerings: ["Use middle on A2 if your ring finger wants to stay anchored for nearby chords."],
    functionContexts: makeContexts(
      ["G", ["I"], "Still functions as tonic in key of G, but with a more active bass."],
      ["C", ["V"], "A smoother dominant voice-leading option in key of C."]
    ),
    mutingNotes: ["Mute the low E so the B bass remains the bottom note."],
    avoidStrings: ["Avoid the low E string."],
    nearbyAlternatives: [
      {
        label: "Open G",
        type: "easier",
        description: "Return to the root-position bass if the inversion is not needed.",
        targetId: "g-major-open"
      }
    ],
    practiceFocus: "Use it in G-Bassline-C progressions and listen to the bass note carry the movement."
  },
  {
    id: "a-major-open",
    root: "A",
    quality: "major",
    qualityLabel: "Major",
    inversion: "standard",
    position: "Open shape",
    chord: makeChord({
      name: "A",
      frets: [-1, 0, 2, 2, 2, 0],
      fingers: [null, null, 1, 2, 3, null]
    }),
    difficultyTags: ["beginner", "fast-change friendly"],
    summary: "A compact three-finger shape that demands careful finger arching to keep the high E alive.",
    recommendedVariant: "Use index, middle, ring across D/G/B2 and let A and high E ring open.",
    alternateFingerings: ["Try one-finger mini-barre across D/G/B2 if your fingers crowd the fret space."],
    functionContexts: makeContexts(
      ["A", ["I"], "Home chord in the key of A."],
      ["E", ["IV"], "A common IV chord in the key of E."]
    ),
    mutingNotes: ["Mute the low E cleanly and keep the high E from getting trapped under the fretting hand."],
    avoidStrings: ["Avoid the low E string."],
    nearbyAlternatives: [
      {
        label: "Asus2",
        type: "color",
        description: "Release the B-string finger for a more open suspended sound.",
        targetId: "a-sus2-open"
      }
    ],
    practiceFocus: "Angle the wrist so all three fretting fingers can stack without flattening."
  },
  {
    id: "a-minor-open",
    root: "A",
    quality: "minor",
    qualityLabel: "Minor",
    inversion: "standard",
    position: "Open shape",
    chord: makeChord({
      name: "Am",
      frets: [-1, 0, 2, 2, 1, 0],
      fingers: [null, null, 2, 3, 1, null]
    }),
    difficultyTags: ["beginner", "fast-change friendly"],
    summary: "A warm open minor shape that shares a lot of muscle memory with C major.",
    recommendedVariant: "Middle on D2, ring on G2, index on B1.",
    alternateFingerings: ["Pivot from C by keeping the index on B1 whenever possible."],
    functionContexts: makeContexts(
      ["C", ["vi"], "The relative minor in the key of C."],
      ["G", ["ii"], "A common ii chord in the key of G."]
    ),
    mutingNotes: ["Keep the low E muted and let the open A define the bass."],
    avoidStrings: ["Avoid the low E string."],
    nearbyAlternatives: [
      {
        label: "Am7",
        type: "easier",
        description: "Lift the G-string finger for a softer, more open version.",
        targetId: "a-minor7-open"
      },
      {
        label: "Am/C",
        type: "partial",
        description: "Use the inversion when you want the bass line to step upward.",
        targetId: "am-over-c"
      }
    ],
    practiceFocus: "Keep it close to C major and train the shared index finger as a pivot point."
  },
  {
    id: "a-sus2-open",
    root: "A",
    quality: "sus2",
    qualityLabel: "Suspended 2",
    inversion: "standard",
    position: "Open suspension",
    chord: makeChord({
      name: "Asus2",
      frets: [-1, 0, 2, 2, 0, 0],
      fingers: [null, null, 1, 2, null, null]
    }),
    difficultyTags: ["beginner", "color tone", "fast-change friendly"],
    summary: "A breezy suspended A that works well in modern acoustic progressions.",
    recommendedVariant: "Use just two fingers on D2 and G2, leaving the top strings open.",
    alternateFingerings: ["Keep index and middle on the inner strings so you can drop into A quickly."],
    functionContexts: makeContexts(["A", ["I"], "A suspended tonic option in the key of A."]),
    mutingNotes: ["Keep the low E muted and let the top two strings stay open."],
    avoidStrings: ["Avoid the low E string."],
    nearbyAlternatives: [
      {
        label: "A major",
        type: "easier",
        description: "Add the B2 finger back when you want a more settled major sound.",
        targetId: "a-major-open"
      }
    ],
    practiceFocus: "Use it as a gentle color change without moving far from the A major frame."
  },
  {
    id: "a-minor7-open",
    root: "A",
    quality: "minor7",
    qualityLabel: "Minor 7",
    inversion: "standard",
    position: "Open shape",
    chord: makeChord({
      name: "Am7",
      frets: [-1, 0, 2, 0, 1, 0],
      fingers: [null, null, 2, null, 1, null]
    }),
    difficultyTags: ["beginner", "fast-change friendly", "color tone"],
    summary: "An airy two-finger Am variation that makes chord changes especially quick.",
    recommendedVariant: "Use middle on D2 and index on B1, with G and high E left open.",
    alternateFingerings: ["Try index on D2 and middle on B1 if that helps your transition into A7 or C."],
    functionContexts: makeContexts(
      ["C", ["vi"], "A softer relative-minor color in key of C."],
      ["G", ["ii"], "A gentle ii color in key of G."]
    ),
    mutingNotes: ["Keep the low E muted so the open A remains the bass."],
    avoidStrings: ["Avoid the low E string."],
    nearbyAlternatives: [
      {
        label: "Am",
        type: "color",
        description: "Add G2 back in for a fuller minor body.",
        targetId: "a-minor-open"
      }
    ],
    practiceFocus: "Ideal when you need speed more than density, especially in singer-songwriter progressions."
  },
  {
    id: "a-dominant7-open",
    root: "A",
    quality: "dominant7",
    qualityLabel: "Dominant 7",
    inversion: "standard",
    position: "Open shape",
    chord: makeChord({
      name: "A7",
      frets: [-1, 0, 2, 0, 2, 0],
      fingers: [null, null, 1, null, 2, null]
    }),
    difficultyTags: ["beginner", "color tone", "fast-change friendly"],
    summary: "A sparse dominant shape that resolves naturally into D-family chords.",
    recommendedVariant: "Index on D2 and middle on B2, leaving G and high E open.",
    alternateFingerings: ["Use middle and ring if your hand wants to stay aligned with A major."],
    functionContexts: makeContexts(["D", ["V"], "A standard V7 in the key of D."]),
    mutingNotes: ["Avoid brushing the low E and let the open G add the seventh color."],
    avoidStrings: ["Avoid the low E string."],
    nearbyAlternatives: [
      {
        label: "A major",
        type: "easier",
        description: "Return to the plain major shape when you want less dominant pull.",
        targetId: "a-major-open"
      }
    ],
    practiceFocus: "Listen to how the open G changes the chord’s urgency compared with A major."
  },
  {
    id: "am-over-c",
    root: "A",
    quality: "minor",
    qualityLabel: "Minor",
    inversion: "inverted",
    position: "1st inversion",
    chord: makeChord({
      name: "Am/C",
      frets: [-1, 3, 2, 2, 1, 0],
      fingers: [null, 4, 3, 2, 1, null]
    }),
    difficultyTags: ["stretch", "partial"],
    summary: "An inversion that keeps Am’s upper color while lifting the bass into C.",
    recommendedVariant: "Pinky on A3, ring on D2, middle on G2, index on B1.",
    alternateFingerings: ["Use ring on A3 if your pinky feels weak, but keep the wrist loose."],
    functionContexts: makeContexts(
      ["C", ["vi"], "Still functions as vi in C with a more melodic bass."],
      ["G", ["ii"], "A useful ii inversion in key of G."]
    ),
    mutingNotes: ["Keep the low E muted and let the C bass do the work."],
    avoidStrings: ["Avoid the low E string."],
    nearbyAlternatives: [
      {
        label: "Open Am",
        type: "easier",
        description: "Drop the bass C if the stretch slows down your changes.",
        targetId: "a-minor-open"
      }
    ],
    practiceFocus: "Use it when you want the bass to step from B to C to D without changing the upper melody too much."
  },
  {
    id: "bb-major-barre",
    root: "Bb",
    quality: "major",
    qualityLabel: "Major",
    inversion: "standard",
    position: "A-shape barre",
    chord: makeChord({
      name: "Bb",
      frets: [-1, 1, 3, 3, 3, 1],
      barre: { fret: 1, from: 1, to: 5 },
      fingers: [null, 1, 3, 4, 4, 1]
    }),
    difficultyTags: ["barre", "stretch"],
    summary: "A movable A-shape major chord that opens the door to non-open-key progressions.",
    recommendedVariant: "Index barre on A to high E at fret 1, then ring or mini-barre across D/G/B at fret 3.",
    alternateFingerings: ["Use a ring-finger mini-barre on D/G/B3 to reduce finger traffic."],
    functionContexts: makeContexts(["F", ["IV"], "A common IV chord in the key of F."]),
    mutingNotes: ["Mute the low E and keep the index pressure centered across the upper five strings."],
    avoidStrings: ["Avoid the low E string."],
    nearbyAlternatives: [
      {
        label: "Capo 3 with G shapes",
        type: "capo",
        description: "Capo 3 and think in G if you need the harmony without the barre."
      }
    ],
    practiceFocus: "Use tiny release moments between strums so the fretting hand does not lock."
  },
  {
    id: "b-minor-barre",
    root: "B",
    quality: "minor",
    qualityLabel: "Minor",
    inversion: "standard",
    position: "A-shape barre",
    chord: makeChord({
      name: "Bm",
      frets: [-1, 2, 4, 4, 3, 2],
      barre: { fret: 2, from: 1, to: 5 },
      fingers: [null, 1, 3, 4, 2, 1]
    }),
    difficultyTags: ["barre", "stretch"],
    summary: "A classic first serious barre chord for many players, useful in keys of G, D, and A.",
    recommendedVariant: "Index barre at fret 2, middle on B3, ring and pinky on D/G4.",
    alternateFingerings: ["Mini-barre D and G with ring if your pinky fatigues too quickly."],
    functionContexts: makeContexts(
      ["G", ["iii"], "The iii chord in the key of G."],
      ["D", ["vi"], "The relative minor flavor in key of D."]
    ),
    mutingNotes: ["Keep the low E muted and focus on even pressure from A to high E."],
    avoidStrings: ["Avoid the low E string."],
    nearbyAlternatives: [
      {
        label: "Capo 2 with Am shapes",
        type: "capo",
        description: "Capo 2 and think in Am if you want the harmony with less left-hand load."
      }
    ],
    practiceFocus: "Roll the index toward the thumb side and keep the thumb centered behind the neck."
  },
  {
    id: "csharp-minor-barre",
    root: "C#",
    quality: "minor",
    qualityLabel: "Minor",
    inversion: "standard",
    position: "A-shape barre",
    chord: makeChord({
      name: "C#m",
      frets: [-1, 4, 6, 6, 5, 4],
      barre: { fret: 4, from: 1, to: 5 },
      fingers: [null, 1, 3, 4, 2, 1]
    }),
    difficultyTags: ["barre", "stretch"],
    summary: "A higher-position minor barre that is common in pop keys once you move beyond open-chord comfort.",
    recommendedVariant: "Index barre at fret 4, middle on B5, ring and pinky on D/G6.",
    alternateFingerings: ["Keep the wrist underneath the neck slightly more than in Bm so the higher frets feel natural."],
    functionContexts: makeContexts(["A", ["iii"], "A useful iii chord in the key of A."]),
    mutingNotes: ["Keep the low E silent and check that the top strings ring evenly under the barre."],
    avoidStrings: ["Avoid the low E string."],
    nearbyAlternatives: [
      {
        label: "Capo 4 with Am shapes",
        type: "capo",
        description: "Capo 4 and use open A-minor-family thinking if you want a friendlier hand shape."
      }
    ],
    practiceFocus: "Use short pulses of pressure to avoid over-gripping high on the neck."
  },
  {
    id: "fsharp-major-barre",
    root: "F#",
    quality: "major",
    qualityLabel: "Major",
    inversion: "standard",
    position: "E-shape barre",
    chord: makeChord({
      name: "F#",
      frets: [2, 4, 4, 3, 2, 2],
      barre: { fret: 2, from: 0, to: 5 },
      fingers: [1, 3, 4, 2, 1, 1]
    }),
    difficultyTags: ["barre", "stretch"],
    summary: "A movable major barre that shows how the F shape translates up the neck.",
    recommendedVariant: "Index barre at fret 2, middle on G3, ring on A4, pinky on D4.",
    alternateFingerings: ["Use ring mini-barre on A and D if that helps the middle finger stay arched."],
    functionContexts: makeContexts(["E", ["ii"], "A common ii chord color in the key of E."]),
    mutingNotes: ["Keep the barre light but even, especially on the B and high E strings."],
    avoidStrings: ["No avoid strings."],
    nearbyAlternatives: [
      {
        label: "Capo 2 with E shapes",
        type: "capo",
        description: "Capo 2 and play E-family chords if you want a brighter, less taxing option."
      }
    ],
    practiceFocus: "Build it from the top of the F major family to make the movable concept feel familiar."
  }
];

const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

const NOTE_TO_INDEX = new Map(NOTE_NAMES.map((note, index) => [note, index]));

const QUALITY_LABELS = new Map<string, string>(
  [
    ["major", "Major"],
    ["minor", "Minor"],
    ["dominant7", "Dominant 7"],
    ["minor7", "Minor 7"],
    ["major7", "Major 7"],
    ["sus2", "Suspended 2"],
    ["sus4", "Suspended 4"],
    ["add9", "Add 9"]
  ] as const
);

const MAJOR_SCALE_ROLES: Array<[offset: number, role: HarmonicRole]> = [
  [0, "I"],
  [2, "ii"],
  [4, "iii"],
  [5, "IV"],
  [7, "V"],
  [9, "vi"]
];

const noteAt = (index: number) => NOTE_NAMES[((index % 12) + 12) % 12];

const slugify = (value: string) => value.toLowerCase().replace("#", "sharp").replace("/", "-over-");

const transposeFrets = (frets: number[], semitones: number) =>
  frets.map((fret) => (fret < 0 ? fret : fret + semitones));

const findClosestFret = (openNoteIndex: number, targets: number[], preferredFret: number) => {
  const candidates = Array.from({ length: 13 }, (_, fret) => fret).filter((fret) =>
    targets.includes((openNoteIndex + fret) % 12)
  );
  return candidates.sort(
    (left, right) => Math.abs(left - preferredFret) - Math.abs(right - preferredFret)
  )[0] ?? -1;
};

const generatedContexts = (root: string, quality: string): FunctionContext[] => {
  const rootIndex = NOTE_TO_INDEX.get(root) ?? 0;
  return MAJOR_SCALE_ROLES.flatMap(([offset, role]) => {
    if (
      (quality === "major" && !["I", "IV", "V"].includes(role)) ||
      (quality === "minor" && !["ii", "iii", "vi"].includes(role)) ||
      (quality === "dominant7" && role !== "V") ||
      (quality === "minor7" && !["ii", "iii", "vi"].includes(role)) ||
      (quality === "major7" && !["I", "IV"].includes(role))
    ) {
      return [];
    }
    const key = noteAt(rootIndex - offset);
    return {
      key,
      roles: [role],
      label: `${role} sound in the key of ${key}.`
    };
  });
};

type GeneratedTemplate = {
  quality: string;
  family: "e-shape" | "a-shape";
  baseRoot: "E" | "A";
  position: string;
  nameSuffix: string;
  frets: number[];
  fingers: Array<1 | 2 | 3 | 4 | null>;
  barreFrom: number;
  barreTo: number;
};

const GENERATED_TEMPLATES: GeneratedTemplate[] = [
  {
    quality: "major",
    family: "e-shape",
    baseRoot: "E",
    position: "E-shape barre",
    nameSuffix: "",
    frets: [0, 2, 2, 1, 0, 0],
    fingers: [1, 3, 4, 2, 1, 1],
    barreFrom: 0,
    barreTo: 5
  },
  {
    quality: "minor",
    family: "e-shape",
    baseRoot: "E",
    position: "E-shape minor barre",
    nameSuffix: "m",
    frets: [0, 2, 2, 0, 0, 0],
    fingers: [1, 3, 4, 1, 1, 1],
    barreFrom: 0,
    barreTo: 5
  },
  {
    quality: "dominant7",
    family: "e-shape",
    baseRoot: "E",
    position: "E-shape dominant 7",
    nameSuffix: "7",
    frets: [0, 2, 0, 1, 0, 0],
    fingers: [1, 3, 1, 2, 1, 1],
    barreFrom: 0,
    barreTo: 5
  },
  {
    quality: "minor7",
    family: "e-shape",
    baseRoot: "E",
    position: "E-shape minor 7",
    nameSuffix: "m7",
    frets: [0, 2, 0, 0, 0, 0],
    fingers: [1, 3, 1, 1, 1, 1],
    barreFrom: 0,
    barreTo: 5
  },
  {
    quality: "major",
    family: "a-shape",
    baseRoot: "A",
    position: "A-shape barre",
    nameSuffix: "",
    frets: [-1, 0, 2, 2, 2, 0],
    fingers: [null, 1, 3, 3, 3, 1],
    barreFrom: 1,
    barreTo: 5
  },
  {
    quality: "minor",
    family: "a-shape",
    baseRoot: "A",
    position: "A-shape minor barre",
    nameSuffix: "m",
    frets: [-1, 0, 2, 2, 1, 0],
    fingers: [null, 1, 3, 4, 2, 1],
    barreFrom: 1,
    barreTo: 5
  },
  {
    quality: "minor7",
    family: "a-shape",
    baseRoot: "A",
    position: "A-shape minor 7",
    nameSuffix: "m7",
    frets: [-1, 0, 2, 0, 1, 0],
    fingers: [null, 1, 3, 1, 2, 1],
    barreFrom: 1,
    barreTo: 5
  },
  {
    quality: "major7",
    family: "a-shape",
    baseRoot: "A",
    position: "A-shape major 7",
    nameSuffix: "maj7",
    frets: [-1, 0, 2, 1, 2, 0],
    fingers: [null, 1, 3, 2, 4, 1],
    barreFrom: 1,
    barreTo: 5
  }
];

const makeGeneratedLibraryItems = (): ChordLibraryItem[] => {
  const existingIds = new Set(CHORD_LIBRARY_ITEMS.map((item) => item.id));
  const existingSignatures = new Set(
    CHORD_LIBRARY_ITEMS.map((item) => `${item.chord.name}-${item.position}`)
  );

  return NOTE_NAMES.flatMap((root) =>
    GENERATED_TEMPLATES.flatMap((template) => {
      const baseIndex = NOTE_TO_INDEX.get(template.baseRoot) ?? 0;
      const rootIndex = NOTE_TO_INDEX.get(root) ?? 0;
      const semitones = (rootIndex - baseIndex + 12) % 12;
      if (semitones === 0) return [];

      const frets = transposeFrets(template.frets, semitones);
      const highestFret = Math.max(...frets.filter((fret) => fret > 0));
      if (highestFret > 12) return [];

      const chordName = `${root}${template.nameSuffix}`;
      const id = `${slugify(chordName)}-${template.family}-${template.quality}-generated`;
      const signature = `${chordName}-${template.position}`;
      if (existingIds.has(id) || existingSignatures.has(signature)) return [];

      return {
        id,
        root,
        quality: template.quality,
        qualityLabel: QUALITY_LABELS.get(template.quality) ?? template.quality,
        inversion: "standard" as const,
        position: template.position,
        chord: makeChord({
          name: chordName,
          frets,
          barre: { fret: semitones, from: template.barreFrom, to: template.barreTo },
          fingers: template.fingers
        }),
        difficultyTags: ["barre", "stretch"] as DifficultyTag[],
        summary: `${chordName} as a movable ${template.position.toLowerCase()} for players who want the same grip across more keys.`,
        recommendedVariant:
          template.family === "e-shape"
            ? "Keep the index barre relaxed, then place the E-family shape from the middle strings outward."
            : "Keep the low E muted, then let the index barre carry the A-family shape across the upper strings.",
        alternateFingerings: [
          "Use tiny pressure releases between strums so the hand stays loose.",
          "Move this grip chromatically to learn the whole chord family."
        ],
        functionContexts: generatedContexts(root, template.quality),
        mutingNotes:
          template.family === "a-shape"
            ? ["Mute the low E so the A-string root stays in charge."]
            : ["Balance the bass against the top strings so the barre does not sound bottom-heavy."],
        avoidStrings:
          template.family === "a-shape"
            ? ["Avoid the low E string."]
            : ["No avoid strings; keep the barre even."],
        nearbyAlternatives: [
          {
            label: "Capo remap",
            type: "capo" as const,
            description: "Use the capo tool to find an open-shape equivalent with less fretting-hand load."
          }
        ],
        practiceFocus: `Treat this as part of the ${template.position} family so ${chordName} connects to the same shape in other keys.`
      };
    })
  );
};

const makeGeneratedInversions = (): ChordLibraryItem[] => {
  const existingNames = new Set(CHORD_LIBRARY_ITEMS.map((item) => item.chord.name));
  const inversionShapes: Array<{
    suffix: string;
    quality: "major" | "minor";
    qualityLabel: string;
    bassOffset: number;
  }> = [
    {
      suffix: "3rd bass",
      quality: "major",
      qualityLabel: "Major",
      bassOffset: 4
    },
    {
      suffix: "5th bass",
      quality: "major",
      qualityLabel: "Major",
      bassOffset: 7
    },
    {
      suffix: "minor 3rd bass",
      quality: "minor",
      qualityLabel: "Minor",
      bassOffset: 3
    },
    {
      suffix: "minor 5th bass",
      quality: "minor",
      qualityLabel: "Minor",
      bassOffset: 7
    }
  ];

  return NOTE_NAMES.flatMap((root) =>
    inversionShapes.flatMap((shape) => {
      const rootIndex = NOTE_TO_INDEX.get(root) ?? 0;
      const bass = noteAt(rootIndex + shape.bassOffset);
      const chordName = `${root}${shape.quality === "minor" ? "m" : ""}/${bass}`;
      if (existingNames.has(chordName)) return [];

      const bassFret = (NOTE_TO_INDEX.get(bass) ?? 0) - 4;
      const normalizedBassFret = bassFret < 0 ? bassFret + 12 : bassFret;
      if (normalizedBassFret > 9) return [];
      const thirdOffset = shape.quality === "major" ? 4 : 3;
      const chordTones = [rootIndex, rootIndex + thirdOffset, rootIndex + 7].map(noteAt).map(
        (note) => NOTE_TO_INDEX.get(note) ?? 0
      );
      const preferredFret = Math.max(0, Math.min(7, normalizedBassFret - 2));
      const frets = [
        normalizedBassFret,
        -1,
        -1,
        findClosestFret(7, chordTones, preferredFret),
        findClosestFret(11, chordTones, preferredFret),
        findClosestFret(4, chordTones, preferredFret)
      ];

      return {
        id: `${slugify(chordName)}-${slugify(shape.suffix)}-generated`,
        root,
        quality: shape.quality,
        qualityLabel: shape.qualityLabel,
        inversion: "inverted" as const,
        position: shape.suffix,
        chord: makeChord({
          name: chordName,
          frets,
          fingers: [2, null, null, 1, 1, 1]
        }),
        difficultyTags: ["partial", "stretch", "color tone"] as DifficultyTag[],
        summary: `${chordName} keeps the harmony familiar while moving the bass note for smoother progressions.`,
        recommendedVariant: "Keep the bass note light and let the top partial shape carry the chord color.",
        alternateFingerings: [
          "Use the inversion only when the bass movement helps the song.",
          "Trim the strum to the strings that speak clearly."
        ],
        functionContexts: generatedContexts(root, shape.quality),
        mutingNotes: ["Mute skipped middle strings deliberately so the partial inversion sounds intentional."],
        avoidStrings: ["Avoid any muted inner string shown as X on the diagram."],
        nearbyAlternatives: [
          {
            label: "Root-position option",
            type: "easier" as const,
            description: "Return to a standard voicing when the slash bass is not needed."
          }
        ],
        practiceFocus: "Practice this against its root-position chord and listen for bass-line direction."
      };
    })
  );
};

const ALL_CHORD_LIBRARY_ITEMS = [
  ...CHORD_LIBRARY_ITEMS,
  ...makeGeneratedLibraryItems(),
  ...makeGeneratedInversions()
];

const dedupeByName = (items: ChordLibraryItem[]) =>
  Array.from(new Map(items.map((item) => [item.chord.name, item.chord])).values());

const findChordByName = (name: string) => {
  const match = ALL_CHORD_LIBRARY_ITEMS.find((item) => item.chord.name === name);
  if (!match) {
    throw new Error(`Chord '${name}' was not found in the shared chord library.`);
  }
  return match.chord;
};

export const CHORD_LIBRARY = ALL_CHORD_LIBRARY_ITEMS;

export const CHORD_ITEM_LOOKUP = new Map(CHORD_LIBRARY.map((item) => [item.id, item]));

export const CHORD_LIBRARY_ROOTS = Array.from(
  new Set(CHORD_LIBRARY.map((item) => item.root))
).sort((left, right) => left.localeCompare(right));

export const CHORD_QUALITY_OPTIONS = Array.from(
  new Map(CHORD_LIBRARY.map((item) => [item.quality, item.qualityLabel])).entries()
).map(([value, label]) => ({ value, label }));

export const CHORD_DIFFICULTY_TAGS = Array.from(
  new Set(CHORD_LIBRARY.flatMap((item) => item.difficultyTags))
);

export const CHORD_FUNCTION_KEYS = Array.from(
  new Set(CHORD_LIBRARY.flatMap((item) => item.functionContexts.map((context) => context.key)))
).sort((left, right) => left.localeCompare(right));

export const HARMONIC_FUNCTION_OPTIONS: HarmonicRole[] = ["I", "ii", "iii", "IV", "V", "vi"];

export const CHORD_LOOKUP = new Map(dedupeByName(CHORD_LIBRARY).map((chord) => [chord.name, chord]));

export const PROGRESSION_PACKS: ProgressionPack[] = [
  {
    id: "key-of-g-starter",
    title: "Key of G starter",
    description: "Core campfire chords with a comfortable mix of major, vi, and dominant motion.",
    keyCenter: "G",
    focus: "Beginner-friendly I-IV-V-vi movement.",
    chordIds: ["g-major-open", "c-major-open", "d-major-open", "e-minor-open", "g-over-b"],
    progression: ["G", "C", "D", "Em", "C", "G", "D"],
    rightHandPattern: "Down, down-up, up-down-up"
  },
  {
    id: "key-of-c-warmups",
    title: "Key of C warmups",
    description: "Open-position harmony for practicing tonic, subdominant, and relative-minor colors.",
    keyCenter: "C",
    focus: "Smooth I-IV-V-vi transitions in open position.",
    chordIds: ["c-major-open", "f-major7-open", "g7-open", "a-minor-open", "d-minor-open"].map(
      (id) => (id === "g7-open" ? "g-dominant7-open" : id)
    ),
    progression: ["C", "Am", "Fmaj7", "G7", "C"],
    rightHandPattern: "Thumb bass, down-up brush"
  },
  {
    id: "walking-bass-inversions",
    title: "Walking bass inversions",
    description: "Bass-led chord movement using slash chords and inversion-friendly shapes.",
    keyCenter: "G",
    focus: "Hear how inversions smooth out progressions.",
    chordIds: ["g-major-open", "g-over-b", "c-over-g", "d-over-fsharp", "am-over-c", "f-over-a"],
    progression: ["G", "G/B", "C/G", "D/F#", "Am/C", "G"],
    rightHandPattern: "Bass note, light strum, bass note, strum"
  },
  {
    id: "barre-bootcamp",
    title: "Barre bootcamp",
    description: "Closed-position shapes that build endurance without leaving common guitar keys.",
    keyCenter: "A",
    focus: "Strength and consistency across E-shape and A-shape barre families.",
    chordIds: ["f-major-barre", "b-minor-barre", "bb-major-barre", "fsharp-major-barre", "g-major-barre"],
    progression: ["F", "Bb", "Gm", "C", "F"],
    rightHandPattern: "Short downstrokes with muted releases"
  }
];

export const LEVELS: Level[] = [
  {
    name: "Open Chords",
    description: "Comfortable open shapes to build speed.",
    chords: ["C", "G", "D", "Em", "Am", "E", "A"].map(findChordByName)
  },
  {
    name: "Open + Spice",
    description: "Add sus and dominant flavors for quicker switches.",
    chords: ["Cadd9", "Dsus4", "G", "Em7", "Am7", "E7", "D"].map(findChordByName)
  },
  {
    name: "Barre Chords",
    description: "Full grip shapes for strength and clarity.",
    chords: ["F", "Bm", "Bb", "Gm", "C#m", "F#"].map(findChordByName)
  },
  {
    name: "Inversions",
    description: "Slash chords to sharpen bass movement.",
    chords: ["C/G", "G/B", "D/F#", "Am/C", "Em/B", "F/A"].map(findChordByName)
  }
];
