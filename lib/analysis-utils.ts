/**
 * Analysis Utilities
 *
 * Provides evidence extraction, TF-IDF scoring, and analysis processing utilities
 * for AI-powered transcript analysis.
 *
 * Features:
 * - TF-IDF (Term Frequency-Inverse Document Frequency) scoring
 * - Keyword-based evidence extraction
 * - Relevance scoring for transcript segments
 * - Prompt generation for GPT-4 analysis
 * - Context building for AI analysis
 * - JSON parsing with fallback for structured AI outputs
 */

import type {
  TranscriptSegment,
  TemplateSection,
  Evidence,
  AnalysisSection,
  ActionItem,
  Decision,
  Quote,
  Analysis,
} from '@/types';
import type { Template } from '@/types/template';

/**
 * Extract keywords from a text string (simple tokenization)
 * Removes common stop words and performs basic normalization
 */
export function extractKeywords(text: string): string[] {
  // Common stop words to filter out
  const stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
    'to', 'was', 'will', 'with', 'we', 'you', 'your', 'this', 'they',
    'but', 'or', 'if', 'not', 'what', 'when', 'where', 'who', 'why',
    'how', 'can', 'could', 'should', 'would', 'do', 'does', 'did',
  ]);

  // Tokenize and normalize
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));

  // Return unique keywords
  return Array.from(new Set(words));
}

/**
 * Calculate term frequency for a document
 */
function calculateTermFrequency(terms: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  const totalTerms = terms.length;

  for (const term of terms) {
    tf.set(term, (tf.get(term) || 0) + 1);
  }

  // Normalize by document length
  tf.forEach((count, term) => {
    tf.set(term, count / totalTerms);
  });

  return tf;
}

/**
 * Calculate inverse document frequency across all segments
 */
function calculateInverseDocumentFrequency(
  segments: TranscriptSegment[]
): Map<string, number> {
  const idf = new Map<string, number>();
  const totalDocuments = segments.length;

  // Count how many documents contain each term
  const documentFrequency = new Map<string, number>();

  segments.forEach((segment) => {
    const terms = new Set(extractKeywords(segment.text));
    terms.forEach((term) => {
      documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
    });
  });

  // Calculate IDF: log(total_docs / docs_containing_term)
  documentFrequency.forEach((docCount, term) => {
    idf.set(term, Math.log(totalDocuments / docCount));
  });

  return idf;
}

/**
 * Calculate TF-IDF score for a segment given query keywords
 */
function calculateTFIDFScore(
  segment: TranscriptSegment,
  queryKeywords: string[],
  idf: Map<string, number>
): number {
  const segmentTerms = extractKeywords(segment.text);
  const tf = calculateTermFrequency(segmentTerms);

  let score = 0;
  for (const keyword of queryKeywords) {
    const tfScore = tf.get(keyword) || 0;
    const idfScore = idf.get(keyword) || 0;
    score += tfScore * idfScore;
  }

  return score;
}

/**
 * Calculate simple keyword match score (fallback method)
 */
function calculateKeywordScore(
  segment: TranscriptSegment,
  keywords: string[]
): number {
  const segmentText = segment.text.toLowerCase();
  let score = 0;

  for (const keyword of keywords) {
    const keywordLower = keyword.toLowerCase();
    // Count occurrences
    const occurrences = (segmentText.match(new RegExp(keywordLower, 'g')) || []).length;
    score += occurrences;
  }

  // Normalize by segment length
  const wordCount = segment.text.split(/\s+/).length;
  return score / Math.max(wordCount, 1);
}

/**
 * Extract top N most relevant segments from transcript based on keywords
 *
 * Uses TF-IDF scoring to find segments most relevant to the given keywords.
 * Falls back to simple keyword matching if TF-IDF produces no results.
 *
 * @param transcript - Full transcript text (not used in current implementation)
 * @param segments - Array of transcript segments with timestamps
 * @param keywords - Keywords or phrases to search for
 * @param topN - Number of top segments to return (default: 5)
 * @param minRelevance - Minimum relevance score (0-1) to include (default: 0.0)
 * @returns Array of Evidence objects with relevance scores
 */
export function extractEvidence(
  transcript: string,
  segments: TranscriptSegment[],
  keywords: string[],
  topN: number = 5,
  minRelevance: number = 0.0
): Evidence[] {
  if (segments.length === 0 || keywords.length === 0) {
    return [];
  }

  // Extract keywords from query
  const queryKeywords = keywords.flatMap((k) => extractKeywords(k));
  if (queryKeywords.length === 0) {
    return [];
  }

  // Calculate IDF for all segments
  const idf = calculateInverseDocumentFrequency(segments);

  // Calculate TF-IDF scores for each segment
  const scoredSegments = segments.map((segment) => {
    const tfidfScore = calculateTFIDFScore(segment, queryKeywords, idf);
    const keywordScore = calculateKeywordScore(segment, keywords);

    // Combine both scores (weighted average)
    const combinedScore = tfidfScore * 0.7 + keywordScore * 0.3;

    return {
      segment,
      score: combinedScore,
    };
  });

  // Sort by score (descending) and take top N
  const topSegments = scoredSegments
    .filter((s) => s.score > 0) // Only include segments with positive scores
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  // Normalize scores to 0-1 range
  const maxScore = topSegments[0]?.score || 1;

  // Convert to Evidence format
  const evidence: Evidence[] = topSegments
    .map(({ segment, score }) => ({
      text: segment.text,
      start: segment.start,
      end: segment.end,
      relevance: Math.min(score / maxScore, 1), // Normalize to 0-1
    }))
    .filter((e) => e.relevance >= minRelevance);

  return evidence;
}

/**
 * Extract keywords from template section prompt
 *
 * Extracts key terms from the section prompt to use for evidence extraction
 */
export function extractPromptKeywords(sectionPrompt: string): string[] {
  // Extract quoted phrases
  const quotedPhrases = sectionPrompt.match(/"([^"]+)"/g);
  const phrases = quotedPhrases ? quotedPhrases.map((p) => p.replace(/"/g, '')) : [];

  // Extract general keywords from the prompt
  const keywords = extractKeywords(sectionPrompt);

  // Combine and deduplicate
  return Array.from(new Set([...phrases, ...keywords]));
}

/**
 * Generate a structured prompt for GPT-4 analysis
 *
 * Builds a prompt that includes the section requirements, evidence,
 * and instructions for generating the analysis with strict formatting enforcement.
 */
export function generateSectionPrompt(
  section: TemplateSection,
  transcript: string,
  evidence: Evidence[]
): string {
  const evidenceText = evidence.length > 0
    ? evidence
        .map((e, i) => {
          const timestamp = formatTimestamp(e.start);
          return `[${i + 1}] [${timestamp}] "${e.text}" (relevance: ${(e.relevance * 100).toFixed(0)}%)`;
        })
        .join('\n')
    : 'No specific evidence found for this section.';

  // Build format-specific instructions with strict constraints
  let formatInstructions = '';

  if (section.outputFormat === 'bullet_points') {
    formatInstructions = `
FORMAT REQUIREMENTS FOR BULLET POINTS:
- Use the "-" character for bullet points
- Maximum 10 bullet points
- Each bullet point must be 15 words or less
- Start each bullet with an action verb or key concept
- No sub-bullets or nested lists
- Use proper capitalization and punctuation
- Group related points together

EXAMPLE OUTPUT:
- Team approved new design system with accessible components
- Budget increased by $50K for Q4 marketing campaign
- Engineering to complete API migration by December 31st
- Marketing launching social media campaign next Monday`;
  } else if (section.outputFormat === 'paragraph') {
    formatInstructions = `
FORMAT REQUIREMENTS FOR PARAGRAPHS:
- Write 1-3 coherent paragraphs maximum
- Each paragraph should be 50-100 words
- Use line breaks between paragraphs
- Focus on narrative flow and connections between ideas
- Avoid walls of text - keep paragraphs scannable
- Use transition words between ideas

EXAMPLE OUTPUT:
The team made significant progress on the product roadmap. Key features were prioritized based on customer feedback and technical feasibility. The engineering team committed to delivering the core functionality by end of quarter.

Budget discussions resulted in approval for additional resources. Marketing will receive increased funding for the product launch campaign. The finance team will track spending against revised projections.`;
  } else if (section.outputFormat === 'table') {
    formatInstructions = `
FORMAT REQUIREMENTS FOR TABLES:
- Use markdown table syntax with pipes (|) and hyphens (-)
- Include header row with clear column names
- Maximum 10 rows (excluding header)
- Keep cell content concise (under 20 words per cell)
- Align columns properly using hyphens

EXAMPLE OUTPUT:
| Topic | Decision | Owner | Deadline |
|-------|----------|-------|----------|
| Budget | Approved $50K increase | Finance | Dec 15 |
| Design | New component library | Engineering | Jan 1 |`;
  }

  return `You are analyzing a meeting transcript to extract specific information.

SECTION: ${section.name}
TASK: ${section.prompt}

OUTPUT FORMAT: ${section.outputFormat}${formatInstructions}

CRITICAL CONSTRAINTS:
1. DO NOT include excessive detail or supporting evidence in your output
2. DO NOT repeat information from the evidence verbatim
3. DO NOT create walls of text - maintain readability
4. FOCUS on key takeaways and actionable information
5. BE CONCISE - quality over quantity

RELEVANT EVIDENCE FROM TRANSCRIPT:
${evidenceText}

FULL TRANSCRIPT (for context only - prioritize evidence above):
${transcript}

Provide your analysis following the EXACT format requirements above. Be accurate, concise, and well-structured.`;
}

/**
 * Format timestamp in MM:SS or HH:MM:SS format
 */
export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Safely parse JSON from AI response
 * Handles code blocks, trailing commas, and other common AI JSON issues
 */
export function safeParseJSON<T>(content: string): T | null {
  try {
    // Remove markdown code blocks if present
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?/, '').replace(/```$/, '');
    }
    jsonStr = jsonStr.trim();

    return JSON.parse(jsonStr) as T;
  } catch (error) {
    console.error('Failed to parse JSON:', error);
    return null;
  }
}

/**
 * Normalize text for comparison (remove punctuation, lower case, extra spaces)
 */
function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Find the best matching timestamp for a quote or text segment
 */
export function findMatchingSegment(
  text: string,
  segments: TranscriptSegment[]
): TranscriptSegment | undefined {
  if (!text || segments.length === 0) return undefined;

  const normalizedSearch = normalizeForMatch(text);
  if (normalizedSearch.length < 5) return undefined;

  // 1. Try exact substring match of normalized text
  let bestMatch: TranscriptSegment | undefined;
  let bestScore = 0;

  for (const segment of segments) {
    const normalizedSeg = normalizeForMatch(segment.text);
    
    // Exact match
    if (normalizedSeg.includes(normalizedSearch)) {
      return segment;
    }

    // Partial match / overlap scoring
    // This is a simple heuristic: check how many words overlap
    const searchWords = normalizedSearch.split(' ');
    let matchCount = 0;
    
    for (const word of searchWords) {
      if (word.length > 3 && normalizedSeg.includes(word)) {
        matchCount++;
      }
    }

    const score = matchCount / searchWords.length;
    if (score > bestScore && score > 0.6) { // 60% word match threshold
      bestScore = score;
      bestMatch = segment;
    }
  }

  return bestMatch;
}

/**
 * Parse GPT-4 response for action items
 * Tries JSON parsing first, then falls back to regex patterns
 */
export function parseActionItems(content: string): ActionItem[] {
  // 1. Try JSON parsing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonData = safeParseJSON<any[]>(content);
  if (jsonData && Array.isArray(jsonData)) {
    return jsonData.map((item, index) => ({
      id: item.id || `action-${index + 1}`,
      task: item.task || item.action || item.description || '',
      owner: item.owner || item.assignee || undefined,
      deadline: item.deadline || item.due_date || item.dueDate || undefined,
      timestamp: item.timestamp || undefined, // AI might infer timestamp
    })).filter(item => item.task.length > 0);
  }

  // 2. Fallback to regex patterns
  const actionItems: ActionItem[] = [];

  // Look for common action item patterns
  const patterns = [
    /(?:^|\n)[-*]\s*(.+?)(?:\s*\[(?:owner|assigned to|responsible):\s*(.+?)\])?(?:\s*\[(?:due|deadline|by):\s*(.+?)\])?(?:\n|$)/gi,
    /(?:^|\n)\d+\.\s*(.+?)(?:\s*\[(?:owner|assigned to|responsible):\s*(.+?)\])?(?:\s*\[(?:due|deadline|by):\s*(.+?)\])?(?:\n|$)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const task = match[1]?.trim();
      const owner = match[2]?.trim();
      const deadline = match[3]?.trim();

      if (task) {
        actionItems.push({
          id: `action-${actionItems.length + 1}`,
          task,
          owner: owner || undefined,
          deadline: deadline || undefined,
        });
      }
    }
  }

  return actionItems;
}

/**
 * Parse GPT-4 response for decisions
 * Tries JSON parsing first, then falls back to regex patterns
 */
export function parseDecisions(content: string, segments: TranscriptSegment[]): Decision[] {
  const decisions: Decision[] = [];

  // 1. Try JSON parsing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonData = safeParseJSON<any[]>(content);
  if (jsonData && Array.isArray(jsonData)) {
    return jsonData.map((item, index) => {
      const decisionText = item.decision || item.text || '';
      const matchingSegment = findMatchingSegment(decisionText, segments);

      return {
        id: item.id || `decision-${index + 1}`,
        decision: decisionText,
        context: item.context || item.rationale || undefined,
        timestamp: matchingSegment?.start || 0,
      };
    }).filter(item => item.decision.length > 0);
  }

  // 2. Fallback to text parsing
  const lines = content.split('\n').map(line => line.trim());

  let currentDecision: Partial<Decision> | null = null;

  for (const line of lines) {
    if (!line) continue;

    // Check if it's a new numbered decision (1., 2., etc.)
    const decisionMatch = line.match(/^(\d+)\.\s*(.+)$/);

    if (decisionMatch) {
      // Save previous decision if exists
      if (currentDecision && currentDecision.decision) {
        decisions.push(currentDecision as Decision);
      }

      // Start new decision
      currentDecision = {
        id: `decision-${decisions.length + 1}`,
        decision: decisionMatch[2].trim(),
        timestamp: 0,
        context: undefined,
      };
    } else if (currentDecision && line.toLowerCase().startsWith('context:')) {
      // Add context to current decision
      currentDecision.context = line.replace(/^context:\s*/i, '').trim();
    } else if (currentDecision && !line.match(/^[-*•]\s/)) {
      // Continuation of context (multi-line) or indented text
      // Skip if it looks like a new bullet point
      if (currentDecision.context) {
        currentDecision.context = `${currentDecision.context} ${line}`;
      } else {
        // This might be context without "Context:" prefix
        currentDecision.context = line;
      }
    } else if (!currentDecision) {
      // Legacy format: bullet or plain text without numbering
      const match = line.match(/^[-*•]\s*(.+)$/);
      const decisionText = match ? match[1].trim() : line;

      if (decisionText.length >= 10) {
        decisions.push({
          id: `decision-${decisions.length + 1}`,
          decision: decisionText,
          timestamp: 0,
          context: undefined,
        });
      }
    }
  }

  // Push final decision if exists
  if (currentDecision && currentDecision.decision) {
    decisions.push(currentDecision as Decision);
  }

  // Match timestamps using fuzzy search
  return decisions.map(decision => {
    const relevantSegment = findMatchingSegment(decision.decision, segments);

    return {
      ...decision,
      timestamp: relevantSegment?.start || 0,
      // Only use segment text as context if we don't already have context
      context: decision.context || (relevantSegment?.text),
    };
  });
}

/**
 * Parse GPT-4 response for notable quotes
 * Tries JSON parsing first, then falls back to regex patterns
 */
export function parseQuotes(content: string, segments: TranscriptSegment[]): Quote[] {
  const quotes: Quote[] = [];

  // 1. Try JSON parsing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonData = safeParseJSON<any[]>(content);
  if (jsonData && Array.isArray(jsonData)) {
    jsonData.forEach(item => {
      const quoteText = typeof item === 'string' ? item : (item.quote || item.text);
      if (!quoteText) return;

      const matchingSegment = findMatchingSegment(quoteText, segments);
      
      if (matchingSegment) {
        quotes.push({
          text: quoteText,
          speaker: matchingSegment.speaker,
          timestamp: matchingSegment.start,
        });
      } else {
        // If no match found, add it anyway with best guess or 0
        quotes.push({
          text: quoteText,
          speaker: item.speaker || undefined,
          timestamp: 0,
        });
      }
    });
    
    if (quotes.length > 0) return quotes;
  }

  // 2. Fallback to regex for quoted text
  const quotePattern = /"([^"]{10,})"/g;
  let match;

  while ((match = quotePattern.exec(content)) !== null) {
    const quoteText = match[1].trim();
    const matchingSegment = findMatchingSegment(quoteText, segments);

    if (matchingSegment) {
      quotes.push({
        text: quoteText,
        speaker: matchingSegment.speaker,
        timestamp: matchingSegment.start,
      });
    }
  }

  return quotes;
}

/**
 * Build context-aware analysis prompt
 *
 * Creates a comprehensive prompt for overall transcript analysis
 */
export function buildAnalysisContext(
  transcript: string,
  segments: TranscriptSegment[],
  templateName: string
): string {
  const duration = segments.length > 0
    ? formatTimestamp(segments[segments.length - 1].end)
    : '0:00';

  const speakers = Array.from(
    new Set(segments.filter((s) => s.speaker).map((s) => s.speaker))
  );

  const speakerInfo = speakers.length > 0
    ? `\nParticipants: ${speakers.join(', ')}`
    : '';

  return `Transcript Duration: ${duration}${speakerInfo}
Segment Count: ${segments.length}
Template: ${templateName}

Transcript:
${transcript}`;
}

/**
 * Validate analysis section output
 */
export function validateAnalysisSection(section: AnalysisSection): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!section.name || section.name.trim().length === 0) {
    errors.push('Section name is required');
  }

  if (!section.content || section.content.trim().length === 0) {
    errors.push('Section content is required');
  }

  if (!Array.isArray(section.evidence)) {
    errors.push('Section evidence must be an array');
  } else {
    section.evidence.forEach((e, i) => {
      if (typeof e.text !== 'string' || e.text.trim().length === 0) {
        errors.push(`Evidence ${i + 1}: text is required`);
      }
      if (typeof e.start !== 'number' || e.start < 0) {
        errors.push(`Evidence ${i + 1}: invalid start timestamp`);
      }
      if (typeof e.end !== 'number' || e.end < e.start) {
        errors.push(`Evidence ${i + 1}: invalid end timestamp`);
      }
      if (typeof e.relevance !== 'number' || e.relevance < 0 || e.relevance > 1) {
        errors.push(`Evidence ${i + 1}: relevance must be between 0 and 1`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Truncate transcript if too long for API limits
 *
 * GPT-4 has token limits, so we need to handle very long transcripts
 */
export function truncateTranscriptForPrompt(
  transcript: string,
  maxTokens: number = 32000 // Approximate limit for GPT-5/GPT-41 outputs
): string {
  const maxChars = maxTokens * 4;

  if (transcript.length <= maxChars) {
    return transcript;
  }

  // Truncate and add notice
  const truncated = transcript.substring(0, maxChars);
  return `${truncated}\n\n[Note: Transcript truncated due to length. ${transcript.length - maxChars} characters omitted.]`;
}

/**
 * Capitalize the first letter of a string
 */
function capitalizeFirstLetter(str: string): string {
  if (!str || str.length === 0) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format section content for consistent display and copy
 *
 * Handles common LLM formatting issues:
 * - Capitalizes bullets and numbered lists
 * - Normalizes whitespace and line breaks
 * - Ensures proper paragraph spacing
 * - Cleans up formatting artifacts
 *
 * @param content - Raw section content from LLM
 * @returns Formatted, clean markdown-style text
 */
export function formatSectionContent(content: string): string {
  if (!content || typeof content !== 'string') {
    return '';
  }

  // 1. Normalize line endings (CRLF → LF)
  let text = content.replace(/\r\n/g, '\n');

  // 2. Remove excessive whitespace
  text = text.replace(/[ \t]+/g, ' '); // Multiple spaces/tabs → single space
  text = text.replace(/\n{4,}/g, '\n\n\n'); // Max 3 consecutive newlines

  // 3. Split into blocks (paragraphs separated by blank lines)
  const blocks = text.split(/\n\s*\n/);
  const formattedBlocks: string[] = [];

  for (let block of blocks) {
    // Trim the block
    block = block.trim();
    if (!block) continue;

    // Split block into lines
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    const formattedLines: string[] = [];

    for (const line of lines) {
      let formattedLine = line;

      // Handle bullet points (-, •, *)
      if (/^[-•*]\s+/.test(line)) {
        const bulletMatch = line.match(/^([-•*])\s+(.+)$/);
        if (bulletMatch) {
          const bullet = bulletMatch[1];
          const text = bulletMatch[2].trim();
          formattedLine = `${bullet} ${capitalizeFirstLetter(text)}`;
        }
      }
      // Handle numbered lists (1., 2., etc.)
      else if (/^\d+\.\s+/.test(line)) {
        const numberedMatch = line.match(/^(\d+\.)\s+(.+)$/);
        if (numberedMatch) {
          const number = numberedMatch[1];
          const text = numberedMatch[2].trim();
          formattedLine = `${number} ${capitalizeFirstLetter(text)}`;
        }
      }
      // Handle checkboxes (- [ ] or - [x])
      else if (/^-\s*\[(x| )\]\s+/.test(line)) {
        const checkboxMatch = line.match(/^(-\s*\[(x| )\])\s+(.+)$/);
        if (checkboxMatch) {
          const checkbox = checkboxMatch[1];
          const text = checkboxMatch[3].trim();
          formattedLine = `${checkbox} ${capitalizeFirstLetter(text)}`;
        }
      }

      formattedLines.push(formattedLine);
    }

    // Join lines in this block
    // If all lines are list items, join with single newline
    // Otherwise, treat as paragraph and join with space
    const allListItems = formattedLines.every(line =>
      /^[-•*]\s+/.test(line) ||
      /^\d+\.\s+/.test(line) ||
      /^-\s*\[(x| )\]\s+/.test(line)
    );

    if (allListItems) {
      // This is a list block - preserve line breaks
      formattedBlocks.push(formattedLines.join('\n'));
    } else {
      // This is a paragraph block
      // Check if it's a single line or multiple related lines
      if (formattedLines.length === 1) {
        formattedBlocks.push(formattedLines[0]);
      } else {
        // Multiple lines might be a paragraph split across lines
        // Join them intelligently
        const paragraph = formattedLines.join(' ');
        formattedBlocks.push(paragraph);
      }
    }
  }

  // 4. Join blocks with double newlines for proper spacing
  const formatted = formattedBlocks.join('\n\n');

  // 5. Final cleanup
  return formatted
    .replace(/\n{3,}/g, '\n\n') // Ensure max 2 consecutive newlines
    .trim();
}

/**
 * Build a concise, email-friendly summary of analysis results.
 *
 * Includes:
 * - Optional header with template name
 * - Formatted creation date
 * - Executive summary (if present)
 * - Each section name and narrative content
 *
 * Excludes supporting artifacts such as evidence, action items,
 * decisions, quotes, and timestamps.
 */
export function buildAnalysisSummaryText(
  analysis: Analysis,
  template?: Template
): string {
  const lines: string[] = [];
  const headerTitle = template?.name ? `${template.name} Analysis` : 'Meeting Analysis';

  lines.push(headerTitle);

  try {
    const createdAt = analysis.createdAt instanceof Date
      ? analysis.createdAt
      : new Date(analysis.createdAt);

    const formattedDate = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(createdAt);

    lines.push(`Date: ${formattedDate}`);
  } catch {
    // If date formatting fails, skip the date line
  }

  lines.push(''); // Blank line after header

  const { results } = analysis;

  if (results.summary) {
    lines.push('Executive Summary');
    lines.push('-'.repeat('Executive Summary'.length));
    lines.push('');
    lines.push(formatSectionContent(results.summary));
    lines.push('');
  }

  if (results.actionItems && results.actionItems.length > 0) {
    lines.push('Action Items');
    lines.push('-'.repeat('Action Items'.length));
    lines.push('');

    results.actionItems.forEach((item) => {
      const details: string[] = [];

      if (item.owner) {
        details.push(`Owner: ${item.owner}`);
      }

      if (item.deadline) {
        details.push(`Due: ${item.deadline}`);
      }

      if (typeof item.timestamp === 'number') {
        details.push(`Mentioned at ${formatTimestamp(item.timestamp)}`);
      }

      const detailText = details.length > 0 ? ` (${details.join(' | ')})` : '';
      lines.push(`- [ ] ${item.task}${detailText}`);
    });

    lines.push('');
  }

  if (results.decisions && results.decisions.length > 0) {
    lines.push('Key Decisions');
    lines.push('-'.repeat('Key Decisions'.length));
    lines.push('');

    results.decisions.forEach((decision, index) => {
      const summaryParts: string[] = [];

      if (decision.context) {
        summaryParts.push(`Context: ${decision.context}`);
      }

      if (typeof decision.timestamp === 'number') {
        summaryParts.push(`Time: ${formatTimestamp(decision.timestamp)}`);
      }

      const suffix = summaryParts.length > 0 ? ` (${summaryParts.join(' | ')})` : '';
      lines.push(`${index + 1}. ${decision.decision}${suffix}`);
    });

    lines.push('');
  }

  // Filter out "Action Items" sections since they're already included via results.actionItems[]
  const filteredSections = results.sections.filter(section => {
    const lowerName = section.name.toLowerCase();
    return lowerName !== 'action items' && lowerName !== 'action items for improvement';
  });

  filteredSections.forEach((section, index) => {
    lines.push(section.name);
    lines.push('-'.repeat(section.name.length));
    lines.push('');
    lines.push(formatSectionContent(section.content));

    if (index < filteredSections.length - 1) {
      lines.push('');
    }
  });

  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
