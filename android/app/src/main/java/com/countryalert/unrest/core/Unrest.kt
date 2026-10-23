package com.countryalert.unrest.core

import org.json.JSONObject
import java.net.URLEncoder
import java.text.Normalizer
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.concurrent.Callable
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

// Same logic as widget/CityUnrest.js (the iPhone widget). Keep them in step.

object Settings {
    var defaultCity = "Paris"
}

data class Level(val min: Int, val name: String, val color: String)

val LEVELS = listOf(
    Level(75, "Severe", "#FF3B30"),
    Level(55, "High", "#FF9500"),
    Level(35, "Elevated", "#FFCC00"),
    Level(15, "Low", "#A3D65C"),
    Level(0, "Calm", "#34C759"),
)

fun levelFor(score: Int): Level = LEVELS.first { score >= it.min }

/**
 * What a widget watches. [names] are extra spellings typed after "/", e.g.
 * "Moscow / Москва". [localNews] also reads the local-language news edition.
 */
data class Params(
    val city: String,
    val context: String = "",
    val country: String = "",
    val names: List<String> = emptyList(),
    val localNews: Boolean = true,
    val translate: Boolean = true,
)

/** Lowercase without Latin, Greek or Cyrillic accents; other scripts keep their marks. */
fun fold(s: String?): String =
    Normalizer.normalize(s ?: "", Normalizer.Form.NFD).replace(ACCENTS, "").lowercase()

private val ACCENTS = Regex("[\\u0300-\\u036f]")

fun cityInfo(city: String): UnrestData.City? = UnrestData.cities[fold(city).trim()]

/** "City", "City | context" or "City | context | country"; the city may list spellings after "/". */
fun parseParam(raw: String?): Params {
    val text = raw?.trim().orEmpty().ifEmpty { Settings.defaultCity }
    val parts = text.split("|").map { it.trim() }
    val spellings = parts[0].split("/").map { it.trim() }.filter { it.isNotEmpty() }
    val city = spellings.firstOrNull() ?: Settings.defaultCity
    val context = parts.getOrNull(1).orEmpty()
    val country = parts.getOrNull(2).orEmpty()
        .ifEmpty { context }
        .ifEmpty { cityInfo(city)?.country.orEmpty() }
    return Params(city, context, country, spellings.drop(1))
}

/** Fills in the country from the built-in city list when the user left it blank. */
fun withDefaultCountry(p: Params): Params =
    if (p.country.isNotBlank()) p
    else p.copy(country = p.context.ifBlank { cityInfo(p.city)?.country.orEmpty() })

/** Every spelling to search for: the city, the user's extra names, built-in local names. */
fun allNames(city: String, names: List<String> = emptyList()): List<String> {
    val out = mutableListOf<String>()
    for (n in listOf(city) + names + (cityInfo(city)?.names ?: emptyList())) {
        if (out.none { fold(it) == fold(n) }) out += n
    }
    return out
}

/**
 * Google News editions to read: the city's or country's local editions (up to
 * two), plus the international English edition when none is English.
 */
fun editionsFor(city: String, country: String, localNews: Boolean = true): List<String> {
    val local = if (!localNews) emptyList() else
        (cityInfo(city)?.editions?.ifEmpty { null } ?: UnrestData.countries[mfaCountryName(country)] ?: emptyList())
            .filter { it in UnrestData.editions }
            .take(2)
    val hasEnglish = local.any { UnrestData.editions.getValue(it).lang == "en" }
    return if (hasEnglish) local else local + UnrestData.international
}

private fun quote(s: String) = "\"" + s.replace("\"", "") + "\""
private fun enc(s: String) = URLEncoder.encode(s, "UTF-8").replace("+", "%20")

private fun cityQuery(names: List<String>) =
    if (names.size > 1) "(" + names.joinToString(" OR ") { quote(it) } + ")" else quote(names[0])

private fun newsQuery(names: List<String>, context: String, lang: String): String {
    val terms = UnrestData.languages.getValue(lang).query
    return cityQuery(names) + (if (context.isNotEmpty()) " " + quote(context) else "") +
        " (" + terms.joinToString(" OR ") + ")"
}

// GDELT translates foreign-language news, so English names and terms cover all languages.
fun gdeltTimelineUrl(city: String, context: String) =
    "https://api.gdeltproject.org/api/v2/doc/doc?mode=timelinevolraw&format=json" +
        "&timespan=7d&timelinesmooth=0&query=" + enc(newsQuery(listOf(city), context, "en"))

fun gdeltArticlesUrl(city: String, context: String) =
    "https://api.gdeltproject.org/api/v2/doc/doc?mode=artlist&format=json" +
        "&timespan=24h&maxrecords=75&sort=datedesc&query=" + enc(newsQuery(listOf(city), context, "en"))

private fun editionParams(ceid: String): String {
    val e = UnrestData.editions.getValue(ceid)
    return "&hl=${e.hl}&gl=${e.gl}&ceid=$ceid"
}

/** English-language editions search the English name; local editions search all spellings. */
private fun editionNames(names: List<String>, ceid: String) =
    if (UnrestData.editions.getValue(ceid).lang == "en") names.take(1) else names

fun googleNewsRssUrl(names: List<String>, context: String, ceid: String): String {
    val q = newsQuery(editionNames(names, ceid), context, UnrestData.editions.getValue(ceid).lang) + " when:1d"
    return "https://news.google.com/rss/search?q=" + enc(q) + editionParams(ceid)
}

fun googleNewsWebUrl(names: List<String>, context: String, ceid: String = UnrestData.international): String {
    val q = newsQuery(editionNames(names, ceid), context, UnrestData.editions.getValue(ceid).lang) + " when:1d"
    return "https://news.google.com/search?q=" + enc(q) + editionParams(ceid)
}

private val GDELT_DATE = Regex("^(\\d{4})(\\d{2})(\\d{2})T?(\\d{2})?(\\d{2})?(\\d{2})?Z?$")

/** GDELT dates look like 20261022T101500Z. Returns epoch millis. */
fun parseGdeltDate(s: String?): Long? {
    val m = GDELT_DATE.find(s ?: return null) ?: return null
    val g = m.groupValues
    fun n(i: Int) = g[i].ifEmpty { "0" }.toInt()
    return LocalDateTime.of(n(1), n(2), n(3), n(4), n(5), n(6)).toInstant(ZoneOffset.UTC).toEpochMilli()
}

fun parseRssDate(s: String): Long? = try {
    ZonedDateTime.parse(s.trim(), DateTimeFormatter.RFC_1123_DATE_TIME).toInstant().toEpochMilli()
} catch (e: Exception) {
    null
}

data class Item(val title: String, val source: String, val url: String, val date: Long?, val lang: String = "en")

/** Minimal RSS parser for Google News. */
fun parseRss(xml: String): List<Item> {
    val out = mutableListOf<Item>()
    for (m in Regex("<item\\b[^>]*>([\\s\\S]*?)</item>", RegexOption.IGNORE_CASE).findAll(xml)) {
        val body = m.groupValues[1]
        var title = tagText(body, "title")
        var source = tagText(body, "source")
        // Google News titles end with " - Source Name".
        if (source.isNotEmpty() && title.endsWith(" - $source")) {
            title = title.dropLast(" - $source".length).trim()
        } else if (source.isEmpty()) {
            val i = title.lastIndexOf(" - ")
            if (i > 0) {
                source = title.substring(i + 3).trim()
                title = title.substring(0, i).trim()
            }
        }
        out += Item(title, source.ifEmpty { "Unknown" }, safeUrl(tagText(body, "link")), parseRssDate(tagText(body, "pubDate")))
    }
    return out
}

fun parseGdeltArticles(json: String): List<Item> {
    val list = JSONObject(json).optJSONArray("articles") ?: return emptyList()
    return (0 until list.length()).map {
        val a = list.getJSONObject(it)
        Item(
            decodeEntities(a.optString("title")),
            a.optString("domain").ifEmpty { "Unknown" },
            safeUrl(a.optString("url")),
            parseGdeltDate(a.optString("seendate")),
        )
    }
}

data class Volume(val last24h: Double, val baseline: Double, val daily: List<Double>)

/** Turns a GDELT raw volume timeline into last-24h vs. prior-6-day numbers. */
fun summarizeTimeline(json: String, now: Long): Volume? {
    val timeline = JSONObject(json).optJSONArray("timeline") ?: return null
    val series = timeline.optJSONObject(0)?.optJSONArray("data") ?: return null
    if (series.length() == 0) return null
    val day = 24 * 3600 * 1000L
    val daily = DoubleArray(7) // oldest .. newest (last 24h)
    for (i in 0 until series.length()) {
        val p = series.getJSONObject(i)
        val d = parseGdeltDate(p.optString("date")) ?: continue
        val age = Math.floorDiv(now - d, day).toInt()
        if (age < 0 || age > 6) continue
        daily[6 - age] += p.optDouble("value", 0.0).let { if (it.isNaN()) 0.0 else it }
    }
    return Volume(daily[6], daily.take(6).sum() / 6, daily.toList())
}

private const val NOT_LETTER = "[^\\p{L}\\p{M}\\p{N}]"
private const val LETTER = "[\\p{L}\\p{M}\\p{N}]"

/**
 * How a term must sit in a headline:
 *   word      whole word (English, Vietnamese)
 *   prefix    start of a word, any ending (inflected languages)
 *   substring anywhere (Chinese, Japanese, Thai, Korean, Arabic, Hebrew)
 */
fun termRegex(term: String, mode: String): Regex {
    val t = escapeRegex(fold(term))
    return when (mode) {
        "substring" -> Regex(t)
        "prefix" -> Regex("(^|$NOT_LETTER)$t")
        else -> Regex("(^|$NOT_LETTER)$t(?!$LETTER)")
    }
}

private class TermPattern(val term: String, val weight: Int, val re: Regex)
private class Matchers(val terms: List<TermPattern>, val calm: List<Regex>)

private val MATCHERS = java.util.concurrent.ConcurrentHashMap<String, Matchers>()

private fun matchersFor(lang: String): Matchers = MATCHERS.getOrPut(lang) {
    val l = UnrestData.languages[lang] ?: UnrestData.languages.getValue("en")
    Matchers(
        terms = listOf(3, 2, 1).flatMap { w -> l.terms.getValue(w).map { TermPattern(it, w, termRegex(it, l.match)) } },
        calm = l.calm.map { termRegex(it, l.match) },
    )
}

data class Rating(val severity: Double, val matched: List<String>)

/** Rates a headline by its most severe term, in its own language and English. */
fun rateHeadline(title: String, lang: String = "en"): Rating {
    val text = fold(title)
    val langs = if (lang == "en") listOf("en") else listOf(lang, "en")
    var severity = 0.0
    val matched = mutableListOf<String>()
    for (l in langs) {
        for (p in matchersFor(l).terms) {
            if (p.re.containsMatchIn(text)) {
                matched += p.term
                severity = max(severity, p.weight.toDouble())
            }
        }
    }
    if (severity <= 1 && langs.any { l -> matchersFor(l).calm.any { it.containsMatchIn(text) } }) severity *= 0.5
    return Rating(severity, matched)
}

/** Scripts written without spaces between words, or with attached prefixes. */
private val NO_SPACE_SCRIPT = Regex("[\\u0590-\\u06ff\\u0e00-\\u0e7f\\u3040-\\u30ff\\u3400-\\u9fff\\uac00-\\ud7af]")

fun mentionsAny(title: String, names: List<String>): Boolean {
    val text = fold(title)
    return names.any { termRegex(it, if (NO_SPACE_SCRIPT.containsMatchIn(it)) "substring" else "prefix").containsMatchIn(text) }
}

data class Headline(
    val title: String,
    val source: String,
    val url: String,
    val date: Long?,
    val severity: Double,
    val matched: List<String>,
    val weight: Double,
    val lang: String = "en",
    /** English translation of a foreign-language headline, if available. */
    val translated: String? = null,
)

/** "[Translated] ..." for translated headlines, else the headline as written. */
fun displayTitle(h: Headline): String = if (h.translated != null) "[Translated] " + h.translated else h.title

// ---- Headlines about other countries ----
// A city's name also turns up in stories about elsewhere, e.g. a capital
// standing for its government ("Brasília condemns the crackdown in Caracas").
// Headlines naming a foreign country, its people or one of its cities are
// skipped. Names of the watched city and its own country are blanked out
// first, so "Papua New Guinea" isn't read as "Guinea".

private class ForeignMatchers(val own: List<Regex>, val foreign: List<Regex>)

private val FOREIGN = java.util.concurrent.ConcurrentHashMap<String, ForeignMatchers>()

private fun nameRegex(name: String) =
    termRegex(name, if (NO_SPACE_SCRIPT.containsMatchIn(name)) "substring" else "word")

private fun foreignMatchers(country: String, names: List<String>): ForeignMatchers {
    val own = mfaCountryName(country)
    return FOREIGN.getOrPut(own + "|" + names.joinToString("/") { fold(it) }) {
        val ownTerms = (UnrestData.countryNames[own] ?: emptyList()) + names
        val ownFolded = (ownTerms + UnrestData.notForeign).map { fold(it) }.toSet()
        val terms = mutableListOf<String>()
        for ((c, list) in UnrestData.countryNames) if (c != own) terms += list
        for ((city, info) in UnrestData.cities) if (info.country != own) terms += listOf(city) + info.names
        ForeignMatchers(
            own = ownTerms.map { nameRegex(it) },
            foreign = terms.filter { fold(it) !in ownFolded }.distinct().map { nameRegex(it) },
        )
    }
}

fun mentionsForeign(title: String, country: String, names: List<String>): Boolean {
    val m = foreignMatchers(country, names)
    var text = fold(title)
    for (re in m.own) text = re.replace(text, " ")
    return m.foreign.any { it.containsMatchIn(text) }
}

fun normalizeTitle(t: String) =
    fold(t).replace(Regex("[^\\p{L}\\p{N} ]"), "").replace(Regex("\\s+"), " ").trim().take(80)

/**
 * Keeps recent headlines that name the city and no other country, removes
 * duplicates, rates each; most severe first. [names] are the city's spellings.
 */
fun prepareHeadlines(items: List<Item>, names: List<String>, now: Long, country: String = ""): List<Headline> {
    val cutoff = now - 24 * 3600 * 1000L
    val seen = HashSet<String>()
    val out = mutableListOf<Headline>()
    for (it in items) {
        if (it.title.isEmpty()) continue
        if (it.date != null && it.date < cutoff) continue
        val key = normalizeTitle(it.title)
        if (key.isEmpty() || !seen.add(key)) continue
        // The news search also matches articles that only name the city in the body.
        if (!mentionsAny(it.title, names)) continue
        if (mentionsForeign(it.title, country, names)) continue
        val r = rateHeadline(it.title, it.lang)
        if (r.severity == 0.0) continue
        out += Headline(it.title, it.source, it.url, it.date, r.severity, r.matched, r.severity, it.lang)
    }
    return out.sortedWith(compareByDescending<Headline> { it.severity }.thenByDescending { it.date ?: 0L })
}

/**
 * GDELT's coverage count includes articles that only mention the city in
 * passing, and it wobbles from hour to hour. So it only adds to the score when
 * there's at least one headline about the city, or when the news feeds
 * couldn't be read ([newsOk] false) and it's all there is.
 */
fun scoreReport(headlines: List<Headline>, volume: Volume?, newsOk: Boolean = true): Int {
    val sevSum = headlines.sumOf { it.weight }
    val severeCount = headlines.count { it.severity >= 3 }
    val headlinePts = 50 * (1 - exp(-sevSum / 15))
    var score = if (newsOk && headlines.isEmpty()) {
        0.0
    } else if (volume != null) {
        val ratio = volume.last24h / max(volume.baseline, 1.0)
        val spikePts = 30 * ((ratio - 1) / 3).coerceIn(0.0, 1.0)
        val volumePts = 20 * (1 - exp(-volume.last24h / 60))
        headlinePts + spikePts + volumePts
    } else {
        headlinePts * 1.6 // headlines only: max 80
    }
    if (severeCount >= 3) score = max(score, 55.0)
    return min(100.0, max(0.0, score)).roundToInt()
}

/** An official "defer travel" advisory sets a minimum score, higher when it names the city. */
fun applyMfaFloor(score: Int, mfa: MfaResult?): Int = when {
    mfa == null -> score
    mfa.status == MfaStatus.DEFER_ALL -> max(score, if (mfa.mentionsCity) 55 else 35)
    mfa.status == MfaStatus.DEFER_NON_ESSENTIAL && mfa.mentionsCity -> max(score, 35)
    else -> score
}

data class Report(
    val city: String,
    val names: List<String>,
    val context: String,
    val country: String,
    val score: Int,
    val level: String,
    val color: String,
    val reports: Int,
    val sources: Int,
    val headlines: List<Headline>,
    val volume: Volume?,
    val editions: List<String>,
    /** Original -> English, kept so the next refresh doesn't translate them again. */
    val translations: Map<String, String>,
    val mfa: MfaResult?,
    val errors: List<String>,
    val link: String,
    val generatedAt: Long,
)

class NoSourcesException(msg: String) : Exception(msg)

/** Fetches text from a URL; throws on network or HTTP errors. */
typealias FetchText = (String) -> String

private fun <T> attempt(block: () -> T): Result<T> = try {
    Result.success(block())
} catch (e: Exception) {
    Result.failure(e)
}

private fun Throwable.short(): String = message ?: javaClass.simpleName

/** Builds a report, fetching all sources in parallel. Call off the main thread. */
fun buildReport(
    params: Params,
    fetchText: FetchText,
    now: Long = System.currentTimeMillis(),
    translations: Map<String, String> = emptyMap(),
): Report {
    val city = params.city
    val context = params.context
    val country = params.country
    val spellings = allNames(city, params.names)
    val editions = editionsFor(city, country, params.localNews)

    val pool = Executors.newFixedThreadPool(2 + editions.size)
    val timelineF = pool.submit(Callable { attempt { summarizeTimeline(fetchText(gdeltTimelineUrl(city, context)), now) } })
    val mfaF = pool.submit(Callable { if (country.isEmpty()) null else attempt { checkMfa(city, country, fetchText) } })
    val feedFs = editions.map { ceid -> pool.submit(Callable { attempt { fetchText(googleNewsRssUrl(spellings, context, ceid)) } }) }
    val timelineRes = timelineF.get(60, TimeUnit.SECONDS)
    val mfaRes = mfaF.get(60, TimeUnit.SECONDS)
    val feedRes = feedFs.map { it.get(60, TimeUnit.SECONDS) }
    pool.shutdown()

    val errors = mutableListOf<String>()
    var mfa: MfaResult? = null
    if (mfaRes != null) {
        mfa = mfaRes.getOrElse {
            errors += "MFA: " + it.short()
            MfaResult(MfaStatus.UNREADABLE, url = MFA_BASE, error = it.short())
        }
    }

    val volume = timelineRes.getOrElse { errors += "GDELT: " + it.short(); null }

    var items = mutableListOf<Item>()
    feedRes.forEachIndexed { i, res ->
        val ceid = editions[i]
        res.fold(
            { xml -> items += parseRss(xml).map { it.copy(lang = UnrestData.editions.getValue(ceid).lang) } },
            { errors += "Google News ($ceid): " + it.short() },
        )
    }

    var newsOk = feedRes.any { it.isSuccess }
    // Fall back to GDELT's article list if every Google News feed failed.
    if (!newsOk) {
        val art = attempt { parseGdeltArticles(fetchText(gdeltArticlesUrl(city, context))) }
        items = art.getOrElse { errors += "GDELT articles: " + it.short(); emptyList() }.toMutableList()
        newsOk = art.isSuccess
    }

    if (volume == null && items.isEmpty() && errors.isNotEmpty()) {
        throw NoSourcesException("No sources reachable. " + errors.joinToString("; "))
    }

    var headlines = prepareHeadlines(items, spellings, now, country)
    var translationCache = emptyMap<String, String>()
    if (params.translate) {
        val t = translateHeadlines(headlines.take(15), fetchText, translations)
        // The English translation shows foreign names the original wording hid.
        val kept = t.headlines.filter { it.translated == null || !mentionsForeign(it.translated, country, spellings) }
        headlines = kept + headlines.drop(15)
        translationCache = t.cache
        t.error?.let { errors += it }
    }
    val score = applyMfaFloor(scoreReport(headlines, volume, newsOk), mfa)
    val level = levelFor(score)
    return Report(
        city = city,
        names = params.names,
        context = context,
        country = country,
        score = score,
        level = level.name,
        color = level.color,
        reports = headlines.size,
        sources = headlines.map { it.source }.toSet().size,
        headlines = headlines.take(10),
        volume = volume,
        editions = editions,
        translations = translationCache,
        mfa = mfa,
        errors = errors,
        link = googleNewsWebUrl(spellings, context),
        generatedAt = now,
    )
}

data class HistoryPoint(val t: Long, val score: Int)
data class Trend(val arrow: String, val delta: Int)

/** Compares the current score with one from at least 3 hours earlier. */
fun trendFrom(history: List<HistoryPoint>, report: Report): Trend {
    val ref = history.lastOrNull { report.generatedAt - it.t >= 3 * 3600 * 1000L } ?: return Trend("", 0)
    val delta = report.score - ref.score
    return when {
        delta >= 8 -> Trend("▲", delta)
        delta <= -8 -> Trend("▼", delta)
        else -> Trend("▶", delta)
    }
}

fun timeAgo(ms: Long, now: Long = System.currentTimeMillis()): String {
    val mins = ((now - ms) / 60000.0).roundToInt()
    if (mins < 1) return "now"
    if (mins < 60) return "${mins}m"
    val h = (mins / 60.0).roundToInt()
    return if (h < 48) "${h}h" else "${(h / 24.0).roundToInt()}d"
}
