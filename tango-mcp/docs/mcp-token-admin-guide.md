# MCP Token Administration Guide

**Audience**: Tango MCP Server Administrators

This guide covers administrative functions for managing MCP access tokens, including generation, validation, revocation, and monitoring.

---

## Table of Contents

- [Overview](#overview)
- [Admin Prerequisites](#admin-prerequisites)
- [Token Generation](#token-generation)
- [Token Management](#token-management)
- [Token Revocation](#token-revocation)
- [Usage Monitoring](#usage-monitoring)
- [Security Operations](#security-operations)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

---

## Overview

### What Are MCP Tokens?

MCP (Model Context Protocol) access tokens are long-lived authentication credentials that allow Agent SDK users and automated systems to authenticate to the Tango MCP Server.

### Token Architecture

```
Token Format: mcp_v1_8KfR3mN9pQs2tXy7wVz4uBn6hJk5gFd2eC1aL0
              └─────┘ └─────────────────────────────────┘
               prefix        32 bytes (Base58 encoded)
```

**Security Features**:
- 256-bit cryptographic randomness
- SHA-256 hashed storage (no plaintext)
- Constant-time comparison (timing attack prevention)
- Usage tracking and metadata
- Revocable at any time

### KV Storage Schema

```
# Primary lookup: Token hash -> Token data
token:hash:{sha256_hash} -> MCPTokenData

# User token list
user:tokens:{userId} -> string[] (tokenIds)

# Token ID lookup
token:id:{tokenId} -> string (sha256_hash)

# Revoked tokens list
revoked:tokens -> string[] (tokenIds)
```

---

## Admin Prerequisites

### Required Access

To perform admin operations, you need:

1. **Admin Email**: Your email must be in the `ADMIN_EMAILS` environment variable
2. **OAuth Authentication**: Must authenticate with your @agile6.com Google account
3. **Server Access**: Access to the Cloudflare Worker environment

### Verify Admin Access

Check if you have admin access:

```bash
curl https://your-worker.workers.dev/admin/verify \
  -H "Cookie: session=YOUR_SESSION_COOKIE"
```

Expected response:
```json
{
  "admin": true,
  "email": "admin@agile6.com"
}
```

---

## Token Generation

### Generate a Token

**Method 1: Using Admin Endpoint (Recommended)**

```bash
curl -X POST https://your-worker.workers.dev/admin/tokens \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user@agile6.com",
    "description": "Johns Agent SDK token"
  }'
```

Response:
```json
{
  "success": true,
  "token": "mcp_v1_8KfR3mN9pQs2tXy7wVz4uBn6hJk5gFd2eC1aL0",
  "tokenId": "tok_8KfR3mN9pQs2tXy7wVz4u",
  "userId": "user@agile6.com",
  "description": "Johns Agent SDK token",
  "createdAt": "2025-11-21T10:00:00.000Z",
  "warning": "This token will only be shown once. Save it securely!"
}
```

**IMPORTANT**: The raw token is only shown ONCE. The user must save it immediately.

**Method 2: Using Wrangler CLI**

```bash
# Open a Wrangler shell session
wrangler dev

# In the shell, run:
const { generateMcpAccessToken } = await import('./src/auth/mcp-token.js');
const env = /* access your env bindings */;
const result = await generateMcpAccessToken(
  'user@agile6.com',
  'Johns Agent SDK token',
  env,
  'admin-ip',
  'wrangler-cli'
);
console.log('Token:', result.token);
console.log('Token ID:', result.tokenId);
```

### Token Generation Process

```
┌─────────────────┐
│ Admin Request   │  POST /admin/tokens
│                 │  { userId, description }
└────────┬────────┘
         │
         │ 1. Validate admin access
         ▼
┌─────────────────┐
│ Check OAuth     │  Verify @agile6.com email
│ Session         │  Check ADMIN_EMAILS list
└────────┬────────┘
         │
         │ 2. Generate token
         ▼
┌─────────────────┐
│ crypto.random   │  Generate 32 bytes
│ Values(32)      │  → 256-bit entropy
└────────┬────────┘
         │
         │ 3. Encode & store
         ▼
┌─────────────────┐
│ Base58 Encode   │  Token format: mcp_v1_...
│ SHA-256 Hash    │  Hash for storage
│ Store in KV     │  3 KV writes
└────────┬────────┘
         │
         │ 4. Return to admin
         ▼
┌─────────────────┐
│ Return Token    │  ⚠️  Only shown once!
│ (ONE TIME)      │  Admin must copy & send to user
└─────────────────┘
```

### Best Practices for Token Generation

1. **Use descriptive names**: "Johns laptop token", "CI/CD pipeline token"
2. **Generate per-device**: Each device/use case gets its own token
3. **Document the purpose**: Keep a record of why each token was created
4. **Communicate securely**: Send tokens via secure channels (not email!)
5. **Set expectations**: Tell users to save the token immediately

### Token Distribution

**Secure Distribution Methods**:

✅ **Recommended**:
- In-person delivery (most secure)
- Encrypted messaging (Signal, Wire)
- Password-protected document with separate password delivery
- Password manager sharing feature (1Password, LastPass)

❌ **NOT Recommended**:
- Plain email
- Slack/Teams messages
- Text messages
- Shared documents without encryption

**Distribution Template**:

```
Subject: Your MCP Access Token (Action Required)

Hi [User],

I've generated an MCP access token for you. This token will authenticate you to the Tango MCP Server.

Token ID: tok_8KfR3mN9pQs2tXy7wVz4u
Token: [See encrypted attachment]
Description: [Purpose]
Expires: [Date]

IMPORTANT:
1. Save this token in a secure location (password manager recommended)
2. Do NOT share this token with anyone
3. Do NOT commit it to Git or share in documents
4. Contact me immediately if you lose it or if it's compromised

Setup instructions: [Link to AUTHENTICATION.md]

Questions? Reply to this email.

Thanks,
[Admin Name]
```

---

## Token Management

### List All Tokens for a User

```bash
curl https://your-worker.workers.dev/admin/tokens?userId=user@agile6.com \
  -H "Cookie: session=YOUR_SESSION_COOKIE"
```

Response:
```json
{
  "success": true,
  "userId": "user@agile6.com",
  "tokens": [
    {
      "tokenId": "tok_abc123",
      "description": "Laptop token",
      "status": "active",
      "createdAt": "2025-01-15T10:00:00.000Z",
      "lastUsedAt": "2025-11-20T14:30:00.000Z",
      "usageCount": 142
    },
    {
      "tokenId": "tok_xyz789",
      "description": "CI/CD token",
      "status": "revoked",
      "createdAt": "2024-06-01T08:00:00.000Z",
      "revokedAt": "2025-10-15T12:00:00.000Z",
      "revocationReason": "Token rotation - replaced with new token"
    }
  ],
  "total": 2,
  "active": 1,
  "revoked": 1
}
```

### Get Token Details

```bash
curl https://your-worker.workers.dev/admin/tokens/tok_abc123 \
  -H "Cookie: session=YOUR_SESSION_COOKIE"
```

Response:
```json
{
  "success": true,
  "tokenId": "tok_abc123",
  "userId": "user@agile6.com",
  "description": "Laptop token",
  "status": "active",
  "createdAt": "2025-01-15T10:00:00.000Z",
  "lastUsedAt": "2025-11-20T14:30:00.000Z",
  "usageCount": 142,
  "metadata": {
    "createdFromIp": "192.168.1.100",
    "createdFromUserAgent": "wrangler-cli",
    "lastUsedFromIp": "192.168.1.101"
  }
}
```

### Update Token Description

```bash
curl -X PATCH https://your-worker.workers.dev/admin/tokens/tok_abc123 \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Johns work laptop token (updated)"
  }'
```

### Delete a Token Permanently

```bash
curl -X DELETE https://your-worker.workers.dev/admin/tokens/tok_abc123 \
  -H "Cookie: session=YOUR_SESSION_COOKIE"
```

**WARNING**: This permanently deletes the token. Consider revoking instead of deleting for audit trail purposes.

---

## Token Revocation

### Revoke a Single Token

```bash
curl -X POST https://your-worker.workers.dev/admin/tokens/tok_abc123/revoke \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Security incident - token may have been compromised"
  }'
```

Response:
```json
{
  "success": true,
  "tokenId": "tok_abc123",
  "revokedAt": "2025-11-21T10:30:00.000Z",
  "reason": "Security incident - token may have been compromised"
}
```

### Revoke All Tokens for a User

```bash
curl -X POST https://your-worker.workers.dev/admin/tokens/revoke-all \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user@agile6.com",
    "reason": "Employee offboarding"
  }'
```

Response:
```json
{
  "success": true,
  "userId": "user@agile6.com",
  "revokedCount": 3,
  "reason": "Employee offboarding"
}
```

### Un-revoke a Token

If a token was revoked by mistake:

```bash
curl -X POST https://your-worker.workers.dev/admin/tokens/tok_abc123/unrevoke \
  -H "Cookie: session=YOUR_SESSION_COOKIE"
```

**Use Case**: Token revoked by accident, user still needs it

### Revocation Reasons

**Standard Revocation Reasons**:

- `"Token rotation"` - Regular security maintenance
- `"Security incident - token compromised"` - Token exposed/stolen
- `"Security incident - token may have been compromised"` - Precautionary
- `"Employee offboarding"` - User left the organization
- `"Project ended"` - Token no longer needed
- `"User request"` - User asked to revoke
- `"Suspicious activity detected"` - Automated security response
- `"Policy violation"` - Misuse of token

---

## Usage Monitoring

### Get Token Statistics

```bash
curl https://your-worker.workers.dev/admin/stats?userId=user@agile6.com \
  -H "Cookie: session=YOUR_SESSION_COOKIE"
```

Response:
```json
{
  "success": true,
  "userId": "user@agile6.com",
  "stats": {
    "totalTokens": 5,
    "activeTokens": 3,
    "revokedTokens": 2,
    "totalUsage": 1247,
    "mostRecentUse": "2025-11-21T09:45:00.000Z",
    "tokenBreakdown": [
      {
        "tokenId": "tok_abc123",
        "description": "Laptop",
        "usageCount": 847,
        "lastUsed": "2025-11-21T09:45:00.000Z"
      },
      {
        "tokenId": "tok_def456",
        "description": "CI/CD",
        "usageCount": 400,
        "lastUsed": "2025-11-20T22:15:00.000Z"
      }
    ]
  }
}
```

### Monitor Token Activity

**Real-time Monitoring** (using Cloudflare Logs):

```bash
wrangler tail --format=pretty
```

Look for:
```
[Tango MCP] Authentication successful: mcp-token
[Tango MCP] User: MCP Token (tok_abc123...)
[Tango MCP] Tool: search_tango_contracts
```

**Historical Analysis** (using Cloudflare Analytics):

1. Go to Cloudflare Dashboard → Workers → tango-mcp
2. Navigate to "Analytics" or "Logs"
3. Filter by:
   - Time range
   - HTTP status codes (401 = auth failures)
   - IP addresses

### Usage Alerts

**Set up alerts for**:

1. **Unusual usage patterns**:
   - Token used from new IP address
   - Spike in API calls
   - Token used outside business hours

2. **Security events**:
   - Multiple failed authentication attempts
   - Token used from multiple IPs simultaneously
   - Revoked token usage attempts

3. **Operational issues**:
   - Token approaching expiration
   - User has too many active tokens
   - No token usage for extended period

### Example: Check for Unused Tokens

```bash
# List all tokens with last used date
curl https://your-worker.workers.dev/admin/tokens/all \
  -H "Cookie: session=YOUR_SESSION_COOKIE" | \
  jq '.tokens[] | select(.lastUsedAt == null or (.lastUsedAt | fromdateiso8601) < (now - 7776000))'
  # 7776000 = 90 days in seconds
```

---

## Security Operations

### Incident Response Procedures

#### Token Compromise Detected

```bash
# 1. Immediately revoke the compromised token
curl -X POST https://your-worker.workers.dev/admin/tokens/{tokenId}/revoke \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Security incident - token compromised"}'

# 2. Generate a replacement token
curl -X POST https://your-worker.workers.dev/admin/tokens \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user@agile6.com",
    "description": "Replacement token for compromised tok_abc123"
  }'

# 3. Notify the user
# [Send secure communication with new token]

# 4. Investigate usage
curl https://your-worker.workers.dev/admin/tokens/{tokenId} \
  -H "Cookie: session=YOUR_SESSION_COOKIE"
# Check lastUsedFromIp, usageCount for anomalies

# 5. Document the incident
# [Record in security log/ticket system]
```

#### Suspicious Activity Detected

```bash
# 1. Get token details
curl https://your-worker.workers.dev/admin/tokens/{tokenId} \
  -H "Cookie: session=YOUR_SESSION_COOKIE"

# 2. Check recent activity in Cloudflare logs
wrangler tail --format=pretty

# 3. Contact the user
# Verify if activity was legitimate

# 4. If suspicious, revoke
curl -X POST https://your-worker.workers.dev/admin/tokens/{tokenId}/revoke \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Suspicious activity detected"}'
```

### Regular Security Maintenance

**Weekly Tasks**:
- Review authentication logs for anomalies
- Check for unused tokens (> 30 days)
- Verify active token count per user

**Monthly Tasks**:
- Review all active tokens
- Rotate admin access tokens
- Update documentation

**Quarterly Tasks**:
- Review token expiration policy
- Audit token usage patterns
- Conduct security training for users
- Update incident response procedures

### Token Rotation Policy

**Recommended Policy**:

1. **Standard tokens**: 365-day expiration (enforced by `MCP_TOKEN_EXPIRY_DAYS`)
2. **High-privilege tokens**: 180-day expiration
3. **Rotation notice**: 30 days before expiration
4. **Grace period**: 7 days after expiration before forced revocation

**Rotation Process**:

```bash
# 1. Generate new token
NEW_TOKEN=$(curl -X POST https://your-worker.workers.dev/admin/tokens \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user@agile6.com",
    "description": "Rotated token (replaces tok_old123)"
  }' | jq -r '.token')

# 2. Send to user with instructions
echo "New token: $NEW_TOKEN"

# 3. Wait for user to confirm they've updated configuration
# (Give 7-day grace period)

# 4. Revoke old token
curl -X POST https://your-worker.workers.dev/admin/tokens/tok_old123/revoke \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Token rotation"}'
```

---

## Troubleshooting

### Common Issues

#### Issue: Token generation fails

**Symptoms**: API returns error when generating token

**Possible Causes**:
- OAUTH_KV not configured
- Admin not authenticated
- Invalid userId format

**Debugging Steps**:
```bash
# 1. Check environment
curl https://your-worker.workers.dev/health

# Should show:
# "mcp_token_system_enabled": true

# 2. Verify admin access
curl https://your-worker.workers.dev/admin/verify \
  -H "Cookie: session=YOUR_SESSION_COOKIE"

# 3. Check Cloudflare logs
wrangler tail --format=pretty
```

#### Issue: Token validation fails but token exists

**Symptoms**: Users report "Token not found" but admin can see token

**Possible Causes**:
- Token hash mismatch
- KV replication delay
- Token was revoked

**Debugging Steps**:
```bash
# 1. Check token status
curl https://your-worker.workers.dev/admin/tokens/{tokenId} \
  -H "Cookie: session=YOUR_SESSION_COOKIE"

# Verify "status": "active" (not "revoked")

# 2. Check KV consistency
wrangler kv:list --namespace-id={OAUTH_KV_ID} --prefix="token:hash:"

# 3. Have user re-copy token (might have extra spaces/newlines)
```

#### Issue: High token usage suddenly

**Symptoms**: Usage stats show spike in API calls

**Investigating**:
```bash
# 1. Get token details
curl https://your-worker.workers.dev/admin/tokens/{tokenId} \
  -H "Cookie: session=YOUR_SESSION_COOKIE"

# 2. Check IP addresses
# Look at lastUsedFromIp and compare to expected

# 3. Check Cloudflare analytics for:
# - Geographic location of requests
# - Time distribution (automated = evenly distributed)
# - Tool usage patterns

# 4. Contact user to verify
```

### Emergency Procedures

#### Emergency: Revoke All Tokens

```bash
# Get list of all users
ALL_USERS=$(curl https://your-worker.workers.dev/admin/users \
  -H "Cookie: session=YOUR_SESSION_COOKIE" | jq -r '.users[]')

# Revoke all tokens for each user
for user in $ALL_USERS; do
  curl -X POST https://your-worker.workers.dev/admin/tokens/revoke-all \
    -H "Cookie: session=YOUR_SESSION_COOKIE" \
    -H "Content-Type: application/json" \
    -d "{\"userId\":\"$user\",\"reason\":\"Emergency: Security incident\"}"
done
```

#### Emergency: Rotate Tango API Key

```bash
# 1. Generate new Tango API key at tango.makegov.com

# 2. Update Cloudflare secret
wrangler secret put TANGO_API_KEY
# [Paste new key]

# 3. Verify deployment
curl https://your-worker.workers.dev/health

# 4. Test with a tool
# [Use OAuth to authenticate and try a tool]

# 5. Communicate downtime window to users
# [Send notification]
```

---

## Best Practices

### Token Management

1. **One token per device/purpose**
   - Users should have separate tokens for laptop, CI/CD, etc.
   - Easier to track and revoke if needed

2. **Descriptive token names**
   - Good: "Johns MacBook Pro", "Production CI/CD pipeline"
   - Bad: "Token 1", "Test", "Temp"

3. **Regular audits**
   - Review active tokens monthly
   - Remove unused tokens
   - Verify users still need their tokens

4. **Document everything**
   - Keep records of why each token was created
   - Log all revocations with reasons
   - Track token rotation schedule

### Security

5. **Principle of least privilege**
   - Only generate tokens when necessary
   - Revoke tokens when no longer needed
   - Don't create "just in case" tokens

6. **Secure distribution**
   - Never email tokens in plaintext
   - Use encrypted channels
   - Verify recipient identity

7. **Monitor actively**
   - Set up alerts for suspicious activity
   - Review logs regularly
   - Investigate anomalies promptly

8. **Incident response ready**
   - Have revocation procedures documented
   - Know how to quickly revoke all tokens
   - Practice incident response

### User Education

9. **Train users on security**
   - Explain token importance
   - Show how to store securely
   - Emphasize never sharing tokens

10. **Clear documentation**
    - Keep AUTHENTICATION.md up-to-date
    - Provide setup examples
    - Include troubleshooting guides

11. **Responsive support**
    - Answer token requests quickly
    - Help users troubleshoot issues
    - Be available for emergencies

### Operational Excellence

12. **Automate when possible**
    - Script common tasks
    - Set up automated alerts
    - Use monitoring dashboards

13. **Track metrics**
    - Token generation rate
    - Token usage patterns
    - Revocation frequency
    - Time to respond to incidents

14. **Continuous improvement**
    - Review procedures quarterly
    - Update based on incidents
    - Incorporate user feedback

---

## Additional Resources

- **User Guide**: [AUTHENTICATION.md](../AUTHENTICATION.md)
- **OAuth Setup**: [MULTI_CLIENT_OAUTH_SETUP.md](../../working_documents/MULTI_CLIENT_OAUTH_SETUP.md)
- **README**: [README.md](../README.md)
- **Implementation Report**: [03-mcp-token-implementation.md](../../working_documents/auth2_implementation/03-mcp-token-implementation.md)

---

## Appendix: API Reference

### Admin Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/admin/verify` | GET | Verify admin access |
| `/admin/tokens` | POST | Generate new token |
| `/admin/tokens?userId={userId}` | GET | List user's tokens |
| `/admin/tokens/{tokenId}` | GET | Get token details |
| `/admin/tokens/{tokenId}` | PATCH | Update token description |
| `/admin/tokens/{tokenId}` | DELETE | Delete token permanently |
| `/admin/tokens/{tokenId}/revoke` | POST | Revoke token |
| `/admin/tokens/{tokenId}/unrevoke` | POST | Un-revoke token |
| `/admin/tokens/revoke-all` | POST | Revoke all user tokens |
| `/admin/stats?userId={userId}` | GET | Get usage statistics |

All endpoints require:
- OAuth authentication (admin @agile6.com account)
- Session cookie
- Admin email in `ADMIN_EMAILS` environment variable

---

**Last Updated**: November 21, 2025
**Version**: 1.0
**Maintainer**: Tango MCP Administrator
