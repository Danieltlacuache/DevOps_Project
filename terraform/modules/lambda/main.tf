# =============================================================================
# Lambda Function + IAM Role for CondoManager Pro
# Docker image from Docker Hub, X-Ray tracing, CloudWatch logs
# =============================================================================

# --- IAM Role for Lambda ---

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

resource "aws_iam_role" "lambda" {
  name = "${var.environment}-condomanager-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Environment = var.environment
    Module      = "lambda"
  }
}

# --- IAM Policy ---

resource "aws_iam_role_policy" "lambda" {
  name = "${var.environment}-condomanager-lambda-policy"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # DynamoDB — full access to all table ARNs and their indexes
      {
        Effect = "Allow"
        Action = "dynamodb:*"
        Resource = flatten([
          values(var.all_table_arns),
          [for arn in values(var.all_table_arns) : "${arn}/index/*"]
        ])
      },
      # S3 — full access to photos bucket
      {
        Effect = "Allow"
        Action = "s3:*"
        Resource = [
          var.bucket_arn,
          "${var.bucket_arn}/*"
        ]
      },
      # Secrets Manager — read access
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = var.secret_arn
      },
      # API Gateway Management API — invoke for WebSocket
      {
        Effect = "Allow"
        Action = [
          "execute-api:ManageConnections",
          "execute-api:Invoke"
        ]
        Resource = "arn:aws:execute-api:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*/*"
      },
      # X-Ray — write access
      {
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
          "xray:GetSamplingRules",
          "xray:GetSamplingTargets",
          "xray:GetSamplingStatisticSummaries"
        ]
        Resource = "*"
      },
      # CloudWatch Logs — create and put
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"
      }
    ]
  })
}

# --- Lambda Function ---

resource "aws_lambda_function" "this" {
  function_name = "${var.environment}-CondoManager"
  role          = aws_iam_role.lambda.arn
  package_type  = "Image"
  image_uri     = "${var.dockerhub_username}/condomanager-backend:${var.image_tag}"
  memory_size   = var.memory_size
  timeout       = var.timeout

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      USERS_TABLE                = var.users_table_name
      RESIDENTS_TABLE            = var.residents_table_name
      CONDOS_TABLE               = var.condos_table_name
      UNITS_TABLE                = var.units_table_name
      ADMIN_TOKENS_TABLE         = var.admin_tokens_table_name
      CONNECTIONS_TABLE          = var.connections_table_name
      MAINTENANCE_TASKS_TABLE    = var.maintenance_tasks_table_name
      ANNOUNCEMENTS_TABLE        = var.announcements_table_name
      INCIDENTS_TABLE            = var.incidents_table_name
      FEES_TABLE                 = var.fees_table_name
      AMENITIES_TABLE            = var.amenities_table_name
      AMENITY_RESERVATIONS_TABLE = var.amenity_reservations_table_name
      PHOTOS_BUCKET              = var.bucket_name
      SECRET_ID                  = var.secret_id
      WEBSOCKET_URL              = var.websocket_url
      CDN_DOMAIN                 = var.cdn_domain
    }
  }

  tags = {
    Environment = var.environment
    Module      = "lambda"
  }
}

# --- CloudWatch Log Group ---

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${aws_lambda_function.this.function_name}"
  retention_in_days = var.log_retention_days

  tags = {
    Environment = var.environment
    Module      = "lambda"
  }
}
