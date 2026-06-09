package com.lupusvex.notifycapture.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [QueuedNotification::class], version = 1, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun queueDao(): QueueDao

    companion object {
        @Volatile private var INSTANCE: AppDatabase? = null
        fun get(context: Context): AppDatabase =
            INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext, AppDatabase::class.java, "notifycapture.db"
                ).build().also { INSTANCE = it }
            }
    }
}
