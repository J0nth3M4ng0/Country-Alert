package com.countryalert.unrest.core

import org.json.JSONObject
import java.net.URLEncoder
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
    var newsLanguage = "en"
    var newsCountry = "US"
}

/** Words that suggest unrest, by severity (3 = most severe). */
val UNREST_TERMS: Map<Int, List<String>> = mapOf(
    3 to listOf(
        "killed", "dead", "deaths", "death toll", "shooting", "shot dead",
        "gunfire", "gunmen", "explosion", "bombing", "martial law",
        "state of emergency", "curfew", "coup", "massacre", "live ammunition",
        "troops deployed", "army deployed", "lynching",
    ),
    2 to listOf(
        "riot", "riots", "rioting", "rioters", "clash", "clashes", "clashed",
        "tear gas", "teargas", "looting", "looted", "looters", "arson",
        "set fire", "torched", "violent", "violence", "injured", "wounded",
        "arrested", "arrests", "detained", "rubber bullets", "water cannon",
        "barricade", "barricades", "unrest", "crackdown", "mob", "stampede",
        "molotov", "vandalism", "uprising", "insurrection",
    ),
    1 to listOf(
        "protest", "protests", "protested", "protesting", "protesters",
        "protestors", "demonstration", "demonstrations", "demonstrators",
        "marchers", "strike", "strikes", "general strike", "walkout", "blockade",
        "blockades", "rally", "rallies", "sit-in", "picket", "boycott",
        "shutdown", "hartal", "bandh", "unions", "dissent",
    ),
)

val CALMING_TERMS = listOf("peaceful", "peacefully", "calm returns", "called off", "ends", "ended")

val QUERY_TERMS = listOf(
    "protest", "protesters", "riot", "clashes", "unrest", "curfew",
    "\"tear gas\"", "demonstrators", "strike", "looting",
)

data class Level(val min: Int, val name: String, val color: String)

val LEVELS = listOf(
    Level(75, "Severe", "#FF3B30"),
    Level(55, "High", "#FF9500"),
    Level(35, "Elevated", "#FFCC00"),
    Level(15, "Low", "#A3D65C"),
    Level(0, "Calm", "#34C759"),
)

fun levelFor(score: Int): Level = LEVELS.first { score >= it.min }

data class Params(val city: String, val context: String = "", val country: String = "")

/** "City", "City | context" or "City | context | country". */
fun parseParam(raw: String?): Params {
    val text = raw?.trim().orEmpty().ifEmpty { Settings.defaultCity }
    val parts = text.split("|").map { it.trim() }
    val city = parts.getOrNull(0).orEmpty().ifEmpty { Settings.defaultCity }
    val context = parts.getOrNull(1).orEmpty()
    val country = parts.getOrNull(2).orEmpty()
        .ifEmpty { context }
        .ifEmpty { CITY_COUNTRIES[city.lowercase()].orEmpty() }
    return Params(city, context, country)
}

/** Fills in the country from the built-in city list when the user left it blank. */
fun withDefaultCountry(p: Params): Params =
    if (p.country.isNotBlank()) p
    else p.copy(country = p.context.ifBlank { CITY_COUNTRIES[p.city.lowercase()].orEmpty() })

private fun quote(s: String) = "\"" + s.replace("\"", "") + "\""
private fun enc(s: String) = URLEncoder.encode(s, "UTF-8").replace("+", "%20")

private fun baseQuery(city: String, context: String) =
    quote(city) + (if (context.isNotEmpty()) " " + quote(context) else "") +
        " (" + QUERY_TERMS.joinToString(" OR ") + ")"

fun gdeltTimelineUrl(city: String, context: String) =
    "https://api.gdeltproject.org/api/v2/doc/doc?mode=timelinevolraw&format=json" +
        "&timespan=7d&timelinesmooth=0&query=" + enc(baseQuery(city, context))

fun gdeltArticlesUrl(city: String, context: String) =
    "https://api.gdeltproject.org/api/v2/doc/doc?mode=artlist&format=json" +
        "&timespan=24h&maxrecords=75&sort=datedesc&query=" + enc(baseQuery(city, context))

private fun newsEdition(): String {
    val l = Settings.newsLanguage
    val c = Settings.newsCountry
    return "&hl=$l-$c&gl=$c&ceid=$c:$l"
}

fun googleNewsRssUrl(city: String, context: String) =
    "https://news.google.com/rss/search?q=" + enc(baseQuery(city, context) + " when:1d") + newsEdition()

fun googleNewsWebUrl(city: String, context: String) =
    "https://news.google.com/search?q=" + enc(baseQuery(city, context) + " when:1d") + newsEdition()

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

data class Item(val title: String, val source: String, val url: String, val date: Long?)

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

private data class TermPattern(val term: String, val weight: Int, val re: Regex)

private val TERM_PATTERNS = UNREST_TERMS.flatMap { (w, terms) -> terms.map { TermPattern(it, w, wordRegex(it)) } }
    .sortedByDescending { it.weight }
private val CALM_PATTERNS = CALMING_TERMS.map { wordRegex(it) }

data class Rating(val severity: Double, val matched: List<String>)

fun rateHeadline(title: String): Rating {
    var severity = 0.0
    val matched = mutableListOf<String>()
    for (p in TERM_PATTERNS) {
        if (p.re.containsMatchIn(title)) {
            matched += p.term
            severity = max(severity, p.weight.toDouble())
        }
    }
    if (severity <= 1 && CALM_PATTERNS.any { it.containsMatchIn(title) }) severity *= 0.5
    return Rating(severity, matched)
}

data class Headline(
    val title: String,
    val source: String,
    val url: String,
    val date: Long?,
    val severity: Double,
    val matched: List<String>,
    val weight: Double,
)

private fun normalizeTitle(t: String) =
    t.lowercase().replace(Regex("[^a-z0-9 ]"), "").replace(Regex("\\s+"), " ").trim().take(80)

/** Keeps recent headlines, removes duplicates, rates each; most severe first. */
fun prepareHeadlines(items: List<Item>, city: String, now: Long): List<Headline> {
    val cutoff = now - 24 * 3600 * 1000L
    val cityRe = wordRegex(city.lowercase(), trailingBoundary = false)
    val seen = HashSet<String>()
    val out = mutableListOf<Headline>()
    for (it in items) {
        if (it.title.isEmpty()) continue
        if (it.date != null && it.date < cutoff) continue
        if (!seen.add(normalizeTitle(it.title))) continue
        val r = rateHeadline(it.title)
        if (r.severity == 0.0) continue
        // Headlines that name the city count fully; others (matched on article body) count half.
        val weight = r.severity * if (cityRe.containsMatchIn(it.title)) 1.0 else 0.5
        out += Headline(it.title, it.source, it.url, it.date, r.severity, r.matched, weight)
    }
    return out.sortedWith(compareByDescending<Headline> { it.severity }.thenByDescending { it.date ?: 0L })
}

fun scoreReport(headlines: List<Headline>, volume: Volume?): Int {
    val sevSum = headlines.sumOf { it.weight }
    val severeCount = headlines.count { it.severity >= 3 }
    val headlinePts = 50 * (1 - exp(-sevSum / 15))
    var score = if (volume != null) {
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
    val context: String,
    val country: String,
    val score: Int,
    val level: String,
    val color: String,
    val reports: Int,
    val sources: Int,
    val headlines: List<Headline>,
    val volume: Volume?,
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

/** Builds a report. Runs the three sources in parallel. Call off the main thread. */
fun buildReport(params: Params, fetchText: FetchText, now: Long = System.currentTimeMillis()): Report {
    val (city, context, country) = params
    val pool = Executors.newFixedThreadPool(3)
    val timelineF = pool.submit(Callable { attempt { summarizeTimeline(fetchText(gdeltTimelineUrl(city, context)), now) } })
    val rssF = pool.submit(Callable { attempt { fetchText(googleNewsRssUrl(city, context)) } })
    val mfaF = pool.submit(Callable { if (country.isEmpty()) null else attempt { checkMfa(city, country, fetchText) } })
    val timelineRes = timelineF.get(60, TimeUnit.SECONDS)
    val rssRes = rssF.get(60, TimeUnit.SECONDS)
    val mfaRes = mfaF.get(60, TimeUnit.SECONDS)
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

    var items: List<Item> = rssRes.fold({ parseRss(it) }, { errors += "Google News: " + it.short(); emptyList() })
    // Fall back to GDELT's article list if Google News failed.
    if (rssRes.isFailure) {
        items = attempt { parseGdeltArticles(fetchText(gdeltArticlesUrl(city, context))) }
            .getOrElse { errors += "GDELT articles: " + it.short(); emptyList() }
    }

    if (volume == null && items.isEmpty() && errors.isNotEmpty()) {
        throw NoSourcesException("No sources reachable. " + errors.joinToString("; "))
    }

    val headlines = prepareHeadlines(items, city, now)
    val score = applyMfaFloor(scoreReport(headlines, volume), mfa)
    val level = levelFor(score)
    return Report(
        city = city,
        context = context,
        country = country,
        score = score,
        level = level.name,
        color = level.color,
        reports = headlines.size,
        sources = headlines.map { it.source }.toSet().size,
        headlines = headlines.take(10),
        volume = volume,
        mfa = mfa,
        errors = errors,
        link = googleNewsWebUrl(city, context),
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
