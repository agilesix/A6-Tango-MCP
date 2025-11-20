# Google OAuth Setup for Tango MCP

This guide explains how to set up Google OAuth authentication for the Tango MCP server.

## Overview

The Tango MCP server now supports Google OAuth 2.0 authentication using Cloudflare's `workers-oauth-provider`. This provides a secure, production-ready authentication flow for MCP clients.

## Architecture

- **OAuth Provider**: `@cloudflare/workers-oauth-provider` handles OAuth flow and token management
- **Google Handler**: Custom Hono app (`src/auth/google-handler.ts`) manages Google OAuth callbacks
- **Security**: CSRF protection, state validation, cookie signing, and encrypted session management
- **MCP Integration**: Authenticated user props (`name`, `email`, `accessToken`) are passed to the MCP agent

## Prerequisites

1. Google Cloud Platform account
2. Cloudflare Workers account
3. Domain for redirect URIs (or use localhost for development)

## Setup Instructions

### 1. Create Google OAuth 2.0 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select an existing one
3. Click "Create Credentials" → "OAuth 2.0 Client ID"
4. Configure the consent screen if prompted
5. Application type: "Web application"
6. Add Authorized redirect URIs:
   - Development: `http://localhost:8788/callback`
   - Production: `https://your-worker-name.workers.dev/callback`
7. Copy the **Client ID** and **Client Secret**

### 2. Configure Environment Variables

#### Development (.env file)

```bash
# Replace with your actual values
GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_secret_here
COOKIE_ENCRYPTION_KEY=generate-a-random-32-character-string

# Optional: Restrict to Google Workspace domain
# HOSTED_DOMAIN=example.com
```

#### Production (Cloudflare Secrets)

```bash
# Set production secrets
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put COOKIE_ENCRYPTION_KEY

# Optional
wrangler secret put HOSTED_DOMAIN
```

### 3. Deploy

```bash
npm run deploy
```

## OAuth Flow

```
1. MCP Client discovers server → /.well-known/oauth-authorization-server
2. Client initiates OAuth → GET /authorize
3. User approves via Google OAuth consent screen
4. Google redirects back → GET /callback?code=...
5. Server exchanges code for access token
6. Server fetches user info from Google
7. Server creates encrypted session with user props
8. Client receives auth token
9. Client connects to /mcp or /sse with credentials
10. MCP Agent receives user props: { name, email, accessToken }
```

## Using with MCP Inspector

```bash
npx @modelcontextprotocol/inspector@latest

# Connect to: https://your-worker.workers.dev/mcp
# The inspector will guide you through the OAuth flow
```

## Using with Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "tango": {
      "url": "https://your-worker.workers.dev/mcp"
    }
  }
}
```

Claude Desktop will automatically handle the OAuth flow when connecting.

## Security Features

- **CSRF Protection**: One-time use tokens with secure cookies
- **State Validation**: Dual validation (KV storage + session cookie) prevents CSRF attacks
- **Cookie Security**: `__Host-` prefixed cookies with HttpOnly, Secure, SameSite=Lax
- **Session Binding**: State tokens are hashed and bound to browser sessions
- **Client Approval**: Approved clients are stored in signed cookies (30-day expiry)
- **Token Encryption**: User props are encrypted in auth tokens

## Endpoints

- `/.well-known/oauth-authorization-server` - OAuth metadata (RFC 8414)
- `/authorize` - Initiate OAuth flow
- `/callback` - OAuth callback from Google
- `/register` - Dynamic client registration (RFC 7591)
- `/token` - Token endpoint
- `/mcp` - MCP endpoint (Streamable HTTP protocol - **recommended**)
- `/sse` - Legacy SSE endpoint (deprecated)
- `/health` - Health check endpoint

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `COOKIE_ENCRYPTION_KEY` | Yes | Random string for cookie encryption (32+ chars) |
| `OAUTH_KV` | Yes | KV namespace for OAuth state (configured in wrangler.jsonc) |
| `HOSTED_DOMAIN` | No | Restrict to specific Google Workspace domain |
| `TANGO_API_KEY` | No | Fallback API key (legacy) |

## Troubleshooting

### "OAuth not configured" Error

**Cause**: Missing required environment variables

**Solution**: Ensure all required env vars are set in .env (dev) or as secrets (production)

### Redirect URI Mismatch

**Cause**: Google OAuth redirect URI doesn't match configured URIs

**Solution**: Add the exact redirect URI to Google Cloud Console:
- Development: `http://localhost:8788/callback`
- Production: `https://your-worker.workers.dev/callback`

### "Invalid or expired state token"

**Cause**: OAuth state expired (10-minute TTL) or browser cookies disabled

**Solution**:
- Complete OAuth flow within 10 minutes
- Enable cookies in browser
- Check OAUTH_KV namespace is properly configured

## Implementation Reference

This implementation is based on Cloudflare's official Google OAuth example:
https://github.com/cloudflare/ai/tree/main/demos/remote-mcp-google-oauth

## File Structure

```
src/
├── auth/
│   ├── auth-detector.ts          # Detects OAuth vs API key auth
│   ├── google-handler.ts          # Google OAuth flow endpoints
│   ├── utils.ts                   # OAuth utility functions
│   └── workers-oauth-utils.ts     # Security utilities (CSRF, cookies)
├── index.ts                       # Main entry point with OAuthProvider
└── types/env.ts                   # Environment variable types
```

## Migrating from API Key Auth

**Note**: The current implementation uses OAuth exclusively. To support both OAuth and API keys simultaneously, you would need to:

1. Modify the fetch handler to check for both OAuth context and API key headers
2. Update the auth detector to prioritize OAuth over API keys
3. Ensure backward compatibility in tool implementations

For now, you must use Google OAuth to authenticate.
