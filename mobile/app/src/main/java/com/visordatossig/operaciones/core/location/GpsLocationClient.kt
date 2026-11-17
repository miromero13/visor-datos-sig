package com.visordatossig.operaciones.core.location

import android.annotation.SuppressLint
import android.content.Context
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

data class GpsFix(
    val latitude: Double,
    val longitude: Double,
    val accuracyMeters: Float,
    val speedKmh: Double
)

@Singleton
class GpsLocationClient @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val fusedClient by lazy {
        LocationServices.getFusedLocationProviderClient(context)
    }

    @SuppressLint("MissingPermission")
    suspend fun getHighAccuracyLocation(): GpsFix {
        val tokenSource = CancellationTokenSource()
        val loc = fusedClient.getCurrentLocation(
            Priority.PRIORITY_HIGH_ACCURACY,
            tokenSource.token
        ).await() ?: fusedClient.lastLocation.await()
            ?: throw IllegalStateException("No se pudo obtener señal GPS del dispositivo. Verificá que la ubicación esté encendida.")

        return GpsFix(
            latitude = loc.latitude,
            longitude = loc.longitude,
            accuracyMeters = loc.accuracy,
            speedKmh = if (loc.hasSpeed()) (loc.speed * 3.6) else 0.0
        )
    }

    companion object {
        /**
         * Distancia geodésica Haversine en metros entre dos coordenadas (Lat, Lon).
         */
        fun haversineMeters(
            lat1: Double,
            lon1: Double,
            lat2: Double,
            lon2: Double
        ): Double {
            val r = 6371000.0
            val dLat = Math.toRadians(lat2 - lat1)
            val dLon = Math.toRadians(lon2 - lon1)
            val a = sin(dLat / 2) * sin(dLat / 2) +
                cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) *
                sin(dLon / 2) * sin(dLon / 2)
            val c = 2 * atan2(sqrt(a), sqrt(1 - a))
            return r * c
        }
    }
}
