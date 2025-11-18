# Deployment Guide - Tango MCP Server

This guide provides step-by-step instructions for deploying the Tango MCP server to Cloudflare Workers.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [KV Namespace Configuration](#kv-namespace-configuration)
- [Secrets Management](#secrets-management)
- [Environment Configuration](#environment-configuration)
- [Deployment Process](#deployment-process)
- [Post-Deployment Verification](#post-deployment-verification)
- [Troubleshooting](#troubleshooting)
- [Monitoring and Observability](#monitoring-and-observability)
- [Rollback Procedures](#rollback-procedures)

## Prerequisites

Before deploying, ensure you have:

- **Cloudflare Account**: Sign up at [https://dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)
- **Wrangler CLI**: Install globally
  ```bash
  npm install -g wrangler@latest
  ```
- **Tango API Key**: Obtain from [MakeGov](https://www.makegov.com)
- **Node.js 18+**: Verify version
  ```bash
  node --version  # Should be v18.0.0 or higher
  ```

### Authenticate with Cloudflare

```bash
wrangler login
```

This will open a browser window for authentication. Follow the prompts to authorize Wrangler.

## Initial Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd tango-mcp
npm install
```

### 2. Verify Project Structure

```bash
npm run validate
```

Expected output:
```
✓ Project structure valid
✓ All tools registered
✓ Tests configured
```

### 3. Run Tests Locally

```bash
npm run test:unit
```

Ensure all tests pass before deploying.

## KV Namespace Configuration

Cloudflare KV (Key-Value) storage is used for caching API responses.

### Create KV Namespace

```bash
wrangler kv:namespace create "TANGO_CACHE"
```

**Output:**
```
✨ Created KV namespace TANGO_CACHE with ID: abc123def456
```

**Important**: Save the namespace ID for the next step.

### Create Preview Namespace (Optional)

For development/testing:

```bash
wrangler kv:namespace create "TANGO_CACHE" --preview
```

### Update wrangler.toml

Edit `wrangler.toml` with your namespace IDs:

```toml
name = "tango-mcp"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[kv_namespaces]]
binding = "TANGO_CACHE"
id = "abc123def456"  # Replace with your production namespace ID
preview_id = "xyz789uvw123"  # Replace with your preview namespace ID (optional)

[vars]
TANGO_API_BASE_URL = "https://tango.makegov.com/api"
```

### Verify KV Namespace

```bash
wrangler kv:namespace list
```

You should see your `TANGO_CACHE` namespace in the list.

## Secrets Management

Secrets are encrypted and never exposed in logs or configuration files.

### Set Tango API Key

```bash
wrangler secret put TANGO_API_KEY
```

You'll be prompted to enter your API key:
```
Enter a secret value: **********************
✨ Success! Uploaded secret TANGO_API_KEY
```

### Verify Secret (Production)

```bash
wrangler secret list
```

Expected output:
```
{
  "TANGO_API_KEY": "Set on 2025-11-18"
}
```

**Note**: Secret values are never displayed, only confirmation that they exist.

### Environment-Specific Secrets

For multiple environments:

```bash
# Production
wrangler secret put TANGO_API_KEY --env production

# Staging
wrangler secret put TANGO_API_KEY --env staging
```

## Environment Configuration

### wrangler.toml Structure

Complete `wrangler.toml` example:

```toml
name = "tango-mcp"
main = "src/index.ts"
compatibility_date = "2024-01-01"
workers_dev = true

# KV Namespace for caching
[[kv_namespaces]]
binding = "TANGO_CACHE"
id = "YOUR_PRODUCTION_KV_ID"
preview_id = "YOUR_PREVIEW_KV_ID"

# Environment variables (non-secret)
[vars]
TANGO_API_BASE_URL = "https://tango.makegov.com/api"

# Production environment
[env.production]
name = "tango-mcp-production"
workers_dev = false
routes = [
  { pattern = "api.yourdomain.com/mcp/*", zone_name = "yourdomain.com" }
]

# Staging environment
[env.staging]
name = "tango-mcp-staging"
workers_dev = false
routes = [
  { pattern = "staging-api.yourdomain.com/mcp/*", zone_name = "yourdomain.com" }
]
```

### Custom Domain Setup (Optional)

1. **Add route in wrangler.toml** (see above)
2. **Verify DNS**: Ensure your domain is managed by Cloudflare
3. **Deploy with route**:
   ```bash
   wrangler deploy --env production
   ```

## Deployment Process

### Development Deployment

Test in Cloudflare's development environment:

```bash
npm run dev
```

Access at: `http://localhost:8787`

### Production Deployment

#### Step 1: Pre-Deployment Checks

```bash
# Run all tests
npm test

# Validate configuration
npm run validate

# Build project (TypeScript compilation)
npm run build
```

#### Step 2: Deploy

```bash
npm run deploy
```

Or directly with Wrangler:

```bash
wrangler deploy
```

**Output:**
```
Total Upload: 245.67 KiB / gzip: 62.34 KiB
Uploaded tango-mcp (2.5 sec)
Published tango-mcp (0.25 sec)
  https://tango-mcp.your-subdomain.workers.dev
Current Deployment ID: abc123def456
```

#### Step 3: Note Deployment URL

Save the deployment URL from the output. You'll need it for verification.

### Environment-Specific Deployment

Deploy to staging:
```bash
wrangler deploy --env staging
```

Deploy to production:
```bash
wrangler deploy --env production
```

## Post-Deployment Verification

### 1. Health Check

Verify the server is running:

```bash
curl https://tango-mcp.your-subdomain.workers.dev/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-18T10:30:00Z",
  "services": {
    "tango_api": "reachable",
    "cache_kv": "available"
  }
}
```

### 2. Test Tool Invocation

Test a simple tool:

```bash
curl -X POST https://tango-mcp.your-subdomain.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "search_tango_contracts",
    "args": {
      "query": "IT services",
      "limit": 5
    }
  }'
```

Verify you receive valid JSON response with contract data.

### 3. Verify Caching

Make the same request twice:

```bash
# First request (cache miss)
time curl -X POST https://tango-mcp.your-subdomain.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{"tool": "search_tango_contracts", "args": {"limit": 1}}'

# Second request (cache hit - should be faster)
time curl -X POST https://tango-mcp.your-subdomain.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{"tool": "search_tango_contracts", "args": {"limit": 1}}'
```

Check the `execution.cached` field in responses.

### 4. Verify Logging

View live logs:

```bash
wrangler tail
```

Make a request and confirm logs appear in JSON format.

### 5. Check KV Storage

List keys in KV namespace:

```bash
wrangler kv:key list --namespace-id=YOUR_KV_ID
```

After making requests, you should see cache keys.

## Troubleshooting

### Common Deployment Issues

#### Issue 1: Authentication Error

```
Error: Not authenticated. Run 'wrangler login' first.
```

**Solution:**
```bash
wrangler logout
wrangler login
```

#### Issue 2: KV Namespace Not Found

```
Error: KV namespace with ID 'abc123' not found
```

**Solution:**
1. Verify namespace exists:
   ```bash
   wrangler kv:namespace list
   ```
2. Update `wrangler.toml` with correct ID
3. Redeploy

#### Issue 3: Secret Not Set

```
Error: TANGO_API_KEY is not defined
```

**Solution:**
```bash
wrangler secret put TANGO_API_KEY
```

#### Issue 4: TypeScript Compilation Errors

```
Error: TypeScript compilation failed
```

**Solution:**
```bash
npm run build
# Fix any TypeScript errors shown
npm run deploy
```

#### Issue 5: Deployment Size Limit

```
Error: Script too large (>1MB)
```

**Solution:**
1. Check for large dependencies
2. Remove unused imports
3. Consider code splitting

#### Issue 6: Rate Limiting from Cloudflare

```
Error: Too many requests (429)
```

**Solution:**
- Wait 60 seconds between deployments
- Use `wrangler dev` for rapid testing

### Debugging Deployment

#### Enable Verbose Logging

```bash
wrangler deploy --log-level debug
```

#### Check Worker Status

```bash
wrangler deployments list
```

#### View Recent Errors

```bash
wrangler tail --format pretty
```

## Monitoring and Observability

### Real-Time Logs

Stream logs from your Worker:

```bash
wrangler tail --format json
```

Filter for errors only:

```bash
wrangler tail | grep "error"
```

### Cloudflare Dashboard

Access detailed analytics:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to Workers > Your Worker
3. View:
   - Request count
   - Error rate
   - Latency percentiles (P50, P95, P99)
   - Bandwidth usage

### Key Metrics to Monitor

- **Request Success Rate**: Should be >95%
- **P50 Latency (uncached)**: <1000ms
- **P50 Latency (cached)**: <200ms
- **Error Rate**: <5%
- **Cache Hit Rate**: >70%

### Alerting Setup (Optional)

Configure Workers Analytics Engine for custom metrics:

```typescript
// In src/index.ts
env.ANALYTICS?.writeDataPoint({
  blobs: ['search_contracts'],
  doubles: [duration],
  indexes: [cached ? 'hit' : 'miss']
});
```

### Log Analysis

Parse structured JSON logs:

```bash
wrangler tail --format json | jq '.message | fromjson'
```

Filter by log level:

```bash
wrangler tail --format json | jq 'select(.message | fromjson | .level == "error")'
```

## Rollback Procedures

### Quick Rollback

#### Option 1: Rollback to Previous Deployment

```bash
wrangler rollback
```

This reverts to the previous deployment immediately.

#### Option 2: Deploy Specific Version

```bash
# List recent deployments
wrangler deployments list

# Deploy specific version
wrangler versions deploy <version-id>
```

### Emergency Procedures

#### Disable Worker

If critical issues occur:

```bash
wrangler delete
```

Re-enable by redeploying when fixed.

#### Route Traffic to Backup

If you have a backup worker:

1. Update routes in Cloudflare Dashboard
2. Point traffic to backup worker
3. Fix and redeploy main worker
4. Restore routes

### Gradual Rollout (Canary Deployment)

Test new version with limited traffic:

```bash
# Deploy to staging first
wrangler deploy --env staging

# Test thoroughly on staging

# Deploy to production with gradual rollout
wrangler versions deploy --percentage 10  # 10% of traffic
# Monitor for 1 hour
wrangler versions deploy --percentage 50  # 50% of traffic
# Monitor for 1 hour
wrangler versions deploy --percentage 100 # Full rollout
```

## Performance Optimization

### Reduce Cold Starts

- Keep worker warm with periodic health checks
- Minimize dependencies
- Use dynamic imports for large modules

### Optimize KV Usage

- Set appropriate TTLs (current: 5 minutes)
- Use cache keys efficiently
- Monitor KV read/write operations

### Monitor Bundle Size

```bash
wrangler deploy --dry-run
```

Check "Total Upload" size. Aim for <500KB.

## Security Best Practices

1. **Never commit secrets**: Always use `wrangler secret put`
2. **Rotate API keys**: Change `TANGO_API_KEY` periodically
3. **Use environment-specific secrets**: Different keys for staging/production
4. **Monitor for suspicious activity**: Check logs for unusual patterns
5. **Enable rate limiting**: Protect against abuse (already implemented)

## Deployment Checklist

Before each production deployment:

- [ ] All tests pass (`npm test`)
- [ ] Configuration validated (`npm run validate`)
- [ ] Secrets are set (`wrangler secret list`)
- [ ] KV namespace exists and is configured
- [ ] `wrangler.toml` is correct
- [ ] Health check passes on staging
- [ ] Tools tested on staging
- [ ] Monitoring is active
- [ ] Rollback plan ready
- [ ] Team notified of deployment

## Support and Resources

- **Cloudflare Workers Docs**: [https://developers.cloudflare.com/workers/](https://developers.cloudflare.com/workers/)
- **Wrangler CLI Docs**: [https://developers.cloudflare.com/workers/wrangler/](https://developers.cloudflare.com/workers/wrangler/)
- **Cloudflare Status**: [https://www.cloudflarestatus.com/](https://www.cloudflarestatus.com/)
- **Community**: [Cloudflare Discord](https://discord.gg/cloudflaredev)

## Appendix

### wrangler.toml Complete Reference

```toml
# Worker configuration
name = "tango-mcp"
main = "src/index.ts"
compatibility_date = "2024-01-01"
workers_dev = true

# Resource limits
limits = { cpu_ms = 30000 }

# KV Namespaces
[[kv_namespaces]]
binding = "TANGO_CACHE"
id = "production-kv-id"
preview_id = "preview-kv-id"

# Environment variables (non-secret)
[vars]
TANGO_API_BASE_URL = "https://tango.makegov.com/api"
LOG_LEVEL = "info"

# Build configuration
[build]
command = "npm run build"

[build.upload]
format = "service-worker"

# Production environment
[env.production]
name = "tango-mcp-production"
workers_dev = false

[env.production.vars]
LOG_LEVEL = "warn"

# Staging environment
[env.staging]
name = "tango-mcp-staging"
workers_dev = false

[env.staging.vars]
LOG_LEVEL = "debug"
```

### Useful Commands Reference

```bash
# Authentication
wrangler login
wrangler logout
wrangler whoami

# Development
wrangler dev                    # Local development server
wrangler dev --remote           # Test on Cloudflare edge

# Deployment
wrangler deploy                 # Deploy to production
wrangler deploy --env staging   # Deploy to staging
wrangler deploy --dry-run       # Preview deployment

# Secrets
wrangler secret put KEY_NAME
wrangler secret list
wrangler secret delete KEY_NAME

# KV Operations
wrangler kv:namespace create NAMESPACE
wrangler kv:namespace list
wrangler kv:key list --namespace-id=ID
wrangler kv:key get KEY --namespace-id=ID
wrangler kv:key put KEY VALUE --namespace-id=ID
wrangler kv:key delete KEY --namespace-id=ID

# Monitoring
wrangler tail                   # Live logs
wrangler tail --format json     # JSON format logs
wrangler deployments list       # List deployments
wrangler versions list          # List versions

# Rollback
wrangler rollback               # Rollback to previous
wrangler versions deploy ID     # Deploy specific version

# Cleanup
wrangler delete                 # Delete worker
```
