// ============================================================================
// Development Environment Parameters
// ============================================================================
// Use this file for development deployments:
//   az deployment sub create \
//     --location eastus \
//     --template-file main.bicep \
//     --parameters @parameters/dev.bicepparam
// ============================================================================

using '../main.bicep'

param environment = 'dev'
param location = 'eastus'
param baseName = 'mtranscriber'
param imageTag = 'latest'
param enableKeyVault = true

// Azure OpenAI Configuration
// These can be overridden at deployment time with --parameters
param azureOpenAIApiVersion = '2024-08-01-preview'
param azureOpenAIWhisperDeployment = 'whisper-1'
param azureOpenAIGPTDeployment = 'gpt-4o'

// Secrets should be passed at deployment time, not stored in parameter files
// az deployment sub create ... \
//   --parameters azureOpenAIEndpoint='https://your-endpoint.openai.azure.com/' \
//   --parameters azureOpenAIApiKey='your-api-key'
