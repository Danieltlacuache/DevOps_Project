# =============================================================================
# Variables for API Gateway module
# =============================================================================

variable "environment" {
  description = "Environment name used as prefix for resource names (e.g. dev, prod)"
  type        = string
}

variable "lambda_invoke_arn" {
  description = "Invoke ARN of the Lambda function for API Gateway integration"
  type        = string
}

variable "lambda_function_name" {
  description = "Name of the Lambda function for permission grants"
  type        = string
}

variable "lambda_function_arn" {
  description = "ARN of the Lambda function for permission grants"
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
