# Environment Setup Guide

This guide will help you configure the Meeting Transcriber application with your OpenAI API credentials.

## Table of Contents

- [Overview](#overview)
- [Security Best Practices](#security-best-practices)
- [Azure OpenAI Setup](#azure-openai-setup)
- [Standard OpenAI Setup](#standard-openai-setup)
- [Environment Variables Reference](#environment-variables-reference)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

## Overview

The Meeting Transcriber requires access to OpenAI's APIs for:

- **Whisper**: Audio transcription
- **GPT-4**: Meeting analysis, summaries, and action item extraction

You can use either:

1. **Azure OpenAI Service** (Recommended for enterprise)
2. **Standard OpenAI API** (Alternative option)

All API credentials **must** be configured via server-side environment variables for security. Client-side API key storage has been removed to prevent credential exposure.

## Security Best Practices

**CRITICAL SECURITY REQUIREMENTS:**

- Never commit `.env.local` to version control
- Never expose API keys in client-side code
- Use different API keys for development and production
- Rotate API keys regularly (at least every 90 days)
- Monitor API usage for unexpected activity
- Set up spending limits in your provider dashboard
- Use API key restrictions when available
- Store production secrets in secure secret management systems (e.g., Azure Key Vault, AWS Secrets Manager)

## Azure OpenAI Setup

### Prerequisites

- Active Azure subscription
- Azure OpenAI resource created
- Whisper and GPT-4 models deployed

### Step 1: Create Azure OpenAI Resource

1. Go to [Azure Portal](https://portal.azure.com)
2. Search for "Azure OpenAI" and create a new resource
3. Choose your subscription, resource group, and region
4. Select pricing tier (typically Standard S0)
5. Wait for deployment to complete

### Step 2: Deploy Required Models

1. Navigate to your Azure OpenAI resource
2. Go to "Model deployments" or "Azure OpenAI Studio"
3. Deploy the following models:
   - **Whisper**: Deploy `whisper` model (recommended: whisper-1)
   - **GPT-4**: Deploy `gpt-4` or `gpt-4-turbo` model

**Note the deployment names** - you'll need these for configuration.

### Step 3: Get API Credentials

1. In Azure Portal, go to your Azure OpenAI resource
2. Navigate to **Keys and Endpoint**
3. Copy the following:
   - **KEY 1** or **KEY 2** (either works)
   - **Endpoint** (format: `https://YOUR-RESOURCE-NAME.openai.azure.com`)

### Step 4: Configure Environment Variables

1. In your project root, copy the example file:

   ```bash
   cp .env.local.example .env.local
   ```

2. Open `.env.local` and add your Azure credentials:

   ```bash
   # Azure OpenAI Configuration
   AZURE_OPENAI_API_KEY=your-azure-api-key-here
   AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
   AZURE_OPENAI_API_VERSION=2024-08-01-preview
   AZURE_OPENAI_WHISPER_DEPLOYMENT=whisper-1
   AZURE_OPENAI_GPT4_DEPLOYMENT=gpt-4
   ```

3. Replace the placeholder values:
   - `your-azure-api-key-here` → Your actual API key from step 3
   - `your-resource.openai.azure.com` → Your actual endpoint from step 3
   - Deployment names should match what you created in step 2

4. Save the file

### Step 5: Restart Development Server

```bash
npm run dev
```

Your application should now be configured!

## Standard OpenAI Setup

### Prerequisites

- OpenAI account with API access
- Valid payment method configured

### Step 1: Create API Key

1. Go to [OpenAI Platform](https://platform.openai.com)
2. Sign in or create an account
3. Navigate to [API Keys](https://platform.openai.com/api-keys)
4. Click "Create new secret key"
5. Give it a descriptive name (e.g., "Meeting Transcriber - Development")
6. Copy the key immediately (you won't be able to see it again!)

### Step 2: Set Up Billing

1. Go to [Billing Settings](https://platform.openai.com/account/billing/overview)
2. Add a payment method
3. Set up usage limits to prevent unexpected charges

### Step 3: Configure Environment Variables

1. Copy the example file:

   ```bash
   cp .env.local.example .env.local
   ```

2. Open `.env.local` and add your OpenAI credentials:

   ```bash
   # Standard OpenAI Configuration
   OPENAI_API_KEY=sk-proj-your-openai-api-key-here

   # Optional: Only if you have multiple organizations
   # OPENAI_ORGANIZATION_ID=org-your-organization-id
   ```

3. Replace `sk-proj-your-openai-api-key-here` with your actual API key

4. Save the file

### Step 4: Restart Development Server

```bash
npm run dev
```

## Environment Variables Reference

### Azure OpenAI Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AZURE_OPENAI_API_KEY` | Yes | - | Your Azure OpenAI API key |
| `AZURE_OPENAI_ENDPOINT` | Yes | - | Your Azure OpenAI endpoint URL |
| `AZURE_OPENAI_API_VERSION` | No | `2024-08-01-preview` | Azure OpenAI API version |
| `AZURE_OPENAI_WHISPER_DEPLOYMENT` | No | `whisper-1` | Whisper model deployment name |
| `AZURE_OPENAI_GPT4_DEPLOYMENT` | No | `gpt-4` | GPT-4 model deployment name |

### Standard OpenAI Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | - | Your OpenAI API key |
| `OPENAI_ORGANIZATION_ID` | No | - | Organization ID (multi-org accounts only) |

### Configuration Priority

The application checks for configuration in this order:

1. **Azure OpenAI** - If both `AZURE_OPENAI_API_KEY` and `AZURE_OPENAI_ENDPOINT` are set
2. **Standard OpenAI** - If `OPENAI_API_KEY` is set
3. **Error** - If neither is configured

## Verification

### Method 1: Settings Dialog

1. Start your development server: `npm run dev`
2. Open the application in your browser
3. Click the **Settings** icon in the header
4. Check the **API Configuration** section:
   - ✅ Green checkmark = Configured correctly
   - ❌ Red X = Not configured or error

### Method 2: API Status Endpoint

1. Start your development server
2. Open your browser to: `http://localhost:3000/api/config/status`
3. You should see a JSON response like:

   ```json
   {
     "configured": true,
     "provider": "azure",
     "whisperDeployment": "whisper-1",
     "gpt4Deployment": "gpt-4",
     "endpointHost": "your-resource.openai.azure.com"
   }
   ```

### Method 3: Server Logs

Check your terminal for initialization messages:

```
[OpenAI] Initialized Azure OpenAI client { endpoint: 'https://...', apiVersion: '2024-08-01-preview' }
[OpenAI] Environment variables validated successfully
```

## Troubleshooting

### Error: "Missing OpenAI configuration"

**Symptom**: Red X in settings, configuration not detected

**Solutions**:

1. Verify `.env.local` exists in project root (not in subdirectories)
2. Check that variable names are **exactly** as specified (case-sensitive)
3. Ensure no extra spaces around the `=` sign
4. Restart the development server after changes
5. Check for syntax errors in `.env.local`

### Error: "Invalid AZURE_OPENAI_ENDPOINT"

**Symptom**: Endpoint validation fails

**Solutions**:

1. Ensure endpoint starts with `https://` (not `http://`)
2. Remove trailing slashes: `https://resource.openai.azure.com` (correct)
3. Don't include `/openai/deployments` or other paths
4. Copy directly from Azure Portal without modifications

### Error: "Deployment not configured"

**Symptom**: Whisper or GPT-4 deployment not found

**Solutions**:

1. Verify deployment names match exactly (case-sensitive)
2. Check deployments exist in Azure OpenAI Studio
3. Ensure deployments are in "Succeeded" state
4. Wait a few minutes after deployment creation

### Error: "401 Unauthorized"

**Symptom**: API calls fail with authentication error

**Solutions**:

1. Verify API key is correct and not truncated
2. Regenerate API key in Azure Portal if needed
3. Check key hasn't been rotated or revoked
4. Ensure using KEY 1 or KEY 2 (not other credentials)

### Error: "429 Too Many Requests"

**Symptom**: Rate limit errors

**Solutions**:

1. Check your Azure OpenAI quota limits
2. Implement request throttling if needed
3. Consider upgrading your Azure OpenAI tier
4. Wait before retrying

### Error: "Model deployment not found"

**Symptom**: Specific model cannot be accessed

**Solutions**:

1. Verify model is deployed in Azure OpenAI Studio
2. Check deployment name spelling
3. Ensure deployment is in same region as resource
4. Wait for deployment to complete (can take 5-10 minutes)

### Server Won't Start

**Solutions**:

1. Kill any processes on port 3000: `lsof -ti:3000 | xargs kill -9`
2. Clear Next.js cache: `rm -rf .next`
3. Reinstall dependencies: `rm -rf node_modules && npm install`
4. Check for syntax errors in `.env.local`

## FAQ

### Q: Can I use both Azure OpenAI and standard OpenAI?

**A**: The application will prefer Azure OpenAI if both are configured. To switch, remove the Azure variables from `.env.local`.

### Q: Do I need both Whisper and GPT-4?

**A**: Yes. Whisper is required for transcription, and GPT-4 is required for analysis features (summaries, action items, etc.).

### Q: How much will this cost?

**A**: Costs depend on usage:

- **Azure OpenAI**: Pay-as-you-go pricing. Check [Azure OpenAI Pricing](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/)
- **OpenAI**: Pay-per-token. Check [OpenAI Pricing](https://openai.com/pricing)

Set up budget alerts and usage limits in your provider's dashboard.

### Q: Can I use this in production?

**A**: Yes, but follow these steps:

1. Use production-grade secret management (Azure Key Vault, AWS Secrets Manager)
2. Set up separate API keys for production
3. Configure rate limiting and monitoring
4. Enable logging and alerting
5. Set up usage budgets and alerts
6. Review security best practices

### Q: What if I don't have Azure OpenAI access?

**A**: Azure OpenAI requires application approval. Alternatives:

1. Apply for Azure OpenAI access (can take several days)
2. Use standard OpenAI API instead (faster to set up)
3. Use a different OpenAI-compatible service

### Q: How do I rotate API keys?

**A**: For Azure OpenAI:

1. Generate a new key in Azure Portal (KEY 2 if using KEY 1)
2. Update `.env.local` with the new key
3. Restart your server
4. Verify everything works
5. Revoke the old key in Azure Portal

For standard OpenAI:

1. Create a new API key in OpenAI dashboard
2. Update `.env.local` with the new key
3. Restart your server
4. Verify everything works
5. Revoke the old key in OpenAI dashboard

### Q: Can I use environment variables from a different source?

**A**: Yes! The application reads from `process.env`, so you can use:

- `.env.local` (development)
- System environment variables
- CI/CD secrets
- Container environment variables
- Cloud provider secret managers (Azure Key Vault, AWS Secrets Manager)

### Q: What API version should I use for Azure OpenAI?

**A**: Use `2024-08-01-preview` for the latest features. See [Azure OpenAI API Versions](https://learn.microsoft.com/en-us/azure/ai-services/openai/api-version-deprecation) for alternatives.

## Support

For additional help:

- **Azure OpenAI**: [Microsoft Learn Documentation](https://learn.microsoft.com/en-us/azure/ai-services/openai/)
- **OpenAI**: [OpenAI Documentation](https://platform.openai.com/docs)
- **Application Issues**: Check the GitHub repository issues

---

**Last Updated**: 2025-01-17
