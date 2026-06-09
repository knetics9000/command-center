package com.lupusvex.notifycapture

import com.lupusvex.notifycapture.data.QueuedNotification
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** Minimal HTTP client (no Retrofit) — token-authed POST to the Command Center. */
object Api {

    private fun open(baseUrl: String, token: String, method: String): HttpURLConnection {
        val url = URL(baseUrl.trimEnd('/') + "/api/notify")
        return (url.openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 12000
            readTimeout = 12000
            setRequestProperty("Authorization", "Bearer $token")
            setRequestProperty("Content-Type", "application/json")
        }
    }

    /** Push a batch. Returns true on 2xx (queue can be cleared). */
    fun pushBatch(baseUrl: String, token: String, items: List<QueuedNotification>): Boolean {
        if (baseUrl.isBlank() || token.isBlank()) return false
        val arr = JSONArray()
        for (n in items) {
            arr.put(JSONObject().apply {
                put("app", n.app)
                put("title", n.title)
                put("body", n.body)
                put("link", n.link ?: JSONObject.NULL)
                put("posted_at", n.postedAt)
            })
        }
        val payload = JSONObject().put("items", arr).toString()
        var conn: HttpURLConnection? = null
        return try {
            conn = open(baseUrl, token, "POST")
            conn.doOutput = true
            conn.outputStream.use { it.write(payload.toByteArray()) }
            conn.responseCode in 200..299
        } catch (e: Exception) {
            false
        } finally {
            conn?.disconnect()
        }
    }

    /** Lightweight connectivity + token check (GET returns {ok:true} when authed). */
    fun ping(baseUrl: String, token: String): Boolean {
        if (baseUrl.isBlank() || token.isBlank()) return false
        var conn: HttpURLConnection? = null
        return try {
            conn = open(baseUrl, token, "GET")
            conn.responseCode == 200 && conn.inputStream.bufferedReader().readText().contains("\"ok\":true")
        } catch (e: Exception) {
            false
        } finally {
            conn?.disconnect()
        }
    }
}
