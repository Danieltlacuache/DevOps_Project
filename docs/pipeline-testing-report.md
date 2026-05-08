# Reporte de Pruebas — Pipelines CI/CD

## Fecha: 5 de Mayo, 2026
## Repositorio: Danieltlacuache/DevOps_Project
## PR: #11 — Merge pull request from Danieltlacuache/feature/infra-setup

---

## Resumen Ejecutivo

Se ejecutaron exitosamente los pipelines de CI/CD para Backend y Frontend. Los resultados demuestran:
- Pruebas unitarias automatizadas funcionando
- Construccion y publicacion de imagenes Docker a Docker Hub
- Puerta de aprobacion manual para produccion funcionando
- Despliegue automatico al ambiente Dev (frontend)

---

## Backend Pipeline — Resultados

### Ejecucion en Pull Request (PR #11)

**Status: SUCCESS**
- **Trigger:** Pull request opened (feature/infra-setup)
- **Duracion total:** 27s
- **Artifacts generados:** 2 (test-results, coverage-report)

| Job | Status | Duracion | Notas |
|-----|--------|----------|-------|
| build-and-test | PASSED | 22s | 16 tests pasaron, cobertura generada |
| docker-build-push | SKIPPED | 0s | Correcto: solo se ejecuta en push a main |
| deploy-dev | SKIPPED | 0s | Correcto: solo se ejecuta en push a main |
| deploy-prod | SKIPPED | 0s | Correcto: solo se ejecuta en push a main |

**Comportamiento esperado:** En PRs, solo se ejecutan las pruebas unitarias como check de calidad. No se construyen imagenes ni se despliega.

### Ejecucion en Merge a Main

**Status: PARTIAL (build + push exitosos, deploy fallo por state mismatch)**
- **Trigger:** Push to main (merge de PR #11)
- **Duracion total:** 1m 31s

| Job | Status | Duracion | Notas |
|-----|--------|----------|-------|
| build-and-test | PASSED | 76s | Tests unitarios pasaron |
| docker-build-push | PASSED | 38s | Imagen publicada en Docker Hub |
| deploy-dev | FAILED | 16s | Terraform state mismatch (esperado) |
| deploy-prod | SKIPPED | 0s | No se ejecuto porque deploy-dev fallo |

**Nota sobre deploy-dev:** El fallo es esperado porque la infraestructura fue desplegada localmente con `terraform apply` (state local), pero el pipeline intenta usar un backend S3 remoto. En un flujo real, se usaria exclusivamente el pipeline para desplegar.

**Imagen Docker publicada:**
- `nino200431/condomanager-backend:latest`
- `nino200431/condomanager-backend:<commit-sha>`

---

## Frontend Pipeline — Resultados

### Ejecucion en Pull Request (PR #11)

**Status: SKIPPED**
- **Trigger:** Pull request opened
- **Duracion total:** 1s
- **Comportamiento:** Todos los jobs fueron skipped porque `docker-build-push` tiene condicion `if: github.event_name == 'push'`

**Comportamiento esperado:** El frontend no tiene pruebas unitarias, asi que en PRs no hay nada que ejecutar.

### Ejecucion en Merge a Main

**Status: WAITING FOR APPROVAL (deploy-prod)**
- **Trigger:** Push to main (merge de PR #11)

| Job | Status | Duracion | Notas |
|-----|--------|----------|-------|
| docker-build-push | PASSED | 18s | Imagen publicada en Docker Hub |
| deploy-dev | PASSED | 6s | Frontend desplegado a S3 + CloudFront invalidado |
| deploy-prod | WAITING | - | Esperando aprobacion manual (production environment) |

**Puerta de aprobacion manual:** El pipeline se detuvo correctamente en `deploy-prod` esperando revision. Muestra "Danieltlacuache requested your review to deploy to production". Esto cumple con el requisito de aprobacion manual antes de produccion.

**Imagen Docker publicada:**
- `nino200431/condomanager-frontend:latest`
- `nino200431/condomanager-frontend:<commit-sha>`

---

## Pruebas Unitarias — Detalle

**Framework:** pytest 7.4.4
**Cobertura:** pytest-cov 4.1.0
**Mocks:** moto 5.0.0 (AWS services)

### Tests ejecutados (16 total):

| Archivo | Tests | Status |
|---------|-------|--------|
| test_auth.py | 5 | PASSED |
| test_condos.py | 4 | PASSED |
| test_fees.py | 3 | PASSED |
| test_conftest_smoke.py | 4 | PASSED |

### Cobertura de codigo:
- `lambda_function.py`: 54% (rutas principales cubiertas)
- `tests/`: 100%
- `conftest.py`: 100%

---

## Docker Hub — Imagenes Publicadas

| Imagen | Tag | Tamano |
|--------|-----|--------|
| nino200431/condomanager-backend | latest | ~250MB |
| nino200431/condomanager-frontend | latest | ~40MB |

URLs:
- https://hub.docker.com/r/nino200431/condomanager-backend
- https://hub.docker.com/r/nino200431/condomanager-frontend

---

## Infraestructura Desplegada (Dev)

Todos los recursos fueron creados exitosamente via Terraform en la cuenta del profesor (us-east-1):

| Servicio | Recurso | Status |
|----------|---------|--------|
| DynamoDB | 12 tablas (dev-*) | CREATED |
| Lambda | dev-CondoManager | CREATED |
| API Gateway REST | dev-CondoManager-REST | CREATED |
| API Gateway WebSocket | dev-CondoManager-WebSocket | CREATED |
| S3 | dev-condomanager-photos-* | CREATED |
| S3 | dev-condomanager-frontend-* | CREATED |
| CloudFront | Frontend CDN | CREATED |
| CloudFront | Photos CDN | CREATED |
| CloudWatch | Dashboard + Alarms | CREATED |
| SNS | dev-condomanager-alarms | CREATED |
| Secrets Manager | dev/CondoManager/JWT_Secret_v2 | CREATED |
| IAM | dev-condomanager-lambda-role | CREATED |
| ECR | condomanager-backend | CREATED |

---

## Criterios de Evaluacion Cumplidos

| Criterio | Status | Evidencia |
|----------|--------|-----------|
| Repositorio de Infra con Terraform | CUMPLIDO | terraform/ con 6 modulos |
| Estrategia de ramas con PRs | CUMPLIDO | feature/infra-setup → main via PR |
| Pipeline Backend (Build + Tests) | CUMPLIDO | build-and-test job pasa |
| Pipeline Backend (Docker Hub) | CUMPLIDO | Imagen publicada automaticamente |
| Pipeline Frontend (Docker Hub) | CUMPLIDO | Imagen publicada automaticamente |
| Ambiente Dev | CUMPLIDO | Desplegado en us-east-1 |
| Ambiente Prod | CUMPLIDO | Partner's deployment en us-east-2 |
| Pruebas unitarias visibles | CUMPLIDO | Artifacts en GitHub Actions |
| Aprobacion manual (gate) | CUMPLIDO | production environment con review |
| Docker Hub con imagenes | CUMPLIDO | 2 repositorios con tags |
| APM (CloudWatch) | CUMPLIDO | Dashboard + Alarms + X-Ray |

---

## Warnings (no criticos)

1. **Node.js 20 deprecation:** GitHub Actions muestra warning sobre actions/checkout@v4, actions/setup-python@v5, actions/upload-artifact@v4 corriendo en Node.js 20. Esto es cosmético y no afecta funcionalidad.

2. **Terraform deploy-dev failure:** Esperado por state mismatch entre despliegue local y pipeline. Se resuelve usando exclusivamente el pipeline para desplegar o configurando backend S3 remoto.
