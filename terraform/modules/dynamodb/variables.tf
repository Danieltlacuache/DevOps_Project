variable "environment" {
  description = "Environment name used as prefix for table names (e.g. dev, prod)"
  type        = string
}

variable "billing_mode" {
  description = "DynamoDB billing mode for all tables"
  type        = string
  default     = "PAY_PER_REQUEST"
}
