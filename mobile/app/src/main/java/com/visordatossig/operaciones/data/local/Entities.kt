package com.visordatossig.operaciones.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "cached_tasks")
data class TaskItemEntity(
    @PrimaryKey val idAsignacionDetalle: Int,
    val idAsignacion: Int,
    val tipoAsignacion: String,
    val idCodigo: Int,
    val codFijo: Int?,
    val nombre: String?,
    val ordenSecuencia: Int,
    val estado: String,
    val lecturaMedidor: String?,
    val observacion: String?,
    val fotoEvidenciaUrl: String?,
    val latitudMedidor: Double,
    val longitudMedidor: Double
)

@Entity(tableName = "pending_executions")
data class PendingExecutionEntity(
    @PrimaryKey(autoGenerate = true) val localId: Long = 0,
    val idAsignacionDetalle: Int,
    val estado: String,
    val lecturaMedidor: String,
    val observacion: String,
    val latitudEjecucion: Double,
    val longitudEjecucion: Double,
    val photoFilePath: String?,
    val createdAtUtc: String
)
