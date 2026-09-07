---
name: economia-de-tokens
description: "Si escasean tokens/cuota, delegar a modelos baratos y avisar al usuario para bajar modelo con /model"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b2d7b7e1-ee81-4804-9c16-0299910fa3f1
  modified: 2026-08-30T15:01:51.803Z
---

Instrucción del usuario (2026-08-30): si los tokens empiezan a escasear, no detenerse — moverse a modelos más baratos para que el trabajo siga.

**Why:** prefiere continuidad del trabajo sobre usar siempre el modelo más grande.

**How to apply:** yo no puedo auto-cambiarme de modelo (eso es `/model` del usuario). En su lugar: (1) delegar el trabajo pesado a subagentes en Sonnet/Haiku (ya es el default de su config); (2) usar context-mode para mantener outputs grandes fuera de contexto; (3) si veo aviso de cuota/límite, decirle explícitamente que teclee `/model sonnet` o `/fast`; (4) los modelos de Ollama locales NO sirven como reemplazo mío — son para los bots de sus proyectos. Ver [[modo-bypass-permisos]].
