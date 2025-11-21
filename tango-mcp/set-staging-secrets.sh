#!/bin/bash
# Set staging secrets for tango-mcp-staging Worker
#
# This script sets up all required secrets for the staging environment.
# Run this script and follow the prompts.

echo "=== Setting Staging Secrets ==="
echo ""
echo "This will set secrets for the tango-mcp-staging Worker."
echo "You'll be prompted to enter each secret value."
echo ""

# Cookie encryption key (already generated, unique to staging)
echo "Setting COOKIE_ENCRYPTION_KEY (staging-specific)..."
echo "oeudx6tGSQ1pplDJC7/WmDCJhAw1h6hYbqx5cMFEXtE=" | wrangler secret put COOKIE_ENCRYPTION_KEY --env staging

# Tango API Key
echo ""
echo "Setting TANGO_API_KEY..."
echo "Paste your Tango API key (can be same as production or staging-specific):"
wrangler secret put TANGO_API_KEY --env staging

# Google OAuth Client ID
echo ""
echo "Setting GOOGLE_CLIENT_ID..."
echo "Paste your Google OAuth Client ID:"
wrangler secret put GOOGLE_CLIENT_ID --env staging

# Google OAuth Client Secret
echo ""
echo "Setting GOOGLE_CLIENT_SECRET..."
echo "Paste your Google OAuth Client Secret:"
wrangler secret put GOOGLE_CLIENT_SECRET --env staging

echo ""
echo "=== All secrets set! ==="
echo ""
echo "Verify with: wrangler secret list --env staging"
