package com.lupusvex.notifycapture.data

import androidx.room.Entity
import androidx.room.PrimaryKey

/** One captured notification, waiting in the local queue to be synced. */
@Entity(tableName = "queue")
data class QueuedNotification(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val app: String,
    val title: String,
    val body: String,
    val link: String?,
    val postedAt: String   // ISO-8601 (UTC)
)
