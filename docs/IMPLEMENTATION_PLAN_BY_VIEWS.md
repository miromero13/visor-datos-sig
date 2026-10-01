# Plan técnico de implementación por vistas — VisorDatosSIG

Este documento reemplaza la ejecución fragmentada de tareas por un plan de **entrega vertical**. Cada fase debe cerrar una vista funcional completa, incluyendo base de datos, backend/API, frontend, permisos, pruebas y evidencia.

> Jira queda como fuente de trazabilidad y criterios de aceptación, pero no como unidad principal de ejecución.

## Ruta de entrega

```text
Fase 0 — Contratos y preparación técnica
    ↓
Fase 1 — Autenticación y acceso
    ↓
Fase 2 — Migración de datos
    ↓
Fase 3 — Visor cartográfico
    ↓
Fase 4 — Búsqueda, filtros y resultados
    ↓
Fase 5 — Administración e historial
    ↓
Fase 6 — Responsive, pruebas y entrega
```

## Reglas generales

- El diseño visual de las vistas debe tomarse de **OpenPencil MCP**. No se debe reconstruir visualmente una pantalla ya diseñada sin consultar el artefacto correspondiente.
- La base de datos oficial es SQL Server 2022 y los scripts existentes en `ScriptDatabase/` son el punto de partida.
- Los nombres de tablas, campos, relaciones y tipos deben respetar el diseño físico aprobado.
- Los datos reales están en `DatosSIG/`.
- El backend es la única capa autorizada para acceder a SQL Server.
- El frontend consume API y GeoJSON; nunca consulta directamente la base de datos.
- El origen espacial debe leerse desde `.prj`. La guía actual documenta fuentes `EPSG:32720` que deben convertirse explícitamente a `SRID 4326`.
- Las funcionalidades condicionales —personas, estados temáticos, contexto territorial— solo se implementan si existen los campos y relaciones oficiales.

---

# Fase 0 — Contratos y preparación técnica

## Objetivo

Dejar alineados el diseño SQL, los datos fuente, los contratos de API, la autenticación y la arquitectura antes de construir las vistas funcionales.

## Base de datos y scripts

Revisar y tomar como base:

- `ScriptDatabase/01_CrearBD.sql`
  - `Usuarios`.
  - `Roles`.
  - `UsuariosRoles`.
  - `MenuOpciones`.
  - `UsuarioMenu`.
  - `CodigosFijos`.
  - `Manzanas`.
  - `Lotes`.
  - `Vias`.
  - relaciones, restricciones e índices espaciales.
- `ScriptDatabase/04_Actualizar_CodigosFijos_Estado.sql`.
- `ScriptDatabase/05_Optimizar_Relacion_CodigoFijo_Lote.sql`.
- `ScriptDatabase/06_Agregar_Nombre_Vias.sql`.
- `ScriptDatabase/07_Roles_Usuarios_Menu.sql`.
- `ScriptDatabase/08_MenuOpciones_UsuarioMenu.sql`.
- `ScriptDatabase/02_Importar_SHP.md` como referencia del proceso actual de importación y CRS.

Decisiones aprobadas para la Fase 0 (ver contrato completo en
`docs/PHASE_0_TECHNICAL_CONTRACTS.md`):

- conservar los roles operativos actuales de `ScriptDatabase/07_Roles_Usuarios_Menu.sql`:
  `Administrador`, `Catastro`, `Lecturador`, `Cortador` y `Reconexion`;
- leer y validar el `.prj` de cada fuente; aceptar fuentes `EPSG:32720` y
  reproyectarlas automáticamente a `SRID 4326` antes de almacenarlas;
- conservar por ahora los usuarios y credenciales de semilla definidos por los
  scripts. Esto solo es válido para desarrollo o entornos controlados y no implica
  que sean adecuados para producción.

Contratos completados en Fase 0:

- inventario DBF verificado y mapeo inicial explícito a SQL, incluidos los campos source-only;
- convenciones API para ProblemDetails, JSON, paginación, GeoJSON, coordenadas, límites y allowlists;
- matriz provisional de capacidades por rol y decisión CRS documentadas.

Validar durante la implementación/runtime:

- valores, truncamiento y nulabilidad del mapeo aprobado, además de claves y reglas de duplicados;
- relaciones `Código Fijo → Lote → Manzana` y campos visibles, buscables y exportables;
- reglas de reparación geométrica y reproyección `EPSG:32720 → EPSG:4326` frente a cada `.prj` real;
- estrategia de credenciales de producción y transición desde las semillas de desarrollo/entornos controlados.

## Backend

- Confirmar `Microsoft.Data.SqlClient` y configuración SQL Server.
- Retirar dependencias incompatibles con SQL Server, como `Pomelo.EntityFrameworkCore.MySql`, si no existe una justificación técnica.
- Definir configuración por ambiente.
- Definir manejo de errores y respuestas problem-details.
- Definir contratos JSON y GeoJSON.
- Definir paginación, límites de consulta y ordenamiento permitido.

## Frontend

- Confirmar estructura de rutas.
- Confirmar sistema de componentes y estilos.
- Consultar OpenPencil MCP para layout, tokens, componentes, estados y responsive.
- Definir cliente HTTP, manejo de sesión, errores, loading y empty states.

## Salida de la fase

**Estado de salida: Fase 0 — contrato técnico completo.** No implica que se haya implementado runtime ni que las vistas estén listas.

- Mapa inicial de campos fuente/destino aprobado con inventario DBF verificado en `docs/PHASE_0_TECHNICAL_CONTRACTS.md` y `ScriptDatabase/02_Importar_SHP.md`.
- Convenciones de API definidas en el contrato técnico, preservando el comportamiento actual de endpoints.
- Matriz provisional de capacidades por rol, autoridad de políticas de endpoint y carácter exclusivamente presentacional del menú documentados.
- Política CRS y reproyección documentadas.

**Seguimientos de implementación (no bloquean el cierre contractual de Fase 0):**

- Validar en runtime el diseño SQL contra valores, truncamiento y nulabilidad reales.
- Implementar y verificar políticas de autorización por endpoint; no confiar en la visibilidad del menú como control de acceso.
- Consultar OpenPencil para la estructura visual antes de implementar vistas.
- Provisionar y rotar credenciales de producción y definir la transición desde las semillas actuales; se mantienen las semillas actuales por decisión aprobada.

---

# Fase 1 — Vista de autenticación y acceso

## Objetivo

Entregar login, sesión, autorización y navegación por perfil como una funcionalidad completa.

## Diseño visual

La vista de login debe utilizar el diseño existente en **OpenPencil MCP**:

- composición de la pantalla;
- logo y marca;
- campos;
- botón principal;
- mensajes de error;
- estado de carga;
- recuperación o cambio de contraseña si el diseño lo contempla;
- versión responsive para 360, 768 y 1366 px.

Antes de implementarla, consultar el documento/proyecto correspondiente en OpenPencil y respetar sus componentes y decisiones visuales.

## Base de datos y scripts

Usar y revisar:

- `ScriptDatabase/01_CrearBD.sql`:
  - `Usuarios`.
  - `Roles`.
  - `UsuariosRoles`.
- `ScriptDatabase/07_Roles_Usuarios_Menu.sql`.
- `ScriptDatabase/08_MenuOpciones_UsuarioMenu.sql`.

Implementar o ajustar:

- usuarios activos y bloqueados;
- relación usuario-rol;
- permisos por menú u operación;
- hash y salt de contraseña;
- fecha de registro;
- registro de accesos y eventos.

No dejar contraseñas iniciales conocidas en ambientes de demostración o producción.

## Backend/API

Crear una capa de identidad con:

- `POST /api/auth/login`.
- `POST /api/auth/logout`.
- `GET /api/auth/me`.
- `POST /api/auth/change-password`.
- `POST /api/auth/refresh` o mecanismo equivalente, si se utiliza JWT.

Implementar:

- validación de credenciales;
- sesión o JWT;
- expiración por inactividad;
- bloqueo de usuarios inactivos;
- autorización en servidor;
- políticas para Administrador y Consultor;
- respuestas sin contraseñas, hashes, salts o secretos;
- auditoría de login exitoso, login fallido y logout.

## Frontend

Crear:

- `LoginPage` conectada a API.
- `ProtectedRoute` o equivalente.
- `AuthProvider`/estado global de autenticación.
- navegación por rol;
- pantalla de perfil;
- cambio de contraseña;
- logout;
- redirección por sesión expirada;
- mensajes de credenciales inválidas;
- estados loading, error y sesión expirada.

## Pruebas y aceptación

- Login válido crea sesión.
- Login inválido no crea sesión.
- Usuario bloqueado no ingresa.
- Consultor no accede a rutas administrativas.
- Logout invalida la sesión.
- Sesión expirada exige autenticación.
- La interfaz corresponde al diseño OpenPencil.

**Salida:** el usuario puede ingresar, navegar y operar solamente las funciones autorizadas para su perfil.

---

# Fase 2 — Vista de migración de datos

## Objetivo

Entregar un flujo completo para validar y cargar `DatosSIG/` a SQL Server.

## Datos fuente

Procesar las cuatro capas existentes:

- `Exp_CodigoFijo` → `dbo.CodigosFijos`.
- `Exp_MapaBase_LOTES` → `dbo.Lotes`.
- `Exp_MapaBase_MZA` → `dbo.Manzanas`.
- `Exp_MapaBase_VIAS` → `dbo.Vias`.

Cada conjunto debe incluir y validarse como unidad:

- `.shp`;
- `.shx`;
- `.dbf`;
- `.prj`.

## Base de datos y scripts

Usar:

- `ScriptDatabase/01_CrearBD.sql` para tablas, claves, relaciones e índices.
- `ScriptDatabase/02_Importar_SHP.md` para correspondencias y validaciones.
- `ScriptDatabase/05_Optimizar_Relacion_CodigoFijo_Lote.sql` para asociaciones espaciales.
- `ScriptDatabase/04_Actualizar_CodigosFijos_Estado.sql` para estado de códigos fijos.

Agregar o utilizar una tabla de auditoría de migraciones con:

- usuario;
- fecha de inicio y fin;
- archivo;
- capa;
- tabla destino;
- registros procesados;
- exitosos;
- omitidos;
- fallidos;
- advertencias;
- errores;
- duración;
- estado final;
- cancelación o rollback.

## Backend/API

Crear servicios para:

- probar conexión SQL;
- recibir y agrupar archivos fuente;
- leer contenido SHP/DBF/PRJ;
- validar integridad;
- detectar geometría vacía o inválida;
- validar el CRS declarado;
- reproyectar a 4326 cuando corresponda;
- mostrar preview de registros;
- validar el mapeo DBF → SQL;
- elegir modo reemplazo o append;
- cargar por lotes dentro de transacción;
- cancelar de forma segura;
- informar progreso;
- detectar duplicados;
- guardar auditoría;
- exportar resumen cuando se priorice esa funcionalidad.

La ausencia de `.prj`, un CRS incompatible o una conversión no autorizada debe bloquear la carga o requerir una decisión explícita.

## Frontend

Construir una vista tipo wizard:

1. Conexión a SQL Server.
2. Selección de archivos.
3. Validación de componentes.
4. Validación de CRS y geometrías.
5. Preview de registros.
6. Mapeo de campos.
7. Selección de modo de carga.
8. Ejecución con progreso.
9. Resultado y auditoría.

Estados requeridos:

- loading;
- validación exitosa;
- archivo incompleto;
- CRS incompatible;
- geometría inválida;
- conversión inválida;
- cancelación;
- rollback;
- migración exitosa;
- migración parcial bloqueada.

## Pruebas y aceptación

- Faltan componentes SHP: no se modifica la base.
- PRJ faltante o incorrecto: la migración se bloquea.
- Geometría inválida: se identifica el registro y la causa.
- Error de conexión: rollback.
- Error durante carga: no quedan datos inconsistentes.
- Las geometrías persistidas tienen `STSrid = 4326`.
- Se genera auditoría completa.
- Las cuatro capas pueden ser procesadas.

**Salida:** las cuatro capas quedan cargadas, validadas y auditadas en SQL Server.

---

# Fase 3 — Vista del visor cartográfico

## Objetivo

Mostrar las capas reales almacenadas en SQL Server mediante API y Leaflet.

## Base de datos

Usar:

- `dbo.Manzanas`.
- `dbo.Lotes`.
- `dbo.CodigosFijos`.
- `dbo.Vias`.
- índices espaciales creados en `ScriptDatabase/01_CrearBD.sql`.

Verificar:

- geometrías no nulas;
- SRID 4326;
- geometrías válidas;
- relaciones espaciales disponibles.

## Backend/API

Crear:

- `GET /api/layers`.
- `GET /api/layers/{layer}/geojson`.
- `GET /api/layers/{layer}/{id}`.
- `GET /api/layers/{layer}/extent`.

Soportar:

- `bbox`;
- límite de resultados;
- paginación o carga controlada;
- campos autorizados;
- estilos de capa;
- errores recuperables;
- GeoJSON válido con coordenadas `[longitude, latitude]`.

## Frontend

Consultar OpenPencil MCP para la vista del visor y luego implementar:

- mapa Leaflet;
- mapa base con atribución;
- control de capas;
- leyenda dinámica;
- estilos para polígonos, puntos y líneas;
- zoom a extensión de capa;
- escala;
- coordenadas;
- selección de geometrías;
- resaltado persistente;
- panel de atributos;
- loading, error, retry y empty state;
- fallback cuando falle el mapa base.

Agregar Leaflet y sus tipos al frontend si todavía no existen.

## Pruebas y aceptación

- Se muestran las cuatro capas reales.
- Las capas pueden activarse y desactivarse.
- La simbología coincide con la leyenda.
- El mapa permite pan y zoom.
- Una geometría seleccionada muestra atributos.
- El GeoJSON cumple su estructura.
- El mapa no intenta cargar datos ilimitados sin control.

**Salida:** existe un visor funcional conectado a datos reales.

---

# Fase 4 — Vista de búsqueda, filtros y resultados

## Objetivo

Unificar consulta alfanumérica, filtros, tabla y mapa en un solo flujo.

## Base de datos

Usar los campos oficiales de:

- `CodigosFijos`.
- `Lotes`.
- `Manzanas`.
- `Vias`.

Reutilizar o adaptar:

- `sp_BuscarInmueble`.
- `sp_ActualizarLoteCodigosFijos`.
- índices sobre códigos, nombres, estados, lotes y relaciones.

No inventar campos de personas, estados o relaciones que no existan en el diseño oficial.

## Backend/API

Crear:

- `GET /api/search`.
- `GET /api/search/{id}`.
- `GET /api/search/export` cuando se priorice CSV.

Soportar:

- búsqueda parcial;
- búsqueda por capa;
- filtros por atributos;
- combinación de criterios;
- paginación;
- ordenamiento permitido;
- total de resultados;
- extensión de resultados;
- datos alfanuméricos y geometría autorizada.

## Frontend

Consultar el diseño de OpenPencil para paneles, tablas, filtros y estados. Implementar:

- búsqueda general;
- búsqueda de código fijo;
- búsqueda de lote;
- búsqueda de manzana;
- búsqueda de vía;
- filtros por capa y atributo;
- tabla de resultados;
- paginación;
- ordenamiento;
- total de resultados;
- selección tabla → mapa;
- selección mapa → tabla;
- zoom al resultado;
- detalle de entidad;
- limpieza de filtros;
- estado sin resultados;
- selección de entidades superpuestas.

## Pruebas y aceptación

- Una búsqueda devuelve coincidencias correctas.
- Los filtros restringen API, tabla y mapa de forma consistente.
- Seleccionar una fila centra y resalta el mapa.
- Seleccionar el mapa refleja la fila cuando pertenece al conjunto actual.
- La paginación no descarga toda la base.
- Una consulta sin resultados no se muestra como error técnico.

**Salida:** el usuario puede encontrar una entidad y navegar desde sus atributos hasta su geometría.

---

# Fase 5 — Vista de administración e historial

## Objetivo

Entregar las funciones exclusivas del Administrador.

## Base de datos y scripts

Usar:

- `Usuarios`.
- `Roles`.
- `UsuariosRoles`.
- `MenuOpciones`.
- `UsuarioMenu`.
- tabla de auditoría de migraciones.
- tabla o mecanismo de eventos del sistema.
- scripts `07_Roles_Usuarios_Menu.sql` y `08_MenuOpciones_UsuarioMenu.sql`.

## Backend/API

Crear endpoints protegidos para:

- `GET/POST/PUT /api/admin/users`.
- activar y bloquear usuarios;
- asignar roles;
- `GET/PUT /api/admin/roles`;
- `GET /api/admin/layers/catalog`;
- `GET /api/admin/migrations`;
- `GET /api/admin/events`;
- reconstrucción de índices espaciales, si se habilita.

Cada endpoint debe validar autorización en servidor.

## Frontend

Consultar OpenPencil para las vistas administrativas e implementar:

- dashboard;
- usuarios;
- perfiles y permisos;
- catálogo de capas;
- historial de migraciones;
- bitácora de eventos;
- información del sistema;
- accesos rápidos según permisos.

## Pruebas y aceptación

- El Administrador puede gestionar usuarios.
- El Consultor no puede acceder a administración.
- Los cambios de estado de usuario se aplican al login.
- El historial muestra datos reales de migración.
- Los eventos relevantes son consultables.

**Salida:** el sistema puede administrarse sin acceso directo a SQL Server.

---

# Fase 6 — Responsive, pruebas y entrega

## Frontend

Verificar en OpenPencil y en navegador real:

- 360 px;
- 768 px;
- 1366 px.

Validar:

- menú lateral;
- mapa como área principal;
- controles táctiles;
- panel de resultados;
- tablas sin desplazamiento horizontal obligatorio;
- textos legibles;
- estados de error y carga.

## Backend y base de datos

Ejecutar pruebas de:

- autorización;
- exposición de datos sensibles;
- paginación;
- límites de consulta;
- GeoJSON;
- migración transaccional;
- rollback;
- geometrías inválidas;
- CRS;
- relaciones espaciales;
- auditoría.

## Documentación

Completar:

- manual de instalación;
- configuración de SQL Server;
- preparación de `DatosSIG/`;
- ejecución de scripts;
- variables de entorno;
- creación del primer usuario;
- manual de usuario;
- matriz requisito → prueba → evidencia;
- procedimiento de demostración.

## Criterio final

El proyecto se considera entregable cuando:

- la aplicación funciona con datos reales;
- los cuatro conjuntos están disponibles;
- login y autorización funcionan;
- el visor consume API y GeoJSON;
- búsquedas y filtros sincronizan mapa y tabla;
- el Administrador puede revisar usuarios, migraciones y eventos;
- el sistema funciona en escritorio, tablet y móvil;
- existe evidencia reproducible de los criterios funcionales.

---

# Resumen de trabajo por vista

| Vista | Base de datos | Backend | Frontend | Resultado |
|---|---|---|---|---|
| Login y acceso | Usuarios, roles, permisos | Sesión, login, autorización | Login, rutas protegidas, menú | Acceso seguro por perfil |
| Migración | Tablas espaciales, auditoría | SHP, CRS, preview, transacción | Wizard de carga | Datos reales en SQL Server |
| Visor | Capas e índices espaciales | Catálogo y GeoJSON | Leaflet y leyenda | Mapa funcional |
| Búsqueda | Campos e índices oficiales | Filtros, paginación, búsqueda | Tabla y sincronización | Consulta mapa-tabla |
| Administración | Usuarios, roles, logs | CRUD protegido e historial | Dashboard y administración | Operación controlada |
| Entrega | Integridad y trazabilidad | Pruebas y seguridad | Responsive y documentación | Sistema demostrable |
