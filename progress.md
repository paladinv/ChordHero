Original prompt: Add in a new tab, this tab is specifically for right hand practices, e.g. strumming patterns, plectrum pickings, and fingerpickings. Add in a lot of different practice exercises for each technique, demonstrations for users to follow along, with speed adjustable. There should be different difficulties for user to choose from, so it can cater to beginners, intermediate level players, and experts. Optimize the UI should it is not cluttered and overwhelms the user.

- 2026-10-19: Final independent verification passed production build and performance budget (380,390/400,000 emitted bytes; page source 51,999/52,000 and RecordingCoach 13,988/16,000). TypeScript, content, localization (23 locales × 201 messages), guitar-3D mapping and diff checks passed; lint had only unrelated existing warnings. Desktop/mobile browser checks covered actual 3D rendering, exact tokens/contact steps/cameras/hiding, reduced-motion and WebGL fallback, persistent advanced sections, reference recordings, timed rehearsal advancement, Spanish reload and chord-capture audio isolation. Physical microphone/acoustic accuracy and native platforms were not tested. The independent verifier is removing temporary test artifacts.

- 2026-10-19: Refined advanced controls into state-preserving Learn/Practise/Review/Settings sections; added local reference-audio pinning, configurable automatic rehearsal rests, evidence-based session recap, room/tap calibration controls and confidence-gated scoring. Extracted resource ownership and take-library helpers to retain source budgets. Mic operations stop late permission streams, timers and contexts on unmount/exercise changes, reject stale analysis, and silence app playback to prevent self-scoring. Timing compensation adjusts observed timestamps while preserving reference and raw audio sample positions. Focused TypeScript/lint/diff checks passed; full independent verification follows.

- 2026-07-14: Inspected the Next.js app structure and existing UI. The new experience will live at `/right-hand` and preserve unrelated uncommitted library/CSS work.
- 2026-07-14: Added `/right-hand`, 30 exercises across strumming, plectrum, and fingerpicking, three difficulty filters, animated step-by-step demos, tempo range, audio clicks, coaching cues, and responsive focused-workspace styling. Added navigation and dashboard entry.
- 2026-07-14: `npm run build` passed with lint and TypeScript checks. Browser-tested technique/difficulty switching, advanced exercise selection, active playback stepping, audio initialization, and console output (no errors/warnings).
- 2026-07-14: Visually inspected desktop at 1440px and mobile at 390px. Both report zero document overflow; mobile filters, horizontal exercise/pattern strips, and single-column transport are usable and legible.
- TODO: None for the requested feature.
- 2026-07-14: Began interface-wide visual unification using Right Hand as the reference. Added shared studio headings/session notes and restyled Home, Trainer, Songs, Library, Chord Chart, About, navigation, controls, and workspaces around the same flat cream/teal segmented system.
- 2026-07-14: `npm run build` passed. Browser-verified all seven routes at 1280px and visually inspected their screenshots; the shared visual hierarchy matches Right Hand throughout.
- 2026-07-14: Verified active Trainer and Song Coach states (round start, count-in, diagrams, controls) with no browser console errors. Checked Home, Trainer, Right Hand, Songs, Library, and Chord Chart at 390px with zero horizontal document overflow and visually inspected the main mobile workspaces.
- TODO: None for the requested interface unification.
- 2026-07-24: Began the Right-Hand Studio coaching upgrade. Baseline: `/right-hand` 5.99 kB route bundle / 93.3 kB first load; shared content valid; iOS simulator build passed. Android test baseline is blocked because this machine has no Java runtime.
- 2026-07-24: Added six expert drills (36 total), count-in, timed rounds, Web Audio look-ahead scheduling, guitar/click/backing layers, guided paths, notation help, progress persistence, deep-linked drills, self-assessment, auto tempo ramping, keyboard/MIDI control, responsive motion visualization, and native count-in/round/feedback parity.
- 2026-07-24: Final verification passed: shared-content validation (36 exercises), clean Next.js production build, all web routes with zero browser warnings/errors, Right Hand count-in/playback and 390px responsive QA with zero document overflow, iOS build, seven iOS unit tests, and the primary-navigation UI test.
- 2026-07-24: Performance comparison: shared JavaScript remained 87.3 kB; `/right-hand` grew from 5.99 kB to 11.0 kB and is still route-scoped/lazy-loaded. Audio remains cached and initializes only on user interaction. No dependencies were added.
- 2026-07-24: Updated iOS and Android inventory assertions from 30 to 36 and fixed a Songs SVG title hydration warning found during the regression sweep. Android execution remains blocked by the host's missing Java runtime; its content assertion was updated and the implementation was statically reviewed.
- TODO: None for the requested Right Hand upgrade. Android tests should be run on a Java-enabled machine or CI.
- 2026-08-09: Added a local-first practice-platform model for cross-feature session events, daily plans, weak-skill recommendations, portable assignments/reports, custom right-hand routines, global accessibility preferences, and optional revision-safe sync. Added `/practice` as the unified chords + songs + right-hand dashboard.
- 2026-08-09: Upgraded Right-Hand Studio with lazy-loaded microphone recording, onset-based timing and chord-attack feedback, rushing/dragging guidance, stored short takes, trouble-spot loops, adaptive two-clean-round tempo ramps, swing/accent/silent-gap metronome modes, voice/MIDI controls, checkpoints, warmup/cooldown cues, custom routines, mirrored left-hand motion, and lightweight close-up motion lessons.
- 2026-08-09: Added dependency-free PWA metadata/service-worker registration with versioned app-shell and practice-audio caching. Added persisted global controls for reduced motion, high contrast, diagram scale, audio volume/mute, haptics preference, and handedness.
- 2026-08-09: Added deterministic CI source/built-route performance budgets plus optional baseline/current PNG comparison and a GitHub Actions quality workflow. TypeScript no-emit validation passes; full build, browser, native, performance, and regression verification is delegated to the independent testing agent.
- TODO: Native apps retain their existing local profile/practice persistence and teacher tools, but the new web practice-event envelope, microphone scoring UI, global accessibility controls, and optional endpoint sync are not yet exposed in iOS/Android screens. Hosted teacher accounts, real-time classes, pitch-level chord recognition, and bundled instructor videos intentionally remain out of scope; reports/assignments are local/exportable and the audio score explicitly measures timing/transient clarity rather than chord identity.
- 2026-08-09: Tightened the performance budget check so a missing or development-only Next.js route manifest fails instead of reporting a misleading zero-byte pass. A valid post-build check now totals the emitted `/right-hand/page` route set, including shared browser runtime, and reports both bytes and file count against the documented 400 kB budget.
- 2026-08-09: Removed the full accessibility settings model from the global initial bundle. The root shell now applies saved attributes and registers the service worker with a minimal launcher; persistence controls and practice-platform logic load in a separate client chunk only when Accessibility is opened.
- 2026-08-09: Added a dependency-free, lazy recording-analysis upgrade: room/profile calibration, monophonic root evidence, harmonic-template chord confidence against selected progressions, accessible beat-by-beat early/on-time/late/missed results, waveform comparison, and bounded last-two-take IndexedDB retention. Full polyphonic chord recognition remains an estimate and no personal audio is synced or precached.
- 2026-08-09: Added per-exercise BPM/clean-round goals, configurable clean-streak speed ladders, automatic trouble loops, custom progression backing, six style presets (reggae, funk, shuffle, bluegrass, bossa nova, Travis), opt-in haptics, guided style-course milestones, and handedness-aware licensed-media infrastructure with an explicit awaiting-source fallback.
- 2026-08-09: Expanded the Practice hub with time, consistency, tempo-ceiling, clean-streak, app-area, and right-hand-technique history. Teacher assignments can carry HTTPS audio/video feedback links or local recording references with explicit no-upload metadata.
- 2026-08-09: Focused TypeScript compilation of every changed TS/TSX module passes. The repository-wide TypeScript check remains blocked by the pre-existing `lib/chordLearning.ts` HarmonicRole/string-array type error; independent regression/performance verification remains assigned to the testing agent.
- 2026-08-09: Kept the CPU-heavy autocorrelation/chroma implementation in its own dynamic chunk. Song Library retains its lightweight onset-analysis path; pitch/harmonic code downloads only when the Right-Hand microphone coach scores a take.
- TODO: Supply approved, licensed close-up instructor media and attribution before enabling real video. Hosted teacher accounts, media upload, and native web-feature parity require product/backend work and are intentionally not fabricated.
- 2026-08-09: Added on-demand per-chord guitar/tuning calibration, timing/root/root-quality scoring modes, confidence and insufficient-signal guidance, exact corrective loops, privacy-enforced recording retention/export, hand-position overlays, persistent setup checklist, four-dimensional goals, challenge modes, responsive style backing, Song Coach context handoff, weekly technique-balance goals, timestamped teacher feedback, and a local rights-cleared media metadata registry with captions/transcript/left-handed source support.
- 2026-08-09: Heavy microphone DSP, calibration, recording results, advanced controls, and video registry remain behind user-triggered dynamic boundaries. No footage, audio upload, hosted teacher backend, or polyphonic certainty claim was added.
- TODO: Independent verifier should run production build/performance budget and browser scenarios. Supply actual rights-cleared video URLs and a consent-aware hosted teacher backend before enabling network media sharing.
- 2026-08-10: Added the lazy, user-opened Right Hand Practice Lab: opt-in live onset feedback, four existing-sample target voicings, 50%/75% demo motion, technical mistake/correction cues, fatigue checks, a six-metric skill map and weakest-metric warmup, bounded local bookmarks/playlists/notes, no-look and performance modes, independent click/demo/context mixing, constrained authored-pattern randomization, confirmation-only recovery setups, and validated attributed offline challenge-pack import/export.
- 2026-08-10: Kept microphone/analyser work permission-gated and stopped tracks on exit; global mute/volume still multiplies every practice layer. The new lab ships in the existing user-triggered Advanced Tools dynamic chunk, while the source-budgeted `/right-hand` page remains below its 52,000-byte ceiling. No dependencies, bundled media, upload path, network community backend, or live chord-certainty claim was added.
- TODO: The live guide scores attack timing only. Hosted challenge discovery, publisher rights checks, and continuous live polyphonic chord recognition still require approved services/content and are intentionally not simulated.
- 2026-08-18: Added a separately lazy Right Hand Coaching Studio. It reuses the existing Three.js guitar engine behind an explicit second open action, follows the selected pattern step/string route, mirrors with the saved handedness display, labels chord names as fretting-hand context, and unmounts the renderer when closed. The always-mounted Right Hand 3D preview was removed from the primary player.
- 2026-08-18: Added target-versus-possible-string visualization from retained pitch evidence, authored alternate routes, dynamic demo-volume maps, ghost offbeats, one-problem coaching, adaptive anticipation cues, three-minute focus blocks, bounded guitar setup preferences, consistency/control milestones, local practice-load guidance, metadata-only before/after summaries, timed playlist rehearsal with rests, privacy-safe attributed peer challenge export, and user-gesture-only Web Bluetooth controls with keyboard/on-screen fallbacks.
- 2026-08-18: No new dependencies, audio assets, renderer, background scanning, hosted peer service, upload path, or moderation-backend claim was added. Pitch-to-string feedback remains an explicitly ambiguous estimate; 7/12-string preferences tailor written cues while the current Three.js teaching scene remains a six-string view. Focused TypeScript, lint, source-budget and regression verification are delegated separately.
- TODO: Validate specific Bluetooth pedals using vendor-provided BLE UUIDs and physical hardware. A hosted peer service would require account privacy, abuse reporting, human moderation, consent, and retention infrastructure before any in-app publishing could be enabled.
- 2026-08-23: Fixed 3D right-hand discoverability in the primary player. The technique-specific Show 3D hand action now appears directly below the selected exercise header while idle, before the follow-along pattern; it clearly distinguishes the right-hand string motion from left-hand chord fretting and reports the current step/string targets accessibly.
- 2026-08-23: Removed automatic count-in mounting and the duplicate multi-gate renderer entry inside Advanced Tools. Three.js remains behind one explicit user action, unmounts when hidden or when the exercise changes, and receives the active exercise step, string route, chord context, current handedness, and reduced-motion-safe autoplay behavior. Added mobile containment and full-width CTA styling so the canvas cannot collapse or overflow the primary player.
- TODO: Independent verification should confirm the idle CTA, lazy WebGL boundary, exercise-change disposal, mobile layout, TypeScript/lint, production bundle and existing performance budgets.
- 2026-10-07: Reworked the Three.js acoustic silhouette with a proportionate flared headstock, six tuner posts/buttons, and string segments that continue from the nut to each tuning post. Added calibrated rounded forearms to both authored hand rigs and connected forearm geometry to the fallback hands; widened the fretting camera preset so the active wrist remains in frame. Focused guitar validation and TypeScript checks pass. Browser visual check confirmed the complete headstock/tuners and picking-hand forearm render; the standalone Playwright client was unavailable because the workspace has no `playwright` package, so the in-app browser loop was used instead.
- 2026-10-07: Final geometry/pose pass moved every tuner-post center inside the tapered headstock silhouette, changed the headstock cap to matching neck wood, curled inactive authored picking fingers slightly, and added a conservative fretting-thumb target behind the neck. Guitar validation and TypeScript checks remain green.
- 2026-10-07: Follow-up QA fix parents fallback forearms to their moving wrist meshes (including handedness mirroring) and batches the twelve static string segments into two InstancedMesh batches plus three six-instance tuner batches, avoiding the prior per-part draw-call increase. Validation and TypeScript checks remain green.
- 2026-10-07: Final visual pass fixed the authored GLB armature assumption: its finger joints are flat siblings, so CCD had zero reach. Added a flat-chain contact solver that curves each phalanx onto its target string, corrected thumb placement behind the neck, extended and color-matched forearms, replaced periodic 48px wood bands with 256px deterministic multi-scale grain, and reduced key/exposure washout. Fresh authored-hand screenshots reviewed; guitar validator, TypeScript, and scene capture all pass.
- 2026-10-07: Follow-up visual correction replaced compressed flat-chain placement with a FABRIK length-preserving solve, added neighboring-string curl for picking digits, laterally angled the picking approach, overlapped and rounded elbow/forearm transitions, widened fretting/picking compositions, and verified fresh composed captures with no detached elbow cap. TypeScript and guitar mapping validation pass.
- 2026-10-07: Reworked live hand rendering after inspecting the supplied GLB: its neutral authored surface is now preserved as the visible palm/wrist/finger base, while unsupported flat-sibling IK is bypassed. The calibrated procedural contact path remains available for fallback, with rounded phalanges, exact endpoints, and joined forearm geometry. Side lighting was lifted for readable mahogany and fresh neutral authored captures were inspected.
- 2026-10-07: Neutral authored hand captures confirmed a coherent palm/wrist/finger silhouette, unlike the posed flat-sibling deformation. Final live pose preserves that authored base, lowers the wrist anchors conservatively toward the string plane, keeps the procedural rig available only for fallback, and retains full-body/headstock composition. Focused validator, TypeScript, and scene capture pass.
- 2026-10-07: Rebuilt the authored GLB finger chains once at load time with bind-preserving `Object3D.attach()` parenting and cloned-skeleton inverse recalculation, then restored conservative CCD contact posing. Active picking poses now establish the relaxed curl before fingertip IK; the old post-IK splay is gone. The picking forearm now approaches from the near-side bout and tapers beyond the camera rather than ending over the rosette. Fresh scene captures were inspected; guitar validation, scene-check, TypeScript, and console-error checks pass.
- 2026-10-07: Tuned authored contact anchors from live fingertip diagnostics: fretting index/middle/ring and picking index now converge on their string/fret targets, with role-specific joint envelopes preserving the neutral GLB silhouette. The arm profile now remains softly tapered while continuing beyond the composed frame, eliminating the visible elbow cap. Increased deterministic multi-scale spruce grain and warm mahogany side emission for clearer wood separation. Ready-state full and contact-close captures were inspected.
- 2026-10-07: Replaced the oversized authored forearm extrusion with the supplied GLB wrist blend only, preserving the neutral hand surface while avoiding a diagonal tube across the guitar. Fretting contact IK now blends back toward bind for visible curved pads, biases the GLB skin offset laterally, and leaves the thumb in its neutral support pose. Plectrum mode keeps the authored hand neutral, exposes an emissive pick between the thumb/index region, and leaves fallback forearms intact for asset failures. Fresh ready-state fretting, picking, and plectrum captures were inspected.
- 2026-10-07: Visual review confirmed the supplied GLB has shared low-poly distal weights that can leave one lateral digit visually straighter than its hidden joint target. The implementation now prioritizes the neutral authored silhouette, conservative visible-pad contact, a wrist-only authored presentation, and an explicit emissive plectrum; this avoids the previously unacceptable oversized arm extrusion. Focused validation, TypeScript, scene-check, and console-error checks remain green.
- 2026-10-07: Added a connected articulated hand overlay for the loaded authored rigs after the supplied GLB's active skin was confirmed to collapse around flat sibling joints. Rendered palms, tapered capsules, rounded joints, pads, nails, and a curved/tapered forearm now share the calibrated wrist and drive visible fingertip contacts directly; the GLB remains lazy-loaded for calibration and fallback continuity. Fresh ready-state full/close captures were inspected, with guitar validation and TypeScript checks passing.
- 2026-10-07: Replaced the visible capsule chains with continuous smooth variable-radius lofts: one curved tapered forearm and one organic loft per finger/thumb, with smooth normals and rounded contact profiles. Visible fretting tips now use the true string/fret target rather than the hidden GLB lateral calibration bias; mahogany side emission was warmed while retaining the validator-approved wood palette. Fresh settled full/close views were inspected; focused validation and TypeScript remain green.
- 2026-10-07: Finalized the loft pass by routing the picking arm from the near-side wrist and beyond the frame, lifting rendered picking pads just above the string plane for visible contact, and keeping the continuous variable-radius arm silhouette seam-free. Ready-state fretting/picking captures and the focused scene-check were inspected; guitar mapping, TypeScript, diff, and console-error checks pass.
- 2026-10-07: Bounded final refinement kept the loft forearm thick and softly tapered through the camera-edge exit instead of ending in a pointed noodle, added stronger curved finger paths, and separated picking thumb/index pads around their shared pick target. Fresh settled close/full captures were inspected; current local WebXR hand assets remain the realism ceiling because the replacement CC0 download is unavailable offline.
- 2026-10-07: QA-directed cleanup shortened the authored forearm exit from the oversized 40-unit path to a rounded near-edge segment, removed the stale `skipPickingIK` assignment, and retained direct thumb/index pinch posing for plectrum contact. Fresh ready-state captures and scene-check completed with mapping, TypeScript, diff, and console checks green.
- 2026-10-07: Final scale correction limits the visible authored forearm loft to a softly bowed ~5-world-unit path (with a tapered near-edge end) instead of the prior 21.5-unit extrusion; fretting roll and camera-edge routing preserve wrist/finger targets. A fresh cache-busted settled capture was inspected for full and close views, with no console errors.
- 2026-10-07: Staged the approved Innerscene CC0 anatomical right-hand GLB locally (`public/models/guitar-technique/hand-posable.glb`, 506,476 bytes; SHA-256 recorded in `LICENSE.md`). The lazy authored-hand loader now normalizes its 16-bone hierarchy (with generated fingertip endpoints), mirrors the cloned rig for left-handed scenes, preserves the imported skinned surface, and keeps the procedural overlay hidden for this validated asset. Connected forearms were recolored and rerouted as a smooth, tapered loft that exits the teaching frame. Focused TypeScript, guitar mapping validation, diff check, and in-app visual inspection of picking/fretting states and orbit/reset controls pass. Standalone Playwright remains unavailable because the workspace has no `playwright` package; browser inspection used the in-app browser instead.
- 2026-10-07: Second visual pass narrowed the active fretting/picking camera presets to hand-scale teaching compositions, removed the Innerscene-specific lateral fingertip bias that could bunch source fingers, and routed the fretting forearm laterally instead of vertically. Procedural guitar presentation gained a dedicated directional fretboard grain, raised rounded bridge saddle bed, and a raised sound-hole lip while preserving all physical scale/contact constants. `guitar3d:validate` now checks the anatomical GLB hash, CC0 attribution, 16 source bones, and the new guitar-detail markers. TypeScript, focused validation, and diff checks pass; fresh browser capture was unavailable in this subagent session, so independent QA must visually confirm the revised composition.
- 2026-10-07: Third correction pass addressed QA placement findings: left-handed instances now retain positive source scale and rely on the role/handedness basis rather than double X-mirroring; picking wrist anchoring is shifted behind the bridge so source fingers approach the sound hole instead of reaching over the neck; fretting forearms use a lateral off-frame route and the loft endpoint is extended beyond the stage to avoid a visible cutoff. Focused TypeScript, guitar validation, and diff checks pass. Fresh browser capture was unavailable because the CUA browser surface was not present in this subagent session; independent QA should confirm left-handed palm orientation and final hand contacts.
- 2026-10-07: Independent third-pass QA passed guitar validation, TypeScript, diff checks, production build, source performance budgets, and reported no captured canvas console errors. Visual acceptance still fails: both handedness modes show implausible forearm routes and turned/collapsed fingers without convincing string contact; picking does not land naturally over the sound hole. Mobile reproduces the defects. The CC0 source GLB/retarget combination is not a viable posed-hand asset in the current scene; stop before claiming completion and source a properly deforming articulated hand asset (or obtain an approved direction for a different hand solution). The built `/right-hand` bundle check also remains over its 400 kB budget; emitted chunk set changed between builds, so reported totals are not directly comparable. QA artifacts were generated under `.test-artifacts/guitar-qa/third/` for review.
## Guitar 3D CC0 hand authoring

- Added `scripts/author-chord-hand-assets.py`, a Blender GUI-safe exporter for
  the neighboring Drum Hero CC0 bilateral hand rig. It writes
  `public/models/guitar-technique/cc0-left.glb` and `cc0-right.glb` with the
  independently weighted finger bones plus a connected forearm, and records
  the source license alongside the runtime assets.
- Updated the lazy hand loader to prefer those authored GLBs and map the
  source `Bone.*` chains into the existing physical fingertip contact solver.
  The pre-export Innerscene asset remains an explicit fallback and is surfaced
  through the existing authored-status label (it is not marked `ready`), not
  treated as a successful CC0 load.

- 2026-10-10 QA outcome: the latest 15:21 Blender export exists and focused
  TypeScript, math, asset, and contact checks pass, but browser visual
  acceptance still fails. The bundled CC0 mesh has only a truncated wrist
  stump (no forearm/elbow), low-relief merged palm/finger topology, and one
  untextured source material; generated forearm lofts therefore read as a
  tube/wedge rather than connected anatomy. A replacement must provide a
  watertight hand-to-mid-forearm/elbow mesh, wrist/elbow skin weights,
  articulated finger chains with a neutral curved pose, and embedded CC0- or
  otherwise approved-license skin materials/textures. No further geometry
  acceptance is claimed for the current source.

## Blender-authored acoustic guitar

- Added `scripts/author-chord-guitar-asset.py`, which builds a measured static
  instrument in the existing 25.5-inch / 10.5-unit coordinate frame: deep
  body and spruce soundboard, recessed soundhole/rosette, radiused ebony
  board, 20 crowned frets, six speaking/headstock strings, nut, bridge,
  saddle, pins, inlays, headstock, and tuner hardware.
- Added a lazy loader that swaps the current procedural guitar only after the
  authored GLB validates its scene bounds. Until export succeeds, the UI
  explicitly reports `procedural fallback`; the rejected downloaded candidate
  is not used.
- 2026-10-09: Focused static QA passes: TypeScript no-emit, Blender-script
  Python compilation, and diff checks. Blender GLB exports and composed
  browser visual QA remain pending; no visual acceptance is claimed yet.
- 2026-10-09: Independent focused recheck passed `npm run
  guitar3d:validate`, `npm run test:web:types`, and `git diff --check`; no full
  suite was run. `cc0-left.glb`, `cc0-right.glb`, and
  `acoustic-guitar-authored.glb` are still absent, so runtime remains on its
  explicit fallbacks. Blender UI export and visual acceptance are blocked until
  the locked macOS session is unlocked.
- 2026-10-10 follow-up supersedes the 2026-10-09 pending/absent-asset status:
  both authored guitar and CC0 hand GLBs were exported and loaded in the
  browser. Focused checks pass; after animation settled, runtime diagnostics
  remained at 13 render calls and 49 renders after the strum. Overall visual
  acceptance remains incomplete because the hand/forearm source gap persists
  and the current guitar finish still reads stylized/flat.

## Right-hand learning and audio evidence · 2026-10-19

- Final static verification passed: TypeScript, content, localization, guitar3d,
  the new learning and audio validators, all nine test-group runner tests,
  production build, and diff checks. Lint completed with unrelated existing
  warnings. Emitted `/right-hand` assets are 383,700 / 400,000 bytes.
- Browser verification exercised desktop/mobile 3D access, the actual timed
  hear-and-repeat flow, onboarding applied at 48 BPM, authored phrasing,
  exact nine-file offline preparation, teacher goals against accepted results,
  and disputed-take removal from the spaced-review queue.
- Storage verification used an actual 12,345-byte recording, confirmed original
  audio export and bulk deletion, and tested evaluator missing-file/consent
  gates. A synthetic evaluator sample matched 4/4 annotated attacks with 4 ms
  mean absolute onset error; this does not establish real-recording accuracy.
- The evaluator report's mobile overflow was fixed and rechecked at a 390 px
  viewport with document width also 390 px. No browser console errors were
  observed. The verifier is cleaning its exact generated artifacts.

## Right-hand practice refinement · 2026-10-21

- Added authored alternate/economy route comparison and string-crossing directions,
  plus a separately scheduled thumb/melody gain-layer demo. Polyphonic microphone
  volume is explicitly not presented as independent finger measurement.
- Added full-pattern transfer checks gated on a new accepted reliable recording
  with matching immutable tempo/pattern/progression and ≥80% canonical timing.
  Self-ratings, disputed/older takes and trimmed rescoring cannot award the flag.
- Added bounded v1 drill/tempo/loop/3D-step continuity with explicit playback,
  exact-range retry after state commit, evidence/reason session-next-action copy,
  and per-file offline repair that skips verified cached audio.
- Focused learning/audio/type validators passed. The review-controls validator is
  included in the existing audio test script and CI group; no native full suite
  or real-recording accuracy claim is implied by these synthetic checks.

## Right-hand workflow pass · 2026-10-21

- Replaced the single-warmup three-minute shortcut with a coordinated warmup,
  focused drill and chord-context application: three one-minute rounds with
  count-ins, explicit rests, pause/restart and cancellation controls.
- Added quantitative near-full-scale input diagnostics. Material saturation
  withholds reliable-score status; isolated peaks remain distinct from sustained
  clipping heuristics. Microphone evidence still cannot identify exact strings.
- Recaps separate round completion from measured evidence and compare only
  accepted, retained full-source takes with matching tempo, pattern and chords.
- Added previewed manual JSON backup/merge for Right Hand progress, preferences,
  libraries, routines and history. Audio, recording IDs and device calibration
  are excluded; imported summaries cannot establish recorded mastery. Storage
  rollback and reload-persistence guards preserve existing data.
- Added focused validator coverage; independent verification is pending.
