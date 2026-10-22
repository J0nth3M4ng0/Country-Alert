package com.countryalert.unrest.core

// Singapore Ministry of Foreign Affairs travel advisories.
// Same logic as the MFA section of widget/CityUnrest.js.

const val MFA_BASE = "https://www.mfa.gov.sg/travelling-overseas/travel-advisories-notices-and-visa-information/"

enum class MfaStatus(val key: String, val label: String, val color: String, val rank: Int) {
    DEFER_ALL("defer-all", "Defer all travel", "#FF3B30", 4),
    DEFER_NON_ESSENTIAL("defer-non-essential", "Defer non-essential travel", "#FF9500", 3),
    CAUTION("caution", "Exercise caution", "#FFCC00", 2),
    NOTICE("notice", "Travel notice", "#FFCC00", 1),
    NONE("none", "No advisory", "#34C759", 0),
    UNREADABLE("unreadable", "Check MFA page", "#8E8E93", -1);

    companion object {
        fun fromKey(k: String?) = values().firstOrNull { it.key == k } ?: UNREADABLE
    }
}

data class MfaResult(
    val status: MfaStatus,
    val date: String? = null,
    val summary: String = "",
    val mentionsCity: Boolean = false,
    val cityNote: String = "",
    val url: String = MFA_BASE,
    val leave: Boolean = false,
    val error: String? = null,
) {
    /** "10 June 2026" -> "10 Jun". */
    val shortDate: String
        get() = date?.replace(Regex(" 20\\d\\d$"), "")?.replace(Regex("^(\\d+ \\w{3})\\w*$"), "$1").orEmpty()
}

fun mfaCountryName(country: String): String {
    val n = normalizeName(country)
    return UnrestData.aliases[n] ?: n
}

fun mfaCountryUrl(country: String) = MFA_BASE + mfaCountryName(country).replace(" ", "-") + "/"

private val INDEX_LINK = Regex(
    "<a\\b[^>]*href=\"([^\"]*travel-advisories-notices-and-visa-information/([a-z0-9-]+)/?)\"[^>]*>([\\s\\S]*?)</a>",
    RegexOption.IGNORE_CASE
)

/** Finds the country's travel page among the links on MFA's index page. */
fun findMfaCountryLink(indexHtml: String, country: String): String? {
    val want = mfaCountryName(country)
    val wantRe = Regex("(^| )" + escapeRegex(want) + "( |$)")
    var best: Pair<Int, String>? = null
    for (m in INDEX_LINK.findAll(indexHtml)) {
        val href = m.groupValues[1]
        val slug = m.groupValues[2].replace("-", " ")
        val text = normalizeName(decodeEntities(m.groupValues[3].replace(Regex("<[^>]+>"), " ")))
        val score = when {
            text == want || slug == want -> 3
            wantRe.containsMatchIn("$slug | $text") -> 2
            else -> 0
        }
        if (score > (best?.first ?: 0)) {
            val url = if (Regex("^https?:", RegexOption.IGNORE_CASE).containsMatchIn(href)) href
            else "https://www.mfa.gov.sg" + (if (href.startsWith("/")) "" else "/") + href
            if (isMfaUrl(url)) best = score to url
        }
    }
    return best?.second
}

private const val MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December"
private val DATE_RE = Regex("\\b(\\d{1,2}) ($MONTHS) (20\\d\\d)\\b", RegexOption.IGNORE_CASE)

private val MFA_RULES = listOf(
    MfaStatus.DEFER_ALL to Regex("\\bdefer all travel\\b", RegexOption.IGNORE_CASE),
    MfaStatus.DEFER_NON_ESSENTIAL to Regex("\\bdefer (all )?non-essential travel\\b", RegexOption.IGNORE_CASE),
    MfaStatus.CAUTION to Regex(
        "\\b(exercise|remain|stay|be)( extra| heightened| increased| high degree of)? (caution|vigilant|vigilance|alert)\\b" +
            "|\\bavoid (large )?(crowds|gatherings|protests|demonstrations)\\b",
        RegexOption.IGNORE_CASE
    ),
    MfaStatus.NOTICE to Regex("\\btravel notice\\b", RegexOption.IGNORE_CASE),
)

private val LEAVE_RE = Regex(
    "\\b(leave|leaving|depart|departing)\\b[^.]{0,80}\\b(as soon as possible|immediately|while (it is )?still possible|commercial)",
    RegexOption.IGNORE_CASE
)

fun parseMfaPage(html: String, city: String, url: String): MfaResult {
    val text = htmlToText(html)
    if (text.length < 200) return MfaResult(MfaStatus.UNREADABLE, url = url)

    val sentences = splitSentences(text)
    var status = MfaStatus.NONE
    var sentence: String? = null
    for ((s, re) in MFA_RULES) {
        val hit = sentences.firstOrNull { re.containsMatchIn(it) }
        if (hit != null) {
            status = s
            sentence = hit
            break
        }
    }

    // Date: the last date before the advisory sentence, else the first on the page.
    val at = if (sentence != null) text.indexOf(sentence) else text.length
    val dates = DATE_RE.findAll(text).toList()
    val d = dates.lastOrNull { it.range.first <= at } ?: dates.firstOrNull()
    val date = d?.let {
        val month = it.groupValues[2]
        "${it.groupValues[1]} ${month[0].uppercase()}${month.substring(1).lowercase()} ${it.groupValues[3]}"
    }

    val cityRe = wordRegex(city.lowercase())
    val citySentence = sentences.firstOrNull { cityRe.containsMatchIn(it) }
    return MfaResult(
        status = status,
        date = date,
        summary = sentence?.let { clip(it) }.orEmpty(),
        mentionsCity = citySentence != null,
        cityNote = citySentence?.let { clip(it) }.orEmpty(),
        url = url,
        leave = LEAVE_RE.containsMatchIn(text),
    )
}

/** Reads the country's MFA travel page; falls back to the index page if the guessed address fails. */
fun checkMfa(city: String, country: String, fetchText: FetchText): MfaResult {
    var url = mfaCountryUrl(country)
    val html = try {
        fetchText(url)
    } catch (e: Exception) {
        val index = fetchText(MFA_BASE)
        url = findMfaCountryLink(index, country) ?: throw Exception("\"$country\" not found on MFA site")
        fetchText(url)
    }
    return parseMfaPage(html, city, url)
}
