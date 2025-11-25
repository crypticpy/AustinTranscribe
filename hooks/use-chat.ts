/**
 * Custom hook for managing Q&A chat conversations with transcripts
 *
 * Provides real-time updates when conversations change via IndexedDB.
 * All conversation data is stored CLIENT-SIDE ONLY in browser storage.
 *
 * Privacy Model:
 * - Conversations stored in browser IndexedDB (user's device only)
 * - API endpoint is stateless (stores nothing on server)
 * - Chat history persists across page reloads
 * - User can delete conversations at any time
 *
 * Features:
 * - Live reactive updates via useLiveQuery
 * - Automatic conversation creation on first message
 * - Message persistence in IndexedDB
 * - Error handling and loading states
 * - Clear and delete conversation functions
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  getConversationByTranscript,
  saveConversation,
  updateConversation,
  deleteConversation as dbDeleteConversation,
} from '@/lib/db';
import type { ChatMessage, Conversation, ChatError } from '@/types/chat';

/**
 * Return type for the useChat hook
 */
export interface UseChatReturn {
  /** Array of messages in chronological order */
  messages: ChatMessage[];

  /** Whether a message is currently being sent/received */
  loading: boolean;

  /** Error message if the last operation failed */
  error: string | null;

  /** ID of the conversation (null if no conversation exists yet) */
  conversationId: string | null;

  /** Send a question and receive an answer */
  sendMessage: (question: string) => Promise<void>;

  /** Clear all messages in the conversation (soft reset) */
  clearConversation: () => Promise<void>;

  /** Delete the conversation permanently */
  deleteConversation: () => Promise<void>;

  /** Whether the conversation exists */
  hasConversation: boolean;
}

/**
 * Hook to manage chat conversation for a transcript
 *
 * Handles:
 * - Loading existing conversation from IndexedDB
 * - Sending messages to stateless API endpoint
 * - Saving responses to IndexedDB
 * - Reactive updates when conversation changes
 * - Error handling and loading states
 *
 * @param transcriptId - ID of the transcript to chat about
 * @param transcriptText - Full text of the transcript (sent with each API call)
 * @returns Chat interface with messages, loading state, and actions
 *
 * @example
 * ```tsx
 * function ChatInterface({ transcript }) {
 *   const {
 *     messages,
 *     loading,
 *     error,
 *     sendMessage,
 *     clearConversation,
 *   } = useChat(transcript.id, transcript.text);
 *
 *   return (
 *     <div>
 *       {messages.map(msg => (
 *         <Message key={msg.id} message={msg} />
 *       ))}
 *       {loading && <Spinner />}
 *       {error && <ErrorAlert message={error} />}
 *       <ChatInput onSend={sendMessage} disabled={loading} />
 *       <Button onClick={clearConversation}>Clear History</Button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useChat(
  transcriptId: string,
  transcriptText: string
): UseChatReturn {
  // Load conversation from IndexedDB with reactive updates
  const conversation = useLiveQuery(
    async () => {
      try {
        return await getConversationByTranscript(transcriptId);
      } catch (error) {
        console.error('[useChat] Error loading conversation:', error);
        return undefined;
      }
    },
    [transcriptId],
    undefined // Default value while loading
  );

  // Local state for loading and errors
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref to track if we're currently processing a message (prevents duplicate sends)
  const processingRef = useRef(false);

  // Clear error when conversation changes (e.g., after successful send)
  useEffect(() => {
    if (conversation && error) {
      setError(null);
    }
  }, [conversation, error]);

  /**
   * Send a message and receive a response
   *
   * Flow:
   * 1. Add user message to local state
   * 2. Call stateless API endpoint
   * 3. Add assistant response to messages
   * 4. Save updated conversation to IndexedDB
   */
  const sendMessage = useCallback(async (question: string) => {
    // Prevent duplicate sends
    if (processingRef.current) {
      console.warn('[useChat] Already processing a message, ignoring duplicate send');
      return;
    }

    // Validate input
    if (!question.trim()) {
      setError('Question cannot be empty');
      return;
    }

    processingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      // Create user message
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: question.trim(),
        timestamp: new Date(),
      };

      console.log('[useChat] Sending message:', {
        transcriptId,
        questionLength: question.length,
        conversationMessageCount: conversation?.messages.length || 0,
      });

      // Call API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcriptId,
          transcriptText,
          question: question.trim(),
          conversationHistory: conversation?.messages || [],
        }),
      });

      // Handle error responses
      if (!response.ok) {
        let errorData: { error: ChatError };
        try {
          errorData = await response.json();
        } catch {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const chatError = errorData.error;
        console.error('[useChat] API error:', chatError);

        // Log detailed validation errors for debugging
        if (chatError.type === 'validation' && chatError.details) {
          console.error('[useChat] Validation error details:', chatError.details);
        }

        // Provide user-friendly error messages
        if (chatError.type === 'token_limit') {
          throw new Error(
            'The conversation is too long. Try clearing the conversation history to continue.'
          );
        } else if (chatError.type === 'validation') {
          throw new Error('Invalid request. Please try again.');
        } else if (chatError.type === 'api_failure') {
          throw new Error(
            chatError.message || 'Failed to get response from AI. Please try again.'
          );
        } else {
          throw new Error(chatError.message || 'An error occurred. Please try again.');
        }
      }

      // Parse success response
      const { data } = await response.json();

      if (!data?.answer) {
        throw new Error('Received invalid response from server');
      }

      // Create assistant message
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.answer,
        timestamp: new Date(),
      };

      // Update messages array
      const updatedMessages = [
        ...(conversation?.messages || []),
        userMessage,
        assistantMessage,
      ];

      console.log('[useChat] Message sent successfully, saving to IndexedDB:', {
        messageCount: updatedMessages.length,
        hasExistingConversation: !!conversation,
      });

      // Save to IndexedDB
      if (conversation) {
        // Update existing conversation
        await updateConversation(conversation.id, updatedMessages);
      } else {
        // Create new conversation
        const newConversation: Conversation = {
          id: crypto.randomUUID(),
          transcriptId,
          messages: updatedMessages,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await saveConversation(newConversation);
      }

      console.log('[useChat] Conversation saved successfully');
    } catch (err) {
      console.error('[useChat] Error sending message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setLoading(false);
      processingRef.current = false;
    }
  }, [transcriptId, transcriptText, conversation]);

  /**
   * Clear all messages from the conversation (soft reset)
   *
   * Keeps the conversation record but empties the messages array.
   * Useful for starting a fresh Q&A session without losing the conversation ID.
   */
  const clearConversation = useCallback(async () => {
    if (!conversation) {
      console.warn('[useChat] No conversation to clear');
      return;
    }

    try {
      console.log('[useChat] Clearing conversation:', conversation.id);
      await updateConversation(conversation.id, []);
      setError(null);
    } catch (err) {
      console.error('[useChat] Error clearing conversation:', err);
      setError(err instanceof Error ? err.message : 'Failed to clear conversation');
    }
  }, [conversation]);

  /**
   * Delete the conversation permanently
   *
   * Removes the conversation from IndexedDB entirely.
   * A new conversation will be created on the next message.
   */
  const deleteConversation = useCallback(async () => {
    if (!conversation) {
      console.warn('[useChat] No conversation to delete');
      return;
    }

    try {
      console.log('[useChat] Deleting conversation:', conversation.id);
      await dbDeleteConversation(conversation.id);
      setError(null);
    } catch (err) {
      console.error('[useChat] Error deleting conversation:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete conversation');
    }
  }, [conversation]);

  return {
    messages: conversation?.messages || [],
    loading,
    error,
    conversationId: conversation?.id || null,
    sendMessage,
    clearConversation,
    deleteConversation,
    hasConversation: !!conversation,
  };
}

/**
 * Hook to get basic conversation info without the full chat interface
 *
 * Useful for displaying conversation metadata in lists or previews.
 *
 * @param transcriptId - ID of the transcript
 * @returns Conversation metadata or undefined
 *
 * @example
 * ```tsx
 * function ConversationPreview({ transcriptId }) {
 *   const conversation = useConversationInfo(transcriptId);
 *
 *   if (!conversation) {
 *     return <p>No conversation yet</p>;
 *   }
 *
 *   return (
 *     <div>
 *       <p>{conversation.messages.length} messages</p>
 *       <p>Last updated: {conversation.updatedAt.toLocaleString()}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useConversationInfo(transcriptId: string) {
  return useLiveQuery(
    async () => {
      try {
        return await getConversationByTranscript(transcriptId);
      } catch (error) {
        console.error('[useConversationInfo] Error loading conversation:', error);
        return undefined;
      }
    },
    [transcriptId],
    undefined
  );
}
