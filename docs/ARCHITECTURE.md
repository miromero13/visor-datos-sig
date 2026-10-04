# Arquitectura del proyecto VisorDatosSIG

## 1. Descripción general

VisorDatosSIG utiliza una arquitectura por capas para separar responsabilidades y mejorar la organización y mantenibilidad del código. Esta reorganización es física: no modifica la lógica ni el comportamiento existente del sistema.

## 2. Flujo general

Usuario
-> React + TypeScript / Leaflet
-> ASP.NET Core Web API
-> Capa de aplicación
-> Capa de infraestructura
-> SQL Server 2022

GeoJSON se utiliza para transportar información geográfica entre la API y el visor web.

## 3. Arquitectura del backend

El backend se encuentra en `backend/VisorDatosSig.Api` y mantiene `Program.cs` como punto de entrada.

### Application

Responsabilidad: contiene servicios que coordinan funcionalidades y lógica de aplicación existente.

`Application/Services` contiene, entre otros, los siguientes servicios:

- `AuthService`
- `AuthAuditService`
- `LayerQueryService`
- `SearchQueryService`
- `CodigoFijoSimulationService`

### Infrastructure

Responsabilidad: contiene detalles técnicos y mecanismos de infraestructura.

`Infrastructure/Authentication` contiene `JwtTokenService` y `SessionRegistry`, encargados de los mecanismos actuales de tokens y sesiones.

`Infrastructure/Database` contiene `DatabaseScriptRunner` y `SqlServerConnectionProbe`, para ejecución de scripts y comprobación de conexión con SQL Server.

`Infrastructure/Geographic` contiene `ShapefileMigrationService` y `ShapefileSourceAnalyzer`, para el procesamiento geográfico y de fuentes Shapefile.

SQL Server sigue siendo accedido por el backend. Esta tarea no cambia consultas SQL ni la lógica existente.

### Program.cs

`Program.cs` se mantiene en la raíz como punto de entrada, configuración de servicios, middleware y definición actual de endpoints. No se crean Controllers en esta reorganización.

## 4. Arquitectura del frontend

El frontend utiliza React + TypeScript y Leaflet. Su organización futura se describe conceptualmente por responsabilidades:

### Presentación

Incluye páginas, componentes, layouts, elementos UI y la visualización del mapa. Actualmente estos elementos se encuentran principalmente en `frontend/src/pages`, `frontend/src/components` y `frontend/src/layouts`.

### Aplicación / servicios

Incluye la lógica de interacción con las funcionalidades del sistema, el manejo de autenticación del lado cliente, el consumo de datos y la coordinación entre vistas y servicios.

### Infraestructura / comunicación

Incluye las funciones que realizan solicitudes HTTP, la comunicación con ASP.NET Core Web API y el consumo de JSON y GeoJSON. Actualmente se concentra principalmente en `frontend/src/lib`, con módulos para autenticación, capas, migraciones y fuentes Shapefile.

En esta ejecución el frontend solamente se documenta. No ha sido reorganizado todavía.

## 5. Dependencias entre capas

- La interfaz consume servicios.
- Los servicios utilizan infraestructura cuando necesitan acceso técnico.
- La infraestructura interactúa con SQL Server y el procesamiento geográfico.
- El frontend nunca debe acceder directamente a SQL Server.
- Toda comunicación con los datos del sistema debe pasar por el backend.

## 6. Tecnologías

- React
- TypeScript
- Leaflet
- C#
- .NET 10
- ASP.NET Core 10 Web API
- SQL Server 2022
- GeoJSON
- NetTopologySuite

Entity Framework Core no forma parte de la configuración o dependencias actuales del proyecto.

## 7. Estructura actual aplicada

```text
backend/
└── VisorDatosSig.Api/
    ├── Program.cs
    ├── Application/
    │   └── Services/
    │       ├── AuthService.cs
    │       ├── AuthAuditService.cs
    │       ├── LayerQueryService.cs
    │       ├── SearchQueryService.cs
    │       └── CodigoFijoSimulationService.cs
    ├── Infrastructure/
    │   ├── Authentication/
    │   │   ├── JwtTokenService.cs
    │   │   └── SessionRegistry.cs
    │   ├── Database/
    │   │   ├── DatabaseScriptRunner.cs
    │   │   └── SqlServerConnectionProbe.cs
    │   └── Geographic/
    │       ├── ShapefileMigrationService.cs
    │       └── ShapefileSourceAnalyzer.cs
    └── VisorDatosSig.Api.csproj
```

La reorganización física del frontend queda pendiente para una siguiente tarea.
