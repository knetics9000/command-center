package com.lupusvex.notifycapture

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Patterns
import com.lupusvex.notifycapture.data.AppDatabase
import com.lupusvex.notifycapture.data.QueuedNotification
import kotlinx.coroutines.launch
import java.time.Instant

/**
 * The heart of the app: the system delivers every posted notification here.
 * We do the cheapest possible work on the callback thread (read fields, check the
 * filter), then hand the DB write to a background scope. WorkManager does the
 * network — this service never touches the network directly.
 */
class CaptureListenerService : NotificationListenerService() {

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val pkg = sbn.packageName ?: return
        Prefs.addSeen(this, pkg)                       // remember it for the Manage-apps list
        if (!Prefs.shouldCapture(this, pkg)) return    // master switch + allow/block

        val n = sbn.notification ?: return
        // Skip persistent/ongoing chrome and group summaries — they're noise.
        if (n.flags and Notification.FLAG_ONGOING_EVENT != 0) return
        if (n.flags and Notification.FLAG_GROUP_SUMMARY != 0) return

        val ex = n.extras
        val title = ex.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim().orEmpty()
        val body = (ex.getCharSequence(Notification.EXTRA_BIG_TEXT)
            ?: ex.getCharSequence(Notification.EXTRA_TEXT))?.toString()?.trim().orEmpty()
        if (title.isEmpty() && body.isEmpty()) return

        val link = firstUrl("$title $body")
        val postedAt = Instant.ofEpochMilli(sbn.postTime).toString()
        val item = QueuedNotification(app = pkg, title = title, body = body, link = link, postedAt = postedAt)

        App.io.launch {
            AppDatabase.get(applicationContext).queueDao().insert(item)
            SyncWorker.enqueue(applicationContext)
        }
    }

    // We only capture on post; removals are irrelevant to the Command Center.
    override fun onNotificationRemoved(sbn: StatusBarNotification?) { }

    private fun firstUrl(text: String): String? {
        val m = Patterns.WEB_URL.matcher(text)
        return if (m.find()) m.group() else null
    }
}
