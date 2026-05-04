# =============================================================================
# Outputs for API Gateway module
# =============================================================================

output "rest_api_id" {
  description = "ID of the REST API Gateway"
  value       = aws_api_gateway_rest_api.this.id
}

output "rest_api_url" {
  description = "Invoke URL of the REST API Gateway (Prod stage)"
  value       = "https://${aws_api_gateway_rest_api.this.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${aws_api_gateway_stage.this.stage_name}/"
}

output "ws_api_id" {
  description = "ID of the WebSocket API Gateway"
  value       = aws_apigatewayv2_api.websocket.id
}

output "ws_api_url" {
  description = "URL of the WebSocket API Gateway (Prod stage)"
  value       = "wss://${aws_apigatewayv2_api.websocket.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${aws_apigatewayv2_stage.websocket.name}"
}

output "rest_api_stage_name" {
  description = "Name of the REST API Gateway stage"
  value       = aws_api_gateway_stage.this.stage_name
}
