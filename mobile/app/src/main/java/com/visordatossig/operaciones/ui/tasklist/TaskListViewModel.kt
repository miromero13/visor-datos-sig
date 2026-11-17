package com.visordatossig.operaciones.ui.tasklist

import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.visordatossig.operaciones.core.datastore.SessionPreferences
import com.visordatossig.operaciones.data.local.TaskItemEntity
import com.visordatossig.operaciones.data.repository.OperacionesRepository
import com.visordatossig.operaciones.service.LocationTrackingService
import com.visordatossig.operaciones.service.PendingSyncWorker
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class TaskListUiState(
    val userName: String = "Operador",
    val userRole: String = "Cortador",
    val tasks: List<TaskItemEntity> = emptyList(),
    val pendingSyncCount: Int = 0,
    val isTrackingRoute: Boolean = false,
    val isLoading: Boolean = false,
    val isSyncingOffline: Boolean = false,
    val errorMessage: String? = null
)

@HiltViewModel
class TaskListViewModel @Inject constructor(
    private val repository: OperacionesRepository,
    private val sessionPreferences: SessionPreferences
) : ViewModel() {

    private val isLoadingFlow = MutableStateFlow(false)
    private val isSyncingFlow = MutableStateFlow(false)
    private val errorMessageFlow = MutableStateFlow<String?>(null)

    val uiState: StateFlow<TaskListUiState> = combine(
        sessionPreferences.sessionFlow,
        repository.observeTasks(),
        repository.observePendingSyncCount(),
        LocationTrackingService.isTracking
    ) { session, tasks, pendingSyncCount, isTracking ->
        TaskListUiState(
            userName = session.name.ifBlank { "Operador de Cuadrilla" },
            userRole = session.role.ifBlank { "Cortador" },
            tasks = tasks,
            pendingSyncCount = pendingSyncCount,
            isTrackingRoute = isTracking
        )
    }.combine(
        combine(isLoadingFlow, isSyncingFlow, errorMessageFlow) { loading, syncing, error ->
            Triple(loading, syncing, error)
        }
    ) { base, status ->
        base.copy(
            isLoading = status.first,
            isSyncingOffline = status.second,
            errorMessage = status.third
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = TaskListUiState(isLoading = true)
    )

    init {
        refreshTasks()
    }

    fun refreshTasks() {
        viewModelScope.launch {
            isLoadingFlow.update { true }
            errorMessageFlow.update { null }
            val result = repository.refreshAssignments()
            result.onFailure { err ->
                errorMessageFlow.update {
                    "Modo sin conexión: mostrando paradas guardadas localmente (${err.localizedMessage ?: "sin red"})."
                }
            }
            isLoadingFlow.update { false }
        }
    }

    fun syncOfflineQueue(context: Context) {
        viewModelScope.launch {
            isSyncingFlow.update { true }
            val synced = repository.syncPendingExecutions()
            if (synced == 0) {
                PendingSyncWorker.enqueue(context)
            }
            isSyncingFlow.update { false }
        }
    }

    fun toggleRouteTracking(context: Context) {
        val currentlyTracking = LocationTrackingService.isTracking.value
        val intent = Intent(context, LocationTrackingService::class.java).apply {
            action = if (currentlyTracking) {
                LocationTrackingService.ACTION_STOP
            } else {
                LocationTrackingService.ACTION_START
            }
        }
        if (currentlyTracking) {
            context.startService(intent)
        } else {
            ContextCompat.startForegroundService(context, intent)
        }
    }

    fun logout(context: Context, onLoggedOut: () -> Unit) {
        viewModelScope.launch {
            if (LocationTrackingService.isTracking.value) {
                val stopIntent = Intent(context, LocationTrackingService::class.java).apply {
                    action = LocationTrackingService.ACTION_STOP
                }
                context.startService(stopIntent)
            }
            repository.logout()
            onLoggedOut()
        }
    }
}
