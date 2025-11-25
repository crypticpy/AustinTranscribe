/**
 * Analysis Hook
 *
 * Custom React hook for creating and managing transcript analyses.
 * Provides state management, API calls, and IndexedDB persistence.
 */

'use client';

import { useState, useCallback } from 'react';
import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Analysis, AnalysisProgress } from '@/types/analysis';
import type { Transcript } from '@/types/transcript';
import type { Template } from '@/types/template';
import type { AnalysisStrategy } from '@/lib/analysis-strategy';
import {
  saveAnalysis,
  getAnalysisByTranscript,
  getAnalysesPaginated,
  type PaginationOptions,
  type PaginatedResult
} from '@/lib/db';
import {
  calculateEstimatedTime,
  getStrategyPhases,
  calculatePhaseProgress,
  type ProgressPhase
} from '@/lib/analysis-progress-metadata';

/**
 * Analysis state interface
 */
export interface AnalysisState {
  /** Current analysis being created/viewed */
  analysis: Analysis | null;

  /** All analyses for a transcript */
  analyses: Analysis[];

  /** Loading state */
  loading: boolean;

  /** Error message if analysis failed */
  error: string | null;

  /** Progress information during analysis creation */
  progress: AnalysisProgress | null;

  /** Abort controller for cancelling in-progress analysis */
  abortController: AbortController | null;

  /** Resolved strategy being used (after 'auto' resolution) */
  resolvedStrategy: AnalysisStrategy | null;
}

/**
 * Hook return interface
 */
export interface UseAnalysisReturn {
  /** Current state */
  state: AnalysisState;

  /** Create a new analysis for a transcript */
  analyzeTranscript: (
    transcript: Transcript,
    template: Template,
    strategy?: AnalysisStrategy | 'auto',
    runEvaluation?: boolean
  ) => Promise<Analysis | null>;

  /** Fetch all analyses for a transcript */
  fetchAnalyses: (transcriptId: string, signal?: AbortSignal) => Promise<Analysis[]>;

  /** Cancel an in-progress analysis */
  cancelAnalysis: () => void;

  /** Clear current analysis and error state */
  clearAnalysis: () => void;

  /** Reset all state */
  reset: () => void;
}

/**
 * Initial state
 */
const initialState: AnalysisState = {
  analysis: null,
  analyses: [],
  loading: false,
  error: null,
  progress: null,
  abortController: null,
  resolvedStrategy: null,
};

/**
 * Custom hook for managing transcript analysis operations
 *
 * @returns Analysis state and operations
 *
 * @example
 * ```tsx
 * function AnalysisPage() {
 *   const { state, analyzeTranscript } = useAnalysis();
 *
 *   const handleAnalyze = async () => {
 *     const analysis = await analyzeTranscript(transcript, template);
 *     if (analysis) {
 *       console.log('Analysis complete:', analysis);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       {state.loading && <p>Analyzing: {state.progress?.message}</p>}
 *       {state.error && <p>Error: {state.error}</p>}
 *       {state.analysis && <AnalysisViewer analysis={state.analysis} />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAnalysis(): UseAnalysisReturn {
  const [state, setState] = useState<AnalysisState>(initialState);

  /**
   * Update progress during analysis
   */
  const updateProgress = useCallback((progress: AnalysisProgress) => {
    setState((prev) => ({ ...prev, progress }));
  }, []);

  /**
   * Fetch all analyses for a transcript from IndexedDB
   * RACE CONDITION FIX: Added cancellation support for async operation
   */
  const fetchAnalyses = useCallback(async (
    transcriptId: string,
    signal?: AbortSignal
  ): Promise<Analysis[]> => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      // Check if cancelled before async operation
      if (signal?.aborted) {
        return [];
      }

      const analyses = await getAnalysisByTranscript(transcriptId);

      // Check if cancelled after async operation
      if (signal?.aborted) {
        return [];
      }

      setState((prev) => ({ ...prev, analyses, loading: false }));
      return analyses;
    } catch (error) {
      // Don't update state if operation was cancelled
      if (signal?.aborted) {
        return [];
      }

      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch analyses';
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }));
      return [];
    }
  }, []);

  /**
   * Analyze a transcript using the specified template
   *
   * This function:
   * 1. Calls the analysis API endpoint
   * 2. Tracks progress during analysis with simulated updates
   * 3. Saves the completed analysis to IndexedDB
   * 4. Returns the analysis object
   * 5. Supports cancellation via AbortController
   *
   * @param transcript - The transcript to analyze
   * @param template - The analysis template to use
   * @param strategy - Analysis strategy ('basic' | 'hybrid' | 'advanced' | 'auto'). Defaults to 'auto'
   * @param runEvaluation - Whether to run evaluation on the analysis. Defaults to true
   */
  const analyzeTranscript = useCallback(
    async (
      transcript: Transcript,
      template: Template,
      strategy?: AnalysisStrategy | 'auto',
      runEvaluation?: boolean
    ): Promise<Analysis | null> => {
      // Guard against concurrent analyses
      if (state.loading) {
        console.warn('Analysis already in progress');
        return null;
      }

      // Create abort controller for cancellation
      const abortController = new AbortController();
      let progressInterval: NodeJS.Timeout | null = null;
      let currentProgress = 0;

      try {
        // Determine actual strategy to use (resolve 'auto' to concrete strategy)
        const resolvedStrategy: AnalysisStrategy =
          strategy === 'auto'
            ? template.sections.length > 6
              ? 'advanced'
              : template.sections.length > 3
              ? 'hybrid'
              : 'basic'
            : (strategy || 'basic');

        setState((prev) => ({
          ...prev,
          loading: true,
          error: null,
          abortController, // Store controller in state for cancel button
          resolvedStrategy, // Store resolved strategy for UI progress display
          progress: {
            progress: 0,
            message: 'Preparing analysis...',
            complete: false,
            currentSection: 'Initializing',
          },
        }));

        // Get strategy-specific phases and time estimate (only for hybrid/advanced)
        const sectionCount = Math.max(1, template.sections.length);
        const runEval = runEvaluation !== false;

        // Basic strategy uses simple static messages, hybrid/advanced use time-based progress
        if (resolvedStrategy !== 'basic') {
          const phases = getStrategyPhases(resolvedStrategy, template, runEval);
          const totalEstimatedTime = calculateEstimatedTime(
            resolvedStrategy,
            sectionCount,
            runEval
          );

          // Track elapsed time and current phase
          const startTime = Date.now();

          // Start strategy-aware progress updates
          progressInterval = setInterval(() => {
            const elapsedSeconds = (Date.now() - startTime) / 1000;

            // Calculate progress and current phase
            const { progress, phase } = calculatePhaseProgress(
              elapsedSeconds,
              totalEstimatedTime,
              phases
            );

            // Cap progress at 75% until API responds
            if (progress < 75) {
              updateProgress({
                progress: Math.floor(progress),
                message: phase?.message || 'Processing...',
                complete: false,
                currentSection: phase?.name || 'Processing',
              });
            }
          }, 2000); // Update every 2 seconds

          // Initial progress update for hybrid/advanced
          const initialPhase = phases[0];
          updateProgress({
            progress: 5,
            message: initialPhase?.message || `Starting ${resolvedStrategy} analysis...`,
            complete: false,
            currentSection: initialPhase?.name || 'Initializing',
          });
        } else {
          // Basic strategy: simple static message
          updateProgress({
            progress: 0,
            message: 'Processing...',
            complete: false,
            currentSection: 'Processing',
          });
        }

        // Call the analysis API endpoint with abort signal
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transcriptId: transcript.id,
            templateId: template.id,
            transcript: {
              text: transcript.text,
              segments: transcript.segments,
            },
            template: template,
            strategy: strategy || 'auto',
            runEvaluation: runEvaluation !== false,
          }),
          signal: abortController.signal,
        });

        // Clear progress interval once API responds
        if (progressInterval) {
          clearInterval(progressInterval);
          progressInterval = null;
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || `Analysis failed with status ${response.status}`
          );
        }

        // Show evaluation phase if enabled
        if (runEval) {
          updateProgress({
            progress: resolvedStrategy === 'basic' ? 0 : 78,
            message: resolvedStrategy === 'basic' ? 'Reviewing...' : 'Running quality review and self-evaluation...',
            complete: false,
            currentSection: 'Quality Review',
          });
        } else if (resolvedStrategy !== 'basic') {
          updateProgress({
            progress: 80,
            message: 'Processing analysis results...',
            complete: false,
            currentSection: 'Finalizing',
          });
        }

        const responseData = await response.json();

        // The API returns the full Analysis object in responseData.data
        const analysis: Analysis = responseData.data
          ? {
              ...responseData.data,
              // Ensure createdAt is a Date object
              createdAt: responseData.data.createdAt
                ? new Date(responseData.data.createdAt)
                : new Date(),
            }
          : {
              id: responseData.id || uuidv4(),
              transcriptId: transcript.id,
              templateId: template.id,
              results: responseData.results || responseData,
              createdAt: responseData.createdAt
                ? new Date(responseData.createdAt)
                : new Date(),
            };

        updateProgress({
          progress: resolvedStrategy === 'basic' ? 0 : 90,
          message: 'Saving analysis...',
          complete: false,
          currentSection: 'Saving',
        });

        // Save to IndexedDB
        await saveAnalysis(analysis);

        updateProgress({
          progress: resolvedStrategy === 'basic' ? 0 : 100,
          message: 'Analysis complete!',
          complete: true,
          currentSection: 'Complete',
        });

        setState((prev) => ({
          ...prev,
          analysis,
          analyses: [...prev.analyses, analysis],
          loading: false,
          abortController: null,
          progress: {
            progress: 100,
            message: 'Analysis complete!',
            complete: true,
            currentSection: 'Complete',
          },
        }));

        return analysis;
      } catch (error) {
        // Check if error was due to cancellation
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('Analysis cancelled by user');
          setState((prev) => ({
            ...prev,
            loading: false,
            error: 'Analysis cancelled',
            abortController: null,
            progress: {
              progress: 0,
              message: 'Analysis cancelled',
              complete: false,
              error: 'Analysis cancelled',
            },
          }));
          return null;
        }

        console.error('Analysis error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Analysis failed';

        setState((prev) => ({
          ...prev,
          loading: false,
          error: errorMessage,
          abortController: null,
          progress: {
            progress: 0,
            message: errorMessage,
            complete: false,
            error: errorMessage,
          },
        }));

        return null;
      } finally {
        // CRITICAL: Always clear interval in finally block to prevent memory leaks
        if (progressInterval) {
          clearInterval(progressInterval);
        }
      }
    },
    [updateProgress] // Removed state.loading to prevent callback recreation during analysis
  );

  /**
   * Cancel an in-progress analysis
   * Uses setState callback to avoid stale closure issues
   */
  const cancelAnalysis = useCallback(() => {
    setState((prev) => {
      if (prev.abortController) {
        prev.abortController.abort();
      }
      return {
        ...prev,
        loading: false,
        abortController: null,
        error: 'Analysis cancelled by user',
        progress: {
          progress: 0,
          message: 'Analysis cancelled',
          complete: false,
          error: 'Analysis cancelled by user',
        },
      };
    });
  }, []);

  /**
   * Clear current analysis and error state
   */
  const clearAnalysis = useCallback(() => {
    setState((prev) => ({
      ...prev,
      analysis: null,
      error: null,
      progress: null,
      abortController: null,
      resolvedStrategy: null,
    }));
  }, []);

  /**
   * Reset all state to initial values
   */
  const reset = useCallback(() => {
    setState((prev) => {
      // Cancel any in-progress analysis before resetting
      if (prev.abortController) {
        prev.abortController.abort();
      }
      return initialState;
    });
  }, []);

  return {
    state,
    analyzeTranscript,
    fetchAnalyses,
    cancelAnalysis,
    clearAnalysis,
    reset,
  };
}

/**
 * Hook for loading existing analyses for a transcript
 * RACE CONDITION FIX: Added AbortController to cancel stale requests
 *
 * @param transcriptId - The transcript ID to load analyses for
 * @returns Analysis state with loaded analyses
 *
 * @example
 * ```tsx
 * function AnalysisList({ transcriptId }: { transcriptId: string }) {
 *   const { analyses, loading } = useAnalysisLoader(transcriptId);
 *
 *   if (loading) return <Loader />;
 *
 *   return (
 *     <ul>
 *       {analyses.map(analysis => (
 *         <li key={analysis.id}>{analysis.createdAt}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useAnalysisLoader(transcriptId: string) {
  const { state, fetchAnalyses } = useAnalysis();

  // Fetch analyses on mount with cancellation support
  React.useEffect(() => {
    if (!transcriptId) return;

    const abortController = new AbortController();

    // Fetch with abort signal
    fetchAnalyses(transcriptId, abortController.signal);

    // Cleanup: abort the request if transcriptId changes or component unmounts
    return () => {
      abortController.abort();
    };
  }, [transcriptId, fetchAnalyses]);

  return {
    analyses: state.analyses,
    loading: state.loading,
    error: state.error,
  };
}

/**
 * Hook for loading analyses with pagination (optimized for large analysis lists)
 *
 * Uses compound indexes for efficient querying on large datasets.
 *
 * @param transcriptId - The transcript ID to load analyses for
 * @param options - Pagination options (limit, offset, orderDirection)
 * @returns Paginated analysis result with loading state
 *
 * @example
 * ```tsx
 * function AnalysisListPaginated({ transcriptId }: { transcriptId: string }) {
 *   const [page, setPage] = useState(0);
 *   const limit = 20;
 *
 *   const { result, loading, error } = useAnalysisLoaderPaginated(
 *     transcriptId,
 *     { limit, offset: page * limit }
 *   );
 *
 *   if (loading) return <Loader />;
 *   if (error) return <Error message={error} />;
 *
 *   return (
 *     <div>
 *       <p>Showing {result.items.length} of {result.total} analyses</p>
 *       {result.items.map(analysis => (
 *         <AnalysisCard key={analysis.id} analysis={analysis} />
 *       ))}
 *       {result.hasMore && (
 *         <button onClick={() => setPage(p => p + 1)}>Load More</button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAnalysisLoaderPaginated(
  transcriptId: string,
  options: PaginationOptions = {}
) {
  const [result, setResult] = React.useState<PaginatedResult<Analysis>>({
    items: [],
    total: 0,
    hasMore: false,
    offset: 0,
    limit: 20
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!transcriptId) {
      setLoading(false);
      return;
    }

    const abortController = new AbortController();

    const loadAnalyses = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check if cancelled before async operation
        if (abortController.signal.aborted) {
          return;
        }

        const paginatedResult = await getAnalysesPaginated(transcriptId, options);

        // Check if cancelled after async operation
        if (abortController.signal.aborted) {
          return;
        }

        setResult(paginatedResult);
        setLoading(false);
      } catch (err) {
        // Don't update state if operation was cancelled
        if (abortController.signal.aborted) {
          return;
        }

        const errorMessage = err instanceof Error ? err.message : 'Failed to load analyses';
        setError(errorMessage);
        setLoading(false);
      }
    };

    loadAnalyses();

    // Cleanup: abort the request if dependencies change or component unmounts
    return () => {
      abortController.abort();
    };
  }, [transcriptId, options.limit, options.offset, options.orderDirection]);

  return {
    result,
    loading,
    error,
  };
}

