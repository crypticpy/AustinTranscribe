/**
 * Transcription API Route Handler
 *
 * POST endpoint that accepts audio files and returns transcripts.
 * Uses Azure OpenAI Whisper API for speech-to-text transcription.
 *
 * Features:
 * - FormData file upload handling
 * - File validation (type, size, format)
 * - Azure OpenAI Whisper integration
 * - Structured response with segments and metadata
 * - Comprehensive error handling
 * - Rate limiting consideration
 *
 * @route POST /api/transcribe
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type {
  TranscriptionCreateResponse,
  TranscriptionDiarized,
  TranscriptionVerbose,
} from 'openai/resources/audio/transcriptions';
import {
  getTranscriptionClient,
  getWhisperDeployment,
  OpenAIConfigError,
  generateTranscriptSummary,
} from '@/lib/openai';
import {
  getSupportedAudioTypes,
  getMaxFileSize,
  getMaxFileSizeMB,
  isSupportedAudioType,
  isValidFileSize,
} from '@/lib/validations';
import {
  generateTranscriptId,
  convertWhisperResponse,
  extractMetadata,
  sanitizeSegments,
  validateSegments,
  type WhisperVerboseResponse,
} from '@/lib/transcription-utils';
import { errorResponse, successResponse } from '@/lib/api-utils';
import type { Transcript } from '@/types';

/**
 * Maximum retry attempts for transient failures
 */
const MAX_RETRIES = 3;

/**
 * Retry delay in milliseconds (exponential backoff)
 */
const RETRY_BASE_DELAY = 1000;

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type AudioResponseFormat =
  | 'json'
  | 'text'
  | 'srt'
  | 'verbose_json'
  | 'vtt'
  | 'diarized_json';

function determineResponseFormat(
  model: string
): AudioResponseFormat {
  const normalized = model.trim().toLowerCase();

  // For GPT-4o Diarize model, we always use verbose_json.
  // The 'diarized_json' literal is not valid in the SDK types.
  // We will interpret the verbose_json response as diarized if speaker fields are present.
  if (normalized.includes('diarize')) {
    return 'verbose_json';
  }

  if (normalized.startsWith('whisper')) {
    return 'verbose_json';
  }

  // GPT-4o transcribe models use json format (Azure doesn't support verbose_json)
  if (normalized.includes('gpt-4o') && normalized.includes('transcribe')) {
    return 'json';
  }

  return 'json';
}

function extractUsageDuration(usage: unknown): number | undefined {
  if (!usage || typeof usage !== 'object') {
    return undefined;
  }

  const seconds = (usage as { seconds?: unknown }).seconds;
  return typeof seconds === 'number' ? seconds : undefined;
}

function isDiarizedResponse(
  response: TranscriptionCreateResponse
): response is TranscriptionDiarized {
  return (
    typeof (response as TranscriptionDiarized).task === 'string' &&
    Array.isArray((response as TranscriptionDiarized).segments)
  );
}

function isVerboseResponse(
  response: TranscriptionCreateResponse
): response is TranscriptionVerbose {
  return (
    typeof (response as TranscriptionVerbose).language === 'string' &&
    typeof (response as TranscriptionVerbose).duration === 'number'
  );
}

function normalizeSpeakerLabel(
  rawSpeaker: unknown,
  segmentIndex: number
): string | undefined {
  if (typeof rawSpeaker === 'string') {
    const trimmed = rawSpeaker.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  if (typeof rawSpeaker === 'number' && Number.isFinite(rawSpeaker)) {
    return `Speaker ${Math.trunc(rawSpeaker) + 1}`;
  }

  if (rawSpeaker && typeof rawSpeaker === 'object') {
    const maybeLabel =
      typeof (rawSpeaker as { label?: unknown }).label === 'string'
        ? (rawSpeaker as { label?: string }).label
        : typeof (rawSpeaker as { name?: unknown }).name === 'string'
          ? (rawSpeaker as { name?: string }).name
          : undefined;

    if (maybeLabel) {
      const trimmed = maybeLabel.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return `Speaker ${segmentIndex + 1}`;
}

function normalizeTranscriptionResponse(
  response: TranscriptionCreateResponse
): WhisperVerboseResponse {
  if (isDiarizedResponse(response)) {
    const duration =
      response.duration ?? extractUsageDuration(response.usage);

    return {
      task: response.task,
      duration,
      text: response.text,
      segments: response.segments.map((segment, index) => ({
        id: segment.id ?? index,
        start: segment.start,
        end: segment.end,
        text: segment.text,
        speaker: normalizeSpeakerLabel(segment.speaker, index),
      })),
    };
  }

  if (isVerboseResponse(response)) {
    const duration =
      response.duration ?? extractUsageDuration(response.usage);

    return {
      task: 'transcribe',
      language: response.language,
      duration,
      text: response.text,
      segments: response.segments?.map((segment) => ({
        id: segment.id,
        seek: segment.seek,
        start: segment.start,
        end: segment.end,
        text: segment.text,
        tokens: segment.tokens,
        temperature: segment.temperature,
        avg_logprob: segment.avg_logprob,
        compression_ratio: segment.compression_ratio,
        no_speech_prob: segment.no_speech_prob,
      })),
    };
  }

  const usageDuration = extractUsageDuration(
    (response as { usage?: unknown }).usage
  );

  return {
    task: 'transcribe',
    language: (response as { language?: string }).language,
    duration: usageDuration,
    text: response.text,
    segments: [],
  };
}

/**
 * Validate file from FormData
 */
async function validateFile(formData: FormData): Promise<{
  valid: boolean;
  file?: Blob;
  filename?: string;
  error?: string;
  status?: number;
}> {
  const fileEntry = formData.get('file');

  // Check if file exists
  if (!fileEntry) {
    return {
      valid: false,
      error: 'No file provided. Please upload an audio file.',
      status: 400,
    };
  }

  // Check if it's a Blob/File object (File extends Blob)
  if (!(fileEntry instanceof Blob)) {
    return {
      valid: false,
      error: 'Invalid file format. Expected a File object.',
      status: 400,
    };
  }

  // Get filename - File objects have name, Blob objects may not
  const filename = (fileEntry as { name?: string }).name || 'audio.mp3';

  // Check file size - empty file
  if (fileEntry.size === 0) {
    return {
      valid: false,
      error: 'File is empty. Please upload a valid audio file.',
      status: 400,
    };
  }

  // Check file size - minimum (1 KB)
  if (fileEntry.size < 1024) {
    return {
      valid: false,
      error: 'File is too small. Minimum file size is 1 KB.',
      status: 400,
    };
  }

  // Check file size - maximum (25 MB for Whisper)
  if (!isValidFileSize(fileEntry.size)) {
    const maxSizeMB = getMaxFileSizeMB();
    return {
      valid: false,
      error: `File is too large. Maximum file size is ${maxSizeMB}MB.`,
      status: 413,
    };
  }

  // Check file type
  if (!isSupportedAudioType(fileEntry.type)) {
    const supportedTypes = getSupportedAudioTypes();
    return {
      valid: false,
      error: `Unsupported file type: ${fileEntry.type}. Supported types: ${supportedTypes.join(', ')}`,
      status: 400,
    };
  }

  // Check filename extension as additional validation
  const filenameLower = filename.toLowerCase();
  const supportedExtensions = [
    '.mp3',
    '.m4a',
    '.wav',
    '.webm',
    '.ogg',
    '.flac',
    '.aac',
  ];
  const hasValidExtension = supportedExtensions.some((ext) =>
    filenameLower.endsWith(ext)
  );

  if (!hasValidExtension) {
    return {
      valid: false,
      error: `Unsupported file extension. Supported extensions: ${supportedExtensions.join(', ')}`,
      status: 400,
    };
  }

  return { valid: true, file: fileEntry, filename };
}

/**
 * Call OpenAI Whisper API with retry logic
 */
async function transcribeWithRetry(
  file: Blob,
  filename: string,
  options: {
    model: string;
    language?: string | null;
    responseFormat: AudioResponseFormat;
  },
  retries = MAX_RETRIES
): Promise<{
  response: TranscriptionCreateResponse;
  responseFormat: AudioResponseFormat;
}> {
  let lastError: Error | null = null;
  let currentFormat = options.responseFormat;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const client = getTranscriptionClient();

      // Log attempt
      console.log(`[Transcribe] Attempt ${attempt + 1}/${retries} for file: ${filename}`);

      // Create a File object for OpenAI API
      // The OpenAI SDK requires a File object with a name property
      // We create a new File from the Blob to ensure proper name assignment
      const fileWithName = new File([file], filename, { type: file.type });

      // Build API request parameters
      const requestParams: Record<string, unknown> = {
        file: fileWithName,
        model: options.model,
      };

      // Add language if specified
      if (options.language) {
        requestParams.language = options.language;
      }

      if (currentFormat) {
        requestParams.response_format = currentFormat;

        if (currentFormat === 'verbose_json') {
          requestParams.timestamp_granularities = ['segment'];
        }
      }

      // Add chunking_strategy for diarization models
      // Required for gpt-4o-transcribe-diarize model (audio > 30 seconds)
      const isDiarizeModel = options.model.toLowerCase().includes('diarize');
      if (isDiarizeModel) {
        requestParams.chunking_strategy = 'auto';
      }

      // Call Whisper API
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await client.audio.transcriptions.create(requestParams as any);

      console.log(`[Transcribe] Success for file: ${filename}`, {
        responseFormat: currentFormat,
      });

      return { response, responseFormat: currentFormat };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Log error
      console.error(`[Transcribe] Attempt ${attempt + 1} failed:`, {
        error: lastError.message,
        file: filename,
      });

      const message = lastError.message.toLowerCase();
      const formatRejected =
        message.includes('response_format') && currentFormat !== 'json';

      if (formatRejected) {
        console.warn(
          `[Transcribe] Response format ${currentFormat} rejected. Falling back to json.`
        );
        currentFormat = 'json';
        continue;
      }

      // Check if error is retryable
      const isRetryable = isRetryableError(error);

      if (!isRetryable || attempt === retries - 1) {
        // Don't retry non-retryable errors or last attempt
        throw lastError;
      }

      // Exponential backoff
      const delay = RETRY_BASE_DELAY * Math.pow(2, attempt);
      console.log(`[Transcribe] Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  // This should never be reached due to throw in loop
  throw lastError || new Error('Transcription failed after retries');
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();

  // Network errors are retryable
  if (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('enotfound')
  ) {
    return true;
  }

  // Rate limit errors are retryable (429)
  if (message.includes('rate limit') || message.includes('429')) {
    return true;
  }

  // Server errors (5xx) are retryable
  if (message.includes('500') || message.includes('502') || message.includes('503')) {
    return true;
  }

  // Default: not retryable
  return false;
}

/**
 * Parse OpenAI error for user-friendly message
 */
function parseOpenAIError(error: unknown): {
  message: string;
  status: number;
  details?: Record<string, unknown>;
} {
  if (!(error instanceof Error)) {
    return {
      message: 'An unknown error occurred during transcription.',
      status: 500,
    };
  }

  const message = error.message.toLowerCase();

  // Rate limit error (429)
  if (message.includes('rate limit') || message.includes('429')) {
    return {
      message:
        'Rate limit exceeded. Please wait a moment and try again.',
      status: 429,
    };
  }

  // Authentication error (401)
  if (message.includes('unauthorized') || message.includes('401')) {
    return {
      message:
        'Authentication failed. Please check API configuration.',
      status: 500,
      details: { type: 'configuration_error' },
    };
  }

  // Invalid request (400)
  if (message.includes('invalid') || message.includes('400')) {
    return {
      message: `Invalid request: ${error.message}`,
      status: 400,
    };
  }

  // Network/timeout errors
  if (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('econnreset')
  ) {
    return {
      message:
        'Network error occurred. Please check your connection and try again.',
      status: 503,
    };
  }

  // Server errors (5xx)
  if (message.includes('500') || message.includes('502') || message.includes('503')) {
    return {
      message:
        'OpenAI service is temporarily unavailable. Please try again later.',
      status: 503,
    };
  }

  // Default error
  return {
    message: `Transcription failed: ${error.message}`,
    status: 500,
  };
}

/**
 * POST /api/transcribe
 *
 * Handles audio file upload and transcription.
 *
 * Request:
 * - Content-Type: multipart/form-data
 * - Body: FormData with 'file' field containing audio file
 *
 * Response:
 * - Success (200): { success: true, data: Transcript }
 * - Error (4xx/5xx): { success: false, error: string, details?: object }
 *
 * Status Codes:
 * - 200: Success
 * - 400: Bad Request (invalid file, missing file, etc.)
 * - 413: Payload Too Large (file > 25MB)
 * - 429: Too Many Requests (rate limit)
 * - 500: Internal Server Error (API error, config error, etc.)
 * - 503: Service Unavailable (OpenAI service down)
 */
export async function POST(request: NextRequest) {
  console.log('[Transcribe] Received transcription request');

  try {
    // Validate environment configuration first
    let model: string;
    try {
      model = getWhisperDeployment();
    } catch (error) {
      if (error instanceof OpenAIConfigError) {
        console.error('[Transcribe] Configuration error:', error.message);
        return errorResponse(
          'Server configuration error. OpenAI API is not properly configured.',
          500,
          {
            type: 'configuration_error',
            message: error.message,
          }
        );
      }
      throw error;
    }

    // Parse FormData
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (error) {
      console.error('[Transcribe] Failed to parse FormData:', error);
      return errorResponse(
        'Failed to parse request. Please ensure you are sending FormData with a file.',
        400
      );
    }

    // Validate file
    const validation = await validateFile(formData);
    if (!validation.valid) {
      console.error('[Transcribe] File validation failed:', validation.error);
      return errorResponse(
        validation.error!,
        validation.status!
      );
    }

    const file = validation.file!;
    const filename = validation.filename!;

    // Get optional parameters from formData
    const enableSpeakerDetection = formData.get('enableSpeakerDetection') === 'true';
    const languageParam = formData.get('language') as string | null;
    const modelParam = formData.get('model') as string | null;

    const partIndexParam = formData.get('partIndex');
    const totalPartsParam = formData.get('totalParts');
    const partIndex = partIndexParam ? Number(partIndexParam) : undefined;
    const totalParts = totalPartsParam ? Number(totalPartsParam) : undefined;

    console.log('[Transcribe] Processing file:', {
      name: filename,
      size: file.size,
      type: file.type,
      enableSpeakerDetection,
      language: languageParam,
      model: modelParam || model,
      partIndex,
      totalParts,
    });

    // Use model parameter from request or default
    const transcriptionModel = modelParam || model;
    const responseFormat = determineResponseFormat(
      transcriptionModel
    );

    // Transcribe with OpenAI Whisper API (with retry logic)
    let transcriptionResult:
      | {
          response: TranscriptionCreateResponse;
          responseFormat: AudioResponseFormat;
        }
      | undefined;
    try {
      transcriptionResult = await transcribeWithRetry(
        file,
        filename,
        {
          model: transcriptionModel,
          language: languageParam,
          responseFormat,
        }
      );
    } catch (error) {
      console.error('[Transcribe] OpenAI API error:', error);
      const { message, status, details } = parseOpenAIError(error);
      return errorResponse(message, status, details);
    }

    const { response: rawResponse, responseFormat: finalFormat } =
      transcriptionResult;
    const whisperResponse = normalizeTranscriptionResponse(rawResponse);

    console.log('[Transcribe] Normalized transcription response:', {
      format: finalFormat,
      hasSegments: Array.isArray(whisperResponse.segments),
      segmentCount: whisperResponse.segments?.length || 0,
    });

    // Convert and sanitize response segments
    const convertedSegments = convertWhisperResponse(whisperResponse);
    const allowSegmentOverlaps = finalFormat === 'diarized_json';
    const { segments, warnings: sanitationWarnings } = sanitizeSegments(
      convertedSegments,
      {
        allowOverlaps: allowSegmentOverlaps,
        overlapEpsilon: 0.05,
        minDuration: 0.001,
      }
    );

    if (sanitationWarnings.length > 0) {
      console.warn('[Transcribe] Segment sanitation warnings:', sanitationWarnings);
    }

    // Validate segments
    const segmentValidation = validateSegments(segments, {
      allowOverlaps: allowSegmentOverlaps,
      overlapEpsilon: 0.05,
      minDuration: 0.001,
    });
    if (!segmentValidation.valid) {
      console.error('[Transcribe] Segment validation failed:', segmentValidation.errors);
      return errorResponse(
        'Transcription produced invalid segments.',
        500,
        {
          type: 'validation_error',
          errors: segmentValidation.errors,
          ...(sanitationWarnings.length > 0
            ? { warnings: sanitationWarnings }
            : {}),
        }
      );
    }

    // Extract metadata
    const metadata = extractMetadata(whisperResponse, file.size, transcriptionModel);
    if (!metadata.language && languageParam) {
      metadata.language = languageParam;
    }

    // Build transcript response
    const transcript: Transcript = {
      id: generateTranscriptId(),
      filename: filename,
      text: whisperResponse.text,
      segments,
      metadata,
      createdAt: new Date(),
      partIndex,
      totalParts,
    };

    // Generate AI summary (non-blocking - won't fail transcription if summary fails)
    if (transcript.text && transcript.text.length > 50) {
      console.log('[Transcribe] Generating AI summary...');
      const summary = await generateTranscriptSummary(transcript.text);
      if (summary) {
        transcript.summary = summary;
        console.log('[Transcribe] Summary generated:', {
          summaryLength: summary.length,
        });
      }
    }

    console.log('[Transcribe] Transcription completed:', {
      id: transcript.id,
      filename: transcript.filename,
      segmentCount: segments.length,
      duration: metadata.duration,
      language: metadata.language,
    });

    return successResponse(transcript);
  } catch (error) {
    // Catch-all for unexpected errors
    console.error('[Transcribe] Unexpected error:', error);

    if (error instanceof z.ZodError) {
      return errorResponse(
        'Validation error',
        400,
        {
          type: 'validation_error',
          errors: error.issues,
        }
      );
    }

    return errorResponse(
      error instanceof Error ? error.message : 'An unexpected error occurred',
      500
    );
  }
}

/**
 * GET /api/transcribe
 *
 * Returns API information and supported formats.
 */
export async function GET() {
  const supportedTypes = getSupportedAudioTypes();
  const maxSize = getMaxFileSize();
  const maxSizeMB = getMaxFileSizeMB();

  return NextResponse.json({
    success: true,
    data: {
      endpoint: '/api/transcribe',
      method: 'POST',
      contentType: 'multipart/form-data',
      supportedFormats: supportedTypes,
      maxFileSize: maxSize,
      maxFileSizeMB: maxSizeMB,
      features: [
        'Audio transcription using Azure OpenAI Whisper',
        'Timestamp segments for each phrase',
        'Language detection and specification',
        'Automatic retry on transient failures',
        'MP4 video to MP3 audio conversion (client-side)',
        'Large file splitting at silence points (client-side)',
        'Speaker detection (UI ready, implementation pending)',
      ],
      usage: {
        description: 'Upload an audio file for transcription',
        example: 'POST /api/transcribe with FormData containing "file" field',
      },
    },
  });
}
