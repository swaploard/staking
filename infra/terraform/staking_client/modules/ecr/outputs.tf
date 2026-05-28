output "repository_url" {
  description = "URL of the ECR repository created for staking_client."
  value       = aws_ecr_repository.app.repository_url
}
