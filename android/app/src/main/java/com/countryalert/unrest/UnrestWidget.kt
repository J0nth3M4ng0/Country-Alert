package com.countryalert.unrest

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.net.Uri
import android.os.Bundle
import android.text.format.DateFormat
import android.view.View
import android.widget.RemoteViews
import com.countryalert.unrest.core.MFA_BASE
import com.countryalert.unrest.core.Report
import com.countryalert.unrest.core.isMfaUrl
import com.countryalert.unrest.core.safeUrl
import com.countryalert.unrest.core.timeAgo
import com.countryalert.unrest.core.trendFrom
import java.util.Date

/** Home-screen widget. Refreshes about every 30 minutes and when tapped on "Updated". */
class UnrestWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        for (id in ids) render(context, manager, id)
        RefreshJob.schedule(context, ids)
    }

    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
        render(context, manager, id)
    }

    override fun onDeleted(context: Context, ids: IntArray) {
        val store = WidgetStore(context)
        for (id in ids) store.delete(id)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_REFRESH) {
            val id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
            if (id != AppWidgetManager.INVALID_APPWIDGET_ID) {
                render(context, AppWidgetManager.getInstance(context), id, refreshing = true)
                RefreshJob.schedule(context, intArrayOf(id), urgent = true)
            }
        }
    }

    private enum class Size { SMALL, MEDIUM, LARGE }

    companion object {
        const val ACTION_REFRESH = "com.countryalert.unrest.REFRESH"
        private val HEADLINE_ROWS = intArrayOf(R.id.h1, R.id.h2, R.id.h3, R.id.h4, R.id.h5)
        private val HEADLINE_TITLES = intArrayOf(R.id.h1_title, R.id.h2_title, R.id.h3_title, R.id.h4_title, R.id.h5_title)
        private val HEADLINE_METAS = intArrayOf(R.id.h1_meta, R.id.h2_meta, R.id.h3_meta, R.id.h4_meta, R.id.h5_meta)

        private fun sizeOf(manager: AppWidgetManager, id: Int): Size {
            val o = manager.getAppWidgetOptions(id)
            val w = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 110)
            val h = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 110)
            return when {
                w < 200 -> Size.SMALL
                h >= 220 -> Size.LARGE
                else -> Size.MEDIUM
            }
        }

        private fun color(hex: String, alpha: Int = 255): Int {
            val c = Color.parseColor(hex)
            return Color.argb(alpha, Color.red(c), Color.green(c), Color.blue(c))
        }

        /** Opens a web page. Anything that isn't an http(s) link opens [fallback] instead. */
        private fun openUrl(context: Context, url: String, requestCode: Int, fallback: String = MFA_BASE): PendingIntent {
            val target = safeUrl(url).ifEmpty { fallback }
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(target))
                .addCategory(Intent.CATEGORY_BROWSABLE)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            return PendingIntent.getActivity(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
        }

        private fun mfaLink(url: String) = if (isMfaUrl(url)) url else MFA_BASE

        private fun refreshIntent(context: Context, id: Int): PendingIntent =
            PendingIntent.getBroadcast(
                context,
                id,
                Intent(context, UnrestWidget::class.java)
                    .setAction(ACTION_REFRESH)
                    .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )

        private fun setupIntent(context: Context, id: Int): PendingIntent =
            PendingIntent.getActivity(
                context,
                id,
                Intent(context, WidgetSetupActivity::class.java)
                    .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )

        /** Draws one widget from its saved report. */
        fun render(context: Context, manager: AppWidgetManager, id: Int, refreshing: Boolean = false) {
            val store = WidgetStore(context)
            val size = sizeOf(manager, id)
            val layout = if (size == Size.SMALL) R.layout.widget_small else R.layout.widget_wide
            val v = RemoteViews(context.packageName, layout)
            val params = store.params(id)
            val report = store.report(id)

            if (params == null || report == null) {
                v.setTextViewText(R.id.city, (params?.city ?: "City Unrest").uppercase())
                v.setTextViewText(R.id.trend, "")
                v.setTextViewText(R.id.score, "–")
                v.setTextColor(R.id.score, Color.WHITE)
                v.setTextViewText(R.id.level, if (params == null) "Tap to set up" else "Loading…")
                v.setTextColor(R.id.level, Color.WHITE)
                v.setViewVisibility(R.id.mfa, View.GONE)
                v.setTextViewText(
                    R.id.meta,
                    store.error(id)?.let { "Couldn't load: $it" } ?: if (params == null) "Choose a city for this widget" else "",
                )
                v.setTextViewText(R.id.updated, if (params == null) "" else "Tap here to retry ↻")
                v.setInt(R.id.glow, "setColorFilter", Color.GRAY)
                if (size != Size.SMALL) hideWideExtras(v)
                v.setOnClickPendingIntent(R.id.root, setupIntent(context, id))
                if (params != null) v.setOnClickPendingIntent(R.id.updated, refreshIntent(context, id))
                manager.updateAppWidget(id, v)
                return
            }

            val trend = trendFrom(store.history(id), report)
            val accent = color(report.color)
            v.setInt(R.id.glow, "setColorFilter", accent)
            v.setTextViewText(R.id.city, report.city.uppercase())
            v.setTextViewText(R.id.trend, trend.arrow)
            v.setTextColor(R.id.trend, accent)
            v.setTextViewText(R.id.score, report.score.toString())
            v.setTextColor(R.id.score, accent)
            v.setTextViewText(R.id.level, report.level.uppercase())
            v.setTextColor(R.id.level, accent)
            v.setTextViewText(R.id.meta, "${report.reports} reports · ${report.sources} sources")

            val stale = store.error(id) != null
            val time = DateFormat.getTimeFormat(context).format(Date(report.generatedAt))
            v.setTextViewText(
                R.id.updated,
                when {
                    refreshing -> "Refreshing…"
                    stale -> "⚠ cached $time ↻"
                    else -> "Updated $time ↻"
                }
            )
            v.setTextColor(R.id.updated, if (stale) color("#FFCC00") else color("#FFFFFF", 150))
            v.setOnClickPendingIntent(R.id.updated, refreshIntent(context, id))
            v.setOnClickPendingIntent(R.id.root, openUrl(context, report.link, id * 10))

            val mfa = report.mfa
            if (mfa != null) {
                // The flag and date only mean something when there is an advisory or notice.
                val active = mfa.status.rank >= 1
                val flag = if (active && mfa.mentionsCity) " ⚑" else ""
                val date = if (active && mfa.shortDate.isNotEmpty()) " · " + mfa.shortDate else ""
                v.setViewVisibility(R.id.mfa, View.VISIBLE)
                v.setTextViewText(R.id.mfa, "SG MFA: ${mfa.status.label}$flag$date")
                v.setTextColor(R.id.mfa, color(mfa.status.color))
                v.setOnClickPendingIntent(R.id.mfa, openUrl(context, mfaLink(mfa.url), id * 10 + 1))
            } else {
                v.setViewVisibility(R.id.mfa, View.GONE)
            }

            if (size != Size.SMALL) renderWide(context, v, report, id, size == Size.LARGE)
            manager.updateAppWidget(id, v)
        }

        private fun hideWideExtras(v: RemoteViews) {
            v.setViewVisibility(R.id.spark, View.GONE)
            v.setViewVisibility(R.id.mfa_note, View.GONE)
            v.setViewVisibility(R.id.empty, View.GONE)
            HEADLINE_ROWS.forEach { v.setViewVisibility(it, View.GONE) }
        }

        private fun renderWide(context: Context, v: RemoteViews, report: Report, id: Int, large: Boolean) {
            hideWideExtras(v)
            val mfa = report.mfa
            if (large && mfa != null && mfa.summary.isNotEmpty()) {
                v.setViewVisibility(R.id.mfa_note, View.VISIBLE)
                v.setTextViewText(R.id.mfa_note, if (mfa.mentionsCity && mfa.cityNote.isNotEmpty()) mfa.cityNote else mfa.summary)
                v.setOnClickPendingIntent(R.id.mfa_note, openUrl(context, mfaLink(mfa.url), id * 10 + 2))
            }
            val vol = report.volume
            if (large && vol != null) {
                v.setViewVisibility(R.id.spark, View.VISIBLE)
                v.setImageViewBitmap(R.id.spark, sparkline(vol.daily, color(report.color)))
            }
            if (report.headlines.isEmpty()) {
                v.setViewVisibility(R.id.empty, View.VISIBLE)
                return
            }
            val count = if (large) 5 else 3
            report.headlines.take(count).forEachIndexed { i, h ->
                v.setViewVisibility(HEADLINE_ROWS[i], View.VISIBLE)
                val dot = when {
                    h.severity >= 3 -> "#FF3B30"
                    h.severity >= 2 -> "#FF9500"
                    else -> "#FFCC00"
                }
                v.setTextViewText(HEADLINE_TITLES[i], h.title)
                v.setTextColor(HEADLINE_METAS[i], color(dot))
                val tag = if (h.lang != "en") " · " + h.lang.uppercase() else ""
                v.setTextViewText(HEADLINE_METAS[i], "● " + h.source + (h.date?.let { " · " + timeAgo(it) } ?: "") + tag)
                if (safeUrl(h.url).isNotEmpty()) {
                    v.setOnClickPendingIntent(HEADLINE_ROWS[i], openUrl(context, h.url, id * 10 + 3 + i, report.link))
                }
            }
        }

        private fun sparkline(daily: List<Double>, accent: Int): Bitmap {
            val w = 600
            val h = 56
            val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
            val c = Canvas(bmp)
            val p = Paint(Paint.ANTI_ALIAS_FLAG)
            val max = maxOf(1.0, daily.maxOrNull() ?: 1.0)
            val gap = 8f
            val barW = (w - gap * (daily.size - 1)) / daily.size
            daily.forEachIndexed { i, value ->
                val bh = maxOf(4f, (value / max * h).toFloat())
                p.color = if (i == daily.size - 1) accent else Color.argb(90, 255, 255, 255)
                val x = i * (barW + gap)
                c.drawRoundRect(RectF(x, h - bh, x + barW, h.toFloat()), 4f, 4f, p)
            }
            return bmp
        }
    }
}
