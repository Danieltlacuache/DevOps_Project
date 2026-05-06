# =============================================================================
# S3 Buckets + CloudFront Distributions for CondoManager Pro
# Photos bucket with CDN, Frontend bucket with website hosting and CDN
# =============================================================================

# --- Random suffix for globally unique bucket names ---

resource "random_id" "suffix" {
  byte_length = 4
}

# =============================================================================
# Photos Bucket + CloudFront
# =============================================================================

resource "aws_s3_bucket" "photos" {
  bucket = "${var.environment}-condomanager-photos-${random_id.suffix.hex}"
}

resource "aws_s3_bucket_public_access_block" "photos" {
  bucket = aws_s3_bucket.photos.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "photos" {
  bucket = aws_s3_bucket.photos.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE"]
    allowed_origins = ["*"]
  }
}

resource "aws_cloudfront_distribution" "photos" {
  enabled = true

  origin {
    domain_name = aws_s3_bucket.photos.bucket_regional_domain_name
    origin_id   = "S3PhotosOrigin"
  }

  default_cache_behavior {
    target_origin_id       = "S3PhotosOrigin"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Team        = var.team_tag
    Name        = var.name_tag
    Environment = var.environment
    Module      = "storage"
  }
}

# =============================================================================
# Frontend Bucket + CloudFront
# =============================================================================

resource "aws_s3_bucket" "frontend" {
  bucket = "${var.environment}-condomanager-frontend-${random_id.suffix.hex}"
}

resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  index_document {
    suffix = "index.html"
  }
}

# --- OAC for CloudFront to access private S3 frontend bucket ---

resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.environment}-frontend-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_s3_bucket_policy" "frontend_cf" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.frontend.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
          }
        }
      }
    ]
  })
}

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  default_root_object = "index.html"

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "S3FrontendOrigin"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  default_cache_behavior {
    target_origin_id       = "S3FrontendOrigin"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Team        = var.team_tag
    Name        = var.name_tag
    Environment = var.environment
    Module      = "storage"
  }
}
