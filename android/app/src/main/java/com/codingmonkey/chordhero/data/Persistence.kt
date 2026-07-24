package com.codingmonkey.chordhero.data

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import androidx.room.Upsert
import androidx.room.withTransaction
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.util.UUID

@Entity(tableName = "student_profiles")
data class StudentProfileEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val name: String,
    val isSelected: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
)

@Entity(tableName = "chord_progress", primaryKeys = ["profileId", "chordId"])
data class ChordProgressEntity(
    val profileId: String,
    val chordId: String,
    val favorite: Boolean = false,
    val lastViewedAt: Long? = null,
    val note: String = "",
    val seconds: Int = 0,
    val repetitions: Int = 0,
    val misses: Int = 0,
    val strength: Int = 1,
    val nextReviewAt: Long? = null,
)

@Entity(tableName = "custom_practice_packs")
data class CustomPracticePackEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val title: String,
    val description: String,
    val keyCenter: String,
    val focus: String,
    val rightHandPattern: String,
    val chordIds: List<String>,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
)

@Entity(tableName = "song_library_collections")
data class SongLibraryEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val profileId: String,
    val name: String,
    val description: String = "",
    val songIds: List<String> = emptyList(),
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
)

@Entity(tableName = "imported_song_records")
data class ImportedSongEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val profileId: String,
    val title: String,
    val artist: String,
    val sourceUrl: String,
    val notes: String = "",
    val importedAt: Long = System.currentTimeMillis(),
)

class StringListConverter {
    @TypeConverter fun encode(value: List<String>): String = Json.encodeToString(value)
    @TypeConverter fun decode(value: String): List<String> = Json.decodeFromString(value)
}

@Dao
interface ProfileDao {
    @Query("SELECT * FROM student_profiles ORDER BY createdAt") fun observeAll(): Flow<List<StudentProfileEntity>>
    @Query("SELECT * FROM student_profiles WHERE isSelected = 1 LIMIT 1") suspend fun selected(): StudentProfileEntity?
    @Query("SELECT * FROM student_profiles ORDER BY createdAt LIMIT 1") suspend fun first(): StudentProfileEntity?
    @Insert(onConflict = OnConflictStrategy.ABORT) suspend fun insert(profile: StudentProfileEntity)
    @Query("UPDATE student_profiles SET isSelected = 0, updatedAt = :now") suspend fun clearSelection(now: Long)
    @Query("UPDATE student_profiles SET isSelected = 1, updatedAt = :now WHERE id = :id") suspend fun select(id: String, now: Long)
}

@Dao
interface ProgressDao {
    @Query("SELECT * FROM chord_progress WHERE profileId = :profileId") fun observe(profileId: String): Flow<List<ChordProgressEntity>>
    @Query("SELECT * FROM chord_progress WHERE profileId = :profileId AND chordId = :chordId LIMIT 1")
    suspend fun get(profileId: String, chordId: String): ChordProgressEntity?
    @Upsert suspend fun upsert(progress: ChordProgressEntity)
}

@Dao
interface PackDao {
    @Query("SELECT * FROM custom_practice_packs ORDER BY createdAt") fun observeAll(): Flow<List<CustomPracticePackEntity>>
    @Insert(onConflict = OnConflictStrategy.ABORT) suspend fun insert(pack: CustomPracticePackEntity)
    @Query("DELETE FROM custom_practice_packs WHERE id = :id") suspend fun delete(id: String)
}

@Dao
interface SongLibraryDao {
    @Query("SELECT * FROM song_library_collections WHERE profileId = :profileId ORDER BY createdAt") fun observe(profileId: String): Flow<List<SongLibraryEntity>>
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun upsert(collection: SongLibraryEntity)
    @Query("DELETE FROM song_library_collections WHERE id = :id") suspend fun delete(id: String)
}

@Dao
interface ImportedSongDao {
    @Query("SELECT * FROM imported_song_records WHERE profileId = :profileId ORDER BY importedAt DESC") fun observe(profileId: String): Flow<List<ImportedSongEntity>>
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insert(song: ImportedSongEntity)
}

@Database(
    entities = [StudentProfileEntity::class, ChordProgressEntity::class, CustomPracticePackEntity::class, SongLibraryEntity::class, ImportedSongEntity::class],
    version = 2,
    exportSchema = true,
)
@TypeConverters(StringListConverter::class)
abstract class ChordHeroDatabase : RoomDatabase() {
    abstract fun profiles(): ProfileDao
    abstract fun progress(): ProgressDao
    abstract fun packs(): PackDao
    abstract fun songLibraries(): SongLibraryDao
    abstract fun importedSongs(): ImportedSongDao

    companion object {
        fun create(context: Context): ChordHeroDatabase =
            Room.databaseBuilder(context, ChordHeroDatabase::class.java, "chord-hero-v1.db")
                .addMigrations(object : androidx.room.migration.Migration(1, 2) {
                    override fun migrate(db: androidx.sqlite.db.SupportSQLiteDatabase) {
                        db.execSQL("CREATE TABLE IF NOT EXISTS song_library_collections (id TEXT NOT NULL PRIMARY KEY, profileId TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL, songIds TEXT NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL)")
                        db.execSQL("CREATE TABLE IF NOT EXISTS imported_song_records (id TEXT NOT NULL PRIMARY KEY, profileId TEXT NOT NULL, title TEXT NOT NULL, artist TEXT NOT NULL, sourceUrl TEXT NOT NULL, notes TEXT NOT NULL, importedAt INTEGER NOT NULL)")
                    }
                }).build()
    }
}

interface ProgressRepository {
    val profiles: Flow<List<StudentProfileEntity>>
    val packs: Flow<List<CustomPracticePackEntity>>
    suspend fun ensureSelectedProfile(): StudentProfileEntity
    suspend fun createProfile(name: String): StudentProfileEntity
    suspend fun selectProfile(id: String)
    fun progress(profileId: String): Flow<List<ChordProgressEntity>>
    suspend fun progress(profileId: String, chordId: String): ChordProgressEntity
    suspend fun save(progress: ChordProgressEntity)
    suspend fun addPack(pack: CustomPracticePackEntity)
    suspend fun addPacksAtomically(packs: List<CustomPracticePackEntity>)
    suspend fun deletePack(id: String)
    fun songLibraries(profileId: String): Flow<List<SongLibraryEntity>>
    fun importedSongs(profileId: String): Flow<List<ImportedSongEntity>>
    suspend fun saveSongLibrary(collection: SongLibraryEntity)
    suspend fun deleteSongLibrary(id: String)
    suspend fun saveImportedSong(song: ImportedSongEntity)
}

class RoomProgressRepository(private val db: ChordHeroDatabase) : ProgressRepository {
    override val profiles = db.profiles().observeAll()
    override val packs = db.packs().observeAll()

    override suspend fun ensureSelectedProfile(): StudentProfileEntity {
        db.profiles().selected()?.let { return it }
        db.profiles().first()?.let { selectProfile(it.id); return it.copy(isSelected = true) }
        val seeded = StudentProfileEntity(name = "Current device profile", isSelected = true)
        db.profiles().insert(seeded)
        return seeded
    }

    override suspend fun createProfile(name: String): StudentProfileEntity {
        val profile = StudentProfileEntity(name = name.trim().ifBlank { "Student" })
        db.profiles().insert(profile)
        return profile
    }

    override suspend fun selectProfile(id: String) {
        db.withTransaction {
            val now = System.currentTimeMillis()
            db.profiles().clearSelection(now)
            db.profiles().select(id, now)
        }
    }

    override fun progress(profileId: String) = db.progress().observe(profileId)

    override suspend fun progress(profileId: String, chordId: String): ChordProgressEntity =
        db.progress().get(profileId, chordId) ?: ChordProgressEntity(profileId, chordId)

    override suspend fun save(progress: ChordProgressEntity) = db.progress().upsert(progress)

    override suspend fun addPack(pack: CustomPracticePackEntity) {
        db.packs().insert(pack.copy(chordIds = pack.chordIds.distinct().take(10)))
    }

    override suspend fun addPacksAtomically(packs: List<CustomPracticePackEntity>) {
        db.withTransaction {
            packs.forEach { db.packs().insert(it.copy(chordIds = it.chordIds.distinct().take(10))) }
        }
    }

    override suspend fun deletePack(id: String) = db.packs().delete(id)

    override fun songLibraries(profileId: String): Flow<List<SongLibraryEntity>> = db.songLibraries().observe(profileId)
    override fun importedSongs(profileId: String): Flow<List<ImportedSongEntity>> = db.importedSongs().observe(profileId)
    override suspend fun saveSongLibrary(collection: SongLibraryEntity) = db.songLibraries().upsert(collection.copy(songIds = collection.songIds.distinct()))
    override suspend fun deleteSongLibrary(id: String) = db.songLibraries().delete(id)
    override suspend fun saveImportedSong(song: ImportedSongEntity) = db.importedSongs().insert(song)
}
