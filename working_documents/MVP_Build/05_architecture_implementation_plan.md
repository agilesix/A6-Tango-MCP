# Architecture Implementation Plan: Tango MCP Server MVP

**Version**: 1.0
**Date**: 2025-11-18
**Status**: Ready for Execution
**Estimated Total Time**: 6-8 hours (with 3-4 parallel streams)

---

## Executive Summary

This implementation plan uses **git worktrees** to enable parallel development across 5 independent streams. Each stream contains 20-30 minute tasks with clear integration points. The strategy maximizes throughput while minimizing merge conflicts through careful ownership boundaries.

**Key Metrics**:
- **Total Tasks**: 32 tasks
- **Sequential Time**: ~16 hours
- **Parallel Time**: ~6-8 hours (60% reduction)
- **Integration Points**: 5 major merges
- **Testing Frequency**: Every 1-2 commits

---

## Section 1: Work Breakdown Structure

### Stream 1: Foundation & Scaffolding (4 tasks, 90 min)

| Task ID | Task | Time | Dependencies | Concurrent With |
|---------|------|------|--------------|----------------|
| F1 | Initialize mcp-server-kit project with cloudflare-remote template | 20 min | None | All other streams blocked |
| F2 | Configure wrangler.toml with KV namespace bindings | 20 min | F1 | S2.1, S3.1 |
| F3 | Set up TypeScript strict mode and base interfaces (Env, ErrorResponse) | 25 min | F2 | S2.1, S3.1 |
| F4 | Implement health check endpoint and verify deployment | 25 min | F3 | S2.2, S3.2 |

**Validation**: Health check returns 200 OK on deployed Worker

---

### Stream 2: API Client & Types (7 tasks, 150 min)

| Task ID | Task | Time | Dependencies | Concurrent With |
|---------|------|------|--------------|----------------|
| S2.1 | Define Tango API response type interfaces (all 5 endpoints) | 30 min | F3 | F2, S3.1 |
| S2.2 | Implement TangoApiClient class with fetch wrapper | 30 min | S2.1 | F4, S3.2 |
| S2.3 | Add timeout handling with AbortController (30s limit) | 20 min | S2.2 | S3.3 |
| S2.4 | Implement per-worker rate limiting (100ms between calls) | 20 min | S2.3 | S3.4 |
| S2.5 | Add structured error handling and response normalization | 25 min | S2.4 | S3.5 |
| S2.6 | Create unit tests for API client (timeout, rate limit, errors) | 20 min | S2.5 | S3.6 |
| S2.7 | Integration test with real Tango API (health check) | 15 min | S2.6 | S3.7 |

**Validation**: API client successfully fetches data with rate limiting and timeout

---

### Stream 3: MCP Tools Implementation (10 tasks, 220 min)

| Task ID | Task | Time | Dependencies | Concurrent With |
|---------|------|------|--------------|----------------|
| S3.1 | Define tool argument interfaces for all 5 tools | 25 min | F3 | F2, S2.1 |
| S3.2 | Implement search_tango_contracts tool handler | 25 min | S3.1 | F4, S2.2 |
| S3.3 | Implement search_tango_grants tool handler | 20 min | S3.2 | S2.3 |
| S3.4 | Implement get_tango_vendor_profile tool handler | 20 min | S3.3 | S2.4 |
| S3.5 | Implement search_tango_opportunities tool handler | 20 min | S3.4 | S2.5 |
| S3.6 | Implement get_tango_spending_summary tool handler | 20 min | S3.5 | S2.6 |
| S3.7 | Add input sanitization middleware for all tools | 25 min | S3.6 | S2.7 |
| S3.8 | Create comprehensive tool descriptions with examples | 30 min | S3.7 | S4.1 |
| S3.9 | Implement tool response envelope (metadata, pagination, filters) | 20 min | S3.8 | S4.2 |
| S3.10 | Add actionable error messages with recovery suggestions | 15 min | S3.9 | S4.3 |

**Validation**: All 5 tools return valid MCP responses with proper formatting

---

### Stream 4: Caching & Performance (5 tasks, 100 min)

| Task ID | Task | Time | Dependencies | Concurrent With |
|---------|------|------|--------------|----------------|
| S4.1 | Implement cache key generation (tool_name:hash(params)) | 20 min | S3.8 | None (waits for tools) |
| S4.2 | Add KV cache-aside pattern for all tool handlers | 25 min | S4.1 | S3.9 |
| S4.3 | Configure 5-minute TTL and cache-only-success logic | 15 min | S4.2 | S3.10 |
| S4.4 | Add cache hit/miss metrics to response execution metadata | 20 min | S4.3 | S5.1 |
| S4.5 | Test cache behavior (hit, miss, expiration) | 20 min | S4.4 | S5.2 |

**Validation**: Cache hit rate >70% on repeated queries, TTL expires after 5 minutes

---

### Stream 5: Testing & Documentation (6 tasks, 130 min)

| Task ID | Task | Time | Dependencies | Concurrent With |
|---------|------|------|--------------|----------------|
| S5.1 | Create integration test YAML specs for all 5 tools | 30 min | S3.10 | S4.4 |
| S5.2 | Write unit tests for each tool handler | 25 min | S5.1 | S4.5 |
| S5.3 | Add error handling test cases (auth, validation, timeout) | 20 min | S5.2 | None |
| S5.4 | Implement observability logging (structured JSON) | 20 min | S5.3 | None |
| S5.5 | Create README with setup, deployment, and usage instructions | 25 min | S5.4 | None |
| S5.6 | End-to-end validation with Claude Code agent | 10 min | S5.5 | None |

**Validation**: All tests pass, agent can use tools without errors

---

## Section 2: Git Worktree Strategy

### Worktree Branches and Ownership

```
main (protected)
├── worktree/foundation     (F1-F4)    - Project scaffolding, config, health check
├── worktree/api-client     (S2.1-S2.7) - TangoApiClient, types, error handling
├── worktree/tools          (S3.1-S3.10)- All 5 MCP tool handlers
├── worktree/caching        (S4.1-S4.5) - KV caching layer
└── worktree/testing        (S5.1-S5.6) - Tests, docs, observability
```

### File Ownership (Prevents Merge Conflicts)

| Worktree | Owned Files/Directories | Touch-Only (Read) |
|----------|-------------------------|-------------------|
| `foundation` | `wrangler.toml`, `src/index.ts`, `src/types/env.ts`, `src/health.ts` | None |
| `api-client` | `src/api/tango-client.ts`, `src/types/tango-api.ts`, `src/types/errors.ts`, `src/utils/rate-limiter.ts` | `src/types/env.ts` |
| `tools` | `src/tools/*.ts`, `src/middleware/sanitization.ts` | `src/api/tango-client.ts`, `src/types/*.ts` |
| `caching` | `src/cache/*.ts`, `src/utils/cache-key.ts` | `src/tools/*.ts`, `src/api/*.ts` |
| `testing` | `tests/**/*.ts`, `tests/**/*.yaml`, `README.md`, `src/utils/logger.ts` | All src files |

**Conflict Prevention**: Each worktree owns distinct files. Shared types are created in foundation, then read-only in other worktrees.

---

### Integration Checkpoints

| Checkpoint | Merges | Validation | Estimated Time |
|------------|--------|------------|---------------|
| **CP1: Foundation Complete** | `foundation` → `main` | Health check deployed and returning 200 | After F4 (~90 min) |
| **CP2: API Client Ready** | `api-client` → `main` | Unit tests pass, real API call succeeds | After S2.7 (~150 min) |
| **CP3: Tools Functional** | `tools` → `main` | All 5 tools return valid responses | After S3.10 (~220 min) |
| **CP4: Caching Active** | `caching` → `main` | Cache hit rate >70%, TTL validated | After S4.5 (~100 min) |
| **CP5: MVP Complete** | `testing` → `main` | All tests pass, agent validation succeeds | After S5.6 (~130 min) |

**Merge Strategy**: Sequential integration, validate after each merge before proceeding.

---

## Section 3: Parallel Development Streams

### Stream 1: Foundation & Scaffolding

**Purpose**: Establish project structure, configuration, and deployment pipeline
**Worktree**: `worktree/foundation`
**Branch**: `foundation`

#### Task Execution Order

**F1: Initialize mcp-server-kit project (20 min)**
- Run: `npx @modelcontextprotocol/create-server@latest`
- Select: `cloudflare-remote` template
- Success: Project files generated, `npm install` completes
- Commit: `feat: initialize mcp-server-kit with cloudflare-remote template`

**F2: Configure wrangler.toml (20 min)**
- Add KV namespace binding: `CACHE_KV`
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
- Deploy to Cloudflare Workers: `npm run deploy`
- Success: `curl https://your-worker.workers.dev/health` returns 200 OK
- Commit: `feat: add health check endpoint and deploy`

**Integration Checkpoint CP1**:
```bash
# Validate health check
curl https://your-worker.workers.dev/health | jq .

# Expected output:
# {
#   "status": "healthy",
#   "timestamp": "2025-11-18T10:30:00Z",
#   "version": "1.0.0"
# }

# Merge to main
git checkout main
git merge foundation --no-ff -m "Merge foundation: project scaffolding complete"
git push origin main
```

---

### Stream 2: API Client & Types

**Purpose**: Build type-safe Tango API client with error handling and rate limiting
**Worktree**: `worktree/api-client`
**Branch**: `api-client`
**Dependencies**: F3 (base types) completed

#### Task Execution Order

**S2.1: Define Tango API response types (30 min)**
- Create `src/types/tango-api.ts`
- Define interfaces:
  - `TangoContractResponse`
  - `TangoGrantResponse`
  - `TangoVendorResponse`
  - `TangoOpportunityResponse`
  - `TangoSpendingResponse`
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

**S2.5: Add structured error handling (25 min)**
- Create error types in `src/types/errors.ts`:
  - `AuthenticationError`, `ValidationError`, `ApiError`, `TimeoutError`
- Implement response normalization (Tango format → internal format)
- Add error recovery suggestions
- Success: All error types map to structured ErrorResponse
- Commit: `feat: implement structured error handling with normalization`

**S2.6: Create unit tests (20 min)**
- Create `tests/unit/api-client.test.ts`
- Test cases:
  - Timeout triggers after 30s
  - Rate limiting delays requests
  - Error responses are structured
- Success: All unit tests pass
- Commit: `test: add unit tests for API client`

**S2.7: Integration test with real API (15 min)**
- Create `tests/integration/tango-api.test.ts`
- Make real API call to Tango (simple contract search)
- Validate response structure
- Success: Real API call succeeds, response matches types
- Commit: `test: add integration test with real Tango API`

**Integration Checkpoint CP2**:
```bash
# Run tests
npm test

# Expected: All tests pass

# Merge to main
git checkout main
git merge api-client --no-ff -m "Merge api-client: type-safe API client ready"
git push origin main
```

---

### Stream 3: MCP Tools Implementation

**Purpose**: Implement all 5 MCP tool handlers with input validation
**Worktree**: `worktree/tools`
**Branch**: `tools`
**Dependencies**: S2.5 (API client) completed

#### Task Execution Order

**S3.1: Define tool argument interfaces (25 min)**
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
- Success: Tool returns valid grant data
- Commit: `feat: implement search_tango_grants tool`

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

**S3.7: Add input sanitization (25 min)**
- Create `src/middleware/sanitization.ts`
- Implement sanitization for:
  - SQL injection patterns
  - XSS patterns
  - Path traversal
- Apply to all tool handlers
- Success: Malicious inputs are sanitized/rejected
- Commit: `feat: add input sanitization middleware`

**S3.8: Create tool descriptions (30 min)**
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

**Integration Checkpoint CP3**:
```bash
# Test all 5 tools manually
npm run test:tools

# Expected: All tools return valid MCP responses

# Merge to main
git checkout main
git merge tools --no-ff -m "Merge tools: all 5 MCP tools functional"
git push origin main
```

---

### Stream 4: Caching & Performance

**Purpose**: Implement KV-based caching with 5-minute TTL
**Worktree**: `worktree/caching`
**Branch**: `caching`
**Dependencies**: S3.7 (tools functional) completed

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
**Dependencies**: S4.5 (caching complete) completed

#### Task Execution Order

**S5.1: Create integration test YAML specs (30 min)**
- Create `tests/integration/*.yaml` for all 5 tools
- Define test cases:
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

**S5.5: Create README (25 min)**
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

# Deploy to production
npm run deploy

# Validate with agent
# (Manual test with Claude Code)

# Merge to main
git checkout main
git merge testing --no-ff -m "Merge testing: MVP complete and validated"
git push origin main
git tag v1.0.0
```

---

## Section 4: Integration Timeline

### Parallel Execution Schedule

```
Time    | Foundation | API Client | Tools      | Caching    | Testing    |
--------|------------|------------|------------|------------|------------|
0-20m   | F1         | BLOCKED    | BLOCKED    | BLOCKED    | BLOCKED    |
20-40m  | F2         | S2.1       | S3.1       | BLOCKED    | BLOCKED    |
40-65m  | F3         | S2.1       | S3.1       | BLOCKED    | BLOCKED    |
65-90m  | F4         | S2.2       | S3.2       | BLOCKED    | BLOCKED    |
--------|------------|------------|------------|------------|------------|
90m     | CP1: MERGE FOUNDATION TO MAIN                                   |
--------|------------|------------|------------|------------|------------|
90-120m | IDLE       | S2.3       | S3.3       | BLOCKED    | BLOCKED    |
120-145m| IDLE       | S2.4       | S3.4       | BLOCKED    | BLOCKED    |
145-170m| IDLE       | S2.5       | S3.5       | BLOCKED    | BLOCKED    |
170-190m| IDLE       | S2.6       | S3.6       | BLOCKED    | BLOCKED    |
190-205m| IDLE       | S2.7       | S3.7       | BLOCKED    | BLOCKED    |
--------|------------|------------|------------|------------|------------|
205m    | CP2: MERGE API-CLIENT TO MAIN                                   |
--------|------------|------------|------------|------------|------------|
205-235m| IDLE       | IDLE       | S3.8       | BLOCKED    | BLOCKED    |
235-255m| IDLE       | IDLE       | S3.9       | BLOCKED    | BLOCKED    |
255-270m| IDLE       | IDLE       | S3.10      | BLOCKED    | BLOCKED    |
--------|------------|------------|------------|------------|------------|
270m    | CP3: MERGE TOOLS TO MAIN                                        |
--------|------------|------------|------------|------------|------------|
270-290m| IDLE       | IDLE       | IDLE       | S4.1       | BLOCKED    |
290-315m| IDLE       | IDLE       | IDLE       | S4.2       | BLOCKED    |
315-330m| IDLE       | IDLE       | IDLE       | S4.3       | BLOCKED    |
330-350m| IDLE       | IDLE       | IDLE       | S4.4       | S5.1       |
350-370m| IDLE       | IDLE       | IDLE       | S4.5       | S5.1       |
--------|------------|------------|------------|------------|------------|
370m    | CP4: MERGE CACHING TO MAIN                                      |
--------|------------|------------|------------|------------|------------|
370-395m| IDLE       | IDLE       | IDLE       | IDLE       | S5.2       |
395-415m| IDLE       | IDLE       | IDLE       | IDLE       | S5.3       |
415-435m| IDLE       | IDLE       | IDLE       | IDLE       | S5.4       |
435-460m| IDLE       | IDLE       | IDLE       | IDLE       | S5.5       |
460-470m| IDLE       | IDLE       | IDLE       | IDLE       | S5.6       |
--------|------------|------------|------------|------------|------------|
470m    | CP5: MERGE TESTING TO MAIN - MVP COMPLETE                       |
--------|------------|------------|------------|------------|------------|
```

**Total Time**: ~7.8 hours (470 minutes) with parallel development
**Sequential Time**: ~16 hours (would be 2x longer)
**Efficiency Gain**: 51% time reduction through parallelization

---

### Merge Sequence and Validation

**Checkpoint 1: Foundation (90 min)**
```bash
# Merge foundation branch
git checkout main
git merge foundation --no-ff

# Validate
curl https://your-worker.workers.dev/health
# Expected: 200 OK with health status

# Test deployment
wrangler tail  # Monitor logs
```

**Checkpoint 2: API Client (205 min)**
```bash
# Merge api-client branch
git checkout main
git merge api-client --no-ff

# Validate
npm run test:unit
# Expected: All API client tests pass

# Integration test
npm run test:integration -- tango-api
# Expected: Real API call succeeds
```

**Checkpoint 3: Tools (270 min)**
```bash
# Merge tools branch
git checkout main
git merge tools --no-ff

# Validate
npm run test:tools
# Expected: All 5 tools return valid responses

# Manual test each tool
curl -X POST https://your-worker.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{"tool": "search_tango_contracts", "args": {"limit": 5}}'
```

**Checkpoint 4: Caching (370 min)**
```bash
# Merge caching branch
git checkout main
git merge caching --no-ff

# Validate cache behavior
npm run test:cache
# Expected: Cache hit rate >70%

# Test TTL expiration
# (Make request, wait 5+ min, verify miss)
```

**Checkpoint 5: MVP Complete (470 min)**
```bash
# Merge testing branch
git checkout main
git merge testing --no-ff

# Run full test suite
npm run test:all
# Expected: All tests pass

# Deploy to production
npm run deploy

# Tag release
git tag -a v1.0.0 -m "MVP release: Tango MCP Server"
git push origin v1.0.0
```

---

## Section 5: Testing Strategy

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
- KV namespace accessible

**CP2: API Client**
- Real Tango API call succeeds
- Timeout triggers at 30s
- Rate limiting enforces 100ms delay
- Errors are structured correctly

**CP3: Tools**
- All 5 tools return valid MCP responses
- Input sanitization blocks malicious input
- Tool descriptions are comprehensive
- Response envelopes are consistent

**CP4: Caching**
- Cache hit/miss behavior correct
- TTL expires after 5 minutes
- Only success responses cached
- Cache key collisions don't occur

**CP5: Complete MVP**
- All integration tests pass
- YAML test specs validate successfully
- Agent can use tools without errors
- Performance targets met (P50 <1s)

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

## Section 6: Implementation Commands

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
# Work on F1-F4 tasks
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
# /Users/mikec/Tango-MCP                  abc123 [main]
# /Users/mikec/Tango-MCP/worktrees/foundation   def456 [foundation]
# /Users/mikec/Tango-MCP/worktrees/api-client   ghi789 [api-client]
# /Users/mikec/Tango-MCP/worktrees/tools        jkl012 [tools]
# /Users/mikec/Tango-MCP/worktrees/caching      mno345 [caching]
# /Users/mikec/Tango-MCP/worktrees/testing      pqr678 [testing]
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
- `foundation/f2-wrangler-config`
- `api-client/s2.3-timeout-handling`
- `tools/s3.8-tool-descriptions`

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
git merge foundation --no-ff -m "Merge foundation: scaffolding and health check complete"

# Validate
npm test
curl https://your-worker.workers.dev/health

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
git merge api-client --no-ff -m "Merge api-client: type-safe API client ready"

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

# Validate
npm run test:tools

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

This implementation plan enables **parallel development** with **minimal merge conflicts** by:

1. **Clear Ownership**: Each worktree owns distinct files
2. **Sequential Dependencies**: Foundation → API Client → Tools → Caching → Testing
3. **Fast Feedback**: Validate every 1-2 commits
4. **Progressive Integration**: 5 integration checkpoints, not big-bang merge
5. **Small Tasks**: Every task is 20-30 minutes, testable increment

**Expected Outcomes**:
- MVP completed in ~8 hours (vs 16 hours sequential)
- High code quality through continuous testing
- Clean git history with meaningful merge commits
- Production-ready deployment at CP5

**Next Steps**:
1. Execute F1-F4 in foundation worktree
2. Validate CP1 (health check deployed)
3. Proceed with parallel S2 and S3 streams
4. Continue through CP2-CP5
5. Deploy and validate with Claude Code agent

---

**Document Status**: Ready for Execution
**Estimated Completion**: 6-8 hours with 3-4 parallel developers
**Dependencies**: Tango API key, Cloudflare account, Node.js 18+
