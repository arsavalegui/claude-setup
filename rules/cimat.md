---
paths:
  - "**/cimat-rest-mex/**"
---
Delega a `desarrollador` PRIMERO. No hay skill instalada para este stack.

Self-check antes de entregar:
1. Los datos no van al repo (`data/*.csv`, `data/*.xlsx`, `data/Datos-MeIA-Reto-01/` en `.gitignore`); se bajan con `gdown` dentro de `data/` usando los IDs listados en `README.md`.
2. Ambiente en `.venv` (también gitignored): usar `.venv/bin/python` o `.venv/bin/pip`, no instalar paquetes global.
3. El corpus completo (208,051 filas de entrenamiento) no se entrena en la máquina local (Ryzen 5600H, iGPU Vega sin ROCm, ~18h/época); ese flujo va en `notebooks/02_colab_completo.ipynb` sobre GPU T4 de Colab.
4. Las clases están muy desbalanceadas (polaridad 5 ≈ 136k filas vs polaridad 1 ≈ 5.4k); reportar F1 macro, no accuracy simple.
5. La salida final es un `.txt` separado por tabuladores con columnas `TaskName`, `ID`, `Polaridad`, `Pueblo Mágico`, `Tipo` (formato exacto en `README.md`), no CSV ni JSON.
6. `models/`, `checkpoints/`, `runs/`, `*.pt`, `*.safetensors` están en `.gitignore`; no forzar el commit de pesos entrenados.
7. Solo existe el modelo de polaridad (`models/polaridad-meia`); `predecir.py` copia Town/Type del propio test para la versión reducida (MeIA), pero el reto completo (Rest-Mex) todavía necesita entrenar los modelos de pueblo y tipo.
