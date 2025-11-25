# Meeting Transcriber

[![CI](https://github.com/YOUR_USERNAME/meeting-transcriber/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/meeting-transcriber/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern web application for transcribing meeting recordings using OpenAI's Whisper and GPT-4o Transcribe engines, with AI-powered analysis via GPT-5 and GPT-4.1. Built with Next.js 14, featuring real-time audio recording, intelligent file processing, and comprehensive transcript analysis.

## Features

### Audio Input
- **File Upload**: Support for MP3, WAV, M4A, WebM, and MP4 files
- **Live Recording**: Browser-based audio capture with microphone, system audio, or commentary modes
- **Smart Processing**: Automatic MP4-to-MP3 conversion and intelligent audio splitting for large files using FFmpeg WebAssembly

### Transcription
- **Whisper**: OpenAI's dedicated speech-to-text model for accurate transcription
- **GPT-4o Transcribe**: Advanced audio transcription with enhanced context understanding
- **Speaker Detection**: Automatic speaker diarization and labeling
- **Language Support**: Multi-language transcription with automatic detection

### Analysis & Export
- **GPT-5 Analysis**: Latest generation AI for comprehensive meeting summaries, action items, and key points extraction
- **GPT-4.1 Support**: Extended context analysis for longer transcripts and detailed insights
- **Multiple Export Formats**: PDF, Markdown, and plain text
- **Template System**: Customizable transcript templates

### Storage & Management
- **Local Storage**: All data stored in browser IndexedDB for privacy
- **Recording Library**: Save, organize, and replay recordings
- **Transcript History**: Full history of transcripts with search

## AI Models

### Transcription Engines
| Model | Purpose | Best For |
|-------|---------|----------|
| **Whisper** | Dedicated speech-to-text | Fast, accurate transcription of clear audio |
| **GPT-4o Transcribe** | Advanced audio understanding | Complex audio with context, accents, technical jargon |

### Analysis LLMs
| Model | Purpose | Best For |
|-------|---------|----------|
| **GPT-5** | Primary analysis engine | Meeting summaries, action items, key points extraction |
| **GPT-4.1** | Extended context analysis | Long transcripts, detailed insights, comprehensive reports |

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **UI**: Mantine v8, Tailwind CSS
- **Audio Processing**: FFmpeg WebAssembly, WaveSurfer.js
- **Transcription**: OpenAI Whisper, GPT-4o Transcribe
- **Analysis**: GPT-5, GPT-4.1 (extended context)
- **Database**: Dexie (IndexedDB wrapper)
- **PDF Generation**: React-PDF
- **Infrastructure**: Docker, Azure Container Apps, Bicep IaC

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- OpenAI API key (or Azure OpenAI credentials)
- Docker (optional, for containerized deployment)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/meeting-transcriber.git
cd meeting-transcriber

# Install dependencies
npm install

# Set up environment
cp .env.local.example .env.local
# Edit .env.local with your API credentials

# Start development server
npm run dev

# Open http://localhost:3000
```

### Configuration

#### Standard OpenAI

```env
OPENAI_API_KEY=sk-your-api-key-here
```

#### Azure OpenAI (Recommended for Production)

```env
AZURE_OPENAI_API_KEY=your-azure-api-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_VERSION=2024-08-01-preview

# Transcription deployments
AZURE_OPENAI_WHISPER_DEPLOYMENT=whisper-1        # Whisper model for speech-to-text
AZURE_OPENAI_GPT4O_TRANSCRIBE_DEPLOYMENT=gpt-4o-transcribe  # GPT-4o for audio transcription

# Analysis deployments (choose one or both)
AZURE_OPENAI_GPT5_DEPLOYMENT=gpt-5               # GPT-5 for analysis
AZURE_OPENAI_GPT41_DEPLOYMENT=gpt-4.1            # GPT-4.1 for extended context analysis
```

#### Azure Key Vault (Optional)

For production deployments, store secrets in Azure Key Vault:

```env
AZURE_KEY_VAULT_URL=https://your-vault.vault.azure.net/
```

## Deployment

### Docker

```bash
# Build and run locally
docker compose up

# Build for AMD64 (Azure)
docker buildx build --platform linux/amd64 -t meeting-transcriber:latest .

# Push to registry
docker tag meeting-transcriber:latest your-registry.azurecr.io/meeting-transcriber:latest
docker push your-registry.azurecr.io/meeting-transcriber:latest
```

### Azure Container Apps

Deploy using Bicep Infrastructure-as-Code:

```bash
# Login to Azure
az login

# Deploy infrastructure
cd infrastructure
./deploy.sh prod

# Add secrets to Key Vault
az keyvault secret set --vault-name kv-mtranscriber-prod \
  --name azure-openai-api-key --value 'YOUR_KEY'
az keyvault secret set --vault-name kv-mtranscriber-prod \
  --name azure-openai-endpoint --value 'YOUR_ENDPOINT'
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## Development

### Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run TypeScript type checking |
| `npm run test` | Run tests |

### Using Make

```bash
make help          # Show all available commands
make dev           # Start development server
make build         # Build production bundle
make docker-build  # Build Docker image
make deploy        # Build, push, and deploy to Azure
```

### Docker Development

```bash
# Development with hot-reload
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Production-like local testing
docker compose -f docker-compose.yml -f docker-compose.production.yml up
```

## Project Structure

```
meeting-transcriber/
├── app/                    # Next.js app router pages
│   ├── api/               # API routes (transcription, analysis)
│   ├── record/            # Live recording page
│   ├── recordings/        # Saved recordings library
│   ├── templates/         # Template management
│   ├── transcripts/       # Transcript viewing/history
│   └── upload/            # File upload & transcription
├── components/            # React components
├── hooks/                 # Custom React hooks
├── lib/                   # Utility libraries
│   ├── azure-key-vault.ts # Key Vault integration
│   ├── openai.ts          # OpenAI API client
│   └── validations/       # Zod validation schemas
├── infrastructure/        # Azure Bicep IaC
│   ├── main.bicep        # Main deployment template
│   ├── modules/          # Bicep modules
│   └── parameters/       # Environment parameters
├── .github/              # GitHub workflows and templates
└── types/                # TypeScript type definitions
```

## Browser Compatibility

- Chrome 90+ (recommended)
- Firefox 90+
- Safari 15+
- Edge 90+

Note: System audio recording requires Chrome with screen sharing permissions.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

Before contributing, please read our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Security

For security issues, please see [SECURITY.md](./SECURITY.md) for our security policy and how to report vulnerabilities.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
