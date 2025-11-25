"use client";

import Link from "next/link";
import { Upload, Mic, FileText } from "lucide-react";
import { Button, Card, Badge, Tooltip, Text, Title, Group, Stack } from "@mantine/core";
import { motion } from "framer-motion";

interface HeroSectionProps {
  isLoadingConfig: boolean;
  isConfigured: boolean;
  onConfigureClick: () => void;
}

export function HeroSection({ isLoadingConfig, isConfigured, onConfigureClick }: HeroSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Card
        padding="xl"
        radius="lg"
        withBorder={false}
        shadow="md"
        style={{
          background: 'linear-gradient(135deg, #44499C 0%, #22254E 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Animated Background Elements - Removed animation for better readability */}
        <div
          style={{
            position: 'absolute',
            top: '-50%',
            left: '-50%',
            width: '200%',
            height: '200%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%)',
            zIndex: 0,
          }}
        />

        <Stack align="center" gap="lg" style={{ position: 'relative', zIndex: 1 }}>
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Badge
              size="lg"
              variant="light"
              style={{
              background: 'rgba(255, 255, 255, 0.92)',
              color: 'var(--mantine-color-aphBlue-7)',
              border: '1px solid rgba(255, 255, 255, 0.65)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontWeight: 600,
              }}
            >
              AI-Powered Meeting Transcription
            </Badge>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Title
              order={1}
              ta="center"
              style={{
                color: 'white',
                fontSize: 'clamp(2rem, 5vw, 3.5rem)',
                lineHeight: 1.2,
                maxWidth: '900px',
              }}
            >
              Transform Meetings into{" "}
              <span style={{
                color: '#4ADE80', // Lightened green for better contrast against dark blue
                fontWeight: 700,
                textShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}>
                Actionable Insights
              </span>
            </Title>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Text
              size="lg"
              ta="center"
              maw={800}
              style={{ 
                color: 'rgba(255, 255, 255, 0.95)', // Increased opacity
                lineHeight: 1.6,
                textShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}
            >
              Upload your meeting recordings and let AI transcribe, summarize, and extract action items automatically. Powered by Azure OpenAI.
            </Text>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Group gap="md" mt="lg" style={{ width: '100%', justifyContent: 'center' }} wrap="wrap">
              {isLoadingConfig ? (
                <>
                  <Button size="lg" disabled styles={{ root: { minHeight: 48, background: 'white', color: 'var(--mantine-color-aph-blue-5)' } }}>
                    <Upload size={20} style={{ marginRight: 8 }} />
                    Loading...
                  </Button>
                  <Button size="lg" disabled styles={{ root: { minHeight: 48, background: 'white', color: 'var(--mantine-color-aph-blue-5)' } }}>
                    <Mic size={20} style={{ marginRight: 8 }} />
                    Loading...
                  </Button>
                </>
              ) : isConfigured ? (
                <>
                  <Link href="/upload" style={{ textDecoration: 'none' }}>
                    <Button
                      size="lg"
                      leftSection={<Upload size={20} />}
                      styles={{
                        root: {
                          minHeight: 48,
                          background: 'white',
                          color: 'var(--mantine-color-aph-blue-5)',
                          '&:hover': { background: 'rgba(255, 255, 255, 0.9)' },
                        },
                      }}
                    >
                      Upload Meeting
                    </Button>
                  </Link>
                  <Link href="/record" style={{ textDecoration: 'none' }}>
                    <Button
                      size="lg"
                      leftSection={<Mic size={20} />}
                      styles={{
                        root: {
                          minHeight: 48,
                          background: 'white',
                          color: 'var(--mantine-color-aph-blue-5)',
                          '&:hover': { background: 'rgba(255, 255, 255, 0.9)' },
                        },
                      }}
                    >
                      Record Meeting
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Tooltip
                    label={
                      <Stack gap={4}>
                        <Text size="sm" fw={500}>API Configuration Required</Text>
                        <Text size="xs">Click to view setup instructions for configuring your OpenAI API credentials.</Text>
                      </Stack>
                    }
                    multiline
                    maw={300}
                  >
                    <Button
                      size="lg"
                      onClick={onConfigureClick}
                      leftSection={<Upload size={20} />}
                      styles={{
                        root: {
                          minHeight: 48,
                          background: 'white',
                          color: 'var(--mantine-color-aph-blue-5)',
                          '&:hover': { background: 'rgba(255, 255, 255, 0.9)' },
                        },
                      }}
                    >
                      Upload Meeting
                    </Button>
                  </Tooltip>
                  <Tooltip
                    label={
                      <Stack gap={4}>
                        <Text size="sm" fw={500}>API Configuration Required</Text>
                        <Text size="xs">Click to view setup instructions for configuring your OpenAI API credentials.</Text>
                      </Stack>
                    }
                    multiline
                    maw={300}
                  >
                    <Button
                      size="lg"
                      onClick={onConfigureClick}
                      leftSection={<Mic size={20} />}
                      styles={{
                        root: {
                          minHeight: 48,
                          background: 'white',
                          color: 'var(--mantine-color-aph-blue-5)',
                          '&:hover': { background: 'rgba(255, 255, 255, 0.9)' },
                        },
                      }}
                    >
                      Record Meeting
                    </Button>
                  </Tooltip>
                </>
              )}

              <Link href="/templates" style={{ textDecoration: 'none' }}>
                <Button
                  size="lg"
                  variant="outline"
                  leftSection={<FileText size={20} />}
                  styles={{
                    root: {
                      minHeight: 48,
                      borderWidth: 2,
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                      color: 'white',
                      '&:hover': {
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderColor: 'rgba(255, 255, 255, 0.5)',
                      },
                    },
                  }}
                >
                  Templates
                </Button>
              </Link>
            </Group>
          </motion.div>
        </Stack>
      </Card>
    </motion.div>
  );
}

