# Staging Environment Setup - COMPLETE ✅

**Status:** Staging environment configured and deployed (current master code, no auth changes yet)

**Staging URL:** https://staging.marketanalyst.a6lab.ai

---

## What Was Done

### 1. ✅ Saved Auth Work to Feature Branch
- All Gateway Model authentication code committed to `feature/gateway-model-auth`
- 8,540 lines added (code + tests + docs)
- Branch is safe and ready to deploy later

### 2. ✅ Created Staging KV Namespaces
- **TANGO_CACHE_STAGING**: `ded9f8a667d54380889231c8395a71e6`
- **OAUTH_KV_STAGING**: `17063974a638417bb4fe9ac06216e666`

### 3. ✅ Updated wrangler.jsonc
Added staging environment configuration with:
- Custom domain: `staging.marketanalyst.a6lab.ai`
- Staging-specific KV namespaces
- Same variables as production
- Durable Objects and migrations

### 4. ✅ Deployed to Staging
- Worker name: `tango-mcp-staging` (separate from production)
- Deployed current master code (OAuth working, no Gateway Model changes)
- Custom domain configured: `staging.marketanalyst.a6lab.ai`
- Version ID: `0de187e3-d18e-414a-b1e2-db450685b19e`

### 5. ✅ Set One Secret
- `COOKIE_ENCRYPTION_KEY`: Set (staging-specific value)

---

## What YOU Need to Do Next

### Step 1: Wait for SSL Certificate (2-5 minutes)

Cloudflare is provisioning an SSL certificate for `staging.marketanalyst.a6lab.ai`. This typically takes 2-5 minutes.

**Check status:**
```bash
# Try this every minute until it works
curl https://staging.marketanalyst.a6lab.ai/health

# When SSL is ready, you'll see JSON response instead of SSL error
```

### Step 2: Set Remaining Secrets

You need to set 3 more secrets for staging. Run these commands:

```bash
# Set Tango API Key
wrangler secret put TANGO_API_KEY --env staging
# Paste your Tango API key when prompted (can use same as production)

# Set Google OAuth Client ID
wrangler secret put GOOGLE_CLIENT_ID --env staging
# Paste your Google OAuth Client ID

# Set Google OAuth Client Secret
wrangler secret put GOOGLE_CLIENT_SECRET --env staging
# Paste your Google OAuth Client Secret
```

**Or run the automated script:**
```bash
cd /Users/mikec/Tango-MCP/tango-mcp
./set-staging-secrets.sh
```

### Step 3: Update Google OAuth Redirect URI

Add staging callback to your Google OAuth configuration:

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Find your OAuth 2.0 Client (the one you use for production)
3. Click **Edit**
4. Under **Authorized redirect URIs**, click **+ ADD URI**
5. Add: `https://staging.marketanalyst.a6lab.ai/callback`
6. Click **Save**

### Step 4: Test Staging

Once SSL is ready and secrets are set:

```bash
# Test health endpoint
curl https://staging.marketanalyst.a6lab.ai/health | jq

# Should see:
{
  "status": "healthy",
  "service": "tango-mcp",
  "version": "1.0.0",
  "oauth_configured": true  # After you set secrets
}
```

**Test OAuth flow:**
1. Clear OAuth cache: `rm -rf ~/.mcp-auth/`
2. Add staging to Claude Code:
   ```bash
   claude mcp add --transport sse tango-staging https://staging.marketanalyst.a6lab.ai/sse
   ```
3. In Claude Code: `/mcp` → Should open browser → OAuth → Approve → Works!
4. Test a tool: "Use tango-staging to search for contracts awarded to Agile Six"

---

## Current Environment Status

| Environment | Worker Name | Domain | Branch | Auth Code |
|-------------|-------------|--------|--------|-----------|
| **Production** | tango-mcp | marketanalyst.a6lab.ai | master | Current (with OAuth) |
| **Staging** | tango-mcp-staging | staging.marketanalyst.a6lab.ai | master | Current (with OAuth) |
| **Feature Branch** | (not deployed) | N/A | feature/gateway-model-auth | Gateway Model (ready) |

---

## Secrets Status

| Secret | Production | Staging |
|--------|------------|---------|
| COOKIE_ENCRYPTION_KEY | ✅ Set | ✅ Set (staging-specific) |
| TANGO_API_KEY | ✅ Set | ⏳ YOU NEED TO SET |
| GOOGLE_CLIENT_ID | ✅ Set | ⏳ YOU NEED TO SET |
| GOOGLE_CLIENT_SECRET | ✅ Set | ⏳ YOU NEED TO SET |

---

## Deploying Auth Changes to Staging (Later)

When you're ready to deploy the Gateway Model authentication to staging:

```bash
# Switch to the feature branch
git checkout feature/gateway-model-auth

# Deploy to staging
wrangler deploy --env staging

# Test the new auth system
# (Follow STAGING-TEST-PLAN.md)

# If it works, deploy to production:
git checkout master
git merge feature/gateway-model-auth
wrangler deploy
```

---

## Files Modified on Master

- ✅ `wrangler.jsonc` - Added staging environment config
- ✅ `set-staging-secrets.sh` - Script to set secrets (created)

**Commit message:**
```bash
git add wrangler.jsonc set-staging-secrets.sh
git commit -m "Add staging environment configuration

- Configure staging.marketanalyst.a6lab.ai custom domain
- Create staging KV namespaces (separate from production)
- Add staging environment to wrangler.jsonc
- Add script to set staging secrets

Staging worker deployed: tango-mcp-staging"
```

---

## Architecture: How Environments Work

```
wrangler.jsonc (config file)
├── Default config (used by production)
│   ├── name: "tango-mcp"
│   ├── KV: production namespaces
│   └── No routes (deployed to workers.dev or custom domain via portal)
│
└── env.staging (staging environment)
    ├── Creates worker: "tango-mcp-staging"
    ├── Routes: staging.marketanalyst.a6lab.ai
    ├── KV: staging-specific namespaces
    └── Variables: Can override defaults
```

**Key Points:**
- Each environment is a **separate Worker** in Cloudflare
- Staging = `tango-mcp-staging`
- Production = `tango-mcp`
- They share the same code but have different configs
- Secrets, KV data, and domains are isolated

---

## Troubleshooting

### SSL Error (LibreSSL handshake failure)
**Status:** Normal during initial setup
**Fix:** Wait 2-5 minutes for SSL provisioning, then retry

### "Worker not found" or 404
**Fix:** Verify deployment with `wrangler deployments list --env staging`

### OAuth "redirect_uri_mismatch"
**Fix:** Add `https://staging.marketanalyst.a6lab.ai/callback` to Google OAuth config

### Health endpoint shows oauth_configured: false
**Fix:** Set the 3 remaining secrets (TANGO_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)

---

## Quick Reference Commands

```bash
# Deploy to staging
wrangler deploy --env staging

# Deploy to production
wrangler deploy

# View staging logs
wrangler tail --env staging

# View production logs
wrangler tail

# List staging secrets
wrangler secret list --env staging

# Set staging secret
wrangler secret put SECRET_NAME --env staging

# Switch branches
git checkout master                    # Current production code
git checkout feature/gateway-model-auth # Auth changes ready to deploy
```

---

## Next Steps Summary

1. ⏳ **Wait 2-5 minutes** for SSL certificate
2. 🔐 **Set 3 secrets** (TANGO_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
3. 🔗 **Add staging callback** to Google OAuth config
4. ✅ **Test staging** - OAuth flow and tools
5. 🚀 **Later: Deploy auth code** from feature branch

---

**Everything is ready!** The staging environment is configured and deployed with your current production code. Once SSL provisions and you set the secrets, you can test it fully before deploying the Gateway Model authentication changes.
