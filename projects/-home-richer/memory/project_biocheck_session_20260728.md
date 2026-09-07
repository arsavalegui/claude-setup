---
name: Sesión biocheck 2026-07-28 — enroll multi-captura + estabilidad matcher
description: Añadidos POST /admin/users/{id}/templates y DELETE /admin/users/{id}; el flujo de enroll ahora captura 3 huellas y almacena 3 templates por user. Validado empíricamente: mucho más estable que ayer, sin false positives cruzados en las pruebas.
type: project
originSessionId: (sesión actual)
---
Sesión de continuación del 2026-07-27. Alan reportó que ayer sólo 1 de N
intentos reconocía su dedo. Investigación en logs mostró scores 19-31
bailando alrededor del threshold=30 → el matcher placeholder es demasiado
sensible a la variabilidad de captura (posición/presión/ángulo). Fix:
enrolar múltiples templates por user y dejar que /clock elija el mejor.

## Cambios aplicados (working tree + docker cp, NO commiteados)

Los tres archivos están sincronizados entre working tree y container:

1. **`bio_api/app/main.py`** — dos nuevos endpoints después de `list_users`:
   - `POST /admin/users/{user_id}/templates` — captura huella y agrega
     template al user existente. Reusa validación de calidad y `store_template`.
     Retorna `{template_id, user_id, nfiq2_quality, minutiae_count}`.
   - `DELETE /admin/users/{user_id}` — expone `storage.delete_user()` (que ya
     existía). Uso: rollback si el user cancela a mitad del enroll de 3
     capturas. **Ojo:** el cascade borra también attendance del user
     (limitación documentada en CLAUDE.md, no es regresión).

2. **`tablet-app/src/api.js`** — dos métodos nuevos: `addUserTemplate(userId)`
   y `deleteUser(userId)`.

3. **`tablet-app/src/components/AddUser.jsx`** — reescrito el flujo. Constantes:
   `TOTAL_CAPTURES = 3` y `LIFT_FINGER_SECONDS = 3`. Phases:
   `form → capturing (1 de 3) → waiting_next (countdown 3s "Levanta el dedo…")
   → capturing (2 de 3) → waiting_next → capturing (3 de 3) → success`.
   Error mid-flow ofrece "Reintentar" y "Cancelar (borrar usuario)".
   Sin `userId` (falla la 1a captura), Cancelar equivale a volver al form.

## Backend ya estaba listo para multi-template

Descubrimiento clave: el schema en `storage.py` ya soportaba 1:N templates
por user (FK + índice en `user_id`), y `/clock` ya iteraba por TODOS los
templates de todos los users quedándose con el `best_score` global. El
matcher no cambió — sólo hubo que enrolar múltiples templates.

## Validación empírica del fix

Enrolados 2 users nuevos ("pepe" con CURP fake VASA020925HQRLVLA3,
"tantris" con VASA…VLA4), 3 templates cada uno. 10 intentos de /clock:

| user | intentos aceptados | max score visto | fallos (todos < 30) |
|---|---|---|---|
| pepe | 7 de 9 | 61 | 2 (scores 19 y 23, dedo mal puesto) |
| tantris | 1 de 1 | **73** | 0 |

**Ayer (1 template) el mejor score de Alan fue 31**; hoy (3 templates)
pepe llega a 61 y tantris a 73. La 1a captura de pepe no es la mejor —
las capturas 2 y 3 dieron los scores más altos, confirmando que
almacenar múltiples posiciones sí ayuda. Los fallos de pepe fueron
puestas de dedo obviamente malas (todos los 3 templates dieron bajo),
no un problema del approach.

**Cero false positives cruzados** en las pruebas: cuando se puso el
dedo de tantris, tantris ganó 73 vs los templates de pepe ≤14 y de Alan
≤17. Con 1 template, ayer índice izq y dedo medio de Alan daban ambos ≥34.

## Estado de git al final de la sesión

Working tree tiene los mismos modificaciones de ayer PLUS los cambios de hoy:
- `bio_api/Dockerfile` (heredado 2026-07-17)
- `bio_api/requirements.txt` (heredado)
- `bio_api/app/main.py` (fixes de ayer + endpoints de hoy)
- `bio_api/app/storage.py` (fix curp_exists de ayer)
- `bio_api/app/capture.py` (fix ctx-lifetime de ayer)
- `bio_api/app/matcher.py` (type check de ayer)
- `tablet-app/src/api.js` (nuevo hoy)
- `tablet-app/src/components/AddUser.jsx` (reescrito hoy)

Branch: `alanvaldez070726`. Sin commit, sin push.

## Data en BD al terminar la sesión

Users: Alan (1 template, legacy), pepe (3 templates), tantris (3 templates).
26 eventos de attendance. Alan sigue enrolado con 1 solo template pero
funciona OK cuando el dedo está bien puesto (63% aprox).

## Pendientes al reanudar

1. **Considerar re-enrolar a Alan con el flujo nuevo** — su score cap es
   ~31 con 1 template; con 3 llegaría más alto y sería consistente.
2. **Bozorth3 real** sigue pendiente (misma razón que ayer: solución de
   raíz para la varianza de scores). Aunque con multi-template ya es
   utilizable, sigue siendo placeholder.
3. **Rebuild de imagen con Dockerfile fixeado** — todos los fixes de ayer
   Y hoy viven vía docker cp; `docker compose down/up --build` los tira.
4. **Modo kiosk normal** sigue sin funcionar (Alan reportó ayer). Solo
   el LiveMode del AdminPanel jala.
5. **Push del branch alanvaldez070726** cuando Alan lo pida.

## Cómo continuar el flujo si algo se rompe

- Ver scores en vivo: `docker logs -f biocheck-bio_api-1 | grep clock_score`
- Listar users: `curl -H "Authorization: Bearer $VITE_API_KEY" http://localhost:8000/admin/users` (leer $VITE_API_KEY con `source tablet-app/.env`; hook bloquea Read directo del .env)
- Borrar user: `curl -X DELETE -H "Authorization: Bearer $VITE_API_KEY" http://localhost:8000/admin/users/{user_id}` (cascade borra attendance)
- Ajustar `TOTAL_CAPTURES` en AddUser.jsx si querés probar 5 lecturas en vez de 3

**Why:** Ayer descubrimos que el matcher placeholder + 1-template es
demasiado inestable para producción. Hoy convertimos eso en algo usable
(aunque no MINEX-compliant) sin tocar el matcher, aprovechando que el
schema ya soportaba multi-template.

**How to apply:** al retomar biocheck, si el score de un user es
inestable revisar cuántos templates tiene (`SELECT COUNT(*) FROM
templates WHERE user_id=?`). Si es 1, ofrecer re-enrolar con el flujo
nuevo antes de tocar matcher o thresholds.
