/**
 * Custom hook for fetching and managing transcripts from IndexedDB
 * Provides real-time updates when transcripts change
 */

import { useLiveQuery } from 'dexie-react-hooks';
import {
  getAllTranscripts,
  getTranscriptsPaginated,
  searchTranscriptsPaginated,
  deleteTranscript as dbDeleteTranscript,
  type PaginationOptions,
  type PaginatedResult
} from '@/lib/db';
import type { Transcript } from '@/types/transcript';
import { useCallback } from 'react';

/**
 * Hook to fetch all transcripts with live updates
 * Automatically re-fetches when transcripts are added, updated, or deleted
 *
 * @returns Object containing transcripts array, loading state, error, and delete function
 */
export function useTranscripts() {
  const transcripts = useLiveQuery(
    async () => {
      try {
        return await getAllTranscripts();
      } catch (error) {
        console.error('Error fetching transcripts:', error);
        throw error;
      }
    },
    [], // Dependencies - empty array means run once and listen for changes
    [] // Default value while loading
  );

  const deleteTranscript = useCallback(async (id: string) => {
    try {
      await dbDeleteTranscript(id);
    } catch (error) {
      console.error('Error deleting transcript:', error);
      throw error;
    }
  }, []);

  return {
    transcripts: transcripts || [],
    isLoading: transcripts === undefined,
    deleteTranscript,
  };
}

/**
 * Hook to get recent transcripts (limited number)
 *
 * @param limit - Maximum number of transcripts to return (default: 5)
 * @returns Object containing recent transcripts array and loading state
 */
export function useRecentTranscripts(limit: number = 5) {
  const transcripts = useLiveQuery(
    async () => {
      try {
        const allTranscripts = await getAllTranscripts();
        return allTranscripts.slice(0, limit);
      } catch (error) {
        console.error('Error fetching recent transcripts:', error);
        throw error;
      }
    },
    [limit],
    []
  );

  return {
    transcripts: transcripts || [],
    isLoading: transcripts === undefined,
  };
}

/**
 * Hook to search/filter transcripts
 *
 * @param searchTerm - Search term to filter transcripts
 * @returns Object containing filtered transcripts array and loading state
 */
export function useSearchTranscripts(searchTerm: string) {
  const transcripts = useLiveQuery(
    async () => {
      try {
        const allTranscripts = await getAllTranscripts();

        if (!searchTerm.trim()) {
          return allTranscripts;
        }

        const lowerSearch = searchTerm.toLowerCase();
        return allTranscripts.filter((transcript) => {
          return (
            transcript.filename.toLowerCase().includes(lowerSearch) ||
            transcript.text.toLowerCase().includes(lowerSearch)
          );
        });
      } catch (error) {
        console.error('Error searching transcripts:', error);
        throw error;
      }
    },
    [searchTerm],
    []
  );

  return {
    transcripts: transcripts || [],
    isLoading: transcripts === undefined,
  };
}

/**
 * Hook to fetch transcripts with pagination (optimized for large datasets)
 *
 * @param options - Pagination options (limit, offset, orderBy, orderDirection)
 * @returns Object containing paginated result and loading state
 *
 * @example
 * ```tsx
 * function TranscriptList() {
 *   const { result, isLoading } = useTranscriptsPaginated({ limit: 50, offset: 0 });
 *
 *   if (isLoading) return <Loader />;
 *
 *   return (
 *     <div>
 *       {result.items.map(transcript => (
 *         <TranscriptCard key={transcript.id} transcript={transcript} />
 *       ))}
 *       {result.hasMore && <button>Load More</button>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useTranscriptsPaginated(options: PaginationOptions = {}) {
  const result = useLiveQuery(
    async () => {
      try {
        return await getTranscriptsPaginated(options);
      } catch (error) {
        console.error('Error fetching paginated transcripts:', error);
        throw error;
      }
    },
    [options.limit, options.offset, options.orderBy, options.orderDirection],
    { items: [], total: 0, hasMore: false, offset: 0, limit: 50 } as PaginatedResult<Transcript>
  );

  return {
    result: result || { items: [], total: 0, hasMore: false, offset: 0, limit: 50 },
    isLoading: result === undefined,
  };
}

/**
 * Hook to search transcripts with pagination (optimized for large result sets)
 *
 * @param searchTerm - Search term to filter transcripts
 * @param options - Pagination options (limit, offset)
 * @returns Object containing paginated search results and loading state
 *
 * @example
 * ```tsx
 * function SearchResults({ query }: { query: string }) {
 *   const { result, isLoading } = useSearchTranscriptsPaginated(query, { limit: 50 });
 *
 *   if (isLoading) return <Loader />;
 *
 *   return (
 *     <div>
 *       <p>Found {result.total} results</p>
 *       {result.items.map(transcript => (
 *         <TranscriptCard key={transcript.id} transcript={transcript} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useSearchTranscriptsPaginated(
  searchTerm: string,
  options: PaginationOptions = {}
) {
  const result = useLiveQuery(
    async () => {
      try {
        return await searchTranscriptsPaginated(searchTerm, options);
      } catch (error) {
        console.error('Error searching paginated transcripts:', error);
        throw error;
      }
    },
    [searchTerm, options.limit, options.offset],
    { items: [], total: 0, hasMore: false, offset: 0, limit: 50 } as PaginatedResult<Transcript>
  );

  return {
    result: result || { items: [], total: 0, hasMore: false, offset: 0, limit: 50 },
    isLoading: result === undefined,
  };
}
