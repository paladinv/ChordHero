package com.codingmonkey.chordhero.services

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import com.codingmonkey.chordhero.domain.ChordDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.pow
import kotlin.math.sin

interface AudioService {
    fun click(accent: Boolean = false)
    fun preview(chord: ChordDefinition, arpeggio: Boolean, voice: String)
    fun stop()
}

class SynthAudioService(context: Context) : AudioService {
    private val scope = CoroutineScope(Dispatchers.Default + Job())
    private val manager = context.getSystemService(AudioManager::class.java)
    private var track: AudioTrack? = null
    private val focusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
        .setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build(),
        )
        .setOnAudioFocusChangeListener { if (it == AudioManager.AUDIOFOCUS_LOSS) stop() }
        .build()

    override fun click(accent: Boolean) {
        play(listOf(if (accent) 1_200.0 else 850.0), durationMillis = 55, staggerMillis = 0, muted = false)
    }

    override fun preview(chord: ChordDefinition, arpeggio: Boolean, voice: String) {
        val openMidi = listOf(40, 45, 50, 55, 59, 64)
        val notes = chord.frets.mapIndexedNotNull { index, fret ->
            if (fret < 0) null else openMidi[index] + fret
        }.map(AudioMath::midiToFrequency)
        play(
            frequencies = notes,
            durationMillis = if (voice == "muted") 180 else 650,
            staggerMillis = if (arpeggio || voice == "picked") 90 else 24,
            muted = voice == "muted",
        )
    }

    private fun play(frequencies: List<Double>, durationMillis: Int, staggerMillis: Int, muted: Boolean) {
        if (frequencies.isEmpty()) return
        scope.launch {
            manager.requestAudioFocus(focusRequest)
            stopTrack()
            val sampleRate = 44_100
            val totalMillis = durationMillis + staggerMillis * (frequencies.size - 1)
            val samples = ShortArray(sampleRate * totalMillis / 1_000)
            frequencies.forEachIndexed { index, frequency ->
                val start = sampleRate * staggerMillis * index / 1_000
                val length = sampleRate * durationMillis / 1_000
                repeat(length.coerceAtMost(samples.size - start)) { frame ->
                    val progress = frame.toDouble() / length
                    val envelope = if (muted) (1.0 - progress).pow(8) else (1.0 - progress).pow(2)
                    val value = sin(2 * PI * frequency * frame / sampleRate) * envelope / frequencies.size
                    samples[start + frame] = (samples[start + frame] + value * Short.MAX_VALUE * 0.75)
                        .toInt().coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort()
                }
            }
            track = AudioTrack.Builder()
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                )
                .setAudioFormat(
                    AudioFormat.Builder()
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setSampleRate(sampleRate)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .build(),
                )
                .setBufferSizeInBytes(samples.size * 2)
                .setTransferMode(AudioTrack.MODE_STATIC)
                .build()
                .also {
                    it.write(samples, 0, samples.size)
                    it.play()
                }
            delay(totalMillis.toLong() + 50)
            stopTrack()
            manager.abandonAudioFocusRequest(focusRequest)
        }
    }

    override fun stop() {
        stopTrack()
        manager.abandonAudioFocusRequest(focusRequest)
    }

    private fun stopTrack() {
        runCatching { track?.pause() }
        runCatching { track?.flush() }
        runCatching { track?.release() }
        track = null
    }
}

object AudioMath {
    fun midiToFrequency(note: Int): Double = 440.0 * 2.0.pow((note - 69) / 12.0)
}
