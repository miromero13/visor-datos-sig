# Guía de pruebas: web y aplicación móvil

## 1. Con qué credenciales entrar

| Usuario | Contraseña inicial | Rol | Para qué usarlo |
| --- | --- | --- | --- |
| `admin` | `Admin123!` | `Administrador` | Probar todas las vistas web y crear operadores. |
| `Pedro` | `Pedro123!` | `Cortador` | Asignarle cortes desde la web y ejecutarlos en Android. |
| `Juan` | `Juan123!` | `Lecturador` | Revisar el acceso con un usuario no administrador. No usarlo como operador de cortes o reconexiones. |
| `reconexion_prueba` | `Recon123!` | `Reconexion` | Probar reconexiones en Android, después de crear esta cuenta en la web según el apartado 2.2. |

Las tres primeras son las cuentas de los scripts iniciales. Si su contraseña fue cambiada, usá la vigente. `reconexion_prueba` es una cuenta de prueba que hay que crear; no viene cargada inicialmente.

## 2. Pruebas en la web

### 2.1. Inicio de sesión y acceso por rol

**Entrar con:** `admin` / `Admin123!` en `http://localhost:5173/login`, o en `/login` de la dirección donde esté publicada la web.

1. Escribí el usuario y la contraseña y enviá el formulario.
2. Revisá que se abra el entorno autenticado y aparezcan los accesos a **Inicio**, **Visor de mapa**, **Asignación de cortes**, **Asignación de reconexiones**, **Seguimiento de personal**, **Consultas**, **Migración** y **Administración**.
3. Cerrá sesión y probá una contraseña incorrecta: debe mostrarse un error sin permitir el ingreso.
4. Entrá con `Juan` / `Juan123!`. Revisá que no aparezcan **Migración** ni **Administración** y que tampoco pueda abrirlas ingresando `/migration` o `/admin/users` directamente.
5. Volvé a entrar como `admin` para las siguientes pruebas.

### 2.2. Administración: usuarios y roles

**Entrar con:** `admin` / `Admin123!`.

**Vista:** **Administración** (`/admin/users`).

1. En **Usuarios**, buscá `admin`, `Pedro` y `Juan`. Revisá sus nombres, roles y estados. Probá también el filtro de usuarios activos e inactivos.
2. Hacé clic en **Nuevo Usuario** y completá:
   - **Login / Usuario:** `reconexion_prueba`.
   - **Nombre Completo:** `Operador de reconexión de prueba`.
   - **Contraseña Inicial:** `Recon123!`.
   - **Roles Asignados:** `Reconexion`.
3. Presioná **Crear Usuario**. Revisá que aparezca en el listado como activo y con el rol elegido. Si esa cuenta ya existe, usala con su contraseña vigente en lugar de crearla otra vez.
4. Abrí sus detalles, cambiá el nombre y presioná **Guardar cambios**. Volvé a abrirlo y comprobá que se conservó el cambio.
5. Probá **Suspender acceso** sobre esta cuenta de prueba e intentá iniciar sesión con ella: no debe poder ingresar. Desde la sesión de `admin`, usá **Reactivar acceso** y comprobá que vuelva a entrar.
6. En **Roles**, revisá `Administrador`, `Catastro`, `Lecturador`, `Cortador` y `Reconexion`.
7. Para probar el alta de roles, usá **Nuevo Rol**, ingresá `RolPrueba` y una descripción, y presioná **Crear Rol**. Abrí sus detalles, editá la descripción y comprobá que **Guardar cambios** la conserve. No modifiques los roles operativos para esta prueba.

### 2.3. Inicio: tablero de operaciones

**Entrar con:** `admin` / `Admin123!`.

**Vista:** **Inicio** (`/dashboard`).

1. Revisá las tarjetas de conexiones y los estados **Normal**, **Para corte**, **Cortado**, **Baja parcial** y **Baja total**.
2. Compará las cantidades del gráfico de anillo con las tarjetas. No tomes un total fijo como requisito: depende de los datos cargados.
3. Revisá la barra de avance diario y sus cantidades de completados, observados y pendientes.
4. Probá **Asignar cortes**, **Asignar reconexiones**, **Visor de mapa**, **Monitoreo** y **Consultas espaciales**. Cada acceso debe abrir su vista correspondiente.
5. Anotá los contadores de hoy para compararlos después de registrar una ejecución desde Android.

### 2.4. Visor de mapa: búsqueda, capas y vistas 2D/3D

**Entrar con:** `admin` / `Admin123!`.

**Vista:** **Visor de mapa** (`/map`).

1. En **Buscar**, escribí un código fijo existente o parte del nombre de su titular. Seleccioná un resultado y comprobá que el mapa lo ubique y permita consultar sus datos.
2. Hacé clic sobre un elemento del mapa y revisá que los datos mostrados correspondan al elemento seleccionado.
3. En **Capas**, activá y desactivá **Manzanas**, **Lotes**, **Vías** y **Códigos Fijos**. Comprobá que cada capa aparezca y desaparezca sin ocultar las demás.
4. Cambiá el **Mapa base** y revisá que las capas operativas sigan visibles.
5. Elegí **Vista 3D · Terreno**. Mové **Orientación** e **Inclinación 3D** y comprobá el cambio de perspectiva. Probá **Orientar al norte** y **Restablecer (60°)**.
6. Volvé a **Vista 2D (0°)** y comprobá que se recupere la vista plana.
7. En **Leyenda**, compará los colores con las capas activas y los estados de los suministros.
8. Probá acercar, alejar, centrar y activar la pantalla completa.
9. Usá **Exportar vista actual como PNG** y abrí la imagen descargada. Probá **Imprimir vista actual** y revisá la vista previa de impresión.

### 2.5. Asignación de cortes

**Entrar con:** `admin` / `Admin123!`.

**Vista:** **Asignación de cortes** (`/assignments/cuts`).

1. En **Configuración**, elegí a `Pedro` como **Operador asignado**.
2. Revisá su carga de trabajo de hoy y elegí una **Cantidad de órdenes** pequeña, por ejemplo `3`.
3. Marcá el punto de partida en el mapa. Como alternativa, probá el campo para pegar un enlace de Google Maps o coordenadas.
4. Presioná **Calcular ruta óptima**. Debe aparecer el recorrido y sus paradas numeradas. Revisá cualquier aviso de falta de suministros disponibles o de cálculo de ruta.
5. Abrí **Paradas** y compará el orden, los códigos y la cantidad con los marcadores del mapa.
6. Presioná **Guardar asignación** una sola vez y comprobá el mensaje con el número de asignación y el operador.
7. Abrí **Historial** y verificá que figure la asignación guardada. Anotá su número y uno de sus códigos fijos para las pruebas móviles.
8. Actualizá la página y revisá que siga en el historial.
9. Probá calcular sin punto de partida: debe solicitarlo. Si no hay suministros **Para corte** disponibles, comprobá el aviso; no lo confundas con una asignación guardada.

### 2.6. Asignación de reconexiones

**Entrar con:** `admin` / `Admin123!`.

**Vista:** **Asignación de reconexiones** (`/assignments/reconnections`).

1. Elegí a `reconexion_prueba`, creado en el apartado 2.2, como operador.
2. Indicá una cantidad pequeña de órdenes, marcá el punto de partida y presioná **Calcular ruta óptima**.
3. Revisá las paradas y los suministros **Cortado** disponibles para reconectar. Si no hay disponibles, debe mostrarse el aviso correspondiente.
4. Presioná **Guardar asignación** y comprobá que aparezca en **Historial**.
5. Anotá el número de asignación y un código fijo para probar su ejecución con la cuenta de reconexión en Android.

### 2.7. Seguimiento de personal y reproducción del recorrido

**Entrar con:** `admin` / `Admin123!`.

**Vista:** **Seguimiento de personal** (`/monitoring`).

1. En **Filtros**, seleccioná la fecha de la prueba, el operador, el **Tipo de actividad** y el **Despacho asignado**.
2. Revisá que el mapa muestre las paradas del despacho seleccionado.
3. Después de iniciar la ruta desde Android y desplazarte con el GPS activo, revisá los puntos de seguimiento recibidos para ese operador y fecha.
4. Presioná **Iniciar reproducción**, pausá y reiniciá el recorrido.
5. Probá las velocidades `1x`, `2x` y `4x`, y las pausas de `1 s`, `3 s` y `5 s`.
6. Mové la línea de tiempo y comprobá que cambien la posición del marcador y la etapa mostrada.
7. Abrí **Estados** y compará las etapas con las paradas y ejecuciones del despacho.
8. Cambiá de operador o despacho y comprobá que la información corresponda a la nueva selección. Un despacho sin telemetría no demuestra seguimiento GPS real, aunque permita visualizar o reproducir sus paradas.

### 2.8. Consultas y exportación

**Entrar con:** `admin` / `Admin123!`.

**Vista:** **Consultas** (`/queries`).

1. Seleccioná una **Capa** y buscá un código, nombre, lote o vía existente.
2. Probá los filtros disponibles para esa capa, como estado o tipo de vía. Comprobá que las filas coincidan con lo buscado.
3. Cambiá de página cuando haya suficientes resultados y revisá que no se repitan las mismas filas por un fallo de paginación.
4. Presioná **Ver en mapa** en un resultado y comprobá que abra el elemento correspondiente.
5. Elegí una capa concreta, abrí **Exportar** y descargá **Página actual** en **Excel** y en **PDF**. Abrí los archivos y compará sus filas con la página consultada.
6. Repetí con **Todos los resultados**. Revisá que incluya el conjunto filtrado y no solamente la página visible.
7. Probá una búsqueda sin coincidencias: debe mostrar que no hay resultados, sin conservar filas de la consulta anterior.

### 2.9. Reportes personalizados y plantillas

**Entrar con:** `admin` / `Admin123!`.

**Vista:** **Consultas** → **Exportar** → **Reporte personalizado…**.

1. Elegí la capa y, en **Columnas**, seleccioná los campos que querés incluir.
2. Configurá **Filtros**, **Agrupar y ordenar** y **Formato**.
3. Revisá **Vista previa** y comprobá que corresponda a las columnas y filtros elegidos.
4. Exportá en PDF o Excel y abrí el archivo. Revisá columnas, filtros, orden y formato.
5. Usá **Guardar plantilla** para conservar una configuración de prueba. Volvé a abrirla y comprobá que recupere sus opciones.
6. Modificá esa plantilla y probá **Guardar cambios** y **Guardar como nueva**. Verificá que la segunda opción cree otra plantilla sin reemplazar la original.
7. Eliminá únicamente una plantilla de prueba y comprobá que desaparezca del listado después de confirmar.

### 2.10. Migración de capas

**Entrar con:** `admin` / `Admin123!`.

**Vista:** **Migración** (`/migration`). Hacé las pruebas que escriben datos únicamente sobre una base de demostración que puedas recuperar.

1. Presioná **Seleccionar componentes** y elegí los archivos `.shp`, `.shx`, `.dbf` y `.prj` de una de las capas aprobadas que muestra la pantalla.
2. Presioná **Validar archivos**. Revisá los resultados por capa, los registros, la proyección y los errores o advertencias mostrados.
3. Probá seleccionar una capa sin uno de sus componentes y validarla: debe informar el problema y no habilitar una migración válida.
4. Volvé a seleccionar los componentes completos. Después de una validación correcta, elegí **Agregar a los datos existentes** o **Reemplazar datos existentes**, según la prueba, y presioná **Ejecutar migración**. **Reemplazar** sustituye los datos existentes de las capas importadas.
5. Comprobá el resultado de la operación y revisá los registros importados en **Consultas** y **Visor de mapa**.
6. Para probar **Simular 5 estados de código fijo**, abrí el diálogo y elegí primero **Cancelar**: los estados deben conservarse.
7. Solo en la base de demostración recuperable, repetí y elegí **Confirmar simulación**. Revisá los totales por estado en el resultado, las consultas y el mapa. Esta acción sobrescribe los estados de **todos** los códigos fijos y no tiene deshacer.

### 2.11. Perfil y cierre de sesión

**Entrar con:** una cuenta de prueba propia, por ejemplo `reconexion_prueba` / `Recon123!`.

**Vista:** **Perfil** (`/profile`).

1. Abrí el perfil desde el menú de usuario y comprobá el nombre y el login.
2. En **Cambiar contraseña**, probá una confirmación diferente y una contraseña de menos de ocho caracteres: deben mostrarse los errores sin guardar el cambio.
3. Ingresá la contraseña actual y una nueva de al menos ocho caracteres, con su confirmación correcta. Guardá y comprobá el mensaje de éxito.
4. Cerrá sesión: la contraseña anterior debe dejar de permitir el ingreso y la nueva debe funcionar tanto en web como en Android.
5. Si querés seguir usando los ejemplos de esta guía, restaurá la contraseña inicial de esa cuenta desde su propio perfil, usando la nueva como contraseña actual.
6. Cerrá sesión e intentá abrir `/dashboard`: debe solicitar autenticación.

## 3. Pruebas en Android

### 3.1. Inicio de sesión

**Entrar con:** `Pedro` / `Pedro123!` para cortes. Para reconexiones, usá `reconexion_prueba` / `Recon123!` después de crearla en la web, o su contraseña vigente si la cambiaste.

1. Abrí la aplicación, completá **Usuario** y **Contraseña** y tocá **Ingresar al sistema →**.
2. Comprobá que aparezcan el nombre y el rol del usuario correcto.
3. Probá primero una contraseña incorrecta: debe mostrar un error sin abrir la lista de tareas.
4. Ingresá con la contraseña correcta y comprobá que se carguen las asignaciones de ese operador para hoy.

### 3.2. Lista de tareas y recarga

**Entrar con:** `Pedro` / `Pedro123!`, después de asignarle cortes desde la web para hoy.

1. Deslizá la lista hacia abajo para recargarla.
2. Compará los códigos fijos y el orden de las paradas con la asignación guardada en la web.
3. Revisá los contadores de **Pendientes**, **Completadas** y **Observadas**.
4. Abrí una tarjeta y comprobá que su detalle corresponda al código y al titular elegidos.
5. Para una cuenta sin asignaciones de hoy, comprobá el mensaje **No tenés paradas asignadas para hoy.**

### 3.3. Inicio y detención del seguimiento GPS

**Entrar con:** el operador que tenga la asignación de prueba.

1. Activá la ubicación del teléfono y tocá **Iniciar ruta**. Aceptá los permisos solicitados para ubicación y notificaciones.
2. Revisá que la cabecera cambie a **GPS activo (20s)** y el botón a **Detener**.
3. Desplazate con el teléfono y comprobá los puntos recibidos en **Seguimiento de personal** de la web para ese operador y fecha.
4. Tocá **Detener** y revisá que la app muestre **Ruta en pausa**.

### 3.4. Detalle de parada y navegación

**Entrar con:** el operador al que se le asignó la parada.

1. Abrí una tarea pendiente y revisá su número, tipo de actividad, código fijo y titular.
2. Tocá **NAVEGAR**. Comprobá que se abra una aplicación de navegación con el destino de esa parada.
3. Volvé a la app, tocá **OBTENER GPS** y aceptá el permiso de ubicación. Revisá las coordenadas y la precisión obtenida.
4. Si el GPS no puede obtener una posición, revisá el error en lugar de dar la captura por realizada.

### 3.5. Fotografía y lectura del medidor

**Entrar con:** el operador asignado; abrir el detalle de una parada pendiente.

1. Tocá **TOMAR FOTO DEL MEDIDOR** y aceptá el permiso de cámara.
2. Enfocá los dígitos de un medidor y tocá **Capturar Foto**.
3. Revisá la imagen y el indicador **Foto capturada**.
4. Comprobá el campo **Lectura actual del medidor (m³)**. Si el OCR no reconoce bien los dígitos, corregí la lectura manualmente.
5. Probá **VOLVER A TOMAR FOTO** y comprobá que la nueva imagen reemplace la anterior.

### 3.6. Registrar un corte

**Entrar con:** `Pedro` / `Pedro123!`.

1. Abrí una parada de corte pendiente de la asignación preparada en la web.
2. Obtené el GPS, tomá la fotografía y revisá la lectura del medidor.
3. Seleccioná **CORTADO**, completá una observación si corresponde y tocá **REGISTRAR EJECUCIÓN**.
4. Con conexión, comprobá que regrese a la lista y que la tarea figure como **Cortado**, disminuya el contador de pendientes y aumente el de completadas.
5. Actualizá la web y buscá ese código fijo: debe pasar a **Cortado**. Revisá también su ejecución en el despacho correspondiente y los contadores del tablero.

### 3.7. Registrar una reconexión

**Entrar con:** `reconexion_prueba` / `Recon123!`, o su contraseña vigente, después de asignarle reconexiones para hoy desde la web.

1. Cerrá la sesión del cortador e ingresá con la cuenta de reconexión.
2. Recargá la lista y comprobá que muestre las tareas del nuevo operador.
3. Abrí una parada de reconexión pendiente, obtené el GPS y registrá la fotografía y la lectura.
4. Seleccioná **RECONECTADO** y tocá **REGISTRAR EJECUCIÓN**.
5. Revisá la tarea como **Reconectado** en Android y, después de actualizar la web, comprobá que el suministro quede en estado **Normal**.

### 3.8. Registrar una visita observada

**Entrar con:** el operador que tenga la parada de prueba.

1. Abrí otra parada pendiente y seleccioná **OBSERVADO**.
2. Dejá **Observación en campo** vacía e intentá registrar: debe pedir el motivo sin completar la operación.
3. Agregá un motivo, por ejemplo `Casa cerrada`, escribiéndolo o usando una observación rápida.
4. Tocá **REGISTRAR EJECUCIÓN** y comprobá que la tarea quede **Observado** y aumente el contador de observadas, no el de completadas.
5. Revisá en la web que se conserve la observación y no se dé el suministro por cortado o reconectado exitosamente.

### 3.9. Trabajo sin conexión y sincronización

**Entrar con:** un operador con tareas pendientes ya descargadas.

1. Con conexión, recargá las tareas y anotá un código fijo pendiente.
2. Desactivá Wi-Fi y datos móviles, manteniendo la ubicación activada.
3. Abrí esa tarea, completá el resultado y tocá **REGISTRAR EJECUCIÓN**.
4. Comprobá que el resultado se conserve en la lista local y aparezca **Cola offline** con una ejecución pendiente. No debe darse por recibido en la web todavía.
5. Recuperá la conexión y tocá **Sincronizar** si la cola sigue visible.
6. Comprobá que disminuya la cola y que, después de actualizar la web, aparezca el resultado del mismo código fijo.
7. Recargá Android y la web y verificá que la tarea no vuelva a figurar pendiente ni se duplique la ejecución.

### 3.10. Perfil y cierre de sesión

**Entrar con:** el operador de prueba.

1. Tocá el avatar de la cabecera para abrir **Mi Perfil**. Revisá nombre, login y rol.
2. En **Cambiar contraseña**, probá una confirmación diferente y una nueva contraseña de menos de ocho caracteres: deben mostrarse errores sin cambiarla.
3. Para probar un cambio válido, completá la contraseña actual, una nueva de al menos ocho caracteres y su confirmación; tocá **Guardar contraseña**.
4. Tocá **Cerrar sesión** y comprobá que vuelva al ingreso. Entrá con la nueva contraseña y verificá que también funcione en la web.
5. Si cambiaste la contraseña de una cuenta de esta guía, restaurala desde su perfil antes de repetir las pruebas con las credenciales iniciales.
