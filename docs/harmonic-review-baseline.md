# Harmonic Review Baseline

`shared/content/v1/harmonic-review-baseline.json` records existing partial-tone charts as `review-required` and `unresolved`. It is a regression baseline, not evidence that omitted tones are intentional, playable, teacher-reviewed, or accepted as canonical quality.

Run `npm run content:validate` to see every outstanding root/quality and partial-tone gap. New partial charts and newly omitted intervals fail validation. Existing entries may be improved without updating the baseline as long as their current missing-interval set is a subset of the recorded set; a fully repaired chart also passes. Do not add a new baseline entry just to silence CI.

To deliberately refresh after reviewing chart changes, run `node scripts/refresh-harmonic-review-baseline.mjs --confirm-review-required`. This deterministically rebuilds the sorted baseline from current chord IDs and missing formula intervals. Review the complete file diff before accepting it; the command refuses to run without the explicit confirmation flag and refuses malformed charts or slash-bass errors. Entries remain labeled `reviewRequired: true` and `status: "unresolved"`.

Every fretted string (`fret > 0`) must also have an assigned finger number. This structural check and wrong slash-bass check are fatal, independently of the legacy partial-tone baseline.
