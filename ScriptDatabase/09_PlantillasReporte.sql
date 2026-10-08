USE VisorDatosSIG;
GO

/*
  Plantillas de reportes personalizados.
  Cada plantilla pertenece a un usuario; Configuracion guarda la definición
  validada del reporte (capa, columnas, filtros, agrupación, orden y salida) en JSON.
*/
IF OBJECT_ID(N'dbo.PlantillasReporte', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PlantillasReporte
    (
        IdPlantilla INT IDENTITY(1,1) PRIMARY KEY,
        IdUsuario INT NOT NULL,
        Nombre NVARCHAR(100) NOT NULL,
        Capa NVARCHAR(30) NOT NULL,
        Configuracion NVARCHAR(MAX) NOT NULL,
        FechaCreacion DATETIME2 NOT NULL
            CONSTRAINT DF_PlantillasReporte_FechaCreacion DEFAULT(SYSDATETIME()),
        FechaModificacion DATETIME2 NOT NULL
            CONSTRAINT DF_PlantillasReporte_FechaModificacion DEFAULT(SYSDATETIME()),
        CONSTRAINT FK_PlantillasReporte_Usuarios FOREIGN KEY(IdUsuario)
            REFERENCES dbo.Usuarios(IdUsuario) ON DELETE CASCADE,
        CONSTRAINT UQ_PlantillasReporte_Usuario_Nombre UNIQUE(IdUsuario, Nombre),
        CONSTRAINT CK_PlantillasReporte_Configuracion CHECK(ISJSON(Configuracion) = 1)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
     WHERE name = N'IX_PlantillasReporte_IdUsuario'
       AND object_id = OBJECT_ID(N'dbo.PlantillasReporte'))
BEGIN
    CREATE INDEX IX_PlantillasReporte_IdUsuario
        ON dbo.PlantillasReporte(IdUsuario, FechaModificacion DESC);
END;
GO
