/**
 * Transcript Detail Page
 *
 * Displays full transcript with viewer, header, export, and delete functionality.
 * Loads transcript from IndexedDB by ID from route params.
 */

"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Container,
  Text,
  Tabs,
  Group,
  Stack,
  Button,
  Alert,
  Box,
  Paper,
} from "@mantine/core";
import {
  Loader2,
  ArrowLeft,
  AlertCircle,
  PlayCircle,
  FileTextIcon,
  Sparkles,
  MessageCircle,
} from "lucide-react";
import { notifications } from "@mantine/notifications";
import {
  getTranscript,
  deleteTranscript,
  getAnalysisByTranscript,
} from "@/lib/db";
import {
  exportTranscriptAsText,
  exportTranscriptAsSRT,
  exportTranscriptAsVTT,
  downloadTextAsFile,
} from "@/lib/transcript-utils";
import { getAudioFile, revokeAudioUrl } from "@/lib/audio-storage";
import { TranscriptHeader } from "@/components/transcript/transcript-header";
import { TranscriptViewer } from "@/components/transcript/transcript-viewer";
import { AnalysisViewer } from "@/components/analysis/analysis-viewer";
import { ChatInterface } from "@/components/chat/chat-interface";
import type { Transcript, TranscriptSegment } from "@/types/transcript";
import type { Analysis } from "@/types/analysis";
import type { AudioPlayerControls } from "@/types/audio";

// Dynamic import for AudioPlayer (contains heavy WaveSurfer dependency)
const AudioPlayer = dynamic(
  () => import("@/components/audio/audio-player").then((mod) => mod.AudioPlayer),
  {
    ssr: false,
    loading: () => (
      <Box
        h={160}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--mantine-color-gray-1)',
          borderRadius: 'var(--mantine-radius-md)'
        }}
      >
        <Group gap="xs" c="dimmed">
          <Loader2 size={16} className="animate-spin" />
          <Text size="sm">Loading audio player...</Text>
        </Group>
      </Box>
    )
  }
);

const EMPTY_ANALYSES: Analysis[] = [];

/**
 * Format analysis tab label: Analysis + short date
 * Example: "Analysis (Nov 23)" or "Analysis (Dec 1)"
 */
function formatAnalysisTabLabel(analysis: Analysis): string {
  const date = new Date(analysis.createdAt);
  const shortDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });

  return `Analysis (${shortDate})`;
}

/**
 * Transcript detail page component
 *
 * Features:
 * - Load transcript by ID from route params
 * - Display transcript header with metadata
 * - Full transcript viewer with search
 * - Export functionality (TXT, SRT, VTT, JSON)
 * - Delete with confirmation
 * - Loading and error states
 * - Back to list navigation
 */
export default function TranscriptDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number>(-1);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>("transcript");
  const hasSetInitialTab = useRef(false);

  const audioControlsRef = useRef<AudioPlayerControls | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  // Extract transcript ID from route params
  const transcriptId = params.id as string;

  // Load transcript from IndexedDB with live updates
  const transcript = useLiveQuery<Transcript | undefined>(async () => {
    if (!transcriptId) return undefined;
    try {
      return await getTranscript(transcriptId);
    } catch (error) {
      console.error("Error loading transcript:", error);
      return undefined;
    }
  }, [transcriptId]);

  // Load analyses for this transcript with live updates (Reactive)
  const analyses =
    useLiveQuery<Analysis[]>(async () => {
      if (!transcriptId) return [];
      try {
        return await getAnalysisByTranscript(transcriptId);
      } catch (error) {
        console.error("Error loading analyses:", error);
        return [];
      }
    }, [transcriptId]) || EMPTY_ANALYSES;

  // Loading state
  const isLoading = transcript === undefined;

  // Set initial tab based on analyses availability (only once)
  useEffect(() => {
    if (analyses.length > 0 && !hasSetInitialTab.current) {
      // Select most recent analysis (first in array)
      setActiveTab(`analysis-${analyses[0].id}`);
      hasSetInitialTab.current = true;
    }
  }, [analyses]);

  // Handle export functionality
  const handleExport = useCallback(
    (format: "txt" | "srt" | "vtt" | "json") => {
      if (!transcript) return;

      try {
        let content: string;
        let filename: string;
        let mimeType: string;

        switch (format) {
          case "txt": {
            content = exportTranscriptAsText(transcript);
            filename = `${transcript.filename.replace(/\.[^/.]+$/, "")}.txt`;
            mimeType = "text/plain";
            break;
          }

          case "srt": {
            content = exportTranscriptAsSRT(transcript.segments);
            filename = `${transcript.filename.replace(/\.[^/.]+$/, "")}.srt`;
            mimeType = "text/plain";
            break;
          }

          case "vtt": {
            content = exportTranscriptAsVTT(transcript.segments);
            filename = `${transcript.filename.replace(/\.[^/.]+$/, "")}.vtt`;
            mimeType = "text/vtt";
            break;
          }

          case "json": {
            content = JSON.stringify(transcript, null, 2);
            filename = `${transcript.filename.replace(/\.[^/.]+$/, "")}.json`;
            mimeType = "application/json";
            break;
          }

          default:
            throw new Error(`Unsupported export format: ${format}`);
        }

        downloadTextAsFile(content, filename, mimeType);

        notifications.show({
          title: "Export Successful",
          message: `Transcript exported as ${format.toUpperCase()}`,
          color: "green",
        });
      } catch (error) {
        console.error("Export error:", error);
        notifications.show({
          title: "Export Failed",
          message:
            error instanceof Error
              ? error.message
              : "Failed to export transcript",
          color: "red",
        });
      }
    },
    [transcript]
  );

  // Handle delete functionality
  const handleDelete = useCallback(async () => {
    if (!transcript) return;

    setIsDeleting(true);

    try {
      await deleteTranscript(transcript.id);

      notifications.show({
        title: "Transcript Deleted",
        message: "The transcript has been deleted successfully.",
        color: "green",
      });

      // Navigate back to transcripts list
      router.push("/transcripts");
    } catch (error) {
      console.error("Delete error:", error);
      notifications.show({
        title: "Delete Failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to delete transcript",
        color: "red",
      });
      setIsDeleting(false);
    }
  }, [transcript, router]);

  // Handle analyze functionality (navigate to analysis creation)
  const handleAnalyze = useCallback(() => {
    if (!transcript) return;

    // Navigate to analysis page (Phase 3 feature)
    router.push(`/transcripts/${transcript.id}/analyze`);
  }, [transcript, router]);

  // Load audio file from IndexedDB
  // RACE CONDITION FIX: Proper cancellation to prevent stale audio URL updates
  useEffect(() => {
    if (!transcriptId) return;

    let mounted = true;
    let currentAudioUrl: string | null = null;

    const loadAudio = async () => {
      try {
        const result = await getAudioFile(transcriptId);
        // Only update state if component is still mounted and this is the latest request
        if (result && mounted) {
          currentAudioUrl = result.audioUrl;
          setAudioUrl(result.audioUrl);
        } else if (result && !mounted) {
          // Clean up if component unmounted before completion
          revokeAudioUrl(result.audioUrl);
        }
      } catch (error) {
        // Only log error if component is still mounted
        if (mounted) {
          console.error("Failed to load audio:", error);
        }
      }
    };

    loadAudio();

    // Cleanup: revoke ObjectURL when component unmounts or transcriptId changes
    return () => {
      mounted = false;
      if (currentAudioUrl) {
        revokeAudioUrl(currentAudioUrl);
      }
      // Clear audio URL state to prevent displaying stale audio
      setAudioUrl(null);
    };
  }, [transcriptId]);

  // Handle segment change from audio player
  const handleSegmentChange = useCallback(
    (segment: TranscriptSegment | null, index: number) => {
      setActiveSegmentIndex(index);
    },
    []
  );

  // Handle controls ready from audio player
  const handleControlsReady = useCallback((controls: AudioPlayerControls) => {
    audioControlsRef.current = controls;
  }, []);

  // Handle segment click from transcript viewer (to seek audio)
  const handleTranscriptSegmentClick = useCallback(
    (index: number) => {
      if (audioControlsRef.current && transcript?.segments) {
        audioControlsRef.current.jumpToSegment(index);
      }
      // Switch to transcript tab to show the highlighted segment
      setActiveTab("transcript");
    },
    [transcript]
  );

  // Handle scroll for sticky tabs shadow
  useEffect(() => {
    const handleScroll = () => {
      if (tabsRef.current) {
        const rect = tabsRef.current.getBoundingClientRect();
        setIsScrolled(rect.top <= 0);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <Container size="lg" py="xl">
        <Box
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 400,
          }}
        >
          <Stack align="center" gap="md">
            <Loader2
              size={32}
              className="animate-spin"
              style={{ color: "var(--aph-blue)" }}
            />
            <Text size="sm" c="dimmed">
              Loading transcript...
            </Text>
          </Stack>
        </Box>
      </Container>
    );
  }

  // Error state - transcript not found
  if (!transcript) {
    return (
      <Container size="lg" py="xl">
        <Stack gap="xl" style={{ maxWidth: 600, margin: "0 auto" }}>
          {/* Back Button */}
          <Button
            component={Link}
            href="/transcripts"
            variant="subtle"
            leftSection={<ArrowLeft size={16} />}
            styles={{ root: { minHeight: 44, width: "fit-content" } }}
          >
            Back to Transcripts
          </Button>

          {/* Error Alert */}
          <Alert
            variant="light"
            color="red"
            title="Transcript Not Found"
            icon={<AlertCircle size={16} />}
          >
            The transcript you&apos;re looking for doesn&apos;t exist or may
            have been deleted.
          </Alert>

          {/* Actions */}
          <Box style={{ display: "flex", justifyContent: "center" }}>
            <Button
              component={Link}
              href="/transcripts"
              styles={{ root: { minHeight: 44 } }}
            >
              View All Transcripts
            </Button>
          </Box>
        </Stack>
      </Container>
    );
  }

  // Main content
  return (
    <div className="content-max-width">
      <Container size="xl" py="xl">
          <Stack gap="xl">
            {/* Back Button */}
            <Button
              component={Link}
              href="/transcripts"
              variant="subtle"
              leftSection={<ArrowLeft size={16} />}
              styles={{ root: { minHeight: 44, width: "fit-content" } }}
            >
              Back to Transcripts
            </Button>

            {/* Transcript Header Components */}
            <TranscriptHeader
              transcript={transcript}
              onExport={handleExport}
              onDelete={handleDelete}
              onAnalyze={handleAnalyze}
              isDeleting={isDeleting}
              hasExistingAnalyses={analyses.length > 0}
            />

            {/* Audio Player (if audio is available) */}
            {audioUrl && transcript.segments.length > 0 && (
              <Paper
                p="md"
                radius="md"
                bg="gray.0"
                style={{ border: "1px solid var(--mantine-color-gray-3)" }}
              >
                <Stack gap="xs">
                  <Group gap="xs" mb="xs">
                    <PlayCircle
                      size={14}
                      style={{ color: "var(--mantine-color-dimmed)" }}
                    />
                    <Text size="xs" fw={700} c="dimmed" tt="uppercase" lts={0.5}>
                      Audio Playback
                    </Text>
                  </Group>
                  <AudioPlayer
                    audioUrl={audioUrl}
                    segments={transcript.segments}
                    onSegmentChange={handleSegmentChange}
                    onControlsReady={handleControlsReady}
                  />
                </Stack>
              </Paper>
            )}

            {/* Sticky Tabs Section */}
            <div
              ref={tabsRef}
              className={`sticky-tabs ${isScrolled ? "scrolled" : ""}`}
            >
              <Tabs value={activeTab} onChange={setActiveTab} variant="default" keepMounted={false}>
                <Tabs.List
                  mb="md"
                  style={{
                    overflowX: 'auto',
                    flexWrap: 'nowrap',
                    WebkitOverflowScrolling: 'touch'
                  }}
                >
                  {/* Transcript Tab */}
                  <Tabs.Tab
                    value="transcript"
                    leftSection={<FileTextIcon size={14} />}
                  >
                    <Text size="sm" fw={600}>
                      Transcript
                    </Text>
                  </Tabs.Tab>

                  {/* Dynamic Analysis Tabs */}
                  {analyses.map((analysis) => (
                    <Tabs.Tab
                      key={analysis.id}
                      value={`analysis-${analysis.id}`}
                      leftSection={<Sparkles size={14} />}
                    >
                      <Text size="sm" fw={600}>
                        {formatAnalysisTabLabel(analysis)}
                      </Text>
                    </Tabs.Tab>
                  ))}

                  {/* Chat Tab */}
                  <Tabs.Tab
                    value="chat"
                    leftSection={<MessageCircle size={14} />}
                  >
                    <Text size="sm" fw={600}>
                      Chat
                    </Text>
                  </Tabs.Tab>
                </Tabs.List>

                {/* Transcript Panel */}
                <Tabs.Panel value="transcript">
                  <Paper
                    p={0}
                    radius="md"
                    withBorder
                    style={{
                      boxShadow: "var(--mantine-shadow-sm)",
                      overflow: "visible",
                    }}
                  >
                    <TranscriptViewer
                      transcript={transcript}
                      defaultView="segments"
                      activeSegmentIndex={activeSegmentIndex}
                      onSegmentClick={
                        audioUrl ? handleTranscriptSegmentClick : undefined
                      }
                    />
                  </Paper>
                </Tabs.Panel>

                {/* Dynamic Analysis Panels */}
                {analyses.map((analysis) => (
                  <Tabs.Panel
                    key={analysis.id}
                    value={`analysis-${analysis.id}`}
                  >
                    <AnalysisViewer
                      analysis={analysis}
                      onTimestampClick={
                        audioUrl ? handleTranscriptSegmentClick : undefined
                      }
                    />
                  </Tabs.Panel>
                ))}

                {/* Chat Panel */}
                <Tabs.Panel value="chat">
                  <Paper
                    p="lg"
                    radius="md"
                    withBorder
                    style={{
                      boxShadow: "var(--mantine-shadow-sm)",
                    }}
                  >
                    <ChatInterface
                      transcriptId={transcript.id}
                      transcript={transcript}
                    />
                  </Paper>
                </Tabs.Panel>
              </Tabs>
            </div>
          </Stack>
        </Container>
      </div>
  );
}
