# Servicios en macOS (launchd)

Equivalentes de las units de systemd. `bootstrap.sh` copia estos plists a
`~/Library/LaunchAgents/`, sustituye `__HOME__` por el `$HOME` real y los carga con
`launchctl bootstrap gui/$(id -u)`.

launchd no tiene `Restart=on-failure`. El equivalente es `KeepAlive` con
`SuccessfulExit=false`, que es lo que usan estos tres plists.

| Servicio | Plist | Nota |
|---|---|---|
| agent-flow | `com.alan.agent-flow.plist` | Puerto 3001 |
| centro-mando | `com.alan.centro-mando.plist` | Puerto 3002 |
| omniroute | `com.alan.omniroute.plist` | En Linux está `inactive` a propósito, se levanta a mano |

## Los dos que NO tienen plist

**ollama**: en macOS se instala con `brew install ollama` y se levanta con
`brew services start ollama`. No escribas un plist a mano, brew ya trae el suyo.

**mic-meeting-recorder**: no funciona en macOS tal cual. El script depende de
`pactl` de PipeWire para detectar cuándo se activa el micrófono, y mezcla el audio
del sistema con `-f pulse -i <sink>.monitor`. macOS no expone el audio del sistema:
hay que instalar un dispositivo de loopback tipo
[BlackHole](https://github.com/ExistentialAudio/BlackHole), crear un Multi-Output
Device en Audio MIDI Setup y cambiar la detección de `pactl` por CoreAudio. Es
trabajo de código, no de infraestructura. Mientras tanto el grabador se queda solo
en Linux.
