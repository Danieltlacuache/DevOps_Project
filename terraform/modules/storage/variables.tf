# =============================================================================
# Variables for Storage module
# =============================================================================

variable "environment" {
  description = "Environment name used as prefix for resource names (e.g. dev, prod)"
  type        = string
}

variable "team_tag" {
  description = "Team tag required by AWS organization SCP"
  type        = string
}

variable "name_tag" {
  description = "Name tag (email) required by AWS organization SCP"
  type        = string
}
