variable "aws_region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "us-east-1"
  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-\\d{1}$", var.aws_region))
    error_message = "Must be a valid AWS region (e.g. us-east-1)."
  }
}

variable "app_name" {
  description = "Name used for AWS resources."
  type        = string
  default     = "staking-client"
}

variable "environment_name" {
  description = "Deployment environment name used in tags."
  type        = string
  default     = "prod"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.40.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets. At least two are recommended for the load balancer."
  type        = list(string)
  default     = ["10.40.0.0/24", "10.40.1.0/24"]
}

variable "allowed_http_cidr_blocks" {
  description = "CIDR blocks allowed to reach the public load balancer."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "container_port" {
  description = "Port exposed by the staking_client container."
  type        = number
  default     = 3000
}

variable "container_cpu" {
  description = "Fargate task CPU units."
  type        = number
  default     = 512
  validation {
    condition     = contains([256, 512, 1024, 2048, 4096, 8192, 16384], var.container_cpu)
    error_message = "Must be a valid Fargate CPU value: 256, 512, 1024, 2048, 4096, 8192, or 16384."
  }
}

variable "container_memory" {
  description = "Fargate task memory in MiB."
  type        = number
  default     = 1024
  validation {
    condition     = var.container_memory >= 512 && var.container_memory <= 122880
    error_message = "Memory must be between 512 and 122880 MiB."
  }
}

variable "desired_count" {
  description = "Number of ECS tasks to run."
  type        = number
  default     = 1
  validation {
    condition     = var.desired_count >= 0
    error_message = "Desired count must be >= 0."
  }
}

variable "image_tag" {
  description = "Image tag to deploy from the Terraform-created ECR repository when image_uri is empty."
  type        = string
  default     = "latest"
}

variable "image_uri" {
  description = "Full container image URI. Leave empty to use the ECR repository created by this stack plus image_tag."
  type        = string
  default     = ""
}

variable "environment" {
  description = "Plain environment variables for the container. Do not put secrets here."
  type        = map(string)
  default = {
    NODE_ENV = "production"
  }
}

variable "secrets" {
  description = "Container secrets as ENV_NAME => Secrets Manager secret ARN or SSM parameter ARN."
  type        = map(string)
  default     = {}
}

variable "health_check_path" {
  description = "HTTP path the load balancer uses for target health checks."
  type        = string
  default     = "/"
}

variable "certificate_arn" {
  description = "Optional ACM certificate ARN. When set, HTTPS is enabled and HTTP redirects to HTTPS."
  type        = string
  default     = ""
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days."
  type        = number
  default     = 30
  validation {
    condition     = var.log_retention_days >= 1
    error_message = "Log retention must be at least 1 day."
  }
}

variable "tags" {
  description = "Extra tags applied to supported resources."
  type        = map(string)
  default     = {}
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
  validation {
    condition     = var.autoscaling_max_capacity >= 1
    error_message = "Max capacity must be at least 1."
  }
}

variable "autoscaling_cpu_target" {
  description = "Average CPU utilization target for auto-scaling (percent)."
  type        = number
  default     = 70
  validation {
    condition     = var.autoscaling_cpu_target >= 1 && var.autoscaling_cpu_target <= 100
    error_message = "CPU target must be between 1 and 100."
  }
}

variable "enable_flow_logs" {
  description = "Enable VPC Flow Logs."
  type        = bool
  default     = true
}
