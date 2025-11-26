/**
 * IndexedDB Database Wrapper using Dexie.js
 *
 * Provides a type-safe interface for storing and retrieving transcripts,
 * templates, and analyses with proper indexing and error handling.
 */

import Dexie, { Table } from 'dexie';
import type { Transcript } from '../types/transcript';
import type { Template } from '../types/template';
import type { Analysis } from '../types/analysis';
import type { AudioMetadata } from '../types/audio';
import type { Conversation } from '../types/chat';
import type { SavedRecording } from '../types/recording';

/**
 * Custom error class for database operations
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * Storage estimate information
 */
export interface StorageEstimate {
  /** Total bytes used */
  usage: number;
  /** Total bytes available (may be undefined in some browsers) */
  quota?: number;
  /** Percentage used (0-100) */
  percentUsed?: number;
  /** Human-readable usage string */
  usageFormatted: string;
  /** Human-readable quota string */
  quotaFormatted?: string;
}

/**
 * Main Dexie database class for Meeting Transcriber
 *
 * Manages six tables: transcripts, templates, analyses, audioFiles, conversations, and recordings
 * with proper indexing for efficient queries.
 */
export class MeetingTranscriberDB extends Dexie {
  /** Transcripts table with full-text and date indexing */
  transcripts!: Table<Transcript, string>;

  /** Templates table with category and custom flag indexing */
  templates!: Table<Template, string>;

  /** Analyses table with transcript and template relationship indexing */
  analyses!: Table<Analysis, string>;

  /** Audio files table storing binary blobs for playback */
  audioFiles!: Table<AudioFileEntry, string>;

  /** Conversations table storing Q&A chat history for transcripts (client-side only) */
  conversations!: Table<Conversation, string>;

  /** Recordings table storing saved audio recordings with metadata */
  recordings!: Table<SavedRecording, number>;

  constructor() {
    super('MeetingTranscriberDB');

    // Define database schema with version 1
    this.version(1).stores({
      // Transcripts: indexed by id (primary), createdAt, and filename
      transcripts: 'id, filename, createdAt, metadata.duration',

      // Templates: indexed by id (primary), category, isCustom, and createdAt
      templates: 'id, category, isCustom, createdAt, name',

      // Analyses: indexed by id (primary), transcriptId, templateId, and createdAt
      analyses: 'id, transcriptId, templateId, createdAt'
    });

    // Version 2 adds audio file storage while preserving existing indexes
    this.version(2).stores({
      transcripts: 'id, filename, createdAt, metadata.duration',
      templates: 'id, category, isCustom, createdAt, name',
      analyses: 'id, transcriptId, templateId, createdAt',
      audioFiles: 'transcriptId, storedAt',
    });

    // Version 3 adds compound indexes for better query performance with large datasets
    this.version(3).stores({
      // Transcripts: added compound index [filename+createdAt] for efficient filtering
      transcripts: 'id, filename, createdAt, metadata.duration, [filename+createdAt]',

      // Templates: unchanged
      templates: 'id, category, isCustom, createdAt, name',

      // Analyses: added compound index [transcriptId+createdAt] for efficient transcript-based queries
      analyses: 'id, transcriptId, templateId, createdAt, [transcriptId+createdAt]',

      // Audio files: unchanged
      audioFiles: 'transcriptId, storedAt',
    });

    // Version 4 adds transcript fingerprint indexing for duplicate detection
    this.version(4).stores({
      transcripts: 'id, filename, createdAt, metadata.duration, [filename+createdAt], fingerprint.fileHash',
      templates: 'id, category, isCustom, createdAt, name',
      analyses: 'id, transcriptId, templateId, createdAt, [transcriptId+createdAt]',
      audioFiles: 'transcriptId, storedAt',
    });

    // Version 5 adds conversations table for Q&A chat feature (client-side only storage)
    this.version(5).stores({
      transcripts: 'id, filename, createdAt, metadata.duration, [filename+createdAt], fingerprint.fileHash',
      templates: 'id, category, isCustom, createdAt, name',
      analyses: 'id, transcriptId, templateId, createdAt, [transcriptId+createdAt]',
      audioFiles: 'transcriptId, storedAt',
      // Conversations: indexed by id (primary), transcriptId (FK), and compound [transcriptId+updatedAt]
      conversations: 'id, transcriptId, updatedAt, [transcriptId+updatedAt]',
    });

    // Version 6 adds recordings table for storing saved audio recordings
    this.version(6).stores({
      transcripts: 'id, filename, createdAt, metadata.duration, [filename+createdAt], fingerprint.fileHash',
      templates: 'id, category, isCustom, createdAt, name',
      analyses: 'id, transcriptId, templateId, createdAt, [transcriptId+createdAt]',
      audioFiles: 'transcriptId, storedAt',
      conversations: 'id, transcriptId, updatedAt, [transcriptId+updatedAt]',
      // Recordings: indexed by id (auto-increment primary key), status, transcriptId (optional FK), and metadata.createdAt
      recordings: '++id, status, transcriptId, metadata.createdAt',
    });

    // Version 7 adds summary field and fileSize index for sorting
    this.version(7).stores({
      transcripts: 'id, filename, createdAt, metadata.duration, metadata.fileSize, [filename+createdAt], fingerprint.fileHash',
      templates: 'id, category, isCustom, createdAt, name',
      analyses: 'id, transcriptId, templateId, createdAt, [transcriptId+createdAt]',
      audioFiles: 'transcriptId, storedAt',
      conversations: 'id, transcriptId, updatedAt, [transcriptId+updatedAt]',
      recordings: '++id, status, transcriptId, metadata.createdAt',
    });

    // Map tables to classes for better type inference
    this.transcripts = this.table('transcripts');
    this.templates = this.table('templates');
    this.analyses = this.table('analyses');
    this.audioFiles = this.table('audioFiles');
    this.conversations = this.table('conversations');
    this.recordings = this.table('recordings');
  }
}

/**
 * Audio file table entry definition stored alongside transcripts.
 */
export interface AudioFileEntry {
  transcriptId: string;
  audioBlob: Blob;
  metadata: AudioMetadata;
  storedAt: Date;
}

/**
 * Recording status enum
 */
export type RecordingStatus = 'saved' | 'transcribed';

// Re-export SavedRecording from types/recording.ts for consistency
// This ensures a single source of truth for the recording types
export type { SavedRecording, RecordingMetadata, RecordingMode } from '@/types/recording';

export async function findTranscriptByFingerprint(hash: string): Promise<Transcript | undefined> {
  try {
    const db = getDatabase();
    return await db.transcripts.where('fingerprint.fileHash').equals(hash).first();
  } catch (error) {
    console.error('Failed to lookup transcript fingerprint', error);
    return undefined;
  }
}

export async function countTranscriptVersions(hash: string): Promise<number> {
  try {
    const db = getDatabase();
    return await db.transcripts.where('fingerprint.fileHash').equals(hash).count();
  } catch (error) {
    console.error('Failed to count transcript versions', error);
    return 0;
  }
}

// ============================================================================
// PAGINATION TYPES
// ============================================================================

/**
 * Pagination options for querying data
 */
export interface PaginationOptions {
  /** Maximum number of items to return (default: 50) */
  limit?: number;
  /** Number of items to skip (default: 0) */
  offset?: number;
  /** Field to order results by */
  orderBy?: 'createdAt' | 'filename';
  /** Sort direction (default: 'desc') */
  orderDirection?: 'asc' | 'desc';
}

/**
 * Paginated result container
 */
export interface PaginatedResult<T> {
  /** Items in the current page */
  items: T[];
  /** Total number of items matching the query */
  total: number;
  /** Whether there are more items after this page */
  hasMore: boolean;
  /** Current offset */
  offset: number;
  /** Current limit */
  limit: number;
}

// Singleton instance of the database
let dbInstance: MeetingTranscriberDB | null = null;

/**
 * Gets or creates the singleton database instance
 *
 * @returns The MeetingTranscriberDB instance
 * @throws {DatabaseError} If the database cannot be initialized
 */
export function getDatabase(): MeetingTranscriberDB {
  if (!dbInstance) {
    // Check for IndexedDB support
    if (typeof window === 'undefined' || !window.indexedDB) {
      throw new DatabaseError(
        'IndexedDB is not supported in this environment',
        'INDEXEDDB_NOT_SUPPORTED'
      );
    }

    dbInstance = new MeetingTranscriberDB();
  }

  return dbInstance;
}

/**
 * Formats bytes to human-readable string
 *
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// ============================================================================
// TRANSCRIPT OPERATIONS
// ============================================================================

/**
 * Saves a transcript to the database
 *
 * @param transcript - The transcript to save
 * @returns The saved transcript's ID
 * @throws {DatabaseError} If the save operation fails
 */
export async function saveTranscript(transcript: Transcript): Promise<string> {
  try {
    const db = getDatabase();

    // Ensure dates are Date objects
    const transcriptToSave: Transcript = {
      ...transcript,
      createdAt: transcript.createdAt instanceof Date
        ? transcript.createdAt
        : new Date(transcript.createdAt)
    };

    await db.transcripts.put(transcriptToSave);
    return transcript.id;
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      throw new DatabaseError(
        'Storage quota exceeded. Please delete some transcripts to free up space.',
        'QUOTA_EXCEEDED',
        error
      );
    }
    throw new DatabaseError(
      'Failed to save transcript',
      'SAVE_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Retrieves a transcript by ID
 *
 * @param id - The transcript ID
 * @returns The transcript if found, undefined otherwise
 * @throws {DatabaseError} If the retrieval operation fails
 */
export async function getTranscript(id: string): Promise<Transcript | undefined> {
  try {
    const db = getDatabase();
    return await db.transcripts.get(id);
  } catch (error) {
    throw new DatabaseError(
      `Failed to retrieve transcript with ID: ${id}`,
      'GET_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Retrieves all transcripts, sorted by creation date (newest first)
 *
 * @returns Array of all transcripts
 * @throws {DatabaseError} If the retrieval operation fails
 */
export async function getAllTranscripts(): Promise<Transcript[]> {
  try {
    const db = getDatabase();
    return await db.transcripts
      .orderBy('createdAt')
      .reverse()
      .toArray();
  } catch (error) {
    throw new DatabaseError(
      'Failed to retrieve transcripts',
      'GET_ALL_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Retrieves transcripts with pagination for better performance on large datasets
 *
 * Uses compound indexes for efficient sorting and filtering.
 * Recommended for displaying large transcript lists with pagination UI.
 *
 * @param options - Pagination options (limit, offset, orderBy, orderDirection)
 * @returns Paginated result with transcripts and metadata
 * @throws {DatabaseError} If the retrieval operation fails
 *
 * @example
 * ```typescript
 * // Get first page (50 transcripts)
 * const page1 = await getTranscriptsPaginated({ limit: 50, offset: 0 });
 *
 * // Get second page
 * const page2 = await getTranscriptsPaginated({ limit: 50, offset: 50 });
 *
 * // Sort by filename ascending
 * const sorted = await getTranscriptsPaginated({
 *   orderBy: 'filename',
 *   orderDirection: 'asc'
 * });
 * ```
 */
export async function getTranscriptsPaginated(
  options: PaginationOptions = {}
): Promise<PaginatedResult<Transcript>> {
  try {
    const {
      limit = 50,
      offset = 0,
      orderBy = 'createdAt',
      orderDirection = 'desc',
    } = options;

    const db = getDatabase();

    // Get total count for pagination metadata
    const total = await db.transcripts.count();

    // Build query with proper ordering
    let query = db.transcripts.orderBy(orderBy);

    // Reverse for descending order
    if (orderDirection === 'desc') {
      query = query.reverse();
    }

    // Apply pagination
    const items = await query
      .offset(offset)
      .limit(limit)
      .toArray();

    return {
      items,
      total,
      hasMore: offset + items.length < total,
      offset,
      limit,
    };
  } catch (error) {
    throw new DatabaseError(
      'Failed to retrieve paginated transcripts',
      'GET_PAGINATED_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Searches transcripts with pagination for better performance
 *
 * Filters transcripts by filename or text content matching the search term.
 * Uses in-memory filtering (IndexedDB doesn't support LIKE queries).
 *
 * @param searchTerm - Text to search for in filename and content
 * @param options - Pagination options (limit, offset)
 * @returns Paginated result with matching transcripts
 * @throws {DatabaseError} If the search operation fails
 *
 * @example
 * ```typescript
 * // Search for "meeting" in first 50 results
 * const results = await searchTranscriptsPaginated('meeting', { limit: 50 });
 *
 * // Get next page of results
 * const nextPage = await searchTranscriptsPaginated('meeting', {
 *   limit: 50,
 *   offset: 50
 * });
 * ```
 */
export async function searchTranscriptsPaginated(
  searchTerm: string,
  options: PaginationOptions = {}
): Promise<PaginatedResult<Transcript>> {
  try {
    const {
      limit = 50,
      offset = 0,
    } = options;

    const db = getDatabase();
    const lowerSearch = searchTerm.toLowerCase();

    // Get all matching items (IndexedDB doesn't support LIKE queries)
    // Note: For very large datasets, consider using a separate search index
    const allMatches = await db.transcripts
      .filter(t =>
        t.filename.toLowerCase().includes(lowerSearch) ||
        t.text.toLowerCase().includes(lowerSearch)
      )
      .toArray();

    // Sort by createdAt desc
    allMatches.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const total = allMatches.length;
    const items = allMatches.slice(offset, offset + limit);

    return {
      items,
      total,
      hasMore: offset + items.length < total,
      offset,
      limit,
    };
  } catch (error) {
    throw new DatabaseError(
      'Failed to search transcripts',
      'SEARCH_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Deletes a transcript by ID
 *
 * Also deletes all associated analyses and conversations to maintain referential integrity.
 *
 * @param id - The transcript ID to delete
 * @throws {DatabaseError} If the deletion operation fails
 */
export async function deleteTranscript(id: string): Promise<void> {
  try {
    const db = getDatabase();

    // Use a transaction to ensure all deletions succeed or fail together
    await db.transaction('rw', [db.transcripts, db.analyses, db.conversations], async () => {
      // Delete the transcript
      await db.transcripts.delete(id);

      // Delete all associated analyses
      await db.analyses.where('transcriptId').equals(id).delete();

      // Delete all associated conversations
      await db.conversations.where('transcriptId').equals(id).delete();
    });
  } catch (error) {
    throw new DatabaseError(
      `Failed to delete transcript with ID: ${id}`,
      'DELETE_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

// ============================================================================
// TEMPLATE OPERATIONS
// ============================================================================

/**
 * Saves a template to the database
 *
 * @param template - The template to save
 * @returns The saved template's ID
 * @throws {DatabaseError} If the save operation fails
 */
export async function saveTemplate(template: Template): Promise<string> {
  try {
    const db = getDatabase();

    // Ensure dates are Date objects
    const templateToSave: Template = {
      ...template,
      createdAt: template.createdAt instanceof Date
        ? template.createdAt
        : new Date(template.createdAt)
    };

    await db.templates.put(templateToSave);
    return template.id;
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      throw new DatabaseError(
        'Storage quota exceeded. Please delete some templates to free up space.',
        'QUOTA_EXCEEDED',
        error
      );
    }
    throw new DatabaseError(
      'Failed to save template',
      'SAVE_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Retrieves a template by ID
 *
 * @param id - The template ID
 * @returns The template if found, undefined otherwise
 * @throws {DatabaseError} If the retrieval operation fails
 */
export async function getTemplate(id: string): Promise<Template | undefined> {
  try {
    const db = getDatabase();
    return await db.templates.get(id);
  } catch (error) {
    throw new DatabaseError(
      `Failed to retrieve template with ID: ${id}`,
      'GET_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Retrieves all templates
 *
 * @returns Array of all templates
 * @throws {DatabaseError} If the retrieval operation fails
 */
export async function getAllTemplates(): Promise<Template[]> {
  try {
    const db = getDatabase();
    return await db.templates.toArray();
  } catch (error) {
    throw new DatabaseError(
      'Failed to retrieve templates',
      'GET_ALL_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Deletes a custom template by ID
 *
 * Only custom templates (isCustom === true) can be deleted.
 * Also deletes all associated analyses to maintain referential integrity.
 *
 * @param id - The template ID to delete
 * @throws {DatabaseError} If the template is not custom or deletion fails
 */
export async function deleteTemplate(id: string): Promise<void> {
  try {
    const db = getDatabase();

    // Check if template exists and is custom
    const template = await db.templates.get(id);

    if (!template) {
      throw new DatabaseError(
        `Template with ID ${id} not found`,
        'NOT_FOUND'
      );
    }

    if (!template.isCustom) {
      throw new DatabaseError(
        'Cannot delete built-in templates. Only custom templates can be deleted.',
        'NOT_CUSTOM'
      );
    }

    // Use a transaction to ensure both deletions succeed or fail together
    await db.transaction('rw', [db.templates, db.analyses], async () => {
      // Delete the template
      await db.templates.delete(id);

      // Delete all associated analyses
      await db.analyses.where('templateId').equals(id).delete();
    });
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(
      `Failed to delete template with ID: ${id}`,
      'DELETE_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

// ============================================================================
// ANALYSIS OPERATIONS
// ============================================================================

/**
 * Saves an analysis to the database
 *
 * @param analysis - The analysis to save
 * @returns The saved analysis's ID
 * @throws {DatabaseError} If the save operation fails
 */
export async function saveAnalysis(analysis: Analysis): Promise<string> {
  try {
    const db = getDatabase();

    // Ensure dates are Date objects
    const analysisToSave: Analysis = {
      ...analysis,
      createdAt: analysis.createdAt instanceof Date
        ? analysis.createdAt
        : new Date(analysis.createdAt)
    };

    await db.analyses.put(analysisToSave);
    return analysis.id;
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      throw new DatabaseError(
        'Storage quota exceeded. Please delete some analyses to free up space.',
        'QUOTA_EXCEEDED',
        error
      );
    }
    throw new DatabaseError(
      'Failed to save analysis',
      'SAVE_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Retrieves all analyses for a specific transcript
 *
 * @param transcriptId - The transcript ID
 * @returns Array of analyses for the transcript
 * @throws {DatabaseError} If the retrieval operation fails
 */
export async function getAnalysisByTranscript(transcriptId: string): Promise<Analysis[]> {
  try {
    const db = getDatabase();
    return await db.analyses
      .where('transcriptId')
      .equals(transcriptId)
      .toArray();
  } catch (error) {
    throw new DatabaseError(
      `Failed to retrieve analyses for transcript ID: ${transcriptId}`,
      'GET_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Retrieves analyses for a transcript with pagination
 *
 * Uses the compound index [transcriptId+createdAt] for efficient querying.
 * Recommended for transcripts with many analyses.
 *
 * @param transcriptId - The transcript ID
 * @param options - Pagination options (limit, offset, orderDirection)
 * @returns Paginated result with analyses and metadata
 * @throws {DatabaseError} If the retrieval operation fails
 *
 * @example
 * ```typescript
 * // Get first 20 analyses for a transcript
 * const page1 = await getAnalysesPaginated('transcript-123', { limit: 20 });
 *
 * // Get older analyses
 * const page2 = await getAnalysesPaginated('transcript-123', {
 *   limit: 20,
 *   offset: 20
 * });
 *
 * // Get oldest analyses first
 * const oldest = await getAnalysesPaginated('transcript-123', {
 *   orderDirection: 'asc'
 * });
 * ```
 */
export async function getAnalysesPaginated(
  transcriptId: string,
  options: PaginationOptions = {}
): Promise<PaginatedResult<Analysis>> {
  try {
    const {
      limit = 20,
      offset = 0,
      orderDirection = 'desc',
    } = options;

    const db = getDatabase();

    // Use compound index [transcriptId+createdAt] for efficient filtering
    // This avoids scanning all analyses and filtering in memory
    const total = await db.analyses
      .where('[transcriptId+createdAt]')
      .between(
        [transcriptId, Dexie.minKey],
        [transcriptId, Dexie.maxKey]
      )
      .count();

    let query = db.analyses
      .where('[transcriptId+createdAt]')
      .between(
        [transcriptId, Dexie.minKey],
        [transcriptId, Dexie.maxKey]
      );

    // Reverse for descending order (newest first)
    if (orderDirection === 'desc') {
      query = query.reverse();
    }

    const items = await query
      .offset(offset)
      .limit(limit)
      .toArray();

    return {
      items,
      total,
      hasMore: offset + items.length < total,
      offset,
      limit,
    };
  } catch (error) {
    throw new DatabaseError(
      `Failed to retrieve paginated analyses for transcript ID: ${transcriptId}`,
      'GET_PAGINATED_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Deletes an analysis by ID
 *
 * @param id - The analysis ID to delete
 * @throws {DatabaseError} If the deletion operation fails
 */
export async function deleteAnalysis(id: string): Promise<void> {
  try {
    const db = getDatabase();
    await db.analyses.delete(id);
  } catch (error) {
    throw new DatabaseError(
      `Failed to delete analysis with ID: ${id}`,
      'DELETE_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Saves multiple transcripts in a single transaction for better performance
 *
 * More efficient than calling saveTranscript() multiple times.
 * Uses Dexie's bulkPut() which is optimized for batch operations.
 *
 * @param transcripts - Array of transcripts to save
 * @returns Number of transcripts saved
 * @throws {DatabaseError} If the bulk save operation fails
 *
 * @example
 * ```typescript
 * const transcripts = [transcript1, transcript2, transcript3];
 * await saveTranscriptsBulk(transcripts);
 * console.log(`Saved ${transcripts.length} transcripts`);
 * ```
 */
export async function saveTranscriptsBulk(transcripts: Transcript[]): Promise<number> {
  try {
    if (transcripts.length === 0) {
      return 0;
    }

    const db = getDatabase();

    // Ensure dates are Date objects for all transcripts
    const transcriptsToSave = transcripts.map(transcript => ({
      ...transcript,
      createdAt: transcript.createdAt instanceof Date
        ? transcript.createdAt
        : new Date(transcript.createdAt)
    }));

    // bulkPut is much faster than multiple put() calls
    await db.transcripts.bulkPut(transcriptsToSave);

    return transcriptsToSave.length;
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      throw new DatabaseError(
        'Storage quota exceeded. Please delete some transcripts to free up space.',
        'QUOTA_EXCEEDED',
        error
      );
    }
    throw new DatabaseError(
      'Failed to bulk save transcripts',
      'BULK_SAVE_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Deletes old transcripts that are older than the specified number of days
 *
 * Useful for cleanup and storage management.
 * Also deletes all associated analyses to maintain referential integrity.
 *
 * @param daysOld - Delete transcripts older than this many days
 * @returns Number of transcripts deleted
 * @throws {DatabaseError} If the deletion operation fails
 *
 * @example
 * ```typescript
 * // Delete transcripts older than 90 days
 * const deleted = await deleteOldTranscripts(90);
 * console.log(`Deleted ${deleted} old transcripts`);
 * ```
 */
export async function deleteOldTranscripts(daysOld: number): Promise<number> {
  try {
    const db = getDatabase();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Get IDs of transcripts to delete
    const idsToDelete = await db.transcripts
      .where('createdAt')
      .below(cutoffDate)
      .primaryKeys();

    if (idsToDelete.length === 0) {
      return 0;
    }

    // Use transaction to ensure both deletions succeed or fail together
    await db.transaction('rw', [db.transcripts, db.analyses], async () => {
      // Delete transcripts
      await db.transcripts.bulkDelete(idsToDelete);

      // Delete all associated analyses
      for (const transcriptId of idsToDelete) {
        await db.analyses.where('transcriptId').equals(transcriptId).delete();
      }
    });

    return idsToDelete.length;
  } catch (error) {
    throw new DatabaseError(
      `Failed to delete old transcripts (older than ${daysOld} days)`,
      'BULK_DELETE_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Deletes multiple analyses in a single transaction
 *
 * More efficient than calling deleteAnalysis() multiple times.
 *
 * @param analysisIds - Array of analysis IDs to delete
 * @returns Number of analyses deleted
 * @throws {DatabaseError} If the bulk delete operation fails
 *
 * @example
 * ```typescript
 * const idsToDelete = ['analysis-1', 'analysis-2', 'analysis-3'];
 * const deleted = await deleteAnalysesBulk(idsToDelete);
 * console.log(`Deleted ${deleted} analyses`);
 * ```
 */
export async function deleteAnalysesBulk(analysisIds: string[]): Promise<number> {
  try {
    if (analysisIds.length === 0) {
      return 0;
    }

    const db = getDatabase();
    await db.analyses.bulkDelete(analysisIds);

    return analysisIds.length;
  } catch (error) {
    throw new DatabaseError(
      'Failed to bulk delete analyses',
      'BULK_DELETE_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

// ============================================================================
// CONVERSATION OPERATIONS
// ============================================================================

/**
 * Saves a conversation to the database
 *
 * Conversations are linked to transcripts via transcriptId (1:1 relationship).
 * All conversation data is stored client-side only in browser IndexedDB.
 *
 * @param conversation - The conversation to save
 * @returns The saved conversation's ID
 * @throws {DatabaseError} If the save operation fails
 *
 * @example
 * ```typescript
 * const conversation: Conversation = {
 *   id: crypto.randomUUID(),
 *   transcriptId: 'transcript-123',
 *   messages: [
 *     {
 *       id: crypto.randomUUID(),
 *       role: 'user',
 *       content: 'What was discussed?',
 *       timestamp: new Date(),
 *     },
 *     {
 *       id: crypto.randomUUID(),
 *       role: 'assistant',
 *       content: 'The meeting discussed...',
 *       timestamp: new Date(),
 *     },
 *   ],
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 * };
 *
 * await saveConversation(conversation);
 * ```
 */
export async function saveConversation(conversation: Conversation): Promise<string> {
  try {
    const db = getDatabase();

    // Ensure dates are Date objects
    const conversationToSave: Conversation = {
      ...conversation,
      createdAt: conversation.createdAt instanceof Date
        ? conversation.createdAt
        : new Date(conversation.createdAt),
      updatedAt: conversation.updatedAt instanceof Date
        ? conversation.updatedAt
        : new Date(conversation.updatedAt),
      // Ensure all message timestamps are Date objects
      messages: conversation.messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp instanceof Date
          ? msg.timestamp
          : new Date(msg.timestamp),
      })),
    };

    await db.conversations.put(conversationToSave);
    return conversation.id;
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      throw new DatabaseError(
        'Storage quota exceeded. Please delete some conversations to free up space.',
        'QUOTA_EXCEEDED',
        error
      );
    }
    throw new DatabaseError(
      'Failed to save conversation',
      'SAVE_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Retrieves a conversation by transcript ID
 *
 * Since conversations have a 1:1 relationship with transcripts,
 * this returns the single conversation for the given transcript.
 *
 * @param transcriptId - The transcript ID
 * @returns The conversation if found, undefined otherwise
 * @throws {DatabaseError} If the retrieval operation fails
 *
 * @example
 * ```typescript
 * const conversation = await getConversationByTranscript('transcript-123');
 * if (conversation) {
 *   console.log(`Found ${conversation.messages.length} messages`);
 * }
 * ```
 */
export async function getConversationByTranscript(
  transcriptId: string
): Promise<Conversation | undefined> {
  try {
    const db = getDatabase();
    return await db.conversations
      .where('transcriptId')
      .equals(transcriptId)
      .first();
  } catch (error) {
    throw new DatabaseError(
      `Failed to retrieve conversation for transcript ID: ${transcriptId}`,
      'GET_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Updates a conversation's messages
 *
 * This is a convenience wrapper that updates the messages array
 * and the updatedAt timestamp.
 *
 * @param conversationId - The conversation ID to update
 * @param messages - The new messages array
 * @throws {DatabaseError} If the update operation fails
 *
 * @example
 * ```typescript
 * const newMessages = [
 *   ...existingMessages,
 *   {
 *     id: crypto.randomUUID(),
 *     role: 'user',
 *     content: 'New question',
 *     timestamp: new Date(),
 *   },
 * ];
 *
 * await updateConversation(conversationId, newMessages);
 * ```
 */
export async function updateConversation(
  conversationId: string,
  messages: import('../types/chat').ChatMessage[]
): Promise<void> {
  try {
    const db = getDatabase();

    // Ensure all message timestamps are Date objects
    const normalizedMessages = messages.map(msg => ({
      ...msg,
      timestamp: msg.timestamp instanceof Date
        ? msg.timestamp
        : new Date(msg.timestamp),
    }));

    await db.conversations.update(conversationId, {
      messages: normalizedMessages,
      updatedAt: new Date(),
    });
  } catch (error) {
    throw new DatabaseError(
      `Failed to update conversation with ID: ${conversationId}`,
      'UPDATE_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Deletes a conversation by ID
 *
 * @param conversationId - The conversation ID to delete
 * @throws {DatabaseError} If the deletion operation fails
 *
 * @example
 * ```typescript
 * await deleteConversation('conversation-123');
 * ```
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  try {
    const db = getDatabase();
    await db.conversations.delete(conversationId);
  } catch (error) {
    throw new DatabaseError(
      `Failed to delete conversation with ID: ${conversationId}`,
      'DELETE_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Retrieves all conversations, sorted by most recently updated
 *
 * Useful for displaying a list of recent Q&A sessions.
 *
 * @returns Array of all conversations
 * @throws {DatabaseError} If the retrieval operation fails
 *
 * @example
 * ```typescript
 * const conversations = await getAllConversations();
 * console.log(`Found ${conversations.length} conversations`);
 * ```
 */
export async function getAllConversations(): Promise<Conversation[]> {
  try {
    const db = getDatabase();
    return await db.conversations
      .orderBy('updatedAt')
      .reverse()
      .toArray();
  } catch (error) {
    throw new DatabaseError(
      'Failed to retrieve conversations',
      'GET_ALL_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

// ============================================================================
// RECORDING OPERATIONS
// ============================================================================

/**
 * Saves a recording to the database
 *
 * Stores audio blob along with metadata including mode, duration, size, mimeType, and creation date.
 * The id field is auto-generated by IndexedDB using the ++id auto-increment primary key.
 *
 * @param recording - The recording to save (without id field)
 * @returns The auto-generated recording ID
 * @throws {DatabaseError} If the save operation fails
 *
 * @example
 * ```typescript
 * const recording: Omit<SavedRecording, 'id'> = {
 *   blob: audioBlob,
 *   metadata: {
 *     mode: 'microphone',
 *     duration: 120.5,
 *     size: 2048000,
 *     mimeType: 'audio/webm',
 *     createdAt: new Date(),
 *   },
 *   status: 'saved',
 *   name: 'My Meeting Recording',
 * };
 *
 * const id = await saveRecording(recording);
 * console.log(`Saved recording with ID: ${id}`);
 * ```
 */
export async function saveRecording(recording: Omit<SavedRecording, 'id'>): Promise<number> {
  try {
    const db = getDatabase();

    // Ensure metadata.createdAt is a Date object
    const recordingToSave: Omit<SavedRecording, 'id'> = {
      ...recording,
      metadata: {
        ...recording.metadata,
        createdAt: recording.metadata.createdAt instanceof Date
          ? recording.metadata.createdAt
          : new Date(recording.metadata.createdAt)
      }
    };

    // add() returns the auto-generated id for auto-increment keys
    const id = await db.recordings.add(recordingToSave);
    return id;
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      throw new DatabaseError(
        'Storage quota exceeded. Please delete some recordings to free up space.',
        'QUOTA_EXCEEDED',
        error
      );
    }
    throw new DatabaseError(
      'Failed to save recording',
      'SAVE_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Retrieves a recording by ID
 *
 * @param id - The recording ID (auto-generated number)
 * @returns The recording if found, undefined otherwise
 * @throws {DatabaseError} If the retrieval operation fails
 *
 * @example
 * ```typescript
 * const recording = await getRecording(42);
 * if (recording) {
 *   console.log(`Recording: ${recording.name || 'Unnamed'}`);
 *   console.log(`Duration: ${recording.metadata.duration}s`);
 *   console.log(`Status: ${recording.status}`);
 * }
 * ```
 */
export async function getRecording(id: number): Promise<SavedRecording | undefined> {
  try {
    const db = getDatabase();
    return await db.recordings.get(id);
  } catch (error) {
    throw new DatabaseError(
      `Failed to retrieve recording with ID: ${id}`,
      'GET_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Retrieves all recordings, sorted by creation date (newest first)
 *
 * @returns Array of all recordings
 * @throws {DatabaseError} If the retrieval operation fails
 *
 * @example
 * ```typescript
 * const recordings = await getAllRecordings();
 * console.log(`Found ${recordings.length} recordings`);
 *
 * recordings.forEach(rec => {
 *   console.log(`${rec.id}: ${rec.name || 'Unnamed'} - ${rec.status}`);
 * });
 * ```
 */
export async function getAllRecordings(): Promise<SavedRecording[]> {
  try {
    const db = getDatabase();
    return await db.recordings
      .orderBy('metadata.createdAt')
      .reverse()
      .toArray();
  } catch (error) {
    throw new DatabaseError(
      'Failed to retrieve recordings',
      'GET_ALL_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Deletes a recording by ID
 *
 * Permanently removes the recording and its associated audio blob from storage.
 *
 * @param id - The recording ID to delete
 * @throws {DatabaseError} If the deletion operation fails
 *
 * @example
 * ```typescript
 * await deleteRecording(42);
 * console.log('Recording deleted successfully');
 * ```
 */
export async function deleteRecording(id: number): Promise<void> {
  try {
    const db = getDatabase();
    await db.recordings.delete(id);
  } catch (error) {
    throw new DatabaseError(
      `Failed to delete recording with ID: ${id}`,
      'DELETE_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Updates a recording's status and optionally links it to a transcript
 *
 * This is typically called after a recording has been successfully transcribed
 * to update its status from 'saved' to 'transcribed' and link it to the resulting transcript.
 *
 * @param id - The recording ID to update
 * @param status - The new status ('saved' | 'transcribed')
 * @param transcriptId - Optional transcript ID to link to the recording
 * @throws {DatabaseError} If the update operation fails
 *
 * @example
 * ```typescript
 * // Mark recording as transcribed and link to transcript
 * await updateRecordingStatus(42, 'transcribed', 'transcript-uuid-123');
 *
 * // Just update status without linking to transcript
 * await updateRecordingStatus(42, 'saved');
 * ```
 */
export async function updateRecordingStatus(
  id: number,
  status: RecordingStatus,
  transcriptId?: string
): Promise<void> {
  try {
    const db = getDatabase();

    // Build update object conditionally
    const updates: Partial<SavedRecording> = { status };
    if (transcriptId !== undefined) {
      updates.transcriptId = transcriptId;
    }

    await db.recordings.update(id, updates);
  } catch (error) {
    throw new DatabaseError(
      `Failed to update recording status for ID: ${id}`,
      'UPDATE_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

// ============================================================================
// STORAGE MONITORING
// ============================================================================

/**
 * Gets storage quota and usage information
 *
 * Uses the StorageManager API to retrieve storage estimates.
 * Note: Not all browsers provide quota information.
 *
 * @returns Storage estimate information
 * @throws {DatabaseError} If the browser doesn't support storage estimation
 */
export async function getStorageEstimate(): Promise<StorageEstimate> {
  try {
    if (!navigator.storage || !navigator.storage.estimate) {
      throw new DatabaseError(
        'Storage estimation is not supported in this browser',
        'STORAGE_API_NOT_SUPPORTED'
      );
    }

    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota;

    let percentUsed: number | undefined;
    if (quota && quota > 0) {
      percentUsed = (usage / quota) * 100;
    }

    return {
      usage,
      quota,
      percentUsed,
      usageFormatted: formatBytes(usage),
      quotaFormatted: quota ? formatBytes(quota) : undefined
    };
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw new DatabaseError(
      'Failed to get storage estimate',
      'STORAGE_ESTIMATE_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Calculates detailed storage usage by counting records in each table
 *
 * This provides more granular information than getStorageEstimate(),
 * showing how many records are stored in each table.
 *
 * @returns Object with counts for each table
 * @throws {DatabaseError} If the calculation fails
 */
export async function calculateStorageUsage(): Promise<{
  transcriptCount: number;
  templateCount: number;
  analysisCount: number;
  totalRecords: number;
}> {
  try {
    const db = getDatabase();

    const [transcriptCount, templateCount, analysisCount] = await Promise.all([
      db.transcripts.count(),
      db.templates.count(),
      db.analyses.count()
    ]);

    return {
      transcriptCount,
      templateCount,
      analysisCount,
      totalRecords: transcriptCount + templateCount + analysisCount
    };
  } catch (error) {
    throw new DatabaseError(
      'Failed to calculate storage usage',
      'USAGE_CALCULATION_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Closes the database connection
 *
 * Should be called when the application is shutting down.
 * After calling this, getDatabase() will create a new instance.
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Deletes the entire database
 *
 * WARNING: This will permanently delete all data!
 * Use with extreme caution.
 *
 * @throws {DatabaseError} If the deletion fails
 */
export async function deleteDatabase(): Promise<void> {
  try {
    closeDatabase();
    await Dexie.delete('MeetingTranscriberDB');
  } catch (error) {
    throw new DatabaseError(
      'Failed to delete database',
      'DATABASE_DELETE_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

// ============================================================================
// SORTED TRANSCRIPT QUERIES
// ============================================================================

/**
 * Sort options for transcript queries
 */
export type TranscriptSortField = 'createdAt' | 'metadata.duration' | 'filename' | 'metadata.fileSize';

/**
 * Retrieves all transcripts with custom sorting
 *
 * @param sortBy - Field to sort by
 * @param order - Sort direction ('asc' or 'desc')
 * @returns Array of sorted transcripts
 * @throws {DatabaseError} If the retrieval operation fails
 *
 * @example
 * ```typescript
 * // Get transcripts sorted by duration (longest first)
 * const byDuration = await getTranscriptsSorted('metadata.duration', 'desc');
 *
 * // Get transcripts sorted by filename A-Z
 * const byName = await getTranscriptsSorted('filename', 'asc');
 * ```
 */
export async function getTranscriptsSorted(
  sortBy: TranscriptSortField = 'createdAt',
  order: 'asc' | 'desc' = 'desc'
): Promise<Transcript[]> {
  try {
    const db = getDatabase();

    // For nested properties, we need to sort in memory
    if (sortBy === 'metadata.fileSize') {
      const all = await db.transcripts.toArray();
      return all.sort((a, b) => {
        const aVal = a.metadata?.fileSize ?? 0;
        const bVal = b.metadata?.fileSize ?? 0;
        return order === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }

    // For indexed fields, use Dexie's orderBy
    let query = db.transcripts.orderBy(sortBy);
    if (order === 'desc') {
      query = query.reverse();
    }
    return await query.toArray();
  } catch (error) {
    throw new DatabaseError(
      'Failed to retrieve sorted transcripts',
      'GET_SORTED_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Deletes multiple transcripts in a single transaction
 *
 * More efficient than calling deleteTranscript() multiple times.
 * Also deletes all associated analyses and conversations.
 *
 * @param ids - Array of transcript IDs to delete
 * @returns Number of transcripts deleted
 * @throws {DatabaseError} If the bulk delete operation fails
 *
 * @example
 * ```typescript
 * const idsToDelete = ['transcript-1', 'transcript-2', 'transcript-3'];
 * const deleted = await deleteTranscriptsBulk(idsToDelete);
 * console.log(`Deleted ${deleted} transcripts`);
 * ```
 */
export async function deleteTranscriptsBulk(ids: string[]): Promise<number> {
  try {
    if (ids.length === 0) {
      return 0;
    }

    const db = getDatabase();

    // Use a transaction to ensure all deletions succeed or fail together
    await db.transaction('rw', [db.transcripts, db.analyses, db.conversations], async () => {
      // Delete transcripts
      await db.transcripts.bulkDelete(ids);

      // Delete all associated analyses and conversations
      for (const id of ids) {
        await db.analyses.where('transcriptId').equals(id).delete();
        await db.conversations.where('transcriptId').equals(id).delete();
      }
    });

    return ids.length;
  } catch (error) {
    throw new DatabaseError(
      'Failed to bulk delete transcripts',
      'BULK_DELETE_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Updates a transcript's summary field
 *
 * @param id - The transcript ID to update
 * @param summary - The new summary text
 * @throws {DatabaseError} If the update operation fails
 */
export async function updateTranscriptSummary(id: string, summary: string): Promise<void> {
  try {
    const db = getDatabase();
    await db.transcripts.update(id, { summary });
  } catch (error) {
    throw new DatabaseError(
      `Failed to update transcript summary for ID: ${id}`,
      'UPDATE_FAILED',
      error instanceof Error ? error : undefined
    );
  }
}

// Export the database instance getter as default
export default getDatabase;
