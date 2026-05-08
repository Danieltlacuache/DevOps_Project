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
  default     = "us-east-1"
}

variable "team_tag" {
  description = "Team tag required by AWS organization policy"
  type        = string
  default     = "team-7"
}

variable "name_tag" {
  description = "Name tag (ITESO email) required by AWS organization policy"
  type        = string
  default     = "daniel.guzman@iteso.mx"
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

variable "ecr_repository_url" {
  description = "ECR repository URL for the Lambda container image"
  type        = string
  default     = "311141527383.dkr.ecr.us-east-1.amazonaws.com/condomanager-backend"
}

variable "sns_email" {
  description = "Email address for SNS alarm notifications (empty string disables subscription)"
  type        = string
  default     = ""
}

variable "photos_bucket_name" {
  description = "Name of the pre-created S3 photos bucket"
  type        = string
  default     = "dev-condomanager-photos-team7"
}

variable "frontend_bucket_name" {
  description = "Name of the pre-created S3 frontend bucket"
  type        = string
  default     = "dev-condomanager-frontend-team7"
}
