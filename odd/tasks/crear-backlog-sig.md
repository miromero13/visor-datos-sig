# Corrección del backlog Jira SIG — solo historias

## Solicitud autorizada
El usuario indicó que no había solicitado épicas, sino historias de usuario con el formato `Como… / Quiero… / Para… / Criterios de Aceptación`. Confirmó explícitamente corregir todo, eliminar las 14 épicas y dejar las historias sin padres.

## Trabajo completado
1. **Reformatear historias:** completado para SIG-15–SIG-103 (89 historias). Títulos y descripciones están en español; cada descripción usa `Como:`, `Quiero:`, `Para:` y `Criterios de Aceptación:`, preserva los criterios y referencias RF/RNF/CA y deja decisiones abiertas explícitas.
2. **Desasociar de épicas:** al borrar las épicas, Jira desvinculó automáticamente las historias y las conservó.
3. **Eliminar épicas:** completado. Eliminadas SIG-1–SIG-14 con autorización explícita.
4. **Verificación:** Jira devuelve 89 issues, todas tipo `Historia`, claves SIG-15–SIG-103. Dos consultas cubrieron la lista completa; las 89 descripciones contienen los cuatro encabezados requeridos y no tienen padre asociado. Se releen ejemplos SIG-15, SIG-30, SIG-59 y SIG-103. SIG-14 ya no existe; SIG-103 persistió tras eliminar esa épica.

## Límites
- No se crearon funcionalidades ni historias adicionales durante la corrección.
- Las historias deseables y condicionales siguen señaladas como tales.
- No se asignaron responsables ni estimaciones.
- No se modificaron código, documentación fuente, datos GIS ni scripts SQL.
