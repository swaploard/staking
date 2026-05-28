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

resource "aws_iam_role" "task_execution" {
  name = "${var.name_prefix}-task-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = var.common_tags
}

resource "aws_iam_role_policy_attachment" "task_execution" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "task_execution_secrets" {
  count = length(var.secrets) > 0 ? 1 : 0

  name = "${var.name_prefix}-read-secrets"
  role = aws_iam_role.task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "ssm:GetParameters"
        ]
        Resource = values(var.secrets)
      }
    ]
  })
}

resource "aws_iam_role" "task" {
  name = "${var.name_prefix}-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = var.common_tags
}
