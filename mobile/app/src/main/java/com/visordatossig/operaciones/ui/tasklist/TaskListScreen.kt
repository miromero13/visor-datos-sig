package com.visordatossig.operaciones.ui.tasklist

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircleOutline
import androidx.compose.material.icons.outlined.CloudUpload
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.MyLocation
import androidx.compose.material.icons.outlined.PendingActions
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.Stop
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.visordatossig.operaciones.data.local.TaskItemEntity
import com.visordatossig.operaciones.ui.components.Alert
import com.visordatossig.operaciones.ui.components.AlertVariant
import com.visordatossig.operaciones.ui.components.Badge
import com.visordatossig.operaciones.ui.components.BadgeVariant
import com.visordatossig.operaciones.ui.components.Brand
import com.visordatossig.operaciones.ui.components.BrandSize
import com.visordatossig.operaciones.ui.components.Button
import com.visordatossig.operaciones.ui.components.ButtonSize
import com.visordatossig.operaciones.ui.components.ButtonVariant
import com.visordatossig.operaciones.ui.components.Card
import com.visordatossig.operaciones.ui.components.Skeleton
import com.visordatossig.operaciones.ui.theme.Amber700
import com.visordatossig.operaciones.ui.theme.Blue100
import com.visordatossig.operaciones.ui.theme.Blue50
import com.visordatossig.operaciones.ui.theme.Blue600
import com.visordatossig.operaciones.ui.theme.Emerald100
import com.visordatossig.operaciones.ui.theme.Emerald50
import com.visordatossig.operaciones.ui.theme.Emerald700
import com.visordatossig.operaciones.ui.theme.Red600
import com.visordatossig.operaciones.ui.theme.Slate100
import com.visordatossig.operaciones.ui.theme.Slate200
import com.visordatossig.operaciones.ui.theme.Slate50
import com.visordatossig.operaciones.ui.theme.Slate600
import com.visordatossig.operaciones.ui.theme.Slate700
import com.visordatossig.operaciones.ui.theme.Slate900
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TaskListScreen(
    viewModel: TaskListViewModel,
    onSelectTask: (Int) -> Unit,
    onNavigateToProfile: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true
        val coarseGranted = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (fineGranted || coarseGranted) {
            viewModel.toggleRouteTracking(context)
        }
    }

    val pendingCount = state.tasks.count { it.estado.equals("Pendiente", ignoreCase = true) }
    val completedCount = state.tasks.count {
        it.estado.equals("Cortado", ignoreCase = true) ||
            it.estado.equals("Reconectado", ignoreCase = true)
    }
    val observedCount = state.tasks.count { it.estado.equals("Observado", ignoreCase = true) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White)
    ) {
        // Header limpio mobile: Logo a la izquierda, y a la derecha solo el redondo con la inicial
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White)
                .padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Logo institucional
            Brand(size = BrandSize.Md)

            // A la derecha: Redondo con la inicial (al presionar va al perfil)
            val initial = state.userName.trim().firstOrNull()?.uppercase() ?: "U"
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(Slate100)
                    .border(1.dp, Slate200, CircleShape)
                    .clickable(onClick = onNavigateToProfile),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = initial,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate700
                )
            }
        }

        // Barra de telemetría GPS compacta
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White)
                .padding(horizontal = 16.dp, vertical = 6.dp)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(if (state.isTrackingRoute) Emerald50 else Blue50)
                    .border(
                        1.dp,
                        if (state.isTrackingRoute) Emerald100 else Blue100,
                        RoundedCornerShape(10.dp)
                    )
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(
                        imageVector = Icons.Outlined.MyLocation,
                        contentDescription = null,
                        tint = if (state.isTrackingRoute) Emerald700 else Blue600,
                        modifier = Modifier.size(15.dp)
                    )
                    Text(
                        text = if (state.isTrackingRoute) "GPS activo (20s)" else "Ruta en pausa",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (state.isTrackingRoute) Emerald700 else Blue600
                    )
                }

                Button(
                    text = if (state.isTrackingRoute) "Detener" else "Iniciar ruta",
                    onClick = {
                        if (state.isTrackingRoute) {
                            viewModel.toggleRouteTracking(context)
                        } else {
                            val perms = buildList {
                                add(Manifest.permission.ACCESS_FINE_LOCATION)
                                add(Manifest.permission.ACCESS_COARSE_LOCATION)
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                                    add(Manifest.permission.POST_NOTIFICATIONS)
                                }
                            }
                            permissionLauncher.launch(perms.toTypedArray())
                        }
                    },
                    variant = if (state.isTrackingRoute) ButtonVariant.Destructive else ButtonVariant.PrimaryBlue,
                    size = ButtonSize.Sm
                ) {
                    Icon(
                        imageVector = if (state.isTrackingRoute) Icons.Outlined.Stop else Icons.Outlined.PlayArrow,
                        contentDescription = null,
                        modifier = Modifier.size(14.dp)
                    )
                }
            }
        }

        // Pull to refresh al hacer scroll hacia abajo
        PullToRefreshBox(
            isRefreshing = state.isLoading,
            onRefresh = { viewModel.refreshTasks() },
            modifier = Modifier.fillMaxSize()
        ) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Tres cards en una sola fila (solo icono, número y estado)
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        KpiStatusCard(
                            icon = Icons.Outlined.PendingActions,
                            iconColor = Amber700,
                            value = pendingCount.toString(),
                            status = "Pendientes",
                            modifier = Modifier.weight(1f)
                        )
                        KpiStatusCard(
                            icon = Icons.Outlined.CheckCircleOutline,
                            iconColor = Emerald700,
                            value = completedCount.toString(),
                            status = "Completadas",
                            modifier = Modifier.weight(1f)
                        )
                        KpiStatusCard(
                            icon = Icons.Outlined.ErrorOutline,
                            iconColor = Red600,
                            value = observedCount.toString(),
                            status = "Observadas",
                            modifier = Modifier.weight(1f)
                        )
                    }
                }

                if (state.pendingSyncCount > 0) {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = "Cola offline (${state.pendingSyncCount} pendientes)",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Slate900
                                    )
                                    Text(
                                        text = "Hay ejecuciones listas para subir.",
                                        fontSize = 11.sp,
                                        color = Slate600
                                    )
                                }
                                Button(
                                    text = "Sincronizar",
                                    onClick = { viewModel.syncOfflineQueue(context) },
                                    variant = ButtonVariant.PrimaryBlue,
                                    size = ButtonSize.Sm,
                                    loading = state.isSyncingOffline
                                ) {
                                    Icon(
                                        imageVector = Icons.Outlined.CloudUpload,
                                        contentDescription = null,
                                        modifier = Modifier.size(14.dp)
                                    )
                                }
                            }
                        }
                    }
                }

                if (state.errorMessage != null) {
                    item {
                        Alert(
                            title = "Aviso",
                            message = state.errorMessage ?: "",
                            variant = AlertVariant.Default
                        )
                    }
                }

                if (state.isLoading && state.tasks.isEmpty()) {
                    items(4) {
                        Skeleton(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(80.dp)
                        )
                    }
                } else if (state.tasks.isEmpty()) {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp),
                            contentPadding = PaddingValues(16.dp)
                        ) {
                            Text(
                                text = "No tenés paradas asignadas para hoy.",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Slate900
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "Deslizá hacia abajo para recargar la ruta.",
                                fontSize = 12.sp,
                                color = Slate600
                            )
                        }
                    }
                } else {
                    items(state.tasks, key = { it.idAsignacionDetalle }) { task ->
                        TaskStopCard(
                            task = task,
                            onClick = { onSelectTask(task.idAsignacionDetalle) }
                        )
                    }
                }
            }
        }
    }
}

/**
 * Card KPI en fila: solo icono, número y estado
 */
@Composable
private fun KpiStatusCard(
    icon: ImageVector,
    iconColor: Color,
    value: String,
    status: String,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(10.dp),
        contentPadding = PaddingValues(horizontal = 6.dp, vertical = 8.dp),
        verticalSpacing = 2.dp
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = iconColor,
                    modifier = Modifier.size(15.dp)
                )
                Text(
                    text = value,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate900
                )
            }
            Text(
                text = status,
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium,
                color = Slate600,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun TaskStopCard(
    task: TaskItemEntity,
    onClick: () -> Unit
) {
    val statusVariant = when (task.estado.lowercase()) {
        "cortado", "reconectado" -> BadgeVariant.Success
        "observado" -> BadgeVariant.Destructive
        else -> BadgeVariant.Warning
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(10.dp),
        contentPadding = PaddingValues(12.dp),
        onClick = onClick
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Blue50),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "#${task.ordenSecuencia}",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = Blue600
                )
            }

            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "CF-${task.codFijo ?: task.idCodigo}",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Blue600
                    )
                    Badge(text = task.estado, variant = statusVariant)
                }

                Text(
                    text = task.nombre ?: "Abonado sin nombre",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = Slate900
                )

                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Badge(text = task.tipoAsignacion, variant = BadgeVariant.Neutral)
                    Text(
                        text = String.format(
                            Locale.US,
                            "%.5f, %.5f",
                            task.latitudMedidor,
                            task.longitudMedidor
                        ),
                        fontSize = 10.sp,
                        color = Slate600
                    )
                }
            }
        }
    }
}
