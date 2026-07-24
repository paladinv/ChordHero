package com.codingmonkey.chordhero.app

import android.app.Application
import com.codingmonkey.chordhero.data.AssetContentRepository
import com.codingmonkey.chordhero.data.ChordHeroDatabase
import com.codingmonkey.chordhero.data.ContentRepository
import com.codingmonkey.chordhero.data.ProgressRepository
import com.codingmonkey.chordhero.data.RoomProgressRepository
import com.codingmonkey.chordhero.data.SettingsRepository
import com.codingmonkey.chordhero.services.AndroidDocumentService
import com.codingmonkey.chordhero.services.AndroidMidiService
import com.codingmonkey.chordhero.services.AudioService
import com.codingmonkey.chordhero.services.DocumentService
import com.codingmonkey.chordhero.services.MidiService
import com.codingmonkey.chordhero.services.SynthAudioService

class ChordHeroApplication : Application() {
    val container: AppContainer by lazy { AppContainer(this) }
}

class AppContainer(application: Application) {
    private val database = ChordHeroDatabase.create(application)
    val content: ContentRepository = AssetContentRepository(application)
    val progress: ProgressRepository = RoomProgressRepository(database)
    val settings = SettingsRepository(application)
    val audio: AudioService = SynthAudioService(application)
    val midi: MidiService = AndroidMidiService(application)
    val documents: DocumentService = AndroidDocumentService(application)
}
