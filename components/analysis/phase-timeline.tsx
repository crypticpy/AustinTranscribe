/**
 * Phase Timeline Component
 *
 * Displays a visual timeline of analysis phases showing:
 * - Completed phases (checkmark)
 * - Current phase (animated indicator)
 * - Upcoming phases (empty state)
 *
 * Shows users exactly where they are in the analysis process
 * with strategy-specific phase names and progress ranges.
 */

'use client';

import React from 'react';
import { Stack, Group, Text, Box, ThemeIcon, Progress } from '@mantine/core';
import { CheckCircle, Circle, Loader2 } from 'lucide-react';
import type { ProgressPhase } from '@/lib/analysis-progress-metadata';

interface PhaseTimelineProps {
  /** All phases for the current strategy */
  phases: ProgressPhase[];
  /** Current progress percentage (0-100) */
  currentProgress: number;
  /** Compact mode for smaller displays */
  compact?: boolean;
}

/**
 * Get phase status based on current progress
 */
function getPhaseStatus(
  phase: ProgressPhase,
  currentProgress: number
): 'completed' | 'current' | 'pending' {
  const [start, end] = phase.range;

  if (currentProgress > end) {
    return 'completed';
  } else if (currentProgress >= start && currentProgress <= end) {
    return 'current';
  } else {
    return 'pending';
  }
}

/**
 * Calculate progress within a phase (0-100)
 */
function getProgressWithinPhase(phase: ProgressPhase, currentProgress: number): number {
  const [start, end] = phase.range;
  const phaseSpan = end - start;

  if (currentProgress < start) return 0;
  if (currentProgress > end) return 100;

  const progressInPhase = currentProgress - start;
  return Math.round((progressInPhase / phaseSpan) * 100);
}

/**
 * Phase Timeline Component
 */
export function PhaseTimeline({
  phases,
  currentProgress,
  compact = false,
}: PhaseTimelineProps) {
  return (
    <Stack gap={compact ? "xs" : "sm"}>
      {/* Header */}
      {!compact && (
        <Group justify="space-between" align="center">
          <Text size="sm" fw={600} c="dimmed">
            Analysis Phases
          </Text>
          <Text size="xs" c="dimmed">
            {phases.filter(p => getPhaseStatus(p, currentProgress) === 'completed').length} of{' '}
            {phases.length} complete
          </Text>
        </Group>
      )}

      {/* Phase List */}
      <Stack gap={compact ? 4 : "xs"}>
        {phases.map((phase, index) => {
          const status = getPhaseStatus(phase, currentProgress);
          const phaseProgress = getProgressWithinPhase(phase, currentProgress);
          const [start, end] = phase.range;

          return (
            <Box key={phase.id}>
              <Group gap="sm" align="flex-start" wrap="nowrap">
                {/* Status Icon */}
                <ThemeIcon
                  size={compact ? 20 : 24}
                  radius="xl"
                  variant={status === 'completed' ? 'filled' : 'light'}
                  color={
                    status === 'completed'
                      ? 'green'
                      : status === 'current'
                      ? 'blue'
                      : 'gray'
                  }
                  style={{
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  {status === 'completed' ? (
                    <CheckCircle size={compact ? 12 : 14} />
                  ) : status === 'current' ? (
                    <Loader2 size={compact ? 12 : 14} className="animate-spin" />
                  ) : (
                    <Circle size={compact ? 12 : 14} />
                  )}
                </ThemeIcon>

                {/* Phase Info */}
                <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                  <Group justify="space-between" align="center" wrap="nowrap">
                    <Text
                      size={compact ? "xs" : "sm"}
                      fw={status === 'current' ? 600 : 500}
                      c={
                        status === 'completed'
                          ? 'dimmed'
                          : status === 'current'
                          ? undefined
                          : 'dimmed'
                      }
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {phase.name}
                    </Text>
                    <Text
                      size="xs"
                      c="dimmed"
                      style={{ flexShrink: 0 }}
                    >
                      {start}-{end}%
                    </Text>
                  </Group>

                  {/* Progress bar for current phase */}
                  {status === 'current' && !compact && (
                    <Progress
                      value={phaseProgress}
                      size="xs"
                      color="blue"
                      animated
                      style={{ marginTop: 4 }}
                    />
                  )}

                  {/* Phase description (only for current phase in non-compact mode) */}
                  {status === 'current' && phase.description && !compact && (
                    <Text size="xs" c="dimmed" style={{ marginTop: 2 }}>
                      {phase.description}
                    </Text>
                  )}
                </Stack>
              </Group>

              {/* Connector line (not for last phase) */}
              {index < phases.length - 1 && (
                <Box
                  style={{
                    width: 2,
                    height: compact ? 12 : 16,
                    backgroundColor:
                      status === 'completed'
                        ? 'var(--mantine-color-green-6)'
                        : 'var(--mantine-color-gray-3)',
                    marginLeft: compact ? 9 : 11,
                    marginTop: 4,
                    marginBottom: 4,
                  }}
                />
              )}
            </Box>
          );
        })}
      </Stack>
    </Stack>
  );
}
