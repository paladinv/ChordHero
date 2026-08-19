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

The 3D Right Hand coach reuses the app's single Three.js technique engine and creates a renderer only after the learner opens the 3D view. It demonstrates the hand that sounds strings near the soundhole/bridge; chord labels are context for the separate fretting hand. Microphone string-hit highlights are explicitly possible-string estimates because pitch alone cannot identify a unique fretted string. Peer challenges are local attributed JSON files without recordings or profile data, and Bluetooth pedal support requires a compatible browser plus the device vendor's BLE service/characteristic UUIDs; keyboard and on-screen fallbacks remain available.

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
