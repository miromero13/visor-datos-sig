# Plan de ejecución por fases — SIG

Esta guía convierte las issues actuales de Jira en una lista de trabajo ordenada. Seguí el orden propuesto y marcá cada casilla cuando la issue correspondiente cumpla sus criterios de aceptación en Jira.

Las fases siguen [`CONTEXT_PROJECT.md`](CONTEXT_PROJECT.md): la Fase 1 mantiene la migración y suma en paralelo una fundación temprana web/visor con datos sintéticos; la Fase 2 integra backend/API, datos migrados y flujos de producción. Los vínculos **Blocks / is blocked by** de Jira señalan dependencias directas. El orden de esta lista también considera esas dependencias.

**Dos clases de checklist:** las casillas con clave SIG corresponden exclusivamente a issues existentes de Jira y se marcan solo al cumplir sus criterios allí. La checklist web-foundation es trabajo nuevo de preparación de Fase 1, separado de Jira; completarla no cierra issues que requieren datos SQL/API reales. No se modifican issues ni sus criterios.

> **Importante sobre los RF:** `RF-*` son identificadores de requisitos funcionales definidos en [`FUNCTIONAL_REQUIREMENTS.md`](FUNCTIONAL_REQUIREMENTS.md); no son claves de issues ni, por sí mismos, indican qué tarea bloquea a otra. La sección “Functional Dependencies Not Yet Defined” señala decisiones que esperan el diseño físico y los datos oficiales. No inventes campos, claves naturales, relaciones ni reglas de reparación para completar esas issues.

## Fase 1 — Migración de datos geográficos

**Objetivo:** avanzar la migración de Manzanas, Lotes, Códigos Fijos y Vías hacia SQL Server con validación y trazabilidad, mientras se construye en paralelo una base demostrable de la web y el visor usando únicamente GeoJSON sintético claramente rotulado.

### Trabajo de preparación web/visor (no son issues Jira)

Completá estas tareas en orden. Son una línea temprana de preparación; no equivalen a aceptación de issues Jira ni a integración de producción.

1. [ ] **Crear la estructura de la aplicación y la ruta del visor.** Prepará un shell React + TypeScript con navegación hacia una página de visor.
2. [ ] **Montar un mapa Leaflet navegable.** Incorporá Leaflet y sus estilos; elegí un mapa base para el demo, respetá atribución y términos del proveedor.
3. [ ] **Crear fixtures GeoJSON sintéticos para las cuatro capas.** Usá polígonos para Manzanas y Lotes, puntos para Códigos Fijos y líneas para Vías. Identificalos como datos de prueba; no uses los SHP del repositorio hasta validar sus metadatos y CRS.
4. [ ] **Mostrar las capas mock con simbología y leyenda.** Cargá los cuatro fixtures, permití activar/desactivar cada capa y mantené sincronizados sus símbolos con la leyenda.
5. [ ] **Probar interacciones y estados del visor.** Implementá pan/zoom, encuadre de capa y selección demostrativa; mostrá estados locales de carga, vacío y error sin conectarte a la API.
6. [ ] **Verificar el diseño responsivo del demo.** Comprobá que mapa y controles sean utilizables a 360, 768 y 1366 px.

**Límite del prototipo:** este trabajo mock no es integración con API ni con datos reales de producción. No cierra ni marca como satisfechas las issues SIG cuyos criterios requieren datos SQL/API reales; esas integraciones y criterios permanecen en Fase 2.

### Issues Jira de migración

Hacé las issues en este orden. Antes de cerrar la migración, resolvé con el equipo las decisiones abiertas sobre el diseño físico oficial.

1. [x] **SIG-15 — Configurar y probar conexión a SQL Server.** Definí y configurá los parámetros de conexión; comprobá que una conexión inválida bloquee el inicio y muestre un error claro.
1. [ ] **SIG-16 — Seleccionar archivos fuente Shapefile.** Permití elegir una carpeta o archivos `.shp`; detectá y agrupá `.shx`, `.dbf` y `.prj`, e informá componentes faltantes.
1. [ ] **SIG-17 — Reconocer las capas geográficas oficiales.** Identificá Manzanas, Lotes, CodigosFijos y Vias; mostrale al operador los metadatos disponibles de cada capa.
1. [ ] **SIG-18 — Validar integridad de Shapefiles antes de cargar.** Comprobá archivos asociados, lectura y consistencia; detené la carga si faltan componentes requeridos o los datos no son compatibles.
1. [ ] **SIG-19 — Validar referencia espacial declarada.** Leé el `.prj` y verificá WGS 84 / SRID 4326; nunca asignes el SRID silenciosamente.
1. [ ] **SIG-20 — Previsualizar registros y mapeo de campos.** Mostrá al menos 20 registros (o los disponibles si hay menos), sus valores, geometría y mapeo antes de cargar.
1. [ ] **SIG-21 — Mapear campos DBF a columnas SQL.** Contrastá campos, tipos, claves, relaciones y nulabilidad con el diseño físico oficial; validá conversiones antes de insertar. **Esperá el diseño físico y los campos DBF oficiales.**
1. [ ] **SIG-22 — Elegir un modo seguro de migración.** Implementá reemplazo seguro y append; definí su comportamiento con el equipo y respetá las claves naturales oficiales. **No inventes esas claves.**
1. [ ] **SIG-25 — Validar y reportar geometrías por registro.** Detectá geometrías inválidas o vacías y registrá causa y registro; repará solo con reglas aprobadas.
1. [ ] **SIG-26 — Prevenir y reportar registros duplicados.** En append, detectá y contá duplicados usando la clave natural o regla oficial; registrá los omitidos. **Depende del diseño físico oficial.**
1. [ ] **SIG-23 — Cargar datos dentro de una transacción.** Cargá por lotes; confirmá solo una operación consistente y hacé rollback ante un error crítico o pérdida de conexión.
1. [ ] **SIG-24 — Persistir geometrías validadas con SRID 4326.** Guardá las geometrías con SRID 4326 y registrá reparaciones; rechazá o documentá las no reparables según una regla aprobada. **El tipo espacial y las reglas de reparación están pendientes de definición.**
1. [ ] **SIG-27 — Mostrar progreso y resultados de migración.** Mostrá capa y registros procesados, exitosos, omitidos y fallidos, además del avance.
1. [ ] **SIG-28 — Cancelar una migración de forma segura.** Permití detener el proceso sin datos parciales inconsistentes; revertí cuando corresponda y registrá la cancelación.
1. [ ] **SIG-29 — Registrar auditoría de migraciones.** Guardá fecha, usuario, archivo, capa, tabla, duración, conteos, advertencias y errores.
1. [ ] **SIG-30 — Exportar resumen de migración.** Permití exportar el resultado en TXT, CSV y PDF. **Alcance deseable; priorizalo después del flujo mínimo de migración.**
1. [ ] **SIG-31 — Crear o reconstruir índices espaciales.** Ofrecé la operación administrativa solo a usuarios autorizados. **Alcance deseable; confirmá tablas y salvaguardas con el diseño oficial.**

**Puerta de salida de la fase:** las cuatro capas se validan y quedan almacenadas en SQL Server con atributos y geometrías coherentes con el diseño oficial, y existe el demo temprano web/visor mock descrito arriba. El demo no sustituye las integraciones de producción ni permite cerrar issues dependientes de SQL/API.

## Fase 2 — Sistema web y visor SIG

**Objetivo:** completar backend/API de producción, autenticación, integración de datos reales migrados, búsqueda/filtros y flujos de resultados, además de los criterios de aceptación restantes del visor. Empezá las integraciones dependientes cuando estén disponibles y validados los datos de Fase 1. El prototipo mock de Fase 1 no cuenta como integración ni cierre de issues.

### 2.1 Identidad, permisos y seguridad

1. [ ] **SIG-32 — Iniciar sesión con usuario y contraseña.** Validá credenciales y creá una sesión únicamente para usuarios válidos.
1. [ ] **SIG-33 — Administrar perfiles Administrador y Consultor.** Definí los perfiles y sus permisos con el equipo; contrastalos con los roles existentes en los scripts SQL.
1. [ ] **SIG-34 — Aplicar autorización en el servidor.** Protegé cada operación; no dependas de ocultar opciones en la interfaz como control de acceso.
1. [ ] **SIG-81 — Administrar perfiles y permisos.** Implementá la asignación administrativa de permisos de acuerdo con la matriz aprobada. Revisá su posible solapamiento con la definición de perfiles anterior.
1. [ ] **SIG-35 — Cerrar una sesión de forma segura.** Invalidá la sesión al salir y bloqueá el acceso posterior a recursos protegidos.
1. [ ] **SIG-36 — Expirar sesiones inactivas.** Aplicá el período definido por el equipo; bloqueá solicitudes protegidas tras el vencimiento.
1. [ ] **SIG-38 — Administrar cuentas de usuario.** Permití crear, editar, activar, bloquear y asignar perfil a usuarios; definí el flujo de restablecimiento.
1. [ ] **SIG-39 — Cambiar mi contraseña.** Permití que Administrador y Consultor cambien sus credenciales con la política aprobada.
1. [ ] **SIG-37 — Registrar eventos de autenticación y acceso.** Registrá inicios de sesión exitosos y fallidos, cierres de sesión y operaciones administrativas relevantes.
1. [ ] **SIG-85 — Consultar mi perfil.** Permití que cada usuario autenticado consulte los datos de perfil disponibles y autorizados.
1. [ ] **SIG-80 — Mostrar navegación según el perfil autenticado.** Mostrá solo las opciones permitidas, manteniendo la autorización del servidor como control independiente.

### 2.2 Datos consultables y servicios API

1. [ ] **SIG-77 — Asociar atributos consultables a entidades geográficas.** Relacioná geometría y atributos usando únicamente campos y relaciones del diseño físico oficial.
1. [ ] **SIG-102 — Excluir información sensible de respuestas API.** Evitá exponer credenciales, cadenas de conexión, trazas internas y datos no autorizados en todas las respuestas.
1. [ ] **SIG-95 — Exponer API de catálogo de capas.** Publicá las capas disponibles y los metadatos acordados para que los clientes puedan descubrirlas.
1. [ ] **SIG-101 — Devolver GeoJSON válido con coordenadas longitud-latitud.** Validá `FeatureCollection`, `Feature`, `geometry`, `properties` y el orden de coordenadas.
1. [ ] **SIG-96 — Consultar una capa como GeoJSON.** Exponé la consulta acotada de capas, con `bbox` y filtros permitidos; aplicá límites para no cargar datos sin control.
1. [ ] **SIG-97 — Consultar entidad geográfica por identificador.** Exponé geometría y atributos autorizados de una entidad según la semántica oficial del identificador.
1. [ ] **SIG-98 — Buscar registros mediante la API.** Exponé búsquedas con paginación y la extensión geográfica de resultados cuando corresponda.
1. [ ] **SIG-99 — Ofrecer autenticación por API si la arquitectura lo requiere.** Confirmá primero si la arquitectura elegida necesita este endpoint. **Alcance condicional; no lo implementes hasta resolverlo.**
1. [ ] **SIG-100 — Exponer historial de migraciones mediante API protegida.** Publicá el historial registrado durante la migración y restringí el acceso al perfil autorizado.
1. [ ] **SIG-82 — Consultar el catálogo administrativo de capas.** Permití que Administrador consulte metadatos, estilos, campos visibles/buscables y extensión disponibles.
1. [ ] **SIG-83 — Consultar el historial de migraciones.** Mostrá fecha, archivo, tabla, cantidades, duración, errores y advertencias usando el historial disponible.
1. [ ] **SIG-84 — Consultar eventos relevantes del sistema.** Permití que Administrador revise los eventos de acceso, administración y migración.

### 2.3 Mapa y capas

1. [ ] **SIG-42 — Mostrar un mapa base gratuito compatible.** Elegí un proveedor compatible con Leaflet y respetá sus términos de uso.
1. [ ] **SIG-43 — Mostrar las cuatro capas temáticas.** Representá Manzanas, Lotes, CodigosFijos y Vias usando los datos publicados por la API.
1. [ ] **SIG-44 — Aplicar simbología diferenciada y consistente.** Usá representaciones adecuadas para polígonos, puntos y líneas; mantené coherencia entre mapa y leyenda.
1. [ ] **SIG-45 — Activar y desactivar capas temáticas.** Permití controlar las capas visibles y mantené legibles las combinaciones elegidas.
1. [ ] **SIG-46 — Mostrar una leyenda dinámica.** Actualizá la leyenda según las capas visibles y sincronizá sus símbolos con el mapa.
1. [ ] **SIG-47 — Navegar el mapa y consultar escala o coordenadas.** Incorporá zoom, desplazamiento y extensión completa; mostrá escala y coordenadas cuando corresponda.
1. [ ] **SIG-48 — Ajustar mapa a la extensión de una capa.** Permití centrar y ajustar el zoom a la cobertura de la capa elegida.
1. [ ] **SIG-50 — Informar carga y errores recuperables del mapa.** Mostrá estados de carga, fallas temporales y reintento cuando corresponda.
1. [ ] **SIG-52 — Conservar capas propias si falla el mapa base.** Evitá que una falla del proveedor bloquee el visor y mostrá un aviso no intrusivo cuando sea posible.
1. [ ] **SIG-51 — Mantener resaltada la entidad seleccionada.** Conservá el resaltado hasta seleccionar otra entidad o limpiar la selección.

### 2.4 Búsqueda, filtros e identificación

1. [ ] **SIG-53 — Buscar en campos autorizados.** Permití búsqueda general solo sobre campos aprobados para el diseño y los permisos.
1. [ ] **SIG-54 — Admitir coincidencias parciales de texto.** Agregá coincidencia parcial y tratamiento de mayúsculas cuando corresponda, sin ampliar campos autorizados.
1. [ ] **SIG-55 — Buscar códigos fijos y localizar entidades.** Permití buscar códigos fijos y llevar el resultado a su geometría, resaltándolo y mostrando sus atributos disponibles.
1. [ ] **SIG-56 — Buscar lotes usando campos oficiales.** Implementá la búsqueda con los campos de Lotes definidos en el diseño físico oficial.
1. [ ] **SIG-57 — Buscar manzanas usando campos oficiales.** Implementá la búsqueda con los campos de Manzanas definidos en el diseño físico oficial.
1. [ ] **SIG-58 — Buscar vías por nombre o campos autorizados.** Usá solo los campos de Vías confirmados por el diseño físico oficial.
1. [ ] **SIG-59 — Buscar personas si existen atributos oficiales.** Confirmá que existan esos atributos y su relación con geometrías antes de implementarlo. **Alcance condicional.**
1. [ ] **SIG-60 — Filtrar consultas por capa.** Permití elegir sobre cuál capa ejecutar la consulta.
1. [ ] **SIG-61 — Filtrar por atributos autorizados.** Ofrecé filtros solo para campos disponibles y permitidos para el perfil.
1. [ ] **SIG-62 — Combinar criterios de filtro cuando esté soportado.** Confirmá la decisión de interfaz y la semántica de combinación antes de implementarlo. **Alcance condicional según RF-FIL-003.**
1. [ ] **SIG-63 — Limpiar todos los filtros activos.** Permití borrar los filtros y volver al estado inicial acordado.
1. [ ] **SIG-64 — Indicar el estado de consulta y selección.** Mostrá cuándo hay búsquedas, filtros o selecciones activas.
1. [ ] **SIG-65 — Identificar entidades con clic o toque.** Permití seleccionar una geometría y consultar sus atributos visibles.
1. [ ] **SIG-66 — Resolver entidades superpuestas en el mapa.** Si coinciden entidades, permití elegir la deseada o revisar resultados agrupados por capa.
1. [ ] **SIG-67 — Mostrar detalles de la entidad seleccionada.** Presentá los atributos relevantes en un panel de detalle; mantené breves los popups.
1. [ ] **SIG-68 — Limpiar selección y resaltado.** Agregá una acción que quite la selección y su resaltado.

### 2.5 Resultados y sincronización mapa-tabla

1. [ ] **SIG-69 — Mostrar resultados de consultas en una tabla.** Presentá los resultados de búsquedas y filtros con los campos disponibles y autorizados.
1. [ ] **SIG-70 — Paginar los resultados.** Agregá paginación coordinada con la API para revisar conjuntos grandes.
1. [ ] **SIG-71 — Mostrar el total de resultados.** Informá la cantidad total de entidades encontradas.
1. [ ] **SIG-72 — Ordenar resultados por campos permitidos.** Permití ordenar por los campos y sentidos autorizados.
1. [ ] **SIG-73 — Sincronizar fila seleccionada con el mapa.** Al elegir una fila, localizá su geometría, ajustá el mapa y resaltala.
1. [ ] **SIG-74 — Reflejar en la tabla la selección del mapa.** Si la entidad está en los resultados actuales, resaltá o localizá su fila.
1. [ ] **SIG-75 — Mostrar estado vacío cuando no hay resultados.** Diferenciá una consulta sin coincidencias de un error y permití ajustar o limpiar filtros.
1. [ ] **SIG-49 — Ajustar mapa a la extensión de resultados.** Permití encuadrar conjuntamente los resultados actuales; definí el comportamiento cuando no haya resultados.
1. [ ] **SIG-76 — Exportar resultados filtrados a CSV.** Permití exportar los resultados alfanuméricos filtrados, respetando campos autorizados. **Alcance deseable.**

### 2.6 Administración, ayuda y visualización opcional

1. [ ] **SIG-40 — Mostrar resumen del sistema en el dashboard.** Mostrá un resumen basado únicamente en datos disponibles y métricas acordadas.
1. [ ] **SIG-41 — Ofrecer accesos rápidos según permisos.** En el dashboard, ofrecé accesos al visor y a consultas; condicioná las funciones administrativas a permisos.
1. [ ] **SIG-87 — Consultar información del sistema.** Agregá una sección “Acerca del sistema” con la información disponible y aprobada.
1. [ ] **SIG-78 — Mostrar simbología temática si existen atributos oficiales.** Confirmá primero que los datos tengan atributos adecuados y que exista una correspondencia aprobada de estilos. **Alcance condicional.**
1. [ ] **SIG-79 — Mostrar contexto territorial disponible.** Implementalo solo si el diseño oficial confirma campos, relaciones y cardinalidades. **Alcance condicional.**
1. [ ] **SIG-86 — Acceder al manual de usuario.** Documentá navegación, búsquedas, filtros, interpretación del mapa y funciones principales; este manual también se necesita para la verificación de instalación reproducible.

### 2.7 Adaptación responsiva y cierre

1. [ ] **SIG-88 — Adaptar funciones principales a tamaños de pantalla.** Verificá los anchos de referencia 360 px, 768 px y 1366 px.
1. [ ] **SIG-89 — Adaptar el menú lateral al dispositivo.** Hacé que el menú se pueda contraer en escritorio y sea utilizable en móvil.
1. [ ] **SIG-90 — Adaptar el panel de resultados a pantallas pequeñas.** Reorganizalo sin impedir el uso del mapa.
1. [ ] **SIG-91 — Evitar desplazamiento horizontal obligatorio en 360 px.** Comprobá los flujos principales en móvil.
1. [ ] **SIG-92 — Ofrecer controles táctiles utilizables.** Verificá que los controles puedan operarse cómodamente por toque.
1. [ ] **SIG-93 — Mantener texto legible en tamaños admitidos.** Revisá legibilidad sin exigir zoom manual.
1. [ ] **SIG-94 — Conservar el mapa como área principal.** Asegurá que paneles, menús y controles no oculten permanentemente información relevante.
1. [ ] **SIG-103 — Verificar instalación reproducible y trazabilidad.** Seguí el manual desde un entorno limpio, vinculá requisitos con pruebas y guardá evidencia verificable.

**Puerta de salida de la fase:** el sistema web consulta las capas migradas, aplica autorización en servidor, permite los flujos principales de mapa/búsqueda/resultados y funciona en los tamaños de pantalla acordados.

## Cómo marcar el avance

- Marcá una casilla solo después de cumplir los criterios de aceptación de su issue en Jira.
- Si una tarea está bloqueada por datos, decisiones o archivos oficiales pendientes, dejala sin marcar y registrá el bloqueo en la issue correspondiente.
- Al cambiar el alcance o el orden, actualizá también las dependencias en Jira para que este documento y el tablero no diverjan.
