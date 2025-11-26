/**
 * Analysis Strategies - Unified Entry Point
 *
 * Provides a single interface for executing transcript analysis using
 * any of the three available strategies (basic, hybrid, advanced).
 *
 * Includes automatic strategy selection based on transcript length.
 */

import type { Template, AnalysisResults, EvaluationResults } from '@/types';
import type { AnalysisStrategy } from '@/lib/analysis-strategy';
import type OpenAI from 'openai';
import { recommendStrategy, getStrategyMetadata } from '@/lib/analysis-strategy';
import { estimateTokens } from '@/lib/token-utils';

// Import all strategy executors
import {
  executeBasicAnalysis,
  type BasicAnalysisConfig,
  type BasicAnalysisResult,
} from './basic';
import {
  executeHybridAnalysis,
  type HybridAnalysisConfig,
  type HybridAnalysisResult,
} from './hybrid';
import {
  executeAdvancedAnalysis,
  type AdvancedAnalysisConfig,
  type AdvancedAnalysisResult,
} from './advanced';

// Re-export shared utilities
export * from './shared';

// Re-export evaluator
export * from './evaluator';

/**
 * Configuration for analysis execution
 */
export interface AnalysisConfig {
  /**
   * Strategy to use for analysis.
   * If 'auto', strategy is selected based on transcript length.
   * Defaults to 'auto'.
   */
  strategy?: AnalysisStrategy | 'auto';

  /**
   * Whether to run self-evaluation pass after main analysis.
   * Adds 30-45 seconds but improves quality by 10-20%.
   * Defaults to true.
   */
  runEvaluation?: boolean;

  /**
   * Optional callback for progress updates.
   * Called at various stages during analysis.
   */
  progressCallback?: (current: number, total: number, message: string) => void;
}

/**
 * Unified result type for all strategies
 */
export interface AnalysisExecutionResult {
  /** The strategy that was used */
  strategy: AnalysisStrategy;

  /** Final analysis results (post-evaluation if runEvaluation=true) */
  results: AnalysisResults;

  /** Draft results before evaluation (only if runEvaluation=true) */
  draftResults?: AnalysisResults;

  /** Evaluation metadata (only if runEvaluation=true) */
  evaluation?: EvaluationResults;

  /** Array of prompts used during analysis */
  promptsUsed: string[];

  /** Metadata about the strategy used */
  metadata: {
    estimatedDuration: string;
    apiCalls: string;
    quality: string;
    actualTokens: number;
    wasAutoSelected: boolean;
  };
}

/**
 * Execute transcript analysis using the specified or auto-selected strategy
 *
 * This is the main entry point for all transcript analysis. It handles:
 * - Automatic strategy selection based on transcript length
 * - Execution of the appropriate strategy
 * - Optional self-evaluation pass
 * - Progress tracking
 * - Metadata collection
 *
 * @param template - Analysis template defining sections to extract
 * @param transcript - Full transcript text to analyze
 * @param openaiClient - Azure OpenAI client instance
 * @param deployment - GPT deployment name to use
 * @param config - Optional configuration (strategy selection, evaluation, etc.)
 * @returns Promise<AnalysisExecutionResult> with results and metadata
 *
 * @example
 * ```typescript
 * const result = await executeAnalysis(
 *   template,
 *   transcript,
 *   openaiClient,
 *   'gpt-5',
 *   { strategy: 'auto', runEvaluation: true }
 * );
 *
 * console.log(`Used ${result.strategy} strategy`);
 * console.log(`Quality score: ${result.evaluation?.qualityScore}`);
 * ```
 */
export async function executeAnalysis(
  template: Template,
  transcript: string,
  openaiClient: OpenAI,
  deployment: string,
  config: AnalysisConfig = {}
): Promise<AnalysisExecutionResult> {
  const startTime = Date.now();

  // Default configuration
  const {
    strategy: strategyOption = 'auto',
    runEvaluation = true,
    progressCallback,
  } = config;

  // Determine strategy to use
  let strategy: AnalysisStrategy;
  let wasAutoSelected = false;

  if (strategyOption === 'auto') {
    const recommendation = recommendStrategy(transcript);
    strategy = recommendation.strategy;
    wasAutoSelected = true;
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Analysis] Auto-selected strategy: ${strategy} (${recommendation.reasoning})`);
    }
  } else {
    strategy = strategyOption;
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Analysis] Using specified strategy: ${strategy}`);
    }
  }

  // Get strategy metadata
  const metadata = getStrategyMetadata(strategy);
  const actualTokens = estimateTokens(transcript);

  if (process.env.NODE_ENV === 'development') {
    console.log('[Analysis] Starting analysis', {
      strategy,
      wasAutoSelected,
      templateName: template.name,
      templateSections: template.sections.length,
      transcriptTokens: actualTokens,
      runEvaluation,
      estimatedDuration: metadata.speed,
      estimatedApiCalls: metadata.apiCalls,
    });
  }

  // Execute the appropriate strategy
  let result: BasicAnalysisResult | HybridAnalysisResult | AdvancedAnalysisResult;

  switch (strategy) {
    case 'basic':
      result = await executeBasicAnalysis(template, transcript, openaiClient, deployment, {
        runEvaluation,
      } as BasicAnalysisConfig);
      break;

    case 'hybrid':
      result = await executeHybridAnalysis(
        template,
        transcript,
        openaiClient,
        deployment,
        progressCallback,
        { runEvaluation } as HybridAnalysisConfig
      );
      break;

    case 'advanced':
      result = await executeAdvancedAnalysis(
        template,
        transcript,
        openaiClient,
        deployment,
        progressCallback,
        { runEvaluation } as AdvancedAnalysisConfig
      );
      break;

    default:
      throw new Error(`Unknown strategy: ${strategy}`);
  }

  const endTime = Date.now();
  const durationMs = endTime - startTime;
  const durationSec = (durationMs / 1000).toFixed(1);

  if (process.env.NODE_ENV === 'development') {
    console.log('[Analysis] Analysis complete', {
      strategy,
      durationMs,
      durationSec: `${durationSec}s`,
      estimatedDuration: metadata.speed,
      hadEvaluation: !!result.evaluation,
      qualityScore: result.evaluation?.qualityScore || 0,
      sectionsAnalyzed: result.results.sections.length,
      agendaItems: result.results.agendaItems?.length || 0,
      decisions: result.results.decisions?.length || 0,
      actionItems: result.results.actionItems?.length || 0,
    });
  }

  // Return unified result
  // Handle different property names: basic uses `promptUsed` (string), others use `promptsUsed` (string[])
  const promptsUsed = 'promptsUsed' in result
    ? result.promptsUsed
    : 'promptUsed' in result
      ? [result.promptUsed]
      : [];
  return {
    strategy,
    results: result.results,
    draftResults: result.draftResults,
    evaluation: result.evaluation,
    promptsUsed,
    metadata: {
      estimatedDuration: metadata.speed,
      apiCalls: metadata.apiCalls,
      quality: metadata.quality,
      actualTokens,
      wasAutoSelected,
    },
  };
}

/**
 * Get a recommendation for which strategy to use
 *
 * @param transcript - Full transcript text
 * @returns Recommended strategy and reason
 */
export function getStrategyRecommendation(transcript: string): {
  strategy: AnalysisStrategy;
  reason: string;
  metadata: ReturnType<typeof getStrategyMetadata>;
} {
  const recommendation = recommendStrategy(transcript);
  const metadata = getStrategyMetadata(recommendation.strategy);
  const tokens = estimateTokens(transcript);

  const reasons = {
    basic:
      `Short meeting (${tokens.toLocaleString()} tokens). ` +
      'Basic strategy provides quick analysis in 30-60 seconds.',
    hybrid:
      `Medium meeting (${tokens.toLocaleString()} tokens). ` +
      'Hybrid strategy balances speed and quality with contextual batching.',
    advanced:
      `Long/complex meeting (${tokens.toLocaleString()} tokens). ` +
      'Advanced strategy provides highest quality with cascading analysis.',
  };

  return {
    strategy: recommendation.strategy,
    reason: reasons[recommendation.strategy],
    metadata,
  };
}
