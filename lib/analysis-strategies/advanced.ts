/**
 * Advanced Analysis Strategy - Serial Contextual Cascading
 *
 * Highest quality analysis that processes sections one at a time in dependency order,
 * where each section receives ALL relevant previous results in its prompt.
 *
 * Processing Time: 4-5 minutes
 * API Calls: 9-10 calls (one per section, processed serially)
 * Quality: Maximum - full contextual dependencies, explicit relationship mapping
 *
 * Features:
 * - Respects `dependencies` field in TemplateSection
 * - Topological sorting ensures dependencies are processed first
 * - Each prompt includes full results from all dependency sections
 * - Explicit relationship mapping instructions with IDs
 * - Detects orphaned items (decisions without agenda, etc.)
 * - Maintains cumulative context throughout analysis
 * - Handles circular dependency detection
 */

import type {
  Template,
  TemplateSection,
  AnalysisResults,
  EvaluationResults,
} from '@/types';
import type OpenAI from 'openai';
import {
  formatOutputType,
  postProcessResults,
  validateTokenLimits,
  ANALYSIS_CONSTANTS,
  logger,
  retryWithBackoff,
} from './shared';
import { executeEvaluationPass } from './evaluator';

/**
 * Configuration options for advanced analysis execution
 */
export interface AdvancedAnalysisConfig {
  /** Whether to run self-evaluation pass after analysis */
  runEvaluation?: boolean;
}

/**
 * Extended result type that includes evaluation metadata
 */
export interface AdvancedAnalysisResult {
  /** Final analysis results (post-evaluation if runEvaluation=true) */
  results: AnalysisResults;
  /** Draft results before evaluation (only if runEvaluation=true) */
  draftResults?: AnalysisResults;
  /** Evaluation metadata (only if runEvaluation=true) */
  evaluation?: EvaluationResults;
  /** Array of all prompts used for each section */
  promptsUsed: string[];
}

/**
 * Represents a node in the dependency graph
 */
export interface SectionDependencyNode {
  /** The template section */
  section: TemplateSection;

  /** Section IDs this section depends on */
  dependencies: string[];

  /** Section IDs that depend on this section */
  dependents: string[];
}

/**
 * Result from analyzing a single section (raw JSON response)
 */
interface SectionAnalysisResponse {
  /** The extracted content for this section */
  content: string;

  /** Agenda items if this section extracts them */
  agendaItems?: Array<{
    id: string;
    topic: string;
    timestamp?: number;
    context?: string;
  }>;

  /** Action items if this section extracts them */
  actionItems?: Array<{
    id: string;
    task: string;
    owner?: string;
    deadline?: string;
    timestamp?: number;
    agendaItemIds?: string[];
    decisionIds?: string[];
  }>;

  /** Decisions if this section extracts them */
  decisions?: Array<{
    id: string;
    decision: string;
    timestamp: number;
    context?: string;
    agendaItemIds?: string[];
  }>;

  /** Quotes if this section extracts them */
  quotes?: Array<{
    text: string;
    speaker?: string;
    timestamp: number;
  }>;

  /** Summary if this is a summary section */
  summary?: string;
}

/**
 * Build dependency graph from template sections
 *
 * Creates a graph representation of section dependencies for topological sorting.
 * Validates that all referenced dependencies exist in the template.
 *
 * @param sections - Array of template sections
 * @returns Map of section ID to dependency node
 * @throws Error if a section references a non-existent dependency
 */
export function buildDependencyGraph(
  sections: TemplateSection[]
): Map<string, SectionDependencyNode> {
  const graph = new Map<string, SectionDependencyNode>();

  // Initialize all nodes
  for (const section of sections) {
    graph.set(section.id, {
      section,
      dependencies: section.dependencies || [],
      dependents: [],
    });
  }

  // Validate dependencies and build dependent lists
  for (const section of sections) {
    const deps = section.dependencies || [];

    for (const depId of deps) {
      // Validate dependency exists
      if (!graph.has(depId)) {
        throw new Error(
          `Section "${section.name}" (${section.id}) depends on non-existent section "${depId}"`
        );
      }

      // Add this section as a dependent of the dependency
      const depNode = graph.get(depId)!;
      depNode.dependents.push(section.id);
    }
  }

  logger.info('Advanced Analysis', 'Dependency graph built', {
    totalSections: sections.length,
    sectionsWithDependencies: sections.filter((s) => (s.dependencies?.length || 0) > 0).length,
  });

  return graph;
}

/**
 * Topologically sort sections based on dependencies
 *
 * Uses Kahn's algorithm to sort sections so that dependencies are processed before
 * sections that depend on them. Detects circular dependencies.
 *
 * @param graph - Dependency graph from buildDependencyGraph
 * @returns Sorted array of template sections
 * @throws Error if circular dependencies are detected
 */
export function topologicalSort(
  graph: Map<string, SectionDependencyNode>
): TemplateSection[] {
  const sorted: TemplateSection[] = [];
  const inDegree = new Map<string, number>();
  const queue: string[] = [];

  // Calculate in-degree (number of dependencies) for each node
  for (const [id, node] of Array.from(graph.entries())) {
    inDegree.set(id, node.dependencies.length);

    // Nodes with no dependencies can be processed first
    if (node.dependencies.length === 0) {
      queue.push(id);
    }
  }

  logger.info('Advanced Analysis', 'Topological sort starting', {
    totalNodes: graph.size,
    nodesWithNoDependencies: queue.length,
  });

  // Process nodes in topological order
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentNode = graph.get(currentId)!;
    sorted.push(currentNode.section);

    // Reduce in-degree for all dependents
    for (const dependentId of currentNode.dependents) {
      const currentInDegree = inDegree.get(dependentId)!;
      const newInDegree = currentInDegree - 1;
      inDegree.set(dependentId, newInDegree);

      // If all dependencies have been processed, add to queue
      if (newInDegree === 0) {
        queue.push(dependentId);
      }
    }
  }

  // Check for circular dependencies
  if (sorted.length !== graph.size) {
    const sortedIds = new Set(sorted.map(s => s.id));
    const unprocessed = Array.from(graph.keys()).filter(id => !sortedIds.has(id));

    // Build circular dependency chains for better error message
    const circularChains: string[] = [];
    unprocessed.forEach(id => {
      const node = graph.get(id)!;
      const deps = node.dependencies
        .filter(depId => unprocessed.includes(depId))
        .join(' → ');
      if (deps) {
        circularChains.push(`${id} → ${deps}`);
      }
    });

    logger.error('Advanced Analysis', 'Circular dependency detected', {
      totalSections: graph.size,
      processedSections: sorted.length,
      unprocessedSections: unprocessed,
      circularChains,
    });

    throw new Error(
      `Circular dependency detected. Unable to process sections: ${unprocessed.join(', ')}.\n` +
      `Circular relationships: ${circularChains.join('; ')}`
    );
  }

  logger.info('Advanced Analysis', 'Topological sort complete', {
    sortedOrder: sorted.map((s) => s.name),
  });

  return sorted;
}

/**
 * Generate cascading prompt with context from dependency sections
 *
 * Creates a rich prompt that includes:
 * - Current section requirements
 * - Full results from all dependency sections
 * - Explicit relationship mapping instructions
 * - Context about what has already been extracted
 *
 * @param section - Current section to analyze
 * @param transcript - Full transcript text
 * @param previousResults - Partial results from processed sections
 * @param dependencySectionNames - Names of sections this depends on (for user-friendly display)
 * @returns Comprehensive prompt string with full context
 */
export function generateCascadingPrompt(
  section: TemplateSection,
  transcript: string,
  previousResults: Partial<AnalysisResults>,
  dependencySectionNames: string[]
): string {
  const hasAgenda = previousResults.agendaItems && previousResults.agendaItems.length > 0;
  const hasDecisions = previousResults.decisions && previousResults.decisions.length > 0;
  const hasPreviousSections = previousResults.sections && previousResults.sections.length > 0;

  // Build context from previous sections
  let contextSection = '';
  if (section.dependencies && section.dependencies.length > 0) {
    contextSection = `
## CONTEXT FROM PREVIOUS ANALYSIS

You have access to results from these previously analyzed sections:
${dependencySectionNames.map((name) => `- ${name}`).join('\n')}

This context should inform your analysis of the current section.
`;

    // Include previous section content
    if (hasPreviousSections) {
      contextSection += '\n### Previously Extracted Sections:\n\n';
      for (const prevSection of previousResults.sections!) {
        contextSection += `**${prevSection.name}**:\n${prevSection.content}\n\n`;
      }
    }

    // Include agenda items with IDs
    if (hasAgenda) {
      contextSection += '\n### Agenda Items Already Identified:\n\n';
      for (const item of previousResults.agendaItems!) {
        contextSection += `- [${item.id}] ${item.topic}`;
        if (item.timestamp) {
          contextSection += ` (timestamp: ${item.timestamp}s)`;
        }
        if (item.context) {
          contextSection += `\n  Context: ${item.context}`;
        }
        contextSection += '\n';
      }
      contextSection += '\n';
    }

    // Include decisions with IDs
    if (hasDecisions) {
      contextSection += '\n### Decisions Already Identified:\n\n';
      for (const decision of previousResults.decisions!) {
        contextSection += `- [${decision.id}] ${decision.decision}`;
        if (decision.timestamp) {
          contextSection += ` (timestamp: ${decision.timestamp}s)`;
        }
        if (decision.agendaItemIds && decision.agendaItemIds.length > 0) {
          contextSection += `\n  Related to agenda: ${decision.agendaItemIds.join(', ')}`;
        }
        if (decision.context) {
          contextSection += `\n  Context: ${decision.context}`;
        }
        contextSection += '\n';
      }
      contextSection += '\n';
    }
  }

  // Determine what structured outputs this section should produce
  const sectionNameLower = section.name.toLowerCase();
  const shouldExtractAgenda = sectionNameLower.includes('agenda');
  const shouldExtractDecisions =
    sectionNameLower.includes('decision') || sectionNameLower.includes('conclusion');
  const shouldExtractActions =
    sectionNameLower.includes('action') || sectionNameLower.includes('task');
  const shouldExtractQuotes = sectionNameLower.includes('quote');
  const shouldExtractSummary = sectionNameLower.includes('summary');

  // Build relationship mapping instructions
  let relationshipInstructions = '';
  if (shouldExtractDecisions && hasAgenda) {
    relationshipInstructions = `
## CRITICAL: Relationship Mapping

Since agenda items have already been identified, you MUST link your extracted content to them:

**For Decisions**:
- Assign unique IDs to each decision (e.g., "decision-1", "decision-2", etc.)
- Include an \`agendaItemIds\` array linking each decision to relevant agenda items
- Use the agenda item IDs from the context above (e.g., ["${previousResults.agendaItems![0].id}"])
- Note any decisions made outside the main agenda topics (orphaned decisions)
- Provide context/rationale for each decision

**Requirements**:
- Every decision should ideally link to at least one agenda item
- If a decision doesn't map to any agenda item, still extract it but leave agendaItemIds empty
- Be precise about which agenda topics each decision addresses
`;
  } else if (shouldExtractActions && (hasAgenda || hasDecisions)) {
    relationshipInstructions = `
## CRITICAL: Relationship Mapping

Previous analysis has identified ${hasAgenda ? 'agenda items' : ''}${hasAgenda && hasDecisions ? ' and ' : ''}${hasDecisions ? 'decisions' : ''}.
You MUST link action items to this existing context:

**For Action Items**:
- Assign unique IDs to each action item (e.g., "action-1", "action-2", etc.)
${
  hasAgenda
    ? `- Include an \`agendaItemIds\` array linking to relevant agenda items (e.g., ["${previousResults.agendaItems![0].id}"])`
    : ''
}
${
  hasDecisions
    ? `- Include a \`decisionIds\` array linking to decisions that spawned this action (e.g., ["${previousResults.decisions![0].id}"])`
    : ''
}
- Include owner (if mentioned) and deadline (if mentioned)
- Note any action items that don't map to agenda or decisions (orphaned actions)

**Requirements**:
- Every action should ideally link to decisions and/or agenda items
- If an action doesn't map to any existing context, still extract it but leave relationship arrays empty
- Be precise about which decisions or agenda topics each action addresses
`;
  } else if (shouldExtractAgenda) {
    relationshipInstructions = `
## CRITICAL: ID Assignment

You are extracting agenda items. These will be used by subsequent analysis passes to link decisions and actions.

**For Agenda Items**:
- Assign unique IDs to each agenda item (e.g., "agenda-1", "agenda-2", "agenda-3", etc.)
- Use clear, sequential numbering
- Include timestamp if the agenda item is discussed at a specific time
- Provide optional context about each agenda item

These IDs are ESSENTIAL for relationship mapping in later analysis stages.
`;
  }

  // Build output format instructions
  let outputFormatInstructions = '';
  if (shouldExtractAgenda) {
    outputFormatInstructions += `
**Agenda Items**: Extract as structured objects with:
- \`id\`: Unique identifier (e.g., "agenda-1", "agenda-2")
- \`topic\`: Agenda item description
- \`timestamp\`: Optional timestamp in seconds
- \`context\`: Optional additional context
`;
  }

  if (shouldExtractDecisions) {
    outputFormatInstructions += `
**Decisions**: Extract as structured objects with:
- \`id\`: Unique identifier (e.g., "decision-1", "decision-2")
- \`decision\`: Decision text
- \`timestamp\`: Timestamp in seconds when decision was made
- \`context\`: Optional rationale or context
- \`agendaItemIds\`: Array of agenda item IDs this decision relates to (REQUIRED if agenda exists)
`;
  }

  if (shouldExtractActions) {
    outputFormatInstructions += `
**Action Items**: Extract as structured objects with:
- \`id\`: Unique identifier (e.g., "action-1", "action-2")
- \`task\`: Task description
- \`owner\`: Optional person responsible
- \`deadline\`: Optional due date
- \`timestamp\`: Optional timestamp in seconds
- \`agendaItemIds\`: Array of agenda item IDs this relates to (if applicable)
- \`decisionIds\`: Array of decision IDs that spawned this action (if applicable)
`;
  }

  if (shouldExtractQuotes) {
    outputFormatInstructions += `
**Quotes**: Extract 3-5 notable quotes with:
- \`text\`: Exact quote text
- \`speaker\`: Optional speaker name
- \`timestamp\`: Timestamp in seconds
`;
  }

  if (shouldExtractSummary) {
    outputFormatInstructions += `
**Summary**: Provide a concise 3-5 sentence overview capturing:
- Main topics discussed
- Key outcomes
- Overall tone/sentiment
- Next steps
`;
  }

  // Format output type description
  const formatDescription = formatOutputType(section.outputFormat);

  return `You are an expert meeting analyst for Austin Public Health. You are analyzing a specific section of a transcript.

${contextSection}

## Your Task: Extract "${section.name}"

**Instructions**: ${section.prompt}

**Output Format**: ${formatDescription}

**Requirements**:
- Provide clear, concise content
- For bullet_points: MUST use "-" character ONLY (NOT numbered lists 1,2,3), max ${ANALYSIS_CONSTANTS.MAX_BULLET_POINTS} items, capitalize first letter
- For paragraphs: Continuous prose, ${ANALYSIS_CONSTANTS.MAX_PARAGRAPH_WORDS} words max
- Start with action verbs or key concepts
- Be specific and actionable
- Base analysis strictly on the transcript content below
- Use the context from previous sections to inform your analysis
${section.dependencies && section.dependencies.length > 0 ? '- Maintain consistency with previously extracted information' : ''}

${relationshipInstructions}

${outputFormatInstructions}

## Output Format

You MUST respond with valid JSON in this EXACT structure:

\`\`\`json
{
  "content": "Extracted content formatted per requirements above",
  ${shouldExtractAgenda ? '"agendaItems": [ /* array of agenda objects */ ],' : ''}
  ${shouldExtractDecisions ? '"decisions": [ /* array of decision objects */ ],' : ''}
  ${shouldExtractActions ? '"actionItems": [ /* array of action objects */ ],' : ''}
  ${shouldExtractQuotes ? '"quotes": [ /* array of quote objects */ ],' : ''}
  ${shouldExtractSummary ? '"summary": "Overall summary text"' : ''}
}
\`\`\`

## Transcript

${transcript}

## Response

Provide your analysis as valid JSON following the structure above. ${hasAgenda || hasDecisions ? 'Ensure all relationship IDs are correctly assigned and linked to the context provided.' : ''}`;
}


/**
 * Validate section analysis response structure
 */
function isValidSectionAnalysisResponse(data: unknown): data is SectionAnalysisResponse {
  if (!data || typeof data !== 'object') return false;

  const obj = data as Record<string, unknown>;

  // Must have content
  if (typeof obj.content !== 'string') return false;

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
 * Merge multiple section responses into complete analysis results
 *
 * @param sectionResponses - Array of section responses with their names
 * @returns Complete analysis results
 */
function mergeSectionResults(
  sectionResponses: Array<{ name: string; response: SectionAnalysisResponse }>
): AnalysisResults {
  const accumulated: Partial<AnalysisResults> = {
    sections: [],
    agendaItems: [],
    actionItems: [],
    decisions: [],
    quotes: [],
  };

  for (const { name, response } of sectionResponses) {
    mergeSectionIntoResults(accumulated, name, response);
  }

  return {
    summary: accumulated.summary,
    sections: accumulated.sections || [],
    agendaItems: accumulated.agendaItems,
    actionItems: accumulated.actionItems,
    decisions: accumulated.decisions,
    quotes: accumulated.quotes,
  };
}

/**
 * Merge a single section result into accumulating analysis results
 *
 * @param accumulated - Partial results accumulated so far
 * @param sectionName - Name of the section just analyzed
 * @param response - Response from analyzing this section
 * @returns Updated partial results
 */
function mergeSectionIntoResults(
  accumulated: Partial<AnalysisResults>,
  sectionName: string,
  response: SectionAnalysisResponse
): Partial<AnalysisResults> {
  // Initialize sections array if needed
  if (!accumulated.sections) {
    accumulated.sections = [];
  }

  // Add this section's content
  accumulated.sections.push({
    name: sectionName,
    content: response.content,
    evidence: [], // Advanced mode doesn't extract evidence to maintain focus on relationships
  });

  // Merge agenda items
  if (response.agendaItems && response.agendaItems.length > 0) {
    if (!accumulated.agendaItems) {
      accumulated.agendaItems = [];
    }
    accumulated.agendaItems.push(...response.agendaItems);
  }

  // Merge action items
  if (response.actionItems && response.actionItems.length > 0) {
    if (!accumulated.actionItems) {
      accumulated.actionItems = [];
    }
    accumulated.actionItems.push(...response.actionItems);
  }

  // Merge decisions
  if (response.decisions && response.decisions.length > 0) {
    if (!accumulated.decisions) {
      accumulated.decisions = [];
    }
    accumulated.decisions.push(...response.decisions);
  }

  // Merge quotes
  if (response.quotes && response.quotes.length > 0) {
    if (!accumulated.quotes) {
      accumulated.quotes = [];
    }
    accumulated.quotes.push(...response.quotes);
  }

  // Set summary (only one should exist)
  if (response.summary) {
    accumulated.summary = response.summary;
  }

  return accumulated;
}

/**
 * Execute advanced analysis strategy
 *
 * Main entry point for advanced analysis mode. Processes sections one at a time
 * in dependency order, with each section receiving full context from previous results.
 *
 * @param template - Analysis template
 * @param transcript - Full transcript text
 * @param openaiClient - Azure OpenAI client instance
 * @param deployment - GPT deployment name
 * @param progressCallback - Optional callback for progress updates
 * @param config - Optional configuration (evaluation, etc.)
 * @returns Promise<AdvancedAnalysisResult>
 */
export async function executeAdvancedAnalysis(
  template: Template,
  transcript: string,
  openaiClient: OpenAI,
  deployment: string,
  progressCallback?: (current: number, total: number, sectionName: string) => void,
  config?: AdvancedAnalysisConfig
): Promise<AdvancedAnalysisResult> {
  logger.info('Advanced Analysis', 'Starting contextual cascading analysis', {
    deployment,
    templateName: template.name,
    sectionCount: template.sections.length,
    outputs: template.outputs,
  });

  // Step 1: Build dependency graph
  logger.info('Advanced Analysis', 'Building dependency graph');
  const graph = buildDependencyGraph(template.sections);

  // Step 2: Topologically sort sections
  logger.info('Advanced Analysis', 'Performing topological sort');
  const sortedSections = topologicalSort(graph);

  logger.info('Advanced Analysis', 'Processing order established', {
    order: sortedSections.map((s, idx) => ({
      position: idx + 1,
      section: s.name,
      dependencies: s.dependencies || [],
    })),
  });

  // Step 3: Process each section sequentially with context
  const accumulated: Partial<AnalysisResults> = {};
  const sectionResponses: Array<{ name: string; response: SectionAnalysisResponse }> = [];
  const promptsUsed: string[] = [];
  const totalSections = sortedSections.length;

  for (let i = 0; i < sortedSections.length; i++) {
    const section = sortedSections[i];
    const currentStep = i + 1;

    logger.info('Advanced Analysis', `Processing section ${currentStep}/${totalSections}: ${section.name}`, {
      sectionId: section.id,
      dependencies: section.dependencies || [],
      hasPreviousResults: accumulated.sections && accumulated.sections.length > 0,
    });

    // Notify progress
    if (progressCallback) {
      progressCallback(currentStep, totalSections, section.name);
    }

    // Get names of dependency sections for prompt
    const dependencySectionNames =
      section.dependencies?.map((depId) => {
        const depSection = template.sections.find((s) => s.id === depId);
        return depSection?.name || depId;
      }) || [];

    // Generate cascading prompt with full context
    const prompt = generateCascadingPrompt(section, transcript, accumulated, dependencySectionNames);

    // Track prompt for evaluation
    promptsUsed.push(prompt);

    logger.info('Advanced Analysis', `Generated prompt for "${section.name}"`, {
      promptLength: prompt.length,
      hasContext: (section.dependencies?.length || 0) > 0,
      previousSectionCount: accumulated.sections?.length || 0,
      previousAgendaCount: accumulated.agendaItems?.length || 0,
      previousDecisionCount: accumulated.decisions?.length || 0,
    });

    // Validate token limits before API call
    const validation = validateTokenLimits(transcript, prompt, `Advanced Analysis - ${section.name}`);
    if (validation.warnings.length > 0) {
      validation.warnings.forEach(w => logger.warn('Advanced Analysis', w));
    }

    // Make API call for this section with retry logic
    try {
      const response = await retryWithBackoff(
        async () => {
          const res = await openaiClient.chat.completions.create({
            model: deployment,
            messages: [
              {
                role: 'system',
                content:
                  'You are an expert meeting analyst. You provide structured, accurate analysis ' +
                  'of specific transcript sections with precise relationship mapping between agenda items, ' +
                  'decisions, and action items. You always respond with valid JSON and maintain consistency ' +
                  'with previously extracted information.',
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

          logger.info('Advanced Analysis', `Received response for "${section.name}"`, {
            tokensUsed: res.usage?.total_tokens,
            finishReason: finishReason,
            contentLength: content?.length ?? 0,
          });

          // Handle content filter - retry as it's likely a false positive
          if (finishReason === 'content_filter') {
            logger.warn('Advanced Analysis', `Content filter triggered for "${section.name}" - retrying`);
            throw new Error('RETRY'); // Will be caught by retry logic
          }

          // Handle token limit exceeded - fail fast with actionable error
          if (finishReason === 'length') {
            throw new Error(
              `Response truncated due to token limit for section "${section.name}". ` +
              `Consider using Basic or Hybrid strategy for this transcript length.`
            );
          }

          // Handle empty response
          if (!content || content.trim() === '') {
            logger.error('Advanced Analysis', `Empty response for "${section.name}"`, {
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
          `Empty response from OpenAI for section "${section.name}" ` +
          `(finish_reason: ${response.choices[0].finish_reason})`
        );
      }

      // Parse JSON response
      let parsedResponse: unknown;
      try {
        parsedResponse = JSON.parse(content);
      } catch (error) {
        logger.error('Advanced Analysis', `Failed to parse JSON for "${section.name}"`, {
          error,
          contentPreview: content.substring(0, 500),
        });
        throw new Error(`Invalid JSON response for section "${section.name}"`);
      }

      // Validate structure
      if (!isValidSectionAnalysisResponse(parsedResponse)) {
        logger.error('Advanced Analysis', `Invalid response structure for "${section.name}"`);
        throw new Error(`Response does not match expected structure for section "${section.name}"`);
      }

      // Store section response for later merging
      sectionResponses.push({ name: section.name, response: parsedResponse });

      // Merge results into accumulated data for context in next sections
      mergeSectionIntoResults(accumulated, section.name, parsedResponse);

      logger.info('Advanced Analysis', `Section "${section.name}" complete`, {
        contentLength: parsedResponse.content.length,
        newAgendaItems: parsedResponse.agendaItems?.length || 0,
        newDecisions: parsedResponse.decisions?.length || 0,
        newActionItems: parsedResponse.actionItems?.length || 0,
        totalAccumulatedSections: accumulated.sections?.length || 0,
      });
    } catch (error) {
      logger.error('Advanced Analysis', `Error processing section "${section.name}"`, error);
      throw new Error(`Failed to analyze section "${section.name}": ${error}`);
    }
  }

  // Step 4: Merge all section results
  const rawResults = mergeSectionResults(sectionResponses);

  // Post-process: ensure unique IDs and validate relationships
  const draftResults = postProcessResults(rawResults, 'Advanced Analysis');

  logger.info('Advanced Analysis', 'Advanced analysis complete', {
    sectionsProcessed: sortedSections.length,
    sectionCount: draftResults.sections.length,
    agendaItemCount: draftResults.agendaItems?.length || 0,
    actionItemCount: draftResults.actionItems?.length || 0,
    decisionCount: draftResults.decisions?.length || 0,
  });

  // Log relationship mapping statistics
  if (draftResults.agendaItems && draftResults.agendaItems.length > 0) {
    const decisionsWithAgenda = draftResults.decisions?.filter(
      (d) => d.agendaItemIds && d.agendaItemIds.length > 0
    ).length || 0;
    const actionsWithAgenda = draftResults.actionItems?.filter(
      (a) => a.agendaItemIds && a.agendaItemIds.length > 0
    ).length || 0;
    const actionsWithDecisions = draftResults.actionItems?.filter(
      (a) => a.decisionIds && a.decisionIds.length > 0
    ).length || 0;

    logger.info('Advanced Analysis', 'Relationship mapping statistics', {
      totalAgendaItems: draftResults.agendaItems.length,
      totalDecisions: draftResults.decisions?.length || 0,
      totalActionItems: draftResults.actionItems?.length || 0,
      decisionsLinkedToAgenda: decisionsWithAgenda,
      actionsLinkedToAgenda: actionsWithAgenda,
      actionsLinkedToDecisions: actionsWithDecisions,
      decisionsOrphaned: (draftResults.decisions?.length || 0) - decisionsWithAgenda,
      actionsOrphaned:
        (draftResults.actionItems?.length || 0) - Math.max(actionsWithAgenda, actionsWithDecisions),
    });
  }

  // Check if self-evaluation should run
  if (config?.runEvaluation) {
    logger.info('Advanced Analysis', 'Running self-evaluation pass');
    const { evaluation, finalResults } = await executeEvaluationPass(
      template,
      transcript,
      draftResults,
      'advanced',
      openaiClient,
      deployment,
      promptsUsed
    );

    return {
      results: finalResults,
      draftResults,
      evaluation,
      promptsUsed,
    };
  }

  // Return draft results without evaluation
  return {
    results: draftResults,
    promptsUsed,
  };
}
