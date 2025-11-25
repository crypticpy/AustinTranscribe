/**
 * OpenAI Configuration Usage Examples
 *
 * This file demonstrates various ways to use the OpenAI configuration
 * in your Next.js application. Copy these patterns into your actual code.
 */

import {
  getOpenAIClient,
  getWhisperDeployment,
  getGPT4Deployment,
  validateEnvironmentVariables,
  isAzureOpenAI,
  OpenAIConfigError,
} from '@/lib/openai';

/**
 * Example 1: Audio Transcription with Whisper
 *
 * This shows how to transcribe an audio file using the configured Whisper deployment.
 * Works with both Azure OpenAI and standard OpenAI.
 */
export async function transcribeAudioFile(audioFile: File) {
  try {
    const client = getOpenAIClient();

    const transcription = await client.audio.transcriptions.create({
      model: getWhisperDeployment(),
      file: audioFile,
      language: 'en', // Optional: specify language
      response_format: 'verbose_json', // Get timestamps and other metadata
      timestamp_granularities: ['word', 'segment'], // Word and segment-level timestamps
    });

    return {
      success: true,
      text: transcription.text,
      duration: transcription.duration,
      words: transcription.words,
      segments: transcription.segments,
    };
  } catch (error) {
    if (error instanceof OpenAIConfigError) {
      console.error('Configuration error:', error.message);
      return { success: false, error: 'OpenAI service not configured' };
    }

    console.error('Transcription error:', error);
    return { success: false, error: 'Transcription failed' };
  }
}

/**
 * Example 2: Meeting Summary with GPT-4
 *
 * This shows how to use GPT-4 to summarize a meeting transcript.
 */
export async function generateMeetingSummary(transcript: string) {
  try {
    const client = getOpenAIClient();

    const completion = await client.chat.completions.create({
      model: getGPT4Deployment(),
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant that creates concise meeting summaries. ' +
            'Extract key discussion points, decisions, and action items.',
        },
        {
          role: 'user',
          content: `Please summarize this meeting transcript:\n\n${transcript}`,
        },
      ],
      max_completion_tokens: 1000,
    });

    return {
      success: true,
      summary: completion.choices[0].message.content,
      usage: completion.usage,
    };
  } catch (error) {
    if (error instanceof OpenAIConfigError) {
      console.error('Configuration error:', error.message);
      return { success: false, error: 'OpenAI service not configured' };
    }

    console.error('Summary generation error:', error);
    return { success: false, error: 'Failed to generate summary' };
  }
}

/**
 * Example 3: Extract Action Items
 *
 * This uses structured output to extract action items from a transcript.
 */
export async function extractActionItems(transcript: string) {
  try {
    const client = getOpenAIClient();

    const completion = await client.chat.completions.create({
      model: getGPT4Deployment(),
      messages: [
        {
          role: 'system',
          content:
            'You are an assistant that extracts action items from meeting transcripts. ' +
            'For each action item, identify: what needs to be done, who is responsible, and any deadline mentioned.',
        },
        {
          role: 'user',
          content: `Extract action items from this meeting transcript:\n\n${transcript}`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0].message.content;
    const actionItems = content ? JSON.parse(content) : { items: [] };

    return {
      success: true,
      actionItems: actionItems.items,
    };
  } catch (error) {
    if (error instanceof OpenAIConfigError) {
      console.error('Configuration error:', error.message);
      return { success: false, error: 'OpenAI service not configured' };
    }

    console.error('Action item extraction error:', error);
    return { success: false, error: 'Failed to extract action items' };
  }
}

/**
 * Example 4: Server Action for Audio Upload
 *
 * This demonstrates using the OpenAI client in a Next.js Server Action.
 */
export async function processAudioUpload(formData: FormData) {
  'use server';

  try {
    // Validate configuration before processing
    validateEnvironmentVariables();

    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return { success: false, error: 'No audio file provided' };
    }

    // Check file size (Whisper has a 25MB limit)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (audioFile.size > maxSize) {
      return { success: false, error: 'Audio file too large (max 25MB)' };
    }

    // Transcribe the audio
    const result = await transcribeAudioFile(audioFile);

    if (!result.success) {
      return result;
    }

    // Optionally generate summary and action items
    const summary = await generateMeetingSummary(result.text!);
    const actionItems = await extractActionItems(result.text!);

    return {
      success: true,
      transcript: result.text,
      summary: summary.success ? summary.summary : null,
      actionItems: actionItems.success ? actionItems.actionItems : [],
    };
  } catch (error) {
    console.error('Audio processing error:', error);
    return { success: false, error: 'Failed to process audio' };
  }
}

/**
 * Example 5: API Route Handler
 *
 * This shows how to use the OpenAI client in a Next.js API route.
 */
export async function handleChatCompletion(request: Request) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid messages format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const client = getOpenAIClient();

    const completion = await client.chat.completions.create({
      model: getGPT4Deployment(),
      messages,
      stream: false, // Set to true for streaming responses
    });

    return new Response(JSON.stringify(completion), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof OpenAIConfigError) {
      return new Response(JSON.stringify({ error: 'Service not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.error('Chat completion error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Example 6: Streaming Response
 *
 * This demonstrates how to use streaming with the OpenAI API.
 */
export async function streamChatCompletion(prompt: string) {
  try {
    const client = getOpenAIClient();

    const stream = await client.chat.completions.create({
      model: getGPT4Deployment(),
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    });

    return stream;
  } catch (error) {
    if (error instanceof OpenAIConfigError) {
      throw new Error('OpenAI service not configured');
    }
    throw error;
  }
}

/**
 * Example 7: Configuration Check Utility
 *
 * This shows how to check the configuration at application startup.
 */
export function checkOpenAIConfiguration() {
  try {
    validateEnvironmentVariables();

    const provider = isAzureOpenAI() ? 'Azure OpenAI' : 'OpenAI';
    console.log(`[OpenAI] Successfully configured with ${provider}`);

    return { configured: true, provider };
  } catch (error) {
    if (error instanceof OpenAIConfigError) {
      console.error('[OpenAI] Configuration error:', error.message);
      return { configured: false, error: error.message };
    }
    throw error;
  }
}

/**
 * Example 8: Error Handling Pattern
 *
 * This demonstrates a comprehensive error handling pattern.
 */
export async function robustOpenAICall<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    // Configuration error
    if (error instanceof OpenAIConfigError) {
      console.error(`[${operationName}] Configuration error:`, error.message);
      return { success: false, error: 'OpenAI service is not properly configured' };
    }

    // Rate limiting
    if (error instanceof Error && error.message.includes('rate limit')) {
      console.error(`[${operationName}] Rate limit exceeded`);
      return { success: false, error: 'Too many requests. Please try again later.' };
    }

    // Timeout
    if (error instanceof Error && error.message.includes('timeout')) {
      console.error(`[${operationName}] Request timeout`);
      return { success: false, error: 'Request timed out. Please try again.' };
    }

    // Generic error
    console.error(`[${operationName}] Unexpected error:`, error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// Usage example:
export async function safeTranscribe(audioFile: File) {
  return robustOpenAICall(
    () => transcribeAudioFile(audioFile),
    'Transcribe Audio'
  );
}
