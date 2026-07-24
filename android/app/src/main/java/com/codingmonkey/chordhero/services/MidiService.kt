package com.codingmonkey.chordhero.services

import android.annotation.SuppressLint
import android.content.Context
import android.media.midi.MidiDevice
import android.media.midi.MidiDeviceInfo
import android.media.midi.MidiManager
import android.media.midi.MidiOutputPort
import android.media.midi.MidiReceiver
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow

sealed interface MidiConnectionState {
    data object Unavailable : MidiConnectionState
    data object Disconnected : MidiConnectionState
    data class Connected(val name: String) : MidiConnectionState
}

interface MidiService {
    val state: StateFlow<MidiConnectionState>
    val notes: SharedFlow<Int>
    fun start()
    fun stop()
}

class AndroidMidiService(private val context: Context) : MidiService {
    private val manager = context.getSystemService(MidiManager::class.java)
    private val mutableState = MutableStateFlow<MidiConnectionState>(
        if (manager == null) MidiConnectionState.Unavailable else MidiConnectionState.Disconnected,
    )
    private val mutableNotes = MutableSharedFlow<Int>(extraBufferCapacity = 16)
    override val state: StateFlow<MidiConnectionState> = mutableState
    override val notes: SharedFlow<Int> = mutableNotes
    private var device: MidiDevice? = null
    private var port: MidiOutputPort? = null
    private var registered = false

    private val receiver = object : MidiReceiver() {
        override fun onSend(data: ByteArray, offset: Int, count: Int, timestamp: Long) {
            MidiMessageParser.noteOns(data, offset, count).forEach(mutableNotes::tryEmit)
        }
    }

    private val callback = object : MidiManager.DeviceCallback() {
        override fun onDeviceAdded(info: MidiDeviceInfo) = connect(info)
        override fun onDeviceRemoved(info: MidiDeviceInfo) {
            if (device?.info?.id == info.id) {
                closeDevice()
                mutableState.value = MidiConnectionState.Disconnected
            }
        }
    }

    @SuppressLint("MissingPermission")
    override fun start() {
        val midiManager = manager ?: return
        if (!registered) {
            midiManager.registerDeviceCallback(callback, context.mainExecutor)
            registered = true
        }
        midiManager.devices.firstOrNull { info ->
            info.ports.any { it.type == MidiDeviceInfo.PortInfo.TYPE_OUTPUT }
        }?.let(::connect)
    }

    @SuppressLint("MissingPermission")
    private fun connect(info: MidiDeviceInfo) {
        if (device != null) return
        manager?.openDevice(info, { opened ->
            if (opened == null) return@openDevice
            val output = info.ports.firstOrNull { it.type == MidiDeviceInfo.PortInfo.TYPE_OUTPUT } ?: return@openDevice
            device = opened
            port = opened.openOutputPort(output.portNumber)?.also { it.connect(receiver) }
            val name = info.properties.getString(MidiDeviceInfo.PROPERTY_NAME) ?: "MIDI device"
            mutableState.value = MidiConnectionState.Connected(name)
        }, context.mainExecutor)
    }

    override fun stop() {
        if (registered) manager?.unregisterDeviceCallback(callback)
        registered = false
        closeDevice()
        if (manager != null) mutableState.value = MidiConnectionState.Disconnected
    }

    private fun closeDevice() {
        runCatching { port?.disconnect(receiver) }
        runCatching { port?.close() }
        runCatching { device?.close() }
        port = null
        device = null
    }
}

object MidiMessageParser {
    fun noteOns(data: ByteArray, offset: Int = 0, count: Int = data.size - offset): List<Int> {
        val notes = mutableListOf<Int>()
        var index = offset
        while (index + 2 < offset + count) {
            val status = data[index].toInt() and 0xF0
            val note = data[index + 1].toInt() and 0x7F
            val velocity = data[index + 2].toInt() and 0x7F
            if (status == 0x90 && velocity > 0) notes += note
            index += 3
        }
        return notes
    }
}
