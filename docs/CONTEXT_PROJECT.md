# VisorDatosSIG

## Contexto del proyecto

**VisorDatosSIG** es un sistema orientado a la migración, administración y consulta de información geográfica mediante una aplicación web responsiva.

El proyecto parte de información geográfica proporcionada en archivos **ESRI Shapefile (SHP)** correspondientes a cuatro conjuntos principales: **Manzanas, Lotes, Códigos Fijos y Vías**. El sistema requiere trabajar con **WGS 84 (SRID 4326)**; cada archivo debe validarse mediante su `.prj` y no se debe asumir su referencia espacial por el nombre del archivo.

La solución permitirá procesar estos archivos, validar su estructura y posteriormente almacenar la información en una base de datos espacial **SQL Server 2022**, respetando el diseño físico definido para el proyecto.

Una vez almacenados los datos, estos serán publicados mediante servicios backend que permitirán realizar consultas espaciales y alfanuméricas. La información geográfica será enviada principalmente en formato **GeoJSON**, permitiendo que el frontend pueda representarla sobre un mapa interactivo.

El sistema contará con autenticación y manejo de usuarios con diferentes niveles de acceso, principalmente los perfiles **Administrador** y **Consultor**.

El Administrador tendrá acceso a funciones de gestión como usuarios, perfiles, historial de migraciones y bitácoras, mientras que el Consultor estará orientado principalmente al uso del visor, consultas, búsquedas y filtros.

El visor cartográfico permitirá visualizar las diferentes capas geográficas y realizar operaciones como:

- Activar y desactivar capas.
- Visualizar una leyenda dinámica.
- Buscar entidades por sus atributos.
- Aplicar filtros sobre los datos.
- Identificar elementos directamente desde el mapa.
- Mostrar los atributos de una geometría seleccionada.
- Sincronizar los resultados entre el mapa y una tabla.
- Realizar zoom hacia una entidad seleccionada.
- Consultar información desde computadoras, tablets y dispositivos móviles.

La arquitectura del sistema estará separada en diferentes responsabilidades, evitando que el frontend acceda directamente a la base de datos. Todas las operaciones relacionadas con SQL Server deberán realizarse a través del backend.

El flujo de producción será:

**Archivos SHP → Migrador → SQL Server → Backend/API → GeoJSON → Frontend → Leaflet**

En paralelo, durante la Fase 1 se construirá una base temprana del frontend y del visor usando GeoJSON sintético claramente identificado. Ese prototipo no consume datos reales ni reemplaza el flujo de producción. Los archivos SHP se usarán como fuente de importación una vez resueltas y validadas sus referencias espaciales.

## Tecnologías

| Área | Tecnología | Justificación |
|---|---|---|
| Backend | **C# + .NET 10 + ASP.NET Core 10 Web API** | Se utilizará la tecnología establecida por el docente para implementar los servicios, autenticación, reglas del sistema y consultas espaciales. |
| Base de datos | **SQL Server 2022** | Permitirá almacenar tanto los atributos como las geometrías utilizando los tipos espaciales `geometry` o `geography`, además de índices espaciales. |
| Acceso a datos | **Entity Framework Core** | Facilitará la comunicación entre ASP.NET Core y SQL Server, manteniendo una capa de acceso a datos organizada y utilizando consultas seguras. |
| Procesamiento geográfico | **NetTopologySuite** | Permitirá trabajar desde .NET con geometrías y realizar la lectura y procesamiento de información proveniente de archivos SHP. |
| Intercambio geográfico | **GeoJSON** | Será el formato utilizado para transportar geometrías y atributos entre el backend y el visor web. |
| Frontend | **React + TypeScript** | Se utilizará React en lugar de Razor para construir una interfaz más modular, interactiva y fácil de mantener. |
| Mapas | **Leaflet** | Permitirá representar las capas GeoJSON, marcadores, polígonos, líneas, controles de navegación e interacción con las geometrías. |
| Estilos | **CSS responsivo** | Permitirá adaptar el sistema a escritorio, tablet y dispositivos móviles. |
| Control de versiones | **Git** | Permitirá organizar el trabajo del equipo, mantener historial de cambios y trabajar mediante ramas. |
| Entorno backend | **Visual Studio 2026** | Es el entorno solicitado para crear, compilar y ejecutar la solución .NET. |

### ¿Por qué utilizar React en el frontend?

Aunque la especificación original propone ASP.NET Core MVC con Razor para la interfaz web, se utilizará **React con TypeScript** como capa de presentación y **ASP.NET Core Web API** como backend.

React resulta apropiado para este proyecto debido a que el visor posee una alta cantidad de interacciones dinámicas. El usuario podrá activar capas, seleccionar geometrías, realizar búsquedas, modificar filtros, actualizar tablas de resultados y navegar por el mapa sin necesidad de recargar completamente la página.

Además, React permite dividir la interfaz en componentes independientes como:

`Map`, `LayerControl`, `Legend`, `SearchPanel`, `FilterPanel`, `ResultsTable`, `EntityDetail` y `UserManagement`.

Esta separación mejora la organización y mantenibilidad del frontend.

La utilización de **TypeScript** también permite trabajar con estructuras bien definidas para las respuestas recibidas desde la API, incluyendo entidades, capas, filtros y objetos GeoJSON.

La arquitectura quedaría separada de la siguiente manera:

**React + Leaflet → ASP.NET Core Web API → SQL Server 2022**

De esta forma se conserva la tecnología backend solicitada para el proyecto y únicamente se desacopla la capa de presentación.

Esta decisión tecnológica deberá quedar documentada como parte de la arquitectura del proyecto.

# Fases del proyecto

## Fase 1 — Migración y fundación temprana del visor

La Fase 1 mantendrá la migración como un frente de trabajo y sumará, en paralelo, una base tangible para la aplicación web y el visor. El trabajo temprano del visor usará exclusivamente GeoJSON sintético o mock, claramente rotulado; no se asumirán los SHP disponibles como fixtures válidos hasta resolver sus metadatos y CRS.

Se desarrollará un **Migrador SHP-SQL Server** encargado de recibir los archivos:

**Manzanas.shp, Lotes.shp, CodigosFijos.shp y Vias.shp**

El migrador deberá comprobar que cada conjunto contenga correctamente sus archivos asociados `.shp`, `.shx`, `.dbf` y `.prj`.

También deberá verificar que la información utilice **WGS 84 / SRID 4326**, analizar los atributos disponibles y establecer el mapeo entre los campos de los archivos DBF y las columnas correspondientes en SQL Server.

Antes de realizar una migración se mostrará una vista previa de los datos. Posteriormente, la información será cargada por lotes utilizando transacciones para evitar que errores durante el proceso produzcan datos parciales o inconsistentes.

Durante la migración se registrará información como:

- Archivo procesado.
- Tabla destino.
- Registros procesados.
- Registros exitosos.
- Registros omitidos.
- Registros con errores.
- Duración de la migración.
- Advertencias e incidencias.

### Resultado y puerta de salida de la Fase 1

La fase entrega dos resultados paralelos:

- **Migración:** las cuatro capas geográficas quedan validadas y almacenadas en **SQL Server 2022**, con atributos, geometrías, relaciones, SRID e índices coherentes con el diseño oficial.
- **Fundación web/visor:** una shell React + TypeScript y un mapa Leaflet muestran GeoJSON sintético para cuatro tipos temáticos de geometría/capa; incluyen visibilidad de capas, simbología y leyenda, pan/zoom/selección, estados locales de carga/vacío/error y diseño comprobado a 360, 768 y 1366 px.

El prototipo con datos mock no constituye integración con API ni con datos de producción y no cierra issues Jira cuyos criterios exigen datos SQL/API reales. Los pendientes dependientes de integración permanecen abiertos para la Fase 2.

**Flujos de la fase:**

`SHP + SHX + DBF + PRJ → Validación → Mapeo → Migración → SQL Server 2022`

`GeoJSON sintético → React + TypeScript → Leaflet (prototipo temprano, sin API)`

## Fase 2 — Backend/API de producción e integración del sistema web

La segunda fase completará el sistema web conectado a los datos reales migrados. Incluye backend/API, autenticación y autorización, integración de datos de producción, búsqueda/filtros y flujos de resultados, además de los criterios restantes de aceptación del visor. El prototipo mock de Fase 1 no sustituye ni anticipa el cumplimiento de esas integraciones.

Se desarrollará un backend utilizando **ASP.NET Core 10 Web API**, encargado de acceder a SQL Server y proporcionar los servicios necesarios para autenticación, usuarios, capas, búsquedas, filtros e información geográfica.

Las geometrías serán enviadas hacia el frontend principalmente mediante **GeoJSON**.

El frontend será desarrollado utilizando **React + TypeScript**, mientras que **Leaflet** será utilizado para construir el visor cartográfico.

El visor permitirá representar las cuatro capas:

**Manzanas, Lotes, Códigos Fijos y Vías.**

Además, permitirá realizar búsquedas, filtros, identificación mediante clic sobre el mapa, navegación geográfica y sincronización entre las entidades representadas en el mapa y la tabla de resultados.

También se implementará el sistema de autenticación y autorización para diferenciar las funcionalidades disponibles para los perfiles **Administrador** y **Consultor**.

La interfaz deberá ser responsiva y funcionar correctamente en computadoras, tablets y teléfonos móviles.

### Resultado y puerta de salida de la Fase 2

Al finalizar esta fase se contará con un sistema web SIG conectado a los datos reales de SQL Server mediante la API, con autenticación/autorización, búsquedas, filtros, resultados sincronizados y el resto de los criterios de aceptación del visor. La integración real y las issues que la requieren solo se consideran completas al cumplir sus criterios Jira; el prototipo mock no las cierra.

**Flujo de la fase:**

`SQL Server 2022 → ASP.NET Core Web API → GeoJSON real → React + TypeScript → Leaflet`

## Arquitectura general

**FASE 1 — DOS FRENTES EN PARALELO**

`Archivos SHP → Migrador .NET → SQL Server 2022`

`GeoJSON sintético → React + TypeScript → Leaflet (visor demostrativo, sin API)`

El prototipo usa datos claramente identificados como sintéticos; no representa las capas oficiales ni acredita integración con producción.

**FASE 2 — INTEGRACIÓN DE PRODUCCIÓN**

`SQL Server 2022 → ASP.NET Core Web API → JSON / GeoJSON real → React + TypeScript → Leaflet`

**Usuario Administrador / Consultor**