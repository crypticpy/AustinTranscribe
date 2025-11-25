#!/usr/bin/env bash
# ============================================================================
# Meeting Transcriber - Azure Deployment Script
# ============================================================================
# Deploys the infrastructure and application to Azure
#
# Prerequisites:
#   - Azure CLI installed and logged in (az login)
#   - Bicep CLI installed (az bicep install)
#   - Docker installed (for image building)
#
# Usage:
#   ./deploy.sh [dev|staging|prod] [--build] [--push]
#
# Examples:
#   ./deploy.sh dev              # Deploy infrastructure only
#   ./deploy.sh prod --build     # Build Docker image and deploy
#   ./deploy.sh prod --push      # Build, push to ACR, and deploy
# ============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="${1:-dev}"
BUILD_IMAGE=false
PUSH_IMAGE=false
LOCATION="eastus"
BASE_NAME="mtranscriber"

# Parse arguments
shift || true
while [[ $# -gt 0 ]]; do
    case $1 in
        --build)
            BUILD_IMAGE=true
            shift
            ;;
        --push)
            BUILD_IMAGE=true
            PUSH_IMAGE=true
            shift
            ;;
        --location)
            LOCATION="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    echo -e "${RED}Error: Environment must be dev, staging, or prod${NC}"
    exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Meeting Transcriber - Azure Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Environment: ${GREEN}$ENVIRONMENT${NC}"
echo -e "Location:    ${GREEN}$LOCATION${NC}"
echo -e "Build Image: ${GREEN}$BUILD_IMAGE${NC}"
echo -e "Push Image:  ${GREEN}$PUSH_IMAGE${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v az &> /dev/null; then
    echo -e "${RED}Error: Azure CLI not found. Install from https://aka.ms/installazurecli${NC}"
    exit 1
fi

if ! az account show &> /dev/null; then
    echo -e "${RED}Error: Not logged in to Azure. Run 'az login' first${NC}"
    exit 1
fi

# Get current Azure context
SUBSCRIPTION=$(az account show --query name -o tsv)
echo -e "Subscription: ${GREEN}$SUBSCRIPTION${NC}"
echo ""

# Confirm deployment
read -p "Deploy to $ENVIRONMENT in $SUBSCRIPTION? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Deployment cancelled${NC}"
    exit 0
fi

# Change to infrastructure directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ============================================================================
# Deploy Infrastructure
# ============================================================================

echo ""
echo -e "${YELLOW}Deploying infrastructure...${NC}"

DEPLOYMENT_NAME="mtranscriber-${ENVIRONMENT}-$(date +%Y%m%d%H%M%S)"

az deployment sub create \
    --name "$DEPLOYMENT_NAME" \
    --location "$LOCATION" \
    --template-file main.bicep \
    --parameters "@parameters/${ENVIRONMENT}.bicepparam" \
    --output table

# Get deployment outputs
echo ""
echo -e "${YELLOW}Getting deployment outputs...${NC}"

RESOURCE_GROUP="rg-${BASE_NAME}-${ENVIRONMENT}"
ACR_NAME=$(az deployment sub show --name "$DEPLOYMENT_NAME" --query 'properties.outputs.containerRegistryLoginServer.value' -o tsv 2>/dev/null || echo "")
APP_URL=$(az deployment sub show --name "$DEPLOYMENT_NAME" --query 'properties.outputs.containerAppUrl.value' -o tsv 2>/dev/null || echo "")

echo -e "Resource Group: ${GREEN}$RESOURCE_GROUP${NC}"
echo -e "ACR Server:     ${GREEN}$ACR_NAME${NC}"
echo -e "App URL:        ${GREEN}$APP_URL${NC}"

# ============================================================================
# Build and Push Docker Image (if requested)
# ============================================================================

if [[ "$BUILD_IMAGE" == "true" ]]; then
    echo ""
    echo -e "${YELLOW}Building Docker image...${NC}"

    cd "$SCRIPT_DIR/.."

    # Build for AMD64 (Azure)
    docker buildx build \
        --platform linux/amd64 \
        -t meeting-transcriber:latest \
        -t meeting-transcriber:$(git rev-parse --short HEAD 2>/dev/null || echo "local") \
        .

    if [[ "$PUSH_IMAGE" == "true" && -n "$ACR_NAME" ]]; then
        echo ""
        echo -e "${YELLOW}Pushing to Azure Container Registry...${NC}"

        # Login to ACR
        az acr login --name "${ACR_NAME%%.*}"

        # Tag and push
        docker tag meeting-transcriber:latest "$ACR_NAME/meeting-transcriber:latest"
        docker push "$ACR_NAME/meeting-transcriber:latest"

        # Update Container App with new image
        echo ""
        echo -e "${YELLOW}Updating Container App...${NC}"

        az containerapp update \
            --name "ca-${BASE_NAME}-${ENVIRONMENT}" \
            --resource-group "$RESOURCE_GROUP" \
            --image "$ACR_NAME/meeting-transcriber:latest"
    fi
fi

# ============================================================================
# Summary
# ============================================================================

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Next steps:"
echo -e "1. Add secrets to Key Vault:"
echo -e "   ${BLUE}az keyvault secret set --vault-name kv-${BASE_NAME}-${ENVIRONMENT} --name azure-openai-api-key --value 'YOUR_KEY'${NC}"
echo -e "   ${BLUE}az keyvault secret set --vault-name kv-${BASE_NAME}-${ENVIRONMENT} --name azure-openai-endpoint --value 'YOUR_ENDPOINT'${NC}"
echo ""
echo -e "2. Push your Docker image:"
echo -e "   ${BLUE}./deploy.sh ${ENVIRONMENT} --push${NC}"
echo ""
if [[ -n "$APP_URL" ]]; then
    echo -e "3. Access your application:"
    echo -e "   ${BLUE}$APP_URL${NC}"
fi
