variable "name_prefix" {
  description = "Resource name prefix for IAM resources."
  type        = string
}

variable "common_tags" {
  description = "Common tags to apply to IAM resources."
  type        = map(string)
  default     = {}
}

variable "secrets" {
  description = "Secrets Manager or SSM secret ARNs for the ECS task."
  type        = map(string)
  default     = {}
}
