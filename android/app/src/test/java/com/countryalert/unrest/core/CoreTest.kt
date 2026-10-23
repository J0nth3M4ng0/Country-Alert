package com.countryalert.unrest.core

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.io.IOException

// Uses the same sample data as the iPhone widget tests (test/fixtures at the repo root).
class CoreTest {
    private val now = parseGdeltDate("20261022T120000Z")!!

    private fun fixture(name: String): String {
        val dirs = listOf("../../test/fixtures", "../test/fixtures", "test/fixtures")
        val f = dirs.map { File(it, name) }.firstOrNull { it.exists() } ?: error("missing fixture $name")
        return f.readText()
    }

    private val news: FetchText = { url ->
        when {
            "timelinevolraw" in url -> fixture("gdelt-timeline.json")
            "news.google.com" in url -> fixture("google-news.xml")
            else -> throw IOException("unexpected $url")
        }
    }

    @Test fun parsesParameter() {
        assertEquals(Params("Portland", "Oregon", "United States"), parseParam(" Portland | Oregon | United States "))
        assertEquals(listOf("Москва"), parseParam("Moscow / Москва").names)
        assertEquals("france", parseParam("Paris").country)
        assertEquals("Illinois", parseParam("Springfield | Illinois").country)
        assertEquals("", parseParam("Smalltown").country)
        assertEquals("myanmar", withDefaultCountry(Params("Yangon")).country)
    }

    @Test fun parsesRss() {
        val items = parseRss(fixture("google-news.xml"))
        assertEquals(7, items.size)
        assertEquals("Police fire tear gas as protesters clash in Paris", items[0].title)
        assertEquals("Reuters", items[0].source)
        assertEquals("Paris transport unions call strike for Friday & Saturday", items[3].title)
    }

    @Test fun ratesHeadlines() {
        assertEquals(3.0, rateHeadline("Two killed in clashes").severity, 0.0)
        assertEquals(2.0, rateHeadline("Police use tear gas").severity, 0.0)
        assertEquals(1.0, rateHeadline("Workers strike over pay").severity, 0.0)
        assertEquals(0.5, rateHeadline("Peaceful rally downtown").severity, 0.0)
        assertEquals(0.0, rateHeadline("Fashion week opens").severity, 0.0)
        assertEquals(0.0, rateHeadline("Airstrike report due in March").severity, 0.0)
    }

    @Test fun preparesHeadlines() {
        val hs = prepareHeadlines(parseRss(fixture("google-news.xml")), listOf("Paris"), now)
        assertEquals(listOf("BBC", "Reuters", "Le Monde", "France 24"), hs.map { it.source })
    }

    @Test fun summarizesTimeline() {
        val v = summarizeTimeline(fixture("gdelt-timeline.json"), now)!!
        assertEquals(8.0 * 24, v.last24h, 0.001)
        assertEquals(2.0 * 24, v.baseline, 0.001)
        assertEquals(7, v.daily.size)
    }

    @Test fun scoresInRange() {
        assertEquals(0, scoreReport(emptyList(), Volume(0.0, 0.0, emptyList())))
        val mild = listOf(Headline("t", "s", "u", null, 1.0, emptyList(), 1.0))
        val bad = List(10) { Headline("t", "s", "u", null, 3.0, emptyList(), 3.0) }
        val spike = Volume(300.0, 20.0, emptyList())
        assertTrue(scoreReport(mild, null) < 15)
        assertTrue(scoreReport(bad, spike) in 90..100)
        assertEquals(0, scoreReport(emptyList(), spike))
        assertTrue(scoreReport(emptyList(), spike, newsOk = false) > 30)
        assertEquals("Calm", levelFor(0).name)
        assertEquals("High", levelFor(60).name)
        assertEquals("Severe", levelFor(100).name)
    }

    @Test fun buildsFullReportAndMatchesJsScore() {
        val r = buildReport(Params("Paris"), news, now)
        assertEquals(4, r.reports)
        assertEquals(4, r.sources)
        // Same inputs give 67 in the iPhone widget (see test/widget.test.js).
        assertEquals(67, r.score)
        assertEquals("High", r.level)
        assertTrue(r.errors.isEmpty())
    }

    @Test fun fallsBackToGdeltArticles() {
        val r = buildReport(Params("Paris"), { url ->
            when {
                "artlist" in url -> fixture("gdelt-articles.json")
                else -> throw IOException("HTTP 503")
            }
        }, now)
        assertEquals(2, r.reports)
        assertEquals(3.0, r.headlines[0].severity, 0.0)
        assertEquals(2, r.errors.size)
    }

    @Test(expected = NoSourcesException::class)
    fun throwsWhenOffline() {
        buildReport(Params("Paris"), { throw IOException("offline") }, now)
    }

    @Test fun handlesGdeltTextErrors() {
        val r = buildReport(Params("Paris"), { url ->
            if ("gdelt" in url) "Please limit requests to one every 5 seconds" else fixture("google-news.xml")
        }, now)
        assertNull(r.volume)
        assertEquals(4, r.reports)
        assertEquals(1, r.errors.size)
    }

    @Test fun trend() {
        val r = buildReport(Params("Paris"), news, now)
        assertEquals("", trendFrom(emptyList(), r).arrow)
        assertEquals("▲", trendFrom(listOf(HistoryPoint(now - 4 * 3600_000, 30)), r).arrow)
        assertEquals("▼", trendFrom(listOf(HistoryPoint(now - 4 * 3600_000, 75)), r).arrow)
    }

    @Test fun reportSurvivesJson() {
        val r = buildReport(Params("Yangon", country = "Myanmar"), { url ->
            if ("mfa.gov.sg" in url) fixture("mfa-myanmar.html") else news(url)
        }, now)
        val back = reportFromJson(JSONObject(r.toJson().toString()))
        assertEquals(r, back)
    }

    // ---- Singapore MFA ----

    @Test fun mfaUrls() {
        assertEquals(MFA_BASE + "saudi-arabia/", mfaCountryUrl("Saudi Arabia"))
        assertEquals(MFA_BASE + "cote-d-ivoire/", mfaCountryUrl("Côte d'Ivoire"))
        assertEquals(MFA_BASE + "turkiye/", mfaCountryUrl("Turkey"))
        assertEquals(MFA_BASE + "united-kingdom/", mfaCountryUrl("UK"))
    }

    @Test fun mfaDeferAll() {
        val r = parseMfaPage(fixture("mfa-myanmar.html"), "Yangon", "u")
        assertEquals(MfaStatus.DEFER_ALL, r.status)
        assertEquals("10 June 2026", r.date)
        assertEquals("10 Jun", r.shortDate)
        assertTrue(r.summary.contains("strongly advised to defer all travel to Myanmar"))
        assertTrue(r.leave)
        assertTrue(r.mentionsCity)
        assertTrue(r.cityNote.contains("Protests have been reported in Yangon"))
    }

    @Test fun mfaIgnoresScriptsAndFooters() {
        val html = "<html><body><script>defer all travel</script><main>" +
            "<p>Visa free for 30 days.</p>".repeat(12) + "</main><footer>Travel Notice</footer></body></html>"
        assertEquals(MfaStatus.NONE, parseMfaPage(html, "X", "u").status)
    }

    @Test fun mfaNonEssential() {
        val r = parseMfaPage(fixture("mfa-russia.html"), "Moscow", "u")
        assertEquals(MfaStatus.DEFER_NON_ESSENTIAL, r.status)
        assertEquals("29 June 2026", r.date)
        assertFalse(r.mentionsCity)
    }

    @Test fun mfaNoAdvisoryAndUnreadable() {
        assertEquals(MfaStatus.NONE, parseMfaPage(fixture("mfa-france.html"), "Paris", "u").status)
        assertEquals(MfaStatus.UNREADABLE, parseMfaPage("<html><body><div id=app></div></body></html>", "Paris", "u").status)
    }

    @Test fun mfaIndexLookup() {
        val index = fixture("mfa-index.html")
        assertTrue(findMfaCountryLink(index, "Venezuela")!!.endsWith("bolivarian-republic-of-venezuela/"))
        assertTrue(findMfaCountryLink(index, "United States")!!.endsWith("united-states-of-america/"))
        assertTrue(findMfaCountryLink(index, "Turkey")!!.startsWith("https://www.mfa.gov.sg/"))
        assertNull(findMfaCountryLink(index, "Atlantis"))
    }

    @Test fun mfaFallsBackToIndex() {
        val fetched = mutableListOf<String>()
        val r = checkMfa("Caracas", "Venezuela") { url ->
            fetched += url
            when {
                url.endsWith("/venezuela/") -> throw IOException("HTTP 404")
                url.endsWith("visa-information/") -> fixture("mfa-index.html")
                "bolivarian" in url -> fixture("mfa-russia.html").replace("Russia", "Venezuela")
                else -> throw IOException("unexpected $url")
            }
        }
        assertEquals(MfaStatus.DEFER_NON_ESSENTIAL, r.status)
        assertEquals(3, fetched.size)
    }

    @Test fun mfaFloor() {
        val all = MfaResult(MfaStatus.DEFER_ALL, mentionsCity = true)
        assertEquals(55, applyMfaFloor(10, all))
        assertEquals(35, applyMfaFloor(10, all.copy(mentionsCity = false)))
        assertEquals(35, applyMfaFloor(10, MfaResult(MfaStatus.DEFER_NON_ESSENTIAL, mentionsCity = true)))
        assertEquals(10, applyMfaFloor(10, MfaResult(MfaStatus.DEFER_NON_ESSENTIAL)))
        assertEquals(80, applyMfaFloor(80, all))
    }

    @Test fun reportWithMfa() {
        val ok = buildReport(Params("Yangon", country = "Myanmar"), { url ->
            if ("mfa.gov.sg" in url) fixture("mfa-myanmar.html") else news(url)
        }, now)
        assertEquals(MfaStatus.DEFER_ALL, ok.mfa!!.status)
        assertTrue(ok.score >= 55)
        assertTrue(ok.errors.isEmpty())

        val down = buildReport(Params("Paris", country = "France", translate = false), { url ->
            if ("mfa.gov.sg" in url) throw IOException("HTTP 503") else news(url)
        }, now)
        assertEquals(MfaStatus.UNREADABLE, down.mfa!!.status)
        assertEquals(1, down.errors.size)
        assertEquals(4, down.reports)
    }
}
