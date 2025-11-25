/**
 * Basic Analysis Strategy - Monolithic Single-Pass
 *
 * Fast analysis that processes all sections in a single API call.
 * Best for: Short meetings (<15k tokens), quick overviews, straightforward discussions.
 *
 * Processing Time: 30-60 seconds
 * API Calls: 1 call (all sections at once)
 * Quality: Good - captures key information but minimal cross-referencing
 *
 * Features:
 * - Single comprehensive prompt with all section requirements
 * - Structured JSON output with relationship IDs
 * - Explicit instructions for linking decisions/actions to agenda items
 * - Identification of orphaned items
 */

import type {
  Template,
  AnalysisResults,
  AnalysisSection,
  AgendaItem,
  ActionItem,
  Decision,
  Quote,
  EvaluationResults,
} from '@/types';
import type OpenAI from 'openai';
import {
  formatOutputType,
  postProcessResults,
  validateTokenLimits,
  ANALYSIS_CONSTANTS,
  retryWithBackoff,
} from './shared';
import { executeEvaluationPass } from './evaluator';

/**
 * Result from basic analysis (raw JSON response)
 */
interface BasicAnalysisResponse {
  sections: {
    name: string;
    content: string;
  }[];
  agendaItems?: Array<{
    id: string;
    topic: string;
    timestamp?: number;
    context?: string;
  }>;
  actionItems?: Array<{
    id: string;
    task: string;
    owner?: string;
    deadline?: string;
    timestamp?: number;
    agendaItemIds?: string[];
    decisionIds?: string[];
  }>;
  decisions?: Array<{
    id: string;
    decision: string;
    timestamp: number;
    context?: string;
    agendaItemIds?: string[];
  }>;
  quotes?: Array<{
    text: string;
    speaker?: string;
    timestamp: number;
  }>;
  summary?: string;
}

/**
 * Generate monolithic prompt for basic analysis
 *
 * Creates a single comprehensive prompt that requests all sections,
 * structured outputs, and relationship mapping in one API call.
 *
 * @param template - Analysis template with sections
 * @param transcript - Full transcript text
 * @returns Comprehensive prompt string
 */
export function generateBasicAnalysisPrompt(
  template: Template,
  transcript: string
): string {
  const sectionInstructions = template.sections
    .map((section, idx) => {
      return `
### Section ${idx + 1}: ${section.name}

**Task**: ${section.prompt}

**Output Format**: ${formatOutputType(section.outputFormat)}

**Requirements**:
- Provide clear, concise content
- For bullet_points: MUST use "-" character ONLY (NOT numbered lists 1,2,3), max ${ANALYSIS_CONSTANTS.MAX_BULLET_POINTS} items, capitalize first letter
- For paragraphs: Continuous prose, ${ANALYSIS_CONSTANTS.MAX_PARAGRAPH_WORDS} words max
- Start with action verbs or key concepts
- Be specific and actionable
`;
    })
    .join('\n');

  const hasAgenda = template.sections.some((s) =>
    s.name.toLowerCase().includes('agenda')
  );
  const hasDecisions = template.outputs.includes('decisions');
  const hasActionItems = template.outputs.includes('action_items');

  const relationshipInstructions = hasAgenda
    ? `
## CRITICAL: Relationship Mapping

Since this meeting has an agenda, you MUST establish relationships between items:

1. **Agenda Items**: Extract and assign unique IDs (e.g., "agenda-1", "agenda-2")
2. **Decisions**: Link each decision to relevant agenda item IDs using agendaItemIds array
3. **Action Items**: Link each action to:
   - Agenda items (agendaItemIds) - which topic does this relate to?
   - Decisions (decisionIds) - which decision spawned this action?

**Orphaned Items**: Note any items that don't map to the agenda:
- Decisions made outside the main agenda topics
- Action items not tied to any decision
- Agenda items with no decisions or actions

This relationship mapping is ESSENTIAL for coherent meeting minutes.
`
    : '';

  return `You are an expert meeting analyst for Austin Public Health. Your task is to analyze this transcript and extract ALL requested information in a SINGLE structured JSON response.

## Analysis Guidelines

- **Audience**: City of Austin employees (8th grade reading level)
- **Style**: Clear, concise, professional but accessible
- **Focus**: Extract only what was explicitly stated or strongly implied
- **Evidence**: Base analysis on transcript content, not assumptions
- **Completeness**: Address ALL sections and outputs requested

${sectionInstructions}

${relationshipInstructions}

## Structured Outputs

${
  template.outputs.includes('summary')
    ? `
**Summary**: Provide a concise 3-5 sentence overview of the entire meeting. Capture:
- Main topics discussed
- Key outcomes
- Overall tone/sentiment
- Next steps (if any)
`
    : ''
}

${
  hasActionItems
    ? `
**Action Items**: Extract ALL tasks, assignments, and follow-up items as structured objects:
- Assign unique IDs (e.g., "action-1", "action-2")
- Include: task description, owner (if mentioned), deadline (if mentioned)
- Link to agenda items and decisions using IDs${hasAgenda ? ' (REQUIRED)' : ' (if applicable)'}
`
    : ''
}

${
  hasDecisions
    ? `
**Decisions**: Extract ALL decisions, resolutions, and conclusions as structured objects:
- Assign unique IDs (e.g., "decision-1", "decision-2")
- Include: decision text, context/rationale, timestamp
- Link to agenda items using IDs${hasAgenda ? ' (REQUIRED)' : ' (if applicable)'}
`
    : ''
}

${
  template.outputs.includes('quotes')
    ? `
**Quotes**: Extract 3-5 notable or impactful quotes:
- Include: exact quote text, speaker (if identifiable), timestamp
- Focus on memorable, insightful, or decision-driving statements
`
    : ''
}

## Output Format

You MUST respond with valid JSON in this EXACT structure:

\`\`\`json
{
  "sections": [
    {
      "name": "Section Name",
      "content": "Extracted content formatted per requirements"
    }
  ],
  ${
    hasAgenda
      ? `"agendaItems": [
    {
      "id": "agenda-1",
      "topic": "Agenda topic",
      "timestamp": 120,
      "context": "Optional context"
    }
  ],`
      : ''
  }
  ${
    hasActionItems
      ? `"actionItems": [
    {
      "id": "action-1",
      "task": "Task description",
      "owner": "Person name",
      "deadline": "Due date",
      "timestamp": 300,
      "agendaItemIds": ["agenda-1"],
      "decisionIds": ["decision-2"]
    }
  ],`
      : ''
  }
  ${
    hasDecisions
      ? `"decisions": [
    {
      "id": "decision-1",
      "decision": "Decision text",
      "timestamp": 240,
      "context": "Rationale",
      "agendaItemIds": ["agenda-1"]
    }
  ],`
      : ''
  }
  ${
    template.outputs.includes('quotes')
      ? `"quotes": [
    {
      "text": "Exact quote",
      "speaker": "Speaker name",
      "timestamp": 180
    }
  ],`
      : ''
  }
  ${template.outputs.includes('summary') ? `"summary": "Overall meeting summary"` : ''}
}
\`\`\`

## Transcript

${transcript}

## Response

Provide your complete analysis as valid JSON following the structure above. Ensure all relationship IDs are correctly assigned and linked.`;
}


/**
 * Parse basic analysis response and convert to AnalysisResults
 *
 * @param response - Raw JSON response from GPT
 * @param template - Template used for analysis
 * @returns Structured AnalysisResults object
 */
export function parseBasicAnalysisResponse(
  response: BasicAnalysisResponse
): AnalysisResults {
  // Convert sections (no evidence in basic mode for speed)
  const sections: AnalysisSection[] = response.sections.map((s) => ({
    name: s.name,
    content: s.content,
    evidence: [], // Basic mode doesn't extract evidence for speed
  }));

  // Convert agenda items
  const agendaItems: AgendaItem[] | undefined = response.agendaItems?.map((item) => ({
    id: item.id,
    topic: item.topic,
    timestamp: item.timestamp,
    context: item.context,
  }));

  // Convert action items
  const actionItems: ActionItem[] | undefined = response.actionItems?.map((item) => ({
    id: item.id,
    task: item.task,
    owner: item.owner,
    deadline: item.deadline,
    timestamp: item.timestamp,
    agendaItemIds: item.agendaItemIds,
    decisionIds: item.decisionIds,
  }));

  // Convert decisions
  const decisions: Decision[] | undefined = response.decisions?.map((item) => ({
    id: item.id,
    decision: item.decision,
    timestamp: item.timestamp,
    context: item.context,
    agendaItemIds: item.agendaItemIds,
  }));

  // Convert quotes
  const quotes: Quote[] | undefined = response.quotes;

  return {
    summary: response.summary,
    sections,
    agendaItems,
    actionItems,
    decisions,
    quotes,
  };
}

/**
 * Validate basic analysis response structure
 *
 * @param data - Parsed JSON data
 * @returns true if valid structure
 */
export function isValidBasicAnalysisResponse(data: unknown): data is BasicAnalysisResponse {
  if (!data || typeof data !== 'object') return false;

  const obj = data as Record<string, unknown>;

  // Must have sections array
  if (!Array.isArray(obj.sections)) return false;

  // Validate each section
  for (const section of obj.sections) {
    if (
      !section ||
      typeof section !== 'object' ||
      typeof section.name !== 'string' ||
      typeof section.content !== 'string'
    ) {
      return false;
    }
  }

  // Optional arrays must be valid if present
  if (obj.agendaItems !== undefined && !Array.isArray(obj.agendaItems)) return false;
  if (obj.actionItems !== undefined && !Array.isArray(obj.actionItems)) return false;
  if (obj.decisions !== undefined && !Array.isArray(obj.decisions)) return false;
  if (obj.quotes !== undefined && !Array.isArray(obj.quotes)) return false;

  // Summary must be string if present
  if (obj.summary !== undefined && typeof obj.summary !== 'string') return false;

  return true;
}

/**
 * Configuration options for basic analysis execution
 */
export interface BasicAnalysisConfig {
  /** Whether to run self-evaluation pass after analysis */
  runEvaluation?: boolean;
}

/**
 * Extended result type that includes evaluation metadata
 */
export interface BasicAnalysisResult {
  /** Final analysis results (post-evaluation if runEvaluation=true) */
  results: AnalysisResults;
  /** Draft results before evaluation (only if runEvaluation=true) */
  draftResults?: AnalysisResults;
  /** Evaluation metadata (only if runEvaluation=true) */
  evaluation?: EvaluationResults;
  /** The prompt used for analysis */
  promptUsed: string;
}

/**
 * Execute basic analysis strategy
 *
 * Main entry point for basic analysis mode. Makes a single API call
 * with comprehensive prompt and returns structured results.
 *
 * @param template - Analysis template
 * @param transcript - Full transcript text
 * @param openaiClient - Azure OpenAI client instance
 * @param deployment - GPT deployment name
 * @param config - Optional configuration (evaluation, etc.)
 * @returns Promise<BasicAnalysisResult>
 */
export async function executeBasicAnalysis(
  template: Template,
  transcript: string,
  openaiClient: OpenAI,
  deployment: string,
  config?: BasicAnalysisConfig
): Promise<BasicAnalysisResult> {
  console.log('[Basic Analysis] Generating monolithic prompt');
  const prompt = generateBasicAnalysisPrompt(template, transcript);

  // Validate token limits before API call
  const validation = validateTokenLimits(transcript, prompt, 'Basic Analysis');
  if (validation.warnings.length > 0) {
    validation.warnings.forEach(w => console.warn(w));
  }
  if (!validation.valid) {
    throw new Error(validation.errors.join('; '));
  }

  console.log('[Basic Analysis] Making single API call', {
    deployment,
    templateSections: template.sections.length,
    outputs: template.outputs,
  });

  const response = await retryWithBackoff(
    async () => {
      const res = await openaiClient.chat.completions.create({
        model: deployment,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert meeting analyst. You provide structured, accurate analysis ' +
              'of meeting transcripts with clear relationship mapping between agenda items, ' +
              'decisions, and action items. Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_completion_tokens: ANALYSIS_CONSTANTS.MAX_COMPLETION_TOKENS, // GPT-5 requires max_completion_tokens
        response_format: { type: 'json_object' }, // Enforce JSON response
      });

      // Validate response before returning
      const finishReason = res.choices[0].finish_reason;
      const content = res.choices[0].message.content;

      console.log('[Basic Analysis] Received response', {
        tokensUsed: res.usage?.total_tokens,
        finishReason: finishReason,
        contentLength: content?.length ?? 0,
      });

      // Handle content filter - retry as it's likely a false positive
      if (finishReason === 'content_filter') {
        console.warn('[Basic Analysis] Content filter triggered - retrying');
        throw new Error('RETRY'); // Will be caught by retry logic
      }

      // Handle token limit exceeded - fail fast with actionable error
      if (finishReason === 'length') {
        throw new Error(
          'Response truncated due to token limit. ' +
          'The transcript may be too long for Basic strategy. Consider using shorter content.'
        );
      }

      // Handle empty response
      if (!content || content.trim() === '') {
        console.error('[Basic Analysis] Empty response received', {
          finishReason,
          hasContent: !!content,
          contentLength: content?.length ?? 0,
        });
        throw new Error('RETRY'); // Retry for empty responses
      }

      return res;
    },
    3, // Max 3 retry attempts
    2000 // 2 second initial delay
  );

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error(
      `Empty response from OpenAI (finish_reason: ${response.choices[0].finish_reason})`
    );
  }

  // Parse JSON response
  let parsedResponse: unknown;
  try {
    parsedResponse = JSON.parse(content);
  } catch (error) {
    console.error('[Basic Analysis] Failed to parse JSON response:', error);
    console.error('[Basic Analysis] Response content:', content.substring(0, 500));
    throw new Error('Invalid JSON response from OpenAI');
  }

  // Validate structure
  if (!isValidBasicAnalysisResponse(parsedResponse)) {
    console.error('[Basic Analysis] Invalid response structure');
    throw new Error('Response does not match expected structure');
  }

  // Convert to AnalysisResults
  const rawResults = parseBasicAnalysisResponse(parsedResponse);

  // Post-process: ensure unique IDs and validate relationships
  const draftResults = postProcessResults(rawResults, 'Basic Analysis');

  console.log('[Basic Analysis] Analysis complete', {
    sectionCount: draftResults.sections.length,
    agendaItemCount: draftResults.agendaItems?.length || 0,
    actionItemCount: draftResults.actionItems?.length || 0,
    decisionCount: draftResults.decisions?.length || 0,
    quoteCount: draftResults.quotes?.length || 0,
    hasSummary: !!draftResults.summary,
  });

  // Check if self-evaluation should run
  if (config?.runEvaluation) {
    console.log('[Basic Analysis] Running self-evaluation pass');
    const { evaluation, finalResults } = await executeEvaluationPass(
      template,
      transcript,
      draftResults,
      'basic',
      openaiClient,
      deployment,
      [prompt]
    );

    return {
      results: finalResults,
      draftResults,
      evaluation,
      promptUsed: prompt,
    };
  }

  // Return draft results without evaluation
  return {
    results: draftResults,
    promptUsed: prompt,
  };
}
