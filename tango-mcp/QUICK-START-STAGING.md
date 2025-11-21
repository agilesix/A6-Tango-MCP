# Staging Environment - Quick Start Guide

## ✅ What's Complete

Your staging environment is **LIVE** at: https://staging.marketanalyst.a6lab.ai

- ✅ Staging Worker deployed (`tango-mcp-staging`)
- ✅ Custom domain configured and SSL provisioned
- ✅ Staging KV namespaces created
- ✅ Current production code deployed (OAuth working, no Gateway Model changes yet)
- ✅ COOKIE_ENCRYPTION_KEY set

## ⏳ What You Need to Do (5 minutes)

### 1. Set Remaining Secrets

Run this automated script:
```bash
cd /Users/mikec/Tango-MCP/tango-mcp
./set-staging-secrets.sh
```

Or set manually:
```bash
# Set each secret when prompted
wrangler secret put TANGO_API_KEY --env staging
wrangler secret put GOOGLE_CLIENT_ID --env staging
wrangler secret put GOOGLE_CLIENT_SECRET --env staging
```

### 2. Add Staging Callback to Google OAuth

1. Go to: https://console.cloud.google.com/apis/credentials
2. Edit your OAuth 2.0 Client
3. Under **Authorized redirect URIs**, click **+ ADD URI**
4. Add: `https://staging.marketanalyst.a6lab.ai/callback`
5. Click **Save**

### 3. Test Staging

```bash
# Verify health
curl https://staging.marketanalyst.a6lab.ai/health | jq

# Should show oauth_configured: true after you set secrets
```

Then test OAuth flow:
```bash
# Clear cache
rm -rf ~/.mcp-auth/

# Add to Claude Code
claude mcp add --transport sse tango-staging https://staging.marketanalyst.a6lab.ai/sse

# In Claude Code: /mcp
# Should open browser → OAuth → Success
```

---

## 🚀 Later: Deploy Gateway Model Auth to Staging

When you're ready to test the new authentication system:

```bash
# Switch to feature branch with auth changes
git checkout feature/gateway-model-auth

# Deploy to staging
wrangler deploy --env staging

# Test (follow STAGING-TEST-PLAN.md)
# If successful, merge to master and deploy to production
```

---

## 📊 Environment Status

| Environment | Worker | Domain | Branch | Status |
|-------------|--------|--------|--------|--------|
| **Production** | tango-mcp | marketanalyst.a6lab.ai | master | Running |
| **Staging** | tango-mcp-staging | staging.marketanalyst.a6lab.ai | master | **Ready - needs secrets** |
| **Feature** | (not deployed) | N/A | feature/gateway-model-auth | Ready to deploy |

---

## 🔐 Secrets Status

| Secret | Production | Staging |
|--------|------------|---------|
| COOKIE_ENCRYPTION_KEY | ✅ | ✅ |
| TANGO_API_KEY | ✅ | **⏳ YOU NEED TO SET** |
| GOOGLE_CLIENT_ID | ✅ | **⏳ YOU NEED TO SET** |
| GOOGLE_CLIENT_SECRET | ✅ | **⏳ YOU NEED TO SET** |

---

## 📚 Full Documentation

- **STAGING-SETUP-COMPLETE.md** - Detailed explanation of what was configured
- **STAGING-TEST-PLAN.md** - Complete testing guide for Gateway Model auth (use later)
- **CLOUDFLARE-STAGING-SETUP.md** - Portal walkthrough (reference)

---

## 🆘 Troubleshooting

**OAuth redirect_uri_mismatch?**
→ Add `https://staging.marketanalyst.a6lab.ai/callback` to Google OAuth config

**Health shows oauth_configured: false?**
→ Set the 3 secrets: TANGO_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

**Worker not found?**
→ Verify deployment: `wrangler deployments list --env staging`

---

**You're 5 minutes away from a working staging environment!** 🎉
