# Perfiles por máquina

Un archivo `.env` por máquina, nombrado con el hostname corto (`hostname -s`).
`bootstrap.sh` busca `bootstrap/machines/$(hostname -s).env` y, si existe, lo carga
antes de instalar nada. Si no existe, sigue con los valores por defecto y avisa.

Aquí van **solo** las cosas que cambian de una máquina a otra: el nombre de la
fuente de audio del micrófono, qué servicios se habilitan, dónde vive ollama.
Nunca tokens, webhooks ni llaves de API. Esos se quedan en el llavero del sistema
o en el `.env` del proyecto que los ocupa, fuera de este repo.

## Variables que reconoce bootstrap.sh

| Variable | Para qué |
|---|---|
| `MIC_SOURCE` | Fuente de PipeWire del micrófono integrado. Se inyecta en la copia instalada de `mic-meeting-recorder`. Vacío = no se toca el script. En Mac acepta además `auto` (default, detecta el headset Corsair en cada grabación), `corsair` o `mac`. |
| `SERVICES_ENABLE` | Lista separada por espacios de los servicios a habilitar y arrancar. |
| `OLLAMA_BIN` | Ruta del binario de ollama, solo informativa para el reporte final. |

## Archivos actuales

- `cachyos-richer.env` — la laptop de Alan, CachyOS + Omarchy.
- `ejemplo-mac.env` — plantilla para macOS, con la explicación de por qué el
  grabador de juntas no cruza a Mac sin un loopback tipo BlackHole.

## Cómo agregar una máquina nueva

```bash
cp bootstrap/machines/ejemplo-mac.env "bootstrap/machines/$(hostname -s).env"
$EDITOR "bootstrap/machines/$(hostname -s).env"
```

Para sacar el nombre real del micrófono en Linux:

```bash
pactl list short sources | grep -i input
```
