package com.codingmonkey.chordhero.services

import android.content.Context
import android.media.MediaPlayer
import android.media.MediaRecorder
import java.io.File
import java.util.UUID

class SongRecorderService(private val context: Context) {
    var isRecording: Boolean = false
        private set
    var latestFile: File? = null
        private set
    private var recorder: MediaRecorder? = null
    private var player: MediaPlayer? = null

    fun start(songId: String, sectionId: String? = null): Boolean {
        if (isRecording) return false
        val directory = File(context.filesDir, "song-recordings").apply { mkdirs() }
        val suffix = sectionId?.let { "-$it" } ?: ""
        val file = File(directory, "$songId$suffix-${UUID.randomUUID()}.m4a")
        return runCatching {
            val active = MediaRecorder(context)
            active.setAudioSource(MediaRecorder.AudioSource.MIC); active.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4); active.setAudioEncoder(MediaRecorder.AudioEncoder.AAC); active.setOutputFile(file.absolutePath); active.prepare(); active.start(); recorder = active; latestFile = file; isRecording = true
        }.isSuccess
    }

    fun stop() { runCatching { recorder?.stop() }; recorder?.release(); recorder = null; isRecording = false }
    fun playLatest() { val file = latestFile ?: return; player?.release(); player = MediaPlayer().apply { setDataSource(file.absolutePath); prepare(); setOnCompletionListener { release() }; start() } }
    fun deleteLatest() { stop(); latestFile?.delete(); latestFile = null }
}
