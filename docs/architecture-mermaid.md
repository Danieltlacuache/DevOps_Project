# Deployment & Infrastructure Diagram — Hotel Reservation System (Azure + Cloudflare)

## Architecture Overview

- Cloudflare Edge Layer (DNS + WAF, Pages, Workers)
- Azure Backend Layer (API Management, Azure Functions with methods)
- Multi-Environment Data Layer (Dev / QA / Prod with specific Azure tiers)
- CI/CD Pipeline — GitHub Actions (Build, Pruebas Unitarias, Coverage, Docker Hub)
- Deployment Flow with Pre-Approver Gates
- Governance — GitHub Flow branching strategy
- Observability — Azure Monitor + Application Insights

```mermaid
graph TB
    classDef azure fill:#0078d4,color:#fff,stroke:#005a9e,stroke-width:1px
    classDef cf fill:#f6821f,color:#fff,stroke:#d4700e,stroke-width:1px
    classDef db fill:#3b48cc,color:#fff,stroke:#2a35a0,stroke-width:1px
    classDef cache fill:#c925d1,color:#fff,stroke:#9e1ea8,stroke-width:1px
    classDef cicd fill:#24292e,color:#fff,stroke:#6f42c1,stroke-width:2px
    classDef gate fill:#e74c3c,color:#fff,stroke:#c0392b,stroke-width:2px
    classDef obs fill:#00bcd4,color:#fff,stroke:#0097a7,stroke-width:1px
    classDef git fill:#6f42c1,color:#fff,stroke:#5a32a3,stroke-width:1px
    classDef user fill:#2ecc71,color:#fff,stroke:#27ae60,stroke-width:1px
    classDef docker fill:#2496ed,color:#fff,stroke:#1a6fb5,stroke-width:1px

    EndUser["End User - Browser / Mobile"]:::user

    subgraph EdgeLayer["CLOUDFLARE - Edge Layer"]
        CFDNS["Cloudflare DNS + WAF<br/>Global Entry Point<br/>DDoS Protection"]:::cf
        CFPages["Cloudflare Pages<br/>Next.js Frontend<br/>Static + SSR Hosting"]:::cf
        CFWorkers["Cloudflare Workers<br/>Serverless API Proxy<br/>Request Routing + Auth"]:::cf
    end

    EndUser -->|"HTTPS"| CFDNS
    CFDNS -->|"Static / SSR"| CFPages
    CFDNS -->|"API /api/*"| CFWorkers

    subgraph BackendLayer["AZURE - Backend Layer"]
        APIM["Azure API Management<br/>api.hotel.com<br/>Rate Limiting + Policies"]:::azure

        subgraph FN_Reservation["Azure Function: Reservation Manager"]
            FN_R1["createBooking()"]
            FN_R2["modifyBooking()"]
            FN_R3["cancelBooking()"]
            FN_R4["getBookingDetails()"]
        end

        subgraph FN_Inventory["Azure Function: Inventory Controller"]
            FN_I1["checkAvailability()"]
            FN_I2["syncRedisCache()"]
            FN_I3["updateRoomStock()"]
            FN_I4["bulkInventoryUpdate()"]
        end

        subgraph FN_Integration["Azure Function: External Integration"]
            FN_E1["AirbnbAdapter"]
            FN_E2["BookingComAdapter"]
            FN_E3["syncExternalPlatforms()"]
        end
    end

    CFWorkers -->|"Proxy"| APIM
    APIM --> FN_Reservation
    APIM --> FN_Inventory
    APIM --> FN_Integration
    FN_Integration -->|"REST API"| ExtAirbnb["Airbnb API"]
    FN_Integration -->|"REST API"| ExtBooking["Booking.com API"]

    subgraph DevData["DEVELOPMENT - Data Layer"]
        DevPG["Azure PostgreSQL<br/>Flexible Server<br/>Burstable B1ms"]:::db
        DevRedis["Azure Cache for Redis<br/>Basic C0"]:::cache
    end

    subgraph QAData["QA - Data Layer"]
        QAPG["Azure PostgreSQL<br/>Flexible Server<br/>GP D2s_v3"]:::db
        QARedis["Azure Cache for Redis<br/>Standard C1"]:::cache
    end

    subgraph ProdData["PRODUCTION - Data Layer"]
        ProdPG["Azure PostgreSQL<br/>Flexible Server<br/>GP D4s_v3 - HA Zone Redundant"]:::db
        ProdRedis["Azure Cache for Redis<br/>Premium P1 - Clustering"]:::cache
    end

    FN_Reservation --> DevData
    FN_Reservation --> QAData
    FN_Reservation --> ProdData
    FN_Inventory --> DevData
    FN_Inventory --> QAData
    FN_Inventory --> ProdData

    subgraph Pipeline["CI/CD PIPELINE - GitHub Actions"]
        P_Build["Build<br/>npm install + tsc compile"]:::cicd
        P_Test["Pruebas Unitarias<br/>Vitest / Jest"]:::cicd
        P_Coverage["Code Coverage<br/>Min 80% - Gate"]:::cicd
        P_Docker["Docker Build<br/>docker build -t hotel-app"]:::docker
        P_Push["Push to Docker Hub<br/>Docker Hub Registry"]:::docker
    end

    P_Build --> P_Test
    P_Test --> P_Coverage
    P_Coverage -->|"Pass >= 80%"| P_Docker
    P_Docker --> P_Push

    P_Push -->|"Auto-deploy"| DeployDev["Deploy to DEV"]:::cicd
    P_Push -.->|"Manual Trigger"| GateQA
    GateQA["Pre-Approver Gate<br/>QA Team Review"]:::gate
    GateQA -->|"Approved"| DeployQA["Deploy to QA"]:::cicd
    DeployQA -.->|"Manual Trigger"| GateProd
    GateProd["Pre-Approver Gate<br/>Release Manager"]:::gate
    GateProd -->|"Approved"| DeployProd["Deploy to PRODUCTION"]:::cicd

    DeployDev --> DevData
    DeployQA --> QAData
    DeployProd --> ProdData

    subgraph Branching["GOVERNANCE - GitHub Flow"]
        B_Feature["feature/* branch<br/>Developer Work"]:::git
        B_PR["Pull Request<br/>Code Review + CI"]:::git
        B_Develop["develop branch<br/>Integration"]:::git
        B_Main["main branch<br/>Production-ready"]:::git
    end

    B_Feature -->|"Open PR"| B_PR
    B_PR -->|"Approved + CI Pass"| B_Develop
    B_Develop -->|"Release PR"| B_Main
    B_Develop -->|"Trigger Pipeline"| P_Build

    subgraph Observability["OBSERVABILITY - Azure"]
        O_Monitor["Azure Monitor<br/>Centralized Logging<br/>Log Analytics Workspace"]:::obs
        O_Insights["Application Insights<br/>APM - Transaction Tracing<br/>Live Metrics + Alerts"]:::obs
    end

    FN_Reservation -.->|"Logs"| O_Monitor
    FN_Inventory -.->|"Logs"| O_Monitor
    FN_Integration -.->|"Logs"| O_Monitor
    APIM -.->|"Logs"| O_Monitor
    FN_Reservation -.->|"Telemetry"| O_Insights
    FN_Inventory -.->|"Telemetry"| O_Insights
    FN_Integration -.->|"Telemetry"| O_Insights
    DevData -.->|"Diagnostics"| O_Monitor
    QAData -.->|"Diagnostics"| O_Monitor
    ProdData -.->|"Diagnostics"| O_Monitor
```
