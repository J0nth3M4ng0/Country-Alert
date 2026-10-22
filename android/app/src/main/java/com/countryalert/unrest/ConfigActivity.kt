package com.countryalert.unrest

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.app.usage.UsageStatsManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.view.View
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.TextView
import com.countryalert.unrest.core.Params
import com.countryalert.unrest.core.Report
import com.countryalert.unrest.core.UnrestData
import com.countryalert.unrest.core.displayTitle
import com.countryalert.unrest.core.timeAgo
import com.countryalert.unrest.core.buildReport
import com.countryalert.unrest.core.withDefaultCountry

/**
 * Opens when a widget is added (to choose its city) and from the app icon
 * (to check a city right away).
 */
open class ConfigActivity : Activity() {
    private var widgetId = AppWidgetManager.INVALID_APPWIDGET_ID
    private lateinit var city: EditText
    private lateinit var context: EditText
    private lateinit var country: EditText
    private lateinit var result: TextView
    private lateinit var localNews: CheckBox
    private lateinit var translate: CheckBox
    private lateinit var save: Button
    private lateinit var check: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_config)
        widgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
        // If the user backs out, don't add the widget.
        setResult(RESULT_CANCELED, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId))

        city = view(R.id.input_city)
        context = view(R.id.input_context)
        country = view(R.id.input_country)
        result = view(R.id.result)
        localNews = view(R.id.input_local)
        translate = view(R.id.input_translate)
        save = view(R.id.button_save)
        check = view(R.id.button_check)

        val hasWidget = widgetId != AppWidgetManager.INVALID_APPWIDGET_ID
        save.visibility = if (hasWidget) View.VISIBLE else View.GONE
        view<TextView>(R.id.intro).setText(if (hasWidget) R.string.intro_widget else R.string.intro_app)

        WidgetStore(this).params(widgetId)?.let {
            city.setText((listOf(it.city) + it.names).joinToString(" / "))
            localNews.isChecked = it.localNews
            translate.isChecked = it.translate
            context.setText(it.context)
            country.setText(it.country)
        }

        save.setOnClickListener { saveWidget() }
        check.setOnClickListener { checkNow() }
        view<Button>(R.id.button_background).setOnClickListener { askForBackground() }
    }

    override fun onResume() {
        super.onResume()
        showStatus()
    }

    private fun ago(t: Long) = timeAgo(t).let { if (it == "now") "just now" else "$it ago" }

    /** When each widget last updated, and whether the phone limits background updates. */
    private fun showStatus() {
        val store = WidgetStore(this)
        val lines = mutableListOf<String>()
        for (id in RefreshJob.allWidgetIds(this)) {
            val p = store.params(id) ?: continue
            val updated = store.report(id)?.let { "updated " + ago(it.generatedAt) } ?: "not updated yet"
            val tried = store.lastAttempt(id).takeIf { it > 0 }?.let { ", last tried " + ago(it) }.orEmpty()
            val problem = store.error(id)?.let { "\n   Problem: $it" }.orEmpty()
            lines += "• ${p.city}: $updated$tried$problem"
        }
        val limited = backgroundLimit()
        lines += if (limited == null) "Background updates: allowed" else "Background updates: limited ($limited)"

        val status = view<TextView>(R.id.status)
        status.visibility = View.VISIBLE
        status.text = (if (lines.size > 1) "Your widgets\n" else "") + lines.joinToString("\n")
        view<Button>(R.id.button_background).visibility = if (limited == null) View.GONE else View.VISIBLE
    }

    /** Why the phone may hold back background updates, or null if it doesn't. */
    private fun backgroundLimit(): String? {
        val power = getSystemService(PowerManager::class.java)
        if (power != null && power.isIgnoringBatteryOptimizations(packageName)) return null
        var reason = "battery optimisation is on"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val bucket = getSystemService(UsageStatsManager::class.java)?.appStandbyBucket
            when {
                bucket == null -> {}
                bucket >= 45 -> reason += ", and Android has restricted this app"
                bucket >= UsageStatsManager.STANDBY_BUCKET_RARE -> reason += ", and Android rarely lets this app run"
            }
        }
        return reason
    }

    /** Opens Android's prompt to let the app run in the background. */
    private fun askForBackground() {
        val ask = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName"))
        try {
            startActivity(ask)
        } catch (e: Exception) {
            startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
        }
    }

    private fun <T : View> view(id: Int): T = checkNotNull(findViewById<T>(id))

    private fun currentParams(): Params? {
        val spellings = city.text.toString().split("/").map { it.trim() }.filter { it.isNotEmpty() }
        if (spellings.isEmpty()) {
            city.error = getString(R.string.error_city)
            return null
        }
        return Params(
            city = spellings[0],
            context = context.text.toString().trim(),
            country = country.text.toString().trim(),
            names = spellings.drop(1),
            localNews = localNews.isChecked,
            translate = translate.isChecked,
        )
    }

    /**
     * Saves the city and loads the first report while this screen is still
     * open. Background work can be delayed for a long time on some phones
     * (e.g. OnePlus), so the first load shouldn't depend on it.
     */
    private fun saveWidget() {
        val p = currentParams() ?: return
        WidgetStore(this).saveParams(widgetId, p)
        UnrestWidget.render(this, AppWidgetManager.getInstance(this), widgetId)
        setResult(RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId))

        save.isEnabled = false
        check.isEnabled = false
        result.text = getString(R.string.loading_widget)
        val app = applicationContext
        val id = widgetId
        Thread {
            RefreshJob.refreshWidget(app, id)
            RefreshJob.schedulePeriodic(app)
            runOnUiThread { if (!isFinishing) finish() }
        }.start()
    }

    private fun checkNow() {
        val p = currentParams() ?: return
        result.text = getString(R.string.checking)
        Thread {
            val text = try {
                describe(buildReport(withDefaultCountry(p), ::httpGet))
            } catch (e: Exception) {
                getString(R.string.error_load, e.message ?: e.javaClass.simpleName)
            }
            runOnUiThread { result.text = text }
        }.start()
    }

    private fun describe(r: Report): String = buildString {
        append("${r.city}: ${r.level} — ${r.score}/100\n")
        append("${r.reports} reports from ${r.sources} sources in the last 24 hours\n")
        val langs = r.editions.mapNotNull { UnrestData.editions[it]?.lang?.uppercase() }.distinct()
        if (langs.isNotEmpty()) append("News read in: ${langs.joinToString(", ")}\n")
        r.volume?.let { append("Coverage: %.0f articles today vs %.1f/day before\n".format(it.last24h, it.baseline)) }
        r.mfa?.let { m ->
            append("\nSingapore MFA (${r.country.ifEmpty { "?" }}): ${m.status.label}")
            m.date?.let { append(" · $it") }
            append("\n")
            if (m.summary.isNotEmpty()) append(m.summary + "\n")
            append(if (m.mentionsCity) "Mentions ${r.city}: ${m.cityNote}\n" else "Does not mention ${r.city}\n")
        } ?: append("\nSingapore MFA: no country set\n")
        if (r.headlines.isNotEmpty()) append("\nHeadlines:\n")
        r.headlines.forEach {
            val tag = if (it.lang != "en") " [${it.lang.uppercase()}]" else ""
            append("• ${displayTitle(it)} — ${it.source}$tag\n")
            if (it.translated != null) append("   Original: ${it.title}\n")
        }
        if (r.errors.isNotEmpty()) append("\nSome sources failed: ${r.errors.joinToString("; ")}\n")
    }
}
