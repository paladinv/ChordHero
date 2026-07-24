# Chord Hero Android 15+ use cases and test contract

This document applies the shared UC-01–69 mobile contract to the native Android app. Android system pickers, Sharesheet, PrintManager, MIDI, AudioTrack, Room, and DataStore are the platform equivalents of the iOS services. Intentional differences must be recorded against the relevant UC identifier.

## Application shell, lifecycle, and accessibility

- **UC-01 — Offline launch:** Launch without connectivity and decode all schema-v1 assets. Unsupported or corrupt content shows a blocking recovery message rather than partial data.
- **UC-02 — Navigation:** Open Dashboard, Trainer, Right-Hand Studio, Song Coach, Song Library, Library, Chart, Profiles & Tools, and About.
- **UC-03 — Restoration:** Restore the selected profile, destination, filters, and lightweight preferences. Never resume a running practice scheduler automatically.
- **UC-04 — Adaptive layout:** Use bottom navigation and stacked content on compact devices; use navigation rail and expanded content on tablets and resizable windows. Support portrait and landscape.
- **UC-05 — Accessibility:** Expose TalkBack semantics and logical order, scalable text, sufficient contrast, 48dp targets, keyboard/D-pad/switch access, reduced motion, and non-color cues.
- **UC-06 — Interruption:** Stop generated audio and pause active practice after backgrounding, audio-focus loss, or device interruption. Require an explicit resume.

## Timed chord trainer

- **UC-10:** Select automatic progression or any manual level.
- **UC-11:** Begin a ten-chord round immediately, then schedule changes at three-second monotonic deadlines.
- **UC-12:** Avoid adjacent duplicate chord IDs whenever the level has alternatives.
- **UC-13:** Show diagram, progress, countdown, visual feedback, and optional clicks.
- **UC-14:** Pause/resume with chord, history, level, and remaining interval intact.
- **UC-15:** Reset to idle and cancel the coroutine.
- **UC-16:** Inspect any chord in round history.
- **UC-17:** Finish at ten chords and advance automatic mode, capped at the final level.
- **UC-18:** Keep manual mode on its selected level.

## Right-Hand Studio

- **UC-20:** Filter all 30 exercises by technique and difficulty.
- **UC-21:** Show focus, coaching, subdivision, pattern, and default tempo.
- **UC-22:** Start/pause a looping follow-along playhead.
- **UC-23:** Mark direction, string/finger, count, accent, mute, or rest.
- **UC-24:** Adjust 40–180 BPM and restore the default.
- **UC-25:** Mute clicks without stopping visual timing.
- **UC-26:** Move previous/next inside filtered bounds.
- **UC-27:** Cancel and reset when filter or exercise changes.

## Song Coach

- **UC-30:** Browse all 50 bundled songs.
- **UC-31:** Show source, difficulty, tempo, progression, pattern, and guidance.
- **UC-32:** Adjust 60–140 BPM and two, four, or six beats per chord.
- **UC-33:** Play a four-click count-in.
- **UC-34:** Show chord, diagram, step/beat, fingering, transition, and mistake guidance.
- **UC-35:** Pause, resume, reset, and toggle metronome.
- **UC-36:** Complete safely on the final chord.
- **UC-37:** Reset timing and tempo on song changes.

## Song Library and source links

- **UC-38:** Search bundled songs by title, artist, key, meter, difficulty, tags, or right-hand technique.
- **UC-39:** Create, rename, delete, and populate profile-scoped local collections.
- **UC-40:** Select strumming, fingerpicking, or plectrum variations and open them in Song Coach.
- **UC-41:** Save Ultimate Guitar metadata and source URLs, then open the original page through Android intents.
- **UC-42:** Keep full tab/lyric import disabled until an authorized provider response is available.

## Chord library and study

- **UC-40:** Browse all 346 stable voicing IDs.
- **UC-41:** Combine root, quality, position, difficulty, harmonic, pack, favorite, and recent filters.
- **UC-42:** Search descriptive content and show an empty state.
- **UC-43:** Show complete diagram, fingering, muting, theory/context, and practice details.
- **UC-44:** Follow related voicings while clearing hiding filters.
- **UC-45:** Persist favorites and eight recents per profile.
- **UC-46:** Preview synthesized strum or arpeggio.
- **UC-47:** Select steel, nylon, muted, or picked synthesis.
- **UC-48:** Select four tunings and show note names.
- **UC-49:** Set capo 0–7 and show transposition.
- **UC-50:** Compare up to three voicings with shared/unique marks.
- **UC-51:** Time practice and add repetitions.
- **UC-52:** Schedule Again/Good/Easy at exactly 4/24/72 hours.
- **UC-53:** Show due reviews, strength, misses, elapsed time, and recommendation.
- **UC-54:** Persist personal notes per chord/profile.
- **UC-55:** Run ear questions with replay and correction.
- **UC-56:** Accept velocity-positive MIDI note-on events and compare pitch class.
- **UC-57:** Keep touch answers available without MIDI.

## Packs, profiles, chart, and teacher tools

- **UC-60:** Browse four built-in packs.
- **UC-61:** Create a custom pack of at most ten unique IDs and a pattern.
- **UC-62:** Import legacy arrays/versioned envelopes and export web-compatible arrays through SAF.
- **UC-63:** Validate before one Room transaction; failures leave data unchanged.
- **UC-64:** Create/switch isolated profiles.
- **UC-65:** Filter teacher sheets and cap at nine cards.
- **UC-66:** Generate, share, and print teacher/comparison PDFs.
- **UC-67:** Browse chart by level/root.
- **UC-68:** Generate portrait scale-to-fit chart PDF.
- **UC-69:** Show purpose, philosophy, privacy, attribution, and GPL-3.0.

## Automated tests and acceptance

| Area | Required Android assertions |
| --- | --- |
| Content | Chord/right-hand/settings schema v1 plus songs schema v2; IDs, six-string shapes, ranges, references, and exact 346/4/4/30/50/150/4 inventories. |
| Domain | Base fret, capo, tuning, pitch classes, comparison, filters, recents, recommendations, and review intervals. |
| State | Trainer cadence/cap/pause; exercise subdivision/wrap/cancellation; song count-in/progression/final bounds. |
| Storage | Profile seed/selection/isolation, CRUD, atomic import, ten-item pack cap, DataStore recovery, and schema v1. |
| Services | Audio frequencies/envelopes/focus; MIDI parsing/fallback; JSON round trips; PDF/URI/share/print behavior. |
| UI | Every destination and representative trainer, exercise, song, library, profile, pack, ear, and PDF flow. |
| Accessibility | Semantics, TalkBack order, large text, keyboard/D-pad, reduced motion, targets, contrast, and non-color cues. |

Run `./gradlew testDebugUnitTest connectedDebugAndroidTest lintDebug assembleDebug bundleRelease` on API 35 and 36. Exercise compact and standard phones plus a tablet in portrait and landscape. Re-run `npm run content:validate` and `npm run build` whenever shared content changes.
