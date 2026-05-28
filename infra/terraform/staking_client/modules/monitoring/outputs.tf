output "log_group_name" {
  description = "CloudWatch log group name created for ECS task logs."
  value       = aws_cloudwatch_log_group.app.name
}
