# Atribuciones

Este repo se publica bajo MIT (ver [`LICENSE`](LICENSE)), salvo los archivos de
terceros que se listan abajo. Cada uno conserva la licencia de su autor original.

## agent-flow

`agent-flow/app.js.pristine` y `agent-flow/webview-index.js.pristine` son copias
**textuales y sin modificar** del `dist/` de
[`agent-flow-app`](https://github.com/patoles/agent-flow) **0.9.1**, de patoles,
licenciado **Apache License 2.0**.

`agent-flow/agent-flow.patch` es una **obra derivada**: el diff de mis cambios
sobre esos dos archivos. No lleva el código original, solo las modificaciones,
pero como deriva de la obra Apache-2.0 se distribuye bajo la misma licencia.

El texto completo de la licencia está en
[`LICENSE-Apache-2.0.txt`](LICENSE-Apache-2.0.txt).

El `LICENSE` de upstream es el texto Apache-2.0 sin línea de copyright rellenada,
así que no hay titular que citar más allá del proyecto mismo.

> Licensed under the Apache License, Version 2.0 (the "License"); you may not
> use these files except in compliance with the License. You may obtain a copy
> of the License at
>
>     http://www.apache.org/licenses/LICENSE-2.0
>
> Unless required by applicable law or agreed to in writing, software
> distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
> WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
> License for the specific language governing permissions and limitations
> under the License.

`agent-flow/rig/` y `agent-flow/hook.js` son míos y van bajo MIT.

## skills/ponytail, ponytail-audit, ponytail-help, ponytail-review

De [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail),
licenciadas **MIT**.

> MIT License
>
> Copyright (c) 2026 DietrichGebert

## skills/task-observer

*"One Skill to Rule Them All"*, de **Eoghan Henn** /
[rebelytics.com](https://rebelytics.com), licenciada
**[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)**: se puede compartir
y adaptar dando crédito al autor. Fuente canónica:
[rebelytics/one-skill-to-rule-them-all](https://github.com/rebelytics/one-skill-to-rule-them-all).

## Herramientas que el bootstrap instala pero no redistribuye

`bootstrap/bootstrap.sh` baja estos paquetes de sus fuentes oficiales. No viajan
en este repo y conservan la licencia de sus autores:
`@anthropic-ai/claude-code`, `agent-flow-app`, [`context-mode`](https://github.com/mksglu/context-mode),
`omniroute`, `playwright`, `tavily-cli`, `codebase-memory-mcp` y
[`rtk`](https://github.com/rtk-ai/rtk).
