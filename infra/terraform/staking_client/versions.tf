terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "staking-client-terraform-state"
    key            = "staking-client/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "staking-client-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region
}
