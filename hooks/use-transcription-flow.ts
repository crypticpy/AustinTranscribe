/**
 * Transcription Flow Hook
 *
 * Custom React hook for managing the complete transcription lifecycle.
 * Handles uploading audio blobs to the transcription API with progress tracking,
 * error handling, and state management.
 *
 * Features:
 * - Upload audio blobs directly to /api/transcribe
 * - Real-time progress tracking (preparing, uploading, transcribing, complete)
 * - Cancellation support via AbortController
 * - Comprehensive error handling with retry capability
 * - Automatic state cleanup
 *
 * Usage:
 * ```tsx
 * const { state, startTranscription, cancelTranscription, reset } = useTranscriptionFlow({
 *   onComplete: (transcriptId) => router.push(`/transcripts/${transcriptId}/analyze`),
 *   onError: (error) => console.error(error),
 * });
 *
 * // Start transcription with a blob
 * await startTranscription(audioBlob, 'my-recording');
 * ```
 */

"use client";

import * as React from 'react';

/**
 * Transcription flow status states
 */
export type TranscriptionStatus =
  | 'idle'         // Initial state, no transcription in progress
  | 'preparing'    // Preparing the audio file for upload
  | 'uploading'    // Uploading to the transcription API
  | 'transcribing' // Server is transcribing the audio
  | 'complete'     // Transcription completed successfully
  | 'error';       // An error occurred

/**
 * State object for transcription flow
 */
export interface TranscriptionFlowState {
  /** Current status of the transcription */
  status: TranscriptionStatus;
  /** Progress percentage (0-100) */
  progress: number;
  /** Current status message */
  message: string;
  /** Error object if status is 'error' */
  error: Error | null;
  /** Transcript ID if status is 'complete' */
  transcriptId: string | null;
}

/**
 * Options for the useTranscriptionFlow hook
 */
export interface UseTranscriptionFlowOptions {
  /** Callback when transcription completes successfully */
  onComplete?: (transcriptId: string) => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
  /** Language code for transcription (optional, auto-detect if not provided) */
  language?: string;
  /** Whisper model to use */
  model?: string;
  /** Enable speaker diarization */
  enableSpeakerDetection?: boolean;
}

/**
 * Return type for the useTranscriptionFlow hook
 */
export interface UseTranscriptionFlowReturn {
  /** Current state of the transcription flow */
  state: TranscriptionFlowState;
  /** Start transcription with an audio blob */
  startTranscription: (blob: Blob, filename?: string) => Promise<void>;
  /** Cancel the current transcription */
  cancelTranscription: () => void;
  /** Reset to idle state */
  reset: () => void;
}

/**
 * Initial state for the transcription flow
 */
const initialState: TranscriptionFlowState = {
  status: 'idle',
  progress: 0,
  message: '',
  error: null,
  transcriptId: null,
};

/**
 * Custom hook for managing transcription flow
 *
 * Provides a complete state machine for the transcription process,
 * from preparing the file to receiving the completed transcript.
 *
 * @param options - Configuration options
 * @returns Transcription state and control functions
 *
 * @example
 * ```tsx
 * function TranscribeButton({ audioBlob }: { audioBlob: Blob }) {
 *   const router = useRouter();
 *   const { state, startTranscription, cancelTranscription } = useTranscriptionFlow({
 *     onComplete: (id) => router.push(`/transcripts/${id}/analyze`),
 *   });
 *
 *   if (state.status === 'idle') {
 *     return (
 *       <Button onClick={() => startTranscription(audioBlob)}>
 *         Transcribe Now
 *       </Button>
 *     );
 *   }
 *
 *   if (state.status === 'error') {
 *     return (
 *       <Alert color="red">{state.error?.message}</Alert>
 *     );
 *   }
 *
 *   return (
 *     <Progress value={state.progress} label={state.message} />
 *   );
 * }
 * ```
 */
export function useTranscriptionFlow(
  options: UseTranscriptionFlowOptions = {}
): UseTranscriptionFlowReturn {
  const {
    onComplete,
    onError,
    language,
    model = 'gpt-4o-transcribe',
    enableSpeakerDetection = true,
  } = options;

  // State management
  const [state, setState] = React.useState<TranscriptionFlowState>(initialState);

  // AbortController for cancellation
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // XHR reference for cancellation
  const xhrRef = React.useRef<XMLHttpRequest | null>(null);

  /**
   * Update state helper
   */
  const updateState = React.useCallback((updates: Partial<TranscriptionFlowState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * Reset to initial state
   */
  const reset = React.useCallback(() => {
    // Cancel any in-progress operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setState(initialState);
  }, []);

  /**
   * Cancel the current transcription
   */
  const cancelTranscription = React.useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    updateState({
      status: 'idle',
      progress: 0,
      message: 'Transcription cancelled',
      error: null,
    });
  }, [updateState]);

  /**
   * Start transcription with an audio blob
   */
  const startTranscription = React.useCallback(
    async (blob: Blob, filename?: string): Promise<void> => {
      // Reset any previous state
      reset();

      // Create new AbortController
      abortControllerRef.current = new AbortController();

      try {
        // Phase 1: Preparing
        updateState({
          status: 'preparing',
          progress: 5,
          message: 'Preparing audio file...',
          error: null,
          transcriptId: null,
        });

        // Create File from Blob
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const extension = blob.type.includes('webm') ? 'webm' : blob.type.includes('mp4') ? 'mp4' : 'webm';
        const file = new File(
          [blob],
          filename ? `${filename}.${extension}` : `recording-${timestamp}.${extension}`,
          { type: blob.type, lastModified: Date.now() }
        );

        // Create FormData
        const formData = new FormData();
        formData.append('file', file);

        if (language) {
          formData.append('language', language);
        }

        if (model) {
          formData.append('model', model);
        }

        formData.append('enableSpeakerDetection', String(enableSpeakerDetection));

        // Phase 2: Uploading
        updateState({
          status: 'uploading',
          progress: 10,
          message: 'Uploading audio...',
        });

        // Use XMLHttpRequest for progress tracking
        const result = await new Promise<{ success: boolean; data?: { id: string }; error?: string }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhrRef.current = xhr;

          // Track upload progress
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable && event.total > 0) {
              const uploadPercent = (event.loaded / event.total) * 100;
              // Map upload progress to 10-50% range
              const mappedProgress = 10 + Math.round(uploadPercent * 0.4);
              updateState({
                progress: Math.min(mappedProgress, 50),
                message: `Uploading... ${Math.round(uploadPercent)}%`,
              });
            }
          });

          // Upload complete, now transcribing
          xhr.upload.addEventListener('load', () => {
            updateState({
              status: 'transcribing',
              progress: 55,
              message: 'Transcribing audio... This may take a minute.',
            });
          });

          // Handle completion
          xhr.addEventListener('load', () => {
            xhrRef.current = null;
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const response = JSON.parse(xhr.responseText);
                resolve(response);
              } catch {
                reject(new Error('Failed to parse transcription response'));
              }
            } else {
              try {
                const errorData = JSON.parse(xhr.responseText);
                reject(new Error(errorData.error || `Transcription failed with status ${xhr.status}`));
              } catch {
                reject(new Error(`Transcription failed with status ${xhr.status}`));
              }
            }
          });

          // Handle errors
          xhr.addEventListener('error', () => {
            xhrRef.current = null;
            reject(new Error('Network error during transcription'));
          });

          // Handle abort
          xhr.addEventListener('abort', () => {
            xhrRef.current = null;
            reject(new Error('Transcription cancelled'));
          });

          // Handle cancellation via AbortController
          if (abortControllerRef.current) {
            abortControllerRef.current.signal.addEventListener('abort', () => {
              xhr.abort();
            });
          }

          // Send request
          xhr.open('POST', '/api/transcribe');
          xhr.send(formData);
        });

        // Check result
        if (!result.success || !result.data?.id) {
          throw new Error(result.error || 'Transcription failed - no transcript ID returned');
        }

        // Phase 4: Complete
        const transcriptId = result.data.id;
        updateState({
          status: 'complete',
          progress: 100,
          message: 'Transcription complete!',
          transcriptId,
        });

        // Call onComplete callback
        onComplete?.(transcriptId);

      } catch (error) {
        // Handle errors
        const errorObj = error instanceof Error ? error : new Error('Transcription failed');

        // Don't update state if cancelled
        if (errorObj.message === 'Transcription cancelled') {
          return;
        }

        updateState({
          status: 'error',
          progress: 0,
          message: errorObj.message,
          error: errorObj,
        });

        // Call onError callback
        onError?.(errorObj);
      }
    },
    [reset, updateState, language, model, enableSpeakerDetection, onComplete, onError]
  );

  /**
   * Cleanup on unmount
   */
  React.useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (xhrRef.current) {
        xhrRef.current.abort();
      }
    };
  }, []);

  return {
    state,
    startTranscription,
    cancelTranscription,
    reset,
  };
}
