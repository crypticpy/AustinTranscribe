# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |
| < latest| :x:                |

## Reporting a Vulnerability

We take the security of Meeting Transcriber seriously. If you believe you have found a security vulnerability, please report it to us responsibly.

### How to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please send an email describing the vulnerability. Include the following information:

1. **Type of issue** (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
2. **Full paths of source file(s)** related to the manifestation of the issue
3. **The location of the affected source code** (tag/branch/commit or direct URL)
4. **Any special configuration** required to reproduce the issue
5. **Step-by-step instructions** to reproduce the issue
6. **Proof-of-concept or exploit code** (if possible)
7. **Impact of the issue**, including how an attacker might exploit it

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your vulnerability report within 48 hours.
- **Communication**: We will keep you informed of the progress toward a fix.
- **Disclosure**: We will notify you when the vulnerability has been fixed.
- **Credit**: We will credit you in the release notes (unless you prefer to remain anonymous).

## Security Best Practices

When deploying Meeting Transcriber, follow these security best practices:

### Environment Variables

- **Never commit secrets** to version control
- Use `.env.local` for local development (it's in `.gitignore`)
- Use Azure Key Vault for production deployments
- Rotate API keys regularly

### Azure Key Vault Integration

The application supports Azure Key Vault for secure secrets management:

```bash
# Set the Key Vault URL
export AZURE_KEY_VAULT_URL=https://your-vault.vault.azure.net/

# In production, secrets are loaded from Key Vault automatically
# The application uses Managed Identity when deployed to Azure
```

Required Key Vault secrets:
- `azure-openai-api-key`
- `azure-openai-endpoint`

### Docker Security

Our Docker configuration follows security best practices:

- **Non-root user**: Application runs as non-privileged user (UID 1001)
- **Minimal base image**: Alpine Linux with minimal attack surface
- **No unnecessary privileges**: `cap_drop: ALL` and `no-new-privileges: true`
- **Read-only filesystem**: Consider enabling in production
- **Health checks**: Built-in health monitoring

### Network Security

- **HTTPS only**: All API endpoints require HTTPS in production
- **CORS configuration**: Properly configured CORS headers
- **Rate limiting**: Consider adding rate limiting for API endpoints
- **Content Security Policy**: CSP headers are configured

### Data Security

- **Audio processing**: Audio is processed in-browser using FFmpeg WASM
- **No persistent storage**: Transcripts are not stored on the server by default
- **API key protection**: Keys are validated server-side only

## Security Headers

The application configures the following security headers:

```javascript
{
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=()'
}
```

## Dependency Management

- **Dependabot**: We use Dependabot to automatically update dependencies
- **Security audits**: Run `npm audit` regularly
- **Lock files**: We use `package-lock.json` for reproducible builds

## Known Security Considerations

### FFmpeg WASM

The application uses FFmpeg WASM for client-side audio processing. This requires:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

These headers are configured for the `/ffmpeg-core/*` routes.

### API Keys

- Azure OpenAI API keys have access to AI services
- Protect these keys as they can incur costs
- Use separate keys for development and production

## Incident Response

If you discover that your deployment has been compromised:

1. **Rotate all API keys** immediately
2. **Review access logs** for suspicious activity
3. **Update all dependencies** to latest versions
4. **Check Key Vault access logs** (if using Azure)
5. **Notify affected users** if applicable

## Updates

This security policy may be updated from time to time. Please check back regularly for updates.

---

Thank you for helping keep Meeting Transcriber and its users safe!
