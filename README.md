🏢 CondoManager Pro - Sistema de Gestión Escalable
Este proyecto es una plataforma integral para la gestión de condominios, unidades y mantenimiento, construida sobre una arquitectura Serverless en AWS. Permite el manejo de roles (Admin, Residente, Mantenimiento), pagos simulados, actualizaciones en tiempo real vía WebSockets y entrega de contenido mediante CDN.

🚀 Requisitos Previos
Antes de empezar, asegúrate de tener instalado lo siguiente:

AWS CLI configurado con tus credenciales (aws configure).

AWS SAM CLI para el despliegue de infraestructura.

Python 3.10 o superior.

Node.js (opcional, para usar un servidor local para el frontend).

Una cuenta de AWS activa.

🛠️ Paso 1: Configuración de Secretos (JWT)
El sistema utiliza AWS Secrets Manager para manejar la firma de los tokens de seguridad.

Ve a la consola de AWS -> Secrets Manager.

Crea un nuevo secreto de tipo "Otro tipo de secreto".

Usa el nombre: CondoManager/JWT_Secret.

Agrega un par llave/valor:

Llave: JWT_KEY

Valor: TuPalabraSecretaSuperSegura (puedes poner lo que quieras).

Guarda el secreto.

📦 Paso 2: Despliegue de la Infraestructura (Backend)
Todo el backend se despliega automáticamente usando el archivo template.yaml.

Abre una terminal en la carpeta raíz del proyecto.

Ejecuta el comando para compilar:

Bash
sam build
Ejecuta el despliegue guiado:

Bash
sam deploy --guided
Configuración del despliegue:

Stack Name: CondoManagerStack

AWS Region: us-east-2 (recomendada por la latencia en ITESO).

Confirm changes before deploy: Yes.

Allow SAM CLI IAM role creation: Yes.

Disable rollback: No.

Acepta los permisos de CondoManagerFunction para que sea pública.

IMPORTANTE: Al finalizar, SAM te entregará unos Outputs. Copia estos valores, los necesitarás para el frontend:

ApiUrl

WebSocketUrl

CDNUrl

💻 Paso 3: Configuración del Frontend
Ahora debemos conectar la interfaz con tu nueva infraestructura en la nube.

Abre el archivo dashboard.js y script.js.

Busca la variable AWS_PROD_URL al inicio de los archivos.

Reemplaza el valor con la ApiUrl que te dio SAM (asegúrate de que termine en /Prod/).

El sistema detectará automáticamente el WebSocketUrl mediante el endpoint de /config, pero asegúrate de que el bucket de S3 tenga las imágenes que subas.

🔑 Paso 4: Creación del Primer Administrador
Para poder usar el sistema, necesitas una cuenta de Admin.

El sistema tiene un "Super User" por defecto definido en el código como admin@admin.com.

Para registrarte como admin:

Ve a la consola de AWS -> DynamoDB.

Busca la tabla AdminTokensTable.

Crea un nuevo ítem manual:

token: LLAVE-MAESTRA-PRO (o el nombre que quieras).

used: false (booleano).

type: admin.

Ve a register.html en tu navegador, ingresa tus datos y en el campo de "Token" usa la llave que creaste.

🛠️ Paso 5: Ejecución
Puedes correr el frontend simplemente abriendo los archivos .html o usando la extensión Live Server de VS Code.

Admin: Crea condominios, sube fotos (que se guardarán en S3 y se servirán por CloudFront), crea unidades y asigna tareas de mantenimiento.

Residente: Explora unidades (afecta la popularidad/algoritmo de ordenamiento), reserva con el sistema de pagos y ve sus rentas activas.

Mantenimiento: Registra un técnico con un token generado por el Admin (MAINT-XXXX) y gestiona los estados de las reparaciones.

📊 Conceptos de Ingeniería Aplicados (Para tu reporte)
Si te preguntan qué hace especial a este proyecto, menciona esto:

Observabilidad: Implementamos AWS X-Ray para el rastreo de trazas distribuidas.

Teorema CAP: Usamos ConsistentRead=True en DynamoDB para garantizar consistencia fuerte en el login.

CDN: Las imágenes no se sirven desde S3, sino desde nodos de borde (Edge) vía CloudFront para reducir latencia.

Tiempo Real: Arquitectura orientada a eventos usando WebSockets para sincronizar vistas sin refrescar.

Limpieza Asíncrona: Lógica de "Lazy Cleanup" para liberar unidades cuando expira la reserva.