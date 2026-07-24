# Chord Hero mobile parity contract

The native iOS and Android apps consume `shared/content/v1` and preserve the stable identifiers in those files.

| Area | iOS 17+ | Android 15+ |
| --- | --- | --- |
| App shell and accessibility (UC-01–06) | SwiftUI adaptive navigation | Compose adaptive navigation, TalkBack, edge-to-edge |
| Trainer (UC-10–18) | Monotonic cancellable tasks | Coroutines and elapsed realtime deadlines |
| Right-hand studio (UC-20–27) | SwiftUI + generated audio | Compose + AudioTrack synthesis |
| Song Coach (UC-30–37) | SwiftUI + generated audio | Compose + AudioTrack synthesis |
| Song Library (UC-38–42) | SwiftData, browser links, SwiftUI | Room, Android intents, Compose |
| Library and study (UC-40–57) | SwiftData/Core MIDI | Room/DataStore/Android MIDI |
| Packs and teacher tools (UC-60–69) | Files/PDF/share/print | Storage Access Framework/PdfDocument/PrintManager/Sharesheet |

The Android implementation lives in `android/`, uses application ID `com.codingmonkey.chordhero`, and supports Android 15/API 35 and newer. Both clients preserve the same review intervals, pack shapes, timer behavior, profile isolation, and PDF card limits.

Parity is accepted by running the same content fixtures, scheduling intervals, import/export samples, and use-case scenarios on both platforms. Platform-specific deviations must be recorded against the relevant UC identifier in `docs/android-use-cases.md`.
