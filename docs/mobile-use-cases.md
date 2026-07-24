# Chord Hero mobile use cases and acceptance tests

This catalogue is the product contract for the native iOS 17+ app and the later Android parity implementation. “The app” means either native client unless a platform is named explicitly.

## App shell and lifecycle

- **UC-01 — Offline launch:** The learner launches with no network and all bundled content is available.
- **UC-02 — Navigation:** The learner can open Trainer, Right-Hand Studio, Song Coach, Song Library, Library, Chart, Tools, and About.
- **UC-03 — Restoration:** The selected profile and saved, non-running state survive relaunch.
- **UC-04 — Adaptive layout:** Compact phones use stacked navigation; tablets use available split/detail layouts.
- **UC-05 — Accessibility:** Essential flows support VoiceOver/TalkBack, large text, contrast, reduced motion, and hardware keyboards.
- **UC-06 — Interruption:** Backgrounding or an audio interruption pauses generated playback and requires an explicit resume.

## Timed chord trainer

- **UC-10:** Choose automatic progression or a manual level.
- **UC-11:** Start a ten-chord round; the first chord appears immediately and subsequent chords use three-second intervals.
- **UC-12:** Do not display the same chord twice consecutively when alternatives exist.
- **UC-13:** Display diagram, progress, countdown, visual change feedback, and optional clicks.
- **UC-14:** Pause/resume without losing the chord, history, level, or remaining interval.
- **UC-15:** Reset to a clean idle round.
- **UC-16:** Select and inspect a chord from round history.
- **UC-17:** Complete ten changes and advance automatically, capped at the last level.
- **UC-18:** Continue a manual-mode round at the manually selected level.

## Right-Hand Studio

- **UC-20:** Filter all 30 exercises by technique and difficulty.
- **UC-21:** View focus, coaching, subdivision, pattern, and default tempo.
- **UC-22:** Start/pause a continuously looping follow-along pattern.
- **UC-23:** Display direction, string/finger, count, accent, mute, and rest state.
- **UC-24:** Change tempo from 40–180 BPM or restore the exercise default.
- **UC-25:** Mute clicks without stopping visual timing.
- **UC-26:** Move to the previous/next exercise inside the filtered set.
- **UC-27:** Changing filters or exercises cancels the old scheduler and resets the playhead.

## Song Coach

- **UC-30:** Select any of the 50 bundled traditional/public-domain songs.
- **UC-31:** View source, difficulty, default tempo, progression, pattern, and playing guidance.
- **UC-32:** Set 60–140 BPM and two, four, or six beats per chord.
- **UC-33:** Start with four count-in clicks before the progression.
- **UC-34:** Display the current chord, diagram, step/beat, fingering, transition, and mistake guidance.
- **UC-35:** Pause, resume, reset, and toggle the metronome.
- **UC-36:** Finish safely on the final chord without exceeding progression bounds.
- **UC-37:** Selecting a new song resets its playback state and restores its default tempo.

## Song Library and source links

- **UC-38:** Search and filter bundled songs by title, artist, difficulty, key, meter, technique, tags, or collection.
- **UC-39:** Create, rename, delete, and populate local song collections without duplicating song records.
- **UC-40:** Select a song variation for strumming, fingerpicking, or plectrum practice and launch it in Song Coach.
- **UC-41:** Save an Ultimate Guitar source URL, metadata, and local practice notes; open the original source from the saved record.
- **UC-42:** Accept full tab/lyric import only from an authorized provider and retain attribution and authorization metadata.

## Chord library and study

- **UC-40:** Browse every bundled voicing using stable content identifiers. The current inventory is 346 voicings.
- **UC-41:** Filter by root, quality, position, difficulty, harmonic key/function, pack, favorites, or recents.
- **UC-42:** Search chord and descriptive text and receive a useful empty state.
- **UC-43:** View diagram, fingering, alternatives, muting, theory, bass/open strings, voice-leading, difficulty, and practice guidance.
- **UC-44:** Jump to a related voicing while clearing filters that would hide it.
- **UC-45:** Favorite chords and keep eight profile-specific recent chords.
- **UC-46:** Preview a chord as a synthesized strum or arpeggio.
- **UC-47:** Choose clean/steel-equivalent, warm/nylon-equivalent, muted, or picked character and fall back safely to synthesis.
- **UC-48:** Select standard, Drop D, DADGAD, or half-step-down tuning and inspect note names.
- **UC-49:** Set capo 0–7 and see the transposed chord name.
- **UC-50:** Compare up to three voicings and display primary, comparison, and shared fretboard notes.
- **UC-51:** Start/stop a chord practice timer and add repetitions.
- **UC-52:** Rate a review Again, Good, or Easy with 4-hour, 24-hour, and 72-hour scheduling.
- **UC-53:** View due reviews, strength, misses, elapsed time, and recommendations.
- **UC-54:** Persist a personal chord note within the selected profile.
- **UC-55:** Run chord-name and harmonic-function ear-training questions with replay and correction.
- **UC-56:** Connect USB/Bluetooth MIDI, accept velocity-positive note-on messages, and compare pitch class with the target root.
- **UC-57:** Complete ear training by touch when MIDI is absent or disconnected.

## Packs, profiles, chart, and teacher tools

- **UC-60:** Browse and apply the four built-in progression packs.
- **UC-61:** Create a custom pack containing at most ten unique chord IDs and a right-hand pattern.
- **UC-62:** Import legacy web pack arrays or a versioned envelope and export web-compatible arrays.
- **UC-63:** Reject malformed imports atomically with an actionable error.
- **UC-64:** Create/switch profiles with isolated favorites, recents, notes, and practice data.
- **UC-65:** Filter a teacher sheet by key, skill, and optional pack, capped at nine cards.
- **UC-66:** Preview and share/print teacher and comparison PDFs.
- **UC-67:** Browse the chord chart by trainer level or root.
- **UC-68:** Generate a portrait, scale-to-fit chord-chart PDF.
- **UC-69:** View purpose, practice philosophy, and GPL-3.0 attribution.

## Automated acceptance tests

| Test area | Required assertions |
| --- | --- |
| Shared content | Chords/right-hand/settings schema v1 and songs schema v2; stable IDs; valid six-string arrays, frets, fingers, barres, song sections, and variations; 346 chords, 4 levels, 4 packs, 30 exercises, 50 songs, 150 variations, and 4 tunings. |
| Chord rules | Stable lookups; base fret/barre rendering; capo transposition; tuning/pitch-class mapping; shared-note heatmap. |
| Trainer | Immediate first chord; three-second deadlines; ten-item cap; no adjacent duplicate; pause/resume/reset; manual and capped automatic progression. |
| Right hand | Subdivision interval math; step interpretation; loop wrap; tempo changes; cancellation on selection/filter change. |
| Songs | Four-click count-in; beats-per-chord; variation selection; chord advancement; final-state bounds; pause/resume/reset and song-change behavior. |
| Reviews | Exactly 4/24/72-hour due dates; strength floor; miss/repetition updates; due-list selection. |
| Persistence | First profile seed; CRUD; selected-profile restoration; isolation; custom pack deduplication and ten-item limit. |
| Audio/MIDI | Correct frequencies/envelopes; mute state; interruptions; note-on acceptance; note-off/zero-velocity rejection; octave-independent root matching. |
| Import/export/PDF | Legacy and envelope import; deterministic export round trip; atomic invalid-file rejection; nine-card teacher PDF. |
| Song Library | Search/filter combinations; collection CRUD; profile isolation; source-link save/open; authorized-import gating; variation-to-coach handoff. |
| SwiftUI UI | Launch; primary tabs; representative trainer, exercise, song, library, profile, pack, ear-training, and PDF flows. |
| Accessibility | Labels/traits, traversal order, accessibility text sizes, reduced motion, contrast, and non-color status cues. |

## Device acceptance matrix

- Build with deployment target iOS 17.0 and the current installed SDK.
- Exercise a small iPhone, a current standard iPhone, and an iPad in portrait and landscape.
- Run unit/integration tests and primary-navigation UI automation on an available simulator.
- Re-run the Next.js production build whenever shared content changes.
- Android later must run the same content fixtures and behavior tests against the UC identifiers above.
