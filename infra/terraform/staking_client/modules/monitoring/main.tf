variable "name_prefix" {
  description = "Resource name prefix for monitoring resources."
  type        = string
}

variable "common_tags" {
  description = "Common tags to apply to monitoring resources."
  type        = map(string)
  default     = {}
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days."
  type        = number
}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${var.name_prefix}"
  retention_in_days = var.log_retention_days

  tags = var.common_tags
}
