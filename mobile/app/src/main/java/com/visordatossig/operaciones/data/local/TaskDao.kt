package com.visordatossig.operaciones.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface TaskDao {

    @Query("SELECT * FROM cached_tasks ORDER BY ordenSecuencia ASC")
    fun observeTasks(): Flow<List<TaskItemEntity>>

    @Query("SELECT * FROM cached_tasks WHERE idAsignacionDetalle = :id LIMIT 1")
    suspend fun getTaskById(id: Int): TaskItemEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertTasks(items: List<TaskItemEntity>)

    @Query("DELETE FROM cached_tasks")
    suspend fun clearTasks()

    @Query("UPDATE cached_tasks SET estado = :estado, lecturaMedidor = :lectura, observacion = :observacion WHERE idAsignacionDetalle = :idDetalle")
    suspend fun updateLocalTaskStatus(
        idDetalle: Int,
        estado: String,
        lectura: String?,
        observacion: String?
    )

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPendingExecution(pending: PendingExecutionEntity): Long

    @Query("SELECT * FROM pending_executions ORDER BY localId ASC")
    suspend fun getPendingExecutions(): List<PendingExecutionEntity>

    @Query("SELECT COUNT(*) FROM pending_executions")
    fun observePendingCount(): Flow<Int>

    @Query("DELETE FROM pending_executions WHERE localId = :localId")
    suspend fun deletePendingExecution(localId: Long)
}
