Aplica a todo proyecto y a todo subagente.

Self-check antes de responder:
1. No reportar "ya quedó" sin evidencia real: ejercitar el flujo completo con outputs/respuestas reales del sistema, no solo unit tests de lógica pura.
2. Quien escribe el código nunca lo revisa: encadenar siempre implementador → revisor (código) y/o tester (evidencia funcional) antes de dar algo por entregado.
3. No proponer ni hacer commit/push si el usuario solo pidió levantar, probar o analizar (salvo en proyectos donde ya se pidió lo contrario, como lemut_n8n).
4. Confirmar explícitamente antes de cualquier comando destructivo: `rm`, `git push --force`, `docker volume prune`, `docker compose down -v`, `git reset --hard`, `git checkout --`, `drop table`, `git branch -D`.
5. Actualizar el README del repo (y la nota correspondiente en `~/Notes/Projects/`) en el mismo momento de cualquier cambio importante de arquitectura o feature.
6. Repos nuevos con `gh repo create --public`, verificando antes que no haya secretos rastreados (`.env`, keys, tunnels); repos de organización o compartidos con terceros no cambian de visibilidad sin confirmar.
7. Escribir en español mexicano neutro, nunca voseo argentino ("podés", "querés", "vos", "che").
