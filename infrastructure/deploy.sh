#!/bin/bash
# BloxGrid AWS Deployment Script

set -e

echo "=== BloxGrid AWS Deployment ==="

# Variables
AWS_REGION=${AWS_REGION:-us-east-1}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BACKEND_REPO="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/bloxgrid-backend"
FRONTEND_REPO="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/bloxgrid-frontend"

# Step 1: Build and push backend
echo "Building backend Docker image..."
cd ../backend
docker build -t bloxgrid-backend:latest .

echo "Logging into ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

echo "Tagging and pushing backend image..."
docker tag bloxgrid-backend:latest $BACKEND_REPO:latest
docker push $BACKEND_REPO:latest

# Step 2: Build and push frontend
echo "Building frontend Docker image..."
cd ../frontend
docker build -t bloxgrid-frontend:latest .

echo "Tagging and pushing frontend image..."
docker tag bloxgrid-frontend:latest $FRONTEND_REPO:latest
docker push $FRONTEND_REPO:latest

# Step 3: Apply Terraform
echo "Deploying infrastructure with Terraform..."
cd ../infrastructure/terraform

terraform init
terraform plan -var="backend_image=$BACKEND_REPO:latest" -var="frontend_image=$FRONTEND_REPO:latest"
terraform apply -var="backend_image=$BACKEND_REPO:latest" -var="frontend_image=$FRONTEND_REPO:latest" -auto-approve

# Step 4: Get outputs
echo "=== Deployment Complete ==="
echo ""
echo "Load Balancer URL: http://$(terraform output -raw alb_dns_name)"
echo "RDS Endpoint: $(terraform output -raw rds_endpoint)"
echo "S3 Bucket: $(terraform output -raw s3_bucket_name)"
echo ""
echo "Next steps:"
echo "1. Configure DNS to point to the load balancer"
echo "2. Set up SSL certificate with ACM"
echo "3. Update environment variables in ECS task definitions"
echo "4. Run database migrations"
