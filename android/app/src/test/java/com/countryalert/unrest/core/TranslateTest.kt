package com.countryalert.unrest.core

import org.json.JSONArray
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.io.IOException
import java.net.URLDecoder

// Mirrors test/translate.test.js for the iPhone widget.
class TranslateTest {
    private val now = parseGdeltDate("20261022T120000Z")!!

    private fun fixture(name: String): String {
        val dirs = listOf("../../test/fixtures", "../test/fixtures", "test/fixtures")
        return dirs.map { File(it, name) }.first { it.exists() }.readText()
    }

    private val english = mapOf(
        "Paris : des heurts entre manifestants et forces de l'ordre, gaz lacrymogène tiré" to
            "Paris: clashes between protesters and police, tear gas fired",
        "Grève dans les transports à PARIS ce vendredi" to "Transport strike in PARIS this Friday",
        "Manifestation pacifique place de la République" to "Peaceful demonstration at Place de la République",
    )

    /** Answers like Google Translate: one segment per line, newlines kept. */
    private fun fakeTranslator(calls: MutableList<String>): (String) -> String = { url ->
        val q = URLDecoder.decode(url.substringAfter("&q="), "UTF-8")
        synchronized(calls) { calls += q }
        val lines = q.split("\n")
        val segs = JSONArray()
        lines.forEachIndexed { i, l ->
            segs.put(JSONArray().put((english[l] ?: l) + if (i < lines.size - 1) "\n" else "").put(l))
        }
        JSONArray().put(segs).put(JSONArray()).put("fr").toString()
    }

    private fun newsFetch(translator: (String) -> String): FetchText = { url ->
        when {
            url.startsWith("https://translate.googleapis.com/") -> translator(url)
            "timelinevolraw" in url -> fixture("gdelt-timeline.json")
            "ceid=FR:fr" in url -> fixture("google-news-fr.xml")
            "news.google.com" in url -> fixture("google-news.xml")
            "mfa.gov.sg" in url -> fixture("mfa-france.html")
            else -> throw IOException("unexpected $url")
        }
    }

    @Test fun parsesReplies() {
        assertEquals("Hello. World", parseTranslation("""[[["Hello. ","Bonjour. "],["World","Monde"]],null,"fr"]"""))
        assertTrue(runCatching { parseTranslation("""{"error":1}""") }.isFailure)
    }

    @Test fun translatesForeignHeadlinesInOneRequest() {
        val calls = mutableListOf<String>()
        val r = buildReport(Params("Paris", country = "france"), newsFetch(fakeTranslator(calls)), now)
        assertEquals(1, calls.size)
        val fr = r.headlines.filter { it.lang == "fr" }
        assertEquals(2, fr.size)
        for (h in fr) {
            assertEquals(english[h.title], h.translated)
            assertEquals("[Translated] " + english[h.title], displayTitle(h))
        }
        for (h in r.headlines.filter { it.lang == "en" }) {
            assertNull(h.translated)
            assertEquals(h.title, displayTitle(h))
            assertFalse(calls[0].contains(h.title))
        }
        assertEquals(73, r.score)
        assertTrue(r.errors.isEmpty())
        assertEquals(2, r.translations.size)
    }

    @Test fun remembersTranslations() {
        val calls = mutableListOf<String>()
        val fetch = newsFetch(fakeTranslator(calls))
        val first = buildReport(Params("Paris", country = "france"), fetch, now)
        val second = buildReport(Params("Paris", country = "france"), fetch, now, first.translations)
        assertEquals(1, calls.size)
        assertTrue(second.headlines.any { it.translated != null })
    }

    @Test fun showsOriginalsWhenTranslationFails() {
        val r = buildReport(Params("Paris", country = "france"), newsFetch { throw IOException("HTTP 429") }, now)
        assertTrue(r.headlines.all { it.translated == null })
        assertEquals(listOf("Translate: HTTP 429"), r.errors)
        assertEquals(73, r.score)
    }

    @Test fun ignoresMismatchedReplies() {
        val r = buildReport(Params("Paris", country = "france"), newsFetch { """[[["just one line","x"]],null,"fr"]""" }, now)
        assertTrue(r.headlines.all { it.translated == null })
        assertEquals(1, r.errors.size)
    }

    @Test fun handlesUnusualTrafficPage() {
        val r = buildReport(Params("Paris", country = "france"), newsFetch { "<html><title>Sorry...</title></html>" }, now)
        assertTrue(r.headlines.all { it.translated == null })
        assertEquals(listOf("Translate: service unavailable, showing originals"), r.errors)
    }

    @Test fun canBeTurnedOff() {
        val calls = mutableListOf<String>()
        val r = buildReport(Params("Paris", country = "france", translate = false), newsFetch(fakeTranslator(calls)), now)
        assertEquals(0, calls.size)
        assertTrue(r.headlines.all { it.translated == null })
    }

    @Test fun translationsSurviveJson() {
        val r = buildReport(Params("Paris", country = "france"), newsFetch(fakeTranslator(mutableListOf())), now)
        assertEquals(r, reportFromJson(org.json.JSONObject(r.toJson().toString())))
    }
}
