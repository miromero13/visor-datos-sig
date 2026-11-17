package com.visordatossig.operaciones.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.visordatossig.operaciones.core.location.GpsLocationClient
import com.visordatossig.operaciones.data.repository.OperacionesRepository
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class LocationTrackingService : Service() {

    @Inject
    lateinit var gpsLocationClient: GpsLocationClient

    @Inject
    lateinit var repository: OperacionesRepository

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var trackingJob: Job? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startForegroundTracking()
            ACTION_STOP -> stopForegroundTracking()
        }
        return START_STICKY
    }

    private fun startForegroundTracking() {
        createNotificationChannel()
        val notification = buildNotification("Transmitiendo telemetría GPS de cuadrilla en ruta...")
        startForeground(NOTIFICATION_ID, notification)
        _isTracking.value = true

        if (trackingJob?.isActive == true) return
        trackingJob = serviceScope.launch {
            while (isActive) {
                runCatching {
                    val fix = gpsLocationClient.getHighAccuracyLocation()
                    val event = if (fix.speedKmh < 1.2) "Detenido" else "EnRuta"
                    repository.sendTelemetryPoint(
                        latitud = fix.latitude,
                        longitud = fix.longitude,
                        velocidadKmh = fix.speedKmh,
                        evento = event
                    )
                }
                delay(TELEMETRY_INTERVAL_MS)
            }
        }
    }

    private fun stopForegroundTracking() {
        trackingJob?.cancel()
        trackingJob = null
        _isTracking.value = false
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        _isTracking.value = false
        serviceScope.cancel()
        super.onDestroy()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "GeoIT Telemetría en Ruta",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Monitoreo GPS activo durante el recorrido de cortes y reconexiones"
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(contentText: String): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("VisorDatosSIG · Ruta Activa")
            .setContentText(contentText)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()

    companion object {
        const val ACTION_START = "com.visordatossig.operaciones.action.START_TRACKING"
        const val ACTION_STOP = "com.visordatossig.operaciones.action.STOP_TRACKING"
        private const val CHANNEL_ID = "geoit_tracking_channel"
        private const val NOTIFICATION_ID = 4102
        private const val TELEMETRY_INTERVAL_MS = 20_000L

        private val _isTracking = MutableStateFlow(false)
        val isTracking: StateFlow<Boolean> = _isTracking.asStateFlow()
    }
}
