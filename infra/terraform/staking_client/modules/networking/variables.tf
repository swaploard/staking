variable "name_prefix" {
  description = "Resource name prefix for networking resources."
  type        = string
}

variable "common_tags" {
  description = "Common tags to apply to networking resources."
  type        = map(string)
  default     = {}
}

variable "allowed_http_cidr_blocks" {
  description = "CIDR blocks allowed to reach the public load balancer."
  type        = list(string)
}

variable "container_port" {
  description = "Port exposed by the container."
  type        = number
}

variable "health_check_path" {
  description = "HTTP path the load balancer uses for target health checks."
  type        = string
}

variable "certificate_arn" {
  description = "Optional ACM certificate ARN for HTTPS."
  type        = string
  default     = ""
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets."
  type        = list(string)
}

variable "enable_flow_logs" {
  description = "Enable VPC Flow Logs."
  type        = bool
  default     = true
}
