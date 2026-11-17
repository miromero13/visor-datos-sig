package com.visordatossig.operaciones.data.repository

import com.visordatossig.operaciones.core.datastore.SessionPreferences
import com.visordatossig.operaciones.data.local.PendingExecutionEntity
import com.visordatossig.operaciones.data.local.TaskDao
import com.visordatossig.operaciones.data.local.TaskItemEntity
import com.visordatossig.operaciones.data.remote.OperacionesApi
import com.visordatossig.operaciones.data.remote.dto.ChangePasswordRequestDto
import com.visordatossig.operaciones.data.remote.dto.IngestTrackingPointDto
import com.visordatossig.operaciones.data.remote.dto.LoginRequestDto
import com.visordatossig.operaciones.data.remote.dto.ProblemDetailsDto
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.HttpException
import java.io.File
import java.io.IOException
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class OperacionesRepository @Inject constructor(
    private val api: OperacionesApi,
    private val taskDao: TaskDao,
    private val sessionPreferences: SessionPreferences
) {
    fun observeTasks(): Flow<List<TaskItemEntity>> = taskDao.observeTasks()

    fun observePendingSyncCount(): Flow<Int> = taskDao.observePendingCount()

    suspend fun getTaskById(idAsignacionDetalle: Int): TaskItemEntity? =
        taskDao.getTaskById(idAsignacionDetalle)

    suspend fun login(login: String, password: String, serverUrl: String): Result<Unit> = runCatching {
        sessionPreferences.updateServerUrl(serverUrl)
        try {
            val envelope = api.login(LoginRequestDto(login = login.trim(), password = password))
            val loginData = envelope.data
            val token = loginData.accessToken.takeIf { it.isNotBlank() }
                ?: throw IllegalStateException("El servidor no devolvió un token JWT válido.")
            val primaryRole = loginData.user.roles.firstOrNull() ?: "Cortador"
            sessionPreferences.saveAuthSession(
                userId = loginData.user.id,
                login = loginData.user.login,
                name = loginData.user.name,
                role = primaryRole,
                accessToken = token,
                refreshToken = loginData.refreshToken,
                serverBaseUrl = serverUrl
            )
        } catch (httpEx: HttpException) {
            throw IllegalStateException(extractFriendlyErrorMessage(httpEx))
        } catch (ioEx: IOException) {
            throw IllegalStateException("No fue posible conectar con el servidor. Verificá tu conexión a internet o la URL del servidor.")
        }
    }

    private fun extractFriendlyErrorMessage(httpEx: HttpException): String {
        val errorBody = try {
            httpEx.response()?.errorBody()?.string()
        } catch (_: Exception) {
            null
        }

        if (!errorBody.isNullOrBlank()) {
            try {
                val json = Json { ignoreUnknownKeys = true; isLenient = true }
                val problem = json.decodeFromString<ProblemDetailsDto>(errorBody)
                if (!problem.detail.isNullOrBlank()) return problem.detail
                if (!problem.title.isNullOrBlank() && problem.title != "Unauthorized") return problem.title
            } catch (_: Exception) { }
        }

        return when (httpEx.code()) {
            401 -> "Usuario o contraseña incorrectos, o la cuenta se encuentra inactiva."
            403 -> "No tenés permisos para acceder a esta aplicación."
            404 -> "Servicio de autenticación no encontrado en el servidor."
            else -> "Error de autenticación (${httpEx.code()}). Verificá tus credenciales."
        }
    }

    suspend fun logout() {
        taskDao.clearTasks()
        sessionPreferences.clearSession()
    }

    suspend fun changePassword(currentPassword: String, newPassword: String): Result<Unit> = runCatching {
        val response = api.changePassword(ChangePasswordRequestDto(currentPassword, newPassword))
        if (!response.isSuccessful) {
            val errorBody = response.errorBody()?.string()
            val message = if (!errorBody.isNullOrBlank()) {
                try {
                    val json = Json { ignoreUnknownKeys = true; isLenient = true }
                    val problem = json.decodeFromString<ProblemDetailsDto>(errorBody)
                    problem.detail ?: problem.title ?: "No se pudo cambiar la contraseña."
                } catch (_: Exception) {
                    "No se pudo cambiar la contraseña."
                }
            } else {
                "No se pudo cambiar la contraseña. Verificá que la contraseña actual sea correcta."
            }
            throw IllegalStateException(message)
        }
    }

    suspend fun refreshAssignments(): Result<List<TaskItemEntity>> = runCatching {
        val remoteAssignments = api.getMisAsignaciones()
        val entities = remoteAssignments.flatMap { assignment ->
            assignment.paradas.map { stop ->
                TaskItemEntity(
                    idAsignacionDetalle = stop.idAsignacionDetalle,
                    idAsignacion = assignment.idAsignacion,
                    tipoAsignacion = assignment.tipoAsignacion,
                    idCodigo = stop.idCodigo,
                    codFijo = stop.codFijo,
                    nombre = stop.nombre,
                    ordenSecuencia = stop.ordenSecuencia,
                    estado = stop.estado,
                    lecturaMedidor = stop.lecturaMedidor,
                    observacion = stop.observacion,
                    fotoEvidenciaUrl = stop.fotoEvidenciaUrl,
                    latitudMedidor = stop.latitudMedidor,
                    longitudMedidor = stop.longitudMedidor
                )
            }
        }.sortedBy { it.ordenSecuencia }

        taskDao.clearTasks()
        if (entities.isNotEmpty()) {
            taskDao.upsertTasks(entities)
        }
        entities
    }

    suspend fun executeTask(
        idAsignacionDetalle: Int,
        estado: String,
        lecturaMedidor: String?,
        observacion: String?,
        latitudEjecucion: Double,
        longitudEjecucion: Double,
        photoFile: File?
    ): Result<Boolean> {
        val nowIso = OffsetDateTime.now(ZoneOffset.UTC).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
        val safeLectura = lecturaMedidor?.trim().orEmpty()
        val safeObservacion = observacion?.trim().orEmpty()

        return try {
            sendExecutionMultipart(
                idAsignacionDetalle = idAsignacionDetalle,
                estado = estado,
                lecturaMedidor = safeLectura,
                observacion = safeObservacion,
                latitudEjecucion = latitudEjecucion,
                longitudEjecucion = longitudEjecucion,
                photoPath = photoFile?.absolutePath
            )
            taskDao.updateLocalTaskStatus(
                idDetalle = idAsignacionDetalle,
                estado = estado,
                lectura = safeLectura.ifBlank { null },
                observacion = safeObservacion.ifBlank { null }
            )
            Result.success(true)
        } catch (_: IOException) {
            taskDao.insertPendingExecution(
                PendingExecutionEntity(
                    idAsignacionDetalle = idAsignacionDetalle,
                    estado = estado,
                    lecturaMedidor = safeLectura,
                    observacion = safeObservacion,
                    latitudEjecucion = latitudEjecucion,
                    longitudEjecucion = longitudEjecucion,
                    photoFilePath = photoFile?.absolutePath,
                    createdAtUtc = nowIso
                )
            )
            taskDao.updateLocalTaskStatus(
                idDetalle = idAsignacionDetalle,
                estado = estado,
                lectura = safeLectura.ifBlank { null },
                observacion = safeObservacion.ifBlank { null }
            )
            Result.success(false)
        } catch (error: Exception) {
            Result.failure(error)
        }
    }

    suspend fun syncPendingExecutions(): Int {
        val pendingList = taskDao.getPendingExecutions()
        var syncedCount = 0
        for (pending in pendingList) {
            try {
                sendExecutionMultipart(
                    idAsignacionDetalle = pending.idAsignacionDetalle,
                    estado = pending.estado,
                    lecturaMedidor = pending.lecturaMedidor,
                    observacion = pending.observacion,
                    latitudEjecucion = pending.latitudEjecucion,
                    longitudEjecucion = pending.longitudEjecucion,
                    photoPath = pending.photoFilePath
                )
                taskDao.deletePendingExecution(pending.localId)
                taskDao.updateLocalTaskStatus(
                    idDetalle = pending.idAsignacionDetalle,
                    estado = pending.estado,
                    lectura = pending.lecturaMedidor.ifBlank { null },
                    observacion = pending.observacion.ifBlank { null }
                )
                syncedCount++
            } catch (_: Exception) {
                // Keep queued for next WorkManager run
            }
        }
        return syncedCount
    }

    suspend fun sendTelemetryPoint(
        latitud: Double,
        longitud: Double,
        velocidadKmh: Double?,
        evento: String = "EnRuta"
    ): Result<Unit> = runCatching {
        val nowIso = OffsetDateTime.now(ZoneOffset.UTC).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
        api.sendTracking(
            IngestTrackingPointDto(
                latitud = latitud,
                longitud = longitud,
                velocidadKmh = velocidadKmh,
                fechaHora = nowIso,
                evento = evento
            )
        )
    }

    private suspend fun sendExecutionMultipart(
        idAsignacionDetalle: Int,
        estado: String,
        lecturaMedidor: String,
        observacion: String,
        latitudEjecucion: Double,
        longitudEjecucion: Double,
        photoPath: String?
    ) = api.ejecutarCorte(
        idAsignacionDetalle = idAsignacionDetalle.toString().toPlainTextPart(),
        estado = estado.toPlainTextPart(),
        lecturaMedidor = lecturaMedidor.toPlainTextPart(),
        observacion = observacion.toPlainTextPart(),
        latitudEjecucion = latitudEjecucion.toString().toPlainTextPart(),
        longitudEjecucion = longitudEjecucion.toString().toPlainTextPart(),
        foto = photoPath?.let { path ->
            val file = File(path)
            if (file.exists()) {
                val body = file.asRequestBody("image/jpeg".toMediaTypeOrNull())
                MultipartBody.Part.createFormData("foto", file.name, body)
            } else {
                null
            }
        }
    )

    private fun String.toPlainTextPart() =
        toRequestBody("text/plain".toMediaTypeOrNull())
}
