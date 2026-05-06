# =============================================================================
# Secrets Manager for CondoManager Pro
# JWT secret for authentication
# =============================================================================

resource "aws_secretsmanager_secret" "jwt_secret" {
  name                    = "${var.environment}/CondoManager/JWT_Secret_v2"
  recovery_window_in_days = 0

  tags = {
    Team        = var.team_tag
    Name        = var.name_tag
    Environment = var.environment
    Module      = "secrets"
  }
}
