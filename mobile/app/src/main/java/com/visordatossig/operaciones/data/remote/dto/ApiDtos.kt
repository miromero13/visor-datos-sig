package com.visordatossig.operaciones.data.remote.dto

import kotlinx.serialization.Serializable

@Serializable
data class LoginRequestDto(
    val login: String,
    val password: String,
    val rememberMe: Boolean = true
)

@Serializable
data class AuthUserDto(
    val id: Int,
    val login: String,
    val name: String,
    val roles: List<String> = emptyList()
)

@Serializable
data class LoginDataDto(
    val user: AuthUserDto,
    val accessToken: String = "",
    val refreshToken: String = "",
    val expiresAt: String? = null
)

@Serializable
data class LoginEnvelopeDto(
    val data: LoginDataDto
)

@Serializable
data class AssignmentDetailItemDto(
    val idAsignacionDetalle: Int,
    val idAsignacion: Int,
    val idCodigo: Int,
    val codFijo: Int? = null,
    val nombre: String? = null,
    val ordenSecuencia: Int,
    val estado: String,
    val lecturaMedidor: String? = null,
    val observacion: String? = null,
    val fotoEvidenciaUrl: String? = null,
    val latitudEjecucion: Double? = null,
    val longitudEjecucion: Double? = null,
    val fechaHoraEjecucion: String? = null,
    val distanciaDesvioMetros: Double? = null,
    val latitudMedidor: Double,
    val longitudMedidor: Double
)

@Serializable
data class MobileAssignmentSheetDto(
    val idAsignacion: Int,
    val tipoAsignacion: String,
    val fechaAsignacion: String,
    val estado: String,
    val puntoPartidaLat: Double,
    val puntoPartidaLon: Double,
    val cantidadCodigos: Int,
    val completados: Int,
    val observados: Int,
    val pendientes: Int,
    val paradas: List<AssignmentDetailItemDto> = emptyList()
)

@Serializable
data class IngestTrackingPointDto(
    val idAsignacion: Int? = null,
    val latitud: Double,
    val longitud: Double,
    val velocidadKmh: Double? = null,
    val fechaHora: String? = null,
    val evento: String? = null
)

@Serializable
data class MobileExecutionResultDto(
    val succeeded: Boolean,
    val message: String,
    val distanciaDesvioMetros: Double? = null,
    val alertaUbicacion: Boolean = false
)

@Serializable
data class ProblemDetailsDto(
    val title: String? = null,
    val detail: String? = null,
    val status: Int? = null
)

@Serializable
data class ChangePasswordRequestDto(
    val currentPassword: String,
    val newPassword: String
)
