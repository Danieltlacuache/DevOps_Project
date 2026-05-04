# =============================================================================
# Variables for Lambda module
# =============================================================================

variable "environment" {
  description = "Environment name used as prefix for resource names (e.g. dev, prod)"
  type        = string
}

variable "memory_size" {
  description = "Amount of memory in MB for the Lambda function"
  type        = number
  default     = 512
}

variable "timeout" {
  description = "Timeout in seconds for the Lambda function"
  type        = number
  default     = 30
}

variable "image_tag" {
  description = "Docker image tag to deploy (e.g. commit SHA)"
  type        = string
}

variable "dockerhub_username" {
  description = "Docker Hub username for the image registry"
  type        = string
}

variable "log_retention_days" {
  description = "Number of days to retain CloudWatch logs"
  type        = number
  default     = 14
}

# --- DynamoDB table name inputs ---

variable "users_table_name" {
  description = "Name of the Users DynamoDB table"
  type        = string
}

variable "residents_table_name" {
  description = "Name of the Residents DynamoDB table"
  type        = string
}

variable "condos_table_name" {
  description = "Name of the Condos DynamoDB table"
  type        = string
}

variable "units_table_name" {
  description = "Name of the Units DynamoDB table"
  type        = string
}

variable "admin_tokens_table_name" {
  description = "Name of the AdminTokens DynamoDB table"
  type        = string
}

variable "connections_table_name" {
  description = "Name of the Connections DynamoDB table"
  type        = string
}

variable "maintenance_tasks_table_name" {
  description = "Name of the MaintenanceTasks DynamoDB table"
  type        = string
}

variable "announcements_table_name" {
  description = "Name of the Announcements DynamoDB table"
  type        = string
}

variable "incidents_table_name" {
  description = "Name of the Incidents DynamoDB table"
  type        = string
}

variable "fees_table_name" {
  description = "Name of the Fees DynamoDB table"
  type        = string
}

variable "amenities_table_name" {
  description = "Name of the Amenities DynamoDB table"
  type        = string
}

variable "amenity_reservations_table_name" {
  description = "Name of the AmenityReservations DynamoDB table"
  type        = string
}

# --- Storage and service inputs ---

variable "bucket_name" {
  description = "Name of the S3 photos bucket"
  type        = string
}

variable "secret_id" {
  description = "ID of the secret in Secrets Manager"
  type        = string
}

variable "websocket_url" {
  description = "WebSocket API URL"
  type        = string
}

variable "cdn_domain" {
  description = "CloudFront CDN domain name"
  type        = string
}

# --- IAM policy inputs ---

variable "all_table_arns" {
  description = "Map of all DynamoDB table ARNs for IAM policy"
  type        = map(string)
}

variable "bucket_arn" {
  description = "ARN of the S3 photos bucket"
  type        = string
}

variable "secret_arn" {
  description = "ARN of the secret in Secrets Manager"
  type        = string
}
