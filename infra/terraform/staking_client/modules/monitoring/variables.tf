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
