# =============================================================================
# Outputs for Storage module
# =============================================================================

output "photos_bucket_name" {
  description = "Name of the S3 photos bucket"
  value       = aws_s3_bucket.photos.id
}

output "photos_bucket_arn" {
  description = "ARN of the S3 photos bucket"
  value       = aws_s3_bucket.photos.arn
}

output "photos_cdn_domain" {
  description = "Domain name of the CloudFront distribution for photos"
  value       = aws_cloudfront_distribution.photos.domain_name
}

output "frontend_bucket_name" {
  description = "Name of the S3 frontend bucket"
  value       = aws_s3_bucket.frontend.id
}

output "frontend_cdn_domain" {
  description = "Domain name of the CloudFront distribution for frontend"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "frontend_cf_distribution_id" {
  description = "ID of the CloudFront distribution for frontend"
  value       = aws_cloudfront_distribution.frontend.id
}

output "photos_cf_distribution_id" {
  description = "ID of the CloudFront distribution for photos"
  value       = aws_cloudfront_distribution.photos.id
}
