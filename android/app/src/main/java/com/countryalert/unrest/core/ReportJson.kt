package com.countryalert.unrest.core

import org.json.JSONArray
import org.json.JSONObject

// Converts reports to and from JSON so the widget can show the last result offline.

fun Report.toJson(): JSONObject = JSONObject()
    .put("city", city)
    .put("names", JSONArray(names))
    .put("context", context)
    .put("country", country)
    .put("score", score)
    .put("level", level)
    .put("color", color)
    .put("reports", reports)
    .put("sources", sources)
    .put("headlines", JSONArray(headlines.map { it.toJson() }))
    .put("volume", volume?.let {
        JSONObject().put("last24h", it.last24h).put("baseline", it.baseline).put("daily", JSONArray(it.daily))
    })
    .put("editions", JSONArray(editions))
    .put("translations", JSONObject(translations as Map<*, *>))
    .put("mfa", mfa?.toJson())
    .put("errors", JSONArray(errors))
    .put("link", link)
    .put("generatedAt", generatedAt)

private fun Headline.toJson() = JSONObject()
    .put("title", title)
    .put("source", source)
    .put("url", url)
    .put("date", date)
    .put("severity", severity)
    .put("matched", JSONArray(matched))
    .put("weight", weight)
    .put("lang", lang)
    .put("translated", translated)

private fun MfaResult.toJson() = JSONObject()
    .put("status", status.key)
    .put("date", date)
    .put("summary", summary)
    .put("mentionsCity", mentionsCity)
    .put("cityNote", cityNote)
    .put("url", url)
    .put("leave", leave)
    .put("error", error)

private fun JSONArray?.strings(): List<String> =
    if (this == null) emptyList() else (0 until length()).map { getString(it) }

private fun JSONObject.optStr(key: String): String? = if (isNull(key)) null else optString(key)

fun reportFromJson(o: JSONObject): Report {
    val hs = o.optJSONArray("headlines") ?: JSONArray()
    val v = o.optJSONObject("volume")
    val m = o.optJSONObject("mfa")
    return Report(
        city = o.getString("city"),
        names = o.optJSONArray("names").strings(),
        context = o.optString("context"),
        country = o.optString("country"),
        score = o.getInt("score"),
        level = o.getString("level"),
        color = o.getString("color"),
        reports = o.optInt("reports"),
        sources = o.optInt("sources"),
        headlines = (0 until hs.length()).map {
            val h = hs.getJSONObject(it)
            Headline(
                title = h.getString("title"),
                source = h.optString("source"),
                url = h.optString("url"),
                date = if (h.isNull("date")) null else h.optLong("date"),
                severity = h.optDouble("severity"),
                matched = h.optJSONArray("matched").strings(),
                weight = h.optDouble("weight"),
                lang = h.optString("lang", "en"),
                translated = h.optStr("translated"),
            )
        },
        volume = v?.let {
            val d = it.getJSONArray("daily")
            Volume(it.getDouble("last24h"), it.getDouble("baseline"), (0 until d.length()).map { i -> d.getDouble(i) })
        },
        editions = o.optJSONArray("editions").strings(),
        translations = o.optJSONObject("translations")?.let { t -> t.keys().asSequence().associateWith { t.getString(it) } }
            ?: emptyMap(),
        mfa = m?.let {
            MfaResult(
                status = MfaStatus.fromKey(it.optString("status")),
                date = it.optStr("date"),
                summary = it.optString("summary"),
                mentionsCity = it.optBoolean("mentionsCity"),
                cityNote = it.optString("cityNote"),
                url = it.optString("url", MFA_BASE),
                leave = it.optBoolean("leave"),
                error = it.optStr("error"),
            )
        },
        errors = o.optJSONArray("errors").strings(),
        link = o.optString("link"),
        generatedAt = o.getLong("generatedAt"),
    )
}
