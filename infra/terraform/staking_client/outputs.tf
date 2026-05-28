output "alb_dns_name" {
  description = "Public DNS name for the application load balancer."
  value       = module.networking.alb_dns_name
}

output "app_url" {
  description = "Application URL using the load balancer DNS name."
  value       = var.certificate_arn == "" ? "http://${module.networking.alb_dns_name}" : "https://${module.networking.alb_dns_name}"
}

output "ecr_repository_url" {
  description = "ECR repository URL for staking_client images."
  value       = module.ecr.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = module.ecs.ecs_cluster_name
}

output "ecs_service_name" {
  description = "ECS service name."
  value       = module.ecs.ecs_service_name
}

output "cloudwatch_log_group" {
  description = "CloudWatch log group for application logs."
  value       = module.monitoring.log_group_name
}
