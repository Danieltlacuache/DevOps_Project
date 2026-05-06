# =============================================================================
# Observability — CloudWatch, SNS Alarms, Dashboard for CondoManager Pro
# Log groups, alarms, dashboard widgets, SNS notifications
# =============================================================================

# =============================================================================
# SNS Topic for Alarm Notifications
# =============================================================================

resource "aws_sns_topic" "alarms" {
  name = "${var.environment}-condomanager-alarms"

  tags = {
    Team        = var.team_tag
    Name        = var.name_tag
    Environment = var.environment
    Module      = "observability"
  }
}

resource "aws_sns_topic_subscription" "email" {
  count = var.sns_email != "" ? 1 : 0

  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.sns_email
}

# =============================================================================
# CloudWatch Alarm — Lambda Errors
# =============================================================================

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "${var.environment}-condomanager-lambda-errors"
  alarm_description   = "Alarm when Lambda function errors exceed threshold"
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"

  dimensions = {
    FunctionName = var.lambda_function_name
  }

  alarm_actions = [aws_sns_topic.alarms.arn]

  tags = {
    Team        = var.team_tag
    Name        = var.name_tag
    Environment = var.environment
    Module      = "observability"
  }
}

# =============================================================================
# CloudWatch Alarm — Lambda Duration (> 80% of timeout)
# =============================================================================

resource "aws_cloudwatch_metric_alarm" "lambda_duration" {
  alarm_name          = "${var.environment}-condomanager-lambda-duration"
  alarm_description   = "Alarm when Lambda duration exceeds 80% of timeout"
  namespace           = "AWS/Lambda"
  metric_name         = "Duration"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 1
  threshold           = var.lambda_timeout * 1000 * 0.8
  comparison_operator = "GreaterThanThreshold"

  dimensions = {
    FunctionName = var.lambda_function_name
  }

  alarm_actions = [aws_sns_topic.alarms.arn]

  tags = {
    Team        = var.team_tag
    Name        = var.name_tag
    Environment = var.environment
    Module      = "observability"
  }
}

# =============================================================================
# CloudWatch Dashboard
# =============================================================================

resource "aws_cloudwatch_dashboard" "this" {
  dashboard_name = "CondoManager-${var.environment}-Dashboard"

  dashboard_body = jsonencode({
    widgets = [
      # --- Lambda Invocations (per minute) ---
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "Lambda Invocations"
          region = data.aws_region.current.name
          period = 60
          stat   = "Sum"
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", var.lambda_function_name]
          ]
        }
      },
      # --- Lambda Duration (P50, P90, P99) ---
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "Lambda Duration"
          region = data.aws_region.current.name
          period = 60
          metrics = [
            ["AWS/Lambda", "Duration", "FunctionName", var.lambda_function_name, { stat = "p50", label = "P50" }],
            ["AWS/Lambda", "Duration", "FunctionName", var.lambda_function_name, { stat = "p90", label = "P90" }],
            ["AWS/Lambda", "Duration", "FunctionName", var.lambda_function_name, { stat = "p99", label = "P99" }]
          ]
        }
      },
      # --- Lambda Errors ---
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "Lambda Errors"
          region = data.aws_region.current.name
          period = 60
          stat   = "Sum"
          metrics = [
            ["AWS/Lambda", "Errors", "FunctionName", var.lambda_function_name]
          ]
        }
      },
      # --- Lambda Throttles ---
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "Lambda Throttles"
          region = data.aws_region.current.name
          period = 60
          stat   = "Sum"
          metrics = [
            ["AWS/Lambda", "Throttles", "FunctionName", var.lambda_function_name]
          ]
        }
      },
      # --- API Gateway 4xx Count ---
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 8
        height = 6
        properties = {
          title  = "API Gateway 4xx Errors"
          region = data.aws_region.current.name
          period = 60
          stat   = "Sum"
          metrics = [
            ["AWS/ApiGateway", "4XXError", "ApiName", "${var.environment}-CondoManager-REST"]
          ]
        }
      },
      # --- API Gateway 5xx Count ---
      {
        type   = "metric"
        x      = 8
        y      = 12
        width  = 8
        height = 6
        properties = {
          title  = "API Gateway 5xx Errors"
          region = data.aws_region.current.name
          period = 60
          stat   = "Sum"
          metrics = [
            ["AWS/ApiGateway", "5XXError", "ApiName", "${var.environment}-CondoManager-REST"]
          ]
        }
      },
      # --- API Gateway Latency ---
      {
        type   = "metric"
        x      = 16
        y      = 12
        width  = 8
        height = 6
        properties = {
          title  = "API Gateway Latency"
          region = data.aws_region.current.name
          period = 60
          metrics = [
            ["AWS/ApiGateway", "Latency", "ApiName", "${var.environment}-CondoManager-REST", { stat = "Average", label = "Average" }],
            ["AWS/ApiGateway", "Latency", "ApiName", "${var.environment}-CondoManager-REST", { stat = "p90", label = "P90" }]
          ]
        }
      }
    ]
  })
}

# =============================================================================
# Data Sources
# =============================================================================

data "aws_region" "current" {}

# =============================================================================
# CloudWatch Log Group for API Gateway
# =============================================================================

resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${var.environment}-rest-api"
  retention_in_days = var.log_retention_days

  tags = {
    Team        = var.team_tag
    Name        = var.name_tag
    Environment = var.environment
    Module      = "observability"
  }
}
