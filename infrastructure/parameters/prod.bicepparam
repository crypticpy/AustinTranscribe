// ============================================================================
// Production Environment Parameters
// ============================================================================
// Use this file for production deployments:
//   az deployment sub create \
//     --location eastus \
//     --template-file main.bicep \
//     --parameters @parameters/prod.bicepparam \
//     --parameters azureOpenAIEndpoint='...' \
//     --parameters azureOpenAIApiKey='...'
// ============================================================================

using '../main.bicep'

param environment = 'prod'
param location = 'eastus'
param baseName = 'mtranscriber'
param imageTag = 'latest'
param enableKeyVault = true

// Azure OpenAI Configuration
param azureOpenAIApiVersion = '2024-08-01-preview'
param azureOpenAIWhisperDeployment = 'whisper-1'
param azureOpenAIGPTDeployment = 'gpt-4o'

// Production-specific tags
param tags = {
  project: 'meeting-transcriber'
  environment: 'prod'
  managedBy: 'bicep'
  criticality: 'high'
}

// Note: In production, always use Key Vault for secrets
// After deployment, add secrets to Key Vault:
//   az keyvault secret set --vault-name kv-mtranscriber-prod \
//     --name azure-openai-api-key --value 'your-key'
//   az keyvault secret set --vault-name kv-mtranscriber-prod \
//     --name azure-openai-endpoint --value 'https://your-endpoint.openai.azure.com/'
