# =============================================================================
# CondoManager Pro — Global Terraform Variables
# =============================================================================
# These variables are referenced by the root module (main.tf) and passed down
# to child modules. Override them per environment using tfvars files:
#   terraform apply -var-file=environments/dev.tfvars
#   terraform apply -var-file=environments/prod.tfvars
# =============================================================================

variable "environment" {
  description = "Environment name used as prefix for resource names (e.g. dev, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region where all resources will be created"
  type        = string
  default     = "us-east-2"
}

variable "lambda_memory_size" {
  description = "Amount of memory in MB for the Lambda function"
  type        = number
  default     = 512
}

variable "lambda_timeout" {
  description = "Timeout in seconds for the Lambda function"
  type        = number
  default     = 30
}

variable "log_retention_days" {
  description = "Number of days to retain CloudWatch logs"
  type        = number
  default     = 14
}

variable "image_tag" {
  description = "Docker image tag for the Lambda container (typically a commit SHA)"
  type        = string
}

variable "dockerhub_username" {
  description = "Docker Hub username for the image registry"
  type        = string
}

variable "sns_email" {
  description = "Email address for SNS alarm notifications (empty string disables subscription)"
  type        = string
  default     = ""
}
