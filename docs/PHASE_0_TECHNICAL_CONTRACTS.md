# Contratos técnicos — Fase 0

Este documento registra las decisiones aprobadas para preparar VisorDatosSIG.
No implementa autenticación, migración ni funcionalidades del visor.

## Archivos autoritativos

- `ScriptDatabase/01_CrearBD.sql`: esquema inicial, tablas, relaciones, tipos espaciales y usuarios/roles iniciales.
- `ScriptDatabase/04_Actualizar_CodigosFijos_Estado.sql` a `ScriptDatabase/08_MenuOpciones_UsuarioMenu.sql`: cambios posteriores del modelo, roles, usuarios y permisos.
- `ScriptDatabase/02_Importar_SHP.md`: guía de importación y contrato CRS documentado.
- `DatosSIG/`: archivos fuente SHP disponibles; los nombres actuales llevan el sufijo `_4326`.
- `backend/VisorDatosSig.Api/`: API existente y configuración actual.

Los scripts SQL existentes son la referencia operativa hasta que se apruebe una modificación del modelo. La evidencia disponible no define una correspondencia completa entre atributos DBF y columnas SQL; no debe inferirse ni inventarse.

## Roles y credenciales

Se conservan los roles operativos definidos en `ScriptDatabase/07_Roles_Usuarios_Menu.sql`:

- `Administrador`
- `Catastro`
- `Lecturador`
- `Cortador`
- `Reconexion`

No se reemplazan por perfiles genéricos como Consultor. Las capacidades por rol y su asignación a operaciones concretas no están completamente especificadas y quedan pendientes de validación antes de implementar autorización.

Se retienen por ahora los usuarios y hashes/salts de contraseña de semilla presentes en los scripts, pues forman parte de los scripts existentes. Este comportamiento es exclusivamente para desarrollo o entornos controlados; no constituye una política aceptable para producción. La estrategia de provisión y rotación de credenciales para producción queda pendiente. No copiar ni divulgar contraseñas en documentación.

## CRS: validación y reproyección

El CRS de origen se determina leyendo el archivo `.prj`; la extensión de archivo o el nombre `_4326` no son prueba suficiente. Para cada conjunto se debe comprobar que existan `.shp`, `.shx`, `.dbf` y `.prj`, interpretar el CRS declarado y validarlo antes de cargar datos.

Se acepta como entrada el CRS `EPSG:32720`. Solo después de leer y validar el `.prj` que confirme ese CRS se permite reproyectar automáticamente la geometría a `SRID 4326`, que es el CRS de destino acordado para el almacenamiento y consumo. No se debe limitarse a etiquetar coordenadas de origen como 4326. Si falta el `.prj`, no puede interpretarse, o declara un CRS distinto/no aprobado, se rechaza o se deriva para resolución; no se reproyecta automáticamente bajo una suposición.

Los nombres disponibles en `DatosSIG/` incluyen `Exp_CodigoFijo_4326`, `Exp_MapaBase_LOTES_4326`, `Exp_MapaBase_MZA_4326` y `Exp_MapaBase_VIAS_4326`. El sufijo describe el archivo, pero no sustituye la validación del `.prj`.

## DBF y modelo

Los nombres de capa y tablas SQL documentados son `Exp_CodigoFijo` → `CodigosFijos`, `Exp_MapaBase_LOTES` → `Lotes`, `Exp_MapaBase_MZA` → `Manzanas` y `Exp_MapaBase_VIAS` → `Vias`. No hay un mapa DBF-campo SQL aprobado en la evidencia consultada. El mapeo exacto, reglas de conversión, nulos, duplicados y rechazo de registros quedan pendientes de documentar con inspección autorizada de los datos y esquema.

## Convenciones de API existentes

La API usa ASP.NET Core Minimal APIs. Las rutas existentes comienzan con `/api/`; actualmente incluye análisis de nombres/agrupación de archivos SHP y prueba de conexión SQL Server. La conexión usa `Microsoft.Data.SqlClient` y la configuración `ConnectionStrings:MigrationDb`. Se conservan SQL Server y sus dependencias; no se incorpora proveedor MySQL.

Las decisiones sobre formato uniforme de errores (incluido Problem Details), convenciones JSON, paginación, límites, ordenamiento y contrato GeoJSON aún no están formalizadas y quedan pendientes antes de las vistas que los necesiten. Este contrato no impone cambios funcionales en los endpoints existentes.

## Pendientes

- Aprobar el mapeo exacto de atributos DBF a columnas SQL y sus reglas de validación.
- Definir capacidades y permisos por rol, sin alterar el conjunto aprobado de roles.
- Definir manejo de errores, JSON, GeoJSON, paginación y límites de consulta de la API.
- Definir la estrategia de credenciales adecuada para producción y transición desde las semillas actuales.
- Establecer comportamiento de rechazo/revisión para fuentes cuyo `.prj` no valide `EPSG:32720`.
