output "ecs_cluster_name" {
  description = "ECS cluster name created for the application."
  value       = aws_ecs_cluster.app.name
}

output "ecs_service_name" {
  description = "ECS service name created for the application."
  value       = aws_ecs_service.app.name
}
