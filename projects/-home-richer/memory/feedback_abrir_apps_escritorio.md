---
name: c-mo-abrir-apps-en-el-escritorio-del-usuario-hyprland
description: No lanzar el navegador (rompe su sesión); abrir apps con setsid y moverlas al workspace pedido; el usuario tiene sesiones iniciadas
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9c1d9717-cde0-4b97-870c-5cc0d95ee83f
  modified: 2026-08-29T04:27:47.143Z
---

Al usuario le gusta que le abra proyectos/apps en un escritorio (workspace) específico
de Hyprland, pero hay reglas que aprendí a la mala el 2026-08-28:

**Why:** lancé `google-chrome-stable --new-window` mientras su Chrome ya corría con
sesión iniciada → salieron 7 popups "Profile error occurred" y se enredó todo. Se
frustró ("su puta madre"). Además `hyprctl dispatch exec "[workspace N] ..."` NO
enganchó para VS Code (Electron) ni a veces Alacritty.

**How to apply:**
- **NUNCA lanzar su navegador.** Él tiene las sesiones iniciadas (GitHub, etc.); si
  lanzo Chrome/Chromium peleo con su perfil. Darle la URL para que la abra él, o si
  ya hay una ventana suya, moverla con `movetoworkspacesilent`. Ojo: repos privados
  dan 404 si el perfil no está logueado.
- **VS Code y terminal SÍ los abro yo**, pero con `setsid <app> ... >/dev/null 2>&1 < /dev/null &`
  (no con la regla `[workspace N]` de hyprctl, que falla con Electron), y luego
  moverlas: `hyprctl dispatch movetoworkspacesilent "N,address:0x..."` filtrando por
  título del proyecto para no tocar sus otras ventanas (tiene VS Code/terminales de
  cimat, huella, biocheck en otros workspaces — NO cerrarlas ni moverlas).
- **No usar `closewindow` a lo loco** — cerré ventanas del POC sin querer.
- Necesita `export XDG_RUNTIME_DIR="/run/user/$(id -u)"` para que hyprctl funcione
  desde el shell del agente.
