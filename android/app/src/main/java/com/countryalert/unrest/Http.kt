package com.countryalert.unrest

import java.io.IOException
import java.net.HttpURLConnection
import java.net.URI

/** Downloads a URL as text. Throws IOException on network or HTTP errors. */
fun httpGet(url: String): String {
    val conn = URI(url).toURL().openConnection() as HttpURLConnection
    try {
        conn.connectTimeout = 15_000
        conn.readTimeout = 15_000
        conn.instanceFollowRedirects = true
        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android) CityUnrestWidget/1.0")
        conn.setRequestProperty("Accept-Language", "en")
        val code = conn.responseCode
        if (code >= 400) throw IOException("HTTP $code")
        return conn.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
    } finally {
        conn.disconnect()
    }
}
