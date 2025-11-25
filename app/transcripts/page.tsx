"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Trash2, Clock, FileAudio, Loader2, ArrowRight } from "lucide-react";
import {
  Container,
  Title,
  Text,
  TextInput,
  Card,
  Button,
  ActionIcon,
  Group,
  Stack,
  Skeleton,
  Box,
  Modal,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useSearchTranscripts } from "@/hooks/use-transcripts";
import { useDebounce } from "@/hooks/use-debounce";
import { formatDistanceToNow } from "date-fns";
import { deleteTranscript } from "@/lib/db";

/**
 * Transcripts listing page with search and delete functionality
 */
export default function TranscriptsPage() {
  const [searchTerm, setSearchTerm] = React.useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const { transcripts, isLoading } = useSearchTranscripts(debouncedSearchTerm);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    try {
      await deleteTranscript(deleteId);
      notifications.show({
        title: "Transcript Deleted",
        message: "The transcript has been deleted successfully.",
        color: "green",
      });
      setDeleteId(null);
    } catch (error) {
      console.error("Error deleting transcript:", error);
      notifications.show({
        title: "Error",
        message: "Failed to delete transcript. Please try again.",
        color: "red",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header Section */}
        <Stack gap="xs">
          <Title order={1} size="h1">
            All Transcripts
          </Title>
          <Text size="sm" c="dimmed">
            View and manage all your meeting transcriptions
          </Text>
        </Stack>

        {/* Search Bar */}
        <Group align="center" gap="md" wrap="nowrap" style={{ flexDirection: 'row' }}>
          <TextInput
            placeholder="Search transcripts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftSection={<Search size={16} />}
            style={{ flex: 1, maxWidth: 512 }}
            styles={{
              input: { minHeight: 44 },
            }}
          />
          {transcripts.length > 0 && (
            <Text size="sm" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
              {transcripts.length} transcript{transcripts.length !== 1 ? "s" : ""} found
            </Text>
          )}
        </Group>

        {/* Transcripts List */}
        {isLoading ? (
          <Box
            style={{
              display: 'grid',
              gap: 16,
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            }}
          >
            {[...Array(6)].map((_, i) => (
              <Card key={i} padding="lg" radius="md" withBorder>
                <Stack gap="md">
                  <Skeleton height={24} width="75%" />
                  <Skeleton height={16} width="50%" />
                  <Skeleton height={16} width="100%" />
                  <Skeleton height={16} width="85%" />
                </Stack>
              </Card>
            ))}
          </Box>
        ) : transcripts.length > 0 ? (
          <Box
            style={{
              display: 'grid',
              gap: 16,
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            }}
          >
            {transcripts.map((transcript) => (
              <Card
                key={transcript.id}
                padding="lg"
                radius="md"
                withBorder
                component={Link}
                href={`/transcripts/${transcript.id}`}
                style={{
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background-color 150ms ease',
                }}
                className="transcript-card-hover"
              >
                <Stack gap="sm">
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Title
                      order={3}
                      size="h4"
                      lineClamp={1}
                      style={{ flex: 1, paddingRight: 8 }}
                    >
                      {transcript.filename}
                    </Title>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="lg"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeleteId(transcript.id);
                      }}
                      aria-label="Delete transcript"
                      style={{ minWidth: 44, minHeight: 44 }}
                      className="delete-button-hover"
                    >
                      <Trash2 size={16} />
                    </ActionIcon>
                  </Group>

                  <Text size="sm" c="dimmed">
                    {formatDistanceToNow(new Date(transcript.createdAt), {
                      addSuffix: true,
                    })}
                  </Text>

                  <Text size="sm" c="dimmed" lineClamp={3}>
                    {transcript.text}
                  </Text>

                  {transcript.metadata?.duration && (
                    <Group gap="xs" mt="xs">
                      <Clock size={14} />
                      <Text size="xs" c="dimmed">
                        {Math.floor(transcript.metadata.duration / 60)}:
                        {String(Math.floor(transcript.metadata.duration % 60)).padStart(
                          2,
                          "0"
                        )}
                      </Text>
                    </Group>
                  )}
                </Stack>
              </Card>
            ))}
          </Box>
        ) : (
          <Card padding="xl" radius="md" withBorder style={{ borderStyle: 'dashed' }}>
            <Stack align="center" gap="xl" py="xl">
              <Box
                style={{
                  borderRadius: '50%',
                  backgroundColor: 'var(--aph-blue-light)',
                  padding: 24,
                }}
              >
                <FileAudio size={64} color="var(--aph-blue)" />
              </Box>

              <Title order={2} size="h2" ta="center">
                {searchTerm ? "No transcripts found" : "No transcripts yet"}
              </Title>

              <Text c="dimmed" ta="center" size="md" style={{ maxWidth: 450 }}>
                {searchTerm
                  ? "Try adjusting your search terms or clear the search to see all transcripts."
                  : "No transcripts available yet. Transcripts will appear here once recordings are uploaded."}
              </Text>

              <Group gap="md">
                {!searchTerm && (
                  <Button
                    component={Link}
                    href="/templates"
                    size="lg"
                    variant="outline"
                    rightSection={<ArrowRight size={20} />}
                    styles={{ root: { minHeight: 44 } }}
                  >
                    Browse Templates
                  </Button>
                )}
                {searchTerm && (
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => setSearchTerm("")}
                    styles={{ root: { minHeight: 44 } }}
                  >
                    Clear Search
                  </Button>
                )}
              </Group>
            </Stack>
          </Card>
        )}

        {/* Delete Confirmation Dialog */}
        <Modal
          opened={!!deleteId}
          onClose={() => setDeleteId(null)}
          title="Delete Transcript"
          centered
        >
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Are you sure you want to delete this transcript? This action cannot be
              undone. All associated analyses will also be deleted.
            </Text>

            <Group justify="flex-end" gap="sm" mt="md">
              <Button
                variant="outline"
                onClick={() => setDeleteId(null)}
                disabled={isDeleting}
                styles={{ root: { minHeight: 44 } }}
              >
                Cancel
              </Button>
              <Button
                color="red"
                onClick={handleDelete}
                disabled={isDeleting}
                leftSection={isDeleting ? <Loader2 size={16} className="animate-spin" /> : undefined}
                styles={{ root: { minHeight: 44 } }}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </Container>
  );
}
