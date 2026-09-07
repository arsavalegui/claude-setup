---
name: project-cimat-rest-mex
description: "Proyecto final diplomado CIMAT — Rest-Mex 2025, transfer learning para reseñas turísticas; repo arsavalegui/cimat-rest-mex"
metadata: 
  node_type: memory
  type: project
  originSessionId: 45c89990-7be8-4e96-adf4-74d826d4ad5d
  modified: 2026-08-28T09:49:47.867Z
---

Proyecto final del Diplomado en Cómputo de Soluciones Avanzadas (CIMAT), iniciado 2026-08-27. Profesor: Angel Ramón Aranda Campos (arac@cimat.mx) — acepta envíos de salidas en cualquier momento para retro preliminar.

- Tarea: por cada reseña turística predecir polaridad (1–5), tipo de lugar (Hotel/Restaurant/Attractive) y Pueblo Mágico (40 clases). Reto REST-MEX 2025.
- Local: `~/Projects/cimat-rest-mex` (venv en `.venv`, datos en `data/` fuera de git, se bajan con gdown — IDs en el README).
- Repo GitHub: arsavalegui/cimat-rest-mex (público, para portafolio). Enunciado en `docs/enunciado_proyecto.pdf`.
- Datos: train 208,051 filas (CSV), test 89,166 (xlsx, sin etiquetas); muy desbalanceado (polaridad 5 ≈ 136k vs polaridad 1 ≈ 5.4k). Versión reducida MeIA en `data/Datos-MeIA-Reto-01/`.
- Salida requerida: .txt tab-separado `TaskName\tID\tPolaridad\tPueblo\tTipo`.
- Avance 2026-08-28: EDA hecho (notebooks/01_eda.ipynb). BETO fine-tuneado en CPU con MeIA reducido: F1 macro 0.559 en polaridad (models/polaridad-meia, fuera de git). Primer .txt en salidas/meia_polaridad.txt — pendiente que el usuario lo mande al profe.
- notebooks/02_colab_completo.ipynb: entrena las 3 tareas con el corpus completo en Colab T4 (~2.5–3 h) y genera rest-mex_final.txt (89,166 líneas); respalda modelos y salida en MyDrive/cimat-rest-mex/ y al re-ejecutar se salta tareas ya entrenadas. Pendiente: correrlo en Colab.
- CPU local (Ryzen 5600H, iGPU Vega sin ROCm) no alcanza para el corpus completo (~18 h/época).
- Fecha de entrega final: desconocida, preguntar al profe.
