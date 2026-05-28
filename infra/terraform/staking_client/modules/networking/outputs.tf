output "public_subnet_ids" {
  description = "IDs of the public subnets created for the load balancer."
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets created for ECS tasks."
  value       = aws_subnet.private[*].id
}

output "service_security_group_id" {
  description = "Security group ID used by ECS tasks."
  value       = aws_security_group.service.id
}

output "lb_target_group_arn" {
  description = "ARN of the Application Load Balancer target group."
  value       = aws_lb_target_group.app.arn
}

output "alb_dns_name" {
  description = "Public DNS name for the application load balancer."
  value       = aws_lb.app.dns_name
}
