package com.codingmonkey.chordhero

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.codingmonkey.chordhero.data.AssetContentRepository
import com.codingmonkey.chordhero.data.ChordHeroDatabase
import com.codingmonkey.chordhero.data.ChordProgressEntity
import com.codingmonkey.chordhero.data.ContentValidator
import com.codingmonkey.chordhero.data.RoomProgressRepository
import com.codingmonkey.chordhero.domain.ContentLoadResult
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.assertThrows
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ContentAndPersistenceTest {
    private lateinit var database: ChordHeroDatabase

    @Before
    fun setUp() {
        database = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext(),
            ChordHeroDatabase::class.java,
        ).allowMainThreadQueries().build()
    }

    @After
    fun tearDown() = database.close()

    @Test
    fun sharedContentInventoryAndReferencesValidate() = runTest {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val result = AssetContentRepository(context).load()
        assertTrue(result is ContentLoadResult.Ready)
        val content = (result as ContentLoadResult.Ready).content
        val sevenStringTuning = content.settings.tunings.single { it.id == "standard-7" }
        assertEquals(7, sevenStringTuning.strings.size)
        assertEquals(sevenStringTuning.strings.size, sevenStringTuning.semitoneOffsets.size)
        assertTrue(content.chords.levels.flatMap { it.chordIds }.all { id -> content.chords.chordLibrary.any { it.id == id } })
        val malformed = content.copy(settings = content.settings.copy(
            tunings = content.settings.tunings.map { tuning ->
                if (tuning.id == "standard-7") tuning.copy(semitoneOffsets = tuning.semitoneOffsets.dropLast(1)) else tuning
            },
        ))
        assertThrows(IllegalArgumentException::class.java) { ContentValidator.validate(malformed) }
    }

    @Test
    fun firstProfileIsSeededAndProgressIsIsolated() = runTest {
        val repository = RoomProgressRepository(database)
        val first = repository.ensureSelectedProfile()
        val second = repository.createProfile("Student")
        repository.save(ChordProgressEntity(first.id, "c", favorite = true))
        repository.save(ChordProgressEntity(second.id, "c", favorite = false))
        assertTrue(repository.progress(first.id).first().single().favorite)
        assertEquals(false, repository.progress(second.id).first().single().favorite)
        repository.selectProfile(second.id)
        assertEquals(second.id, repository.ensureSelectedProfile().id)
    }
}
