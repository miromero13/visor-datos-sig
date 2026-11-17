package com.visordatossig.operaciones

import com.visordatossig.operaciones.core.location.GpsLocationClient
import com.visordatossig.operaciones.core.ocr.MeterOcrHelper
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PhaseFourMobileUnitTest {

    @Test
    fun `extractBestMeterReading picks longest 4 to 8 digit candidate from noisy OCR text`() {
        val rawText = """
            EPSAS S.A.
            SERIE AB-99
            LECTURA: 014582 m3
            2026
        """.trimIndent()

        val result = MeterOcrHelper.extractBestMeterReading(rawText)
        assertEquals("014582", result)
    }

    @Test
    fun `extractBestMeterReading returns null when no valid meter digits exist`() {
        val rawText = "SIN LECTURA VISIBLE - CASA CERRADA 12"
        assertNull(MeterOcrHelper.extractBestMeterReading(rawText))
    }

    @Test
    fun `haversineMeters computes accurate distance between two Santa Cruz coordinates`() {
        val lat1 = -17.783300
        val lon1 = -63.182100
        val lat2 = -17.784200
        val lon2 = -63.182100

        val distance = GpsLocationClient.haversineMeters(lat1, lon1, lat2, lon2)
        assertTrue("Expected ~100m, got $distance", distance in 95.0..105.0)
    }
}
