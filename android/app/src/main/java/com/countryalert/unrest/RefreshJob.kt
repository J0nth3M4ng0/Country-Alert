package com.countryalert.unrest

import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.os.PersistableBundle
import com.countryalert.unrest.core.buildReport
import com.countryalert.unrest.core.withDefaultCountry

/** Downloads fresh reports in the background and redraws the widgets. */
class RefreshJob : JobService() {

    override fun onStartJob(params: JobParameters): Boolean {
        val only = params.extras.getIntArray(EXTRA_IDS)
        Thread {
            val ids = only ?: allWidgetIds(this)
            for (id in ids) refreshWidget(this, id)
            jobFinished(params, false)
        }.start()
        return true
    }

    override fun onStopJob(params: JobParameters): Boolean = true

    companion object {
        private const val EXTRA_IDS = "ids"
        // Single-widget jobs use the widget id; this one refreshes every widget.
        private const val JOB_ALL = Int.MIN_VALUE

        fun allWidgetIds(context: Context): IntArray =
            AppWidgetManager.getInstance(context)
                .getAppWidgetIds(ComponentName(context, UnrestWidget::class.java))

        /** Asks the system to refresh soon, once a network is available. */
        fun schedule(context: Context, ids: IntArray? = null) {
            val extras = PersistableBundle()
            if (ids != null) extras.putIntArray(EXTRA_IDS, ids)
            val jobId = if (ids != null && ids.size == 1) ids[0] else JOB_ALL
            val job = JobInfo.Builder(jobId, ComponentName(context, RefreshJob::class.java))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setExtras(extras)
                .build()
            context.getSystemService(JobScheduler::class.java)?.schedule(job)
        }

        /** Fetches a new report for one widget and redraws it. Call off the main thread. */
        fun refreshWidget(context: Context, id: Int) {
            val store = WidgetStore(context)
            val params = store.params(id) ?: return
            try {
                val report = buildReport(withDefaultCountry(params), ::httpGet)
                store.saveReport(id, report)
            } catch (e: Exception) {
                store.saveError(id, e.message ?: e.javaClass.simpleName)
            }
            UnrestWidget.render(context, AppWidgetManager.getInstance(context), id)
        }
    }
}
