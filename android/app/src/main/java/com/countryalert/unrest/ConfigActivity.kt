package com.countryalert.unrest

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import com.countryalert.unrest.core.Params
import com.countryalert.unrest.core.Report
import com.countryalert.unrest.core.buildReport
import com.countryalert.unrest.core.withDefaultCountry

/**
 * Opens when a widget is added (to choose its city) and from the app icon
 * (to check a city right away).
 */
class ConfigActivity : Activity() {
    private var widgetId = AppWidgetManager.INVALID_APPWIDGET_ID
    private lateinit var city: EditText
    private lateinit var context: EditText
    private lateinit var country: EditText
    private lateinit var result: TextView

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
        val save = view<Button>(R.id.button_save)
        val check = view<Button>(R.id.button_check)

        val hasWidget = widgetId != AppWidgetManager.INVALID_APPWIDGET_ID
        save.visibility = if (hasWidget) View.VISIBLE else View.GONE
        view<TextView>(R.id.intro).setText(if (hasWidget) R.string.intro_widget else R.string.intro_app)

        WidgetStore(this).params(widgetId)?.let {
            city.setText(it.city)
            context.setText(it.context)
            country.setText(it.country)
        }

        save.setOnClickListener { saveWidget() }
        check.setOnClickListener { checkNow() }
    }

    private fun <T : View> view(id: Int): T = checkNotNull(findViewById<T>(id))

    private fun currentParams(): Params? {
        val c = city.text.toString().trim()
        if (c.isEmpty()) {
            city.error = getString(R.string.error_city)
            return null
        }
        return Params(c, context.text.toString().trim(), country.text.toString().trim())
    }

    private fun saveWidget() {
        val p = currentParams() ?: return
        WidgetStore(this).saveParams(widgetId, p)
        val manager = AppWidgetManager.getInstance(this)
        UnrestWidget.render(this, manager, widgetId)
        RefreshJob.schedule(this, intArrayOf(widgetId))
        setResult(RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId))
        finish()
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
        r.volume?.let { append("Coverage: %.0f articles today vs %.1f/day before\n".format(it.last24h, it.baseline)) }
        r.mfa?.let { m ->
            append("\nSingapore MFA (${r.country.ifEmpty { "?" }}): ${m.status.label}")
            m.date?.let { append(" · $it") }
            append("\n")
            if (m.summary.isNotEmpty()) append(m.summary + "\n")
            append(if (m.mentionsCity) "Mentions ${r.city}: ${m.cityNote}\n" else "Does not mention ${r.city}\n")
        } ?: append("\nSingapore MFA: no country set\n")
        if (r.headlines.isNotEmpty()) append("\nHeadlines:\n")
        r.headlines.forEach { append("• ${it.title} — ${it.source}\n") }
        if (r.errors.isNotEmpty()) append("\nSome sources failed: ${r.errors.joinToString("; ")}\n")
    }
}
