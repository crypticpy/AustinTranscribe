# Contributing to Meeting Transcriber

Thank you for your interest in contributing to Meeting Transcriber! This document provides guidelines and information about contributing to this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

This project adheres to a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher
- Docker (for container testing)
- Azure CLI (for Azure deployments)
- Git

### Development Setup

1. **Fork the repository**

   Click the "Fork" button in the top right corner of this repository.

2. **Clone your fork**

   ```bash
   git clone https://github.com/YOUR_USERNAME/meeting-transcriber.git
   cd meeting-transcriber
   ```

3. **Add upstream remote**

   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/meeting-transcriber.git
   ```

4. **Install dependencies**

   ```bash
   npm install
   ```

5. **Set up environment variables**

   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your API credentials
   ```

6. **Start development server**

   ```bash
   npm run dev
   ```

7. **Open in browser**

   Navigate to [http://localhost:3000](http://localhost:3000)

## How to Contribute

### Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates.

When creating a bug report, include:

- A clear, descriptive title
- Steps to reproduce the issue
- Expected behavior vs actual behavior
- Screenshots if applicable
- Your environment (OS, Node.js version, browser)
- Any relevant error messages or logs

### Suggesting Features

We welcome feature suggestions! Please:

- Check existing issues and discussions first
- Clearly describe the problem your feature would solve
- Explain your proposed solution
- Consider potential drawbacks or alternatives

### Contributing Code

1. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make your changes**

   - Write clean, readable code
   - Follow the existing code style
   - Add tests for new functionality
   - Update documentation as needed

3. **Run tests and linting**

   ```bash
   npm run lint
   npm run type-check
   npm run test
   npm run build
   ```

4. **Commit your changes**

   Use conventional commit messages:

   ```bash
   git commit -m "feat: add audio compression feature"
   git commit -m "fix: resolve memory leak in transcription"
   git commit -m "docs: update API documentation"
   ```

5. **Push to your fork**

   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**

   Open a PR against the `main` branch of the upstream repository.

## Pull Request Process

1. **Before submitting**
   - Ensure all tests pass
   - Update documentation if needed
   - Rebase on the latest `main` branch
   - Squash commits if appropriate

2. **PR description should include**
   - Summary of changes
   - Related issue number(s)
   - Testing performed
   - Screenshots for UI changes

3. **Review process**
   - Maintainers will review your PR
   - Address any requested changes
   - Once approved, a maintainer will merge your PR

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Prefer `interface` over `type` for object shapes
- Use strict mode (`strict: true` in tsconfig)
- Avoid `any` - use proper types or `unknown`

### React/Next.js

- Use functional components with hooks
- Follow the App Router conventions
- Use server components where appropriate
- Keep components small and focused

### Styling

- Use Tailwind CSS for styling
- Follow the existing design system
- Ensure responsive design
- Support dark mode

### File Structure

```
app/                    # Next.js App Router pages
components/             # React components
├── ui/                # Reusable UI components
├── layout/            # Layout components
└── features/          # Feature-specific components
lib/                   # Utility functions and shared code
├── validations/       # Zod schemas and validators
└── hooks/             # Custom React hooks
types/                 # TypeScript type definitions
```

### Naming Conventions

- **Files**: `kebab-case.ts` for utilities, `PascalCase.tsx` for components
- **Components**: `PascalCase`
- **Functions**: `camelCase`
- **Constants**: `SCREAMING_SNAKE_CASE`
- **Types/Interfaces**: `PascalCase`

## Testing

### Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

- Place tests next to the code they test (`.test.ts` or `.test.tsx`)
- Use descriptive test names
- Test edge cases and error conditions
- Mock external dependencies appropriately

## Documentation

### Code Documentation

- Add JSDoc comments to public functions and interfaces
- Document complex logic with inline comments
- Keep comments up-to-date with code changes

### README and Docs

- Update README.md for user-facing changes
- Update DEPLOYMENT.md for deployment changes
- Add new documentation files as needed

## Questions?

If you have questions about contributing, feel free to:

- Open a discussion in the repository
- Ask in the issues (use the "question" label)
- Reach out to the maintainers

Thank you for contributing!
