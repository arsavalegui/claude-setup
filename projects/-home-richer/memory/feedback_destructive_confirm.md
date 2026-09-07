---
name: Confirmar antes de comandos destructivos
description: Reglas estrictas para preguntar antes de borrar volúmenes, hacer force push, rm, etc.
type: feedback
originSessionId: 2b801d2d-a364-4bd3-9043-a14f24a450be
---
**Antes de cualquier comando destructivo, preguntar primero** —
incluso cuando el recurso parece "obviamente expendable" (volúmenes
recién creados en intentos fallidos, etc.).

- **Why:** regla no negociable explícita en el plan de lemut_n8n.
  Lista del usuario: `rm`, `docker volume prune`, `git push --force`.
  Aplicar también a: `docker compose down -v`, `git reset --hard`,
  `git checkout -- <file>`, `rm -rf`, drop tables, `git branch -D`,
  amend a commits publicados.
- **How to apply:** usar `AskUserQuestion` con dos opciones (proceder
  / detenerse) y describir qué se va a borrar. No asumir que "el
  usuario ya entendió que vamos a borrar X" — confirmar siempre.

Ejemplo real: cuando postgres falló por `.env` malformado y los
volúmenes quedaron con init vacío, NO bastaba con saber que eran
volúmenes recién creados de este mismo intento — había que preguntar
antes de `docker compose down -v` y el usuario lo apreció.
