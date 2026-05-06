# =============================================================================
# CondoManager Pro — Root Terraform Configuration
# =============================================================================
# This file defines the Terraform backend, provider, and wires all modules
# together. Use with workspace-specific tfvars:
#   terraform workspace select dev
#   terraform apply -var-file=environments/dev.tfvars
# =============================================================================

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  # Backend S3 (uncomment for production use with remote state):
  # backend "s3" {
  #   bucket         = "condomanager-tf-state"
  #   key            = "infrastructure/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "terraform-locks"
  #   encrypt        = true
  # }

  # Using local backend for initial deployment
  backend "local" {
    path = "terraform.tfstate"
  }
}

# -----------------------------------------------------------------------------
# Provider
# -----------------------------------------------------------------------------

provider "aws" {
  region = var.aws_region
}

# -----------------------------------------------------------------------------
# Module: DynamoDB — 12 tables with GSIs
# -----------------------------------------------------------------------------

module "dynamodb" {
  source      = "./modules/dynamodb"
  environment = var.environment
  team_tag    = var.team_tag
  name_tag    = var.name_tag
}

# -----------------------------------------------------------------------------
# Module: Secrets Manager — JWT secret
# -----------------------------------------------------------------------------

module "secrets" {
  source      = "./modules/secrets"
  environment = var.environment
  team_tag    = var.team_tag
  name_tag    = var.name_tag
}

# -----------------------------------------------------------------------------
# Module: Storage — S3 buckets + CloudFront distributions
# -----------------------------------------------------------------------------

module "storage" {
  source      = "./modules/storage"
  environment = var.environment
  team_tag    = var.team_tag
  name_tag    = var.name_tag
}

# -----------------------------------------------------------------------------
# Module: Lambda — Function + IAM role
# -----------------------------------------------------------------------------
# NOTE on websocket_url: There is a circular dependency between Lambda and
# API Gateway. Lambda needs the WebSocket URL as an env var, but API Gateway
# needs the Lambda ARN for its integrations. We break the cycle by passing an
# empty string here. The Lambda code already handles a missing WEBSOCKET_URL
# gracefully (it checks `if WS_ENDPOINT` before use). After the first deploy,
# the WebSocket URL can be updated via a subsequent apply or by setting the
# environment variable directly.
# -----------------------------------------------------------------------------

module "lambda" {
  source = "./modules/lambda"

  environment        = var.environment
  team_tag           = var.team_tag
  name_tag           = var.name_tag
  memory_size        = var.lambda_memory_size
  timeout            = var.lambda_timeout
  image_tag          = var.image_tag
  ecr_repository_url = var.ecr_repository_url
  log_retention_days = var.log_retention_days

  # DynamoDB table names (12 tables)
  users_table_name                = module.dynamodb.users_table_name
  residents_table_name            = module.dynamodb.residents_table_name
  condos_table_name               = module.dynamodb.condos_table_name
  units_table_name                = module.dynamodb.units_table_name
  admin_tokens_table_name         = module.dynamodb.admin_tokens_table_name
  connections_table_name          = module.dynamodb.connections_table_name
  maintenance_tasks_table_name    = module.dynamodb.maintenance_tasks_table_name
  announcements_table_name        = module.dynamodb.announcements_table_name
  incidents_table_name            = module.dynamodb.incidents_table_name
  fees_table_name                 = module.dynamodb.fees_table_name
  amenities_table_name            = module.dynamodb.amenities_table_name
  amenity_reservations_table_name = module.dynamodb.amenity_reservations_table_name

  # DynamoDB table ARNs (for IAM policies)
  all_table_arns = module.dynamodb.all_table_arns

  # Storage
  bucket_name = module.storage.photos_bucket_name
  bucket_arn  = module.storage.photos_bucket_arn
  cdn_domain  = module.storage.photos_cdn_domain

  # Secrets
  secret_id  = module.secrets.secret_id
  secret_arn = module.secrets.secret_arn

  # WebSocket URL — empty string to break circular dependency with api_gateway.
  # See NOTE above for details.
  websocket_url = ""
}

# -----------------------------------------------------------------------------
# Module: API Gateway — REST API + WebSocket API
# -----------------------------------------------------------------------------

module "api_gateway" {
  source = "./modules/api-gateway"

  environment          = var.environment
  team_tag             = var.team_tag
  name_tag             = var.name_tag
  lambda_invoke_arn    = module.lambda.invoke_arn
  lambda_function_name = module.lambda.function_name
  lambda_function_arn  = module.lambda.function_arn
}

# -----------------------------------------------------------------------------
# Module: Observability — CloudWatch, X-Ray, SNS
# -----------------------------------------------------------------------------

module "observability" {
  source = "./modules/observability"

  environment          = var.environment
  team_tag             = var.team_tag
  name_tag             = var.name_tag
  log_retention_days   = var.log_retention_days
  lambda_function_name = module.lambda.function_name
  rest_api_id          = module.api_gateway.rest_api_id
  ws_api_id            = module.api_gateway.ws_api_id
  lambda_timeout       = var.lambda_timeout
  sns_email            = var.sns_email
}
