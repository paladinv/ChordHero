# Chord Hero

A timed chord‑switching practice game for guitar players. The app flashes a chord + diagram every 3 seconds for 10 chords, then pauses on a level‑up achievement.

## Features
- 3‑second chord flashes with animated focus
- 10‑chord rounds with level‑up modal
- Open chord and barre chord progression
- Manual difficulty selector or auto‑advance
- Right-hand studio with 30 strumming, plectrum, and fingerpicking drills
- Beginner, intermediate, and expert practice filters
- Animated follow-along patterns with adjustable tempo and optional audio clicks

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
