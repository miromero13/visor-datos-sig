package com.visordatossig.operaciones.data.local

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [TaskItemEntity::class, PendingExecutionEntity::class],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun taskDao(): TaskDao
}
