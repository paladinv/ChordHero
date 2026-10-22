# Chord Hero

A timed chord‑switching practice game for guitar players. The app flashes a chord + diagram every 3 seconds for 10 chords, then pauses on a level‑up achievement.

## Features
- 3‑second chord flashes with animated focus
- 10‑chord rounds with level‑up modal
- Open chord and barre chord progression
- Manual difficulty selector or auto‑advance
- Right-hand studio with 36 strumming, plectrum, and fingerpicking drills
- Beginner, intermediate, and expert practice filters
- Animated follow-along patterns with adjustable tempo and optional audio clicks
- Lazy microphone coach with calibration, beat timing, root-pitch evidence, harmonic-template chord confidence, and last-two-take comparison
- Per-drill goals, clean-streak speed ladders, style presets, custom chord backing, guided milestones, and local practice history
- User-opened Practice Lab with live onset cues, demo-only slow motion, target-voicing and backing-mix controls, no-look/performance modes, a six-part skill map, adaptive warmups, fatigue and recovery prompts, bookmarks, named playlists, personal notes, and constrained random drills
- Separately lazy Right Hand Coaching Studio with an on-demand Three.js right-hand/string-motion view, target-versus-estimated string feedback, dynamics and ghost-stroke targets, single-skill coaching, three-minute focus blocks, guitar setup cues, control-based milestones, before/after take summaries, timed playlist rehearsals, local peer-challenge export, and opt-in BLE/keyboard foot controls
- Validated attributed challenge-pack JSON import/export; imported exercise references and metadata stay available offline in local browser storage
- Local teacher assignments with consent-safe audio/video links or recording references

Right-hand microphone analysis runs only after the learner opens the coach and grants permission. Learners can calibrate the target progression to their own guitar/tuning, then choose timing-only, root, or root-and-quality evidence. Full-guitar results are confidence estimates rather than guaranteed chord recognition. Recording privacy is explicit: retain the last two takes locally, keep a take in memory for manual export, or prepare teacher-share metadata without uploading audio. Close-up video uses a local approved-source registry with required creator/licence/attribution plus optional captions, transcript, and left-handed footage; Chord Hero supplies no footage and does not verify rights. Teacher media links and timestamped recording references are metadata only—Chord Hero does not provide hosted accounts or upload storage.

Live listen mode is a lightweight attack-to-pulse guide, not continuous chord recognition. Target sounds reuse and filter the app's existing guitar samples rather than downloading instrument libraries. Skill-map values are practice-history indicators, performance scorecards clearly distinguish microphone timing evidence from completion-only results, and community/teacher challenge packs require local JSON import—there is no hosted community catalogue or automatic rights verification.

The 3D Right Hand display is a prominent, one-action control at the top of the primary Right Hand player, including while idle. It reuses the app's single Three.js technique engine and creates a renderer only after the learner selects **Show 3D hand**; changing exercises or hiding the display unmounts it. The view follows the current pattern step and target strings, respects handedness and reduced-motion preferences, and demonstrates the hand that sounds strings near the soundhole/bridge. Chord labels are context for the separate fretting hand. Microphone string-hit highlights are explicitly possible-string estimates because pitch alone cannot identify a unique fretted string. Peer challenges are local attributed JSON files without recordings or profile data, and Bluetooth pedal support requires a compatible browser plus the device vendor's BLE service/characteristic UUIDs; keyboard and on-screen fallbacks remain available.

Advanced Right Hand controls use Learn, Practise, Review, and Settings sections while preserving their values. Listening rounds silence the app's reference audio; recorded takes close its playback context before capture. Room calibration and optional click-to-tap timing compensation stay local, with uncertain pitch evidence excluded and insufficient timing withheld. Pin up to four reference recordings across drills for weekly listening comparisons. Rehearsal playlists start explicitly, advance through 60-second drills with selectable rests and a next-drill preview, and the session recap reports completed loops plus repeated misses only when a reliable take supports them.

## Song Builder

Open `/song-builder` to compose guitar, ukulele, and bass parts. The Compose, Arrange, Practice, and Export workspaces keep related controls together and retain an interactive score alongside them on wide screens. A guided four-bar introduction creates its own practice song. Start from blank, pop, blues, fingerpicking, or bass templates.

Click a score note to edit it, click a score measure to play from there, or drag across score measures to select a loop. The full-song timeline supports zoom, note dragging between bars/tracks, duration handles, and keyboard movement (arrows; Shift+arrows resize). The rhythm palette and duration editor split notes across barlines with ties. Playback supports dynamics, articulations, adjustable bends, slide destinations, connected hammer-ons/pull-offs, and strum timing. Fingering suggestions preserve pitches and rank nearby string positions. Undo/redo uses Ctrl/Command+Z, Shift+Ctrl/Command+Z, or Ctrl/Command+Y outside text inputs.

Generate strumming, picking, root/fifth bass lines, or pop, rock, shuffle, half-time, and disco drum grooves. Save reusable phrases across songs, personal composition templates in this browser, and acoustic, simplified, fingerstyle, or live arrangements within a song. Changes, phrases, up to 12 arrangement snapshots, up to 20 recent revisions, and section-by-section pitch feedback history are kept in the local Song Library and its backups.

The Compose workspace can suggest common major/minor progressions from the song key, capture pitches from a connected Web MIDI device, or transcribe a short audio clip as a melody or multiple pitches. Transcription shows the source waveform, pitch confidence or frame stability, editable timing, and an optional beat estimate. Simultaneous pitches are grouped into chord tones when added. MIDI and microphone capture are quantized to the selected grid; microphone and file audio are analyzed locally and are not recorded. Add bar-specific rehearsal notes, compare saved arrangements bar by bar, and use swing, humanized timing, track tones, and per-track reverb in playback. Practice feedback keeps a local history per section and suggests a slower or faster playback tempo from recent accuracy.

Score exports support tab, staff, both, and a lyric/chord lead sheet, with selectable parts, adaptive spacing, beamed rhythms, rests, key signatures, dynamics, section breaks, chord diagrams, Letter/A4 paper, and portrait/landscape PDF orientation. Share a portable composition through the device share sheet or export its file. Import MIDI formats 0/1, uncompressed score-partwise MusicXML, compressed `.mxl`, or portable `.chordsong.json` files. MusicXML handles grace notes, explicit pickup lengths, mid-measure tempo changes, and common forward/backward repeats with numbered endings. Nested repeats must be expanded in the source score first. Review imported string assignments before exporting tablature. Compose-level tempos are 40–240 BPM; playback scales independently.

Export the current mix or individual stems as stereo 44.1 kHz PCM WAV (up to ten minutes), or use MIDI/MusicXML for other music software. Bass, piano, and vocal preview sounds use instrument-specific synthesis while guitar and ukulele use the app’s guitar samples. Portable composition files retain phrases and arrangement versions. Optional manual cloud sync merges library records and supports viewer/editor access. It requires server-configured account tokens; the browser keeps the token in page memory and uses short-lived tickets for live WebSocket connections.

To run the sync server, generate a separate random token for every collaborator with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`. Configure `CHORD_HERO_SYNC_ACCOUNTS` as a JSON object mapping collaborator IDs to those tokens, then run `npm run sync-server`. The Song Builder, Practice, and student profile sync panels ask for the configured account token; each keeps it in page memory instead of browser storage. The server binds to `127.0.0.1` by default; set `CHORD_HERO_SYNC_HOST=0.0.0.0` only when the host should accept remote traffic. For a separate web origin, set `CHORD_HERO_SYNC_ORIGINS` to the exact comma-separated origins. Keep tokens in the server’s private environment, use HTTPS for remote deployments, and rotate a collaborator token by replacing its environment value. The default library store is `server/sync-store.json`; set `CHORD_HERO_SYNC_STORE` to a private persistent path when deploying.

Practice takes start only after pressing Record and granting microphone permission. Use headphones to avoid recording the backing through the microphone. Takes and notes are stored in IndexedDB on this device; synchronized replay uses the recorded count-in offset and warns when the score changes. Download takes separately: their audio is not included in composition or Song Library backups. Up to 20 takes are kept per song.

Run `npm run test:web:song-builder` for composition, persistence, pattern, split-note, tempo-map, MIDI exchange, and pagination regression checks.

## Local development
1. Install dependencies: `npm install`
2. Run the dev server: `npm run dev`
3. Open `http://localhost:3000`

## Native iOS app
1. Open `ios/ChordHero/ChordHero.xcodeproj` in Xcode 26 or newer.
2. Select an iPhone or iPad simulator and run the `ChordHero` scheme.
3. Choose your Apple Development Team only when installing on a physical device.

The native SwiftUI app supports iOS 17+, works offline, and shares its versioned chord, song,
exercise, progression, and tuning content with the web app through `shared/content/v1`. Song Library
collections and source links are stored locally on each device.

Run `npm run content:validate` after content edits. Maintainers with XcodeGen installed can regenerate
the checked-in project from `ios/ChordHero/project.yml`.

Run only checks related to changed and untracked files with `npm run test:changed`. Select groups
directly with `npm run test:groups -- web:content,android:unit`; list available groups with
`npm run test:groups -- --list`. Unknown paths safely select the full suite. `npm run test:all` runs
the complete non-visual suite. The production web build and its performance budget stay in one
group; visual comparison is opt-in with `npm run test:visual` after supplying captured baseline and
current PNG directories. Pull requests run the test groups as parallel CI jobs. Node.js 22.6 or
later is required.

## Native Android app

The Android 15+ Jetpack Compose app is checked in at `android/` and consumes the same versioned content under `shared/content/v1`.

Prerequisites are JDK 17 and Android SDK platforms 35 and 36 with Build Tools 36.0.0. Then run:

```bash
cd android
./gradlew testDebugUnitTest lintDebug assembleDebug
```

Instrumented acceptance tests run with:

```bash
./gradlew connectedDebugAndroidTest
```

The matching repository-root commands are `npm run test:android:unit` and
`npm run test:android:instrumented`.

The application ID is `com.codingmonkey.chordhero`. Release signing and Play Console configuration are intentionally unset.

## Deploy to Vercel
1. Push this repo to GitHub.
2. In Vercel, click **New Project** and import the repo.
3. Keep defaults. Framework preset: Next.js.
4. Deploy.

## Structure
- `app/` Next.js app router pages and styles
- `components/` reusable UI components
- `public/` static assets
- `shared/content/v1/` versioned web/iOS/Android content contract
- `ios/ChordHero/` native SwiftUI app, unit tests, UI tests, and checked-in Xcode project
- `android/` native Jetpack Compose app, JVM tests, and instrumented UI tests
- `docs/mobile-use-cases.md` mobile use cases and acceptance-test catalogue
- `docs/android-use-cases.md` Android-specific UC-01–69 behavior and acceptance matrix
- `tests/` focused Node regression checks for test selection and web behavior helpers
