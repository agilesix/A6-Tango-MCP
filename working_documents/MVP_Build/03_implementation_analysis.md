# Implementation Analysis: Tango MCP Server Patterns

**Date**: 2025-11-18
**Source**: https://github.com/blencorp/capture-mcp-server
**Analysis Focus**: Extracting reusable patterns for Cloudflare-based MVP

---

## Executive Summary

The existing capture-mcp-server provides a solid foundation for understanding MCP tool implementation with the Tango API. This analysis extracts actionable patterns while identifying areas for improvement in our Cloudflare-based implementation.

**Key Finding**: The current implementation uses Node.js with axios and follows traditional MCP server patterns. Our Cloudflare Workers implementation will require adaptations for the Workers runtime while maintaining the proven tool architecture.

---

## 1. MCP Tool Structure Patterns

### 1.1 Tool Registry Pattern

**Implementation**:
```typescript
export const tangoTools = {
  async getTools(): Promise<Tool[]> {
    return [/* array of tool definitions */];
  },

  async callTool(name: string, args: any): Promise<any> {
    const sanitizedArgs = ApiClient.sanitizeInput(args);
    switch(name) {
      case "search_tango_contracts":
        return await this.searchContracts(sanitizedArgs);
      // ... other cases
      default:
        throw new Error(`Unknown Tango tool: ${name}`);
    }
  }
}
```

**Pattern**: Centralized registry with two methods:
- `getTools()`: Returns metadata for all available tools
- `callTool()`: Router that dispatches to specific handlers

**For Our MVP**:
- ✅ Use this pattern - clean separation of concerns
- ✅ Each tool is a separate method for testability
- ✅ Switch-based routing is simple and performant

### 1.2 Tool Schema Definition

**Standard JSON Schema Format**:
```typescript
{
  name: "search_tango_contracts",
  description: "Search federal contracts through Tango's unified API...",
  inputSchema: {
    type: "object",
    properties: {
      api_key: {
        type: "string",
        description: "Tango API key (optional if TANGO_API_KEY env var is set)"
      },
      query: {
        type: "string",
        description: "Search query for contract description or title"
      },
      // ... more parameters
      limit: {
        type: "number",
        description: "Number of results to return (default: 10, max: 100)"
      }
    },
    required: []  // All parameters optional
  }
}
```

**Pattern Observations**:
- All parameters use detailed descriptions (LLM-friendly)
- API key is optional with environment variable fallback
- Limit parameter with default and maximum constraints
- No required parameters (flexibility for LLM)
- Types match JSON Schema spec (string, number, boolean)

**For Our MVP**:
- ✅ Mirror this schema structure
- ✅ Keep all parameters optional for LLM flexibility
- ✅ Include detailed descriptions for Claude
- ✅ Document defaults and maximums in descriptions
- ⚠️ Consider required parameters for critical fields (like UEI in vendor profile)

### 1.3 Parameter Handling Pattern

**Destructuring with Defaults**:
```typescript
async searchContracts(args: any): Promise<any> {
  const {
    api_key,
    query,
    vendor_name,
    vendor_uei,
    // ... more parameters
    limit = 10  // Default value
  } = args;

  // API key resolution with fallback
  const tangoApiKey = api_key || process.env.TANGO_API_KEY;

  // Validation
  if (!tangoApiKey) {
    throw new Error("Tango API key is required...");
  }

  // Build request params conditionally
  const params: Record<string, any> = {
    limit: Math.min(limit, 100)  // Enforce maximum
  };

  if (query) params.search = query;
  if (vendor_name) params.recipient = vendor_name;
  // ... conditional additions
}
```

**Pattern**:
1. Destructure with defaults
2. Resolve credentials with fallback
3. Validate required values
4. Build request params conditionally (only include provided values)
5. Enforce constraints (max limit)

**For Our MVP**:
- ✅ Use conditional parameter building
- ✅ Environment variable fallback pattern
- ✅ Enforce max limits (100 results)
- ⚠️ Consider using Cloudflare env bindings instead of process.env

---

## 2. Tango API Client Implementation

### 2.1 Client Architecture

**File**: `src/utils/api-client.ts`

**Core Structure**:
```typescript
export interface ApiResponse<T = any> {
  data: T;
  success: boolean;
  error?: string;
}

export class ApiClient {
  private static readonly TANGO_BASE_URL = 'https://tango.makegov.com/api';

  static async tangoGet<T = any>(
    endpoint: string,
    params: Record<string, any> = {},
    apiKey: string
  ): Promise<ApiResponse<T>> {
    await this.enforceRateLimit('tango');

    try {
      const response: AxiosResponse<T> = await axios.get(
        `${this.TANGO_BASE_URL}${endpoint}`,
        {
          params,
          timeout: 30000,
          headers: {
            'Accept': 'application/json',
            'X-API-Key': apiKey,
            'User-Agent': 'Capture-MCP/1.0.0'
          }
        }
      );

      return { data: response.data, success: true };
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }
}
```

**Key Features**:
1. **Standardized Response**: `ApiResponse<T>` with success flag
2. **Rate Limiting**: Queue-based rate limiting per API
3. **Error Handling**: Centralized error handler
4. **Type Safety**: Generic type parameter
5. **Timeout**: 30-second timeout on all requests

### 2.2 Rate Limiting Strategy

**Implementation**:
```typescript
private static readonly RATE_LIMIT_MS: Record<ApiFamily, number> = {
  tango: 100,  // Conservative 100ms delay
};

private static rateLimitQueues: Record<ApiFamily, Promise<void>> = {
  tango: Promise.resolve(),
};

private static async enforceRateLimit(apiType: ApiFamily): Promise<void> {
  const run = async () => {
    const now = Date.now();
    const elapsed = now - this.lastCallTimestamp[apiType];
    const delayMs = this.RATE_LIMIT_MS[apiType];
    const waitTime = elapsed >= delayMs ? 0 : delayMs - elapsed;

    if (waitTime > 0) {
      await this.sleep(waitTime);
    }

    this.lastCallTimestamp[apiType] = Date.now();
  };

  // Chain executions to preserve ordering
  this.rateLimitQueues[apiType] = this.rateLimitQueues[apiType].then(run, run);
  await this.rateLimitQueues[apiType];
}
```

**Pattern**: Queue-based rate limiting that chains promises to ensure sequential execution with minimum delays.

**For Our MVP**:
- ✅ Implement rate limiting for production
- ⚠️ 100ms may be overly conservative - verify Tango's actual limits
- ⚠️ Consider Cloudflare Durable Objects for distributed rate limiting
- 🔄 Initial MVP: Simple timestamp-based limiting (single-instance)

### 2.3 Error Handling Pattern

**Implementation**:
```typescript
private static handleError(error: AxiosError): ApiResponse {
  if (error.response) {
    // API returned an error response
    const status = error.response.status;
    const message = error.response.data || error.message;

    return {
      data: null,
      success: false,
      error: `API Error ${status}: ${JSON.stringify(message)}`
    };
  } else if (error.request) {
    // Request was made but no response received
    return {
      data: null,
      success: false,
      error: 'Network error: No response received from API'
    };
  } else {
    // Error in request configuration
    return {
      data: null,
      success: false,
      error: `Request error: ${error.message}`
    };
  }
}
```

**Pattern**: Three-tier error handling:
1. API response errors (4xx, 5xx)
2. Network errors (timeout, connection)
3. Request configuration errors

**For Our MVP**:
- ✅ Adopt this three-tier pattern
- ✅ Always return structured error objects (never throw in handlers)
- ✅ Include status codes in error messages
- ⚠️ Consider more detailed error types for retry logic

### 2.4 Input Sanitization

**Implementation**:
```typescript
static sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Strip control characters while preserving punctuation
    return input.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  }

  if (Array.isArray(input)) {
    return input.map(item => this.sanitizeInput(item));
  }

  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = this.sanitizeInput(value);
    }
    return sanitized;
  }

  return input;
}
```

**Pattern**: Recursive sanitization that:
- Strips control characters from strings
- Preserves meaningful punctuation
- Handles nested objects and arrays

**For Our MVP**:
- ✅ Implement this sanitization
- ✅ Call before processing tool arguments
- 💡 Consider additional validation (SQL injection, XSS)

---

## 3. Response Formatting Patterns

### 3.1 Standardized Response Structure

**Contract Search Response**:
```typescript
return {
  total: response.data.total || response.data.count || 0,
  contracts: [...],
  filters: params,
  limit
};
```

**Pattern Components**:
1. **total**: Count of available results
2. **Data Array**: Primary payload (contracts, grants, opportunities)
3. **filters**: Echo back applied filters for transparency
4. **limit**: Pagination parameter

**Benefits**:
- LLM can understand what filters were applied
- Total count helps with pagination decisions
- Consistent structure across all tools

### 3.2 Data Normalization Pattern

**Raw API → Normalized Structure**:
```typescript
const contracts = rawContracts.map((contract: any) => ({
  contract_id: contract.key || contract.piid || contract.contract_id,
  title: contract.description || contract.title,
  vendor: {
    name: contract.recipient?.display_name || contract.vendor_name,
    uei: contract.recipient?.uei || contract.vendor_uei,
    duns: contract.vendor_duns
  },
  agency: {
    name: contract.awarding_office?.agency_name || contract.agency_name,
    code: contract.awarding_office?.agency_code || contract.agency_code,
    office: contract.awarding_office?.office_name || contract.office_name
  },
  // ... more fields
}));
```

**Pattern**:
- Fallback chains for inconsistent API fields (`field1 || field2 || field3`)
- Nested objects for related data (vendor, agency, location)
- Field renaming for clarity (API fields → semantic names)
- Null handling implicit through || chains

**For Our MVP**:
- ✅ Normalize Tango API responses to consistent structure
- ✅ Use nested objects for semantic grouping
- ✅ Document the normalized schema
- 💡 Consider TypeScript interfaces for normalized types

### 3.3 Client-Side Filtering

**Post-API Filtering**:
```typescript
// Amount range filtering (not supported by API)
if (award_amount_min !== undefined || award_amount_max !== undefined) {
  rawContracts = rawContracts.filter((contract: any) => {
    const amount = Number(contract.obligated ?? contract.total_contract_value ?? ...);
    if (typeof award_amount_min === 'number' && amount < award_amount_min) {
      return false;
    }
    if (typeof award_amount_max === 'number' && amount > award_amount_max) {
      return false;
    }
    return true;
  });
}

// Text search filtering (enhanced over API)
if (vendor_name) {
  const needle = vendor_name.toLowerCase();
  rawContracts = rawContracts.filter((contract: any) => {
    const recipient = contract.recipient?.display_name || contract.vendor_name;
    return typeof recipient === 'string' ? recipient.toLowerCase().includes(needle) : true;
  });
}
```

**Pattern**: Enhance API capabilities with client-side filtering when:
- API doesn't support certain filters
- Need case-insensitive search
- Complex range filtering

**For Our MVP**:
- ⚠️ Be cautious with client-side filtering (limit results first)
- ✅ Use for enhancing search relevance
- ⚠️ Document which filters are client-side vs server-side
- 💡 Consider warning users if client-side filtering reduces result count

---

## 4. Reusable Code Components

### 4.1 Core Components to Adapt

| Component | Reuse Strategy | Adaptation Needed |
|-----------|---------------|-------------------|
| Tool Schema Definitions | ✅ Copy with minor tweaks | Update descriptions for MVP scope |
| Response Normalization Logic | ✅ Adapt patterns | Keep structure, update field mappings |
| Error Handling Structure | ✅ Reuse pattern | Adapt for Cloudflare fetch API |
| Input Sanitization | ✅ Copy directly | No changes needed |
| API Client Interface | 🔄 Redesign | Replace axios with fetch, adapt for Workers |
| Rate Limiting Logic | 🔄 Simplify for MVP | Single-instance timestamp-based initially |

### 4.2 Components to Build New

| Component | Reason |
|-----------|--------|
| Cloudflare Workers fetch client | Replace Node.js axios |
| Environment binding access | Cloudflare-specific env pattern |
| SSE transport handler | Cloudflare Workers SSE implementation |
| Tool registration system | Integrate with mcp-server-kit patterns |

---

## 5. Best Practices Observed

### 5.1 API Design

✅ **Good Practices**:
1. **Optional Parameters**: All tool parameters optional for LLM flexibility
2. **Environment Variable Fallback**: API key resolution chain
3. **Detailed Descriptions**: Every parameter has clear LLM-friendly description
4. **Limit Enforcement**: Hard cap on result counts (100)
5. **Timeout Configuration**: 30-second timeout prevents hanging
6. **User-Agent Header**: Identifies client for API monitoring

### 5.2 Error Handling

✅ **Good Practices**:
1. **Never Throw in Tool Handlers**: Always return structured error objects
2. **Success Flag**: Explicit `success` boolean in responses
3. **Detailed Error Messages**: Include status codes and context
4. **Three-Tier Error Handling**: API/Network/Request errors separated

### 5.3 Data Processing

✅ **Good Practices**:
1. **Input Sanitization**: Always sanitize before processing
2. **Fallback Chains**: Handle inconsistent API responses gracefully
3. **Type Coercion**: Explicit Number() conversions for amounts
4. **Defensive Programming**: Check types before operations

### 5.4 Code Organization

✅ **Good Practices**:
1. **Separation of Concerns**: Tools vs API client vs utilities
2. **Single Responsibility**: Each tool method handles one endpoint
3. **Centralized Configuration**: Base URLs and constants in one place

---

## 6. Potential Improvements for Our MVP

### 6.1 Type Safety

**Current Implementation**: Uses `any` types extensively

**Improvement**:
```typescript
// Define explicit interfaces
interface TangoContract {
  key: string;
  description?: string;
  title?: string;
  recipient?: {
    display_name?: string;
    uei?: string;
  };
  // ... more fields
}

interface NormalizedContract {
  contract_id: string;
  title?: string;
  vendor: {
    name?: string;
    uei?: string;
    duns?: string;
  };
  // ... more fields
}

async searchContracts(args: SearchContractsArgs): Promise<ContractsResponse>
```

**Benefits**:
- Catch errors at compile time
- Better IDE autocomplete
- Self-documenting code
- Easier refactoring

### 6.2 Response Pagination

**Current Implementation**: Simple limit parameter, no pagination

**Improvement**:
```typescript
interface PaginatedResponse<T> {
  total: number;
  data: T[];
  pagination: {
    limit: number;
    offset: number;
    has_more: boolean;
    next_cursor?: string;
  };
  filters: Record<string, any>;
}
```

**Benefits**:
- LLM can request more results
- Clearer pagination state
- Support for cursor-based pagination

### 6.3 Caching Layer

**Current Implementation**: No caching

**Improvement** (Cloudflare-specific):
```typescript
// Use Cloudflare KV for response caching
async getCachedOrFetch(
  cacheKey: string,
  fetchFn: () => Promise<ApiResponse>,
  ttl: number = 300
): Promise<ApiResponse> {
  const cached = await env.CACHE_KV.get(cacheKey, 'json');
  if (cached) return cached;

  const fresh = await fetchFn();
  if (fresh.success) {
    await env.CACHE_KV.put(cacheKey, JSON.stringify(fresh), { expirationTtl: ttl });
  }
  return fresh;
}
```

**Benefits**:
- Reduce Tango API calls
- Faster response times
- Cost savings

### 6.4 Retry Logic

**Current Implementation**: No retry on failures

**Improvement**:
```typescript
async fetchWithRetry<T>(
  fetchFn: () => Promise<ApiResponse<T>>,
  maxRetries: number = 3,
  backoff: number = 1000
): Promise<ApiResponse<T>> {
  for (let i = 0; i < maxRetries; i++) {
    const result = await fetchFn();
    if (result.success || i === maxRetries - 1) {
      return result;
    }

    // Exponential backoff
    await this.sleep(backoff * Math.pow(2, i));
  }
}
```

**Benefits**:
- Handle transient failures
- Improve reliability
- Better user experience

### 6.5 Structured Logging

**Current Implementation**: No logging (just errors)

**Improvement**:
```typescript
interface LogContext {
  tool: string;
  duration_ms: number;
  success: boolean;
  error?: string;
  filters?: Record<string, any>;
}

function logToolExecution(context: LogContext) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: context.success ? 'info' : 'error',
    ...context
  }));
}
```

**Benefits**:
- Debug issues in production
- Monitor tool usage
- Track performance metrics

---

## 7. Cloudflare Workers Adaptations Required

### 7.1 HTTP Client Migration

**From axios (Node.js)**:
```typescript
const response = await axios.get(url, { params, headers, timeout: 30000 });
```

**To fetch (Workers)**:
```typescript
const url = new URL(endpoint, baseUrl);
Object.entries(params).forEach(([key, val]) => url.searchParams.set(key, val));

const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);

const response = await fetch(url.toString(), {
  headers,
  signal: controller.signal
});

clearTimeout(timeoutId);
const data = await response.json();
```

**Key Differences**:
- Manual URL building with searchParams
- AbortController for timeout
- Explicit JSON parsing
- No built-in timeout option

### 7.2 Environment Variables

**From process.env (Node.js)**:
```typescript
const apiKey = process.env.TANGO_API_KEY;
```

**To env bindings (Workers)**:
```typescript
// In tool handler
async callTool(name: string, args: any, env: Env): Promise<any> {
  const apiKey = args.api_key || env.TANGO_API_KEY;
}
```

**Key Differences**:
- env object passed through call chain
- Defined in Env interface
- Configured in wrangler.toml

### 7.3 Rate Limiting for Distributed Workers

**Challenge**: Workers are stateless and distributed

**Solution Options**:
1. **Durable Objects** (for production):
   - Centralized rate limiter
   - Shared state across Workers
   - Higher complexity

2. **Simple timestamp** (MVP):
   - Per-worker rate limiting
   - Good enough for low traffic
   - Easy to implement

**MVP Approach**:
```typescript
// Simple per-worker rate limiting
let lastCallTime = 0;
const RATE_LIMIT_MS = 100;

async function enforceRateLimit() {
  const now = Date.now();
  const elapsed = now - lastCallTime;
  const waitTime = Math.max(0, RATE_LIMIT_MS - elapsed);

  if (waitTime > 0) {
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastCallTime = Date.now();
}
```

---

## 8. Implementation Roadmap for MVP

### Phase 1: Foundation (Week 1)
1. ✅ Scaffold project with mcp-server-kit
2. ✅ Create Cloudflare fetch-based API client
3. ✅ Implement input sanitization
4. ✅ Set up error handling structure
5. ✅ Configure environment bindings

### Phase 2: Core Tools (Week 1-2)
1. ✅ Implement search_tango_contracts
2. ✅ Implement search_tango_grants
3. ✅ Implement get_tango_vendor_profile
4. ✅ Add response normalization
5. ✅ Add basic rate limiting

### Phase 3: Enhancement (Week 2)
1. 🔄 Add client-side filtering where needed
2. 🔄 Implement TypeScript interfaces
3. 🔄 Add structured logging
4. 🔄 Write unit tests
5. 🔄 Write integration tests

### Phase 4: Production Readiness (Week 3)
1. 🔄 Add KV caching layer
2. 🔄 Implement retry logic
3. 🔄 Add performance monitoring
4. 🔄 Security hardening
5. 🔄 Deploy to production

---

## 9. What to Adapt vs. What to Change

### ✅ Adapt (Keep Core Pattern, Update Implementation)

| Pattern | Why Adapt | How |
|---------|-----------|-----|
| Tool registry structure | Clean, proven pattern | Keep same, integrate with mcp-server-kit |
| JSON Schema definitions | MCP standard | Copy tool schemas, update descriptions |
| Response normalization | Consistent LLM experience | Keep pattern, update field mappings |
| Error handling structure | Comprehensive | Keep three-tier pattern, adapt for fetch |
| Input sanitization | Security essential | Copy directly |
| Parameter handling | Flexible for LLM | Keep optional params, conditional building |

### 🔄 Change (Redesign for Cloudflare/MVP)

| Component | Why Change | How |
|-----------|------------|-----|
| HTTP client | Workers doesn't support axios | Build fetch wrapper with similar interface |
| Rate limiting | Need distributed approach | Start simple (per-worker), plan Durable Objects |
| Type safety | Improve maintainability | Add TypeScript interfaces throughout |
| Caching | Reduce API calls | Add Cloudflare KV caching layer |
| Pagination | Better LLM experience | Add cursor-based pagination support |
| Logging | Production observability | Add structured JSON logging |

### ❌ Avoid (Anti-patterns or Unnecessary)

| Pattern | Why Avoid |
|---------|-----------|
| Liberal use of `any` | Loses type safety benefits |
| Client-side filtering without limits | Can cause performance issues |
| No caching | Wastes API quota, slow responses |
| Synchronous error throwing in tools | Breaks error handling contract |
| Hard-coded base URLs | Makes testing difficult |

---

## 10. Key Takeaways

### For Implementation Team

1. **Core Architecture Is Solid**: The tool registry and handler pattern is proven and should be replicated
2. **Focus on Cloudflare Adaptations**: The main work is adapting Node.js patterns to Workers runtime
3. **Type Safety Matters**: Add TypeScript interfaces to avoid the `any` trap
4. **Start Simple**: MVP doesn't need Durable Objects rate limiting or complex caching
5. **Test Early**: Use mcp-server-kit test harness from day one
6. **Plan for Scale**: Simple patterns now, with clear upgrade paths (KV → DO, simple → retry logic)

### Critical Success Factors

1. ✅ **Fetch API Wrapper**: Must have feature parity with axios patterns
2. ✅ **Error Handling**: Never throw in tool handlers, always return structured errors
3. ✅ **Environment Bindings**: Proper env object threading through call chain
4. ✅ **Response Consistency**: Standardized response format across all tools
5. ✅ **Input Validation**: Sanitize all inputs, validate critical parameters

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Workers runtime limitations | Thorough testing of fetch API patterns |
| Rate limiting in distributed environment | Start with per-worker, plan DO upgrade |
| Tango API changes | Response normalization layer isolates impact |
| Performance issues | Add KV caching, monitor response times |
| Type errors | Use TypeScript strict mode, define interfaces |

---

## Appendix: Code Snippets for Quick Reference

### A. Fetch-Based API Client Template

```typescript
interface ApiResponse<T = any> {
  data: T;
  success: boolean;
  error?: string;
}

class TangoClient {
  constructor(
    private baseUrl: string = 'https://tango.makegov.com/api',
    private defaultTimeout: number = 30000
  ) {}

  async get<T = any>(
    endpoint: string,
    params: Record<string, any> = {},
    apiKey: string
  ): Promise<ApiResponse<T>> {
    const url = new URL(endpoint, this.baseUrl);

    // Add query parameters
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        url.searchParams.set(key, String(val));
      }
    });

    // Timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeout);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-API-Key': apiKey,
          'User-Agent': 'Tango-MCP/1.0.0'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          data: null,
          success: false,
          error: `API Error ${response.status}: ${response.statusText}`
        };
      }

      const data = await response.json() as T;
      return { data, success: true };

    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        return {
          data: null,
          success: false,
          error: 'Request timeout after 30 seconds'
        };
      }

      return {
        data: null,
        success: false,
        error: `Request error: ${error.message}`
      };
    }
  }
}
```

### B. Tool Handler Template

```typescript
interface SearchContractsArgs {
  api_key?: string;
  query?: string;
  vendor_name?: string;
  limit?: number;
}

async function searchContracts(
  args: SearchContractsArgs,
  env: Env
): Promise<any> {
  // 1. Sanitize inputs
  const sanitized = sanitizeInput(args);

  // 2. Destructure with defaults
  const {
    api_key,
    query,
    vendor_name,
    limit = 10
  } = sanitized;

  // 3. Resolve API key
  const apiKey = api_key || env.TANGO_API_KEY;
  if (!apiKey) {
    return {
      error: 'Tango API key required. Provide as parameter or set TANGO_API_KEY.'
    };
  }

  // 4. Build request params
  const params: Record<string, any> = {
    limit: Math.min(limit, 100)
  };
  if (query) params.search = query;
  if (vendor_name) params.recipient = vendor_name;

  // 5. Make API call
  const client = new TangoClient();
  const response = await client.get('/contracts/', params, apiKey);

  // 6. Handle error
  if (!response.success) {
    return { error: response.error };
  }

  // 7. Normalize data
  const contracts = (response.data.results || []).map(normalizeContract);

  // 8. Return standardized response
  return {
    total: response.data.total || 0,
    contracts,
    filters: params,
    limit
  };
}
```

---

**Document Version**: 1.0
**Next Review**: After MVP Phase 1 completion
**Owner**: Implementation Team
