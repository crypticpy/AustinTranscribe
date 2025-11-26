# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Meeting Transcriber is a Next.js 14 application for transcribing audio recordings using OpenAI's Whisper and GPT-4o Transcribe engines. The app features real-time audio recording, AI-powered analysis, and all data is stored client-side in IndexedDB.

## Development Commands

```bash
# Install dependencies
npm ci

# Start development server
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Start production server
npm start
```

### Using Make

```bash
make help          # Show all available commands
make dev           # Start development server
make build         # Build production bundle
make lint          # Run ESLint
make docker-build  # Build Docker image
make deploy        # Build, push, and deploy to Azure
```

### Docker

```bash
docker compose up                    # Start with docker-compose
docker buildx build --platform linux/amd64 -t meeting-transcriber .  # Build for Azure
```

## Architecture

### Tech Stack
- **Framework**: Next.js 14 with App Router
- **UI**: Mantine v8 + Tailwind CSS
- **Database**: Dexie.js (IndexedDB wrapper) - client-side only
- **Audio Processing**: FFmpeg WebAssembly, WaveSurfer.js
- **AI**: OpenAI SDK with Azure OpenAI support

### Key Directories

- `app/` - Next.js App Router pages and API routes
  - `app/api/transcribe/route.ts` - Main transcription endpoint
  - `app/api/analyze/route.ts` - AI analysis endpoint
  - `app/api/chat/route.ts` - Q&A chat endpoint
- `components/` - React components organized by feature
- `hooks/` - Custom React hooks (e.g., `use-recording.ts`, `use-transcription-flow.ts`)
- `lib/` - Utilities and business logic
  - `lib/db.ts` - Dexie database singleton and operations
  - `lib/openai.ts` - OpenAI client configuration (Azure/standard)
  - `lib/analysis-strategies/` - Pluggable analysis strategy system
  - `lib/validations/` - Zod schemas for validation
- `types/` - TypeScript type definitions
- `infrastructure/` - Azure Bicep IaC for deployment

### Data Flow

1. **Transcription**: Audio file → `POST /api/transcribe` → OpenAI Whisper → Transcript stored in IndexedDB
2. **Analysis**: Transcript → `POST /api/analyze` → GPT analysis → Analysis stored in IndexedDB
3. **Storage**: All data (transcripts, analyses, recordings, conversations) persisted client-side via Dexie

### Database Schema (lib/db.ts)

The `MeetingTranscriberDB` class manages six IndexedDB tables:
- `transcripts` - Transcribed audio with segments and metadata
- `templates` - Analysis templates (built-in and custom)
- `analyses` - AI-generated analyses linked to transcripts
- `audioFiles` - Binary audio blobs for playback
- `conversations` - Q&A chat history per transcript
- `recordings` - Saved audio recordings with metadata

### OpenAI Configuration

The app supports both Azure OpenAI and standard OpenAI API. Configuration in `lib/openai.ts`:
- Uses Azure OpenAI if `AZURE_OPENAI_API_KEY` and `AZURE_OPENAI_ENDPOINT` are set
- Falls back to standard OpenAI with `OPENAI_API_KEY`
- Separate transcription client with API version `2025-03-01-preview` for Azure

Key functions:
- `getOpenAIClient()` - Returns singleton client for chat completions
- `getTranscriptionClient()` - Returns client configured for audio transcription
- `getWhisperDeployment()` - Returns deployment name for transcription
- `getGPTAnalysisDeployment()` - Returns deployment name for analysis

### Path Aliases

Use `@/*` for imports (configured in `tsconfig.json`):
```typescript
import { db } from '@/lib/db';
import { Transcript } from '@/types';
```

## Environment Setup

Copy `.env.local.example` to `.env.local` and configure:

### Azure OpenAI (Recommended)
```env
AZURE_OPENAI_API_KEY=your-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_WHISPER_DEPLOYMENT=whisper-1
AZURE_OPENAI_GPT4_DEPLOYMENT=gpt-4
```

### Standard OpenAI
```env
OPENAI_API_KEY=sk-your-key
```

## Code Patterns

### API Route Handlers
API routes use helper functions from `lib/api-utils.ts`:
```typescript
return successResponse(data);
return errorResponse('message', statusCode, details);
```

### Database Operations
Database operations in `lib/db.ts` follow consistent patterns:
- Functions throw `DatabaseError` with codes like `SAVE_FAILED`, `GET_FAILED`
- Use transactions for multi-table operations
- Paginated queries available for large datasets

### Analysis Strategies
Pluggable analysis strategies in `lib/analysis-strategies/`:
- `basic.ts` - Simple single-prompt analysis
- `advanced.ts` - Multi-phase analysis with section extraction
- `hybrid.ts` - Combined approach
- `evaluator.ts` - LLM-as-judge pattern for quality evaluation
