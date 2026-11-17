package com.visordatossig.operaciones.ui.taskdetail

import android.Manifest
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.GpsFixed
import androidx.compose.material.icons.outlined.Navigation
import androidx.compose.material.icons.outlined.Speed
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.visordatossig.operaciones.ui.components.Alert
import com.visordatossig.operaciones.ui.components.AlertVariant
import com.visordatossig.operaciones.ui.components.Badge
import com.visordatossig.operaciones.ui.components.BadgeVariant
import com.visordatossig.operaciones.ui.components.Button
import com.visordatossig.operaciones.ui.components.ButtonSize
import com.visordatossig.operaciones.ui.components.ButtonVariant
import com.visordatossig.operaciones.ui.components.Card
import com.visordatossig.operaciones.ui.components.Input
import com.visordatossig.operaciones.ui.theme.Blue100
import com.visordatossig.operaciones.ui.theme.Blue50
import com.visordatossig.operaciones.ui.theme.Blue600
import com.visordatossig.operaciones.ui.theme.Emerald700
import com.visordatossig.operaciones.ui.theme.Slate200
import com.visordatossig.operaciones.ui.theme.Slate50
import com.visordatossig.operaciones.ui.theme.Slate500
import com.visordatossig.operaciones.ui.theme.Slate600
import com.visordatossig.operaciones.ui.theme.Slate700
import com.visordatossig.operaciones.ui.theme.Slate900
import java.util.Locale
import kotlin.math.roundToInt

private val QUICK_OBSERVATIONS = listOf(
    "Casa cerrada",
    "Perro bravo",
    "Medidor inaccesible",
    "Sin llave de paso",
    "Cliente abonó en sitio"
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun TaskDetailScreen(
    viewModel: TaskDetailViewModel,
    onNavigateBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    var showCameraDialog by remember { mutableStateOf(false) }

    val gpsPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { perms ->
        val granted = perms[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            perms[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (granted) {
            viewModel.captureCurrentGps()
        }
    }

    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            showCameraDialog = true
        }
    }

    val task = state.task

    if (showCameraDialog) {
        CameraCaptureDialog(
            onPhotoCaptured = { file ->
                showCameraDialog = false
                viewModel.onPhotoCaptured(file)
            },
            onDismiss = { showCameraDialog = false }
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White)
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(
                onClick = onNavigateBack,
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .border(1.dp, Slate200, RoundedCornerShape(8.dp))
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Outlined.ArrowBack,
                    contentDescription = "Volver a la ruta",
                    tint = Slate700,
                    modifier = Modifier.size(18.dp)
                )
            }
            if (task != null) {
                Badge(
                    text = "Parada #${task.ordenSecuencia} · ${task.tipoAsignacion}",
                    variant = BadgeVariant.Blue
                )
            }
        }

        if (task == null) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = if (state.isLoading) "Cargando parada..." else "Parada no encontrada.",
                    color = Slate500
                )
            }
            return@Column
        }

        val primaryExecutedState = if (task.tipoAsignacion.equals("Reconexion", ignoreCase = true)) {
            "Reconectado"
        } else {
            "Cortado"
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Summary Card
            Card(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "CF-${task.codFijo ?: task.idCodigo}",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = Blue600
                    )
                    Badge(text = task.estado, variant = BadgeVariant.Neutral)
                }
                Text(
                    text = task.nombre ?: "Abonado sin nombre",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate900
                )
                Text(
                    text = String.format(
                        Locale.US,
                        "Coordenadas SIG: %.6f, %.6f",
                        task.latitudMedidor,
                        task.longitudMedidor
                    ),
                    fontSize = 13.sp,
                    color = Slate600
                )
            }

            // Card 1: GPS Location & External Navigation
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = "1. Ubicación GPS y Navegación",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate900
                    )
                    Text(
                        text = "Verificá tu posición de alta precisión en el sitio o abrí Google Maps / Waze para llegar.",
                        fontSize = 13.sp,
                        color = Slate600
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Button(
                        text = if (state.isFetchingGps) "Obteniendo..." else "OBTENER GPS",
                        onClick = {
                            gpsPermissionLauncher.launch(
                                arrayOf(
                                    Manifest.permission.ACCESS_FINE_LOCATION,
                                    Manifest.permission.ACCESS_COARSE_LOCATION
                                )
                            )
                        },
                        variant = ButtonVariant.PrimaryBlue,
                        modifier = Modifier.weight(1f),
                        loading = state.isFetchingGps
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.GpsFixed,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                    }

                    Button(
                        text = "NAVEGAR",
                        onClick = {
                            val lat = task.latitudMedidor
                            val lon = task.longitudMedidor
                            val navUri = Uri.parse("google.navigation:q=$lat,$lon&mode=d")
                            val navIntent = Intent(Intent.ACTION_VIEW, navUri)
                            val fallbackUri = Uri.parse(
                                "geo:$lat,$lon?q=$lat,$lon(${Uri.encode(task.nombre ?: "Medidor")})"
                            )
                            try {
                                context.startActivity(navIntent)
                            } catch (_: Exception) {
                                context.startActivity(Intent(Intent.ACTION_VIEW, fallbackUri))
                            }
                        },
                        variant = ButtonVariant.Outline,
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Navigation,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }

                val gps = state.gpsReading
                if (gps != null) {
                    val deviation = state.distanceDeviationMeters
                    val isFar = deviation != null && deviation > 60.0
                    val title = String.format(
                        Locale.US,
                        "Posición capturada: %.6f, %.6f (±%d m)",
                        gps.latitude,
                        gps.longitude,
                        gps.accuracyMeters.roundToInt()
                    )
                    val detail = if (deviation != null) {
                        "Distancia al punto SIG del medidor: ${deviation.roundToInt()} m" +
                            if (isFar) " (Advertencia: estás a más de 60 m del punto registrado)." else " (Dentro del rango esperado)."
                    } else {
                        "Coordenadas registradas."
                    }
                    Alert(
                        title = title,
                        message = detail,
                        variant = if (isFar) AlertVariant.Destructive else AlertVariant.Default
                    )
                }
            }

            // Card 2: CameraX Evidence + ML Kit OCR Meter Reading
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        text = "2. Evidencia Fotográfica y OCR",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate900
                    )
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Badge(
                            text = if (state.photoFile != null) "Fotos: 1/1" else "Fotos: 0/1",
                            variant = if (state.photoFile != null) BadgeVariant.Success else BadgeVariant.Neutral
                        )
                        Text(
                            text = if (state.photoFile != null) "Foto capturada" else "Fotografía pendiente",
                            fontSize = 12.sp,
                            color = if (state.photoFile != null) Emerald700 else Slate500
                        )
                    }
                }
                Text(
                    text = "Tomá una foto del medidor; el motor ML Kit leerá los dígitos automáticamente.",
                    fontSize = 13.sp,
                    color = Slate600
                )

                Button(
                    text = if (state.photoFile == null) "TOMAR FOTO DEL MEDIDOR" else "VOLVER A TOMAR FOTO",
                    onClick = { cameraPermissionLauncher.launch(Manifest.permission.CAMERA) },
                    variant = if (state.photoFile == null) ButtonVariant.PrimaryBlue else ButtonVariant.Outline,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(
                        imageVector = Icons.Outlined.CameraAlt,
                        contentDescription = null,
                        modifier = Modifier.size(17.dp)
                    )
                }

                if (state.photoFile != null) {
                    AsyncImage(
                        model = state.photoFile,
                        contentDescription = "Evidencia capturada",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(190.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .border(1.dp, Slate200, RoundedCornerShape(12.dp))
                    )
                }

                if (state.ocrDetectedNote != null) {
                    Alert(
                        title = "Reconocimiento óptico ML Kit",
                        message = state.ocrDetectedNote ?: "",
                        variant = AlertVariant.Default
                    )
                }

                Input(
                    value = state.lecturaMedidorInput,
                    onValueChange = viewModel::onLecturaChange,
                    label = "Lectura actual del medidor (m³)",
                    placeholder = "Ej: 14520",
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    leadingIcon = Icons.Outlined.Speed
                )
            }

            // Card 3: Execution State & Observations
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = "3. Resultado y Observaciones",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate900
                    )
                    Text(
                        text = "Seleccioná el estado final de la intervención en terreno.",
                        fontSize = 13.sp,
                        color = Slate600
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Button(
                        text = primaryExecutedState.uppercase(),
                        onClick = { viewModel.onEstadoSelected(primaryExecutedState) },
                        variant = if (state.selectedEstado.equals(primaryExecutedState, ignoreCase = true)) {
                            ButtonVariant.PrimaryBlue
                        } else {
                            ButtonVariant.Outline
                        },
                        modifier = Modifier.weight(1f)
                    )
                    Button(
                        text = "OBSERVADO",
                        onClick = { viewModel.onEstadoSelected("Observado") },
                        variant = if (state.selectedEstado.equals("Observado", ignoreCase = true)) {
                            ButtonVariant.Destructive
                        } else {
                            ButtonVariant.Outline
                        },
                        modifier = Modifier.weight(1f)
                    )
                }

                Text(
                    text = "Observaciones rápidas (tocá para agregar):",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Slate500
                )

                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    QUICK_OBSERVATIONS.forEach { chip ->
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(999.dp))
                                .background(Blue50)
                                .border(1.dp, Blue100, RoundedCornerShape(999.dp))
                                .clickable { viewModel.appendQuickObservation(chip) }
                                .padding(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Text(
                                text = "+ $chip",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Blue600
                            )
                        }
                    }
                }

                Input(
                    value = state.observacionInput,
                    onValueChange = viewModel::onObservacionChange,
                    label = "Observación en campo",
                    placeholder = "Detalle de precinto, llave o impedimento...",
                    singleLine = false
                )

                if (state.errorMessage != null) {
                    Alert(
                        title = "Atención",
                        message = state.errorMessage ?: "",
                        variant = AlertVariant.Destructive
                    )
                }

                Button(
                    text = if (state.isSubmitting) "Guardando ejecución..." else "REGISTRAR EJECUCIÓN",
                    onClick = { viewModel.submitExecution(context, onNavigateBack) },
                    variant = ButtonVariant.Default,
                    size = ButtonSize.Lg,
                    loading = state.isSubmitting,
                    enabled = !state.isSubmitting,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(
                        imageVector = Icons.Outlined.CheckCircle,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }
    }
}
