package com.countryalert.unrest.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.io.IOException

// Mirrors test/languages.test.js for the iPhone widget.
class LanguagesTest {
    private val now = parseGdeltDate("20261022T120000Z")!!

    private fun fixture(name: String): String {
        val dirs = listOf("../../test/fixtures", "../test/fixtures", "test/fixtures")
        return dirs.map { File(it, name) }.first { it.exists() }.readText()
    }

    @Test fun dataIsConsistent() {
        assertTrue(UnrestData.international in UnrestData.editions)
        for ((ceid, e) in UnrestData.editions) {
            assertTrue(ceid, e.lang in UnrestData.languages)
            assertEquals(ceid, ceid.substringBefore(":"), e.gl)
        }
        for ((c, eds) in UnrestData.countries) eds.forEach { assertTrue(c, it in UnrestData.editions) }
        for ((code, l) in UnrestData.languages) {
            assertTrue(code, l.match in listOf("word", "prefix", "substring"))
            assertTrue(code, l.query.isNotEmpty() && l.terms.values.all { it.isNotEmpty() })
        }
    }

    @Test fun picksLocalEditionsPlusEnglish() {
        assertEquals(listOf("FR:fr", "US:en"), editionsFor("Paris", "france"))
        assertEquals(listOf("CH:fr", "US:en"), editionsFor("Geneva", "switzerland"))
        assertEquals(listOf("KE:en"), editionsFor("Nairobi", "kenya"))
        assertEquals(listOf("IN:hi", "IN:en"), editionsFor("Delhi", "india"))
        assertEquals(listOf("JP:ja", "US:en"), editionsFor("Tokyo", "Japan"))
        assertEquals(listOf("US:en"), editionsFor("Smalltown", ""))
        assertEquals(listOf("US:en"), editionsFor("Paris", "france", localNews = false))
    }

    @Test fun localSpellings() {
        assertEquals(listOf("Moscow", "Москва", "Москве", "Москвы", "Москву"), allNames("Moscow"))
        assertEquals(listOf("Tokyo", "Edo", "東京"), allNames("Tokyo", listOf("Tōkyō", "Edo")))
        assertEquals(listOf("Bogota"), allNames("Bogota"))
    }

    @Test fun ratesHeadlinesInManyLanguages() {
        val cases = listOf(
            Triple("fr", "Des heurts éclatent à Paris, gaz lacrymogène", 2.0),
            Triple("fr", "GRÈVE GÉNÉRALE À MARSEILLE", 1.0),
            Triple("fr", "Le manifeste d'un artiste", 0.0),
            Triple("es", "Disturbios y saqueos en Caracas", 2.0),
            Triple("es", "Toque de queda en Lima tras protestas", 3.0),
            Triple("pt", "Protesto termina em confronto em São Paulo", 2.0),
            Triple("de", "Ausschreitungen bei Demonstration in Berlin", 2.0),
            Triple("de", "Demokratie-Gipfel in Berlin", 0.0),
            Triple("it", "Scontri al corteo di Roma", 2.0),
            Triple("ru", "В Москве задержаны участники митинга", 2.0),
            Triple("uk", "У Києві пройшов мітинг", 1.0),
            Triple("tr", "İstanbul'da protestoya biber gazı", 2.0),
            Triple("ar", "اشتباكات بين المتظاهرين والشرطة في القاهرة", 2.0),
            Triple("ar", "قتلى في احتجاجات بغداد", 3.0),
            Triple("he", "מפגינים חסמו כביש בתל אביב", 1.0),
            Triple("id", "Demo di Jakarta berujung ricuh", 2.0),
            Triple("id", "Demokrasi di Jakarta", 0.0),
            Triple("th", "ผู้ชุมนุมปะทะเจ้าหน้าที่ในกรุงเทพ", 2.0),
            Triple("vi", "Biểu tình ở Hà Nội", 1.0),
            Triple("ja", "東京で大規模なデモ", 1.0),
            Triple("ja", "香港で催涙ガス使用", 2.0),
            Triple("ko", "서울 도심서 대규모 집회", 1.0),
            Triple("zh", "香港示威者與警方衝突", 2.0),
            Triple("zh", "曼谷宣布宵禁", 3.0),
            Triple("hi", "दिल्ली में प्रदर्शनकारियों पर लाठीचार्ज", 2.0),
            Triple("el", "Επεισόδια στην Αθήνα μετά τη διαδήλωση", 2.0),
            Triple("pl", "Zamieszki w Warszawie", 2.0),
            Triple("nl", "Rellen in Amsterdam, traangas ingezet", 2.0),
        )
        for ((lang, title, sev) in cases) assertEquals("$lang: $title", sev, rateHeadline(title, lang).severity, 0.0)
        assertEquals(2.0, rateHeadline("Riots in Paris", "fr").severity, 0.0)
        assertEquals(0.5, rateHeadline("Manifestation pacifique à Paris", "fr").severity, 0.0)
    }

    @Test fun spotsCityInLocalSpellings() {
        assertTrue(mentionsAny("В Москве задержаны", allNames("Moscow")))
        assertTrue(mentionsAny("東京で大規模なデモ", allNames("Tokyo")))
        assertTrue(mentionsAny("Grève à PARIS", listOf("Paris")))
        assertTrue(mentionsAny("Protesta en Bogotá", listOf("Bogota")))
        assertFalse(mentionsAny("Grève à Lyon", listOf("Paris")))
    }

    @Test fun nonLatinHeadlinesArentMerged() {
        val items = listOf(Item("東京で大規模なデモ", "A", "", null, "ja"), Item("香港で催涙ガス使用", "B", "", null, "ja"))
        assertEquals(2, prepareHeadlines(items, listOf("Tokyo", "東京"), now).size)
    }

    @Test fun readsLocalAndEnglishFeeds() {
        val urls = mutableListOf<String>()
        val r = buildReport(Params("Paris", country = "france"), { url ->
            synchronized(urls) { urls += url }
            when {
                "timelinevolraw" in url -> fixture("gdelt-timeline.json")
                "ceid=FR:fr" in url -> fixture("google-news-fr.xml")
                "ceid=US:en" in url -> fixture("google-news.xml")
                "mfa.gov.sg" in url -> fixture("mfa-france.html")
                else -> throw IOException("unexpected $url")
            }
        }, now)
        assertEquals(listOf("FR:fr", "US:en"), r.editions)
        assertEquals(listOf("20 Minutes", "BFM", "Le Parisien"), r.headlines.filter { it.lang == "fr" }.map { it.source }.sorted())
        // Same inputs give 73 in the iPhone widget (test/languages.test.js).
        assertEquals(73, r.score)
        val frUrl = urls.first { "FR:fr" in it }
        assertTrue(java.net.URLDecoder.decode(frUrl, "UTF-8").contains("manifestation"))
        assertTrue(frUrl.contains("hl=fr&gl=FR"))
        assertTrue(r.errors.isEmpty())
    }

    @Test fun failingLocalFeedDoesntBreakReport() {
        val r = buildReport(Params("Paris", country = "france"), { url ->
            when {
                "timelinevolraw" in url -> fixture("gdelt-timeline.json")
                "ceid=FR:fr" in url -> throw IOException("HTTP 400")
                "news.google.com" in url -> fixture("google-news.xml")
                "mfa.gov.sg" in url -> fixture("mfa-france.html")
                else -> throw IOException("unexpected $url")
            }
        }, now)
        assertEquals(67, r.score)
        assertEquals(listOf("Google News (FR:fr): HTTP 400"), r.errors)
    }
}
