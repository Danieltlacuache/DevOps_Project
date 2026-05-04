# =============================================================================
# DynamoDB Tables for CondoManager Pro
# 12 tables migrated from SAM template with environment prefix
# =============================================================================

# --- Simple tables (no GSIs) ---

resource "aws_dynamodb_table" "users" {
  name         = "${var.environment}-Users"
  billing_mode = var.billing_mode

  hash_key = "email"

  attribute {
    name = "email"
    type = "S"
  }

  tags = {
    Environment = var.environment
    Module      = "dynamodb"
  }
}

resource "aws_dynamodb_table" "admin_tokens" {
  name         = "${var.environment}-AdminTokens"
  billing_mode = var.billing_mode

  hash_key = "token"

  attribute {
    name = "token"
    type = "S"
  }

  tags = {
    Environment = var.environment
    Module      = "dynamodb"
  }
}

resource "aws_dynamodb_table" "connections" {
  name         = "${var.environment}-Connections"
  billing_mode = var.billing_mode

  hash_key = "connectionId"

  attribute {
    name = "connectionId"
    type = "S"
  }

  tags = {
    Environment = var.environment
    Module      = "dynamodb"
  }
}

resource "aws_dynamodb_table" "announcements" {
  name         = "${var.environment}-Announcements"
  billing_mode = var.billing_mode

  hash_key = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = {
    Environment = var.environment
    Module      = "dynamodb"
  }
}

resource "aws_dynamodb_table" "amenities" {
  name         = "${var.environment}-Amenities"
  billing_mode = var.billing_mode

  hash_key = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = {
    Environment = var.environment
    Module      = "dynamodb"
  }
}

# --- Tables with GSIs ---

resource "aws_dynamodb_table" "condos" {
  name         = "${var.environment}-Condos"
  billing_mode = var.billing_mode

  hash_key = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "popularidad"
    type = "N"
  }

  global_secondary_index {
    name            = "PopularityIndex"
    hash_key        = "popularidad"
    projection_type = "ALL"
  }

  tags = {
    Environment = var.environment
    Module      = "dynamodb"
  }
}

resource "aws_dynamodb_table" "units" {
  name         = "${var.environment}-Units"
  billing_mode = var.billing_mode

  hash_key = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "condo_id"
    type = "S"
  }

  attribute {
    name = "estado"
    type = "S"
  }

  global_secondary_index {
    name            = "CondoIndex"
    hash_key        = "condo_id"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "EstadoIndex"
    hash_key        = "estado"
    projection_type = "ALL"
  }

  tags = {
    Environment = var.environment
    Module      = "dynamodb"
  }
}

resource "aws_dynamodb_table" "residents" {
  name         = "${var.environment}-Residents"
  billing_mode = var.billing_mode

  hash_key = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "email"
    type = "S"
  }

  global_secondary_index {
    name            = "EmailIndex"
    hash_key        = "email"
    projection_type = "ALL"
  }

  tags = {
    Environment = var.environment
    Module      = "dynamodb"
  }
}

resource "aws_dynamodb_table" "fees" {
  name         = "${var.environment}-Fees"
  billing_mode = var.billing_mode

  hash_key = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "email"
    type = "S"
  }

  global_secondary_index {
    name            = "EmailIndex"
    hash_key        = "email"
    projection_type = "ALL"
  }

  tags = {
    Environment = var.environment
    Module      = "dynamodb"
  }
}

resource "aws_dynamodb_table" "incidents" {
  name         = "${var.environment}-Incidents"
  billing_mode = var.billing_mode

  hash_key = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "residente"
    type = "S"
  }

  global_secondary_index {
    name            = "ResidenteIndex"
    hash_key        = "residente"
    projection_type = "ALL"
  }

  tags = {
    Environment = var.environment
    Module      = "dynamodb"
  }
}

resource "aws_dynamodb_table" "maintenance_tasks" {
  name         = "${var.environment}-MaintenanceTasks"
  billing_mode = var.billing_mode

  hash_key = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "assigned_to"
    type = "S"
  }

  global_secondary_index {
    name            = "AssignedToIndex"
    hash_key        = "assigned_to"
    projection_type = "ALL"
  }

  tags = {
    Environment = var.environment
    Module      = "dynamodb"
  }
}

resource "aws_dynamodb_table" "amenity_reservations" {
  name         = "${var.environment}-AmenityReservations"
  billing_mode = var.billing_mode

  hash_key = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "amenity_id"
    type = "S"
  }

  attribute {
    name = "email"
    type = "S"
  }

  global_secondary_index {
    name            = "AmenityIndex"
    hash_key        = "amenity_id"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "EmailIndex"
    hash_key        = "email"
    projection_type = "ALL"
  }

  tags = {
    Environment = var.environment
    Module      = "dynamodb"
  }
}
