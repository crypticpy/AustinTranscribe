/**
 * OpenAI Configuration Tests
 *
 * This is an example test file demonstrating how to test the OpenAI configuration.
 * To use these tests, rename this file to openai.test.ts and install testing dependencies:
 *
 * npm install --save-dev jest @types/jest ts-jest
 * npm install --save-dev @testing-library/react @testing-library/jest-dom
 *
 * Then configure Jest in your package.json or jest.config.js
 */

import {
  getOpenAIClient,
  getWhisperDeployment,
  getGPT4Deployment,
  isAzureOpenAI,
  validateEnvironmentVariables,
  getConfiguration,
  getConfigurationSummary,
  resetClient,
  OpenAIConfigError,
} from '../openai';

describe('OpenAI Configuration', () => {
  // Store original environment variables
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    jest.resetModules();
    process.env = { ...originalEnv };
    resetClient();
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Azure OpenAI Configuration', () => {
    beforeEach(() => {
      process.env.AZURE_OPENAI_API_KEY = 'test-azure-key';
      process.env.AZURE_OPENAI_ENDPOINT = 'https://test-resource.openai.azure.com';
      process.env.AZURE_OPENAI_API_VERSION = '2024-08-01-preview';
      process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT = 'test-whisper';
      process.env.AZURE_OPENAI_GPT5_DEPLOYMENT = 'test-gpt5';
      delete process.env.AZURE_OPENAI_GPT4_DEPLOYMENT;
    });

    test('should detect Azure OpenAI configuration', () => {
      expect(isAzureOpenAI()).toBe(true);
    });

    test('should return correct configuration', () => {
      const config = getConfiguration();
      expect(config.provider).toBe('azure');
      expect(config.apiKey).toBe('test-azure-key');
      expect(config.endpoint).toBe('https://test-resource.openai.azure.com');
      expect(config.apiVersion).toBe('2024-08-01-preview');
    });

    test('should return Azure deployment names', () => {
      expect(getWhisperDeployment()).toBe('test-whisper');
      expect(getGPT4Deployment()).toBe('test-gpt5');
    });

    test('should validate environment variables successfully', () => {
      expect(() => validateEnvironmentVariables()).not.toThrow();
    });

    test('should create client successfully', () => {
      const client = getOpenAIClient();
      expect(client).toBeDefined();
    });

    test('should return configuration summary', () => {
      const summary = getConfigurationSummary();
      expect(summary.provider).toBe('azure');
      expect(summary.endpoint).toBe('https://test-resource.openai.azure.com');
      expect(summary.hasWhisperDeployment).toBe(true);
      expect(summary.hasGPT4Deployment).toBe(true);
    });
  });

  describe('Standard OpenAI Configuration', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.OPENAI_ORGANIZATION_ID = 'org-test';
    });

    test('should detect standard OpenAI configuration', () => {
      expect(isAzureOpenAI()).toBe(false);
    });

    test('should return correct configuration', () => {
      const config = getConfiguration();
      expect(config.provider).toBe('openai');
      expect(config.apiKey).toBe('sk-test-key');
      expect(config.organizationId).toBe('org-test');
    });

    test('should return standard model names', () => {
      expect(getWhisperDeployment()).toBe('whisper-1');
      expect(getGPT4Deployment()).toBe('gpt-5');
    });

    test('should validate environment variables successfully', () => {
      expect(() => validateEnvironmentVariables()).not.toThrow();
    });
  });

  describe('Configuration Errors', () => {
    test('should throw error when no configuration is provided', () => {
      // Clear all OpenAI-related env vars
      delete process.env.AZURE_OPENAI_API_KEY;
      delete process.env.AZURE_OPENAI_ENDPOINT;
      delete process.env.OPENAI_API_KEY;

      expect(() => getConfiguration()).toThrow(OpenAIConfigError);
      expect(() => getConfiguration()).toThrow('Missing OpenAI configuration');
    });

    test('should throw error for invalid Azure endpoint', () => {
      process.env.AZURE_OPENAI_API_KEY = 'test-key';
      process.env.AZURE_OPENAI_ENDPOINT = 'http://invalid-endpoint.com'; // Should be https://

      expect(() => getConfiguration()).toThrow(OpenAIConfigError);
      expect(() => getConfiguration()).toThrow('must start with https://');
    });

    test('should throw error when Azure Whisper deployment is missing', () => {
      process.env.AZURE_OPENAI_API_KEY = 'test-key';
      process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com';
      delete process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT;

      expect(() => getWhisperDeployment()).toThrow(OpenAIConfigError);
      expect(() => getWhisperDeployment()).toThrow('AZURE_OPENAI_WHISPER_DEPLOYMENT is not configured');
    });

    test('should throw error when Azure GPT-4 deployment is missing', () => {
      process.env.AZURE_OPENAI_API_KEY = 'test-key';
      process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com';
      delete process.env.AZURE_OPENAI_GPT5_DEPLOYMENT;
      delete process.env.AZURE_OPENAI_GPT4_DEPLOYMENT;

      expect(() => getGPT4Deployment()).toThrow(OpenAIConfigError);
      expect(() => getGPT4Deployment()).toThrow('Azure analysis deployment is not configured');
    });
  });

  describe('Configuration Priority', () => {
    test('should prioritize Azure over standard OpenAI when both are set', () => {
      process.env.AZURE_OPENAI_API_KEY = 'azure-key';
      process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com';
      process.env.OPENAI_API_KEY = 'standard-key';

      const config = getConfiguration();
      expect(config.provider).toBe('azure');
      expect(config.apiKey).toBe('azure-key');
    });

    test('should fallback to standard OpenAI when Azure is incomplete', () => {
      process.env.AZURE_OPENAI_API_KEY = 'azure-key';
      // Missing AZURE_OPENAI_ENDPOINT
      process.env.OPENAI_API_KEY = 'standard-key';

      const config = getConfiguration();
      expect(config.provider).toBe('openai');
      expect(config.apiKey).toBe('standard-key');
    });
  });

  describe('Client Singleton', () => {
    test('should return same client instance on multiple calls', () => {
      process.env.OPENAI_API_KEY = 'test-key';

      const firstClient = getOpenAIClient();
      const secondClient = getOpenAIClient();

      expect(firstClient).toBe(secondClient);
    });

    test('should reset client when resetClient is called', () => {
      process.env.OPENAI_API_KEY = 'test-key';

      const initialClient = getOpenAIClient();
      resetClient();
      const refreshedClient = getOpenAIClient();

      // New instance should be created (though we can't directly compare instances)
      expect(refreshedClient).toBeDefined();
      expect(refreshedClient).not.toBe(initialClient);
    });
  });

  describe('Default Values', () => {
    test('should use default API version for Azure', () => {
      process.env.AZURE_OPENAI_API_KEY = 'test-key';
      process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com';
      delete process.env.AZURE_OPENAI_API_VERSION;

      const config = getConfiguration();
      expect(config.apiVersion).toBe('2024-08-01-preview');
    });

    test('should use default deployment names for Azure', () => {
      process.env.AZURE_OPENAI_API_KEY = 'test-key';
      process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com';
      delete process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT;
      delete process.env.AZURE_OPENAI_GPT4_DEPLOYMENT;

      const config = getConfiguration();
      expect(config.whisperDeployment).toBe('whisper-1');
      expect(config.gpt4Deployment).toBe('gpt-4');
    });
  });
});

/**
 * Integration Test Examples
 *
 * These demonstrate how the configuration would be used in real application code.
 * Uncomment and adapt based on your testing setup.
 */

/*
describe('OpenAI Integration', () => {
  beforeAll(() => {
    // Set up test environment variables
    process.env.OPENAI_API_KEY = process.env.TEST_OPENAI_API_KEY || 'test-key';
  });

  test('should successfully create a chat completion', async () => {
    const client = getOpenAIClient();

    const completion = await client.chat.completions.create({
      model: getGPT4Deployment(),
      messages: [{ role: 'user', content: 'Say hello in one word' }],
      max_completion_tokens: 10,
    });

    expect(completion.choices).toHaveLength(1);
    expect(completion.choices[0].message.content).toBeTruthy();
  });

  test('should successfully transcribe audio', async () => {
    const client = getOpenAIClient();
    const audioFile = new File(['test audio content'], 'test.mp3', { type: 'audio/mpeg' });

    const transcription = await client.audio.transcriptions.create({
      model: getWhisperDeployment(),
      file: audioFile,
    });

    expect(transcription.text).toBeDefined();
  });
});
*/
