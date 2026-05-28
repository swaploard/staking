locals {
  name_prefix = "${var.app_name}-${var.environment_name}"
  image       = var.image_uri != "" ? var.image_uri : "${module.ecr.repository_url}:${var.image_tag}"

  common_tags = merge(
    {
      Application = var.app_name
      Environment = var.environment_name
      ManagedBy   = "terraform"
    },
    var.tags,
  )
}

module "ecr" {
  source      = "./modules/ecr"
  name_prefix = local.name_prefix
  common_tags = local.common_tags
}

module "networking" {
  source                   = "./modules/networking"
  name_prefix              = local.name_prefix
  common_tags              = local.common_tags
  allowed_http_cidr_blocks = var.allowed_http_cidr_blocks
  container_port           = var.container_port
  health_check_path        = var.health_check_path
  certificate_arn          = var.certificate_arn
  vpc_cidr                  = var.vpc_cidr
  public_subnet_cidrs       = var.public_subnet_cidrs
  enable_flow_logs          = var.enable_flow_logs
}

module "monitoring" {
  source            = "./modules/monitoring"
  name_prefix       = local.name_prefix
  common_tags       = local.common_tags
  log_retention_days = var.log_retention_days
}

module "iam" {
  source      = "./modules/iam"
  name_prefix = local.name_prefix
  common_tags = local.common_tags
  secrets     = var.secrets
}

module "ecs" {
  source             = "./modules/ecs"
  name_prefix        = local.name_prefix
  app_name           = var.app_name
  common_tags        = local.common_tags
  aws_region         = var.aws_region
  container_cpu      = var.container_cpu
  container_memory   = var.container_memory
  desired_count      = var.desired_count
  container_port     = var.container_port
  image              = local.image
  environment        = var.environment
  secrets            = var.secrets
  log_group_name     = module.monitoring.log_group_name
  execution_role_arn = module.iam.execution_role_arn
  task_role_arn      = module.iam.task_role_arn
  subnet_ids         = module.networking.private_subnet_ids
  security_group_ids = [module.networking.service_security_group_id]
  target_group_arn   = module.networking.lb_target_group_arn
  enable_autoscaling = var.enable_autoscaling
  autoscaling_max_capacity = var.autoscaling_max_capacity
  autoscaling_cpu_target   = var.autoscaling_cpu_target
  health_check_path        = var.health_check_path
}
