package com.countryalert.unrest

import java.io.IOException
import java.net.HttpURLConnection
import java.net.URI

private const val MAX_BYTES = 4 * 1024 * 1024

/** Downloads a URL as text. Throws IOException on network or HTTP errors, or past 4 MB. */
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
        conn.inputStream.use { input ->
            val out = java.io.ByteArrayOutputStream()
            val buf = ByteArray(16 * 1024)
            while (true) {
                val n = input.read(buf)
                if (n < 0) break
                out.write(buf, 0, n)
                if (out.size() > MAX_BYTES) throw IOException("Response too large")
            }
            return out.toString("UTF-8")
        }
    } finally {
        conn.disconnect()
    }
}
