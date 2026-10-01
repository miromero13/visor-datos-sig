# Importación de las capas SHP

## Preparación en QGIS

1. Cargue cada conjunto SHP desde `DatosSIG/`:
   `Exp_CodigoFijo_4326`, `Exp_MapaBase_LOTES_4326`,
   `Exp_MapaBase_MZA_4326` y `Exp_MapaBase_VIAS_4326`.
2. Verifique que cada conjunto incluya `.shp`, `.shx`, `.dbf` y `.prj`.
3. Lea e interprete el `.prj` antes de importar o transformar coordenadas.
   El CRS de origen documentado para los datos es `EPSG:32720`; no lo asigne
   solamente por el nombre del archivo.
4. Una vez validado que el `.prj` declara `EPSG:32720`, se permite reproyectar
   automáticamente a `EPSG:4326` (SRID de destino 4326). No confunda el CRS
   de origen `EPSG:32720` con el SRID de destino `4326`, ni se limite a cambiar
   la etiqueta CRS sin transformar las coordenadas. Si el `.prj` falta, no se
   puede leer/validar o declara otro CRS, no aplique esta reproyección automática.
5. Importe a SQL Server mediante el complemento **MSSQL** o mediante
   `ogr2ogr`, asegurando que las geometrías almacenadas tengan SRID 4326.

La capa de manzanas de origen (antes de reproyectar) fue verificada con los siguientes datos:

- Registros: 863.
- Geometría: PolygonZ.
- Extensión X: 714920,702 a 721350,099.
- Extensión Y: 8185008,529 a 8190311,166.
- Sistema de coordenadas de origen: EPSG:32720.

## Correspondencia

| Archivo SHP en `DatosSIG/` | Tabla SQL | Geometría |
|---|---|---|
| `Exp_CodigoFijo_4326.shp` | CodigosFijos | Geom |
| `Exp_MapaBase_LOTES_4326.shp` | Lotes | Geom |
| `Exp_MapaBase_MZA_4326.shp` | Manzanas | Geom |
| `Exp_MapaBase_VIAS_4326.shp` | Vias | Geom |

## Inventario DBF verificado y mapeo inicial aprobado

Los conteos y descriptores siguientes corresponden a los encabezados/records inspeccionados. Tipo, ancho y decimales se muestran tal como están declarados en DBF.

| Archivo | Registros | Campo | Tipo, ancho, decimales |
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

| Capa → tabla SQL | Campos DBF → SQL | Geometría, identidad y derivaciones |
|---|---|---|
| `Exp_CodigoFijo` → `CodigosFijos` | `CodF_SQL` → `CodF_SQL`; `CodF_SIG` → `CodF_SIG`; `Longi` → `Longitud`; `Latid` → `Latitud`; `CodFijo` → `CodFijo`; `Nombre` → `Nombre`. `Text` no tiene columna destino. | `Geom` desde SHP; `Estado` y `FechaCambioEstado` por defaults; `IdLote` derivado espacialmente. |
| `Exp_MapaBase_LOTES` → `Lotes` | `Id` → `IdOrigen`; `NroLote` → `NroLote`. | `Geom` desde SHP; `IdManzana` derivado espacialmente; `IdLote` identity. |
| `Exp_MapaBase_MZA` → `Manzanas` | `Id` → `IdOrigen`; `UV_MZA` → `UV_MZA`; `UV` → `UV`; `MZA` → `MZA`. | `Geom` desde SHP; `IdManzana` identity. |
| `Exp_MapaBase_VIAS` → `Vias` | `OBJECTID` → `OBJECTID`; `Nombre` → `Nombre`; `type` → `TipoVia`; `OSMID` → `OSMID` con conversión a string. | `Geom` desde SHP; `IdVia` identity. `osm_id`, `name`, `ref`, `oneway`, `bridge`, `maxspeed` y `highway` quedan explícitamente source-only/sin mapear. `type` contiene clasificaciones de vía; `highway` es binario/nulo-like y no es una fuente segura para `TipoVia`. |

No se infieren destinos para campos no listados. El mapeo inicial aún debe validar valores, truncamiento y nulabilidad en runtime.

Todas las geometrías almacenadas deben tener SRID 4326:

```sql
SELECT TOP 10 Geom.STSrid, Geom.STIsValid(), Geom.STAsText()
FROM dbo.Manzanas;
```

Después de importar lotes y manzanas, establezca la relación espacial:

```sql
UPDATE l
   SET IdManzana=m.IdManzana
FROM dbo.Lotes l
JOIN dbo.Manzanas m
  ON l.Geom.STCentroid().STIntersects(m.Geom)=1
WHERE l.Geom IS NOT NULL AND m.Geom IS NOT NULL;
```

## Validaciones

```sql
SELECT 'CodigosFijos',COUNT(*) FROM dbo.CodigosFijos
UNION ALL SELECT 'Lotes',COUNT(*) FROM dbo.Lotes
UNION ALL SELECT 'Manzanas',COUNT(*) FROM dbo.Manzanas
UNION ALL SELECT 'Vias',COUNT(*) FROM dbo.Vias;

SELECT IdManzana FROM dbo.Manzanas
WHERE Geom IS NULL OR Geom.STIsValid()=0;
```

Conteos DBF verificados: `CodigosFijos` 6271, `Lotes` 15281, `Manzanas` 863 y `Vias` 578. El conteo esperado para `Manzanas` después de la importación es **863**; verificar también los otros conteos tras cargar y validar los datos.
