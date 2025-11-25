# Meeting Transcriber

A modern web application for transcribing meeting recordings using OpenAI's Whisper and GPT-4o models. Built with Next.js 14, featuring real-time audio recording, intelligent file processing, and AI-powered transcript analysis.

## Features

### Audio Input
- **File Upload**: Support for MP3, WAV, M4A, WebM, and MP4 files
- **Live Recording**: Browser-based audio capture with microphone, system audio, or commentary modes
- **Smart Processing**: Automatic MP4-to-MP3 conversion and intelligent audio splitting for large files using FFmpeg WebAssembly

### Transcription
- **Multiple Models**: Support for Whisper and GPT-4o Audio transcription
- **Speaker Detection**: Automatic speaker diarization and labeling
- **Language Support**: Multi-language transcription with automatic detection

### Analysis & Export
- **AI Analysis**: GPT-4 powered meeting summaries, action items, and key points extraction
- **Multiple Export Formats**: PDF, Markdown, and plain text
- **Template System**: Customizable transcript templates

### Storage & Management
- **Local Storage**: All data stored in browser IndexedDB for privacy
- **Recording Library**: Save, organize, and replay recordings
- **Transcript History**: Full history of transcripts with search

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **UI**: Mantine v8, Tailwind CSS
- **Audio Processing**: FFmpeg WebAssembly, WaveSurfer.js
- **AI/ML**: OpenAI Whisper, GPT-4o Audio, GPT-4
- **Database**: Dexie (IndexedDB wrapper)
- **PDF Generation**: React-PDF
- **i18n**: next-intl

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, or pnpm
- OpenAI API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/crypticpy/AustinTranscribe.git
cd AustinTranscribe
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.local.example .env.local
```

4. Add your OpenAI API key to `.env.local`:
```
OPENAI_API_KEY=your-api-key-here
```

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

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
│   ├── layout/           # Layout components (Header, Footer)
│   ├── record/           # Recording UI components
│   ├── transcript/       # Transcript display components
│   └── upload/           # Upload form components
├── hooks/                 # Custom React hooks
├── lib/                   # Utility libraries
│   ├── audio-processing.ts  # FFmpeg audio utilities
│   ├── db.ts             # IndexedDB operations
│   └── openai.ts         # OpenAI API client
├── messages/             # i18n translation files
├── public/               # Static assets
│   └── ffmpeg-core/     # FFmpeg WASM files
└── types/                # TypeScript type definitions
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for transcription and analysis |

### FFmpeg Setup

The application uses FFmpeg WebAssembly for client-side audio processing. The required files are included in `public/ffmpeg-core/`:
- `ffmpeg-core.js`
- `ffmpeg-core.wasm`

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions including Docker and Azure Container Apps setup.

For quick local testing, see [QUICKSTART.md](./QUICKSTART.md).

## Browser Compatibility

- Chrome 90+ (recommended)
- Firefox 90+
- Safari 15+
- Edge 90+

Note: System audio recording requires Chrome with screen sharing permissions.

## License

Private - All rights reserved.
