---
name: Entorno de la máquina
description: Stack del sistema (CachyOS + Omarchy), hardware, quirks de sudo, herramientas instaladas
type: user
originSessionId: 2b801d2d-a364-4bd3-9043-a14f24a450be
---
- **OS:** CachyOS (Arch) con **Omarchy** (entorno Hyprland).
- **Teclado:** Ajazz AK820 Pro — layout 75% (tiene `PrtSc` dedicada, no
  necesita `Fn`).
- **Editores instalados:** VS Code (`visual-studio-code-bin` del AUR,
  `/usr/bin/code`), `nvim`, `vim`, `micro`, `nano`. No usa IDEs de
  JetBrains ni Cursor/Zed.
- **Screenshots:** Flameshot instalado (`pkexec pacman -S flameshot`),
  binding **`Ctrl`+`Q`** en `~/.config/hypr/bindings.conf` con wrapper
  `XDG_CURRENT_DESKTOP=sway flameshot gui` (necesario en Wayland).

## Quirk crítico: sudo sin TTY no funciona
- **No tiene `NOPASSWD` configurado** en sudoers. `sudo` falla desde la
  herramienta Bash con: *"a terminal is required to read the password"*.
- **Solución:** usar `pkexec <comando>` en lugar de `sudo`. Polkit
  muestra un diálogo gráfico al usuario para meter su contraseña. Ya se
  confirmó que funciona para `pacman -S`, `pacman -U`, etc.
- Para comandos interactivos (ej. `gh auth login`) pedirle al usuario
  que pegue `!<comando>` en el prompt — `!` ejecuta en su shell con TTY.
