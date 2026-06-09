package com.lupusvex.notifycapture

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.lupusvex.notifycapture.data.AppDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

/**
 * Drains the local queue to the Command Center. Runs:
 *  - immediately (expedited) whenever a notification is captured, and
 *  - every 15 min as a backstop, so a missed/failed push eventually flushes.
 * A failed push returns retry() so WorkManager backs off and tries again — the
 * queue survives network drops because it lives in Room.
 */
class SyncWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {

    override suspend fun doWork(): Result {
        val base = Prefs.baseUrl(applicationContext)
        val token = Prefs.token(applicationContext)
        if (base.isBlank() || token.isBlank()) return Result.success() // not configured yet

        val dao = AppDatabase.get(applicationContext).queueDao()
        while (true) {
            val batch = dao.batch(50)
            if (batch.isEmpty()) break
            val ok = withContext(Dispatchers.IO) { Api.pushBatch(base, token, batch) }
            if (!ok) return Result.retry()
            dao.delete(batch)
        }
        return Result.success()
    }

    companion object {
        private const val ONE_TIME = "notify-sync-now"
        private const val PERIODIC = "notify-sync-periodic"

        private val netConstraint = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        /** Kick a sync as soon as possible (called right after a capture). */
        fun enqueue(context: Context) {
            val req = OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(netConstraint)
                .build()
            WorkManager.getInstance(context)
                .enqueueUniqueWork(ONE_TIME, ExistingWorkPolicy.APPEND_OR_REPLACE, req)
        }

        /** Backstop flush; KEEP so we don't reset the schedule on every launch. */
        fun schedulePeriodic(context: Context) {
            val req = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
                .setConstraints(netConstraint)
                .build()
            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP, req)
        }
    }
}
