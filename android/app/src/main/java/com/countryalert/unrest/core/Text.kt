package com.countryalert.unrest.core

import java.text.Normalizer

// Small text helpers shared by the RSS, GDELT and MFA parsers.

private val CDATA = Regex("<!\\[CDATA\\[([\\s\\S]*?)]]>")
private val DEC_ENTITY = Regex("&#(\\d+);")
private val HEX_ENTITY = Regex("&#x([0-9a-fA-F]+);")

fun decodeEntities(s: String?): String {
    if (s == null) return ""
    return s.replace(CDATA, "$1")
        .replace(DEC_ENTITY) { codePoint(it.groupValues[1].toInt()) }
        .replace(HEX_ENTITY) { codePoint(it.groupValues[1].toInt(16)) }
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&#39;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .trim()
}

private fun codePoint(n: Int): String = String(Character.toChars(n))

fun tagText(xml: String, tag: String): String {
    val m = Regex("<$tag(?:\\s[^>]*)?>([\\s\\S]*?)</$tag>", RegexOption.IGNORE_CASE).find(xml)
    return if (m != null) decodeEntities(m.groupValues[1]) else ""
}

fun escapeRegex(s: String): String = Regex.escape(s)

/** Matches [term] as a whole word, ignoring case. */
fun wordRegex(term: String, trailingBoundary: Boolean = true): Regex {
    val end = if (trailingBoundary) "([^A-Za-z]|$)" else ""
    return Regex("(^|[^A-Za-z])" + escapeRegex(term) + end, RegexOption.IGNORE_CASE)
}

/** Lowercase, accents removed, anything that isn't a letter or digit becomes one space. */
fun normalizeName(s: String?): String {
    if (s == null) return ""
    return Normalizer.normalize(s, Normalizer.Form.NFD)
        .replace(Regex("[\\u0300-\\u036f]"), "")
        .lowercase()
        .replace(Regex("[^a-z0-9]+"), " ")
        .trim()
}

private val MAIN_RE = Regex("<main\\b[^>]*>([\\s\\S]*?)</main>", RegexOption.IGNORE_CASE)
private val ARTICLE_RE = Regex("<article\\b[^>]*>([\\s\\S]*?)</article>", RegexOption.IGNORE_CASE)
private val DROP_RE = Regex(
    "<(script|style|noscript|svg|nav|header|footer)\\b[\\s\\S]*?</\\1>",
    RegexOption.IGNORE_CASE
)

/** Visible text of the page's main content, one block per line. */
fun htmlToText(html: String?): String {
    var h = html ?: ""
    val main = MAIN_RE.find(h) ?: ARTICLE_RE.find(h)
    if (main != null) h = main.groupValues[1]
    val stripped = h.replace(DROP_RE, " ")
        .replace(Regex("<br\\s*/?>", RegexOption.IGNORE_CASE), "\n")
        .replace(Regex("</(p|div|li|h[1-6]|tr|section|ul|ol)>", RegexOption.IGNORE_CASE), "\n")
        .replace(Regex("<[^>]+>"), " ")
    return decodeEntities(stripped)
        .replace(Regex("[ \\t\\u00a0]+"), " ")
        .replace(Regex("\\s*\\n\\s*"), "\n")
        .trim()
}

fun splitSentences(text: String): List<String> =
    text.replace(Regex("([.!?])\\s+"), "$1\n")
        .split(Regex("\\n+"))
        .map { it.trim() }
        .filter { it.isNotEmpty() }

private val WEB_URL = Regex("^https?://[^\\s\"<>]+$", RegexOption.IGNORE_CASE)
private val MFA_URL = Regex("^https://(www\\.)?mfa\\.gov\\.sg/", RegexOption.IGNORE_CASE)

/**
 * Only plain web links may be opened. Feed data is untrusted, and other
 * schemes (intent:, file:, javascript:) could do more than open a page.
 */
fun safeUrl(u: String?): String {
    val s = u?.trim().orEmpty()
    return if (WEB_URL.matches(s)) s else ""
}

/** MFA links must point at MFA's own site. */
fun isMfaUrl(u: String?): Boolean = MFA_URL.containsMatchIn(safeUrl(u))

fun clip(s: String, max: Int = 220): String = if (s.length > max) s.take(max - 3) + "…" else s
