# Tango MCP Server - Authentication Guide

## Overview

The Tango MCP Server uses a **Gateway Model** for authentication and authorization. This means:

1. **You authenticate yourself** to the MCP server (not to the Tango API)
2. **The server validates** your identity and permissions
3. **The server makes API calls** to Tango on your behalf using a centralized API key
4. **You never need** to configure or see the Tango API key

This architecture provides better security, centralized API key management, and individual user accountability.

---

## Table of Contents

- [Authentication Methods](#authentication-methods)
- [OAuth Authentication (Recommended)](#oauth-authentication-recommended)
- [MCP Access Tokens](#mcp-access-tokens)
- [How to Request an MCP Token](#how-to-request-an-mcp-token)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

---

## Authentication Methods

The Tango MCP Server supports **two authentication methods**:

| Method | Use Case | User Type | Setup Difficulty |
|--------|----------|-----------|------------------|
| **OAuth (Google)** | Claude Code, Claude Web | Interactive users | Easy (automatic) |
| **MCP Access Token** | Agent SDK, automation | Developers, scripts | Medium (request token) |

### Which Method Should I Use?

- **Use OAuth** if you're using Claude Code or Claude Web → Easiest option, no configuration needed
- **Use MCP Access Token** if you're using Agent SDK or building custom integrations → Requires token request from admin

---

## OAuth Authentication (Recommended)

### Overview

OAuth authentication uses your Google account to verify your identity. This is the recommended method for all interactive users.

### Requirements

- **Google account**: You must have an @agile6.com email address
- **Browser access**: You'll need a web browser to complete authentication
- **MCP client**: Claude Code or Claude Web

### Setup (Claude Code)

1. **Add the MCP server** to your Claude Code configuration:

   **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

   **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

   ```json
   {
     "mcpServers": {
       "tango": {
         "url": "https://your-worker.workers.dev/sse"
       }
     }
   }
   ```

2. **Restart Claude Code** completely

3. **Use any tool** - you'll be prompted to authenticate on first use

4. **Sign in with Google** using your @agile6.com account

5. **Grant permissions** when requested

6. **Done!** You can now use all tools

### Setup (Claude Web)

1. **Go to Claude.ai**

2. **Add MCP Server** in settings

3. **Enter server URL**: `https://your-worker.workers.dev/sse`

4. **Authenticate** when prompted with your @agile6.com account

5. **Start using tools** immediately

### OAuth Flow Diagram

```
┌─────────────┐
│    User     │
│ (You)       │
└──────┬──────┘
       │
       │ 1. Click "Authenticate"
       ▼
┌─────────────────────┐
│   MCP Server        │
│ (Tango MCP)         │
└──────┬──────────────┘
       │
       │ 2. Redirect to Google
       ▼
┌─────────────────────┐
│   Google OAuth      │
│ (accounts.google.   │
│  com)               │
└──────┬──────────────┘
       │
       │ 3. Sign in with @agile6.com
       ▼
┌─────────────────────┐
│   User Signs In     │
│ (Google Auth Page)  │
└──────┬──────────────┘
       │
       │ 4. Grant permissions
       ▼
┌─────────────────────┐
│   Google Redirects  │
│   back to MCP       │
└──────┬──────────────┘
       │
       │ 5. MCP validates & creates session
       ▼
┌─────────────────────┐
│   Authenticated!    │
│   (Ready to use)    │
└─────────────────────┘
```

### Session Management

- **Session duration**: 30 days (default)
- **Automatic renewal**: Yes, as long as you use the tools
- **Re-authentication**: Only needed if session expires or you clear cookies
- **Multiple devices**: Each device has its own session

### OAuth Security

OAuth authentication provides strong security:

- **No password sharing**: You use your existing Google account
- **Domain restriction**: Only @agile6.com accounts are allowed
- **Token-based**: Session tokens are encrypted and stored securely
- **Revocable**: Sessions can be revoked by server administrators
- **Audit trail**: All API calls are logged with your email

---

## MCP Access Tokens

### Overview

MCP access tokens are long-lived authentication tokens designed for:

- **Agent SDK**: The SDK doesn't support OAuth, so tokens are required
- **Automation**: Scripts, CI/CD pipelines, and background jobs
- **Server-to-server**: API integrations and webhooks

### Token Format

```
mcp_v1_8KfR3mN9pQs2tXy7wVz4uBn6hJk5gFd2eC1aL0
```

- **Prefix**: `mcp_v1_` (identifies token type and version)
- **Random part**: 32 bytes of cryptographic randomness (Base58 encoded)
- **Length**: ~50 characters
- **Entropy**: 256 bits (2^256 possible tokens)

### Token Security Features

- **Cryptographically random**: Generated using `crypto.getRandomValues()`
- **Hashed storage**: Tokens are SHA-256 hashed before storage (no plaintext)
- **Usage tracking**: Every use is logged with timestamp and IP address
- **Revocable**: Tokens can be instantly revoked by administrators
- **Expirable**: Tokens have a configurable expiration (default: 1 year)

### Setup (Agent SDK)

1. **Request a token** from your Tango MCP administrator

2. **Save the token securely** - you'll only see it once!

3. **Configure your `.mcp.json`**:

   ```json
   {
     "mcpServers": {
       "tango": {
         "type": "sse",
         "url": "https://your-worker.workers.dev/sse",
         "headers": {
           "x-mcp-access-token": "${MCP_ACCESS_TOKEN}"
         }
       }
     }
   }
   ```

4. **Set environment variable**:

   **macOS/Linux**:
   ```bash
   export MCP_ACCESS_TOKEN=mcp_v1_your_token_here
   ```

   **Windows**:
   ```powershell
   $env:MCP_ACCESS_TOKEN="mcp_v1_your_token_here"
   ```

5. **Start using the Agent SDK** - authentication is automatic!

### Token Management

Once you have a token, you can:

- **Use it indefinitely** (until expiration or revocation)
- **Track usage** by asking your administrator for statistics
- **Rotate it** by requesting a new token and revoking the old one
- **Revoke it** if compromised by contacting your administrator

### Token Lifecycle

```
┌──────────────┐
│   Created    │  Administrator generates token
└──────┬───────┘
       │
       │ User saves token
       ▼
┌──────────────┐
│   Active     │  Token is valid and usable
└──────┬───────┘
       │
       │ (Optional) Token expires or is revoked
       ▼
┌──────────────┐
│   Revoked/   │  Token no longer works
│   Expired    │
└──────────────┘
```

---

## How to Request an MCP Token

### Step 1: Contact Your Administrator

Send an email to your Tango MCP administrator with:

**Subject**: MCP Access Token Request

**Body**:
```
Hi,

I'd like to request an MCP access token for the Tango MCP Server.

- Name: [Your Full Name]
- Email: [your.email@agile6.com]
- Use case: [Agent SDK / Automation / Integration]
- Description: [Brief description of what you'll use it for]

Thanks!
```

### Step 2: Receive Your Token

Your administrator will generate a token and send it to you **once**. It will look like:

```
mcp_v1_8KfR3mN9pQs2tXy7wVz4uBn6hJk5gFd2eC1aL0
```

**IMPORTANT**: Save this token immediately! You will never see it again.

### Step 3: Store It Securely

**Option A: Environment Variable (Recommended)**

**macOS/Linux** (`~/.bashrc` or `~/.zshrc`):
```bash
export MCP_ACCESS_TOKEN=mcp_v1_your_token_here
```

**Windows** (System Environment Variables):
```
Variable name: MCP_ACCESS_TOKEN
Variable value: mcp_v1_your_token_here
```

**Option B: Password Manager**

Store in 1Password, LastPass, or another password manager as:
```
Name: Tango MCP Access Token
Username: [your.email@agile6.com]
Password: mcp_v1_your_token_here
```

**DO NOT**:
- Commit tokens to Git repositories
- Share tokens with others
- Store tokens in plaintext files
- Include tokens in screenshots or documentation

### Step 4: Configure Your Application

See [Setup (Agent SDK)](#setup-agent-sdk) above for configuration instructions.

---

## Security Best Practices

### For All Users

1. **Never share authentication credentials**
   - OAuth sessions are personal to you
   - MCP tokens should never be shared

2. **Use strong, unique passwords**
   - Your Google account password should be strong
   - Enable 2FA on your Google account

3. **Be cautious of phishing**
   - Always verify you're on accounts.google.com when signing in
   - The MCP server will never ask for your password directly

4. **Report suspicious activity**
   - Contact your administrator if you see unexpected API usage
   - Report any security concerns immediately

### For MCP Token Users

5. **Treat tokens like passwords**
   - Never commit to Git
   - Never share with others
   - Store securely in environment variables or password managers

6. **Use token descriptions**
   - When requesting a token, provide a clear description
   - This helps with auditing and tracking

7. **Rotate tokens regularly**
   - Request new tokens every 6-12 months
   - Revoke old tokens after rotating

8. **Minimize token exposure**
   - Only store tokens on machines that need them
   - Remove tokens from machines you no longer use

9. **Revoke compromised tokens immediately**
   - If a token is exposed, contact your administrator immediately
   - Get a replacement token after revocation

### For Administrators

10. **Monitor token usage**
    - Review token usage statistics regularly
    - Watch for anomalous patterns

11. **Enforce expiration**
    - Set reasonable expiration periods (365 days recommended)
    - Require token rotation

12. **Maintain audit logs**
    - Keep logs of all authentication attempts
    - Track API usage by user/token

---

## Troubleshooting

### OAuth Issues

#### Error: "Unauthorized: Authentication required"

**Symptoms**: Claude prompts for authentication even though you already authenticated.

**Causes**:
- Your session expired (30 days default)
- Cookies were cleared
- You're using a different device

**Solutions**:
1. Click "Authenticate" again
2. Sign in with your @agile6.com account
3. If problem persists, clear your browser cache and try again

#### Error: "Only @agile6.com accounts are allowed"

**Symptoms**: Authentication fails after signing in with Google.

**Causes**:
- You're using a personal Gmail account
- You're using a different organization's Google Workspace account

**Solutions**:
1. Sign out of Google (accounts.google.com)
2. Sign in with your @agile6.com account
3. Try authenticating again

#### Error: "redirect_uri_mismatch"

**Symptoms**: Google shows an error about redirect URI.

**Causes**:
- Server OAuth configuration is incorrect
- You're using an unsupported client

**Solutions**:
1. Contact your server administrator
2. Provide them the full error message and URL
3. They may need to update OAuth client configuration

### MCP Token Issues

#### Error: "Invalid token format"

**Symptoms**: Authentication fails with "Invalid token format" message.

**Causes**:
- Token is incomplete or corrupted
- Token has extra spaces or newlines
- Wrong token type (not an MCP token)

**Solutions**:
1. Verify token starts with `mcp_v1_`
2. Check for extra spaces, newlines, or special characters
3. Re-copy the token from your secure storage
4. If problem persists, request a new token

#### Error: "Token not found"

**Symptoms**: Authentication fails with "Token not found" message.

**Causes**:
- Token was deleted by an administrator
- Token never existed (typo in token)
- Server database was reset

**Solutions**:
1. Verify you copied the complete token
2. Check with your administrator if the token still exists
3. Request a new token if needed

#### Error: "Token has been revoked"

**Symptoms**: Authentication fails with "Token has been revoked" message.

**Causes**:
- Administrator revoked the token (security issue, token rotation, etc.)
- Token was compromised and automatically revoked

**Solutions**:
1. Contact your administrator to understand why it was revoked
2. Request a new token
3. If revoked due to compromise, review security practices

#### Error: Token works sometimes but not others

**Symptoms**: Authentication succeeds sometimes but fails randomly.

**Causes**:
- Token has special characters causing parsing issues
- Network issues during validation
- Server-side rate limiting

**Solutions**:
1. Check that token is properly quoted in configuration files
2. Try again in a few minutes (rate limiting)
3. Contact administrator if problem persists

---

## FAQ

### General Questions

**Q: Do I need a Tango API key?**

A: No! That's the beauty of the Gateway Model. The server has a centralized Tango API key and uses it on your behalf. You only need to authenticate yourself to the MCP server.

**Q: Can I use both OAuth and MCP tokens?**

A: Yes, but you typically choose one:
- Use OAuth for interactive work in Claude Code/Web
- Use MCP tokens for Agent SDK and automation

**Q: What happens if I lose my MCP token?**

A: Contact your administrator to:
1. Revoke the lost token (security precaution)
2. Generate a new token for you

You'll need to update your configuration with the new token.

**Q: How long do sessions/tokens last?**

A:
- **OAuth sessions**: 30 days (default), automatically renewed on use
- **MCP tokens**: 365 days (default), or until revoked

**Q: Can I have multiple tokens?**

A: Yes! You can have multiple MCP tokens with different descriptions:
- "My laptop token"
- "CI/CD pipeline token"
- "Development server token"

This makes it easier to track usage and revoke individual tokens if needed.

### OAuth-Specific Questions

**Q: Why do I need to use my work email?**

A: The server is configured to only allow @agile6.com accounts for security and compliance reasons. This ensures only Agile Six employees can access federal procurement data.

**Q: Can I use OAuth with the Agent SDK?**

A: No, the Agent SDK doesn't support OAuth. Use an MCP access token instead.

**Q: What permissions am I granting during OAuth?**

A: You're only granting access to your basic profile information (name and email). The MCP server does NOT access your Gmail, Drive, or other Google services.

**Q: Can I revoke OAuth access?**

A: Yes! You can revoke access at any time:
1. Go to https://myaccount.google.com/permissions
2. Find "Tango MCP Server"
3. Click "Remove Access"

You'll need to re-authenticate next time you use the server.

### MCP Token Questions

**Q: What's the difference between MCP tokens and API keys?**

A:
- **MCP tokens**: Authenticate YOU to the MCP server
- **Tango API keys**: Authenticate the MCP SERVER to the Tango API

You never see or configure Tango API keys in the Gateway Model.

**Q: Can I generate my own tokens?**

A: No, only administrators can generate MCP tokens. This ensures proper tracking and security controls.

**Q: What information is stored with my token?**

A:
- Your email address (who owns the token)
- Token description (what it's used for)
- Creation timestamp and IP
- Usage count and last used timestamp
- Revocation status (active/revoked)

**Q: Can administrators see my API calls?**

A: Yes, administrators can see:
- Which user/token made each API call
- Timestamp and IP address
- Which tools were used

This is necessary for security auditing and troubleshooting.

**Q: How do I know if my token is about to expire?**

A: Contact your administrator to check token expiration dates. Consider setting a calendar reminder to rotate tokens before expiration.

### Security Questions

**Q: Is my data secure?**

A: Yes! The server uses:
- HTTPS for all communications
- SHA-256 hashing for token storage
- Encrypted session cookies for OAuth
- Domain-restricted authentication (@agile6.com only)
- Comprehensive audit logging

**Q: What happens if the server is compromised?**

A: The Gateway Model actually IMPROVES security in this scenario:
- Your personal credentials are NOT stored on the server
- OAuth sessions can be revoked
- MCP tokens can be revoked
- Only one Tango API key needs to be rotated (the server's)

**Q: Can someone steal my token and use it?**

A: If someone gets your MCP token, they could use it until:
1. You notice and report it
2. An administrator revokes it
3. It expires naturally

This is why token security is critical! Always store tokens securely and never share them.

**Q: How do I report a security issue?**

A: Contact your administrator immediately with:
- Description of the issue
- Any relevant error messages or logs
- Steps to reproduce (if applicable)
- Whether any credentials may have been compromised

---

## Additional Resources

- **README**: [README.md](./README.md) - Server overview and quick start
- **OAuth Setup**: [MULTI_CLIENT_OAUTH_SETUP.md](../working_documents/MULTI_CLIENT_OAUTH_SETUP.md) - Detailed OAuth configuration
- **Token Admin Guide**: [docs/mcp-token-admin-guide.md](./docs/mcp-token-admin-guide.md) - For administrators only
- **Tango API Docs**: https://docs.makegov.com - Tango API reference

---

## Support

Need help? Contact:

- **Your Team Lead**: For access requests and general questions
- **MCP Administrator**: For token generation, revocation, and technical issues
- **Security Team**: For security concerns or suspected compromises

**Email Template for Support**:
```
Subject: Tango MCP Server - [Your Issue]

Description: [Describe your problem]

Authentication method: [OAuth / MCP Token]

Error message (if any): [Exact error text]

Steps you've tried: [What you've already attempted]

Configuration: [Relevant config snippets, with tokens redacted]
```
