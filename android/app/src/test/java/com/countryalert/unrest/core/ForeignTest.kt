package com.countryalert.unrest.core

import org.json.JSONArray
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.io.IOException
import java.net.URLDecoder

// Mirrors test/foreign.test.js for the iPhone widget.
class ForeignTest {
    private val now = parseGdeltDate("20261022T120000Z")!!

    private fun fixture(name: String): String {
        val dirs = listOf("../../test/fixtures", "../test/fixtures", "test/fixtures")
        return dirs.map { File(it, name) }.first { it.exists() }.readText()
    }

    @Test fun dataHasNamesForEveryCountry() {
        for (c in UnrestData.countries.keys) assertTrue(c, c in UnrestData.countryNames)
        for ((city, info) in UnrestData.cities) assertTrue(city, info.country in UnrestData.countryNames)
    }

    @Test fun spotsHeadlinesAboutOtherCountries() {
        val br = allNames("Brasilia")
        assertTrue(mentionsForeign("Brasília condena repressão a protestos na Venezuela", "brazil", br))
        assertTrue(mentionsForeign("Itamaraty em Brasília acompanha confrontos em Buenos Aires", "brazil", br))
        assertTrue(mentionsForeign("Brasilia condemns crackdown on Venezuelan protesters", "brazil", br))
        assertFalse(mentionsForeign("Polícia usa gás lacrimogêneo contra manifestantes em Brasília", "brazil", br))
        assertFalse(mentionsForeign("Brazilian police clash with protesters in Brasília", "brazil", br))
        assertFalse(mentionsForeign("Polícia usa bombas em Brasília", "brazil", br))
        assertFalse(mentionsForeign("Riots in Port Moresby, Papua New Guinea", "papua new guinea", listOf("Port Moresby")))
        assertTrue(mentionsForeign("Riots in Conakry, Guinea", "papua new guinea", listOf("Port Moresby")))
        assertTrue(mentionsForeign("東京で香港のデモについて会議", "japan", allNames("Tokyo")))
        assertFalse(mentionsForeign("Lima orang tewas dalam kerusuhan di Jakarta", "indonesia", allNames("Jakarta")))
        assertFalse(mentionsForeign("Người lao động biểu tình ở Hà Nội", "viet nam", allNames("Hanoi")))
        assertFalse(mentionsForeign("Marcha por la paz en Bogotá", "colombia", allNames("Bogota")))
        assertFalse(mentionsForeign("Protests in Santiago", "dominican republic", listOf("Santiago")))
    }

    private fun brFetch(translate: (String) -> String = { throw IOException("no translator") }): FetchText = { url ->
        when {
            url.startsWith("https://translate.googleapis.com/") -> translate(url)
            "timelinevolraw" in url -> fixture("gdelt-timeline.json")
            "ceid=BR:pt-419" in url -> fixture("google-news-br.xml")
            "news.google.com" in url -> "<rss></rss>"
            "mfa.gov.sg" in url -> fixture("mfa-france.html")
            else -> throw IOException("unexpected $url")
        }
    }

    @Test fun brasiliaKeepsOnlyBrasiliaHeadlines() {
        val r = buildReport(Params("Brasilia", country = "brazil", translate = false), brFetch(), now)
        assertEquals(listOf("CNN Brasil", "Correio Braziliense", "G1"), r.headlines.map { it.source }.sorted())
    }

    @Test fun translationsCatchHiddenForeignNames() {
        val english = mapOf("Brasília pede calma após confrontos na Ucrânia" to "Brasília calls for calm after clashes in Ukraine")
        val fetch = brFetch { url ->
            val lines = URLDecoder.decode(url.substringAfter("&q="), "UTF-8").split("\n")
            val segs = JSONArray()
            lines.forEachIndexed { i, l -> segs.put(JSONArray().put((english[l] ?: l) + if (i < lines.size - 1) "\n" else "").put(l)) }
            JSONArray().put(segs).put(JSONArray()).put("pt").toString()
        }
        val r = buildReport(Params("Brasilia", country = "brazil"), fetch, now)
        assertFalse(r.headlines.any { it.source == "CNN Brasil" })
        assertEquals(listOf("Correio Braziliense", "G1"), r.headlines.map { it.source }.sorted())
    }
}
