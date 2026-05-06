# Resumen del Proyecto — CondoManager Pro DevOps

## Descripcion

Migracion del proyecto CondoManager Pro desde AWS SAM hacia una infraestructura gestionada con Terraform, contenedorizada con Docker, y automatizada con pipelines de CI/CD en GitHub Actions. El sistema soporta dos ambientes (Dev y Prod) con puertas de aprobacion manual.

---

## Lo que se logro

### 1. Infraestructura como Codigo (Terraform)

- 6 modulos Terraform: DynamoDB, Lambda, API Gateway, Storage, Observability, Secrets
- 51 recursos AWS creados automaticamente con un solo comando
- Configuracion multi-ambiente con archivos tfvars (dev.tfvars, prod.tfvars)
- Tags de compliance (Team, Name) en todos los recursos
- Region us-east-1 conforme a las politicas de la organizacion

### 2. Contenedorizacion (Docker)

- Imagen Backend: `public.ecr.aws/lambda/python:3.10` con lambda_function.py y dependencias
- Imagen Frontend: `nginx:alpine` con archivos estaticos y entrypoint para inyeccion de variables
- Ambas imagenes publicadas en Docker Hub (nino200431/condomanager-backend, nino200431/condomanager-frontend)
- Imagen backend tambien en ECR para uso con Lambda

### 3. Pipelines CI/CD (GitHub Actions)

**Backend Pipeline (backend-ci-cd.yml):**
- Build: Instala dependencias Python
- Unit Tests: pytest con cobertura y reporte JUnit XML
- Docker Build + Push: Construye y publica imagen en Docker Hub
- Deploy Dev: Terraform apply al ambiente Dev
- Deploy Prod: Requiere aprobacion manual (GitHub Environments)

**Frontend Pipeline (frontend-ci-cd.yml):**
- Docker Build + Push: Construye y publica imagen en Docker Hub
- Deploy Dev: Sync a S3 + invalidacion CloudFront
- Deploy Prod: Requiere aprobacion manual

### 4. Pruebas Unitarias

- Framework: pytest + pytest-cov + moto (mock AWS)
- 16 tests automatizados cubriendo: autenticacion, condominios, cuotas financieras
- Cobertura reportada en cada ejecucion del pipeline
- Resultados visibles como artifacts en GitHub Actions

### 5. Observabilidad (APM)

- CloudWatch Dashboard con 7 widgets: Invocaciones, Duracion (P50/P90/P99), Errores, Throttles, 4xx, 5xx, Latencia
- CloudWatch Alarms: Lambda Errors > 0, Lambda Duration > 80% timeout
- SNS Topic para notificaciones de alarmas
- X-Ray Tracing habilitado en Lambda y API Gateway
- Log Groups con retencion configurable (14 dias Dev, 90 dias Prod)

### 6. Estrategia de Ramas

- GitHub Flow: feature/* → PR → main
- PRs requieren al menos 1 aprobacion
- Tests se ejecutan automaticamente en cada PR
- Merge a main dispara los pipelines de despliegue

### 7. Ambientes

| Ambiente | Ubicacion | Proposito |
|----------|-----------|-----------|
| Dev | Teacher's account (us-east-1) | Pruebas y desarrollo |
| Prod | Partner's account (us-east-2) | Aplicacion en produccion con datos reales |

---

## Arquitectura Desplegada

```
Usuario → CloudFront (Frontend) → S3 Bucket (archivos estaticos)
                                → API Gateway REST → Lambda (Docker/ECR)
                                                      → DynamoDB (12 tablas)
                                                      → S3 (fotos)
                                                      → Secrets Manager (JWT)
                                                      → CloudWatch (logs/metricas)
                                                      → X-Ray (trazas)
```

---

## Servicios AWS Utilizados

| Servicio | Cantidad | Uso |
|----------|----------|-----|
| DynamoDB | 12 tablas | Base de datos NoSQL |
| Lambda | 1 funcion | Backend (Python 3.10, Docker) |
| API Gateway REST | 1 | Endpoints HTTP |
| API Gateway WebSocket | 1 | Notificaciones en tiempo real |
| S3 | 2 buckets | Frontend + Fotos |
| CloudFront | 2 distribuciones | CDN para frontend y fotos |
| CloudWatch | Dashboard + 2 Alarms + Log Groups | Monitoreo |
| SNS | 1 topic | Notificaciones de alarmas |
| Secrets Manager | 1 secreto | JWT Key |
| IAM | 1 role + 1 policy | Permisos Lambda |
| ECR | 1 repositorio | Imagenes Docker para Lambda |
| X-Ray | Habilitado | Trazabilidad distribuida |

---

## Comandos Clave

```bash
# Desplegar infraestructura
cd terraform
terraform apply -var-file="environments/dev.tfvars" -var "image_tag=latest"

# Destruir infraestructura
terraform destroy -var-file="environments/dev.tfvars" -var "image_tag=latest"

# Subir frontend
aws s3 sync frontend/ s3://dev-condomanager-frontend-49a70345/ --exclude "Dockerfile" --exclude "nginx.conf" --exclude "docker-entrypoint.sh" --exclude ".dockerignore"

# Ejecutar tests localmente
python -m pytest backend/tests/ -v --cov=backend/

# Construir imagen Docker
docker build --platform linux/amd64 --provenance=false -t 311141527383.dkr.ecr.us-east-1.amazonaws.com/condomanager-backend:latest ./backend
```

---

## Nota sobre Deploy-Dev en Pipeline

El paso `deploy-dev` del backend pipeline falla porque Terraform necesita un archivo de estado compartido (state file) para saber que recursos ya existen. Nosotros desplegamos localmente con `terraform apply` (state guardado en la maquina local), pero el pipeline corre en una VM fresca de GitHub Actions que no tiene ese state.

**Solucion en produccion:** Usar un backend S3 remoto para almacenar el state de Terraform, accesible tanto localmente como desde el pipeline. Esto ya esta configurado en el codigo (comentado en main.tf) pero requiere crear el bucket S3 y la tabla DynamoDB de locks previamente.

Para el alcance de este proyecto escolar, el despliegue local con Terraform + pipeline para build/test/Docker es suficiente y demuestra el flujo completo de DevOps.
