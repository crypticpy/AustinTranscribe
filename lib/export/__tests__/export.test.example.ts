/**
 * Example Tests for Export Functionality
 *
 * This file demonstrates how to test the export module.
 * To use these tests, install a testing framework like Jest or Vitest.
 */

import {
  formatTimestamp,
  formatDuration,
  formatTXT,
  formatJSON,
  formatSRT,
  formatVTT,
  validateTranscriptForExport,
} from '../formatters';
import type { Transcript, TranscriptSegment } from '@/types';

// Mock transcript data for testing
const createMockTranscript = (): Transcript => ({
  id: 'test-123',
  filename: 'test-meeting.mp3',
  text: 'Hello world. This is a test transcript.',
  segments: [
    {
      index: 0,
      start: 0,
      end: 2.5,
      text: 'Hello world.',
    },
    {
      index: 1,
      start: 2.5,
      end: 5.0,
      text: 'This is a test transcript.',
    },
  ],
  createdAt: new Date('2024-11-17T14:30:00.000Z'),
  metadata: {
    model: 'whisper-1',
    language: 'en',
    fileSize: 1024000,
    duration: 5.0,
  },
});

// Example Test Suite: Timestamp Formatting
describe('formatTimestamp', () => {
  test('should format SRT timestamp correctly', () => {
    expect(formatTimestamp(75.5, 'srt')).toBe('00:01:15,500');
    expect(formatTimestamp(0, 'srt')).toBe('00:00:00,000');
    expect(formatTimestamp(3665.123, 'srt')).toBe('01:01:05,123');
  });

  test('should format VTT timestamp correctly', () => {
    expect(formatTimestamp(75.5, 'vtt')).toBe('00:01:15.500');
    expect(formatTimestamp(0, 'vtt')).toBe('00:00:00.000');
    expect(formatTimestamp(3665.123, 'vtt')).toBe('01:01:05.123');
  });

  test('should format TXT timestamp correctly', () => {
    expect(formatTimestamp(75.5, 'txt')).toBe('[00:01:15]');
    expect(formatTimestamp(0, 'txt')).toBe('[00:00:00]');
    expect(formatTimestamp(3665, 'txt')).toBe('[01:01:05]');
  });

  test('should handle negative values gracefully', () => {
    expect(formatTimestamp(-10, 'srt')).toBe('00:00:00,000');
    expect(formatTimestamp(-10, 'vtt')).toBe('00:00:00.000');
    expect(formatTimestamp(-10, 'txt')).toBe('[00:00:00]');
  });
});

// Example Test Suite: Duration Formatting
describe('formatDuration', () => {
  test('should format duration with hours', () => {
    expect(formatDuration(3665)).toBe('1:01:05');
  });

  test('should format duration without hours', () => {
    expect(formatDuration(125)).toBe('2:05');
  });

  test('should format zero duration', () => {
    expect(formatDuration(0)).toBe('0:00');
  });
});

// Example Test Suite: TXT Format
describe('formatTXT', () => {
  test('should format complete transcript with segments', () => {
    const transcript = createMockTranscript();
    const result = formatTXT(transcript);

    expect(result).toContain('Meeting Transcription');
    expect(result).toContain('test-meeting.mp3');
    expect(result).toContain('[00:00:00] Hello world.');
    expect(result).toContain('[00:00:02] This is a test transcript.');
  });

  test('should include metadata in header', () => {
    const transcript = createMockTranscript();
    const result = formatTXT(transcript);

    expect(result).toContain('Duration:');
    expect(result).toContain('Language: en');
  });

  test('should handle transcript without segments', () => {
    const transcript = {
      ...createMockTranscript(),
      segments: [],
    };
    const result = formatTXT(transcript);

    expect(result).toContain('Hello world. This is a test transcript.');
  });
});

// Example Test Suite: JSON Format
describe('formatJSON', () => {
  test('should produce valid JSON', () => {
    const transcript = createMockTranscript();
    const result = formatJSON(transcript);

    expect(() => JSON.parse(result)).not.toThrow();
  });

  test('should include all required fields', () => {
    const transcript = createMockTranscript();
    const result = formatJSON(transcript);
    const parsed = JSON.parse(result);

    expect(parsed).toHaveProperty('id');
    expect(parsed).toHaveProperty('filename');
    expect(parsed).toHaveProperty('text');
    expect(parsed).toHaveProperty('segments');
    expect(parsed).toHaveProperty('metadata');
    expect(parsed).toHaveProperty('createdAt');
  });

  test('should serialize Date to ISO string', () => {
    const transcript = createMockTranscript();
    const result = formatJSON(transcript);
    const parsed = JSON.parse(result);

    expect(parsed.createdAt).toBe('2024-11-17T14:30:00.000Z');
  });
});

// Example Test Suite: SRT Format
describe('formatSRT', () => {
  test('should format SRT with sequence numbers', () => {
    const transcript = createMockTranscript();
    const result = formatSRT(transcript);

    expect(result).toContain('1\n');
    expect(result).toContain('2\n');
  });

  test('should format timestamps with arrow separator', () => {
    const transcript = createMockTranscript();
    const result = formatSRT(transcript);

    expect(result).toContain('00:00:00,000 --> 00:00:02,500');
    expect(result).toContain('00:00:02,500 --> 00:00:05,000');
  });

  test('should separate entries with blank lines', () => {
    const transcript = createMockTranscript();
    const result = formatSRT(transcript);
    const entries = result.split('\n\n');

    expect(entries.length).toBeGreaterThan(1);
  });

  test('should handle empty segments', () => {
    const transcript = {
      ...createMockTranscript(),
      segments: [],
    };
    const result = formatSRT(transcript);

    expect(result).toContain('1\n');
    expect(result).toContain('00:00:00,000 --> 00:00:00,000');
  });
});

// Example Test Suite: VTT Format
describe('formatVTT', () => {
  test('should start with WEBVTT header', () => {
    const transcript = createMockTranscript();
    const result = formatVTT(transcript);

    expect(result).toMatch(/^WEBVTT\n/);
  });

  test('should format timestamps with period separator', () => {
    const transcript = createMockTranscript();
    const result = formatVTT(transcript);

    expect(result).toContain('00:00:00.000 --> 00:00:02.500');
    expect(result).toContain('00:00:02.500 --> 00:00:05.000');
  });

  test('should handle speaker tags', () => {
    const transcript: Transcript = {
      ...createMockTranscript(),
      segments: [
        {
          index: 0,
          start: 0,
          end: 2.5,
          text: 'Hello everyone.',
          speaker: 'John',
        },
      ],
    };
    const result = formatVTT(transcript);

    expect(result).toContain('<v John>Hello everyone.</v>');
  });
});

// Example Test Suite: Validation
describe('validateTranscriptForExport', () => {
  test('should validate correct transcript', () => {
    const transcript = createMockTranscript();
    const result = validateTranscriptForExport(transcript);

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('should reject transcript without ID', () => {
    const transcript = { ...createMockTranscript(), id: '' };
    const result = validateTranscriptForExport(transcript);

    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('should reject transcript without text or segments', () => {
    const transcript = {
      ...createMockTranscript(),
      text: '',
      segments: [],
    };
    const result = validateTranscriptForExport(transcript);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('text or segments');
  });

  test('should reject transcript without metadata', () => {
    const transcript = {
      ...createMockTranscript(),
      metadata: null,
    };
    const result = validateTranscriptForExport(transcript);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('metadata');
  });
});

// Example Integration Test: Full Export Workflow
describe('Export Integration', () => {
  test('should export to all formats without errors', () => {
    const transcript = createMockTranscript();

    expect(() => formatTXT(transcript)).not.toThrow();
    expect(() => formatJSON(transcript)).not.toThrow();
    expect(() => formatSRT(transcript)).not.toThrow();
    expect(() => formatVTT(transcript)).not.toThrow();
  });

  test('should handle large transcripts', () => {
    // Create transcript with 100 segments
    const segments: TranscriptSegment[] = Array.from({ length: 100 }, (_, i) => ({
      index: i,
      start: i * 10,
      end: (i + 1) * 10,
      text: `Segment ${i + 1} content goes here.`,
    }));

    const transcript: Transcript = {
      ...createMockTranscript(),
      segments,
      text: segments.map(s => s.text).join(' '),
    };

    expect(() => formatSRT(transcript)).not.toThrow();
    expect(() => formatVTT(transcript)).not.toThrow();

    const srtResult = formatSRT(transcript);
    expect(srtResult.split('\n\n').length).toBeGreaterThan(99);
  });

  test('should handle special characters', () => {
    const transcript: Transcript = {
      ...createMockTranscript(),
      text: 'Quote: "Hello" & \'World\' with <tags> and line\nbreaks',
      segments: [
        {
          index: 0,
          start: 0,
          end: 5,
          text: 'Quote: "Hello" & \'World\'',
        },
      ],
    };

    const txtResult = formatTXT(transcript);
    const jsonResult = formatJSON(transcript);
    const srtResult = formatSRT(transcript);
    const vttResult = formatVTT(transcript);

    expect(txtResult).toBeDefined();
    expect(jsonResult).toBeDefined();
    expect(srtResult).toBeDefined();
    expect(vttResult).toBeDefined();

    // JSON should be parseable
    expect(() => JSON.parse(jsonResult)).not.toThrow();
  });
});

// Example Mock for Browser APIs
describe('Browser Download Helpers', () => {
  // Mock browser APIs for testing
  let originalBlob: typeof Blob | undefined;
  let originalURL: typeof URL | undefined;
  let originalDocument: Document | undefined;

  beforeAll(() => {
    originalBlob = global.Blob;
    originalURL = global.URL;
    originalDocument = global.document;

    class MockBlob {
      parts: unknown[];
      options: Record<string, unknown>;

      constructor(parts: unknown[], options: Record<string, unknown>) {
        this.parts = parts;
        this.options = options;
      }
    }

    const mockURL = {
      createObjectURL: jest.fn(() => 'blob:mock-url'),
      revokeObjectURL: jest.fn(),
    } satisfies Pick<URL, 'createObjectURL' | 'revokeObjectURL'>;

    const mockDocument = {
      createElement: jest.fn(() => ({
        click: jest.fn(),
        style: {},
      })),
      body: {
        appendChild: jest.fn(),
        removeChild: jest.fn(),
      },
    } as unknown as Document;

    global.Blob = MockBlob as unknown as typeof Blob;
    global.URL = mockURL as unknown as typeof URL;
    global.document = mockDocument;
  });

  afterAll(() => {
    if (originalBlob) {
      global.Blob = originalBlob;
    }
    if (originalURL) {
      global.URL = originalURL;
    }
    if (originalDocument) {
      global.document = originalDocument;
    }
  });

  test('should check browser compatibility', async () => {
    const downloadHelper = await import('../download-helper');
    expect(downloadHelper.isBrowserCompatible()).toBe(true);
  });
});
