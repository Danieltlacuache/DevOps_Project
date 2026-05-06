# =============================================================================
# Variables for Observability module
# =============================================================================

variable "environment" {
  description = "Environment name used as prefix for resource names (e.g. dev, prod)"
  type        = string
}

variable "log_retention_days" {
  description = "Number of days to retain CloudWatch logs"
  type        = number
  default     = 14
}

variable "lambda_function_name" {
  description = "Name of the Lambda function to monitor"
  type        = string
}

variable "rest_api_id" {
  description = "ID of the REST API Gateway"
  type        = string
}

variable "ws_api_id" {
  description = "ID of the WebSocket API Gateway"
  type        = string
}

variable "lambda_timeout" {
  description = "Lambda function timeout in seconds (used to calculate duration alarm threshold)"
  type        = number
  default     = 30
}

variable "sns_email" {
  description = "Email address for SNS alarm notifications (empty string disables subscription)"
  type        = string
  default     = ""
}

variable "team_tag" {
  description = "Team tag required by AWS organization SCP"
  type        = string
}

variable "name_tag" {
  description = "Name tag (email) required by AWS organization SCP"
  type        = string
}
