package com.lupusvex.notifycapture

import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.service.notification.NotificationListenerService

/**
 * After a reboot the system rebinds enabled notification listeners on its own, but
 * we nudge it (requestRebind) and re-assert the periodic sync to be safe.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        SyncWorker.schedulePeriodic(context)
        try {
            NotificationListenerService.requestRebind(
                ComponentName(context, CaptureListenerService::class.java)
            )
        } catch (_: Exception) { }
    }
}
