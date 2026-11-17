package com.visordatossig.operaciones.core.ocr

import android.content.Context
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.tasks.await
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MeterOcrHelper @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val recognizer by lazy {
        TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    }

    suspend fun recognizeMeterDigits(photoFile: File): String? {
        return try {
            val image = InputImage.fromFilePath(context, Uri.fromFile(photoFile))
            val visionText = recognizer.process(image).await()
            extractBestMeterReading(visionText.text)
        } catch (_: Exception) {
            null
        }
    }

    companion object {
        private val METER_DIGITS_REGEX = Regex("""\b\d{4,8}\b""")
        private val LOOSE_DIGITS_REGEX = Regex("""\d{4,8}""")

        /**
         * Extrae la secuencia numérica de 4 a 8 dígitos más representativa de la carátula del medidor.
         */
        fun extractBestMeterReading(rawText: String): String? {
            if (rawText.isBlank()) return null

            val normalized = rawText
                .replace('O', '0')
                .replace('o', '0')

            val exactMatches = METER_DIGITS_REGEX.findAll(normalized)
                .map { it.value }
                .toList()

            if (exactMatches.isNotEmpty()) {
                return exactMatches.maxByOrNull { it.length }
            }

            val compactLineMatches = normalized.lines()
                .map { line -> line.filter { it.isDigit() } }
                .filter { it.length in 4..8 }

            if (compactLineMatches.isNotEmpty()) {
                return compactLineMatches.maxByOrNull { it.length }
            }

            return LOOSE_DIGITS_REGEX.find(normalized)?.value
        }
    }
}
