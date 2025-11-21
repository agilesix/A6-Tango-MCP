/**
 * Script to generate production MCP access token
 *
 * Usage: npx wrangler dev --remote scripts/generate-prod-token.ts
 */

import { generateMcpAccessToken } from '../src/auth/mcp-token.js';

// Generate token for production use
const userId = "production-claude-code";
const description = "Production MCP token for Claude Code";
const clientIp = "0.0.0.0"; // Placeholder - will be updated on first use
const userAgent = "Claude Code Production";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const result = await generateMcpAccessToken(
        userId,
        description,
        env,
        clientIp,
        userAgent
      );

      return new Response(JSON.stringify({
        success: true,
        token: result.token,
        userId: userId,
        description: description,
        usage: {
          header: "x-mcp-access-token",
          example_staging: `curl -H "x-mcp-access-token: ${result.token}" https://staging.marketanalyst.a6lab.ai/mcp`,
          example_production: `curl -H "x-mcp-access-token: ${result.token}" https://marketanalyst.a6lab.ai/mcp`,
          claude_code: `claude mcp add --transport http tango-production https://marketanalyst.a6lab.ai/mcp --header "x-mcp-access-token: ${result.token}"`
        },
        warning: "Store this token securely - it cannot be retrieved again"
      }, null, 2), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
