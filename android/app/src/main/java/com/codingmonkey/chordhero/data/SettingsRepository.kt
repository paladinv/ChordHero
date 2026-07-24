package com.codingmonkey.chordhero.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore("chord_hero_settings")

data class AppSettings(
    val destination: String = "dashboard",
    val trainerLevel: Int = 0,
    val trainerAutomatic: Boolean = true,
    val tuningId: String = "standard",
    val capo: Int = 0,
    val voice: String = "steel",
    val metronome: Boolean = true,
    val reducedMotion: Boolean = false,
)

class SettingsRepository(private val context: Context) {
    private object Keys {
        val destination = stringPreferencesKey("destination")
        val trainerLevel = intPreferencesKey("trainer_level")
        val trainerAutomatic = booleanPreferencesKey("trainer_automatic")
        val tuning = stringPreferencesKey("tuning")
        val capo = intPreferencesKey("capo")
        val voice = stringPreferencesKey("voice")
        val metronome = booleanPreferencesKey("metronome")
        val reducedMotion = booleanPreferencesKey("reduced_motion")
    }

    val settings: Flow<AppSettings> = context.dataStore.data.map {
        AppSettings(
            destination = it[Keys.destination] ?: "dashboard",
            trainerLevel = it[Keys.trainerLevel] ?: 0,
            trainerAutomatic = it[Keys.trainerAutomatic] ?: true,
            tuningId = it[Keys.tuning] ?: "standard",
            capo = it[Keys.capo] ?: 0,
            voice = it[Keys.voice] ?: "steel",
            metronome = it[Keys.metronome] ?: true,
            reducedMotion = it[Keys.reducedMotion] ?: false,
        )
    }

    suspend fun update(block: (AppSettings) -> AppSettings) {
        context.dataStore.edit { preferences ->
            val old = AppSettings(
                destination = preferences[Keys.destination] ?: "dashboard",
                trainerLevel = preferences[Keys.trainerLevel] ?: 0,
                trainerAutomatic = preferences[Keys.trainerAutomatic] ?: true,
                tuningId = preferences[Keys.tuning] ?: "standard",
                capo = preferences[Keys.capo] ?: 0,
                voice = preferences[Keys.voice] ?: "steel",
                metronome = preferences[Keys.metronome] ?: true,
                reducedMotion = preferences[Keys.reducedMotion] ?: false,
            )
            val next = block(old)
            preferences[Keys.destination] = next.destination
            preferences[Keys.trainerLevel] = next.trainerLevel
            preferences[Keys.trainerAutomatic] = next.trainerAutomatic
            preferences[Keys.tuning] = next.tuningId
            preferences[Keys.capo] = next.capo
            preferences[Keys.voice] = next.voice
            preferences[Keys.metronome] = next.metronome
            preferences[Keys.reducedMotion] = next.reducedMotion
        }
    }
}
