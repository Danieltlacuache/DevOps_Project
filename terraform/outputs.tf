# =============================================================================
# CondoManager Pro — Root Terraform Outputs
# =============================================================================
# Key URLs and resource names exposed for use by CI/CD pipelines, scripts,
# and other consumers.
# =============================================================================

output "api_url" {
  description = "Invoke URL of the REST API Gateway"
  value       = module.api_gateway.rest_api_url
}

output "websocket_url" {
  description = "URL of the WebSocket API Gateway"
  value       = module.api_gateway.ws_api_url
}

output "photos_cdn_url" {
  description = "CloudFront CDN domain name for the photos distribution"
  value       = module.storage.photos_cdn_domain
}

output "frontend_cdn_url" {
  description = "CloudFront CDN domain name for the frontend distribution"
  value       = module.storage.frontend_cdn_domain
}

output "frontend_bucket_name" {
  description = "Name of the S3 bucket hosting the frontend assets"
  value       = module.storage.frontend_bucket_name
}

output "frontend_cf_distribution_id" {
  description = "ID of the CloudFront distribution for the frontend"
  value       = module.storage.frontend_cf_distribution_id
}

output "lambda_function_name" {
  description = "Name of the Lambda function"
  value       = module.lambda.function_name
}

output "dashboard_name" {
  description = "Name of the CloudWatch dashboard"
  value       = module.observability.dashboard_name
}

output "sns_topic_arn" {
  description = "ARN of the SNS topic for alarm notifications"
  value       = module.observability.sns_topic_arn
}
