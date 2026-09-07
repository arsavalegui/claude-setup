---
name: Vault de Obsidian
description: Ubicación y estructura del vault personal de notas (~/Notes/)
type: reference
originSessionId: aa895bce-fafd-44bb-b842-fd4b25242de8
modified: 2026-09-05T01:56:01.300Z
---
Vault personal de Obsidian en `/home/richer/Notes/`. Obsidian 1.12.7 desde repo `extra`. Atajo Omarchy: `SUPER SHIFT + O`.

## Estructura (reorganizada 2026-09-04)

```
Notes/
├── Index.md                          # navegación principal
├── Projects/
│   ├── <proyecto>.md                 # notas índice (Framework Bot, lemut_n8n, biocheck, huella_interop_poc)
│   ├── lemut_n8n/                    # dictados/notas del bot (telegram, whatsapp, pagos...)
│   ├── fhir-agent-poc/
│   ├── tiktok-edits/
│   ├── cimat-rest-mex/
│   └── varios/                       # lo que no encaja (vuelos, etc.)
├── Meetings/                         # SOLO juntas reales de huella/biocheck
│   ├── _template.md
│   └── YYYY-MM-DD - Título.md
└── Reference/
    └── entorno-maquina.md
```

## Convenciones
- Todo en español.
- Enlaces internos usan `[[Projects/lemut_n8n]]` (path completo).
- Tags por proyecto: biocheck→[meeting,biocheck,huella]; huella-interop→[meeting,huella-interop,huella]; resto→[nota,<lemut-n8n|fhir-poc|tiktok-edits|cimat>].
- Sin emojis en el vault.
- mic-meeting-recorder CLASIFICA solo (línea `PROYECTO:` que Claude responde) y rutea la nota a su carpeta con tags; biocheck/huella-interop además se postean a Discord vía webhook (~/.config/mic-meeting-recorder/discord_webhook — PENDIENTE que el usuario pegue la URL). Fallback: Meetings/.

## Cuando el usuario mencione algo relevante para un proyecto en una junta o sesión

Considera actualizar la nota del proyecto en `Projects/` con la información nueva, en vez de sólo memoria interna. El vault es la fuente de verdad personal del usuario.
