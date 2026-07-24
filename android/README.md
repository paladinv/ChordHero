# Chord Hero for Android

Native Android 15+ parity client for Chord Hero.

## Requirements

- JDK 17
- Android SDK Platform 35 and 36
- Android SDK Build Tools 36.0.0
- An API 35 or API 36 emulator or physical device for instrumented tests

The Gradle wrapper and all build metadata are checked in. The app uses `minSdk 35`, `targetSdk 36`, and application ID `com.codingmonkey.chordhero`.

## Build and test

```bash
./gradlew testDebugUnitTest
./gradlew lintDebug
./gradlew assembleDebug
./gradlew bundleRelease
./gradlew connectedDebugAndroidTest
```

The release variant is optimized but intentionally unsigned. Configure signing outside source control when preparing a Play Console release.

## Shared content

`app/build.gradle.kts` adds `../shared/content/v1` directly to the main asset source set. Do not copy those JSON files into this directory. Validate changes from the repository root:

```bash
npm run content:validate
npm run build
```

The Android-specific UC-01–69 contract is in `docs/android-use-cases.md`.
