# 🏢 CondoManager Pro - Sistema de Gestión de Condominios

CondoManager Pro es una plataforma moderna para la administración de propiedades, diseñada con una arquitectura **100% Serverless** altamente escalable utilizando Amazon Web Services (AWS). 

El sistema permite a los administradores gestionar condominios, unidades, cuotas e incidentes. Los residentes pueden firmar contratos de renta (con generación automática de cuotas), pagar de forma segura y reportar fallas. Además, cuenta con un sistema de **asignación inteligente (Round Robin)** para balancear la carga de trabajo del equipo de mantenimiento.

---

## 🏗️ Arquitectura del Sistema (Nube Nativa)

Este proyecto no utiliza servidores tradicionales (EC2). Está construido con servicios gestionados para garantizar alta disponibilidad y escalabilidad automática (Cero Administración):

* **Frontend:** HTML5, CSS3 y Vanilla JavaScript (Desacoplado del backend).
* **Backend REST & WebSockets:** AWS Lambda (Python 3.10) y Amazon API Gateway.
* **Base de Datos:** Amazon DynamoDB (NoSQL) con diseño multi-tabla.
* **Almacenamiento y CDN:** Amazon S3 (para imágenes) distribuido mediante Amazon CloudFront.
* **Seguridad y Criptografía:** Autenticación stateless con JWT. La llave maestra es generada y rotada automáticamente por **AWS Secrets Manager**.
* **Infraestructura como Código (IaC):** AWS SAM (Serverless Application Model).

---

## ⚙️ Prerrequisitos

Para desplegar este proyecto en tu propia cuenta, necesitas tener instaladas las siguientes herramientas:

1.  **[Cuenta de AWS](https://aws.amazon.com/es/):** Con permisos de administrador.
2.  **[AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html):** Configurado con tus credenciales (`aws configure`).
3.  **[AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html):** Para compilar y desplegar la infraestructura.
4.  **[Python 3.10](https://www.python.org/downloads/):** O versión compatible.
5.  Un servidor web local simple (ej. extensión "Live Server" en VSCode o `python -m http.server`) para ejecutar el frontend sin bloqueos de CORS.

---

## 🚀 Guía de Despliegue (Backend)

Todo el backend, bases de datos, buckets, políticas de seguridad y secretos se despliegan automáticamente con 2 comandos.

### 1. Clonar el repositorio
Extrae los archivos del proyecto y abre una terminal en la carpeta raíz (donde se encuentra el archivo `template.yaml`).

### 2. Compilar el proyecto
Utiliza SAM para empaquetar el código de Python y preparar la plantilla de CloudFormation:

```bash
sam build