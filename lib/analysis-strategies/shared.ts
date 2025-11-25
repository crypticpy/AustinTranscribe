/**
 * Shared Analysis Strategy Utilities
 *
 * Common functions and types used across all analysis strategies.
 * Includes validation, formatting, and utility helpers.
 */

import type { AnalysisResults, OutputFormat } from '@/types';
import { estimateTokens } from '@/lib/token-utils';

/**
 * Constants for analysis configuration
 */
export const ANALYSIS_CONSTANTS = {
  MAX_BULLET_POINTS: 10,
  MAX_BULLET_WORDS: 15,
  MAX_PARAGRAPH_WORDS: 200,
  MAX_INPUT_TOKENS_WARNING: 200000, // Leave buffer for response
  BASIC_TEMPERATURE: 0.3,
  HYBRID_TEMPERATURE: 0.3,
  ADVANCED_TEMPERATURE: 0.2,
  EVALUATION_TEMPERATURE: 0.3, // Slightly higher than advanced for improvement creativity
  MAX_COMPLETION_TOKENS: 32000,
} as const;

/**
 * Format output type description for prompts
 */
export function formatOutputType(format: OutputFormat): string {
  switch (format) {
    case 'bullet_points':
      return `Bulleted list (MUST use "-" character ONLY, NOT numbered lists 1,2,3 or other bullets •,*,+, max ${ANALYSIS_CONSTANTS.MAX_BULLET_POINTS} items, ${ANALYSIS_CONSTANTS.MAX_BULLET_WORDS} words each)`;
    case 'paragraph':
      return `Paragraph format (continuous prose, 100-${ANALYSIS_CONSTANTS.MAX_PARAGRAPH_WORDS} words)`;
    case 'table':
      return 'Table format (use markdown table syntax if needed, or structured bullets)';
  }
}

/**
 * Validation result structure
 */
export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * Validate that all relationship IDs reference existing entities
 *
 * Ensures data integrity by checking that all cross-references
 * between entities (agenda items, decisions, action items) are valid.
 *
 * @param results - Analysis results to validate
 * @returns Validation result with warnings and errors
 */
export function validateRelationshipIds(results: AnalysisResults): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const agendaIds = new Set(results.agendaItems?.map((a) => a.id) || []);
  const decisionIds = new Set(results.decisions?.map((d) => d.id) || []);

  // Validate decision -> agenda links
  results.decisions?.forEach((decision) => {
    decision.agendaItemIds?.forEach((id) => {
      if (!agendaIds.has(id)) {
        warnings.push(
          `Decision "${decision.id}" references non-existent agenda item "${id}"`
        );
      }
    });
  });

  // Validate action -> agenda and action -> decision links
  results.actionItems?.forEach((action) => {
    action.agendaItemIds?.forEach((id) => {
      if (!agendaIds.has(id)) {
        warnings.push(
          `Action "${action.id}" references non-existent agenda item "${id}"`
        );
      }
    });
    action.decisionIds?.forEach((id) => {
      if (!decisionIds.has(id)) {
        warnings.push(
          `Action "${action.id}" references non-existent decision "${id}"`
        );
      }
    });
  });

  return {
    valid: warnings.length === 0 && errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Ensure unique IDs within entity collections
 *
 * Detects and fixes duplicate IDs by reassigning them sequentially.
 * Logs warnings when duplicates are found.
 *
 * @param items - Array of items with id property
 * @param prefix - ID prefix for regenerated IDs
 * @returns Array with guaranteed unique IDs
 */
export function ensureUniqueIds<T extends { id: string }>(
  items: T[] | undefined,
  prefix: string
): T[] | undefined {
  if (!items || items.length === 0) return items;

  const seen = new Set<string>();
  let counter = 1;

  return items.map((item) => {
    if (seen.has(item.id)) {
      // Duplicate detected - assign new ID
      let newId: string;
      do {
        newId = `${prefix}-${counter++}`;
      } while (seen.has(newId)); // Ensure the new ID is also unique

      console.warn(
        `[ID Deduplication] Duplicate ID "${item.id}" changed to "${newId}"`
      );
      seen.add(newId);
      return { ...item, id: newId };
    }
    seen.add(item.id);
    return item;
  });
}

/**
 * Validate token limits before making API calls
 *
 * Checks if transcript + prompt will exceed safe token limits
 * and returns warnings if approaching capacity.
 *
 * @param transcript - Full transcript text
 * @param prompt - Generated prompt text
 * @param strategyName - Name of strategy (for logging)
 * @returns Validation result
 */
export function validateTokenLimits(
  transcript: string,
  prompt: string,
  strategyName: string
): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const transcriptTokens = estimateTokens(transcript);
  const promptTokens = estimateTokens(prompt);
  const totalInputTokens = transcriptTokens + promptTokens;

  if (totalInputTokens > ANALYSIS_CONSTANTS.MAX_INPUT_TOKENS_WARNING) {
    warnings.push(
      `[${strategyName}] Input tokens (${totalInputTokens.toLocaleString()}) ` +
        'approaching context limit. Consider using a different strategy.'
    );
  }

  // Error if definitely over limit (256K for standard, 1M for extended)
  if (totalInputTokens > 250000) {
    errors.push(
      `[${strategyName}] Input tokens (${totalInputTokens.toLocaleString()}) ` +
        'exceed safe context limit (250K). Analysis will likely fail.'
    );
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Retry function with exponential backoff
 *
 * Retries a function on failure with increasing delays between attempts.
 * Useful for handling transient network errors or rate limiting.
 *
 * @param fn - Async function to retry
 * @param maxRetries - Maximum number of retry attempts
 * @param baseDelay - Base delay in milliseconds
 * @returns Result of successful function call
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      const delay = baseDelay * Math.pow(2, i);
      console.warn(
        `[Retry] Attempt ${i + 1} failed, retrying in ${delay}ms...`,
        error
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Unreachable');
}

/**
 * Apply all post-processing validations and fixes to analysis results
 *
 * Ensures data integrity by:
 * 1. Enforcing unique IDs
 * 2. Validating relationship references
 * 3. Logging warnings and errors
 *
 * @param results - Raw analysis results
 * @param strategyName - Name of strategy (for logging)
 * @returns Cleaned and validated results
 */
export function postProcessResults(
  results: AnalysisResults,
  strategyName: string
): AnalysisResults {
  console.log(`[${strategyName}] Post-processing results`);

  // 1. Ensure unique IDs
  const processedResults: AnalysisResults = {
    ...results,
    agendaItems: ensureUniqueIds(results.agendaItems, 'agenda'),
    actionItems: ensureUniqueIds(results.actionItems, 'action'),
    decisions: ensureUniqueIds(results.decisions, 'decision'),
  };

  // 2. Validate relationship IDs
  const validation = validateRelationshipIds(processedResults);

  if (!validation.valid) {
    console.warn(`[${strategyName}] Relationship validation warnings:`, validation.warnings);
  }

  if (validation.errors.length > 0) {
    console.error(`[${strategyName}] Relationship validation errors:`, validation.errors);
  }

  // 3. Log statistics
  const stats = {
    agendaItemCount: processedResults.agendaItems?.length || 0,
    actionItemCount: processedResults.actionItems?.length || 0,
    decisionCount: processedResults.decisions?.length || 0,
    validationWarnings: validation.warnings.length,
    validationErrors: validation.errors.length,
  };

  console.log(`[${strategyName}] Post-processing complete`, stats);

  return processedResults;
}

/**
 * Structured logger for consistent logging across strategies
 */
export const logger = {
  info: (strategy: string, message: string, meta?: unknown) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${strategy}]`, message, meta || '');
  },

  warn: (strategy: string, message: string, meta?: unknown) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [${strategy}] WARNING:`, message, meta || '');
  },

  error: (strategy: string, message: string, error?: unknown) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [${strategy}] ERROR:`, message, error);
  },

  debug: (strategy: string, message: string, meta?: unknown) => {
    const timestamp = new Date().toISOString();
    console.debug(`[${timestamp}] [${strategy}] DEBUG:`, message, meta || '');
  },
};

/**
 * Track performance metrics for strategy execution
 *
 * @param strategyName - Name of strategy
 * @param estimatedSeconds - Estimated processing time in seconds
 * @param actualMs - Actual processing time in milliseconds
 */
export function logPerformanceMetrics(
  strategyName: string,
  estimatedSeconds: string,
  actualMs: number
): void {
  const actualSeconds = (actualMs / 1000).toFixed(1);
  const [minEst, maxEst] = estimatedSeconds.split('-').map((s) => parseInt(s));
  const avgEst = (minEst + maxEst) / 2;
  const withinEstimate = actualMs / 1000 <= maxEst;

  logger.info(strategyName, 'Performance metrics', {
    estimated: estimatedSeconds,
    actual: `${actualSeconds}s`,
    withinEstimate,
    variance: `${(((actualMs / 1000 - avgEst) / avgEst) * 100).toFixed(1)}%`,
  });
}
