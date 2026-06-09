package com.lupusvex.notifycapture

import android.content.Context

/**
 * All user configuration: server URL, token, master switch, filter mode, and the
 * per-app allow/block sets. Filtering happens here so the listener stays cheap.
 *
 * Two modes:
 *  - Block list (default): capture everything EXCEPT apps in `blocked`.
 *  - Allow list: capture NOTHING except apps in `allowed`.
 */
object Prefs {
    private const val FILE = "notifycapture"
    private fun p(c: Context) = c.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    fun baseUrl(c: Context): String = p(c).getString("base_url", "")!!.trim()
    fun token(c: Context): String = p(c).getString("token", "")!!.trim()
    fun enabled(c: Context): Boolean = p(c).getBoolean("enabled", true)
    /** false = block list, true = allow list. */
    fun allowMode(c: Context): Boolean = p(c).getBoolean("allow_mode", false)

    fun setConfig(c: Context, baseUrl: String, token: String) {
        p(c).edit().putString("base_url", baseUrl.trim()).putString("token", token.trim()).apply()
    }
    fun setEnabled(c: Context, v: Boolean) = p(c).edit().putBoolean("enabled", v).apply()
    fun setAllowMode(c: Context, v: Boolean) = p(c).edit().putBoolean("allow_mode", v).apply()

    private fun getSet(c: Context, key: String): MutableSet<String> =
        HashSet(p(c).getStringSet(key, emptySet()) ?: emptySet())
    private fun putSet(c: Context, key: String, set: Set<String>) =
        p(c).edit().putStringSet(key, set).apply()

    fun blocked(c: Context) = getSet(c, "blocked")
    fun allowed(c: Context) = getSet(c, "allowed")
    /** Packages we've seen post a notification — populates the "Manage apps" screen. */
    fun seen(c: Context) = getSet(c, "seen")

    fun addSeen(c: Context, pkg: String) {
        val s = seen(c)
        if (s.add(pkg)) putSet(c, "seen", s)
    }

    /** Toggle whether a package is captured, respecting the current mode. */
    fun setCaptured(c: Context, pkg: String, captured: Boolean) {
        if (allowMode(c)) {
            val s = allowed(c); if (captured) s.add(pkg) else s.remove(pkg); putSet(c, "allowed", s)
        } else {
            val s = blocked(c); if (captured) s.remove(pkg) else s.add(pkg); putSet(c, "blocked", s)
        }
    }

    fun isCaptured(c: Context, pkg: String): Boolean =
        if (allowMode(c)) allowed(c).contains(pkg) else !blocked(c).contains(pkg)

    /** The single decision the listener asks before queuing anything. */
    fun shouldCapture(c: Context, pkg: String): Boolean = enabled(c) && isCaptured(c, pkg)
}
