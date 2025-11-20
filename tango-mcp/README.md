# Tango MCP Server

A Model Context Protocol (MCP) server providing access to federal procurement and grants data through the Tango API. Built for Cloudflare Workers with KV caching, rate limiting, and comprehensive error handling.

## Overview

This MCP server provides AI agents with access to federal contract awards, grants, vendor profiles, opportunities, and spending analytics from multiple government data sources (FPDS, SAM.gov, USASpending) through a unified Tango API interface.

### Key Features

- **16 Specialized Tools**: Search contracts, grants, opportunities, vendor profiles, spending summaries, forecasts, and more
- **KV Caching**: Cloudflare KV-based caching with 5-minute TTL for improved performance
- **Rate Limiting**: Per-worker rate limiting (100ms between API calls) to prevent overuse
- **Authentication**: Supports both API Key and OAuth (Google) authentication
- **Error Handling**: Comprehensive error types with actionable recovery suggestions
- **Input Sanitization**: Protection against injection attacks and malicious inputs
- **Structured Logging**: JSON-formatted logs for observability and debugging
- **Type Safety**: Full TypeScript with Zod schema validation

## Tools

### 1. search_tango_contracts

Search federal contract awards from FPDS (Federal Procurement Data System).

**Parameters:**
- `query` (optional): Free-text search across contract descriptions
- `vendor_name` (optional): Vendor/contractor name filter
- `vendor_uei` (optional): Unique Entity Identifier (12-character)
- `awarding_agency` (optional): Agency name or code
- `naics_code` (optional): NAICS industry classification (2-6 digits)
- `psc_code` (optional): Product/Service Code
- `award_date_start` (optional): Earliest award date (YYYY-MM-DD)
- `award_date_end` (optional): Latest award date (YYYY-MM-DD)
- `set_aside_type` (optional): Contract set-aside category (SBA, WOSB, SDVOSB, 8A, HUBZone)
- `limit` (optional): Maximum results (default: 10, max: 100)

### 2. search_tango_grants

Search federal grants and financial assistance awards from USASpending.

**Parameters:**
- `query` (optional): Free-text search across grant descriptions
- `agency` (optional): Awarding agency name or code
- `recipient_name` (optional): Recipient organization (client-side filtering)
- `recipient_uei` (optional): Recipient UEI (client-side filtering)
- `cfda_number` (optional): Catalog of Federal Domestic Assistance number
- `posted_date_after` (optional): Earliest posted date (YYYY-MM-DD)
- `posted_date_before` (optional): Latest posted date (YYYY-MM-DD)
- `award_amount_min` (optional): Minimum award amount (client-side filtering)
- `award_amount_max` (optional): Maximum award amount (client-side filtering)
- `limit` (optional): Maximum results (default: 10, max: 100)

### 3. get_tango_vendor_profile

Retrieve comprehensive entity profile from SAM.gov data.

**Parameters:**
- `uei` (required): Unique Entity Identifier (12-character alphanumeric)
- `include_history` (optional): Include recent contract/grant history (default: false)

### 4. search_tango_opportunities

Search federal contract opportunities, forecasts, and solicitation notices.

**Parameters:**
- `query` (optional): Free-text search across opportunity titles/descriptions
- `agency` (optional): Agency name or code
- `naics_code` (optional): NAICS industry classification
- `set_aside_type` (optional): Set-aside category
- `posted_date_after` (optional): Earliest posted date (YYYY-MM-DD)
- `posted_date_before` (optional): Latest posted date (YYYY-MM-DD)
- `response_deadline_after` (optional): Minimum response deadline (YYYY-MM-DD)
- `active` (optional): Filter by active status (true/false)
- `notice_type` (optional): Notice type code (f = forecasted, s = solicitations)
- `limit` (optional): Maximum results (default: 10, max: 100)

### 5. get_tango_spending_summary

Generate aggregated spending analytics from federal contracts and grants.

**Parameters:**
- `awarding_agency` (optional): Agency name or code to filter spending
- `vendor_uei` (optional): Vendor UEI to filter spending
- `fiscal_year` (optional): Fiscal year (YYYY format)
- `award_type` (optional): Type of awards (contracts, grants, all) - default: contracts
- `group_by` (optional): Aggregation dimension (agency, vendor, naics, psc, month) - default: vendor
- `limit` (optional): Maximum records to analyze (default: 100, max: 100)

### 6. search_idvs

Search Indefinite Delivery Vehicles (IDVs) including GWACs, IDIQs, BPAs, and GSA Schedules.

**Parameters:**
- `query` (optional): Free-text search across IDV descriptions
- `recipient_uei` (optional): Unique Entity Identifier
- `recipient_name` (optional): Vendor/contractor name filter
- `idv_type` (optional): IDV type code(s) (A=GWAC, B=IDC/IDIQ, etc.)
- `awarding_agency` (optional): Awarding agency name or code
- `naics_code` (optional): NAICS code(s)
- `psc_code` (optional): Product/Service Code(s)
- `set_aside_type` (optional): Set-aside code(s)
- `award_date_start` (optional): Earliest award date
- `award_date_end` (optional): Latest award date
- `fiscal_year` (optional): Exact fiscal year
- `expiring_after` (optional): Find IDVs expiring after this date
- `limit` (optional): Number of results (default: 10)

### 7. search_subawards

Search federal subawards (subcontracts) from FSRS.

**Parameters:**
- `prime_uei` (optional): Prime contractor UEI
- `sub_uei` (optional): Subcontractor UEI
- `awarding_agency` (optional): Awarding agency name or code
- `recipient` (optional): Recipient name or UEI
- `fiscal_year` (optional): Exact fiscal year
- `limit` (optional): Number of results per page (default: 25)
- `page` (optional): Page number

### 8. get_contract_detail

Get detailed information for a specific federal contract by key/award ID.

**Parameters:**
- `contract_key` (required): Contract key/award ID (e.g., 'CONT_AWD_xxxxx')

### 9. get_grant_detail

Get detailed information for a specific grant opportunity by grant ID.

**Parameters:**
- `grant_id` (required): Numeric grant opportunity ID

### 10. get_opportunity_detail

Get detailed information for a specific contract opportunity by opportunity ID.

**Parameters:**
- `opportunity_id` (required): UUID format opportunity ID

### 11. get_agency_analytics

Generate spending analytics for federal agencies.

**Parameters:**
- `agency_code` (required): Agency code (e.g., 'DOD', 'GSA')
- `fiscal_year` (optional): Fiscal year to filter spending
- `award_type` (optional): Type of awards (default: 'contracts')
- `include_trends` (optional): Include monthly spending trends
- `limit` (optional): Maximum contracts to analyze (default: 100)

### 12. search_forecasts

Search federal procurement forecast opportunities.

**Parameters:**
- `query` (optional): Free-text search
- `agency` (optional): Agency acronym
- `naics_code` (optional): NAICS code(s)
- `fiscal_year` (optional): Exact fiscal year
- `status` (optional): Forecast status
- `limit` (optional): Maximum results (default: 10)

### 13. get_forecast_detail

Get detailed information for a specific forecast by forecast ID.

**Parameters:**
- `forecast_id` (required): Forecast ID (integer or string)

### 14. lookup_agency

Search federal agencies by name, abbreviation, or code.

**Parameters:**
- `query` (required): Search term
- `limit` (optional): Maximum number of agencies (default: 10)

### 15. get_company_intelligence

Get comprehensive company intelligence including AI summary and news.

**Parameters:**
- `company_name` (required): Company name to search for

### 16. health

Check server health and connectivity.

## Installation

### Prerequisites

- Node.js 18+ or compatible runtime
- Cloudflare Workers account
- Wrangler CLI: `npm install -g wrangler`
- Tango API key ([Get one free at tango.makegov.com](https://tango.makegov.com))
- Claude Desktop or another MCP-compatible client

### Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd tango-mcp
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create KV namespace:**
   ```bash
   wrangler kv:namespace create "TANGO_CACHE"
   ```
   Note the namespace ID for configuration.

4. **Configure `wrangler.toml`:**
   ```toml
   name = "tango-mcp"
   main = "src/index.ts"
   compatibility_date = "2024-01-01"

   [[kv_namespaces]]
   binding = "TANGO_CACHE"
   id = "<YOUR_KV_NAMESPACE_ID>"

   [vars]
   TANGO_API_BASE_URL = "https://tango.makegov.com/api"
   ```

5. **Set API key secret (optional):**

   If you want to use a shared API key for all users:
   ```bash
   wrangler secret put TANGO_API_KEY
   # Enter your Tango API key when prompted
   ```

   **OR** skip this step and have each user provide their own API key via Claude Desktop configuration (recommended).

## Development

### Local Development

Run the development server with hot reloading:

```bash
npm run dev
```

The server will be available at `http://localhost:8787`

### Testing

**Run unit tests:**
```bash
npm run test:unit
```

**Run integration tests:**
```bash
npm run test:integration
```

**Run all tests:**
```bash
npm test
```

**Test coverage:**
```bash
npm run test:coverage
```

### Validation

Validate the MCP server configuration:

```bash
npx mcp-server-kit validate
```

## Deployment

### Deploy to Cloudflare Workers

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Deploy:**
   ```bash
   npm run deploy
   ```
   or
   ```bash
   wrangler deploy
   ```

3. **Verify deployment:**
   ```bash
   curl https://your-worker.workers.dev/health
   ```

   Expected response:
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

### Post-Deployment

Monitor your deployment:

```bash
wrangler tail
```

View metrics in the Cloudflare dashboard under Workers > Analytics.

## Using with Claude Desktop

The Tango MCP Server supports **per-user API keys**, allowing each user to configure their own Tango API key in Claude Desktop. This ensures each user gets their own API quota (100 requests/day on the free tier).

### Configuration Steps

1. **Get your Tango API key:**
   - Visit [https://tango.makegov.com](https://tango.makegov.com)
   - Sign up for a free account
   - Copy your API key from the dashboard

2. **Open Claude Desktop configuration:**
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

   Or use Claude Desktop:
   - Open Settings
   - Navigate to "Developer" tab
   - Click "Edit Config"

3. **Add the Tango MCP Server:**
   ```json
   {
     "mcpServers": {
       "tango-mcp": {
         "url": "https://your-worker-name.your-account.workers.dev/sse",
         "headers": {
           "x-tango-api-key": "YOUR_TANGO_API_KEY_HERE"
         }
       }
     }
   }
   ```

   Replace:
   - `your-worker-name.your-account.workers.dev` with your actual Cloudflare Worker URL
   - `YOUR_TANGO_API_KEY_HERE` with your actual Tango API key

4. **Restart Claude Desktop**
   - Completely quit Claude Desktop (not just close the window)
   - Reopen Claude Desktop
   - The Tango MCP Server should now be available

### Verify Connection

In Claude Desktop, ask:
```
Search for IT service contracts awarded by the Department of Defense
```

Claude should use the `search_tango_contracts` tool to fetch results using your API key.

### Alternative: Shared API Key

If you prefer to deploy with a single shared API key (not recommended for production):

```bash
wrangler secret put TANGO_API_KEY
# Enter your Tango API key when prompted
```

Then users can connect without the `headers` configuration:
```json
{
  "mcpServers": {
    "tango-mcp": {
      "url": "https://your-worker.workers.dev/sse"
    }
  }
}
```

**Note**: With a shared key, all users share the same API quota.

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TANGO_API_KEY` | No* | - | Tango API authentication key (secret). *Optional if users provide keys via `x-tango-api-key` header |
| `TANGO_API_BASE_URL` | No | `https://tango.makegov.com/api` | Tango API base URL |
| `TANGO_CACHE` | Yes | - | KV namespace binding for caching |

### Per-User API Keys

Users can provide their own API keys via the `x-tango-api-key` HTTP header. This is configured in Claude Desktop's `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tango-mcp": {
      "url": "https://your-worker.workers.dev/sse",
      "headers": {
        "x-tango-api-key": "user-specific-api-key"
      }
    }
  }
}
```

**Benefits of per-user API keys:**
- Each user gets their own 100 requests/day quota
- No shared rate limit concerns
- Better security (users manage their own credentials)
- Individual usage tracking

**Fallback behavior:**
If no `x-tango-api-key` header is provided, the server falls back to the `TANGO_API_KEY` environment variable.

### KV Namespace

The server uses Cloudflare KV for caching API responses with:
- **TTL**: 5 minutes
- **Strategy**: Cache-aside pattern
- **Keys**: `tool_name:hash(params)`
- **Behavior**: Only successful responses are cached

## Architecture

### Component Overview

```
src/
├── index.ts              # MCP server entry point
├── tools/                # Tool implementations
│   ├── search-contracts.ts
│   ├── search-grants.ts
│   ├── get-vendor-profile.ts
│   ├── search-opportunities.ts
│   ├── get-spending-summary.ts
│   ├── search-idvs.ts
│   ├── search-subawards.ts
│   ├── get-contract-detail.ts
│   ├── get-grant-detail.ts
│   ├── get-opportunity-detail.ts
│   ├── get-agency-analytics.ts
│   ├── search-forecasts.ts
│   ├── get-forecast-detail.ts
│   ├── lookup-agency.ts
│   ├── get-company-intelligence.ts
│   └── health.ts
├── api/                  # Tango API client
│   └── tango-client.ts
├── types/                # TypeScript interfaces
│   ├── env.ts
│   ├── errors.ts
│   ├── tango-api.ts
│   └── tool-args.ts
├── utils/                # Utilities
│   ├── normalizer.ts     # Response normalization
│   ├── rate-limiter.ts   # API rate limiting
│   └── logger.ts         # Structured logging
└── middleware/
    └── sanitization.ts   # Input sanitization
```

### Data Flow

1. **Agent Request** → MCP Server (tool invocation)
2. **Input Sanitization** → Remove malicious patterns
3. **Cache Check** → KV lookup by cache key
4. **API Call** → Tango API (if cache miss)
5. **Rate Limiting** → 100ms delay between calls
6. **Normalization** → Standardize response format
7. **Cache Store** → Save successful responses
8. **Response** → Return to agent with metadata

### Error Handling

All errors include:
- `error_code`: Stable code for programmatic handling
- `error`: Human-readable message
- `suggestion`: Recovery guidance
- `recoverable`: Boolean indicating if retry is possible
- `transient`: Boolean for temporary errors (429, 503)

**Error Types:**
- `MISSING_API_KEY`: API key not configured
- `MISSING_PARAMETER`: Required parameter missing
- `VALIDATION_ERROR`: Invalid parameter format
- `API_ERROR`: Tango API request failed
- `TIMEOUT_ERROR`: Request exceeded 30s timeout
- `INTERNAL_ERROR`: Unexpected server error

## API Documentation

### Tango API Reference

Full API documentation: [Tango API Docs](https://docs.makegov.com)

**Base URL:** `https://tango.makegov.com/api`

**Authentication:** API key in request headers

**Rate Limits:**
- Standard tier: 100 requests/minute
- Enterprise tier: 1000 requests/minute

### Response Format

All tools return responses in this format:

```json
{
  "data": [...],
  "total": 1234,
  "returned": 10,
  "filters": {
    "query": "IT services",
    "limit": 10
  },
  "pagination": {
    "limit": 10,
    "has_more": true
  },
  "execution": {
    "duration_ms": 850,
    "cached": false,
    "api_calls": 1
  }
}
```

## Troubleshooting

### Common Issues

**Issue: Missing API Key Error**
```
Error: MISSING_API_KEY
```
Solution: Either configure your personal API key in Claude Desktop:
```json
{
  "mcpServers": {
    "tango-mcp": {
      "url": "https://your-worker.workers.dev/sse",
      "headers": {
        "x-tango-api-key": "YOUR_API_KEY"
      }
    }
  }
}
```

Or set a shared API key secret (not recommended):
```bash
wrangler secret put TANGO_API_KEY
```

**Issue: Cache Not Working**
```
Error: KV namespace not found
```
Solution: Verify KV namespace binding in `wrangler.toml` matches the created namespace.

**Issue: Rate Limiting (429)**
```
Error: API_ERROR, status: 429
```
Solution: The rate limiter will automatically retry. If persistent, check your API tier limits.

**Issue: Timeout Errors**
```
Error: TIMEOUT_ERROR
```
Solution: Reduce the `limit` parameter or add more specific filters to narrow results.

### Debug Mode

Enable debug logging:

```typescript
import { getLogger } from './utils/logger';

const logger = getLogger('debug');
```

View logs:
```bash
wrangler tail
```

### Health Check

Test server health:

```bash
curl https://your-worker.workers.dev/health
```

Check specific tool:
```bash
curl -X POST https://your-worker.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{"tool": "search_tango_contracts", "args": {"limit": 1}}'
```

## Performance

### Benchmarks

- **P50 Response Time (uncached)**: < 1000ms
- **P50 Response Time (cached)**: < 200ms
- **Cache Hit Rate**: > 70% on repeated queries
- **API Call Rate**: Max 10 calls/second (100ms delay)

### Optimization Tips

1. **Use caching**: Identical queries within 5 minutes are served from cache
2. **Set appropriate limits**: Use `limit` parameter to control result size
3. **Add specific filters**: Narrow queries for faster API responses
4. **Enable history selectively**: Use `include_history` only when needed

## Contributing

### Development Workflow

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes and add tests
3. Run tests: `npm test`
4. Validate: `npx mcp-server-kit validate`
5. Commit: `git commit -m "feat: add my feature"`
6. Push and create PR

### Code Standards

- TypeScript strict mode enabled
- ESLint for code quality
- Prettier for formatting
- 80%+ test coverage required
- All tools must include input sanitization

## License

[Insert your license here]

## Support

- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Documentation**: [Tango API Docs](https://docs.makegov.com)
- **Community**: [Discord/Slack Channel]

## Acknowledgments

- Built with [mcp-server-kit](https://github.com/modelcontextprotocol/mcp-server-kit)
- Powered by [Cloudflare Workers](https://workers.cloudflare.com)
- Data from [Tango API](https://www.makegov.com)
