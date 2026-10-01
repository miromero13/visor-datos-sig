# Contratos técnicos — Fase 0

Este documento registra las decisiones aprobadas para preparar VisorDatosSIG.
No implementa autenticación, migración ni funcionalidades del visor.

## Archivos autoritativos

- `ScriptDatabase/01_CrearBD.sql`: esquema inicial, tablas, relaciones, tipos espaciales y usuarios/roles iniciales.
- `ScriptDatabase/04_Actualizar_CodigosFijos_Estado.sql` a `ScriptDatabase/08_MenuOpciones_UsuarioMenu.sql`: cambios posteriores del modelo, roles, usuarios y permisos.
- `ScriptDatabase/02_Importar_SHP.md`: guía de importación y contrato CRS documentado.
- `DatosSIG/`: archivos fuente SHP disponibles; los nombres actuales llevan el sufijo `_4326`.
- `backend/VisorDatosSig.Api/`: API existente y configuración actual.

Los scripts SQL existentes son la referencia operativa hasta que se apruebe una modificación del modelo. La inspección de encabezados y registros DBF cerró la evidencia necesaria para aprobar el mapeo inicial documentado abajo; sus valores, truncamiento y nulabilidad deben validarse en runtime antes de cargar datos.

## Roles y credenciales

Se conservan los roles operativos definidos en `ScriptDatabase/07_Roles_Usuarios_Menu.sql`:

- `Administrador`
- `Catastro`
- `Lecturador`
- `Cortador`
- `Reconexion`

No se reemplazan por perfiles genéricos como Consultor. La siguiente matriz es un contrato provisional de capacidades aprobado para orientar la implementación; se basa en las descripciones de `ScriptDatabase/07_Roles_Usuarios_Menu.sql` y las asignaciones de `ScriptDatabase/08_MenuOpciones_UsuarioMenu.sql`.

| Rol | Capacidades provisionales |
|---|---|
| Administrador | Todos los módulos de la aplicación, incluida la administración de usuarios y roles, migraciones, catálogo, logs, visor y consultas. |
| Catastro | Administración y migración de datos espaciales, además de visor y consultas. No incluye administración de usuarios ni roles, salvo concesión explícita posterior. |
| Lecturador | Visor y consultas, más lectura, ejecución y monitoreo de operaciones de lecturación representadas por los scripts de menú existentes. |
| Cortador | Visor y consultas, más lectura, ejecución y monitoreo de operaciones de cortes representadas por los scripts de menú existentes. |
| Reconexion | Visor y consultas, más lectura, ejecución y monitoreo de operaciones de reconexión representadas por los scripts de menú existentes. Los scripts actuales no asignan un usuario semilla a este rol. |

Las políticas de autorización aplicadas en el servidor a cada endpoint son la autoridad final. La visibilidad del menú es únicamente de presentación y no constituye control de acceso ni reemplaza las políticas del servidor. La matriz es provisional: cualquier operación no representada en las descripciones o asignaciones actuales requiere una concesión explícita antes de habilitarse.

Se retienen por ahora los usuarios y hashes/salts de contraseña de semilla presentes en los scripts, conforme a la decisión de mantener las semillas actuales. Esto se limita a desarrollo o entornos controlados y no constituye una política aceptable para producción. La provisión y rotación de credenciales de producción queda como seguimiento, no como bloqueo de salida de la Fase 0. No copiar ni divulgar contraseñas en documentación.

## CRS: validación y reproyección

El CRS de origen se determina leyendo el archivo `.prj`; la extensión de archivo o el nombre `_4326` no son prueba suficiente. Para cada conjunto se debe comprobar que existan `.shp`, `.shx`, `.dbf` y `.prj`, interpretar el CRS declarado y validarlo antes de cargar datos.

Se acepta como entrada el CRS `EPSG:32720`. Solo después de leer y validar el `.prj` que confirme ese CRS se permite reproyectar automáticamente la geometría a `SRID 4326`, que es el CRS de destino acordado para el almacenamiento y consumo. No se deben etiquetar coordenadas de origen como 4326 sin reproyectarlas. Si falta el `.prj`, no puede interpretarse, o declara un CRS distinto/no aprobado, se rechaza o se deriva para resolución; no se reproyecta automáticamente bajo una suposición.

Los nombres disponibles en `DatosSIG/` incluyen `Exp_CodigoFijo_4326`, `Exp_MapaBase_LOTES_4326`, `Exp_MapaBase_MZA_4326` y `Exp_MapaBase_VIAS_4326`. El sufijo describe el archivo, pero no sustituye la validación del `.prj`.

## Inventario DBF verificado y mapeo inicial aprobado

Los conteos corresponden a los registros inspeccionados y los descriptores indican tipo DBF, ancho y decimales (cuando aplica). La inspección no autoriza inferencias adicionales.

| Capa / archivo DBF | Registros | Campo | Tipo, ancho, decimales |
|---|---:|---|---|
| `Exp_CodigoFijo_4326.dbf` | 6271 | Text | C, 254 |
|  |  | CodF_SQL | N, 10, 0 |
|  |  | CodF_SIG | C, 25 |
|  |  | Longi | N, 19, 6 |
|  |  | Latid | N, 19, 6 |
|  |  | CodFijo | N, 10, 0 |
|  |  | Nombre | C, 40 |
| `Exp_MapaBase_LOTES_4326.dbf` | 15281 | Id | N, 6, 0 |
|  |  | NroLote | C, 15 |
| `Exp_MapaBase_MZA_4326.dbf` | 863 | Id | N, 6, 0 |
|  |  | UV_MZA | C, 20 |
|  |  | UV | C, 15 |
|  |  | MZA | C, 10 |
| `Exp_MapaBase_VIAS_4326.dbf` | 578 | osm_id | N, 11, 0 |
|  |  | name | C, 48 |
|  |  | ref | C, 16 |
|  |  | type | C, 16 |
|  |  | oneway | N, 1, 0 |
|  |  | bridge | N, 1, 0 |
|  |  | maxspeed | N, 3, 0 |
|  |  | OBJECTID | N, 10, 0 |
|  |  | Nombre | C, 40 |
|  |  | OSMID | N, 10, 0 |
|  |  | highway | N, 10, 0 |

| Capa → tabla | DBF → SQL aprobado | Origen / derivación |
|---|---|---|
| `Exp_CodigoFijo` → `CodigosFijos` | `CodF_SQL` → `CodF_SQL`; `CodF_SIG` → `CodF_SIG`; `Longi` → `Longitud`; `Latid` → `Latitud`; `CodFijo` → `CodFijo`; `Nombre` → `Nombre` | `Text` sin columna destino; `Geom` desde SHP; `Estado` y `FechaCambioEstado` usan defaults; `IdLote` se deriva espacialmente. |
| `Exp_MapaBase_LOTES` → `Lotes` | `Id` → `IdOrigen`; `NroLote` → `NroLote` | `Geom` desde SHP; `IdManzana` se deriva espacialmente; `IdLote` es identity. |
| `Exp_MapaBase_MZA` → `Manzanas` | `Id` → `IdOrigen`; `UV_MZA` → `UV_MZA`; `UV` → `UV`; `MZA` → `MZA` | `Geom` desde SHP; `IdManzana` es identity. |
| `Exp_MapaBase_VIAS` → `Vias` | `OBJECTID` → `OBJECTID`; `Nombre` → `Nombre`; `type` → `TipoVia`; `OSMID` → `OSMID` mediante conversión a string | `Geom` desde SHP; `IdVia` es identity. `osm_id`, `name`, `ref`, `oneway`, `bridge`, `maxspeed` y `highway` quedan source-only/sin mapear. `type` contiene clasificaciones de vía observadas; `highway` es binario/nulo-like y no es fuente segura para `TipoVia`. |

Este mapeo inicial no reemplaza validación runtime de valores, truncamiento y nulabilidad, ni resuelve reglas de duplicados o rechazo de registros. No se debe inferir otro destino para campos source-only.

## Convenciones de API

La API usa ASP.NET Core Minimal APIs y conserva el prefijo existente `/api/...`; sus endpoints actuales mantienen su comportamiento. La conexión usa `Microsoft.Data.SqlClient` y `ConnectionStrings:MigrationDb`; SQL Server y las dependencias existentes se conservan, sin incorporar proveedor MySQL.

Convenciones para recursos nuevos (sin cambiar ahora los endpoints existentes):

- Errores con `ProblemDetails` (`application/problem+json`), con status HTTP correcto y sin secretos ni datos sensibles.
- Recursos JSON no GeoJSON con envoltura `{ "data": ..., "meta": ... }`.
- Colecciones paginadas con `items`, `page`, `pageSize` y `total`; `page` inicia en 1 y `pageSize` se limita a 100.
- GeoJSON como `FeatureCollection` estándar sin envoltura `data/meta`; coordenadas en orden longitud-latitud (X=longitud, Y=latitud).
- Consultas espaciales requieren `bbox` con cuatro valores en orden minLon,minLat,maxLon,maxLat, dentro de longitudes [-180,180] y latitudes [-90,90], con mínimos menores que máximos; `limit` positivo y limitado a 1000. No permitir consultas ilimitadas.
- Ordenamiento y filtros solo sobre campos explícitamente allowlisted, nunca interpolar nombres arbitrarios en SQL.
- Nunca exponer secretos, credenciales, hashes/salts, cadenas de conexión ni configuración sensible en respuestas o errores.

## Pendientes

- Validar en runtime valores, truncamiento y nulabilidad según el mapeo aprobado; definir reglas de duplicados y rechazo de registros.
- Implementar y validar en servidor políticas de endpoint acordes con la matriz provisional de capacidades, sin alterar el conjunto aprobado de roles.
- Validar el comportamiento de fuentes cuyo `.prj` no confirme `EPSG:32720`.
- Provisionar y rotar credenciales de producción y definir la transición desde las semillas actuales; es un seguimiento posterior, no un bloqueo de la Fase 0.
