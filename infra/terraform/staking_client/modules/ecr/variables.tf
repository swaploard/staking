variable "name_prefix" {
  description = "Resource name prefix for the ECR repository."
  type        = string
}

variable "common_tags" {
  description = "Common tags to apply to ECR resources."
  type        = map(string)
  default     = {}
}
