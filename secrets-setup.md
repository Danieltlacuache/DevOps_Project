# Instrucciones para configurar AWS Secrets Manager

## 1. Crear el secreto en AWS Secrets Manager

Ve a la consola de AWS Secrets Manager y crea un nuevo secreto:

- **Tipo de secreto**: Otro tipo de secreto
- **Pares clave/valor**:
  - Clave: `JWT_SECRET`
  - Valor: `tu_clave_secreta_muy_segura_aqui` (genera una clave segura de al menos 32 caracteres)

- **Nombre del secreto**: `jwt-secret-key`
- **Descripción**: Clave secreta para JWT tokens

## 2. Configurar permisos IAM para Lambda

Asegúrate de que el rol IAM de tu función Lambda tenga la política `SecretsManagerReadWrite` o crea una política personalizada:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "secretsmanager:GetSecretValue"
            ],
            "Resource": "arn:aws:secretsmanager:region:account:secret:jwt-secret-key-*"
        }
    ]
}
```

## 3. Comando CLI para crear el secreto (opcional)

```bash
aws secretsmanager create-secret \
    --name "jwt-secret-key" \
    --description "JWT secret key for condominium management system" \
    --secret-string '{"JWT_SECRET":"tu_clave_secreta_muy_segura_aqui"}'
```

## 4. Rotación de secretos (recomendado)

Configura la rotación automática de secretos en Secrets Manager para mayor seguridad.