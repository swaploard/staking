variable "name_prefix" {
  description = "Resource name prefix for ECS resources."
  type        = string
}

variable "app_name" {
  description = "Application name used for the container and log prefix."
  type        = string
}

variable "common_tags" {
  description = "Common tags to apply to ECS resources."
  type        = map(string)
  default     = {}
}

variable "aws_region" {
  description = "AWS region used by ECS logging."
  type        = string
}

variable "container_cpu" {
  description = "Fargate task CPU units."
  type        = number
}

variable "container_memory" {
  description = "Fargate task memory in MiB."
  type        = number
}

variable "desired_count" {
  description = "Number of ECS tasks to run."
  type        = number
}

variable "container_port" {
  description = "Port exposed by the container."
  type        = number
}

variable "image" {
  description = "Full container image URI to deploy."
  type        = string
}

variable "environment" {
  description = "Plain environment variables for the container."
  type        = map(string)
  default     = {}
}

variable "secrets" {
  description = "Container secrets as ENV_NAME => ARN of secret/parameter."
  type        = map(string)
  default     = {}
}

variable "log_group_name" {
  description = "CloudWatch log group name for ECS logs."
  type        = string
}

variable "execution_role_arn" {
  description = "ARN of the ECS task execution role."
  type        = string
}

variable "task_role_arn" {
  description = "ARN of the ECS task role."
  type        = string
}

variable "subnet_ids" {
  description = "Subnets where ECS tasks will be deployed."
  type        = list(string)
}

variable "security_group_ids" {
  description = "Security group IDs allowed for ECS tasks."
  type        = list(string)
}

variable "target_group_arn" {
  description = "Target group ARN for the load balancer."
  type        = string
}

variable "enable_autoscaling" {
  description = "Enable ECS Service Auto Scaling."
  type        = bool
  default     = true
}

variable "autoscaling_max_capacity" {
  description = "Maximum number of ECS tasks when auto-scaling."
  type        = number
  default     = 4
}

variable "autoscaling_cpu_target" {
  description = "Average CPU utilization target for auto-scaling (percent)."
  type        = number
  default     = 70
}

variable "health_check_path" {
  description = "Container health check path."
  type        = string
  default     = "/"
}
