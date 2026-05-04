# =============================================================================
# Variables for Secrets module
# =============================================================================

variable "environment" {
  description = "Environment name used as prefix for secret names (e.g. dev, prod)"
  type        = string
}
