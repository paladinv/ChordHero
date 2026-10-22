# Right-hand learning journey

The page opens with a focused beginner layout; the advanced layout preference is saved locally. Both layouts retain one-click 3D preview and recording access. Sound, round and chord controls remain available in the expandable settings section.

“Quick start & learning journey” lazily loads these local tools:

- Quick start explains pattern tokens and suggests a comfortable tempo using a self-selected level or 80% of a tapped pulse. This is not an accuracy measurement. Apply starts the existing round after state updates.
- Hear & repeat uses existing recorded guitar samples for the first bar, gives a four-click countdown, then hides pattern/3D prompts for a silent response window. Completion has a local reflection, not an invented score. Recording review remains available separately.
- Phrasing contains authored 4/8-bar G–C–Em–D strumming sentences with explicit rests and matching sampled demos. It is a practice phrase, not a licensed song recording.
- Spaced review is derived from dated, accepted recorded timing results. Intervals are 1, 3, 7 and 14 days; separate successful days advance the schedule, a score under 80% returns to one day, and disputed takes never count. Self-rated rounds do not seed this queue.
- Offline preparation verifies the nine known audio files (281,784 bytes) and an exact serialized exercise-library cache entry. It reports missing files, mismatched sizes, download failures, and cached current-page/script state. Cache `right-hand-bundle-v1` survives the shell service worker’s own cache cleanup. It never caches recordings. This is not a promise that all routes, future lazy chunks, online media, or browser-evicted data work offline.
- Teacher view uses the existing practice platform assignments/events with optional tempo and timing targets. It compares practice time plus accepted recorded takes after assignment creation and before its due date, and exports JSON. There is no backend, login, remote assignment delivery, or student identity attribution.
- Guided courses persist the selected course and the next evidence-based lesson cursor locally, so reopening the page resumes the next unfinished or recorded-check lesson without starting audio automatically. Phrase demos and previews use the currently selected chord progression, including custom progressions.
- Four-week technique trends use only accepted, timestamp-valid, explicitly reliable recorded evidence; unlabeled, limited, and insufficient takes plus self-ratings are excluded. Small sample counts are shown as limited rather than treated as a skill grade.
- Local teacher feedback supports notes plus HTTPS media links or local recording references with timestamps. The default teacher packet redacts learner identity and attachment targets; a separate opt-in export includes only targets marked with explicit learner consent. Audio/video bytes are never exported.

Dispute corrections match both `exerciseId` and `recordingId` before updating persisted evidence. Recommendations and the review queue exclude `reviewAccepted === false`; the current timing best is recomputed from remaining accepted recorded results. Historical self-rated round counters are separate and are not retroactively rewritten.

Focused checks: `node scripts/validate-right-hand-learning.mjs` and TypeScript. Audio classification accuracy requires consented real recordings and is documented by the separate audio evidence work.

CI integration: `npm run test:web:right-hand-learning` and `npm run test:web:right-hand-audio` are independent test groups, included in the web CI matrix and selected for their relevant source/component changes. The shared studio page, practice event model/runtime, and exercise content select both regressions. The audio check remains synthetic and does not assert real-recording accuracy.
