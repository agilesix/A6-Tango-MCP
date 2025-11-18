# Final Implementation Plan: Tango MCP Server MVP

**Version**: 2.0 (Final)
**Date**: 2025-11-18
**Status**: APPROVED - Ready for Execution
**Estimated Total Time**: 12-14 hours (with 3-4 parallel streams)
**Previous Version**: Architecture Implementation Plan v1.0

---

## Changes from v1 (Verification Feedback Applied)

This final plan incorporates all critical changes identified in the verification report:

### Critical Updates
1. **Added F5 Task**: Test infrastructure setup (25 min) - Foundation now includes Vitest + YAML spec configuration
2. **Fixed Dependency Conflicts**: S3 (Tools) now correctly blocks until S2.5 (API Client) completes - removed false parallelism claims
3. **Revised Time Estimates**: Added +4 hours buffer to complex tasks (types, descriptions, YAML specs) - total now 12-14 hours realistic
4. **Strengthened Validation**: Enhanced checkpoint criteria with KV checks (CP1), individual tool tests (CP3), and partial success strategies
5. **Added Rollback Procedures**: New Section 6 with recovery procedures for each checkpoint failure scenario

### Detailed Changes
- **Foundation Stream**: Added F5 for test harness, extends CP1 from 90m to 115m
- **API Client Stream**: Split S2.5 into S2.5a (errors) + S2.5b (normalization), adjusted timing
- **Tools Stream**: Added S3.7a for JSON Schema validation, corrected start time from 65m to 290m
- **Integration Timeline**: Corrected parallel execution windows to reflect actual dependencies
- **Validation Strategy**: Added explicit validation steps for KV namespace, environment bindings, individual tool tests
- **New Section 6**: Rollback procedures with three recovery options per checkpoint

### Impact Summary
- **Total Time**: 8 hours → 12-14 hours (realistic)
- **Success Probability**: 60% → 85% (with changes)
- **Risk Level**: HIGH → MEDIUM (with mitigations)
- **Go/No-Go**: CONDITIONAL → APPROVED

---

## Executive Summary

This implementation plan uses **git worktrees** to enable parallel development across 5 independent streams. Each stream contains 20-45 minute tasks with clear integration points. The strategy maximizes throughput while minimizing merge conflicts through careful ownership boundaries.

**Key Metrics**:
- **Total Tasks**: 35 tasks (3 new tasks added)
- **Sequential Time**: ~20 hours
- **Parallel Time**: ~12-14 hours (40% reduction)
- **Integration Points**: 5 major merges with enhanced validation
- **Testing Frequency**: Every 1-2 commits
- **Checkpoints**: 5 integration points with rollback procedures

---

## Section 1: Work Breakdown Structure (Updated)

### Stream 1: Foundation & Scaffolding (5 tasks, 115 min)

| Task ID | Task | Time | Dependencies | Concurrent With |
|---------|------|------|--------------|----------------|
| F1 | Initialize mcp-server-kit project with cloudflare-remote template | 20 min | None | All other streams blocked |
| F2 | Configure wrangler.toml with KV namespace bindings | 20 min | F1 | None |
| F3 | Set up TypeScript strict mode and base interfaces (Env, ErrorResponse) | 25 min | F2 | None |
| F4 | Implement health check endpoint with dependency status and verify deployment | 25 min | F3 | None |
| **F5 (NEW)** | **Set up test infrastructure (Vitest + YAML specs)** | **25 min** | **F4** | **None** |

**Validation**: Health check returns 200 OK on deployed Worker, KV accessible, test framework runs

---

### Stream 2: API Client & Types (8 tasks, 175 min)

| Task ID | Task | Time | Dependencies | Concurrent With |
|---------|------|------|--------------|----------------|
| S2.1 | Define Tango API response type interfaces (all 5 endpoints) | 45 min | F3 | None (waits for F3) |
| S2.2 | Implement TangoApiClient class with fetch wrapper | 30 min | S2.1 | None |
| S2.3 | Add timeout handling with AbortController (30s limit) | 20 min | S2.2 | None |
| S2.4 | Implement per-worker rate limiting (100ms between calls) | 20 min | S2.3 | None |
| **S2.5a (SPLIT)** | **Implement structured error handling** | **15 min** | **S2.4** | **None** |
| **S2.5b (SPLIT)** | **Create response normalization utilities for all 5 endpoints** | **25 min** | **S2.5a** | **None** |
| S2.6 | Create unit tests for API client (timeout, rate limit, errors) | 20 min | S2.5b | None |
| S2.7 | Integration test with real Tango API (health check) | 15 min | S2.6 | None |

**Validation**: API client successfully fetches data with rate limiting, timeout, and normalization

---

### Stream 3: MCP Tools Implementation (12 tasks, 265 min)

| Task ID | Task | Time | Dependencies | Concurrent With |
|---------|------|------|--------------|----------------|
| S3.1 | Define tool argument interfaces for all 5 tools | 35 min | S2.5b | None (waits for normalization) |
| S3.2 | Implement search_tango_contracts tool handler | 25 min | S3.1 | None |
| S3.3 | Implement search_tango_grants tool handler (with client-side filtering) | 20 min | S3.2 | None |
| S3.4 | Implement get_tango_vendor_profile tool handler | 20 min | S3.3 | None |
| S3.5 | Implement search_tango_opportunities tool handler | 20 min | S3.4 | None |
| S3.6 | Implement get_tango_spending_summary tool handler | 20 min | S3.5 | None |
| **S3.7a (NEW)** | **Define JSON Schema inputSchema for all 5 tools** | **20 min** | **S3.6** | **None** |
| S3.7 | Add input sanitization middleware for all tools | 25 min | S3.7a | None |
| S3.8 | Create comprehensive tool descriptions with examples | 45 min | S3.7 | S5.1 |
| S3.9 | Implement tool response envelope (metadata, pagination, filters) | 20 min | S3.8 | S5.1 |
| S3.10 | Add actionable error messages with recovery suggestions | 15 min | S3.9 | S5.1 |

**Validation**: All 5 tools return valid MCP responses with proper formatting (individual tests)

---

### Stream 4: Caching & Performance (5 tasks, 100 min)

| Task ID | Task | Time | Dependencies | Concurrent With |
|---------|------|------|--------------|----------------|
| S4.1 | Implement cache key generation (tool_name:hash(params)) | 20 min | S3.10 | None (waits for tools) |
| S4.2 | Add KV cache-aside pattern for all tool handlers | 25 min | S4.1 | S5.2 |
| S4.3 | Configure 5-minute TTL and cache-only-success logic | 15 min | S4.2 | S5.2 |
| S4.4 | Add cache hit/miss metrics to response execution metadata | 20 min | S4.3 | S5.3 |
| S4.5 | Test cache behavior (hit, miss, expiration) | 20 min | S4.4 | S5.3 |

**Validation**: Cache hit rate >70% on repeated queries, TTL expires after 5 minutes

---

### Stream 5: Testing & Documentation (6 tasks, 165 min)

| Task ID | Task | Time | Dependencies | Concurrent With |
|---------|------|------|--------------|----------------|
| S5.1 | Create integration test YAML specs for all 5 tools | 50 min | S3.8 | S3.8, S3.9, S3.10 |
| S5.2 | Write unit tests for each tool handler | 25 min | S5.1 | S4.2, S4.3 |
| S5.3 | Add error handling test cases (auth, validation, timeout) | 20 min | S5.2 | S4.4, S4.5 |
| S5.4 | Implement observability logging (structured JSON) | 20 min | S5.3 | None |
| S5.5 | Create README with setup, deployment, and usage instructions | 40 min | S5.4 | None |
| S5.6 | End-to-end validation with Claude Code agent | 10 min | S5.5 | None |

**Validation**: All tests pass, agent can use tools without errors

---

## Section 2: Git Worktree Strategy (Same as v1)

### Worktree Branches and Ownership

```
main (protected)
├── worktree/foundation     (F1-F5)    - Project scaffolding, config, health check, test setup
├── worktree/api-client     (S2.1-S2.7) - TangoApiClient, types, error handling, normalization
├── worktree/tools          (S3.1-S3.10)- All 5 MCP tool handlers
├── worktree/caching        (S4.1-S4.5) - KV caching layer
└── worktree/testing        (S5.1-S5.6) - Tests, docs, observability
```

### File Ownership (Prevents Merge Conflicts)

| Worktree | Owned Files/Directories | Touch-Only (Read) |
|----------|-------------------------|-------------------|
| `foundation` | `wrangler.toml`, `src/index.ts`, `src/types/env.ts`, `src/health.ts`, `tests/setup.ts` | None |
| `api-client` | `src/api/tango-client.ts`, `src/types/tango-api.ts`, `src/types/errors.ts`, `src/utils/rate-limiter.ts`, `src/utils/normalizer.ts` | `src/types/env.ts` |
| `tools` | `src/tools/*.ts`, `src/middleware/sanitization.ts`, `src/types/tool-args.ts` | `src/api/tango-client.ts`, `src/types/*.ts` |
| `caching` | `src/cache/*.ts`, `src/utils/cache-key.ts` | `src/tools/*.ts`, `src/api/*.ts` |
| `testing` | `tests/**/*.ts`, `tests/**/*.yaml`, `README.md`, `src/utils/logger.ts` | All src files |

**Conflict Prevention**: Each worktree owns distinct files. Shared types are created in foundation, then read-only in other worktrees.

---

### Integration Checkpoints (Enhanced Validation)

| Checkpoint | Merges | Validation | Estimated Time |
|------------|--------|------------|---------------|
| **CP1: Foundation Complete** | `foundation` → `main` | Health check deployed, KV accessible, test framework runs | After F5 (~115 min) |
| **CP2: API Client Ready** | `api-client` → `main` | Unit tests pass, real API call succeeds, normalization validated | After S2.7 (~290 min) |
| **CP3: Tools Functional** | `tools` → `main` | All 5 tools tested individually, MCP responses valid | After S3.10 (~555 min) |
| **CP4: Caching Active** | `caching` → `main` | Cache hit rate >70%, TTL validated, metrics working | After S4.5 (~655 min) |
| **CP5: MVP Complete** | `testing` → `main` | All tests pass, agent validation succeeds, README complete | After S5.6 (~705 min) |

**Merge Strategy**: Sequential integration, validate after each merge with rollback procedures if needed.

---

## Section 3: Parallel Development Streams (Updated)

### Stream 1: Foundation & Scaffolding

**Purpose**: Establish project structure, configuration, deployment pipeline, and test infrastructure
**Worktree**: `worktree/foundation`
**Branch**: `foundation`

#### Task Execution Order

**F1: Initialize mcp-server-kit project (20 min)**
- Run: `npx @modelcontextprotocol/create-server@latest`
- Select: `cloudflare-remote` template
- Success: Project files generated, `npm install` completes
- Commit: `feat: initialize mcp-server-kit with cloudflare-remote template`

**F2: Configure wrangler.toml (20 min)**
- **PRE-STEP**: Create KV namespace in Cloudflare dashboard:
  ```bash
  wrangler kv:namespace create "CACHE"
  # Note the namespace ID for wrangler.toml
  ```
- Add KV namespace binding: `CACHE_KV` with namespace ID
- Set compatibility flags for Workers runtime
- Configure environment variables (non-secret bindings)
- Success: `wrangler dev` starts local development server
- Commit: `feat: configure wrangler.toml with KV namespace`

**F3: Set up TypeScript strict mode (25 min)**
- Enable strict mode in `tsconfig.json`
- Create `src/types/env.ts` with Env interface
- Create `src/types/errors.ts` with ErrorResponse interface
- Success: TypeScript compiler passes with strict mode
- Commit: `feat: enable TypeScript strict mode and base types`

**F4: Implement health check (25 min)**
- Create `src/health.ts` with `/health` endpoint handler
- Return: `{status, timestamp, version, services: {tango_api, cache_kv}}`
- **ENHANCED**: Include Tango API ping test to verify API key and reachability
- **ENHANCED**: Include KV namespace accessibility check
- Deploy to Cloudflare Workers: `npm run deploy`
- Success: `curl https://your-worker.workers.dev/health` returns 200 OK with dependency status
- Commit: `feat: add health check endpoint with dependency status`

**F5: Set up test infrastructure (25 min) [NEW TASK]**
- Configure Vitest in `wrangler.toml` and `vitest.config.ts`
- Create test directory structure: `tests/unit/`, `tests/integration/`
- Set up YAML test spec loader for mcp-server-kit
- Add mock Workers environment for testing
- Validate test framework works with Workers runtime
- Success: `npm run test:unit` executes (even with 0 tests)
- Commit: `feat: set up test infrastructure (Vitest + YAML specs)`

**Integration Checkpoint CP1 (Enhanced)**:
```bash
# Validate health check
curl https://your-worker.workers.dev/health | jq .

# Expected output:
# {
#   "status": "healthy",
#   "timestamp": "2025-11-18T10:30:00Z",
#   "version": "1.0.0",
#   "services": {
#     "tango_api": "reachable",
#     "cache_kv": "available"
#   }
# }

# Validate KV namespace access
wrangler kv:key put test-key "test-value" --namespace-id=<CACHE_KV_id>
wrangler kv:key get test-key --namespace-id=<CACHE_KV_id>
# Expected: "test-value"

# Validate test framework
npm run test:unit
# Expected: "No tests found" or tests pass

# Merge to main
git checkout main
git merge foundation --no-ff -m "Merge foundation: project scaffolding and test infrastructure complete"
git push origin main
```

---

### Stream 2: API Client & Types

**Purpose**: Build type-safe Tango API client with error handling, rate limiting, and normalization
**Worktree**: `worktree/api-client`
**Branch**: `api-client`
**Dependencies**: F3 (base types) completed

#### Task Execution Order

**S2.1: Define Tango API response types (45 min) [EXTENDED FROM 30 MIN]**
- Create `src/types/tango-api.ts`
- Define interfaces with nested structures:
  - `TangoContractResponse` (FPDS fields)
  - `TangoGrantResponse` (with recipient details)
  - `TangoVendorResponse` (SAM.gov format)
  - `TangoOpportunityResponse` (solicitation fields)
  - `TangoSpendingResponse` (aggregation results)
- Success: TypeScript validates all interface definitions
- Commit: `feat: add Tango API response type definitions`

**S2.2: Implement TangoApiClient (30 min)**
- Create `src/api/tango-client.ts`
- Implement `TangoApiClient` class with:
  - `get<T>(endpoint, params, apiKey): Promise<T>`
  - URL building with `URLSearchParams`
  - Basic fetch wrapper
- Success: Class compiles, basic GET request structure validated
- Commit: `feat: implement TangoApiClient with fetch wrapper`

**S2.3: Add timeout handling (20 min)**
- Add `AbortController` with 30-second timeout
- Handle `AbortError` and convert to structured error
- Test timeout behavior manually
- Success: Request aborts after 30s, returns timeout error
- Commit: `feat: add 30-second timeout with AbortController`

**S2.4: Implement rate limiting (20 min)**
- Create `src/utils/rate-limiter.ts`
- Implement per-worker timestamp-based rate limiting (100ms)
- Integrate into `TangoApiClient.get()`
- Success: Consecutive calls are delayed by 100ms
- Commit: `feat: add per-worker rate limiting (100ms)`

**S2.5a: Implement structured error handling (15 min) [SPLIT FROM S2.5]**
- Create error types in `src/types/errors.ts`:
  - `AuthenticationError`, `ValidationError`, `ApiError`, `TimeoutError`
- Add error recovery suggestions
- Success: All error types map to structured ErrorResponse
- Commit: `feat: implement structured error handling`

**S2.5b: Create response normalization utilities (25 min) [SPLIT FROM S2.5]**
- Create `src/utils/normalizer.ts`
- Implement normalization functions for all 5 endpoints:
  - Field fallback logic (handle missing/null fields)
  - Date format standardization
  - Amount parsing with fallbacks
  - Nested field extraction
- Success: Normalized responses have consistent structure
- Commit: `feat: implement response normalization for all endpoints`

**S2.6: Create unit tests (20 min)**
- Create `tests/unit/api-client.test.ts`
- Test cases:
  - Timeout triggers after 30s
  - Rate limiting delays requests
  - Error responses are structured
  - Normalization handles missing fields
- Success: All unit tests pass
- Commit: `test: add unit tests for API client`

**S2.7: Integration test with real API (15 min)**
- Create `tests/integration/tango-api.test.ts`
- Make real API call to Tango (simple contract search)
- Validate response structure matches types
- **OPTIONAL**: If Tango API unavailable, use mock responses (don't block)
- Success: Real API call succeeds, response matches types
- Commit: `test: add integration test with real Tango API`

**Integration Checkpoint CP2 (Enhanced)**:
```bash
# Run tests
npm test

# Expected: All tests pass

# Validate timeout handling (manual)
# Trigger deliberate timeout by using invalid endpoint
curl -X POST https://worker.dev/test-timeout

# Merge to main
git checkout main
git merge api-client --no-ff -m "Merge api-client: type-safe API client with normalization"
git push origin main
```

---

### Stream 3: MCP Tools Implementation

**Purpose**: Implement all 5 MCP tool handlers with input validation and schema
**Worktree**: `worktree/tools`
**Branch**: `tools`
**Dependencies**: S2.5b (API client + normalization) completed

#### Task Execution Order

**S3.1: Define tool argument interfaces (35 min) [EXTENDED FROM 25 MIN]**
- Create `src/types/tool-args.ts`
- Define interfaces:
  - `SearchContractsArgs`
  - `SearchGrantsArgs`
  - `GetVendorProfileArgs`
  - `SearchOpportunitiesArgs`
  - `GetSpendingSummaryArgs`
- All fields optional for agent flexibility
- Success: TypeScript validates all argument interfaces
- Commit: `feat: define tool argument type interfaces`

**S3.2: Implement search_tango_contracts (25 min)**
- Create `src/tools/search-contracts.ts`
- Implement tool handler:
  - Parse and validate arguments
  - Build Tango API query parameters
  - Call `TangoApiClient.get()`
  - Return MCP-formatted response
- Test manually with sample arguments
- Success: Tool returns valid contract data
- Commit: `feat: implement search_tango_contracts tool`

**S3.3: Implement search_tango_grants (20 min)**
- Create `src/tools/search-grants.ts`
- Follow same pattern as contracts tool
- Map grant-specific parameters
- **ENHANCED**: Implement client-side filtering for recipient_name and amount ranges
- Success: Tool returns valid grant data with filters working
- Commit: `feat: implement search_tango_grants tool with client-side filtering`

**S3.4: Implement get_tango_vendor_profile (20 min)**
- Create `src/tools/get-vendor-profile.ts`
- Handle UEI-based lookup
- Return detailed vendor information
- Success: Tool returns complete vendor profile
- Commit: `feat: implement get_tango_vendor_profile tool`

**S3.5: Implement search_tango_opportunities (20 min)**
- Create `src/tools/search-opportunities.ts`
- Support solicitation search filters
- Return active opportunities
- Success: Tool returns opportunity data
- Commit: `feat: implement search_tango_opportunities tool`

**S3.6: Implement get_tango_spending_summary (20 min)**
- Create `src/tools/get-spending-summary.ts`
- Handle aggregation parameters
- Return spending analytics
- Success: Tool returns spending summaries
- Commit: `feat: implement get_tango_spending_summary tool`

**S3.7a: Define JSON Schema inputSchema (20 min) [NEW TASK]**
- Create JSON Schema definitions for all 5 tools
- Specify:
  - Required vs optional fields
  - Field types (string, number, date)
  - Format constraints (date format, UEI pattern)
  - Value ranges (limit: 1-100)
- Integrate schemas into tool registration
- Success: MCP protocol includes inputSchema for all tools
- Commit: `feat: add JSON Schema inputSchema for all tools`

**S3.7: Add input sanitization (25 min)**
- Create `src/middleware/sanitization.ts`
- Implement sanitization for:
  - SQL injection patterns
  - XSS patterns
  - Path traversal
- Apply to all tool handlers
- Success: Malicious inputs are sanitized/rejected
- Commit: `feat: add input sanitization middleware`

**S3.8: Create tool descriptions (45 min) [EXTENDED FROM 30 MIN]**
- Write comprehensive tool descriptions for all 5 tools
- Include:
  - Data source (FPDS, SAM.gov, etc.)
  - Supported filters with examples
  - Parameter format specifications
  - Use case examples
- Success: Tool descriptions are agent-friendly
- Commit: `docs: add comprehensive tool descriptions with examples`

**S3.9: Implement response envelope (20 min)**
- Create `src/types/tool-response.ts`
- Define `ToolResponse<T>` interface with:
  - `data`, `total`, `returned`
  - `filters`, `pagination`
  - `execution` (duration, cached, api_calls)
- Apply to all tool responses
- Success: All tools return consistent response format
- Commit: `feat: implement standardized tool response envelope`

**S3.10: Add actionable error messages (15 min)**
- Update error responses with:
  - Specific error codes
  - Recovery suggestions
  - Parameter hints
- Test error scenarios for each tool
- Success: Errors provide clear recovery guidance
- Commit: `feat: add actionable error messages with recovery hints`

**Integration Checkpoint CP3 (Enhanced with Individual Tests)**:
```bash
# Test each tool individually (allows partial success)
for tool in search_tango_contracts search_tango_grants get_tango_vendor_profile search_tango_opportunities get_tango_spending_summary; do
  echo "Testing $tool..."
  npm run test:tool -- $tool || echo "FAILED: $tool"
done

# Expected: All tools pass individual tests

# Validate MCP response format
npm run test:tools:format
# Expected: All responses match MCP protocol

# Merge to main (partial merge if some tools fail)
git checkout main
git merge tools --no-ff -m "Merge tools: all 5 MCP tools functional"
git push origin main

# If partial failures, document broken tools:
# git merge tools --no-ff -- src/tools/working-tool1.ts src/tools/working-tool2.ts
# Fix broken tools in follow-up commit
```

---

### Stream 4: Caching & Performance

**Purpose**: Implement KV-based caching with 5-minute TTL
**Worktree**: `worktree/caching`
**Branch**: `caching`
**Dependencies**: S3.10 (tools functional) completed, CP3 merged

#### Task Execution Order

**S4.1: Implement cache key generation (20 min)**
- Create `src/utils/cache-key.ts`
- Implement `generateCacheKey(tool_name, args)`:
  - Sort parameters alphabetically
  - Hash with SHA-256
  - Format: `tool_name:hash`
- Test key consistency
- Success: Same args produce same key
- Commit: `feat: implement cache key generation with hashing`

**S4.2: Add KV cache-aside pattern (25 min)**
- Create `src/cache/kv-cache.ts`
- Implement cache wrapper:
  - Check KV for cached response
  - If miss, call tool handler
  - Store success responses only
- **NOTE**: Tools must be merged to main before editing tool files
- Integrate into all 5 tool handlers
- Success: Cache checks happen before API calls
- Commit: `feat: implement KV cache-aside pattern for all tools`

**S4.3: Configure 5-minute TTL (15 min)**
- Set `expirationTtl: 300` on all KV puts
- Add logic to cache only successful responses
- Test cache expiration manually (wait 5+ min)
- Success: Cached entries expire after 5 minutes
- Commit: `feat: configure 5-minute TTL and cache-only-success`

**S4.4: Add cache metrics (20 min)**
- Update `execution` metadata in tool responses:
  - `cached: true/false`
  - `api_calls: number`
  - `duration_ms: number`
- Log cache hits/misses
- Success: Response metadata shows cache status
- Commit: `feat: add cache hit/miss metrics to responses`

**S4.5: Test cache behavior (20 min)**
- Create `tests/integration/cache.test.ts`
- Test cases:
  - First call misses cache, second hits
  - Cache expires after 5 minutes
  - Error responses not cached
- Success: Cache hit rate >70% on repeated queries
- Commit: `test: validate cache behavior (hit, miss, expiration)`

**Integration Checkpoint CP4**:
```bash
# Run cache tests
npm run test:cache

# Expected: Cache hit rate >70%

# Validate TTL expiration (manual)
# Make request, wait 5+ min, verify cache miss

# Validate metrics
curl -X POST https://worker.dev/mcp -d '{"tool": "search_contracts"}' | jq '.execution'
# Expected: {cached: false, api_calls: 1, duration_ms: 800}

# Merge to main
git checkout main
git merge caching --no-ff -m "Merge caching: KV caching active with 5min TTL"
git push origin main
```

---

### Stream 5: Testing & Documentation

**Purpose**: Comprehensive testing, observability, and documentation
**Worktree**: `worktree/testing`
**Branch**: `testing`
**Dependencies**: S3.10 (tools complete) for integration tests

#### Task Execution Order

**S5.1: Create integration test YAML specs (50 min) [EXTENDED FROM 30 MIN]**
- Create `tests/integration/*.yaml` for all 5 tools
- Define test cases (3 scenarios per tool = 15 total):
  - Happy path with various filters
  - Error scenarios (auth, validation)
  - Edge cases (empty results, max limits)
- Success: YAML specs cover all tool scenarios
- Commit: `test: add integration test YAML specs for all tools`

**S5.2: Write unit tests (25 min)**
- Create `tests/unit/tools/*.test.ts`
- Test each tool handler:
  - Argument validation
  - Response formatting
  - Error handling
- Success: All unit tests pass
- Commit: `test: add unit tests for all tool handlers`

**S5.3: Add error handling tests (20 min)**
- Create `tests/unit/errors.test.ts`
- Test cases:
  - Missing API key → AuthenticationError
  - Invalid date format → ValidationError
  - Timeout → TimeoutError
  - API 429 → ApiError with retry_after
- Success: All error types tested
- Commit: `test: add comprehensive error handling tests`

**S5.4: Implement observability logging (20 min)**
- Create `src/utils/logger.ts`
- Structured JSON logging with:
  - `timestamp`, `level`, `message`, `context`
  - Performance metrics
  - Error details
- Integrate into all tool handlers
- Success: All requests logged with context
- Commit: `feat: implement structured JSON logging`

**S5.5: Create README (40 min) [EXTENDED FROM 25 MIN]**
- Write `README.md` with sections:
  - Overview and features
  - Setup instructions
  - Deployment guide
  - Tool usage examples
  - Agent integration guide
- Success: New developer can deploy in <30 min
- Commit: `docs: add comprehensive README with setup guide`

**S5.6: End-to-end agent validation (10 min)**
- Test with Claude Code agent:
  - Agent discovers tools without help
  - Agent composes workflows (search → detail)
  - Agent recovers from errors
- Success: Agent completes sample queries successfully
- Commit: `test: validate end-to-end agent usage`

**Integration Checkpoint CP5 (MVP Complete)**:
```bash
# Run full test suite
npm run test:all

# Expected: All tests pass, coverage >80%

# Validate with mcp-server-kit
npx mcp-server-kit validate --strict

# Deploy to production
npm run deploy

# Validate with agent
# (Manual test with Claude Code)

# Merge to main
git checkout main
git merge testing --no-ff -m "Merge testing: MVP complete and validated"
git push origin main
git tag v1.0.0
git push origin v1.0.0
```

---

## Section 4: Integration Timeline (Corrected Dependencies)

### Parallel Execution Schedule (Realistic)

```
Time    | Foundation | API Client | Tools      | Caching    | Testing    |
--------|------------|------------|------------|------------|------------|
0-20m   | F1         | BLOCKED    | BLOCKED    | BLOCKED    | BLOCKED    |
20-40m  | F2         | BLOCKED    | BLOCKED    | BLOCKED    | BLOCKED    |
40-65m  | F3         | BLOCKED    | BLOCKED    | BLOCKED    | BLOCKED    |
65-90m  | F4         | BLOCKED    | BLOCKED    | BLOCKED    | BLOCKED    |
90-115m | F5 (NEW)   | BLOCKED    | BLOCKED    | BLOCKED    | BLOCKED    |
--------|------------|------------|------------|------------|------------|
115m    | CP1: MERGE FOUNDATION TO MAIN (includes test harness)           |
--------|------------|------------|------------|------------|------------|
115-160m| IDLE       | S2.1       | BLOCKED    | BLOCKED    | BLOCKED    |
160-190m| IDLE       | S2.2       | BLOCKED    | BLOCKED    | BLOCKED    |
190-210m| IDLE       | S2.3       | BLOCKED    | BLOCKED    | BLOCKED    |
210-230m| IDLE       | S2.4       | BLOCKED    | BLOCKED    | BLOCKED    |
230-245m| IDLE       | S2.5a      | BLOCKED    | BLOCKED    | BLOCKED    |
245-270m| IDLE       | S2.5b      | BLOCKED    | BLOCKED    | BLOCKED    |
270-290m| IDLE       | S2.6       | BLOCKED    | BLOCKED    | BLOCKED    |
290-305m| IDLE       | S2.7       | BLOCKED    | BLOCKED    | BLOCKED    |
--------|------------|------------|------------|------------|------------|
305m    | CP2: MERGE API-CLIENT TO MAIN                                   |
--------|------------|------------|------------|------------|------------|
305-340m| IDLE       | IDLE       | S3.1       | BLOCKED    | BLOCKED    |
340-365m| IDLE       | IDLE       | S3.2       | BLOCKED    | BLOCKED    |
365-385m| IDLE       | IDLE       | S3.3       | BLOCKED    | BLOCKED    |
385-405m| IDLE       | IDLE       | S3.4       | BLOCKED    | BLOCKED    |
405-425m| IDLE       | IDLE       | S3.5       | BLOCKED    | BLOCKED    |
425-445m| IDLE       | IDLE       | S3.6       | BLOCKED    | BLOCKED    |
445-465m| IDLE       | IDLE       | S3.7a      | BLOCKED    | BLOCKED    |
465-490m| IDLE       | IDLE       | S3.7       | BLOCKED    | BLOCKED    |
490-535m| IDLE       | IDLE       | S3.8       | BLOCKED    | S5.1       |
535-555m| IDLE       | IDLE       | S3.9       | BLOCKED    | S5.1       |
555-570m| IDLE       | IDLE       | S3.10      | BLOCKED    | S5.1       |
--------|------------|------------|------------|------------|------------|
570m    | CP3: MERGE TOOLS TO MAIN                                        |
--------|------------|------------|------------|------------|------------|
570-590m| IDLE       | IDLE       | IDLE       | S4.1       | S5.2       |
590-615m| IDLE       | IDLE       | IDLE       | S4.2       | S5.2       |
615-630m| IDLE       | IDLE       | IDLE       | S4.3       | S5.3       |
630-650m| IDLE       | IDLE       | IDLE       | S4.4       | S5.3       |
650-670m| IDLE       | IDLE       | IDLE       | S4.5       | S5.4       |
--------|------------|------------|------------|------------|------------|
670m    | CP4: MERGE CACHING TO MAIN                                      |
--------|------------|------------|------------|------------|------------|
670-710m| IDLE       | IDLE       | IDLE       | IDLE       | S5.5       |
710-720m| IDLE       | IDLE       | IDLE       | IDLE       | S5.6       |
--------|------------|------------|------------|------------|------------|
720m    | CP5: MERGE TESTING TO MAIN - MVP COMPLETE (12 hours)           |
--------|------------|------------|------------|------------|------------|
```

**Total Time**: ~12 hours (720 minutes) base + 2 hours validation buffer = **12-14 hours realistic**
**Sequential Time**: ~20 hours (would be 40-60% longer)
**Efficiency Gain**: 40% time reduction through parallelization

---

### Merge Sequence and Enhanced Validation

**Checkpoint 1: Foundation (115 min)**
```bash
# Merge foundation branch
git checkout main
git merge foundation --no-ff

# Validate health check
curl https://your-worker.workers.dev/health | jq .
# Expected: 200 OK with services status

# Validate KV namespace access
wrangler kv:key put test-key "test-value" --namespace-id=<CACHE_KV_id>
wrangler kv:key get test-key --namespace-id=<CACHE_KV_id>
# Expected: "test-value"

# Validate environment bindings
curl https://worker.dev/health | jq '.services'
# Expected: {tango_api: "reachable", cache_kv: "available"}

# Validate test framework
npm run test:unit
# Expected: Test framework runs

# Test deployment
wrangler tail  # Monitor logs

# If validation passes, push
git push origin main
```

**Checkpoint 2: API Client (305 min)**
```bash
# Merge api-client branch
git checkout main
git merge api-client --no-ff

# Validate unit tests
npm run test:unit
# Expected: All API client tests pass

# Validate integration test
npm run test:integration -- tango-api
# Expected: Real API call succeeds (or documented as unavailable)

# Validate timeout handling (trigger deliberate timeout)
# Use invalid endpoint to force timeout

# If validation passes, push
git push origin main
```

**Checkpoint 3: Tools (570 min)**
```bash
# Merge tools branch
git checkout main
git merge tools --no-ff

# Validate each tool individually
for tool in search_tango_contracts search_tango_grants get_tango_vendor_profile search_tango_opportunities get_tango_spending_summary; do
  echo "Testing $tool..."
  npm run test:tool -- $tool || echo "FAILED: $tool"
done
# Expected: All 5 tools pass

# Validate MCP response format
npm run test:tools:format
# Expected: All responses match MCP protocol

# Manual test each tool
curl -X POST https://your-worker.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{"tool": "search_tango_contracts", "args": {"limit": 5}}'

# If all pass, push
git push origin main

# If partial failures (e.g., 4/5 tools work):
# Option: Merge working tools only, fix broken ones separately
# git merge tools --no-ff -- src/tools/working-tool1.ts src/tools/working-tool2.ts
```

**Checkpoint 4: Caching (670 min)**
```bash
# Merge caching branch
git checkout main
git merge caching --no-ff

# Validate cache behavior
npm run test:cache
# Expected: Cache hit rate >70%

# Test TTL expiration (manual)
# Make request, wait 5+ min, verify cache miss

# Validate metrics in response
curl -X POST https://worker.dev/mcp -d '{"tool": "search_contracts"}' | jq '.execution'
# Expected: {cached: false/true, api_calls: N, duration_ms: N}

# If validation passes, push
git push origin main
```

**Checkpoint 5: MVP Complete (720 min)**
```bash
# Merge testing branch
git checkout main
git merge testing --no-ff

# Run full test suite
npm run test:all
# Expected: All tests pass, coverage >80%

# Validate with mcp-server-kit
npx mcp-server-kit validate --strict
# Expected: No errors

# Deploy to production
npm run deploy

# Validate with Claude Code agent (manual)
# Test:
# 1. Agent discovers tools without help
# 2. Agent composes workflows (search → detail)
# 3. Agent recovers from errors

# Tag release
git tag -a v1.0.0 -m "MVP release: Tango MCP Server"
git push origin main --tags
```

---

## Section 5: Enhanced Validation Strategy

### Unit Testing (Continuous)

**Run After Every Commit**:
```bash
npm run test:unit
```

**Coverage Requirements**:
- All tool handlers: 100% coverage
- API client: 100% coverage
- Error handling: 100% coverage
- Utility functions: 90%+ coverage

**Test Categories**:
1. **Type Validation**: Ensure TypeScript types compile
2. **Logic Tests**: Function behavior with various inputs
3. **Error Handling**: All error paths covered
4. **Edge Cases**: Empty results, max limits, invalid formats

---

### Integration Testing (At Checkpoints)

**CP1: Foundation**
- Health check endpoint returns 200
- Wrangler deployment succeeds
- **ENHANCED**: KV namespace accessible via test key
- **ENHANCED**: Environment variables accessible (TANGO_API_KEY)
- **ENHANCED**: Test framework runs (Vitest)

**CP2: API Client**
- Real Tango API call succeeds (or mock available)
- Timeout triggers at 30s
- Rate limiting enforces 100ms delay
- Errors are structured correctly
- **ENHANCED**: Normalization handles missing fields
- **ENHANCED**: Timeout validation (trigger deliberate timeout)

**CP3: Tools**
- **ENHANCED**: Each tool tested individually (allows partial success)
- All 5 tools return valid MCP responses
- Input sanitization blocks malicious input
- Tool descriptions are comprehensive
- Response envelopes are consistent
- **ENHANCED**: JSON Schema validation working
- **ENHANCED**: Client-side filtering working (grants tool)

**CP4: Caching**
- Cache hit/miss behavior correct
- TTL expires after 5 minutes
- Only success responses cached
- Cache key collisions don't occur
- **ENHANCED**: Metrics showing cache status in responses

**CP5: Complete MVP**
- All integration tests pass
- YAML test specs validate successfully
- Agent can use tools without errors
- Performance targets met (P50 <1s uncached, <200ms cached)
- **ENHANCED**: mcp-server-kit validation passes
- **ENHANCED**: README tested by new developer

---

### Validation Criteria Before Merge

**Pre-Merge Checklist**:
- [ ] All unit tests pass
- [ ] Integration tests pass for this stream
- [ ] TypeScript compiles with strict mode
- [ ] No linting errors (`npm run lint`)
- [ ] Documentation updated (if public APIs changed)
- [ ] Commit messages follow convention (feat/fix/test/docs)

**Performance Validation**:
- [ ] P50 response time <1000ms (uncached)
- [ ] P50 response time <200ms (cached)
- [ ] Cache hit rate >70% on repeated queries
- [ ] Rate limiting prevents API overuse

**Security Validation**:
- [ ] API keys not in source code
- [ ] Input sanitization blocks injection attacks
- [ ] Error messages don't leak sensitive data
- [ ] HTTPS enforced for all requests

---

## Section 6: Rollback Procedures (NEW)

### Recovery Strategies for Failed Checkpoints

#### Option 1: Revert Merge (Use Immediately After Failed Merge)

**When to Use**: Checkpoint validation fails immediately after merge, no additional work done on main

```bash
# Revert the failed merge commit
git reset --hard HEAD~1

# WARNING: Only safe if no one else has pulled the merge
# Coordinate with team before force pushing
git push origin main --force

# Fix issues in feature branch
git checkout <feature-branch>
# Make fixes, commit
git checkout main
# Retry merge after fixes
```

**Risk**: Destructive, loses merge commit
**Best For**: Immediate failures, solo developer

---

#### Option 2: Fix Forward (Preferred)

**When to Use**: Checkpoint validation fails but main is stable, or others have pulled

```bash
# Create hotfix branch from main
git checkout main
git checkout -b hotfix/cp<N>-<issue>

# Fix the issues
# ... make changes ...
git add .
git commit -m "fix: resolve CP<N> validation failure (<issue>)"

# Merge hotfix to main
git checkout main
git merge hotfix/cp<N>-<issue> --no-ff -m "Merge hotfix: resolve CP<N> issues"

# Validate again
npm run test:all

# If validation passes, push
git push origin main
git branch -d hotfix/cp<N>-<issue>
```

**Risk**: Low, maintains history
**Best For**: Most scenarios, team environments

---

#### Option 3: Partial Merge (For Tools Stream)

**When to Use**: Some tools work, some fail at CP3

```bash
# Scenario: 3 tools pass, 2 tools fail

# Merge only working tool files
git checkout main
git merge tools --no-ff --no-commit
# Unstage broken tools
git reset HEAD src/tools/broken-tool1.ts src/tools/broken-tool2.ts
git checkout -- src/tools/broken-tool1.ts src/tools/broken-tool2.ts
# Complete merge with partial content
git commit -m "Merge tools: 3 of 5 tools functional (contracts, grants, vendor)"

# Fix broken tools separately
git checkout tools
# Fix broken-tool1.ts and broken-tool2.ts
git add src/tools/broken-tool1.ts src/tools/broken-tool2.ts
git commit -m "fix: repair opportunities and spending tools"

# Merge fixes
git checkout main
git merge tools --no-ff -m "Merge tools: add opportunities and spending tools"

# Validate all 5 tools now work
npm run test:tools
```

**Risk**: Medium, requires careful file selection
**Best For**: CP3 (tools stream) when some tools fail

---

### Checkpoint-Specific Rollback Procedures

#### CP1: Foundation Rollback

**Failure Scenario**: Health check fails, KV inaccessible, test framework broken

**Recovery**:
```bash
# Option 1: Revert (if just merged)
git reset --hard HEAD~1
git push origin main --force

# Option 2: Fix forward
git checkout -b hotfix/cp1-foundation
# Fix wrangler.toml, health.ts, or test setup
git commit -m "fix: resolve KV binding issue"
git checkout main
git merge hotfix/cp1-foundation --no-ff

# Validate
curl https://worker.dev/health
wrangler kv:key get test-key --namespace-id=<id>
npm run test:unit
```

**Common Issues**:
- KV namespace ID incorrect in wrangler.toml
- Health check not testing KV/API correctly
- Test framework incompatible with Workers

---

#### CP2: API Client Rollback

**Failure Scenario**: Unit tests fail, Tango API unreachable, normalization bugs

**Recovery**:
```bash
# Option 2: Fix forward (preferred)
git checkout -b hotfix/cp2-api-client

# If Tango API unreachable: Add mock API responses
# Create tests/mocks/tango-api-responses.json
# Update integration test to use mocks if API unavailable

# If normalization bug: Fix src/utils/normalizer.ts
# Add unit tests for failing normalization case

git commit -m "fix: add API mocks and fix normalization"
git checkout main
git merge hotfix/cp2-api-client --no-ff

# Validate
npm run test:unit
npm run test:integration
```

**Common Issues**:
- Tango API key invalid or API down
- Normalization missing field fallbacks
- Timeout not triggering correctly

---

#### CP3: Tools Rollback

**Failure Scenario**: 1-2 tools fail validation, MCP format incorrect

**Recovery**:
```bash
# Option 3: Partial merge (recommended for CP3)

# If 4/5 tools work:
git checkout main
git merge tools --no-ff --no-commit
git reset HEAD src/tools/broken-tool.ts
git checkout -- src/tools/broken-tool.ts
git commit -m "Merge tools: 4 of 5 tools functional"

# Document broken tool
echo "- [ ] Fix broken-tool.ts (validation failing)" >> TODO.md
git add TODO.md
git commit -m "docs: document broken tool for follow-up"

# Fix broken tool separately
git checkout tools
# Fix src/tools/broken-tool.ts
git commit -m "fix: repair broken-tool validation"
git checkout main
git merge tools --no-ff -m "Merge tools: add broken-tool (fixed)"

# Validate all 5 tools
for tool in search_contracts search_grants get_vendor search_opps get_spending; do
  npm run test:tool -- $tool
done
```

**Common Issues**:
- Tool argument validation too strict/loose
- MCP response format missing required fields
- Input sanitization breaking valid inputs
- Tool descriptions unclear for agent

---

#### CP4: Caching Rollback

**Failure Scenario**: Cache hit rate <70%, TTL not expiring, cache key collisions

**Recovery**:
```bash
# Option 2: Fix forward (caching is additive, low risk)
git checkout -b hotfix/cp4-caching

# If cache hit rate low: Check cache key generation
# Ensure parameter sorting is deterministic
# Fix src/utils/cache-key.ts

# If TTL not expiring: Check KV expirationTtl setting
# Fix src/cache/kv-cache.ts

git commit -m "fix: ensure deterministic cache keys and correct TTL"
git checkout main
git merge hotfix/cp4-caching --no-ff

# Validate
npm run test:cache
# Make repeated requests, check hit rate >70%
```

**Common Issues**:
- Cache key generation not deterministic (parameter order)
- TTL not set correctly in KV put operations
- Error responses being cached
- Cache metrics not showing in responses

---

#### CP5: Testing Rollback

**Failure Scenario**: Integration tests fail, agent can't use tools, coverage <80%

**Recovery**:
```bash
# Option 2: Fix forward (tests don't break functionality)
git checkout -b hotfix/cp5-testing

# If integration tests fail: Fix test assertions
# Update tests/integration/*.yaml

# If agent validation fails: Improve tool descriptions
# Update src/tools/*/descriptions.ts

# If coverage low: Add missing tests
# Create tests/unit/missing-coverage.test.ts

git commit -m "fix: improve test coverage and tool descriptions"
git checkout main
git merge hotfix/cp5-testing --no-ff

# Validate
npm run test:all
npx mcp-server-kit validate --strict
# Retry agent validation
```

**Common Issues**:
- YAML test specs have incorrect expected values
- Tool descriptions missing critical info for agent
- Test coverage gaps in error handling
- Agent validation requires clearer error messages

---

### Partial Success Strategies

#### Strategy 1: MVP Reduction

**When to Use**: Late in timeline, critical tool failure

**Action**: Reduce MVP scope from 5 tools to 3-4 working tools

```bash
# Document reduced scope
echo "## MVP v1.0 (Reduced Scope)" > MVP_SCOPE.md
echo "Working tools: search_contracts, search_grants, get_vendor" >> MVP_SCOPE.md
echo "Deferred to v1.1: search_opportunities, get_spending" >> MVP_SCOPE.md

# Tag reduced MVP
git tag -a v1.0.0-mvp -m "MVP with 3 working tools"

# Plan v1.1 with missing tools
git checkout -b feature/v1.1-remaining-tools
# Fix broken tools
```

---

#### Strategy 2: Mock Fallback

**When to Use**: Tango API unavailable during development

**Action**: Use mock API responses, deploy with warning

```bash
# Create mock responses
mkdir tests/mocks
# Add tango-api-responses.json with sample data

# Update API client to use mocks if API unreachable
# Add env var: USE_MOCK_API=true

# Deploy with mock mode
wrangler publish --var USE_MOCK_API:true

# Document limitation
echo "⚠️ Deployed with mock API responses (Tango API unreachable)" >> DEPLOY.md
```

---

#### Strategy 3: Feature Flagging

**When to Use**: New feature (caching) has issues, need to deploy without it

**Action**: Add feature flag to disable caching

```bash
# Add env var: ENABLE_CACHING=false
# Update cache wrapper to check flag

# Deploy without caching
wrangler publish --var ENABLE_CACHING:false

# Fix caching issues
git checkout -b hotfix/caching-issues
# Fix bugs

# Re-enable caching after fix
wrangler publish --var ENABLE_CACHING:true
```

---

### Validation Failure Decision Tree

```
Checkpoint Validation Fails
         |
         v
    Is issue critical?
    /              \
  YES              NO
   |                |
   v                v
Can fix in        Continue with
<30 min?          warning/limitation
   |                |
   v                |
Fix forward        Document issue
(Option 2)         Tag release
   |               as BETA/RC
   v                |
Retry validation   |
   |               |
   v               v
Still fails?      Plan fix in
   |              next iteration
   v
Partial merge
(Option 3) or
Revert (Option 1)
```

---

## Section 7: Implementation Commands (Same as v1)

### Git Worktree Setup

**Initialize Repository**:
```bash
# Ensure you're in the project root
cd /Users/mikec/Tango-MCP

# Create main branch (if not exists)
git init
git checkout -b main
git commit --allow-empty -m "Initial commit"

# Create worktree directories
mkdir -p worktrees
```

**Create Worktrees for Each Stream**:
```bash
# Foundation worktree
git worktree add worktrees/foundation -b foundation
cd worktrees/foundation
# Work on F1-F5 tasks
# Commit regularly

# API Client worktree
git worktree add worktrees/api-client -b api-client main
cd worktrees/api-client
# Work on S2.1-S2.7 tasks
# Commit regularly

# Tools worktree
git worktree add worktrees/tools -b tools main
cd worktrees/tools
# Work on S3.1-S3.10 tasks
# Commit regularly

# Caching worktree
git worktree add worktrees/caching -b caching main
cd worktrees/caching
# Work on S4.1-S4.5 tasks
# Commit regularly

# Testing worktree
git worktree add worktrees/testing -b testing main
cd worktrees/testing
# Work on S5.1-S5.6 tasks
# Commit regularly
```

**List Active Worktrees**:
```bash
git worktree list
# Output:
# /Users/mikec/Tango-MCP                         abc123 [main]
# /Users/mikec/Tango-MCP/worktrees/foundation    def456 [foundation]
# /Users/mikec/Tango-MCP/worktrees/api-client    ghi789 [api-client]
# /Users/mikec/Tango-MCP/worktrees/tools         jkl012 [tools]
# /Users/mikec/Tango-MCP/worktrees/caching       mno345 [caching]
# /Users/mikec/Tango-MCP/worktrees/testing       pqr678 [testing]
```

---

### Branch Naming Convention

**Format**: `<stream>/<task-id>-<short-description>`

**Examples**:
- `foundation` (main stream branch)
- `api-client` (main stream branch)
- `tools` (main stream branch)
- `caching` (main stream branch)
- `testing` (main stream branch)

**Task-Level Branches** (optional, for complex tasks):
- `foundation/f5-test-setup`
- `api-client/s2.5b-normalization`
- `tools/s3.7a-json-schema`

**Convention Rules**:
- Stream branches: lowercase, hyphen-separated
- Task branches: `<stream>/<task-id>-<description>`
- Use descriptive names, not generic terms

---

### Merge Workflow Commands

**Checkpoint 1: Foundation → Main**
```bash
# In main worktree
cd /Users/mikec/Tango-MCP

# Update main
git checkout main
git pull origin main

# Merge foundation (no fast-forward)
git merge foundation --no-ff -m "Merge foundation: scaffolding, health check, and test infrastructure complete"

# Validate (see CP1 validation section)
npm test
curl https://your-worker.workers.dev/health
wrangler kv:key get test-key --namespace-id=<id>

# Push to remote
git push origin main

# Clean up foundation worktree (optional, keep for now)
# git worktree remove worktrees/foundation
```

**Checkpoint 2: API Client → Main**
```bash
# In main worktree
cd /Users/mikec/Tango-MCP
git checkout main
git pull origin main

# Merge api-client
git merge api-client --no-ff -m "Merge api-client: type-safe API client with normalization"

# Validate
npm run test:unit
npm run test:integration

# Push
git push origin main
```

**Checkpoint 3: Tools → Main**
```bash
cd /Users/mikec/Tango-MCP
git checkout main
git pull origin main

git merge tools --no-ff -m "Merge tools: all 5 MCP tools functional"

# Validate (individual tool tests)
for tool in search_contracts search_grants get_vendor search_opps get_spending; do
  npm run test:tool -- $tool
done

git push origin main
```

**Checkpoint 4: Caching → Main**
```bash
cd /Users/mikec/Tango-MCP
git checkout main
git pull origin main

git merge caching --no-ff -m "Merge caching: KV caching with 5min TTL active"

# Validate
npm run test:cache

git push origin main
```

**Checkpoint 5: Testing → Main (MVP Complete)**
```bash
cd /Users/mikec/Tango-MCP
git checkout main
git pull origin main

git merge testing --no-ff -m "Merge testing: MVP complete with full test coverage"

# Run full validation
npm run test:all
npx mcp-server-kit validate --strict
npm run deploy

# Tag release
git tag -a v1.0.0 -m "MVP Release: Tango MCP Server"
git push origin main --tags
```

---

### Handling Merge Conflicts

**If Conflicts Occur**:
```bash
# During merge
git merge <branch> --no-ff

# If conflicts:
# 1. Review conflicting files
git status

# 2. Resolve conflicts manually
# Edit files to resolve <<<<< ===== >>>>> markers

# 3. Stage resolved files
git add <resolved-files>

# 4. Complete merge
git commit -m "Merge <branch>: resolved conflicts in <files>"

# 5. Validate tests still pass
npm test
```

**Conflict Prevention Strategy**:
- Each worktree owns distinct files (see Section 2 ownership table)
- Shared types created in foundation, then read-only
- Communicate when touching shared files
- Merge frequently to avoid drift

---

### Clean Up Worktrees After Completion

**After MVP is Complete**:
```bash
# List all worktrees
git worktree list

# Remove completed worktrees
git worktree remove worktrees/foundation
git worktree remove worktrees/api-client
git worktree remove worktrees/tools
git worktree remove worktrees/caching
git worktree remove worktrees/testing

# Delete merged branches (optional)
git branch -d foundation
git branch -d api-client
git branch -d tools
git branch -d caching
git branch -d testing

# Verify only main branch remains
git branch
# Output: * main
```

---

## Summary

This final implementation plan enables **parallel development** with **minimal merge conflicts** and **robust recovery procedures** by:

1. **Clear Ownership**: Each worktree owns distinct files
2. **Corrected Dependencies**: S3 blocks until S2 completes (no false parallelism)
3. **Realistic Timing**: 12-14 hours with buffer for complex tasks
4. **Enhanced Validation**: Individual tests, KV checks, partial success strategies
5. **Rollback Procedures**: Three recovery options for each checkpoint
6. **Fast Feedback**: Validate every 1-2 commits
7. **Progressive Integration**: 5 integration checkpoints, not big-bang merge
8. **Small Tasks**: Every task is 20-45 minutes, testable increment

**Expected Outcomes**:
- MVP completed in ~12-14 hours (vs 20 hours sequential)
- High code quality through continuous testing
- Clean git history with meaningful merge commits
- Production-ready deployment at CP5
- 85% success probability (vs 60% without changes)

**Critical Improvements from v1**:
- Added test infrastructure setup (F5)
- Fixed dependency conflicts (S3 waits for S2)
- Realistic time estimates (+4 hours)
- Strengthened checkpoint validation
- Added comprehensive rollback procedures
- Partial success strategies for tool failures

**Next Steps**:
1. Create KV namespace in Cloudflare dashboard
2. Verify Tango API key is available
3. Set up git worktree directories
4. Execute F1-F5 in foundation worktree
5. Validate CP1 (health check + KV + test framework)
6. Proceed with S2 (API client) stream
7. Continue through CP2-CP5 with validation at each checkpoint
8. Use rollback procedures if validation fails
9. Deploy and validate with Claude Code agent

---

**Document Status**: APPROVED - Ready for Execution
**Estimated Completion**: 12-14 hours with 3-4 parallel developers
**Dependencies**: Tango API key, Cloudflare account with KV, Node.js 18+
**Risk Level**: MEDIUM (with rollback procedures)
**Success Probability**: 85%
