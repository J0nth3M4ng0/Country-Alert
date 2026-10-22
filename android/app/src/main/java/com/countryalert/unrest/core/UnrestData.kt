package com.countryalert.unrest.core

import org.json.JSONArray
import org.json.JSONObject

/**
 * Search terms, unrest words in 21 languages, Google News editions and city
 * names, read from data/unrest-data.json (packaged with the app). The iPhone
 * widget carries a copy of the same file.
 */
object UnrestData {
    data class Language(
        val match: String,
        val query: List<String>,
        val terms: Map<Int, List<String>>,
        val calm: List<String>,
    )

    data class Edition(val ceid: String, val hl: String, val gl: String, val lang: String)

    data class City(val country: String, val names: List<String>, val editions: List<String>)

    private val root: JSONObject by lazy {
        val stream = UnrestData::class.java.getResourceAsStream("/unrest-data.json")
            ?: error("unrest-data.json missing from the app")
        JSONObject(stream.bufferedReader(Charsets.UTF_8).use { it.readText() })
    }

    private fun JSONArray?.strings(): List<String> =
        if (this == null) emptyList() else (0 until length()).map { getString(it) }

    private fun <T> JSONObject.mapValues(f: (String) -> T): Map<String, T> =
        keys().asSequence().associateWith(f)

    val international: String by lazy { root.getString("international") }

    val languages: Map<String, Language> by lazy {
        val o = root.getJSONObject("languages")
        o.mapValues { code ->
            val l = o.getJSONObject(code)
            val t = l.getJSONObject("terms")
            Language(
                match = l.getString("match"),
                query = l.getJSONArray("query").strings(),
                terms = listOf(3, 2, 1).associateWith { t.getJSONArray(it.toString()).strings() },
                calm = l.getJSONArray("calm").strings(),
            )
        }
    }

    val editions: Map<String, Edition> by lazy {
        val o = root.getJSONObject("editions")
        o.mapValues { ceid ->
            val e = o.getJSONObject(ceid)
            Edition(ceid, e.getString("hl"), e.getString("gl"), e.getString("lang"))
        }
    }

    val countries: Map<String, List<String>> by lazy {
        val o = root.getJSONObject("countries")
        o.mapValues { o.getJSONArray(it).strings() }
    }

    /** English names and nationality words per country, for spotting news about other countries. */
    val countryNames: Map<String, List<String>> by lazy {
        val o = root.getJSONObject("countryNames")
        o.mapValues { o.getJSONArray(it).strings() }
    }

    /** City names that are also everyday words or first names; never read as another country. */
    val notForeign: List<String> by lazy { root.optJSONArray("notForeign").strings() }

    val aliases: Map<String, String> by lazy {
        val o = root.getJSONObject("aliases")
        o.mapValues { o.getString(it) }
    }

    val cities: Map<String, City> by lazy {
        val o = root.getJSONObject("cities")
        o.mapValues { key ->
            val c = o.getJSONObject(key)
            City(c.getString("country"), c.optJSONArray("names").strings(), c.optJSONArray("editions").strings())
        }
    }
}
