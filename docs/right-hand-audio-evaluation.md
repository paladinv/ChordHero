# Local right-hand recording evaluation

Status: real-recording accuracy is **not evaluated** until a consented, annotated dataset is supplied. Synthetic checks exercise implementation behavior, not diagnostic validity.

Open Right Hand → recording coach → “Consented real-recording evaluation”. Download the manifest example, replace its sample entry with your own recordings and annotations, choose the manifest and matching audio files, confirm performer permission, and run the evaluation. Processing stays in the browser: there is no upload and evaluation audio is not added to the take library. Exported reports contain filenames, device labels, annotations, consent metadata and measurements, but not audio. Avoid personal information in labels.

## Manifest version 1

Each `samples` entry needs:

- `file`: exact selected audio filename; filenames must be unique.
- `device`: microphone/device/browser description, allowing cross-device comparisons.
- `browser`, `pickup`, `noise`: optional separate browser/version, microphone or pickup path, and room-noise cohort labels (nonempty, at most 120 characters). Legacy version-1 manifests remain accepted; omitted labels appear as “not supplied”.
- `instrument`: `acoustic` or `electric`.
- `expectedTempoBpm`: reference tempo, 20–300 BPM.
- `expectedOnsetsMs`: 2–256 increasing reference attack times measured from the start of the file, not from its first note. Annotate intended attacks only; omit rests.
- `expectedChords`: optional chord labels for the progression.
- `consent`: `{ "granted": true, "scope": "local-evaluation", "source": "permission provenance", "date": "YYYY-MM-DD" }`.

Limits: 12 samples, 20 MiB and 30 seconds per recording; manifest at most 1 MiB. Consent assertions and annotations are supplied by the evaluator and are not independently verified. Do not invent permission records or use someone else's private audio without permission.

## Measured report

Onsets are matched one-to-one within 150 ms. Evaluation counts all detected attacks, including those before the first annotated reference, so false starts are not silently removed from precision. The report includes matched/expected/observed counts, reference coverage, detection precision, mean absolute onset error and signed bias. Coverage/precision must accompany any error claim; low error on a few matches is not high accuracy.

Attack-rate error compares median observed and annotated attack intervals. It is not necessarily tempo error: subdivisions, rests and syncopation change attack rate. Chord-label agreement covers only retained confidence-filtered evidence and must be read alongside its evidence count. It is not whole-recording chord accuracy.

Use consented recordings across actual devices, rooms, instruments and players; annotate before inspecting predictions. Separate held-out evaluation recordings from calibration takes, and report results by device as well as overall. The app does not ship a validated real-recording dataset or claim population-level accuracy.

Reports now aggregate overall and by device, browser, instrument, pickup and noise label. Onset counts are pooled; error and signed bias are weighted by matched attacks, while retained chord-label agreement is weighted by retained evidence count. Each cohort exposes its sample count. These are only measurements of supplied files, not evidence that any cohort is representative.

## Take review controls

The take review offers explicit A/B playback of a sampled target and the player's actual decoded audio. Both selected waveforms are RMS-matched using attenuation only, constrained by a 0.9 peak ceiling before master volume. Silence is not boosted; comparison refuses a silent side. This is not perceptual loudness normalization or an exact reproduction of the player's instrument. Only one review source plays at a time, and capture/master mute changes stop it.

A contiguous scoring window slices actual samples before onset, pitch and dynamics analysis. Original file-relative timing and target pattern phase are retained, no expected attacks are padded beyond the chosen window, and the separate review reports source identity and selected boundaries without overwriting the original recording, score, or practice history. Personal timing feel (ahead/on/behind) and tolerance are captured per take. The standard timing score remains fixed to the on-beat ±35 ms reference; the personal score/chart is explicitly separate.

Run `node scripts/validate-right-hand-review-controls.mjs` for sample-window, timing-profile, RMS and cohort aggregation checks using synthetic samples. No consented real-recording dataset is bundled.

## Technique indicators and dynamics

Weak-attack, sustained-energy and roughness indicators use bounded sample-domain RMS and high-frequency-difference measurements. Their confidence is signal/coverage confidence, **not** a calibrated probability of buzz, unwanted ringing, or a specific string error. Pick scrape, intended sustain, distortion, mic processing and noise can create similar signatures. Low-signal evidence is withheld; listen back and use “feedback is wrong” when appropriate.

Equal-volume consistency and deliberate accent-pattern correlation are separate measurements. Pattern tokens marked `!` provide default accent targets; callers can instead supply `expectedAccents`. High consistency is not inherently better when accents are intended, and automatic gain control may mask both.

Run `node scripts/validate-right-hand-audio-evidence.mjs` for synthetic checks covering low-signal gating, roughness, intentional accents, consent validation, one-to-one onset matching, pre-PLAY exclusion and rests. These checks do not substitute for real-recording evaluation.

## Participant validation protocol

Before treating a score as evidence of real-recording performance, collect permissioned recordings locally from multiple pseudonymous participants across at least two sessions. Keep calibration, validation, and held-out splits participant-disjoint: a participant in `held-out` must not appear in either other split. Record device/microphone, instrument, room/noise and software labels, and annotate expected attacks/chords before inspecting predictions. Do not put names, contact details, or raw audio in an exported report.

Use `parseParticipantValidationManifest` and `validateParticipantValidationProtocol` from `lib/rightHandParticipantValidation.ts` to reject missing consent, reused filenames, invalid IDs, missing device/guitar/microphone/environment/tuning/capo setup metadata, and participant or session leakage across splits. Report onset coverage, precision, mean absolute error, and chord-agreement by participant and device, with sample counts and setup-coverage counts; never pool a small cohort into a population claim. Keep held-out files untouched until the implementation and thresholds are frozen, and publish failures/low-signal exclusions alongside retained results. Synthetic fixtures and the app's local evaluator are implementation checks only, not participant validation.

The Right-hand four-week trend is a descriptive, like-for-like view capped by the small set of takes retained in the local browser. It is not a population benchmark. Held-out participant validation is a protocol for a future consented evaluation only; this app does not contain a study result or real participant dataset.
