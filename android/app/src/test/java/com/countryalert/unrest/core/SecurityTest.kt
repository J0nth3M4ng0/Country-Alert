package com.countryalert.unrest.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SecurityTest {
    @Test fun onlyWebLinksSurvive() {
        assertEquals("https://example.com/a?b=1", safeUrl("https://example.com/a?b=1"))
        listOf(
            "intent://x#Intent;scheme=evil;end",
            "javascript:alert(1)",
            "file:///sdcard/x",
            "content://x/y",
            "https://exa mple.com",
            "",
            null,
        ).forEach { assertEquals(it.toString(), "", safeUrl(it)) }
    }

    @Test fun mfaLinksMustBeOnMfaSite() {
        assertTrue(isMfaUrl("https://www.mfa.gov.sg/x/"))
        assertTrue(isMfaUrl("https://mfa.gov.sg/x/"))
        assertFalse(isMfaUrl("https://www.mfa.gov.sg.evil.com/x/"))
        assertFalse(isMfaUrl("https://www.mfa.gov.sg@evil.com/x/"))
        assertFalse(isMfaUrl("http://www.mfa.gov.sg/x/"))
    }

    @Test fun feedLinksWithOtherSchemesAreDropped() {
        val xml = "<rss><channel>" +
            "<item><title>Riot in Paris - X</title><link>intent://evil#Intent;end</link><source>X</source></item>" +
            "<item><title>Riot in Paris 2 - X</title><link>https://news.example/a</link><source>X</source></item>" +
            "</channel></rss>"
        val items = parseRss(xml)
        assertEquals("", items[0].url)
        assertEquals("https://news.example/a", items[1].url)
        val g = parseGdeltArticles("""{"articles":[{"title":"t","url":"javascript:alert(1)","seendate":""}]}""")
        assertEquals("", g[0].url)
    }

    @Test fun mfaIndexLinksToOtherSitesAreIgnored() {
        val html = "<a href=\"https://evil.example/travel-advisories-notices-and-visa-information/france/\">France</a>"
        assertNull(findMfaCountryLink(html, "France"))
    }
}
