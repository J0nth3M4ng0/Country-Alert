package com.countryalert.unrest

import android.content.Context
import com.countryalert.unrest.core.HistoryPoint
import com.countryalert.unrest.core.Params
import com.countryalert.unrest.core.Report
import com.countryalert.unrest.core.reportFromJson
import com.countryalert.unrest.core.toJson
import org.json.JSONArray
import org.json.JSONObject

/** Per-widget settings, last report and score history, kept in SharedPreferences. */
class WidgetStore(context: Context) {
    private val prefs = context.getSharedPreferences("city_unrest", Context.MODE_PRIVATE)

    fun params(id: Int): Params? {
        val city = prefs.getString("city_$id", null) ?: return null
        return Params(
            city = city,
            context = prefs.getString("context_$id", "").orEmpty(),
            country = prefs.getString("country_$id", "").orEmpty(),
            names = prefs.getString("names_$id", "").orEmpty().split("/").filter { it.isNotBlank() },
            localNews = prefs.getBoolean("local_$id", true),
        )
    }

    fun saveParams(id: Int, p: Params) {
        prefs.edit()
            .putString("city_$id", p.city)
            .putString("context_$id", p.context)
            .putString("country_$id", p.country)
            .putString("names_$id", p.names.joinToString("/"))
            .putBoolean("local_$id", p.localNews)
            .remove("report_$id")
            .remove("history_$id")
            .apply()
    }

    fun report(id: Int): Report? = try {
        prefs.getString("report_$id", null)?.let { reportFromJson(JSONObject(it)) }
    } catch (e: Exception) {
        null
    }

    fun history(id: Int): List<HistoryPoint> = try {
        val a = JSONArray(prefs.getString("history_$id", "[]"))
        (0 until a.length()).map { a.getJSONObject(it).let { o -> HistoryPoint(o.getLong("t"), o.getInt("s")) } }
    } catch (e: Exception) {
        emptyList()
    }

    /** Saves a fresh report and appends it to the history (last 96 readings). */
    fun saveReport(id: Int, r: Report) {
        val h = (history(id) + HistoryPoint(r.generatedAt, r.score)).takeLast(96)
        val arr = JSONArray(h.map { JSONObject().put("t", it.t).put("s", it.score) })
        prefs.edit()
            .putString("report_$id", r.toJson().toString())
            .putString("history_$id", arr.toString())
            .putString("error_$id", null)
            .apply()
    }

    fun error(id: Int): String? = prefs.getString("error_$id", null)
    fun saveError(id: Int, msg: String) = prefs.edit().putString("error_$id", msg).apply()

    fun delete(id: Int) {
        prefs.edit().apply {
            listOf("city", "names", "local", "context", "country", "report", "history", "error").forEach { remove("${it}_$id") }
        }.apply()
    }
}
