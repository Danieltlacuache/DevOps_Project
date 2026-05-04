# =============================================================================
# Secrets Manager for CondoManager Pro
# JWT secret for authentication
# =============================================================================

resource "aws_secretsmanager_secret" "jwt_secret" {
  name = "${var.environment}/CondoManager/JWT_Secret"

  tags = {
    Environment = var.environment
    Module      = "secrets"
  }
}
