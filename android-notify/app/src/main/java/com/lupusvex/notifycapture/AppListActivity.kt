package com.lupusvex.notifycapture

import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.switchmaterial.SwitchMaterial
import com.lupusvex.notifycapture.databinding.ActivityAppsBinding

/**
 * Per-app capture control. Lists every app that has posted a notification since
 * install (so the list is relevant, not 300 system packages). Each toggle means
 * "capture this app" in whichever mode is active.
 */
class AppListActivity : AppCompatActivity() {

    private lateinit var b: ActivityAppsBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityAppsBinding.inflate(layoutInflater)
        setContentView(b.root)

        b.modeLabel.text = if (Prefs.allowMode(this))
            "Allow-list mode: only the apps you switch ON are captured."
        else
            "Block-list mode: every app is captured except the ones you switch OFF."

        val seen = Prefs.seen(this).sortedBy { labelFor(it).lowercase() }

        if (seen.isEmpty()) {
            val tv = TextView(this).apply {
                text = "No apps yet. Once notifications start arriving, the apps that sent them show up here."
                setPadding(0, 24, 0, 0)
            }
            b.list.addView(tv)
            return
        }

        for (pkg in seen) {
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(0, 18, 0, 18)
            }
            val name = TextView(this).apply {
                text = labelFor(pkg)
                textSize = 16f
                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
            }
            val sw = SwitchMaterial(this).apply {
                isChecked = Prefs.isCaptured(this@AppListActivity, pkg)
                setOnCheckedChangeListener { _, checked -> Prefs.setCaptured(this@AppListActivity, pkg, checked) }
            }
            row.addView(name)
            row.addView(sw)
            b.list.addView(row)
        }
    }

    private fun labelFor(pkg: String): String = try {
        val ai = packageManager.getApplicationInfo(pkg, 0)
        packageManager.getApplicationLabel(ai).toString()
    } catch (e: Exception) {
        pkg
    }
}
