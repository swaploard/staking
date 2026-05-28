# staking_client AWS Terraform

This stack deploys `staking_client` to AWS ECS Fargate behind an Application Load Balancer.

It creates:

- ECR repository with image scanning and lifecycle policy
- VPC with public subnets (ALB), private subnets (ECS), NAT Gateway, and VPC Flow Logs
- Application Load Balancer with optional HTTPS
- ECS cluster (Fargate), task definition, and service with auto-scaling
- CloudWatch log group and metric alarms (CPU, memory)
- IAM roles for ECS task execution and task permissions
- S3 backend for Terraform state with DynamoDB locking

## Prerequisites

- Terraform >= 1.6
- AWS credentials configured
- S3 bucket and DynamoDB table for state locking (see Bootstrap below)

## Bootstrap (first time only)

Create the S3 backend bucket and DynamoDB lock table:

```bash
aws s3 mb s3://staking-client-terraform-state --region us-east-1
aws s3api put-bucket-versioning \
  --bucket staking-client-terraform-state \
  --versioning-configuration Status=Enabled
aws dynamodb create-table \
  --table-name staking-client-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

## Deploy

1. Initialize Terraform:

   ```bash
   cd infra/terraform/staking_client
   terraform init -backend-config="bucket=staking-client-terraform-state"
   ```

2. Select environment and apply:

   ```bash
   terraform apply -var-file="environments/dev/terraform.tfvars"
   ```

3. Push a Docker image to ECR:

   ```bash
   eval $(terraform output -raw ecr_repository_url | awk '{split($0, a, "."); print "AWS_REGION="a[4]; print "ECR_URL="$0}')
   aws ecr get-login-password --region "$AWS_REGION" \
     | docker login --username AWS --password-stdin "$(echo $ECR_URL | cut -d/ -f1)"

   docker build \
     --build-arg NEXT_PUBLIC_RPC_URL="https://api.devnet.solana.com" \
     -f ../../../staking_client/Dockerfile \
     -t staking-client:latest \
     ../../..
   docker tag staking-client:latest "$ECR_URL:latest"
   docker push "$ECR_URL:latest"
   ```

4. Force ECS to pull the pushed image:

   ```bash
   aws ecs update-service \
     --region "$AWS_REGION" \
     --cluster "$(terraform output -raw ecs_cluster_name)" \
     --service "$(terraform output -raw ecs_service_name)" \
     --force-new-deployment
   ```

5. Open the app:

   ```bash
   terraform output -raw app_url
   ```

## Configuration

### Environment-specific values

Use the tfvar files under `environments/`:

```bash
terraform apply -var-file="environments/dev/terraform.tfvars"
terraform apply -var-file="environments/staging/terraform.tfvars"
terraform apply -var-file="environments/prod/terraform.tfvars"
```

### Runtime environment variables

Set public values in `environment`:

```hcl
environment = {
  NODE_ENV             = "production"
  NEXT_PUBLIC_RPC_URL = "https://api.devnet.solana.com"
}
```

Set sensitive values through AWS Secrets Manager or SSM Parameter Store, then map them in `secrets`:

```hcl
secrets = {
  DATABASE_URL = "arn:aws:secretsmanager:us-east-1:123456789012:secret:staking-client/database-url-AbCdEf"
}
```

If you have an ACM certificate, set `certificate_arn` to enable HTTPS. Without it, the stack serves HTTP on the load balancer DNS name.

## Notes

Next.js embeds `NEXT_PUBLIC_*` variables into client-side JavaScript at build time. If `NEXT_PUBLIC_RPC_URL` must differ by environment, pass it into the Docker build as well as the ECS task runtime environment.
