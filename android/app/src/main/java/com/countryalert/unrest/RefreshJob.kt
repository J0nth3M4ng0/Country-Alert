package com.countryalert.unrest

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.os.PersistableBundle
import com.countryalert.unrest.core.buildReport
import com.countryalert.unrest.core.withDefaultCountry

/** Downloads fresh reports in the background and redraws the widgets. */
class RefreshJob : JobService() {

    override fun onStartJob(params: JobParameters): Boolean {
        val only = params.extras.getIntArray(EXTRA_IDS)
        Thread {
            val ids = only ?: allWidgetIds(this)
            // The backup job and the widget's own update only refresh stale widgets.
            for (id in ids) refreshWidget(this, id, force = only != null)
            jobFinished(params, false)
        }.start()
        return true
    }

    override fun onStopJob(params: JobParameters): Boolean = true

    companion object {
        private const val EXTRA_IDS = "ids"
        // Single-widget jobs use the widget id; these refresh every widget.
        private const val JOB_ALL = Int.MIN_VALUE
        private const val JOB_PERIODIC = Int.MIN_VALUE + 1
        private const val PERIOD_MS = 30 * 60 * 1000L

        /** Skip automatic refreshes this soon after the last one. */
        private const val MIN_GAP_MS = 10 * 60 * 1000L

        fun allWidgetIds(context: Context): IntArray =
            AppWidgetManager.getInstance(context)
                .getAppWidgetIds(ComponentName(context, UnrestWidget::class.java))

        /**
         * Asks the system to refresh once a network is available. [urgent] is for
         * refreshes the user asked for: Android 12+ runs them right away instead
         * of waiting for a convenient moment.
         */
        fun schedule(context: Context, ids: IntArray? = null, urgent: Boolean = false) {
            val extras = PersistableBundle()
            if (ids != null) extras.putIntArray(EXTRA_IDS, ids)
            val jobId = if (ids != null && ids.size == 1) ids[0] else JOB_ALL
            val builder = JobInfo.Builder(jobId, ComponentName(context, RefreshJob::class.java))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setExtras(extras)
            if (urgent && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) builder.setExpedited(true)
            val scheduler = context.getSystemService(JobScheduler::class.java) ?: return
            val ok = try {
                scheduler.schedule(builder.build()) == JobScheduler.RESULT_SUCCESS
            } catch (e: Exception) {
                false
            }
            // Out of urgent-job quota: fall back to a normal job.
            if (!ok && urgent) schedule(context, ids, urgent = false)
        }

        /**
         * Backup refresh every 30 minutes that survives restarts, alongside the
         * widget's own update. Some phones delay one or the other.
         */
        fun schedulePeriodic(context: Context) {
            val scheduler = context.getSystemService(JobScheduler::class.java) ?: return
            if (scheduler.getPendingJob(JOB_PERIODIC) != null) return
            val job = JobInfo.Builder(JOB_PERIODIC, ComponentName(context, RefreshJob::class.java))
                .setPeriodic(PERIOD_MS)
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPersisted(true)
                .build()
            try {
                scheduler.schedule(job)
            } catch (e: Exception) {
                // Keep going with the widget's own updates.
            }
        }

        fun cancelPeriodic(context: Context) {
            context.getSystemService(JobScheduler::class.java)?.cancel(JOB_PERIODIC)
        }

        /**
         * Fetches a new report for one widget and redraws it. Call off the main
         * thread. Unless [force], skips widgets refreshed in the last 10 minutes,
         * since the widget update and the backup job can fire close together.
         */
        fun refreshWidget(context: Context, id: Int, force: Boolean = true) {
            val store = WidgetStore(context)
            val params = store.params(id) ?: return
            val now = System.currentTimeMillis()
            if (!force && now - store.lastAttempt(id) < MIN_GAP_MS) return
            store.saveAttempt(id, now)
            try {
                val previous = store.report(id)?.translations ?: emptyMap()
                val report = buildReport(withDefaultCountry(params), ::httpGet, translations = previous)
                store.saveReport(id, report)
            } catch (e: Exception) {
                store.saveError(id, e.message ?: e.javaClass.simpleName)
            }
            UnrestWidget.render(context, AppWidgetManager.getInstance(context), id)
        }
    }
}
