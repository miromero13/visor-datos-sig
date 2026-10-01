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

Esta tabla solo documenta capa-tabla; no define correspondencias entre campos DBF y columnas SQL. No se debe inferir ese mapeo.

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

El conteo esperado para `Manzanas` después de la importación es **863**.
