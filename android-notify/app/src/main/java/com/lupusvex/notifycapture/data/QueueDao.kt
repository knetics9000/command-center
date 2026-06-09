package com.lupusvex.notifycapture.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query

@Dao
interface QueueDao {
    @Insert
    suspend fun insert(n: QueuedNotification): Long

    @Query("SELECT * FROM queue ORDER BY id ASC LIMIT :limit")
    suspend fun batch(limit: Int): List<QueuedNotification>

    @Query("SELECT COUNT(*) FROM queue")
    suspend fun count(): Int

    @Delete
    suspend fun delete(items: List<QueuedNotification>)
}
