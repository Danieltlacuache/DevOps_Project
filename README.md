# Propuesta de Proyecto Final: Sistema de Reservaciones Hoteleras de Alta Concurrencia

## 1. Descripción del Proyecto

Aplicación web profesional para la gestión de reservaciones hoteleras, diseñada para soportar más de 5,000 hoteles con alta concurrencia y consistencia de datos. El sistema utiliza un stack moderno de Next.js con TypeScript, desplegado sobre Azure y Cloudflare, con un pipeline CI/CD robusto mediante GitHub Actions y aprovisionamiento de infraestructura con Terraform/Kiro. La arquitectura es extensible para futuras integraciones con plataformas como Airbnb y Booking.com.

---

## 2. Stack Tecnológico

### Frontend & Edge
| Componente | Tecnología |
|---|---|
| Framework | Next.js (React) con TypeScript |
| Hosting Frontend | Cloudflare Pages (SSR + Static) |
| DNS & Seguridad | Cloudflare DNS + WAF (DDoS Protection) |
| API Gateway Edge | Cloudflare Workers (Proxy Serverless) |

### Backend — Azure
| Componente | Tecnología |
|---|---|
| API Management | Azure API Management |
| Compute | Azure Functions (Node.js 20.x) |
| Base de Datos | Azure Database for PostgreSQL — Flexible Server |
| Caché | Azure Cache for Redis |
| Observabilidad | Azure Monitor + Application Insights |

### DevOps & Herramientas
| Componente | Tecnología |
|---|---|
| CI/CD | GitHub Actions |
| Contenedores | Docker → Docker Hub |
| IaC | Terraform / Kiro |
| Control de Versiones | Git (GitHub) |
| Testing | Vitest / Jest |

---

## 3. Componentes del Sistema

### 3.1 Reservation Manager — Gestión de Reservaciones
Maneja el ciclo de vida completo de una reservación.

| Método | Descripción |
|---|---|
| `createBooking()` | Crea una nueva reservación validando disponibilidad en Redis |
| `modifyBooking()` | Modifica fechas, habitación o datos del huésped |
| `cancelBooking()` | Cancela una reservación y libera inventario |
| `getBookingDetails()` | Consulta el detalle de una reservación existente |

### 3.2 Inventory Controller — Control de Inventario
Gestiona la disponibilidad de habitaciones en tiempo real con sincronización Redis.

| Método | Descripción |
|---|---|
| `checkAvailability()` | Consulta disponibilidad (Redis cache-first, fallback a PostgreSQL) |
| `syncRedisCache()` | Sincroniza el estado de inventario entre PostgreSQL y Redis |
| `updateRoomStock()` | Actualiza el stock de habitaciones tras una reservación |
| `bulkInventoryUpdate()` | Actualización masiva de inventario para operaciones batch |

### 3.3 External Integration Service — Integraciones Externas
Capa de adaptadores modulares para conectar con plataformas de terceros.

| Método / Clase | Descripción |
|---|---|
| `AirbnbAdapter` | Adaptador para sincronización con la API de Airbnb |
| `BookingComAdapter` | Adaptador para sincronización con la API de Booking.com |
| `syncExternalPlatforms()` | Orquesta la sincronización bidireccional de disponibilidad |

### 3.4 UI Components — Componentes de Interfaz (React)

| Componente | Descripción |
|---|---|
| `SearchForm` | Formulario de búsqueda de hoteles y fechas |
| `BookingFunnel` | Flujo paso a paso de reservación |
| `ConfirmationView` | Vista de confirmación post-reservación |
| `HotelDashboard` | Panel de administración para hoteleros |

---

## 4. Arquitectura de Infraestructura

### Diagrama de Despliegue

![Diagrama de Arquitectura](docs/architecture.png)

> Versión SVG escalable disponible en `docs/architecture.svg`
> Fuente Mermaid editable en `docs/architecture.mmd`

### Flujo de Tráfico

```
Usuario → Cloudflare DNS → Cloudflare WAF → Cloudflare Pages (Frontend)
                                           → Cloudflare Workers (API Proxy)
                                              → Azure API Management
                                                 → Azure Functions
                                                    → PostgreSQL / Redis
```

---

## 5. Pipeline CI/CD y Estrategia de Despliegue

### Flujo del Pipeline (GitHub Actions)

```
Push a develop → Build → Unit Tests (UAT) → Code Coverage (≥80%) → Docker Build → Docker Hub Push
```

### Estrategia de Ambientes

| Ambiente | Trigger | Aprobación | Infraestructura Azure |
|---|---|---|---|
| **Development** | Auto-deploy al merge en `develop` | Ninguna | Burstable B1ms (PG), Basic C0 (Redis) |
| **QA** | Manual trigger | Pre-approver (QA Team) | GP D2s_v3 (PG), Standard C1 (Redis) |
| **Production** | Manual trigger | Pre-approver (Release Manager) | GP D4s_v3 HA (PG), Premium P1 (Redis) |

### Estrategia de Branching (GitHub Flow)

```
feature/* → Pull Request (Code Review + CI) → develop → Release PR → main
```

- `main` — Código listo para producción únicamente
- `develop` — Rama de integración para features
- `feature/*` — Features individuales o bug fixes
- Todo merge requiere PR, al menos un code review, y CI passing

---

## 6. Observabilidad

| Herramienta | Función |
|---|---|
| Azure Monitor | Logging centralizado — Log Analytics Workspace por ambiente |
| Application Insights | APM — Transaction tracing, live metrics, alertas |
| Cloudflare Analytics | Métricas de edge — requests, bandwidth, WAF events |

---

## 7. Plan del Proyecto

### Tablero GitHub Projects (Kanban/Scrum)

- **Backlog:** Integraciones futuras (Airbnb/Booking.com), mejoras no críticas
- **Todo:** Tareas del sprint actual
- **In Progress:** Desarrollo activo
- **Done:** Verificado y desplegado

### Hitos Clave

| Fecha | Hito |
|---|---|
| Marzo 15 | Entrega de Propuesta (Stack, Componentes, Recursos) |
| Abril 10 | Aprovisionamiento de Infraestructura Azure + Pipeline CI/CD inicial |
| Mayo 7–14 | Presentación y Entrega Final del Proyecto |
