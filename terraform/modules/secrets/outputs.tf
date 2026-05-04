# =============================================================================
# Outputs for Secrets module
# =============================================================================

output "secret_arn" {
  description = "ARN of the JWT secret in Secrets Manager"
  value       = aws_secretsmanager_secret.jwt_secret.arn
}

output "secret_id" {
  description = "ID (name) of the JWT secret in Secrets Manager"
  value       = aws_secretsmanager_secret.jwt_secret.id
}
