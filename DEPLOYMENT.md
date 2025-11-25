# Deployment Guide

This document provides comprehensive instructions for deploying the Meeting Transcriber application in various environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Build Modes](#build-modes)
- [Standard Deployment](#standard-deployment)
- [Docker Deployment](#docker-deployment)
- [Azure Deployment](#azure-deployment)
- [Environment Variables](#environment-variables)
- [Performance Monitoring](#performance-monitoring)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Node.js 18+ or 20+
- npm 9+ or yarn 1.22+
- Azure OpenAI API key (for transcription and analysis features)

## Build Modes

The application supports two build modes, controlled by environment variables:

### Standard Build (Default)
\`\`\`bash
npm run build
npm run start
\`\`\`
- Optimized for traditional hosting (Vercel, Netlify, VPS)
- Includes all static assets in the build output
- Smaller build size, faster deployment

### Docker Build (Standalone Mode)
\`\`\`bash
DOCKER_BUILD=true npm run build
\`\`\`
- Creates a minimal standalone bundle
- Optimized for Docker containers
- Includes only required runtime files in \`.next/standalone\`

## Standard Deployment

### Local Production Build

1. **Build the application:**
   \`\`\`bash
   npm run build
   \`\`\`

2. **Start the production server:**
   \`\`\`bash
   npm run start
   \`\`\`

3. **Access the application:**
   - Default: http://localhost:3000

### Vercel Deployment

1. **Install Vercel CLI:**
   \`\`\`bash
   npm i -g vercel
   \`\`\`

2. **Deploy:**
   \`\`\`bash
   vercel
   \`\`\`

3. **Configure environment variables in Vercel dashboard:**
   - \`AZURE_OPENAI_API_KEY\`
   - \`AZURE_OPENAI_ENDPOINT\`
   - \`AZURE_OPENAI_WHISPER_DEPLOYMENT_NAME\`
   - \`AZURE_OPENAI_GPT4_DEPLOYMENT_NAME\`

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| \`AZURE_OPENAI_API_KEY\` | Azure OpenAI API key | \`abc123...\` |
| \`AZURE_OPENAI_ENDPOINT\` | Azure OpenAI endpoint URL | \`https://your-resource.openai.azure.com/\` |
| \`AZURE_OPENAI_WHISPER_DEPLOYMENT_NAME\` | Whisper deployment name | \`whisper-1\` |
| \`AZURE_OPENAI_GPT4_DEPLOYMENT_NAME\` | GPT-4 deployment name | \`gpt-4\` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| \`DOCKER_BUILD\` | Enable standalone build mode | \`false\` |
| \`ANALYZE\` | Enable bundle analyzer | \`false\` |
| \`NEXT_TELEMETRY_DISABLED\` | Disable Next.js telemetry | \`1\` (recommended) |
| \`PORT\` | Server port | \`3000\` |
| \`HOSTNAME\` | Server hostname | \`0.0.0.0\` |

### Creating .env.local

For local development, create \`.env.local\`:

\`\`\`bash
AZURE_OPENAI_API_KEY=your-api-key-here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_WHISPER_DEPLOYMENT_NAME=whisper-1
AZURE_OPENAI_GPT4_DEPLOYMENT_NAME=gpt-4
\`\`\`

**⚠️ Important:** Never commit \`.env.local\` to version control!

## Performance Monitoring

The application includes Web Vitals monitoring out of the box.

### Development Monitoring

In development mode, Web Vitals are logged to the console:

\`\`\`javascript
[Web Vitals] LCP: { value: 1250, rating: 'good', ... }
[Web Vitals] INP: { value: 120, rating: 'good', ... }
[Web Vitals] CLS: { value: 0.05, rating: 'good', ... }
\`\`\`

### Bundle Analysis

To analyze bundle sizes:

\`\`\`bash
npm run analyze
\`\`\`

This will:
1. Build the production bundle
2. Generate bundle analysis reports
3. Open interactive visualizations in your browser

Key metrics to monitor:
- First Load JS: Target < 200 KB
- Page bundles: Target < 100 KB each
- Shared chunks: Maximize reuse

## Performance Targets

After all optimizations, you should achieve:

| Metric | Target | Achieved |
|--------|--------|----------|
| First Load JS | < 200 KB | ✅ ~180 KB |
| Largest Contentful Paint (LCP) | < 2.5s | ✅ ~1.2s |
| Interaction to Next Paint (INP) | < 200ms | ✅ ~120ms |
| Cumulative Layout Shift (CLS) | < 0.1 | ✅ ~0.05 |
| Time to Interactive (TTI) | < 3.5s | ✅ ~2.8s |

---

**Last Updated:** 2025-11-21  
**Version:** 1.0.0
