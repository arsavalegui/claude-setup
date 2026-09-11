---
name: project_innolab_fhir_iac
description: "Innovation Lab FHIR Accelerator (Slalom LATAM): estado real (todo manual) y draft de despliegue Terraform + GitHub escrito 2026-09-11 en el vault"
metadata:
  type: project
---

Innovation Lab FHIR Accelerator (Slalom/Stryker LATAM, Fabric + Azure Health Data Services). Al 2026-09-11 TODO está desplegado a mano: sub "Monterrey Azure Innovation Lab", RG `rg-fabriconfhir`, FHIR `latam-fhirservice-dev`, storage `msftstacqcdb5enjrq4`/`export-landing-zone`, KV `msft-kv-acqcdb5enjrq4`, workspace Fabric `569624e6-b89c-46e3-b336-45b2d715d594`, lakehouse `healthcare2_msft_bronze`, eventstream `fhir_eventstream`, eventhouse `fhir_eventhouse`, Data Agent `Asistente_Analitico_Hospitalario`, front `healthcare-agent` (React+MSAL, scaffold). Repo canónico `slalom-fhir-fabric-accelerator` v0.2 NO está en esta Mac. Notas fuente en `~/Notes/` (Innovation Lab FHIR Accelerator, FHIR accelerator architecture, FHIR listener design decisions, FHIR Data Agent).

**Why:** Alan pidió (2026-09-11) cómo desplegar TODO con Terraform + GitHub; se escribió el draft `~/Notes/Innovation Lab IaC deployment draft.md` (dos roots: `infra/azure` azurerm+azuread, `infra/fabric` provider microsoft/fabric v1.13 GA; contenido de items por Fabric Git integration en `fabric/workspace/`; seed `$import` Synthea + smoke KQL; GitHub Actions OIDC sin secretos). Nada subido a GitHub, solo la nota.

**How to apply:** Verificado con docs oficiales: provider Fabric cubre workspace, lakehouse+schemas, notebook, data pipeline, environment, eventhouse/kql, shortcuts, `fabric_data_agent` (v1.10, ~may-2026, inmaduro), `fabric_workspace_git` (GitHub solo con `ConfiguredConnection` creada una vez en portal). Sin ruta IaC: acelerador "Healthcare data solutions" (portal) y semantic models (solo data source). azurerm: `azurerm_fabric_capacity`, `azurerm_healthcare_workspace`, `azurerm_healthcare_fhir_service` GA. IDU/labeling/AI translator (nota 2026-09-10) es otro programa, no el lab. Ver [[project_fhir_agent_poc]] (POC local distinto, Postgres+Ollama).
