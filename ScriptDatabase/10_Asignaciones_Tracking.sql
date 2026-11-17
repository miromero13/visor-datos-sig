USE VisorDatosSIG;
GO

/* =========================================================================
   Script 10: Asignaciones de Corte y Reconexión, Detalles y Telemetría Tracking
   Sistema: VisorDatosSIG / GeoIT Operaciones
   Materia: Sistemas de Información Geográfica (INF 442) - 2/2026
   ========================================================================= */

-- 1. Tabla dbo.Asignaciones (Cabecera de la Asignación Operativa)
IF OBJECT_ID(N'dbo.Asignaciones', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Asignaciones (
        IdAsignacion INT IDENTITY(1,1) PRIMARY KEY,
        IdUsuario INT NOT NULL,
        TipoAsignacion VARCHAR(20) NOT NULL,
        FechaAsignacion DATETIME2 NOT NULL CONSTRAINT DF_Asignaciones_Fecha DEFAULT (SYSDATETIME()),
        PuntoPartidaLat FLOAT NOT NULL,
        PuntoPartidaLon FLOAT NOT NULL,
        CantidadCodigos INT NOT NULL,
        Estado VARCHAR(20) NOT NULL CONSTRAINT DF_Asignaciones_Estado DEFAULT ('Asignada'),
        CONSTRAINT FK_Asignaciones_Usuarios FOREIGN KEY (IdUsuario) REFERENCES dbo.Usuarios(IdUsuario),
        CONSTRAINT CK_Asignaciones_Tipo CHECK (TipoAsignacion IN ('Corte', 'Reconexion')),
        CONSTRAINT CK_Asignaciones_Estado CHECK (Estado IN ('Asignada', 'EnProgreso', 'Finalizada', 'Cancelada'))
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Asignaciones_Usuario_Fecha' AND object_id = OBJECT_ID(N'dbo.Asignaciones'))
BEGIN
    CREATE INDEX IX_Asignaciones_Usuario_Fecha ON dbo.Asignaciones(IdUsuario, FechaAsignacion DESC);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Asignaciones_Estado' AND object_id = OBJECT_ID(N'dbo.Asignaciones'))
BEGIN
    CREATE INDEX IX_Asignaciones_Estado ON dbo.Asignaciones(Estado);
END;
GO

-- 2. Tabla dbo.AsignacionDetalles (Paradas Ordenadas Secuencialmente 1..N por Dijkstra)
IF OBJECT_ID(N'dbo.AsignacionDetalles', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AsignacionDetalles (
        IdAsignacionDetalle INT IDENTITY(1,1) PRIMARY KEY,
        IdAsignacion INT NOT NULL,
        IdCodigo INT NOT NULL,
        OrdenSecuencia INT NOT NULL,
        Estado VARCHAR(20) NOT NULL CONSTRAINT DF_AsignacionDetalles_Estado DEFAULT ('Pendiente'),
        LecturaMedidor VARCHAR(50) NULL,
        Observacion NVARCHAR(500) NULL,
        FotoEvidenciaUrl NVARCHAR(500) NULL,
        LatitudEjecucion FLOAT NULL,
        LongitudEjecucion FLOAT NULL,
        FechaHoraEjecucion DATETIME2 NULL,
        DistanciaDesvioMetros FLOAT NULL,
        CONSTRAINT FK_AsignacionDetalles_Asignaciones FOREIGN KEY (IdAsignacion) 
            REFERENCES dbo.Asignaciones(IdAsignacion) ON DELETE CASCADE,
        CONSTRAINT FK_AsignacionDetalles_CodigosFijos FOREIGN KEY (IdCodigo) 
            REFERENCES dbo.CodigosFijos(IdCodigo),
        CONSTRAINT CK_AsignacionDetalles_Estado CHECK (Estado IN ('Pendiente', 'Cortado', 'Reconectado', 'Observado')),
        CONSTRAINT UQ_AsignacionDetalles_Secuencia UNIQUE (IdAsignacion, OrdenSecuencia)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AsignacionDetalles_Estado' AND object_id = OBJECT_ID(N'dbo.AsignacionDetalles'))
BEGIN
    CREATE INDEX IX_AsignacionDetalles_Estado ON dbo.AsignacionDetalles(IdAsignacion, Estado);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AsignacionDetalles_IdCodigo' AND object_id = OBJECT_ID(N'dbo.AsignacionDetalles'))
BEGIN
    CREATE INDEX IX_AsignacionDetalles_IdCodigo ON dbo.AsignacionDetalles(IdCodigo);
END;
GO

-- 3. Tabla dbo.MonitoreoTracking (Telemetría de Desplazamiento y Auditoría en Campo)
IF OBJECT_ID(N'dbo.MonitoreoTracking', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.MonitoreoTracking (
        IdTracking BIGINT IDENTITY(1,1) PRIMARY KEY,
        IdUsuario INT NOT NULL,
        IdAsignacion INT NULL,
        Latitud FLOAT NOT NULL,
        Longitud FLOAT NOT NULL,
        VelocidadKmh FLOAT NULL,
        FechaHora DATETIME2 NOT NULL CONSTRAINT DF_MonitoreoTracking_Fecha DEFAULT (SYSDATETIME()),
        Evento NVARCHAR(100) NULL,
        CONSTRAINT FK_MonitoreoTracking_Usuarios FOREIGN KEY (IdUsuario) REFERENCES dbo.Usuarios(IdUsuario),
        CONSTRAINT FK_MonitoreoTracking_Asignaciones FOREIGN KEY (IdAsignacion) REFERENCES dbo.Asignaciones(IdAsignacion)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MonitoreoTracking_Usuario_Fecha' AND object_id = OBJECT_ID(N'dbo.MonitoreoTracking'))
BEGIN
    CREATE INDEX IX_MonitoreoTracking_Usuario_Fecha ON dbo.MonitoreoTracking(IdUsuario, FechaHora DESC);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MonitoreoTracking_Asignacion' AND object_id = OBJECT_ID(N'dbo.MonitoreoTracking'))
BEGIN
    CREATE INDEX IX_MonitoreoTracking_Asignacion ON dbo.MonitoreoTracking(IdAsignacion);
END;
GO

-- Diagnóstico de verificación de tablas operativas
SELECT t.name AS Tabla,
       (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id = t.object_id) AS TotalColumnas,
       (SELECT COUNT(*) FROM sys.indexes i WHERE i.object_id = t.object_id AND i.is_hypothetical = 0) AS TotalIndices
FROM sys.tables t
WHERE t.name IN (N'Asignaciones', N'AsignacionDetalles', N'MonitoreoTracking')
ORDER BY t.name;
GO
