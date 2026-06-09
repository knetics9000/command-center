package com.lupusvex.notifycapture

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.NotificationManagerCompat
import androidx.lifecycle.lifecycleScope
import com.lupusvex.notifycapture.data.AppDatabase
import com.lupusvex.notifycapture.databinding.ActivityMainBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : AppCompatActivity() {

    private lateinit var b: ActivityMainBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityMainBinding.inflate(layoutInflater)
        setContentView(b.root)

        b.urlField.setText(Prefs.baseUrl(this))
        b.tokenField.setText(Prefs.token(this))
        b.enabledSwitch.isChecked = Prefs.enabled(this)
        b.modeSwitch.isChecked = Prefs.allowMode(this)

        b.saveBtn.setOnClickListener {
            Prefs.setConfig(this, b.urlField.text.toString(), b.tokenField.text.toString())
            SyncWorker.schedulePeriodic(this)
            SyncWorker.enqueue(this)
            toast("Saved")
            updateStatus()
        }
        b.testBtn.setOnClickListener { testConnection() }
        b.enabledSwitch.setOnCheckedChangeListener { _, v -> Prefs.setEnabled(this, v) }
        b.modeSwitch.setOnCheckedChangeListener { _, v ->
            Prefs.setAllowMode(this, v)
            toast(if (v) "Allow-list: only apps you pick are captured" else "Block-list: everything except blocked apps")
        }
        b.accessBtn.setOnClickListener {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }
        b.batteryBtn.setOnClickListener { requestIgnoreBattery() }
        b.appsBtn.setOnClickListener { startActivity(Intent(this, AppListActivity::class.java)) }
    }

    override fun onResume() {
        super.onResume()
        updateStatus()
    }

    private fun hasNotificationAccess(): Boolean =
        NotificationManagerCompat.getEnabledListenerPackages(this).contains(packageName)

    private fun updateStatus() {
        val access = hasNotificationAccess()
        lifecycleScope.launch {
            val queued = withContext(Dispatchers.IO) { AppDatabase.get(applicationContext).queueDao().count() }
            b.status.text = buildString {
                append(if (access) "✓ Notification access granted" else "✗ Notification access NOT granted — tap below")
                append("\n")
                append(if (queued == 0) "Queue empty — all synced" else "$queued waiting to sync")
            }
            b.accessBtn.text = if (access) getString(R.string.access_granted) else getString(R.string.grant_access)
        }
    }

    private fun testConnection() {
        val url = b.urlField.text.toString()
        val token = b.tokenField.text.toString()
        toast("Testing…")
        lifecycleScope.launch {
            val ok = withContext(Dispatchers.IO) { Api.ping(url, token) }
            toast(if (ok) "Connected ✓" else "Failed — check URL & token")
        }
    }

    @SuppressLint("BatteryLife")
    private fun requestIgnoreBattery() {
        try {
            startActivity(Intent(
                Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                Uri.parse("package:$packageName")
            ))
        } catch (e: Exception) {
            startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
        }
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
}
