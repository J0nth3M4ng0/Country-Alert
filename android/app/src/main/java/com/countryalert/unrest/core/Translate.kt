package com.countryalert.unrest.core

import org.json.JSONArray
import java.net.URLEncoder

// Translates foreign-language headlines into English. Same logic as
// translateHeadlines in widget/CityUnrest.js.

/**
 * Google Translate's free web endpoint (the one translate.google.com uses).
 * Unofficial: if it fails or changes, headlines are shown untranslated.
 */
const val TRANSLATE_URL = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q="
private const val TRANSLATE_BATCH_CHARS = 1500

/** The reply is [[[translated, original, ...], ...], ...]; joins the translated parts. */
fun parseTranslation(json: String): String {
    val segments = JSONArray(json).optJSONArray(0) ?: throw IllegalStateException("unexpected reply")
    return (0 until segments.length()).joinToString("") { i ->
        segments.optJSONArray(i)?.let { seg -> if (seg.opt(0) is String) seg.getString(0) else "" } ?: ""
    }
}

class Translation(val headlines: List<Headline>, val cache: Map<String, String>, val error: String?)

/**
 * Adds an English translation to non-English headlines, one request per batch.
 * [cache] (original -> English) carries translations between refreshes.
 */
fun translateHeadlines(headlines: List<Headline>, fetchText: FetchText, cache: Map<String, String> = emptyMap()): Translation {
    val known = LinkedHashMap(cache)
    val todo = headlines.filter { it.lang != "en" && it.title !in known }.map { it.title }.distinct()
    val batches = mutableListOf<MutableList<String>>()
    for (t in todo) {
        val last = batches.lastOrNull()
        if (last != null && last.joinToString("\n").length + t.length < TRANSLATE_BATCH_CHARS) last += t
        else batches += mutableListOf(t)
    }
    var error: String? = null
    for (batch in batches) {
        try {
            val q = batch.joinToString("\n") { it.replace(Regex("\\s*\\n\\s*"), " ") }
            val url = TRANSLATE_URL + URLEncoder.encode(q, "UTF-8").replace("+", "%20")
            val reply = fetchText(url)
            // Google answers a web page instead of data when it's limiting requests.
            if (!reply.trim().startsWith("[")) throw IllegalStateException("service unavailable, showing originals")
            val lines = parseTranslation(reply).split("\n").map { it.trim() }
            if (lines.size != batch.size) throw IllegalStateException("reply didn't match the headlines")
            batch.forEachIndexed { i, t -> known[t] = lines[i] }
        } catch (e: Exception) {
            error = "Translate: " + (e.message ?: e.javaClass.simpleName)
            break
        }
    }
    val out = headlines.map { h ->
        val t = known[h.title]
        if (t != null && fold(t) != fold(h.title)) h.copy(translated = t) else h
    }
    val keep = out.mapNotNull { h -> known[h.title]?.let { h.title to it } }.toMap()
    return Translation(out, keep, error)
}
