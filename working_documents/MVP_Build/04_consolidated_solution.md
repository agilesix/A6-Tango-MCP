# Consolidated Solution Design: Tango MCP Server MVP

**Version**: 1.0
**Date**: 2025-11-18
**Status**: Design Complete - Ready for Architecture Phase

---

## Executive Summary

This document synthesizes research findings into a strategic solution design for a Cloudflare Workers-based Tango MCP server. The approach leverages the proven mcp-server-kit scaffolding framework while adapting successful patterns from the existing capture-mcp-server implementation to the Cloudflare Workers runtime environment.

**Core Strategy**: Build agent-optimized tools that provide discoverable, composable access to federal contracting data through the Tango API, deployed on Cloudflare Workers for global performance and scalability.

**Key Differentiators**:
- Agent-first tool design with discoverability patterns
- Cloudflare Workers runtime for global edge deployment
- KV-based intelligent caching to reduce API calls
- Type-safe implementation throughout
- Production-grade observability from day one

---

## Agent-Optimized Tool Design Principles

### 1. Tool Granularity Philosophy

**Atomic Operations Over Composite Commands**

```
✅ GOOD: search_tango_contracts + get_vendor_profile
❌ BAD: search_contracts_and_get_vendor_details
```

**Rationale**:
- Agents can compose atomic operations into workflows
- Each tool has clear, single responsibility
- Easier for agents to discover and understand capabilities
- Reduces parameter complexity per tool
- Enables flexible workflow patterns

**MVP Tool Set** (5 atomic operations):
1. `search_tango_contracts` - Find contracts by various filters
2. `search_tango_grants` - Find grants and financial assistance
3. `get_tango_vendor_profile` - Detailed entity information
4. `search_tango_opportunities` - Active solicitations and forecasts
5. `get_tango_spending_summary` - Aggregated spending analytics

### 2. Parameter Design for Agent Discoverability

**All Parameters Optional, Well-Documented**

```typescript
// Example: search_tango_contracts
{
  name: "search_tango_contracts",
  description: "Search federal contract awards from FPDS through Tango API. Returns contracts with vendor, agency, and award details. Supports filtering by vendor name/UEI, agency, industry codes (NAICS/PSC), date ranges, and set-aside types.",
  inputSchema: {
    type: "object",
    properties: {
      api_key: {
        type: "string",
        description: "Tango API key. Optional if TANGO_API_KEY environment variable is set."
      },
      query: {
        type: "string",
        description: "Free-text search across contract descriptions and titles. Example: 'IT services' or 'cloud computing'"
      },
      vendor_name: {
        type: "string",
        description: "Vendor/contractor name filter. Case-insensitive partial match. Example: 'Lockheed Martin'"
      },
      vendor_uei: {
        type: "string",
        description: "Unique Entity Identifier (12-character alphanumeric). For exact vendor matching. Example: 'J3RW5C5KVLZ1'"
      },
      awarding_agency: {
        type: "string",
        description: "Agency name or code. Example: 'Department of Defense' or 'DOD'"
      },
      naics_code: {
        type: "string",
        description: "NAICS industry classification code (2-6 digits). Example: '541512' for computer systems design"
      },
      psc_code: {
        type: "string",
        description: "Product/Service Code. Example: 'D302' for IT and telecom"
      },
      award_date_start: {
        type: "string",
        description: "Earliest award date to include (YYYY-MM-DD format). Example: '2024-01-01'"
      },
      award_date_end: {
        type: "string",
        description: "Latest award date to include (YYYY-MM-DD format). Example: '2024-12-31'"
      },
      set_aside_type: {
        type: "string",
        description: "Contract set-aside category. Values: 'SBA' (Small Business), 'WOSB' (Women-Owned), 'SDVOSB' (Service-Disabled Veteran), '8A', 'HUBZone'. Leave empty for all types."
      },
      limit: {
        type: "number",
        description: "Maximum results to return. Default: 10, Maximum: 100. Use smaller values for faster responses."
      }
    },
    required: []  // All optional for maximum agent flexibility
  }
}
```

**Design Principles**:
- **Verbose descriptions**: Include examples, format specifications, and value ranges
- **No required parameters**: Agents can start exploring with minimal information
- **Format hints**: Always specify date formats (YYYY-MM-DD), code lengths (12-char UEI)
- **Value enumerations**: List possible values for categorical parameters
- **Default documentation**: State defaults and maximums explicitly
- **Use case examples**: Show concrete examples of parameter values
- **Semantic naming**: Use domain terms agents understand (vendor_name vs recipient)

### 3. Response Formatting for Agent Consumption

**Structured, Predictable, Contextualized**

```typescript
// Standard response envelope
interface ToolResponse<T> {
  // Primary data
  data: T[];

  // Metadata for context
  total: number;              // Total available results
  returned: number;           // Actual count returned

  // Applied filters (for agent awareness)
  filters: Record<string, any>;

  // Pagination support
  pagination: {
    limit: number;
    has_more: boolean;
    next_cursor?: string;
  };

  // Execution metadata
  execution: {
    duration_ms: number;
    cached: boolean;
    api_calls: number;
  };
}
```

**Benefits for Agents**:
- **Self-describing**: Agent knows what filters were applied
- **Pagination awareness**: Agent can request more results intelligently
- **Performance hints**: Cached responses inform follow-up decisions
- **Data completeness**: `total` vs `returned` shows if results are truncated

### 4. Error Messages for Agent Recovery

**Actionable, Specific, Recovery-Oriented**

```typescript
// ❌ BAD: Generic error
{
  error: "Invalid request"
}

// ✅ GOOD: Actionable error
{
  error: "Missing required parameter: vendor_uei",
  error_code: "MISSING_PARAMETER",
  parameter: "vendor_uei",
  suggestion: "Provide a 12-character Unique Entity Identifier. You can search by vendor name first using search_tango_contracts with vendor_name parameter.",
  recoverable: true
}
```

**Error Categories**:

1. **Authentication Errors** (recoverable)
```typescript
{
  error: "Tango API key required",
  error_code: "MISSING_API_KEY",
  suggestion: "Provide api_key parameter or ensure TANGO_API_KEY environment variable is set",
  recoverable: true
}
```

2. **Validation Errors** (recoverable)
```typescript
{
  error: "Invalid date format for award_date_start",
  error_code: "INVALID_FORMAT",
  parameter: "award_date_start",
  provided: "01/01/2024",
  expected_format: "YYYY-MM-DD",
  example: "2024-01-01",
  recoverable: true
}
```

3. **API Errors** (potentially transient)
```typescript
{
  error: "Tango API returned 429 Too Many Requests",
  error_code: "RATE_LIMITED",
  retry_after_ms: 1000,
  suggestion: "Wait 1 second and retry the request",
  recoverable: true,
  transient: true
}
```

4. **System Errors** (non-recoverable)
```typescript
{
  error: "Request timeout after 30 seconds",
  error_code: "TIMEOUT",
  suggestion: "Try reducing the limit parameter or narrowing your search filters",
  recoverable: false,
  transient: true
}
```

### 5. Tool Descriptions for Capability Communication

**Clear, Comprehensive, Constraint-Aware**

Tool descriptions should answer:
- **What**: What data does this provide?
- **From**: What's the authoritative data source?
- **Capabilities**: What filters/searches are supported?
- **Constraints**: What are the limits?
- **Typical Use**: When would an agent use this?

**Example**:
```
"Search federal contract awards from FPDS (Federal Procurement Data System) through Tango's unified API. Returns contract details including vendor information (name, UEI, DUNS), agency details, award amounts, NAICS/PSC codes, set-aside types, and performance location. Supports filtering by: free-text search, vendor name/UEI, awarding agency, industry classifications, date ranges, and set-aside categories. Useful for finding contracts by vendor, agency spending analysis, market research, and competitor analysis. Maximum 100 results per request."
```

### 6. Agent Workflow Support Patterns

**Search → Filter → Detail**

Agents typically follow progressive refinement workflows:

```
1. Broad Search
   └─> search_tango_contracts(vendor_name="Lockheed")
       Returns: 100 contracts (truncated)

2. Refined Search
   └─> search_tango_contracts(vendor_name="Lockheed Martin", award_date_start="2024-01-01")
       Returns: 25 contracts (complete)

3. Detail Retrieval
   └─> get_tango_vendor_profile(uei="J3RW5C5KVLZ1")
       Returns: Full vendor profile + recent history
```

**Design Implications**:
- First tool returns indicate truncation (has_more: true)
- Detail tools accept IDs from search results (vendor_uei from contracts)
- Cross-references are consistent (UEI format across all tools)
- Related tools are documented in descriptions

**Composite Workflow Example**:
```
Goal: "Analyze DOD cloud computing contracts in 2024"

Agent workflow:
1. search_tango_contracts(awarding_agency="DOD", query="cloud", award_date_start="2024-01-01")
2. get_tango_spending_summary(awarding_agency="DOD", naics_code="541512", fiscal_year=2024)
3. get_tango_vendor_profile(uei=<top_vendor_uei>)
```

Tools are designed to compose naturally without requiring composite operations.

---

## MVP Scope Definition

### In Scope - Core Functionality

**1. Essential Tango API Tools** (5 tools)
- ✅ Contract search with comprehensive filtering
- ✅ Grant/assistance award search
- ✅ Vendor profile retrieval with history
- ✅ Opportunity/solicitation search
- ✅ Spending summary analytics

**2. Production Infrastructure**
- ✅ Cloudflare Workers deployment
- ✅ SSE transport for MCP protocol
- ✅ Environment-based API key management
- ✅ Request timeout handling (30s)
- ✅ Input sanitization for security

**3. Performance Optimizations**
- ✅ Cloudflare KV response caching (5-minute TTL)
- ✅ Rate limiting (conservative 100ms between requests)
- ✅ Edge deployment for global latency

**4. Observability**
- ✅ Structured JSON logging
- ✅ Performance metrics (duration, cache hits)
- ✅ Error tracking with context
- ✅ Health check endpoint

**5. Developer Experience**
- ✅ Type-safe TypeScript implementation
- ✅ Comprehensive tool documentation
- ✅ Unit test coverage for all tools
- ✅ Integration test suite with YAML specs
- ✅ README with agent usage instructions

### Out of Scope - Future Enhancements

**Deferred to Post-MVP**:
- ❌ Pagination cursors (use limit parameter only)
- ❌ Webhook subscriptions for opportunity alerts
- ❌ Advanced analytics (trend analysis, forecasting)
- ❌ Multi-tenant API key management
- ❌ Durable Objects distributed rate limiting
- ❌ Custom data aggregations beyond provided endpoint
- ❌ Historical data comparison tools
- ❌ Vendor relationship mapping
- ❌ Document/attachment retrieval from opportunities
- ❌ SAM.gov entity registration updates

### Scope Boundaries - Explicit Decisions

| Feature | Decision | Rationale |
|---------|----------|-----------|
| Number of tools | 5 atomic tools | Covers 90% of use cases, manageable complexity |
| Caching strategy | Simple KV (5min TTL) | Good enough for MVP, easy to implement |
| Rate limiting | Per-worker timestamp | Sufficient for low-medium traffic |
| Authentication | Single API key | Simplifies MVP, multi-tenant later |
| Pagination | Limit-based only | Cursor pagination adds complexity |
| Error retry | No automatic retry | Agent can retry, reduces code complexity |
| Response filtering | Client-side minimal | Let Tango API handle filtering where possible |

---

## Key Technical Decisions

### Decision 1: Cloudflare Workers + mcp-server-kit

**Choice**: Use mcp-server-kit with cloudflare-remote template

**Rationale**:
- ✅ Production-ready scaffolding with best practices
- ✅ Built-in testing infrastructure (unit + integration)
- ✅ Automatic tool registration and validation
- ✅ SSE transport pre-configured
- ✅ Active maintenance and documentation
- ✅ Designed for AI agent development

**Trade-offs**:
- Learning curve for mcp-server-kit CLI
- Opinionated project structure
- Some generated boilerplate

**Mitigation**:
- mcp-server-kit documentation is comprehensive
- Generated examples provide clear patterns
- Benefits far outweigh learning investment

### Decision 2: fetch API over axios

**Choice**: Native fetch with custom wrapper

**Rationale**:
- ✅ Workers runtime doesn't support Node.js libraries
- ✅ Fetch is standard Web API
- ✅ No external dependencies
- ✅ Better performance in Workers

**Implementation**:
```typescript
class TangoApiClient {
  async get<T>(endpoint: string, params: Record<string, any>, apiKey: string): Promise<ApiResponse<T>> {
    // URL building with searchParams
    // AbortController for timeout
    // Structured error handling
    // Rate limiting integration
  }
}
```

**Trade-offs**:
- Must implement timeout manually (AbortController)
- No built-in retry logic
- More verbose than axios

**Mitigation**:
- Create reusable fetch wrapper
- Document timeout patterns
- Consider retry wrapper for post-MVP

### Decision 3: KV Caching with 5-Minute TTL

**Choice**: Cloudflare KV for response caching, 5-minute expiration

**Rationale**:
- ✅ Reduces Tango API calls significantly
- ✅ Improves response time for repeated queries
- ✅ KV is cost-effective and globally distributed
- ✅ 5 minutes balances freshness vs cache utility

**Caching Strategy**:
```typescript
// Cache key format: tool_name:hash(params)
// Example: search_contracts:abc123def456

// Cache-aside pattern
async function searchContracts(args, env) {
  const cacheKey = generateCacheKey('search_contracts', args);

  // Try cache first
  const cached = await env.CACHE_KV.get(cacheKey, 'json');
  if (cached) {
    return { ...cached, execution: { cached: true } };
  }

  // Fetch from API
  const result = await apiCall();

  // Cache success responses only
  if (result.success) {
    await env.CACHE_KV.put(cacheKey, JSON.stringify(result), {
      expirationTtl: 300  // 5 minutes
    });
  }

  return result;
}
```

**Trade-offs**:
- Stale data up to 5 minutes old
- Cache storage costs
- Cache key collision risk

**Mitigation**:
- 5 minutes is acceptable for federal data (not real-time)
- KV free tier covers MVP usage
- Use hash of sorted params for cache keys

### Decision 4: No Automatic Retry Logic

**Choice**: Let agents handle retries rather than automatic retry

**Rationale**:
- ✅ Simpler implementation
- ✅ Agents can implement intelligent retry strategies
- ✅ Avoids cascading retries and timeout issues
- ✅ Clear error messages enable agent recovery

**Error Response Design**:
```typescript
{
  error: "Request timeout after 30 seconds",
  error_code: "TIMEOUT",
  transient: true,
  recoverable: true,
  suggestion: "Reduce limit parameter or add more specific filters"
}
```

**Trade-offs**:
- Agents must implement retry logic
- More network round-trips on transient failures

**Mitigation**:
- Document retry recommendations in tool descriptions
- Provide `transient` and `recoverable` flags in errors
- Consider adding retry for post-MVP if needed

### Decision 5: TypeScript Strict Mode Throughout

**Choice**: Full type safety with interfaces for all data structures

**Rationale**:
- ✅ Catch errors at compile time
- ✅ Better IDE autocomplete
- ✅ Self-documenting code
- ✅ Easier refactoring

**Type Hierarchy**:
```typescript
// API response types (Tango formats)
interface TangoContractResponse { ... }

// Normalized types (internal format)
interface NormalizedContract { ... }

// Tool argument types
interface SearchContractsArgs { ... }

// Tool response types
interface ContractSearchResponse { ... }

// Environment bindings
interface Env {
  TANGO_API_KEY: string;
  CACHE_KV: KVNamespace;
}
```

**Trade-offs**:
- More upfront development time
- Verbosity in type definitions

**Mitigation**:
- Types serve as documentation
- Prevents entire classes of runtime errors
- Worth the investment for production code

### Decision 6: Simple Per-Worker Rate Limiting

**Choice**: Timestamp-based rate limiting per Worker instance

**Rationale**:
- ✅ Simple to implement
- ✅ Sufficient for MVP traffic levels
- ✅ No external dependencies
- ✅ Clear upgrade path to Durable Objects

**Implementation**:
```typescript
let lastTangoCall = 0;
const RATE_LIMIT_MS = 100;

async function enforceRateLimit() {
  const now = Date.now();
  const elapsed = now - lastTangoCall;
  const waitTime = Math.max(0, RATE_LIMIT_MS - elapsed);

  if (waitTime > 0) {
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastTangoCall = Date.now();
}
```

**Trade-offs**:
- Rate limit is per-Worker, not global
- Distributed Workers could exceed total rate limit
- Not suitable for high-traffic scenarios

**Mitigation**:
- Conservative rate limit (100ms) provides safety margin
- Document upgrade path to Durable Objects
- Monitor actual traffic and API rate limits
- Add Durable Objects rate limiting post-MVP if needed

---

## Cloudflare-Specific Optimizations

### 1. Edge Deployment for Global Performance

**Optimization**: Deploy to Cloudflare's global network (275+ locations)

**Benefits**:
- Low latency for users worldwide
- Automatic geographic routing
- No infrastructure management

**Implementation**:
```bash
# Deploy to Cloudflare Workers
npm run deploy

# Deployed to: https://tango-mcp.your-domain.workers.dev
# Runs on Cloudflare edge globally
```

### 2. KV for Distributed Caching

**Optimization**: Use KV for response caching across edge locations

**Benefits**:
- Eventually consistent global cache
- Reduces API calls by ~80% for common queries
- Cost-effective (free tier: 100k reads/day, 1k writes/day)

**KV Configuration** (`wrangler.toml`):
```toml
[[kv_namespaces]]
binding = "CACHE_KV"
id = "your-kv-namespace-id"
```

**Cache Strategy**:
- 5-minute TTL for all cached responses
- Cache successful responses only
- Cache key: `tool_name:sha256(sorted_params)`
- Invalidation: Time-based only (no manual invalidation in MVP)

### 3. Environment Variables as Secrets

**Optimization**: Use Cloudflare Secrets for sensitive data

**Setup**:
```bash
# Set Tango API key as secret
wrangler secret put TANGO_API_KEY

# Reference in wrangler.toml (binding only)
[env.production]
# Secrets are not stored in config files
```

**Benefits**:
- API keys never in source code
- Encrypted at rest and in transit
- Per-environment configuration

### 4. Workers Analytics for Observability

**Optimization**: Leverage built-in Workers Analytics

**Metrics Available**:
- Request count by route
- Response time percentiles
- Error rates by status code
- Geographic distribution

**Custom Metrics** (log-based):
```typescript
console.log(JSON.stringify({
  tool: 'search_contracts',
  duration_ms: 245,
  cached: true,
  result_count: 25
}));
```

### 5. Health Check Endpoint

**Optimization**: Dedicated health check for monitoring

**Implementation**:
```typescript
// GET /health
{
  status: "healthy",
  timestamp: "2024-11-18T10:30:00Z",
  version: "1.0.0",
  services: {
    tango_api: "reachable",
    cache_kv: "available"
  }
}
```

**Benefits**:
- Uptime monitoring
- Dependency status
- Version tracking

### 6. Request Size Limits

**Optimization**: Enforce Cloudflare Workers limits proactively

**Constraints**:
- Max request body: 100 MB
- Max response size: Unlimited (streaming)
- Max CPU time: 50ms (free), 30s (paid)
- Max subrequests: 50 per request

**Mitigations**:
- Limit result counts (max 100)
- Use streaming for large responses
- Timeout requests at 30s
- Single subrequest per tool invocation

---

## Improvements Over Existing Implementation

### 1. Runtime & Performance

| Aspect | capture-mcp-server (Node.js) | Our MVP (Cloudflare Workers) |
|--------|------------------------------|------------------------------|
| Deployment | Single-region server | Global edge (275+ locations) |
| Cold start | ~500ms | ~10ms |
| Latency | Regional | Global low-latency |
| Scaling | Manual/container-based | Automatic, unlimited |
| Cost | Server costs + bandwidth | Pay-per-request (more efficient) |

### 2. Type Safety

| Aspect | capture-mcp-server | Our MVP |
|--------|-------------------|---------|
| Type coverage | Extensive use of `any` | Strict TypeScript throughout |
| API response types | Untyped | Typed interfaces |
| Tool arguments | `any` | Typed interfaces |
| Error types | String messages | Structured error objects |

**Example**:
```typescript
// capture-mcp-server
async searchContracts(args: any): Promise<any>

// Our MVP
async searchContracts(
  args: SearchContractsArgs,
  env: Env
): Promise<ContractSearchResponse | ErrorResponse>
```

### 3. Caching Strategy

| Aspect | capture-mcp-server | Our MVP |
|--------|-------------------|---------|
| Caching | None | KV-based with 5min TTL |
| Cache distribution | N/A | Global edge caching |
| Cache hit rate | 0% | ~80% (estimated) |
| API call reduction | None | Significant (4-5x fewer calls) |

### 4. Error Handling

| Aspect | capture-mcp-server | Our MVP |
|--------|-------------------|---------|
| Error format | String messages | Structured error objects |
| Recovery guidance | Generic | Actionable suggestions |
| Error codes | None | Standardized codes |
| Retry signals | None | `transient` and `recoverable` flags |

**Example**:
```typescript
// capture-mcp-server
return { error: "Invalid request" };

// Our MVP
return {
  error: "Invalid date format for award_date_start",
  error_code: "INVALID_FORMAT",
  parameter: "award_date_start",
  provided: "01/01/2024",
  expected_format: "YYYY-MM-DD",
  example: "2024-01-01",
  recoverable: true
};
```

### 5. Observability

| Aspect | capture-mcp-server | Our MVP |
|--------|-------------------|---------|
| Logging | Minimal | Structured JSON logs |
| Metrics | None | Performance metrics |
| Tracing | None | Request context tracking |
| Health checks | None | Dedicated endpoint |

### 6. Agent Experience

| Aspect | capture-mcp-server | Our MVP |
|--------|-------------------|---------|
| Tool descriptions | Good | Comprehensive with examples |
| Parameter docs | Basic | Detailed with formats/constraints |
| Response metadata | Minimal | Rich context (filters, pagination, performance) |
| Error guidance | Generic | Recovery-oriented with examples |
| Workflow support | Implicit | Explicit (search→filter→detail) |

### 7. Developer Experience

| Aspect | capture-mcp-server | Our MVP |
|--------|-------------------|---------|
| Scaffolding | Manual | mcp-server-kit automation |
| Testing | Custom | Built-in unit + integration |
| Type safety | Partial | Complete |
| Validation | Manual | Automated (`mcp-server-kit validate`) |
| Documentation | README | Generated + custom |

---

## Success Criteria for MVP

### 1. Functional Requirements

**Must Have**:
- ✅ All 5 tools operational and returning correct data
- ✅ API key authentication working (parameter + environment)
- ✅ Input sanitization preventing injection attacks
- ✅ Error responses are structured and actionable
- ✅ Response format is consistent across all tools
- ✅ Health check endpoint returning accurate status

**Success Metrics**:
- 100% of tools return valid MCP-formatted responses
- 0 unhandled exceptions in production
- All error cases return structured error objects

### 2. Performance Requirements

**Targets**:
- ✅ P50 response time: <1000ms (uncached)
- ✅ P50 response time: <200ms (cached)
- ✅ P99 response time: <3000ms
- ✅ Cache hit rate: >70%
- ✅ Timeout handling: 30s hard limit

**Success Metrics**:
- 95% of requests meet latency targets
- Cache hit rate measured and logged
- No timeout-related crashes

### 3. Reliability Requirements

**Targets**:
- ✅ Uptime: >99.5% (excluding planned maintenance)
- ✅ Error rate: <1% (excluding 4xx user errors)
- ✅ Rate limit compliance: 100%

**Success Metrics**:
- Cloudflare Workers availability SLA
- Error rate tracking in logs
- No rate limit violations detected

### 4. Testing Coverage

**Requirements**:
- ✅ Unit tests for all tool handlers
- ✅ Integration tests for all 5 tools
- ✅ Error handling tests for each tool
- ✅ Input sanitization tests
- ✅ Caching behavior tests

**Success Metrics**:
- 100% tool coverage in integration tests
- All unit tests passing
- Test suite runs in CI/CD

### 5. Documentation Quality

**Requirements**:
- ✅ README with setup instructions
- ✅ Tool descriptions include examples
- ✅ Error codes documented
- ✅ Architecture decision records
- ✅ Deployment guide

**Success Metrics**:
- New developer can deploy in <30 minutes
- Agent can use tools without external documentation
- All public interfaces have TSDoc comments

### 6. Agent Usability

**Qualitative Success Criteria**:
- ✅ Claude can discover and use tools without clarification
- ✅ Error messages guide Claude to corrections
- ✅ Claude can compose tools into workflows naturally
- ✅ Response format is self-explanatory
- ✅ Cache hits improve user experience noticeably

**Validation Method**:
- Test with Claude Code agent on sample queries
- Verify workflow composition (search→detail)
- Measure error recovery success rate
- Check for ambiguity in tool descriptions

---

## Risk Factors and Mitigation Strategies

### Risk 1: Workers Runtime Limitations

**Risk**: Cloudflare Workers have constraints that may impact functionality

**Specific Concerns**:
- 50ms CPU limit (free tier)
- No Node.js standard library
- fetch API differences from axios

**Probability**: Medium
**Impact**: High

**Mitigation**:
1. **Test early**: Build fetch wrapper immediately and test timeout behavior
2. **Monitor CPU time**: Log execution duration, optimize hot paths
3. **Upgrade plan**: Move to paid Workers plan ($5/month) for 30s CPU limit
4. **Simplify logic**: Keep tool handlers lean, defer complex processing

**Contingency**:
- If CPU limits are exceeded, consider Workers Unbound pricing
- If fetch API issues arise, consider polyfill library

### Risk 2: Tango API Rate Limits Unknown

**Risk**: Tango's actual rate limits are not documented publicly

**Specific Concerns**:
- Conservative 100ms limit may be overkill
- Actual limits may be lower than assumed
- Rate limit errors could impact user experience

**Probability**: Medium
**Impact**: Medium

**Mitigation**:
1. **Start conservative**: Use 100ms delay as safety margin
2. **Monitor responses**: Track 429 errors in logs
3. **Adaptive rate limiting**: Adjust based on observed limits
4. **Communicate with Tango**: Inquire about documented limits

**Contingency**:
- If rate limited, increase delay and implement exponential backoff
- Cache aggressively to reduce API calls
- Implement request queuing if needed

### Risk 3: KV Caching Consistency Issues

**Risk**: KV is eventually consistent, may serve stale data

**Specific Concerns**:
- Cross-region inconsistency
- Cache invalidation challenges
- Stale data confusing agents

**Probability**: Low
**Impact**: Low

**Mitigation**:
1. **Short TTL**: 5 minutes minimizes staleness window
2. **Document behavior**: README explains caching strategy
3. **Cache bypass**: Allow agents to bypass cache if needed (future)

**Contingency**:
- If consistency issues arise, reduce TTL to 1 minute
- Add cache-control parameter for real-time queries
- Consider moving to Durable Objects for strong consistency

### Risk 4: Type Safety Overhead

**Risk**: Strict TypeScript may slow initial development

**Specific Concerns**:
- Learning curve for team
- Time spent defining interfaces
- Refactoring when APIs change

**Probability**: Medium
**Impact**: Low

**Mitigation**:
1. **Incremental typing**: Start with core types, expand gradually
2. **Use inference**: Let TypeScript infer where possible
3. **Utility types**: Leverage built-in TypeScript utilities (Pick, Omit, etc.)

**Contingency**:
- If timeline pressure, use `unknown` instead of `any` (safer middle ground)
- Add types incrementally in post-MVP cleanup

### Risk 5: mcp-server-kit Stability

**Risk**: Dependency on relatively new framework (mcp-server-kit)

**Specific Concerns**:
- Breaking changes in updates
- Bugs in scaffolding
- Insufficient documentation

**Probability**: Low
**Impact**: Medium

**Mitigation**:
1. **Pin version**: Lock mcp-server-kit version in package.json
2. **Test thoroughly**: Validate generated code before building
3. **Contribute back**: File issues/PRs if bugs found
4. **Document workarounds**: Record any quirks in ADRs

**Contingency**:
- Fork mcp-server-kit if critical bugs block progress
- Build custom scaffolding if framework is inadequate
- Fall back to manual MCP server implementation (more work but viable)

### Risk 6: Tango API Changes

**Risk**: Tango API may change response formats or endpoints

**Specific Concerns**:
- Breaking changes without notice
- Field name variations
- Deprecation of endpoints

**Probability**: Medium
**Impact**: Medium

**Mitigation**:
1. **Response normalization layer**: Isolate API format changes
2. **Defensive parsing**: Handle missing/renamed fields gracefully
3. **Monitoring**: Alert on unexpected response structures
4. **Version tracking**: Log Tango API version if available

**Contingency**:
- Maintain backward compatibility in normalization layer
- Add field mapping configuration for quick updates
- Contact Tango for API change notifications

### Risk 7: Cold Start Latency

**Risk**: Workers cold starts may impact initial request latency

**Specific Concerns**:
- First request per edge location slower
- User experience degradation
- Timeout on cold starts

**Probability**: Low
**Impact**: Low

**Mitigation**:
1. **Lightweight bundle**: Minimize code size and dependencies
2. **Health check warming**: Regular health checks keep Workers warm
3. **Paid plan**: Workers paid plans have better cold start characteristics

**Contingency**:
- If cold starts are problematic, implement request queue
- Use Cloudflare Cron Triggers to warm Workers periodically
- Consider always-on Worker instance (paid feature)

---

## Architecture Phase Next Steps

With this consolidated solution design complete, the architecture phase should:

1. **Create detailed sequence diagrams** for each tool workflow
2. **Define TypeScript interfaces** for all data structures
3. **Design module/file structure** following mcp-server-kit patterns
4. **Specify API client implementation** with fetch wrapper details
5. **Design caching logic** with key generation and invalidation
6. **Document deployment pipeline** including CI/CD integration
7. **Create test specifications** for integration test YAML files

The architecture document should translate these strategic decisions into concrete technical specifications ready for implementation.

---

**Document Status**: ✅ Complete - Ready for Architecture Phase
**Next Review**: After architecture design completion
**Dependencies**: None - architecture can proceed immediately
