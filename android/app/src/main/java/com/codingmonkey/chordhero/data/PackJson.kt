package com.codingmonkey.chordhero.data

import com.codingmonkey.chordhero.domain.ProgressionPack
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.decodeFromJsonElement

@Serializable
data class PackEnvelope(val schemaVersion: Int = 1, val packs: List<ProgressionPack>)

object PackJson {
    private val json = Json { prettyPrint = true; ignoreUnknownKeys = true }

    fun exportLegacy(packs: List<ProgressionPack>): String = json.encodeToString(packs)

    fun import(text: String, knownChordIds: Set<String>): List<ProgressionPack> {
        val root = json.parseToJsonElement(text)
        val payload = when (root) {
            is JsonArray -> root
            is JsonObject -> {
                require(root["schemaVersion"]?.jsonPrimitive?.content == "1") { "Unsupported pack schema." }
                root["packs"]?.jsonArray ?: error("The pack envelope has no packs array.")
            }
            else -> error("Pack JSON must be an array or versioned object.")
        }
        val packs = json.decodeFromJsonElement<List<ProgressionPack>>(payload)
        packs.forEach { pack ->
            require(pack.id.isNotBlank() && pack.title.isNotBlank())
            require(pack.chordIds.isNotEmpty() && pack.chordIds.size <= 10)
            require(pack.chordIds.distinct().size == pack.chordIds.size) { "${pack.title} repeats chord IDs." }
            require(pack.chordIds.all { it in knownChordIds }) { "${pack.title} references an unknown chord." }
        }
        return packs
    }
}
