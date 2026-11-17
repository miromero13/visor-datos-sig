package com.visordatossig.operaciones.ui.taskdetail

import android.content.Context
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.visordatossig.operaciones.core.location.GpsFix
import com.visordatossig.operaciones.core.location.GpsLocationClient
import com.visordatossig.operaciones.core.ocr.MeterOcrHelper
import com.visordatossig.operaciones.data.local.TaskItemEntity
import com.visordatossig.operaciones.data.repository.OperacionesRepository
import com.visordatossig.operaciones.service.PendingSyncWorker
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.File
import javax.inject.Inject

data class TaskDetailUiState(
    val task: TaskItemEntity? = null,
    val isLoading: Boolean = true,
    val isFetchingGps: Boolean = false,
    val gpsReading: GpsFix? = null,
    val distanceDeviationMeters: Double? = null,
    val photoFile: File? = null,
    val isRunningOcr: Boolean = false,
    val ocrDetectedNote: String? = null,
    val lecturaMedidorInput: String = "",
    val selectedEstado: String = "Cortado",
    val observacionInput: String = "",
    val isSubmitting: Boolean = false,
    val errorMessage: String? = null,
    val completionMessage: String? = null
)

@HiltViewModel
class TaskDetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val repository: OperacionesRepository,
    private val gpsLocationClient: GpsLocationClient,
    private val meterOcrHelper: MeterOcrHelper
) : ViewModel() {

    private val idDetalle: Int = checkNotNull(savedStateHandle["idDetalle"])
    private val _uiState = MutableStateFlow(TaskDetailUiState())
    val uiState: StateFlow<TaskDetailUiState> = _uiState.asStateFlow()

    init {
        loadTask()
    }

    private fun loadTask() {
        viewModelScope.launch {
            val item = repository.getTaskById(idDetalle)
            val defaultExecutedState = if (item?.tipoAsignacion.equals("Reconexion", ignoreCase = true)) {
                "Reconectado"
            } else {
                "Cortado"
            }
            val currentEstado = if (item != null && !item.estado.equals("Pendiente", ignoreCase = true)) {
                item.estado
            } else {
                defaultExecutedState
            }
            _uiState.update {
                it.copy(
                    task = item,
                    isLoading = false,
                    selectedEstado = currentEstado,
                    lecturaMedidorInput = item?.lecturaMedidor ?: "",
                    observacionInput = item?.observacion ?: ""
                )
            }
        }
    }

    fun captureCurrentGps() {
        viewModelScope.launch {
            _uiState.update { it.copy(isFetchingGps = true, errorMessage = null) }
            try {
                val fix = gpsLocationClient.getHighAccuracyLocation()
                val task = _uiState.value.task
                val deviation = if (task != null) {
                    GpsLocationClient.haversineMeters(
                        fix.latitude,
                        fix.longitude,
                        task.latitudMedidor,
                        task.longitudMedidor
                    )
                } else {
                    null
                }
                _uiState.update {
                    it.copy(
                        isFetchingGps = false,
                        gpsReading = fix,
                        distanceDeviationMeters = deviation
                    )
                }
            } catch (err: Exception) {
                _uiState.update {
                    it.copy(
                        isFetchingGps = false,
                        errorMessage = err.localizedMessage
                            ?: "No se pudo obtener señal GPS de alta precisión."
                    )
                }
            }
        }
    }

    fun onPhotoCaptured(file: File) {
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    photoFile = file,
                    isRunningOcr = true,
                    ocrDetectedNote = null,
                    errorMessage = null
                )
            }
            val detected = meterOcrHelper.recognizeMeterDigits(file)
            _uiState.update { current ->
                current.copy(
                    isRunningOcr = false,
                    lecturaMedidorInput = detected ?: current.lecturaMedidorInput,
                    ocrDetectedNote = if (detected != null) {
                        "OCR detectó lectura sugerida: $detected"
                    } else {
                        "No se detectaron dígitos claros por OCR. Podés ingresar la lectura manualmente."
                    }
                )
            }
        }
    }

    fun onLecturaChange(value: String) {
        val digitsOnly = value.filter { it.isDigit() }.take(9)
        _uiState.update { it.copy(lecturaMedidorInput = digitsOnly, errorMessage = null) }
    }

    fun onEstadoSelected(estado: String) {
        _uiState.update { it.copy(selectedEstado = estado, errorMessage = null) }
    }

    fun onObservacionChange(value: String) {
        _uiState.update { it.copy(observacionInput = value, errorMessage = null) }
    }

    fun appendQuickObservation(chip: String) {
        _uiState.update { current ->
            val currentText = current.observacionInput.trim()
            val updated = if (currentText.isEmpty()) chip else "$currentText · $chip"
            current.copy(observacionInput = updated, errorMessage = null)
        }
    }

    fun submitExecution(context: Context, onFinished: () -> Unit) {
        val state = _uiState.value
        val task = state.task ?: return

        if (state.selectedEstado.equals("Observado", ignoreCase = true) && state.observacionInput.isBlank()) {
            _uiState.update {
                it.copy(errorMessage = "Si marcás la parada como Observado, debés indicar el motivo en la observación.")
            }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true, errorMessage = null) }
            val result = repository.executeTask(
                idAsignacionDetalle = task.idAsignacionDetalle,
                estado = state.selectedEstado,
                lecturaMedidor = state.lecturaMedidorInput,
                observacion = state.observacionInput,
                latitudEjecucion = state.gpsReading?.latitude ?: task.latitudMedidor,
                longitudEjecucion = state.gpsReading?.longitude ?: task.longitudMedidor,
                photoFile = state.photoFile
            )
            result.fold(
                onSuccess = { syncedOnline ->
                    if (!syncedOnline) {
                        PendingSyncWorker.enqueue(context)
                    }
                    _uiState.update {
                        it.copy(
                            isSubmitting = false,
                            completionMessage = if (syncedOnline) {
                                "Ejecución sincronizada con el servidor central."
                            } else {
                                "Sin conexión: ejecución guardada en cola offline."
                            }
                        )
                    }
                    onFinished()
                },
                onFailure = { err ->
                    _uiState.update {
                        it.copy(
                            isSubmitting = false,
                            errorMessage = err.localizedMessage ?: "Error al registrar la ejecución."
                        )
                    }
                }
            )
        }
    }
}
