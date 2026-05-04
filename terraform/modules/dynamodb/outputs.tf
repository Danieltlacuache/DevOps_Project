# =============================================================================
# Individual table name outputs
# =============================================================================

output "users_table_name" {
  description = "Name of the Users table"
  value       = aws_dynamodb_table.users.name
}

output "admin_tokens_table_name" {
  description = "Name of the AdminTokens table"
  value       = aws_dynamodb_table.admin_tokens.name
}

output "connections_table_name" {
  description = "Name of the Connections table"
  value       = aws_dynamodb_table.connections.name
}

output "announcements_table_name" {
  description = "Name of the Announcements table"
  value       = aws_dynamodb_table.announcements.name
}

output "amenities_table_name" {
  description = "Name of the Amenities table"
  value       = aws_dynamodb_table.amenities.name
}

output "condos_table_name" {
  description = "Name of the Condos table"
  value       = aws_dynamodb_table.condos.name
}

output "units_table_name" {
  description = "Name of the Units table"
  value       = aws_dynamodb_table.units.name
}

output "residents_table_name" {
  description = "Name of the Residents table"
  value       = aws_dynamodb_table.residents.name
}

output "fees_table_name" {
  description = "Name of the Fees table"
  value       = aws_dynamodb_table.fees.name
}

output "incidents_table_name" {
  description = "Name of the Incidents table"
  value       = aws_dynamodb_table.incidents.name
}

output "maintenance_tasks_table_name" {
  description = "Name of the MaintenanceTasks table"
  value       = aws_dynamodb_table.maintenance_tasks.name
}

output "amenity_reservations_table_name" {
  description = "Name of the AmenityReservations table"
  value       = aws_dynamodb_table.amenity_reservations.name
}

# =============================================================================
# Individual table ARN outputs
# =============================================================================

output "users_table_arn" {
  description = "ARN of the Users table"
  value       = aws_dynamodb_table.users.arn
}

output "admin_tokens_table_arn" {
  description = "ARN of the AdminTokens table"
  value       = aws_dynamodb_table.admin_tokens.arn
}

output "connections_table_arn" {
  description = "ARN of the Connections table"
  value       = aws_dynamodb_table.connections.arn
}

output "announcements_table_arn" {
  description = "ARN of the Announcements table"
  value       = aws_dynamodb_table.announcements.arn
}

output "amenities_table_arn" {
  description = "ARN of the Amenities table"
  value       = aws_dynamodb_table.amenities.arn
}

output "condos_table_arn" {
  description = "ARN of the Condos table"
  value       = aws_dynamodb_table.condos.arn
}

output "units_table_arn" {
  description = "ARN of the Units table"
  value       = aws_dynamodb_table.units.arn
}

output "residents_table_arn" {
  description = "ARN of the Residents table"
  value       = aws_dynamodb_table.residents.arn
}

output "fees_table_arn" {
  description = "ARN of the Fees table"
  value       = aws_dynamodb_table.fees.arn
}

output "incidents_table_arn" {
  description = "ARN of the Incidents table"
  value       = aws_dynamodb_table.incidents.arn
}

output "maintenance_tasks_table_arn" {
  description = "ARN of the MaintenanceTasks table"
  value       = aws_dynamodb_table.maintenance_tasks.arn
}

output "amenity_reservations_table_arn" {
  description = "ARN of the AmenityReservations table"
  value       = aws_dynamodb_table.amenity_reservations.arn
}

# =============================================================================
# Map of all table ARNs (for IAM policies)
# =============================================================================

output "all_table_arns" {
  description = "Map of all DynamoDB table ARNs"
  value = {
    users                = aws_dynamodb_table.users.arn
    admin_tokens         = aws_dynamodb_table.admin_tokens.arn
    connections          = aws_dynamodb_table.connections.arn
    announcements        = aws_dynamodb_table.announcements.arn
    amenities            = aws_dynamodb_table.amenities.arn
    condos               = aws_dynamodb_table.condos.arn
    units                = aws_dynamodb_table.units.arn
    residents            = aws_dynamodb_table.residents.arn
    fees                 = aws_dynamodb_table.fees.arn
    incidents            = aws_dynamodb_table.incidents.arn
    maintenance_tasks    = aws_dynamodb_table.maintenance_tasks.arn
    amenity_reservations = aws_dynamodb_table.amenity_reservations.arn
  }
}
