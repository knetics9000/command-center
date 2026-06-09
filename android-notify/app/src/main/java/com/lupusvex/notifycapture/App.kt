package com.lupusvex.notifycapture

import android.app.Application
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        instance = this
        // Make sure the periodic flush is scheduled even on first launch / app update.
        SyncWorker.schedulePeriodic(this)
    }

    companion object {
        lateinit var instance: App
            private set
        // Background scope for the listener's quick DB writes (the listener callback
        // runs on the main thread; we hand work off here).
        val io = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    }
}
