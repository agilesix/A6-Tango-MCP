# Phase 1 Parallelized Implementation Plan: Tango MCP Server Quick Wins

**Version**: 1.0
**Date**: 2025-11-18
**Status**: READY FOR EXECUTION
**Base Commit**: 99669d1 (Phase 0 Complete)
**Target Coverage**: 85% API coverage
**Estimated Total Time**: 18-22 hours (sequential: 35+ hours)

---

## Section 1: Overview

### Phase 1 Goals

**Primary Objective**: Implement Quick Wins to achieve 85% Tango API coverage with enhanced functionality

**Strategic Outcomes**:
1. **Detail Lookup Endpoints**: Add GET endpoints for individual contracts, grants, and opportunities
2. **Data Export**: Enable CSV export for all search results
3. **Enhanced Pagination**: Add ordering, sorting, and cursor-based pagination
4. **Response Completeness**: Fill missing fields across all tools
5. **Advanced Filtering**: Add PoP dates, expiration dates, and exclusion status checking
6. **Analytics**: Implement agency spending analytics and aggregations
7. **UX Improvements**: Better error messages and parameter validation

**Metrics**:
- API Coverage: 60% → 85% (+25%)
- Tool Count: 5 → 8 tools (+3 detail lookups)
- Filter Capabilities: 15 → 28 parameters (+13)
- Export Formats: JSON only → JSON + CSV
- Pagination: Offset only → Offset + Cursor + Sorting

---

### Expected Outcomes

**Phase 1 Deliverables**:

| Feature Category | Current State | Phase 1 Target | Business Value |
|------------------|---------------|----------------|----------------|
| **Detail Lookups** | Search only | Search + Detail GET | Deep dive analysis |
| **Export Formats** | JSON | JSON + CSV | Excel integration |
| **Pagination** | Basic offset | Cursor + Sort + Order | Large dataset handling |
| **Response Fields** | 70% coverage | 95% coverage | Complete data access |
| **Filtering** | Basic | Advanced (PoP, expiration, exclusion) | Targeted searches |
| **Analytics** | None | Agency spending summaries | Strategic insights |
| **Error Messages** | Generic | Actionable with recovery | Agent self-healing |

**Quality Metrics**:
- Test Coverage: 78 tests → 125+ tests
- TypeScript Strict: Maintained
- Performance: P50 <1s (uncached), <200ms (cached)
- Documentation: All new features documented

---

### Parallelization Strategy

**Core Principles**:
1. **Maximum Independence**: 6 parallel worktrees with minimal cross-dependencies
2. **File Ownership**: Each worktree owns distinct files to prevent merge conflicts
3. **Progressive Integration**: Merge every 3-4 hours with validation checkpoints
4. **Fast Feedback**: Test after every 1-2 commits (20-30 min intervals)
5. **Incremental Deployment**: Each checkpoint is deployable independently

**Parallelization Architecture**:
```
                    Phase 0 Complete (99669d1)
                              |
          ┌───────────────────┼───────────────────┐
          │                   │                   │
    [lookups]          [exports]           [pagination]
    6 hours            2 hours             4 hours
          │                   │                   │
          │             [fields]              [filters]
          │             3 hours               4 hours
          │                   │                   │
          │             [analytics]               │
          │             2 hours                   │
          │                   │                   │
          └───────────────────┴───────────────────┘
                              |
                      Integration & Testing
                         (3 hours)
                              |
                    Phase 1 Complete (85% coverage)
```

**Dependency Matrix**:
- **Independent Streams** (can start immediately): lookups, exports, fields
- **Dependent Streams** (wait for lookups): pagination, filters, analytics
- **Integration Stream** (waits for all): testing, documentation

**Maximum Parallelism**: 3 streams simultaneously (hours 0-6)
**Peak Efficiency Window**: Hours 6-12 (6 streams can run concurrently)

---

## Section 2: Git Worktree Strategy

### Worktree Design for Maximum Parallelism

**6 Independent Worktrees**:

```bash
main (protected branch, Phase 0 complete: 99669d1)
├── worktrees-phase1/
│   ├── phase1-lookups/       # Detail GET endpoints (contracts, grants, opps)
│   ├── phase1-exports/       # CSV export support
│   ├── phase1-pagination/    # Ordering, sorting, cursor pagination
│   ├── phase1-fields/        # Missing response fields across all tools
│   ├── phase1-filters/       # Enhanced filtering (PoP, expiration, exclusion)
│   └── phase1-analytics/     # Agency spending analytics
```

### File Ownership Map (Prevents Conflicts)

| Worktree | New Files Created | Modified Files | Touch-Only (Read) |
|----------|-------------------|----------------|-------------------|
| **phase1-lookups** | `src/tools/get-contract-detail.ts`<br>`src/tools/get-grant-detail.ts`<br>`src/tools/get-opportunity-detail.ts`<br>`test/unit/tools/get-contract-detail.test.ts`<br>`test/unit/tools/get-grant-detail.test.ts`<br>`test/unit/tools/get-opportunity-detail.test.ts` | `src/api/tango-client.ts` (add GET methods)<br>`src/types/tango-api.ts` (detail response types)<br>`src/types/tool-args.ts` (detail args) | `src/utils/normalizer.ts` |
| **phase1-exports** | `src/export/csv-formatter.ts`<br>`src/types/export.ts`<br>`test/unit/export/csv-formatter.test.ts` | All search tool files (add export_format param)<br>`src/types/tool-args.ts` (export params) | `src/utils/normalizer.ts` |
| **phase1-pagination** | `src/pagination/cursor-handler.ts`<br>`src/pagination/sort-builder.ts`<br>`test/unit/pagination/*.test.ts` | All search tool files (add pagination params)<br>`src/types/tool-args.ts` (pagination params) | `src/api/tango-client.ts` |
| **phase1-fields** | None (only edits) | `src/utils/normalizer.ts` (add missing fields)<br>`src/types/tango-api.ts` (extend interfaces)<br>`test/unit/utils/normalizer.test.ts` | All tool files |
| **phase1-filters** | `src/filters/date-validator.ts`<br>`src/filters/exclusion-checker.ts`<br>`test/unit/filters/*.test.ts` | `src/tools/search-contracts.ts` (PoP dates)<br>`src/tools/search-opportunities.ts` (expiration)<br>`src/tools/get-vendor-profile.ts` (exclusion)<br>`src/types/tool-args.ts` (filter params) | `src/api/tango-client.ts` |
| **phase1-analytics** | `src/tools/get-agency-spending.ts`<br>`src/analytics/aggregator.ts`<br>`test/unit/tools/get-agency-spending.test.ts` | `src/api/tango-client.ts` (aggregation endpoint)<br>`src/types/tango-api.ts` (analytics types) | `src/utils/normalizer.ts` |

**Conflict Prevention Rules**:
1. **One Writer Rule**: Only one worktree can modify a file
2. **Shared Types**: Created in lookups worktree first, then read-only in others
3. **Tool Files**: Each worktree modifies different tools or different parts
4. **API Client**: Lookups and analytics add new methods, others only read
5. **Normalizer**: Fields worktree owns normalizer, others read-only

---

### Integration Checkpoints

| Checkpoint | Merges | Validation | Start Time | Duration |
|------------|--------|------------|------------|----------|
| **CP1: Detail Lookups** | `phase1-lookups` → `main` | 3 new tools functional, GET endpoints working | 6h | 30 min |
| **CP2: Data Completeness** | `phase1-fields` → `main` | All normalized responses have 95%+ fields | 9h | 30 min |
| **CP3: Export & Pagination** | `phase1-exports`, `phase1-pagination` → `main` | CSV downloads work, cursor pagination functional | 12h | 45 min |
| **CP4: Advanced Filtering** | `phase1-filters` → `main` | PoP dates, expiration, exclusion filters working | 16h | 30 min |
| **CP5: Analytics Ready** | `phase1-analytics` → `main` | Agency spending tool functional | 18h | 30 min |
| **CP6: Phase 1 Complete** | All validation, docs, testing | End-to-end agent validation, 125+ tests passing | 21h | 60 min |

**Merge Strategy**:
- Sequential integration with validation between merges
- Each checkpoint is independently deployable
- Rollback procedures ready for each checkpoint
- Partial success allowed (e.g., merge 2 of 3 lookups if one fails)

---

## Section 3: Work Breakdown by Worktree

### Worktree 1: Detail Lookups (phase1-lookups)

**Purpose**: Add GET endpoints for detailed views of contracts, grants, and opportunities
**Branch**: `phase1-lookups`
**Estimated Time**: 6 hours
**Dependencies**: None (starts immediately)
**Parallel With**: phase1-exports, phase1-fields

---

#### Task Breakdown (10 tasks, 360 minutes)

**L1: Define detail lookup API types** (30 min)
- **Files Modified**: `src/types/tango-api.ts`
- **Work**:
  - Add `TangoContractDetail` interface (extends TangoContract with full nested objects)
  - Add `TangoGrantDetail` interface (includes full project description, milestones)
  - Add `TangoOpportunityDetail` interface (includes full solicitation text, attachments)
- **Dependencies**: None
- **Validation**: TypeScript compiles, interfaces extend base types correctly
- **Commit Message**: `feat(types): add detail response interfaces for contracts, grants, opportunities`

---

**L2: Add detail lookup arguments** (20 min)
- **Files Modified**: `src/types/tool-args.ts`
- **Work**:
  - Add `GetContractDetailArgs` (contract_id: string, piid?: string)
  - Add `GetGrantDetailArgs` (grant_id: string, fain?: string)
  - Add `GetOpportunityDetailArgs` (opportunity_id: string, notice_id?: string)
- **Dependencies**: L1
- **Validation**: TypeScript compiles, args are properly typed
- **Commit Message**: `feat(types): add argument interfaces for detail lookup tools`

---

**L3: Implement TangoApiClient GET methods** (40 min)
- **Files Modified**: `src/api/tango-client.ts`
- **Work**:
  - Add `getContractDetail(id: string, apiKey: string): Promise<TangoContractDetail>`
  - Add `getGrantDetail(id: string, apiKey: string): Promise<TangoGrantDetail>`
  - Add `getOpportunityDetail(id: string, apiKey: string): Promise<TangoOpportunityDetail>`
  - Map to API endpoints: `/contracts/{id}/`, `/grants/{id}/`, `/opportunities/{id}/`
  - Reuse existing error handling and rate limiting
- **Dependencies**: L2
- **Validation**: Methods compile, return types match interfaces
- **Commit Message**: `feat(api): add GET detail methods for contracts, grants, opportunities`

---

**L4: Implement get_contract_detail tool** (50 min)
- **Files Created**: `src/tools/get-contract-detail.ts`
- **Work**:
  - Implement MCP tool handler
  - JSON Schema: `contract_id` (required string), `piid` (optional string)
  - Tool description: "Get detailed information for a specific federal contract by ID or PIID. Returns full contract details including all modifications, amendments, line items, deliverables, and historical changes. Use after search_tango_contracts to get complete contract details."
  - Call `TangoApiClient.getContractDetail()`
  - Normalize response (minimal, detail endpoints have less normalization)
  - Response envelope with metadata
  - Cache with 30-minute TTL (longer than search)
- **Dependencies**: L3
- **Validation**: Tool registers, accepts valid contract ID, returns detail data
- **Commit Message**: `feat(tools): implement get_contract_detail tool with full contract data`

---

**L5: Implement get_grant_detail tool** (50 min)
- **Files Created**: `src/tools/get-grant-detail.ts`
- **Work**:
  - Implement MCP tool handler
  - JSON Schema: `grant_id` (required string), `fain` (optional string)
  - Tool description: "Get detailed information for a specific federal grant by ID or FAIN (Federal Award Identification Number). Returns full grant details including project description, milestones, reporting requirements, and recipient details. Use after search_tango_grants to get complete grant information."
  - Call `TangoApiClient.getGrantDetail()`
  - Normalize response
  - Response envelope with metadata
  - Cache with 30-minute TTL
- **Dependencies**: L3
- **Validation**: Tool registers, accepts valid grant ID, returns detail data
- **Commit Message**: `feat(tools): implement get_grant_detail tool with full grant data`

---

**L6: Implement get_opportunity_detail tool** (50 min)
- **Files Created**: `src/tools/get-opportunity-detail.ts`
- **Work**:
  - Implement MCP tool handler
  - JSON Schema: `opportunity_id` (required string), `notice_id` (optional string)
  - Tool description: "Get detailed information for a specific federal contracting opportunity by ID or notice ID. Returns full solicitation details including complete description, submission requirements, evaluation criteria, Q&A, amendments, and attachments. Use after search_tango_opportunities to get full opportunity details before proposal."
  - Call `TangoApiClient.getOpportunityDetail()`
  - Normalize response
  - Response envelope with metadata
  - Cache with 15-minute TTL (opportunities change faster)
- **Dependencies**: L3
- **Validation**: Tool registers, accepts valid opportunity ID, returns detail data
- **Commit Message**: `feat(tools): implement get_opportunity_detail tool with full opportunity data`

---

**L7: Register all detail tools** (20 min)
- **Files Modified**: `src/index.ts` (or equivalent tool registry)
- **Work**:
  - Register `get_contract_detail` tool
  - Register `get_grant_detail` tool
  - Register `get_opportunity_detail` tool
  - Ensure all tools are discoverable by MCP server
- **Dependencies**: L4, L5, L6
- **Validation**: Server lists 8 tools (5 existing + 3 new)
- **Commit Message**: `feat(tools): register detail lookup tools with MCP server`

---

**L8: Write unit tests for contract detail** (30 min)
- **Files Created**: `test/unit/tools/get-contract-detail.test.ts`
- **Work**:
  - Test valid contract ID lookup
  - Test PIID lookup
  - Test missing contract (404 error)
  - Test response structure
  - Test caching behavior
  - Mock API responses
- **Dependencies**: L4
- **Validation**: All tests pass (5+ tests)
- **Commit Message**: `test(tools): add unit tests for get_contract_detail tool`

---

**L9: Write unit tests for grant and opportunity details** (40 min)
- **Files Created**:
  - `test/unit/tools/get-grant-detail.test.ts`
  - `test/unit/tools/get-opportunity-detail.test.ts`
- **Work**:
  - Grant tests: valid ID, FAIN lookup, missing grant, response structure, caching
  - Opportunity tests: valid ID, notice ID lookup, expired opportunity, response structure, caching
  - Mock API responses for both
- **Dependencies**: L5, L6
- **Validation**: All tests pass (10+ tests total)
- **Commit Message**: `test(tools): add unit tests for grant and opportunity detail tools`

---

**L10: Integration validation** (30 min)
- **Files Modified**: None (validation only)
- **Work**:
  - Test all 3 tools with real API (if available)
  - Verify cache TTL differences (30 min contracts/grants, 15 min opportunities)
  - Test error handling for invalid IDs
  - Verify response envelopes match standard format
  - Document ID format requirements
- **Dependencies**: L7, L8, L9
- **Validation**: 3 tools functional, tests passing, ready for CP1
- **Commit Message**: `chore(lookups): validate all detail lookup tools (CP1-ready)`

---

**Checkpoint CP1: Detail Lookups Complete**

Validation Checklist:
- [ ] TypeScript compiles with no errors
- [ ] All 8 tools discoverable (5 existing + 3 new)
- [ ] Unit tests: 78 → 93+ passing (+15 tests)
- [ ] Real API test: At least 1 detail endpoint returns data
- [ ] Cache working: Detail lookups cached with correct TTL
- [ ] Error messages: Invalid ID returns actionable error

Merge Command:
```bash
git checkout main
git merge phase1-lookups --no-ff -m "merge(phase1): add detail lookup tools for contracts, grants, opportunities"
npm run test:unit
npm run build
git push origin main
```

---

### Worktree 2: CSV Export (phase1-exports)

**Purpose**: Add CSV export capability to all search tools
**Branch**: `phase1-exports`
**Estimated Time**: 2 hours
**Dependencies**: None (starts immediately)
**Parallel With**: phase1-lookups, phase1-fields

---

#### Task Breakdown (6 tasks, 120 minutes)

**E1: Create CSV formatter utility** (30 min)
- **Files Created**:
  - `src/export/csv-formatter.ts`
  - `src/types/export.ts`
- **Work**:
  - Implement `formatToCSV<T>(data: T[], fields: string[]): string`
  - Handle nested objects (flatten with dot notation: `vendor.name`)
  - Escape special characters (quotes, commas, newlines)
  - Add CSV header row
  - Support custom field mapping (e.g., `vendor_name` → `vendor.display_name`)
  - Type `ExportFormat = 'json' | 'csv'`
- **Dependencies**: None
- **Validation**: Unit test with sample data produces valid CSV
- **Commit Message**: `feat(export): implement CSV formatter with nested object support`

---

**E2: Add export format parameter to tool args** (15 min)
- **Files Modified**: `src/types/tool-args.ts`
- **Work**:
  - Add `export_format?: ExportFormat` to all search tool args:
    - `SearchContractsArgs`
    - `SearchGrantsArgs`
    - `SearchOpportunitiesArgs`
  - Add `export_fields?: string[]` (optional field selection)
  - Default to `'json'` if not specified
- **Dependencies**: E1
- **Validation**: TypeScript compiles, args accept export_format
- **Commit Message**: `feat(types): add export_format parameter to search tool arguments`

---

**E3: Update contracts tool with CSV export** (20 min)
- **Files Modified**: `src/tools/search-contracts.ts`
- **Work**:
  - Add `export_format` to JSON Schema (enum: ['json', 'csv'])
  - Add `export_fields` to JSON Schema (array of strings, optional)
  - After fetching results, check `export_format`
  - If `csv`, call `formatToCSV()` with results
  - Return CSV string in response envelope: `{format: 'csv', data: csvString}`
  - If `json`, return as usual
  - Update tool description: "...Supports CSV export with export_format='csv' parameter."
- **Dependencies**: E2
- **Validation**: Tool returns CSV when requested, JSON by default
- **Commit Message**: `feat(tools): add CSV export support to search_contracts tool`

---

**E4: Update grants and opportunities tools with CSV export** (25 min)
- **Files Modified**:
  - `src/tools/search-grants.ts`
  - `src/tools/search-opportunities.ts`
- **Work**:
  - Apply same CSV export logic as E3
  - Add `export_format` and `export_fields` to JSON Schema
  - Update tool descriptions
  - Test CSV output format
- **Dependencies**: E2
- **Validation**: Both tools return CSV when requested
- **Commit Message**: `feat(tools): add CSV export support to grants and opportunities tools`

---

**E5: Write CSV formatter tests** (20 min)
- **Files Created**: `test/unit/export/csv-formatter.test.ts`
- **Work**:
  - Test basic CSV formatting
  - Test nested object flattening (`vendor.name` → `"Acme Corp"`)
  - Test special character escaping (quotes, commas, newlines)
  - Test empty data (header only)
  - Test custom field selection
- **Dependencies**: E1
- **Validation**: All tests pass (5+ tests)
- **Commit Message**: `test(export): add unit tests for CSV formatter`

---

**E6: Integration validation** (10 min)
- **Files Modified**: None (validation only)
- **Work**:
  - Test CSV export with real contract search
  - Verify CSV can be opened in Excel/Google Sheets
  - Test field selection (export_fields)
  - Test large result sets (100 rows)
  - Verify CSV caching (should cache CSV separately from JSON)
- **Dependencies**: E3, E4, E5
- **Validation**: CSV export working for all 3 search tools
- **Commit Message**: `chore(exports): validate CSV export functionality`

---

**Checkpoint CP2 (partial): Exports Ready**

Validation Checklist:
- [ ] TypeScript compiles with no errors
- [ ] CSV formatter handles nested objects and special chars
- [ ] All 3 search tools support `export_format='csv'`
- [ ] CSV output opens correctly in Excel/Google Sheets
- [ ] Unit tests: 93 → 98+ passing (+5 tests)
- [ ] Cache distinguishes between JSON and CSV responses

Note: This checkpoint merges with pagination (CP3)

---

### Worktree 3: Pagination Enhancements (phase1-pagination)

**Purpose**: Add ordering, sorting, and cursor-based pagination
**Branch**: `phase1-pagination`
**Estimated Time**: 4 hours
**Dependencies**: None (starts immediately)
**Parallel With**: phase1-lookups, phase1-fields, phase1-exports

---

#### Task Breakdown (8 tasks, 240 minutes)

**P1: Create sort builder utility** (35 min)
- **Files Created**:
  - `src/pagination/sort-builder.ts`
  - `src/types/pagination.ts`
- **Work**:
  - Implement `buildSortParams(order_by: string, sort_direction: 'asc' | 'desc'): URLSearchParams`
  - Map tool parameter names to API field names:
    - `award_date` → `award_date`
    - `amount` → `obligated` (contracts) or `award_amount` (grants)
    - `vendor_name` → `recipient.display_name`
  - Support multiple sort fields (comma-separated: `award_date,amount`)
  - Type `SortDirection = 'asc' | 'desc'`
  - Type `OrderByField = 'award_date' | 'amount' | 'vendor_name' | 'agency_name'`
- **Dependencies**: None
- **Validation**: Unit test produces correct API parameters
- **Commit Message**: `feat(pagination): implement sort parameter builder`

---

**P2: Create cursor pagination handler** (40 min)
- **Files Created**: `src/pagination/cursor-handler.ts`
- **Work**:
  - Implement `encodeCursor(lastRecord: any): string` (base64 encode key fields)
  - Implement `decodeCursor(cursor: string): CursorData` (decode and validate)
  - Implement `buildCursorParams(cursor?: string): URLSearchParams`
  - Support cursor-based pagination for Tango API
  - Handle invalid cursors gracefully (fallback to offset)
  - Type `CursorData = {id: string, sort_value: any}`
- **Dependencies**: None
- **Validation**: Encode/decode round-trip works, cursor produces valid API params
- **Commit Message**: `feat(pagination): implement cursor-based pagination handler`

---

**P3: Add pagination parameters to tool args** (25 min)
- **Files Modified**: `src/types/tool-args.ts`
- **Work**:
  - Add to all search tool args:
    - `order_by?: OrderByField` (field to sort by)
    - `sort_direction?: SortDirection` (asc or desc, default: desc)
    - `cursor?: string` (cursor for next page, mutually exclusive with offset)
  - Update existing `limit` parameter docs
  - Document cursor vs offset pagination
- **Dependencies**: P1, P2
- **Validation**: TypeScript compiles, args accept pagination params
- **Commit Message**: `feat(types): add ordering and cursor pagination parameters`

---

**P4: Update contracts tool with pagination** (35 min)
- **Files Modified**: `src/tools/search-contracts.ts`
- **Work**:
  - Add `order_by`, `sort_direction`, `cursor` to JSON Schema
  - Call `buildSortParams()` to add sorting to API request
  - If `cursor` provided, call `buildCursorParams()` instead of offset
  - After API response, encode cursor from last record: `next_cursor`
  - Add to response envelope: `{pagination: {next_cursor, has_more, total}}`
  - Validate: cursor and offset are mutually exclusive
  - Update tool description with pagination examples
- **Dependencies**: P3
- **Validation**: Tool supports sorting and cursor pagination
- **Commit Message**: `feat(tools): add ordering and cursor pagination to search_contracts`

---

**P5: Update grants tool with pagination** (30 min)
- **Files Modified**: `src/tools/search-grants.ts`
- **Work**:
  - Apply same pagination logic as P4
  - Map `order_by='amount'` to `award_amount` for grants
  - Encode cursor with grant-specific fields (fain, award_date)
  - Update tool description
- **Dependencies**: P3
- **Validation**: Grants tool supports sorting and cursor pagination
- **Commit Message**: `feat(tools): add ordering and cursor pagination to search_grants`

---

**P6: Update opportunities tool with pagination** (30 min)
- **Files Modified**: `src/tools/search-opportunities.ts`
- **Work**:
  - Apply same pagination logic as P4
  - Map `order_by='posted_date'` to opportunity-specific fields
  - Encode cursor with opportunity ID and sort value
  - Update tool description
- **Dependencies**: P3
- **Validation**: Opportunities tool supports sorting and cursor pagination
- **Commit Message**: `feat(tools): add ordering and cursor pagination to search_opportunities`

---

**P7: Write pagination tests** (30 min)
- **Files Created**:
  - `test/unit/pagination/sort-builder.test.ts`
  - `test/unit/pagination/cursor-handler.test.ts`
- **Work**:
  - Sort builder tests: single field, multiple fields, direction
  - Cursor handler tests: encode, decode, round-trip, invalid cursor
  - Test cursor vs offset mutual exclusivity
  - Test next_cursor generation
- **Dependencies**: P1, P2
- **Validation**: All tests pass (8+ tests)
- **Commit Message**: `test(pagination): add unit tests for sort and cursor handlers`

---

**P8: Integration validation** (15 min)
- **Files Modified**: None (validation only)
- **Work**:
  - Test sorting by award_date (ascending and descending)
  - Test cursor pagination (fetch page 1, use next_cursor for page 2)
  - Test large dataset pagination (100+ results)
  - Verify cursor works with sorting
  - Test invalid cursor handling (should fallback gracefully)
- **Dependencies**: P4, P5, P6, P7
- **Validation**: Pagination working for all 3 search tools
- **Commit Message**: `chore(pagination): validate ordering and cursor pagination`

---

**Checkpoint CP3: Export & Pagination Complete**

Validation Checklist:
- [ ] TypeScript compiles with no errors
- [ ] All 3 search tools support sorting (order_by, sort_direction)
- [ ] All 3 search tools support cursor pagination (cursor, next_cursor)
- [ ] CSV export working (from phase1-exports)
- [ ] Unit tests: 98 → 111+ passing (+13 tests)
- [ ] Cursor pagination tested with 2+ pages
- [ ] Sorting verified (asc/desc on multiple fields)

Merge Command:
```bash
git checkout main
git merge phase1-exports --no-ff -m "merge(phase1): add CSV export support"
git merge phase1-pagination --no-ff -m "merge(phase1): add ordering and cursor pagination"
npm run test:unit
npm run build
git push origin main
```

---

### Worktree 4: Missing Response Fields (phase1-fields)

**Purpose**: Fill missing fields in normalized responses (95%+ coverage)
**Branch**: `phase1-fields`
**Estimated Time**: 3 hours
**Dependencies**: None (starts immediately)
**Parallel With**: phase1-lookups, phase1-exports, phase1-pagination

---

#### Task Breakdown (7 tasks, 180 minutes)

**F1: Audit current field coverage** (20 min)
- **Files Modified**: None (audit only)
- **Work**:
  - Review Tango API docs for all available fields
  - Compare with current normalized response interfaces
  - Create checklist of missing fields:
    - Contracts: `contract_type`, `pop_zip_code`, `vendor_cage_code`, `performance_based_service_contract`
    - Grants: `obligation_date`, `recipient_congressional_district`, `assistance_type`, `cfda_objectives`
    - Opportunities: `response_deadline`, `set_aside_code`, `contracting_office_address`, `solicitation_type`
    - Vendors: `business_type_codes`, `company_division_name`, `sam_registration_date`, `entity_structure`
  - Prioritize high-value fields (most commonly needed)
- **Dependencies**: None
- **Validation**: Documented list of 20+ missing fields
- **Commit Message**: `docs(fields): audit missing fields in normalized responses`

---

**F2: Extend Tango API response types** (35 min)
- **Files Modified**: `src/types/tango-api.ts`
- **Work**:
  - Add missing fields to `TangoContract`:
    - `contract_type?: string`
    - `pop_zip_code?: string`
    - `vendor_cage_code?: string`
    - `performance_based_service_contract?: boolean`
    - `contract_bundling?: string`
    - `clinger_cohen_act?: boolean`
  - Add missing fields to `TangoGrantResponse`:
    - `obligation_date?: string`
    - `recipient_congressional_district?: string`
    - `assistance_type?: string`
    - `cfda_objectives?: string`
    - `assistance_listing_title?: string`
  - Add missing fields to `TangoOpportunityResponse`:
    - `response_deadline?: string`
    - `set_aside_code?: string`
    - `contracting_office_address?: string`
    - `solicitation_type?: string`
    - `classification_code?: string`
    - `archive_date?: string`
  - Add missing fields to `TangoVendorResponse`:
    - `business_type_codes?: string[]`
    - `company_division_name?: string`
    - `sam_registration_date?: string`
    - `entity_structure?: string`
    - `congressional_district?: string`
- **Dependencies**: F1
- **Validation**: TypeScript compiles, new fields typed correctly
- **Commit Message**: `feat(types): add missing fields to Tango API response interfaces`

---

**F3: Extend normalized response types** (25 min)
- **Files Modified**: `src/types/tool-args.ts` (normalized response interfaces)
- **Work**:
  - Add corresponding fields to `NormalizedContract`:
    - All fields from F2, matching Tango API structure
  - Add corresponding fields to `NormalizedGrant`:
    - All fields from F2
  - Add corresponding fields to `NormalizedOpportunity`:
    - All fields from F2
  - Add corresponding fields to `NormalizedVendor`:
    - All fields from F2
  - Ensure all fields are optional (use `?`) for backward compatibility
- **Dependencies**: F2
- **Validation**: TypeScript compiles, normalized types match API types
- **Commit Message**: `feat(types): extend normalized response types with missing fields`

---

**F4: Update contract normalizer** (30 min)
- **Files Modified**: `src/utils/normalizer.ts`
- **Work**:
  - Update `normalizeContract()` function:
    - Extract `contract_type` from API response
    - Extract `pop_zip_code` from `place_of_performance.zip_code`
    - Extract `vendor_cage_code` from `recipient.cage_code`
    - Extract `performance_based_service_contract` with boolean conversion
    - Extract `contract_bundling`
    - Extract `clinger_cohen_act` with boolean conversion
  - Add fallback values for missing fields (null → undefined)
  - Test with real API response sample
- **Dependencies**: F3
- **Validation**: Normalizer extracts all new contract fields
- **Commit Message**: `feat(normalizer): add missing contract fields to normalization`

---

**F5: Update grant, opportunity, vendor normalizers** (40 min)
- **Files Modified**: `src/utils/normalizer.ts`
- **Work**:
  - Update `normalizeGrant()`:
    - Extract all missing grant fields from F2
    - Handle nested objects (e.g., `recipient.congressional_district`)
  - Update `normalizeOpportunity()`:
    - Extract all missing opportunity fields from F2
    - Parse dates correctly (`response_deadline`, `archive_date`)
  - Update `normalizeVendor()`:
    - Extract all missing vendor fields from F2
    - Handle `business_type_codes` array
  - Add comprehensive fallback handling
- **Dependencies**: F3
- **Validation**: All normalizers extract missing fields correctly
- **Commit Message**: `feat(normalizer): add missing fields to grant, opportunity, vendor normalization`

---

**F6: Write normalizer field tests** (25 min)
- **Files Modified**: `test/unit/utils/normalizer.test.ts`
- **Work**:
  - Add tests for new contract fields:
    - Test `contract_type` extraction
    - Test `pop_zip_code` extraction from nested object
    - Test `performance_based_service_contract` boolean conversion
  - Add tests for new grant fields:
    - Test `obligation_date` extraction
    - Test `assistance_type` extraction
  - Add tests for new opportunity fields:
    - Test `response_deadline` date parsing
    - Test `solicitation_type` extraction
  - Add tests for new vendor fields:
    - Test `business_type_codes` array handling
    - Test `entity_structure` extraction
  - Test fallback handling (missing fields → undefined)
- **Dependencies**: F4, F5
- **Validation**: All tests pass (12+ new tests)
- **Commit Message**: `test(normalizer): add tests for missing field extraction`

---

**F7: Integration validation** (5 min)
- **Files Modified**: None (validation only)
- **Work**:
  - Fetch real contract and verify new fields present
  - Fetch real grant and verify new fields present
  - Fetch real opportunity and verify new fields present
  - Fetch real vendor and verify new fields present
  - Verify backward compatibility (old responses still work)
- **Dependencies**: F6
- **Validation**: 95%+ field coverage achieved
- **Commit Message**: `chore(fields): validate missing field extraction (95%+ coverage)`

---

**Checkpoint CP2: Data Completeness**

Validation Checklist:
- [ ] TypeScript compiles with no errors
- [ ] 20+ new fields added to response types
- [ ] All normalizers extract new fields
- [ ] Unit tests: 111 → 123+ passing (+12 tests)
- [ ] Real API responses include new fields
- [ ] Backward compatibility maintained

Merge Command:
```bash
git checkout main
git merge phase1-fields --no-ff -m "merge(phase1): add missing response fields (95%+ coverage)"
npm run test:unit
npm run build
git push origin main
```

---

### Worktree 5: Enhanced Filtering (phase1-filters)

**Purpose**: Add PoP dates, expiration dates, and exclusion status checking
**Branch**: `phase1-filters`
**Estimated Time**: 4 hours
**Dependencies**: phase1-lookups merged (CP1)
**Parallel With**: phase1-analytics

---

#### Task Breakdown (9 tasks, 240 minutes)

**FT1: Create date validation utility** (25 min)
- **Files Created**: `src/filters/date-validator.ts`
- **Work**:
  - Implement `validateDateRange(start?: string, end?: string): {valid: boolean, error?: string}`
  - Check date format (YYYY-MM-DD)
  - Validate start < end
  - Check for future dates (warn if too far in future)
  - Implement `parsePopDates(pop_start?: string, pop_end?: string): URLSearchParams`
  - Map to API parameters for PoP filtering
- **Dependencies**: None
- **Validation**: Unit test validates dates correctly
- **Commit Message**: `feat(filters): implement date validation and PoP date parser`

---

**FT2: Create exclusion status checker** (30 min)
- **Files Created**: `src/filters/exclusion-checker.ts`
- **Work**:
  - Implement `checkExclusionStatus(uei: string, apiKey: string): Promise<ExclusionStatus>`
  - Call Tango API `/exclusions?uei={uei}` endpoint
  - Parse exclusion data:
    - `excluded: boolean`
    - `exclusion_type?: string` (debarment, suspension, etc.)
    - `exclusion_date?: string`
    - `termination_date?: string`
    - `agency?: string`
  - Type `ExclusionStatus = {excluded: boolean, ...}`
  - Cache exclusion checks (60-minute TTL)
- **Dependencies**: None
- **Validation**: Unit test with mock API response
- **Commit Message**: `feat(filters): implement exclusion status checker with caching`

---

**FT3: Add PoP date filtering to contracts** (30 min)
- **Files Modified**: `src/tools/search-contracts.ts`
- **Work**:
  - Add parameters to JSON Schema:
    - `pop_start_date?: string` (performance period start date)
    - `pop_end_date?: string` (performance period end date)
    - `pop_current?: boolean` (filter to contracts in performance now)
  - Add to `SearchContractsArgs` interface
  - Call `validateDateRange()` for validation
  - Map to API parameters: `pop_start_gte`, `pop_start_lte`, `pop_end_gte`, `pop_end_lte`
  - If `pop_current=true`, set `pop_start_lte=today` and `pop_end_gte=today`
  - Update tool description with PoP examples
- **Dependencies**: FT1
- **Validation**: PoP filtering returns correct results
- **Commit Message**: `feat(tools): add performance period (PoP) date filtering to contracts`

---

**FT4: Add expiration date filtering to opportunities** (25 min)
- **Files Modified**: `src/tools/search-opportunities.ts`
- **Work**:
  - Add parameters to JSON Schema:
    - `response_deadline_start?: string` (earliest response deadline)
    - `response_deadline_end?: string` (latest response deadline)
    - `active_only?: boolean` (filter to non-expired opportunities)
  - Add to `SearchOpportunitiesArgs` interface
  - Map to API parameters: `response_deadline_gte`, `response_deadline_lte`
  - If `active_only=true`, set `response_deadline_gte=today`
  - Update tool description
- **Dependencies**: FT1
- **Validation**: Expiration filtering works correctly
- **Commit Message**: `feat(tools): add expiration date filtering to opportunities`

---

**FT5: Add exclusion checking to vendor profile** (35 min)
- **Files Modified**: `src/tools/get-vendor-profile.ts`
- **Work**:
  - Add parameter to JSON Schema:
    - `include_exclusion_status?: boolean` (default: false)
  - Add to `GetVendorProfileArgs` interface
  - If `include_exclusion_status=true`, call `checkExclusionStatus()`
  - Add to response: `exclusion_status: ExclusionStatus`
  - Cache vendor profile with exclusion data separately
  - Update tool description: "Optionally includes SAM.gov exclusion status (debarment, suspension)"
- **Dependencies**: FT2
- **Validation**: Exclusion status returned when requested
- **Commit Message**: `feat(tools): add exclusion status checking to vendor profile`

---

**FT6: Add grant period of performance filtering** (25 min)
- **Files Modified**: `src/tools/search-grants.ts`
- **Work**:
  - Add parameters to JSON Schema:
    - `period_start_date?: string` (grant performance start)
    - `period_end_date?: string` (grant performance end)
    - `currently_active?: boolean` (grants active now)
  - Add to `SearchGrantsArgs` interface
  - Map to API parameters: `period_start_gte`, `period_start_lte`, `period_end_gte`, `period_end_lte`
  - If `currently_active=true`, set date range to today
  - Update tool description
- **Dependencies**: FT1
- **Validation**: Grant PoP filtering works correctly
- **Commit Message**: `feat(tools): add period of performance filtering to grants`

---

**FT7: Write date validator tests** (20 min)
- **Files Created**: `test/unit/filters/date-validator.test.ts`
- **Work**:
  - Test valid date range
  - Test invalid date format
  - Test start > end (should fail)
  - Test future date warning
  - Test PoP date parsing
- **Dependencies**: FT1
- **Validation**: All tests pass (5+ tests)
- **Commit Message**: `test(filters): add date validator unit tests`

---

**FT8: Write exclusion checker tests** (25 min)
- **Files Created**: `test/unit/filters/exclusion-checker.test.ts`
- **Work**:
  - Test excluded vendor (mock API response)
  - Test non-excluded vendor
  - Test API error handling
  - Test caching behavior (60-minute TTL)
  - Test invalid UEI
- **Dependencies**: FT2
- **Validation**: All tests pass (5+ tests)
- **Commit Message**: `test(filters): add exclusion checker unit tests`

---

**FT9: Integration validation** (25 min)
- **Files Modified**: None (validation only)
- **Work**:
  - Test PoP filtering on contracts (pop_current=true)
  - Test expiration filtering on opportunities (active_only=true)
  - Test exclusion checking on vendor profile (real or mock UEI)
  - Test grant PoP filtering (currently_active=true)
  - Verify date validation errors return actionable messages
  - Test edge cases (dates on boundary conditions)
- **Dependencies**: FT3, FT4, FT5, FT6, FT7, FT8
- **Validation**: All enhanced filters working
- **Commit Message**: `chore(filters): validate PoP, expiration, and exclusion filtering`

---

**Checkpoint CP4: Advanced Filtering Complete**

Validation Checklist:
- [ ] TypeScript compiles with no errors
- [ ] PoP date filtering working (contracts and grants)
- [ ] Expiration date filtering working (opportunities)
- [ ] Exclusion status checking working (vendors)
- [ ] Unit tests: 123 → 133+ passing (+10 tests)
- [ ] Date validation returns helpful errors
- [ ] Exclusion data cached correctly

Merge Command:
```bash
git checkout main
git merge phase1-filters --no-ff -m "merge(phase1): add PoP dates, expiration, and exclusion filtering"
npm run test:unit
npm run build
git push origin main
```

---

### Worktree 6: Agency Spending Analytics (phase1-analytics)

**Purpose**: Implement agency spending summary and analytics tool
**Branch**: `phase1-analytics`
**Estimated Time**: 2 hours
**Dependencies**: phase1-lookups merged (CP1)
**Parallel With**: phase1-filters

---

#### Task Breakdown (6 tasks, 120 minutes)

**A1: Define analytics response types** (20 min)
- **Files Modified**: `src/types/tango-api.ts`
- **Work**:
  - Add `TangoAgencySpendingResponse`:
    - `agency_name: string`
    - `agency_code: string`
    - `total_obligated: number`
    - `total_contracts: number`
    - `total_grants: number`
    - `top_vendors: Array<{vendor_name, uei, total_obligated}>`
    - `spending_by_naics: Array<{naics_code, description, total_obligated}>`
    - `time_period: {start_date, end_date}`
  - Add `NormalizedAgencySpending` type
- **Dependencies**: None
- **Validation**: TypeScript compiles, analytics types well-structured
- **Commit Message**: `feat(types): add agency spending analytics response types`

---

**A2: Create aggregation utility** (30 min)
- **Files Created**: `src/analytics/aggregator.ts`
- **Work**:
  - Implement `aggregateByAgency(contracts: TangoContract[], grants: TangoGrant[]): AgencySpending[]`
  - Group by agency_name
  - Sum obligated amounts
  - Count contracts and grants
  - Identify top vendors (by spending)
  - Aggregate by NAICS code
  - Sort by total spending (descending)
  - Support time period filtering
- **Dependencies**: A1
- **Validation**: Unit test with sample data produces correct aggregations
- **Commit Message**: `feat(analytics): implement agency spending aggregation utility`

---

**A3: Add analytics endpoint to API client** (25 min)
- **Files Modified**: `src/api/tango-client.ts`
- **Work**:
  - Add `getAgencySpending(agency?: string, start_date?: string, end_date?: string, apiKey: string): Promise<TangoAgencySpendingResponse>`
  - Map to API endpoint: `/analytics/agency-spending/`
  - Query parameters: `agency`, `start_date`, `end_date`, `group_by`
  - Support aggregation by agency or overall summary
- **Dependencies**: A1
- **Validation**: API client method compiles, returns analytics data
- **Commit Message**: `feat(api): add agency spending analytics endpoint`

---

**A4: Implement get_agency_spending tool** (30 min)
- **Files Created**: `src/tools/get-agency-spending.ts`
- **Work**:
  - Implement MCP tool handler
  - JSON Schema:
    - `agency_name?: string` (specific agency or all agencies)
    - `start_date?: string` (YYYY-MM-DD)
    - `end_date?: string` (YYYY-MM-DD)
    - `group_by?: 'agency' | 'vendor' | 'naics'` (aggregation level)
    - `limit?: number` (top N results, default: 10)
  - Tool description: "Get federal spending analytics and summaries by agency. Returns aggregated spending data including total obligated amounts, contract/grant counts, top vendors, and spending by industry (NAICS code). Useful for agency budget analysis, market research, and competitive intelligence. Supports filtering by time period and grouping by agency, vendor, or industry code."
  - Call `TangoApiClient.getAgencySpending()`
  - Normalize response
  - Cache with 60-minute TTL (analytics change slowly)
  - Response envelope with metadata
- **Dependencies**: A3
- **Validation**: Tool returns agency spending analytics
- **Commit Message**: `feat(tools): implement get_agency_spending analytics tool`

---

**A5: Write analytics tests** (20 min)
- **Files Created**:
  - `test/unit/analytics/aggregator.test.ts`
  - `test/unit/tools/get-agency-spending.test.ts`
- **Work**:
  - Aggregator tests:
    - Test grouping by agency
    - Test summing obligated amounts
    - Test top vendors calculation
    - Test NAICS aggregation
  - Tool tests:
    - Test agency-specific query
    - Test all agencies query
    - Test date range filtering
    - Test group_by parameter
    - Test caching
- **Dependencies**: A2, A4
- **Validation**: All tests pass (8+ tests)
- **Commit Message**: `test(analytics): add unit tests for agency spending analytics`

---

**A6: Integration validation** (15 min)
- **Files Modified**: None (validation only)
- **Work**:
  - Test analytics for specific agency (e.g., "Department of Defense")
  - Test analytics for all agencies (top 10 by spending)
  - Test date range filtering (FY2024)
  - Test grouping by vendor (top vendors across government)
  - Test grouping by NAICS (top industries)
  - Verify cache working (60-minute TTL)
- **Dependencies**: A5
- **Validation**: Agency spending tool functional
- **Commit Message**: `chore(analytics): validate agency spending analytics tool`

---

**Checkpoint CP5: Analytics Ready**

Validation Checklist:
- [ ] TypeScript compiles with no errors
- [ ] Agency spending tool functional
- [ ] Aggregation working (by agency, vendor, NAICS)
- [ ] Date range filtering working
- [ ] Unit tests: 133 → 141+ passing (+8 tests)
- [ ] Cache working (60-minute TTL)
- [ ] Tool discoverable (9 tools total now)

Merge Command:
```bash
git checkout main
git merge phase1-analytics --no-ff -m "merge(phase1): add agency spending analytics tool"
npm run test:unit
npm run build
git push origin main
```

---

## Section 4: Parallel Execution Timeline

### Visual Timeline (22 hours realistic, 35+ hours sequential)

```
Hour | Lookups    | Exports    | Pagination | Fields     | Filters    | Analytics  |
-----|------------|------------|------------|------------|------------|------------|
0-1  | L1,L2      | E1         | P1         | F1,F2      | WAIT       | WAIT       |
1-2  | L3         | E2         | P2         | F3,F4      | WAIT       | WAIT       |
2-3  | L4         | E3         | P3         | F5         | WAIT       | WAIT       |
3-4  | L5         | E4         | P4         | F6         | WAIT       | WAIT       |
4-5  | L6         | E5         | P5         | F7         | WAIT       | WAIT       |
5-6  | L7,L8      | E6         | P6         | IDLE       | WAIT       | WAIT       |
6h   | L9,L10     | READY      | P7         | READY      | WAIT       | WAIT       |
-----|------------|------------|------------|------------|------------|------------|
     | CP1: MERGE LOOKUPS (30 min)                                                 |
     | CP2: MERGE FIELDS (30 min)                                                  |
-----|------------|------------|------------|------------|------------|------------|
7-8  | IDLE       | IDLE       | P8         | IDLE       | FT1        | A1         |
8-9  | IDLE       | IDLE       | READY      | IDLE       | FT2        | A2         |
9-10 | IDLE       | IDLE       | IDLE       | IDLE       | FT3        | A3         |
10-11| IDLE       | IDLE       | IDLE       | IDLE       | FT4        | A4         |
11-12| IDLE       | IDLE       | IDLE       | IDLE       | FT5        | A5         |
-----|------------|------------|------------|------------|------------|------------|
     | CP3: MERGE EXPORTS + PAGINATION (45 min)                                    |
-----|------------|------------|------------|------------|------------|------------|
12-13| IDLE       | IDLE       | IDLE       | IDLE       | FT6        | A6         |
13-14| IDLE       | IDLE       | IDLE       | IDLE       | FT7,FT8    | READY      |
14-15| IDLE       | IDLE       | IDLE       | IDLE       | FT9        | IDLE       |
15-16| IDLE       | IDLE       | IDLE       | IDLE       | READY      | IDLE       |
-----|------------|------------|------------|------------|------------|------------|
     | CP4: MERGE FILTERS (30 min)                                                 |
     | CP5: MERGE ANALYTICS (30 min)                                               |
-----|------------|------------|------------|------------|------------|------------|
16-18| INTEGRATION & VALIDATION (all worktrees complete)                           |
18-21| END-TO-END TESTING, DOCUMENTATION, PERFORMANCE VALIDATION                   |
-----|------------|------------|------------|------------|------------|------------|
21-22| CP6: FINAL VALIDATION & DEPLOYMENT                                          |
-----|------------|------------|------------|------------|------------|------------|
```

**Timeline Analysis**:

| Phase | Hours | Parallel Streams | Efficiency |
|-------|-------|------------------|------------|
| **Initial Push** (0-6h) | 6h | 4 streams (lookups, exports, pagination, fields) | 75% |
| **Mid Development** (6-12h) | 6h | 3 streams (pagination, filters, analytics) | 50% |
| **Completion** (12-16h) | 4h | 2 streams (filters, analytics) | 25% |
| **Integration** (16-22h) | 6h | Sequential (testing, docs, validation) | 0% |

**Total Time**: 22 hours (realistic with buffer)
**Sequential Time**: 35+ hours
**Time Savings**: 37% reduction through parallelization

---

### Maximum Parallelism Windows

**Window 1: Hours 0-6 (Peak Parallelism)**
- **4 streams running**: lookups, exports, pagination, fields
- **Why**: All independent, no shared file writes
- **Bottleneck**: Developer context switching
- **Recommendation**: 2-3 developers, each owns 1-2 streams

**Window 2: Hours 6-12 (High Parallelism)**
- **3 streams running**: pagination (finishing), filters, analytics
- **Why**: Filters and analytics depend on lookups (merged at 6h)
- **Bottleneck**: API client modifications (analytics adds endpoints)
- **Recommendation**: 2 developers, coordinate on API client changes

**Window 3: Hours 12-16 (Moderate Parallelism)**
- **2 streams running**: filters, analytics (completing)
- **Why**: Most features complete, finishing remaining tasks
- **Bottleneck**: Integration testing requirements
- **Recommendation**: 1-2 developers, start integration prep

**Window 4: Hours 16-22 (Sequential Integration)**
- **1 stream**: Integration, testing, documentation
- **Why**: Must validate all features together
- **Bottleneck**: End-to-end testing time
- **Recommendation**: 1 developer, thorough validation

---

### Dependency Graph

```
                    Phase 0 Complete (99669d1)
                              |
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   [lookups]             [exports]             [fields]
   6 hours               2 hours               3 hours
   NO DEPS               NO DEPS               NO DEPS
        │                     │                     │
        │                [pagination]               │
        │                4 hours                    │
        │                NO DEPS                    │
        │                     │                     │
        ├─────────────────────┴─────────────────────┤
        │                                           │
   [filters]                                  [analytics]
   4 hours                                    2 hours
   DEPENDS: lookups (CP1)                     DEPENDS: lookups (CP1)
        │                                           │
        └───────────────────┬───────────────────────┘
                            │
                    [integration-testing]
                    3 hours
                    DEPENDS: all streams merged
                            │
                    Phase 1 Complete (85% coverage)
```

**Critical Path**: lookups (6h) → filters (4h) → integration (3h) = 13 hours minimum
**Actual Time**: 22 hours (includes parallelizable work, testing, validation, buffer)

---

### Integration Checkpoints Detail

**CP1: Detail Lookups (Hour 6, 30 minutes)**
- **Merge**: phase1-lookups → main
- **Validation**:
  ```bash
  npm run test:unit  # 78 → 93 tests (+15)
  npm run build      # TypeScript compiles
  npm run test:tool -- get_contract_detail
  npm run test:tool -- get_grant_detail
  npm run test:tool -- get_opportunity_detail
  ```
- **Success Criteria**: 3 new tools functional, GET endpoints working
- **Rollback**: Revert merge if any tool fails validation

---

**CP2: Data Completeness (Hour 7, 30 minutes)**
- **Merge**: phase1-fields → main
- **Validation**:
  ```bash
  npm run test:unit  # 93 → 105 tests (+12)
  node scripts/audit-field-coverage.js  # Check 95%+ coverage
  npm run test:integration -- contracts
  npm run test:integration -- grants
  ```
- **Success Criteria**: 95%+ field coverage, backward compatible
- **Rollback**: Revert if field extraction breaks existing tools

---

**CP3: Export & Pagination (Hour 12, 45 minutes)**
- **Merge**: phase1-exports, phase1-pagination → main
- **Validation**:
  ```bash
  npm run test:unit  # 105 → 124 tests (+19)
  npm run test:export -- csv
  npm run test:pagination -- cursor
  # Test CSV download in browser
  # Test cursor pagination with 2+ pages
  ```
- **Success Criteria**: CSV export works, cursor pagination functional
- **Rollback**: Partial rollback (keep one, revert other if needed)

---

**CP4: Advanced Filtering (Hour 16, 30 minutes)**
- **Merge**: phase1-filters → main
- **Validation**:
  ```bash
  npm run test:unit  # 124 → 134 tests (+10)
  npm run test:filters -- pop-dates
  npm run test:filters -- exclusion
  # Test PoP filtering on contracts
  # Test exclusion checking on vendors
  ```
- **Success Criteria**: All enhanced filters working
- **Rollback**: Revert if filtering breaks existing searches

---

**CP5: Analytics Ready (Hour 18, 30 minutes)**
- **Merge**: phase1-analytics → main
- **Validation**:
  ```bash
  npm run test:unit  # 134 → 142 tests (+8)
  npm run test:tool -- get_agency_spending
  # Test analytics with real agency data
  # Verify cache working (60-min TTL)
  ```
- **Success Criteria**: Agency spending tool functional, 9 tools total
- **Rollback**: Revert if analytics endpoint fails

---

**CP6: Phase 1 Complete (Hour 22, 60 minutes)**
- **Merge**: None (all merged, final validation)
- **Validation**:
  ```bash
  npm run test:all                # All 142+ tests pass
  npm run test:e2e                # End-to-end agent test
  npm run test:performance        # P50 <1s uncached, <200ms cached
  npx mcp-server-kit validate     # MCP protocol compliance
  npm run build                   # Production build
  npm run deploy                  # Deploy to production
  # Manual agent validation with Claude Code
  ```
- **Success Criteria**:
  - All 142+ tests passing
  - 9 tools functional (5 search + 3 detail + 1 analytics)
  - 85% API coverage achieved
  - Performance targets met
  - Agent can use all tools successfully
- **Rollback**: N/A (full rollback to Phase 0 if catastrophic failure)

---

## Section 5: Integration Strategy

### Merge Order and Rationale

**Order**: lookups → fields → exports+pagination → filters → analytics → final validation

**Rationale**:
1. **Lookups First**: Establishes detail endpoints, needed by filters and analytics
2. **Fields Second**: Enhances data completeness, benefits all subsequent features
3. **Exports + Pagination Together**: Both modify search tools, merge together to avoid conflicts
4. **Filters Fourth**: Depends on lookups being available for testing
5. **Analytics Fifth**: Depends on lookups, can use enhanced fields
6. **Final Validation**: All features together, end-to-end testing

---

### Validation at Each Checkpoint

**Pre-Merge Validation** (in worktree):
```bash
# Before merging any branch
cd worktrees-phase1/<worktree-name>
npm run test:unit      # Unit tests pass
npm run lint           # No linting errors
npx tsc --noEmit       # TypeScript compiles
git diff main          # Review changes
```

**Post-Merge Validation** (in main):
```bash
# After merging to main
cd /Users/mikec/Tango-MCP
git checkout main
npm install            # Update dependencies if needed
npm run test:unit      # All tests pass
npm run build          # Production build succeeds
npm run deploy:dev     # Deploy to dev environment
# Manual smoke test of new features
```

**Checkpoint Validation Criteria**:

| Checkpoint | Must Pass | Should Pass | Nice to Have |
|------------|-----------|-------------|--------------|
| **CP1** | 3 detail tools functional, TypeScript compiles | Unit tests +15 | Real API test |
| **CP2** | Field coverage 95%+, backward compatible | Unit tests +12 | Performance unchanged |
| **CP3** | CSV downloads, cursor works | Unit tests +19 | Excel compatibility |
| **CP4** | PoP/exclusion filters work | Unit tests +10 | Date edge cases |
| **CP5** | Analytics tool functional | Unit tests +8 | Real agency data |
| **CP6** | All 142+ tests, agent works | Performance targets | Production deploy |

---

### Rollback Procedures

**Immediate Rollback (Post-Merge Failure)**:
```bash
# If checkpoint validation fails immediately after merge
git checkout main
git reset --hard HEAD~1  # Revert merge commit
git push origin main --force
# Fix issues in worktree, retry merge
```

**Fix Forward (Preferred)**:
```bash
# If issues discovered after others have pulled
git checkout main
git checkout -b hotfix/cp<N>-<issue>
# Fix the issue
git commit -m "fix: resolve CP<N> validation failure"
git checkout main
git merge hotfix/cp<N>-<issue> --no-ff
npm run test:unit
git push origin main
```

**Partial Rollback (Feature-Specific)**:
```bash
# If one feature breaks but others work
git checkout main
git revert <commit-hash>  # Revert specific commit
git commit -m "revert: disable broken feature (to fix in follow-up)"
git push origin main
# Fix feature in separate branch, re-merge later
```

---

### Conflict Resolution Strategy

**Predicted Conflicts**:

| File | Worktrees Touching | Resolution Strategy |
|------|-------------------|---------------------|
| `src/api/tango-client.ts` | lookups (add GET), analytics (add analytics endpoint) | Merge lookups first, analytics merges cleanly |
| `src/types/tool-args.ts` | All worktrees (add params) | Use unique parameter names, merge sequentially |
| `src/utils/normalizer.ts` | fields (modify normalizers), lookups (read-only) | Fields worktree owns, others read-only |
| All search tool files | exports (add export), pagination (add pagination) | Merge exports first, then pagination, or merge together |

**Conflict Resolution Steps**:
1. **Identify Conflict**: Git shows conflict markers `<<<<< ===== >>>>>`
2. **Understand Changes**: Review both versions, understand intent
3. **Merge Manually**: Combine changes, keep both features
4. **Test Thoroughly**: Run unit tests, integration tests
5. **Commit Resolution**: `git add <file>`, `git commit -m "merge: resolve conflict in <file>"`

**Example Conflict Resolution** (tool-args.ts):
```typescript
// Conflict: Both exports and pagination add parameters
// Resolution: Keep both parameter sets
export interface SearchContractsArgs {
  // Existing parameters
  query?: string;
  vendor_name?: string;

  // From phase1-exports
  export_format?: 'json' | 'csv';
  export_fields?: string[];

  // From phase1-pagination
  order_by?: OrderByField;
  sort_direction?: 'asc' | 'desc';
  cursor?: string;
}
```

---

### Progressive Integration Testing

**Stage 1: Unit Testing** (in worktree, every 1-2 commits):
```bash
cd worktrees-phase1/<worktree>
npm run test:unit              # Fast feedback (< 5 seconds)
npm run test:unit:watch        # Continuous testing during development
```

**Stage 2: Integration Testing** (pre-merge, in worktree):
```bash
npm run test:integration        # Test with mock API
npm run test:integration:real   # Test with real Tango API (optional)
```

**Stage 3: Checkpoint Testing** (post-merge, in main):
```bash
cd /Users/mikec/Tango-MCP
npm run test:all                # Full test suite
npm run test:e2e                # End-to-end scenarios
npm run test:performance        # Performance benchmarks
```

**Stage 4: Agent Validation** (final checkpoint only):
```bash
# Start MCP server
npm run dev

# In separate terminal, test with Claude Code
# Manually verify:
# 1. Agent discovers all 9 tools
# 2. Agent can compose workflows (search → detail → analytics)
# 3. Agent handles errors gracefully
# 4. Agent uses new features (CSV export, pagination, filters)
```

---

## Section 6: Testing Requirements

### Unit Tests Per Feature

**Lookups Worktree** (+15 tests):
- `get-contract-detail.test.ts` (5 tests):
  - Valid contract ID lookup
  - PIID lookup
  - Missing contract (404)
  - Response structure validation
  - Caching behavior (30-min TTL)
- `get-grant-detail.test.ts` (5 tests):
  - Valid grant ID lookup
  - FAIN lookup
  - Missing grant (404)
  - Response structure validation
  - Caching behavior
- `get-opportunity-detail.test.ts` (5 tests):
  - Valid opportunity ID lookup
  - Notice ID lookup
  - Expired opportunity
  - Response structure validation
  - Caching behavior (15-min TTL)

**Exports Worktree** (+5 tests):
- `csv-formatter.test.ts` (5 tests):
  - Basic CSV formatting
  - Nested object flattening
  - Special character escaping (quotes, commas, newlines)
  - Empty data (header only)
  - Custom field selection

**Pagination Worktree** (+13 tests):
- `sort-builder.test.ts` (4 tests):
  - Single field sorting
  - Multiple field sorting
  - Sort direction (asc/desc)
  - Field mapping (vendor_name → recipient.display_name)
- `cursor-handler.test.ts` (4 tests):
  - Cursor encoding
  - Cursor decoding
  - Round-trip (encode → decode)
  - Invalid cursor handling
- Tool integration tests (5 tests):
  - Sorting by award_date
  - Cursor pagination (page 1 → page 2)
  - Cursor + sorting together
  - Mutual exclusivity (cursor vs offset)
  - next_cursor generation

**Fields Worktree** (+12 tests):
- `normalizer.test.ts` additions (12 tests):
  - Contract fields: contract_type, pop_zip_code, vendor_cage_code (3 tests)
  - Grant fields: obligation_date, assistance_type (2 tests)
  - Opportunity fields: response_deadline, solicitation_type (2 tests)
  - Vendor fields: business_type_codes, entity_structure (2 tests)
  - Fallback handling (missing fields → undefined) (3 tests)

**Filters Worktree** (+10 tests):
- `date-validator.test.ts` (5 tests):
  - Valid date range
  - Invalid date format
  - Start > end (should fail)
  - Future date warning
  - PoP date parsing
- `exclusion-checker.test.ts` (5 tests):
  - Excluded vendor
  - Non-excluded vendor
  - API error handling
  - Caching behavior (60-min TTL)
  - Invalid UEI

**Analytics Worktree** (+8 tests):
- `aggregator.test.ts` (4 tests):
  - Grouping by agency
  - Summing obligated amounts
  - Top vendors calculation
  - NAICS aggregation
- `get-agency-spending.test.ts` (4 tests):
  - Agency-specific query
  - All agencies query
  - Date range filtering
  - group_by parameter

**Total New Tests**: 15 + 5 + 13 + 12 + 10 + 8 = **63 new tests**
**Final Test Count**: 78 (Phase 0) + 63 (Phase 1) = **141+ tests**

---

### Integration Test Updates

**New Integration Test Files**:

1. **Detail Lookups** (`tests/integration/detail-lookups.test.ts`):
   - Test contract detail lookup with real API
   - Test grant detail lookup with real API
   - Test opportunity detail lookup with real API
   - Verify cache TTL differences

2. **CSV Export** (`tests/integration/csv-export.test.ts`):
   - Test CSV download with contracts
   - Verify CSV format (open in Excel)
   - Test field selection (export_fields)
   - Test large datasets (100 rows)

3. **Pagination** (`tests/integration/pagination.test.ts`):
   - Test sorting by multiple fields
   - Test cursor pagination (3+ pages)
   - Test cursor + sorting together
   - Test performance (large datasets)

4. **Enhanced Filters** (`tests/integration/enhanced-filters.test.ts`):
   - Test PoP date filtering (contracts)
   - Test expiration filtering (opportunities)
   - Test exclusion checking (vendors)
   - Test grant PoP filtering

5. **Analytics** (`tests/integration/analytics.test.ts`):
   - Test agency-specific analytics
   - Test top vendors query
   - Test NAICS aggregation
   - Test date range filtering

**Integration Test Strategy**:
- Run integration tests pre-merge (in worktree)
- Run full integration suite post-merge (in main)
- Use real Tango API when available, mocks otherwise
- Measure performance (P50, P95 response times)

---

### Manual Validation Steps

**Pre-Merge Manual Tests** (per worktree):

**Lookups**:
1. Call `get_contract_detail` with valid contract ID
2. Call `get_grant_detail` with valid FAIN
3. Call `get_opportunity_detail` with valid notice ID
4. Verify all 3 tools return complete details
5. Check cache working (second call faster)

**Exports**:
1. Call `search_contracts` with `export_format='csv'`
2. Download CSV and open in Excel
3. Verify columns match expected fields
4. Test with 100 rows
5. Test field selection (export_fields)

**Pagination**:
1. Call `search_contracts` with `order_by='award_date'`, `sort_direction='desc'`
2. Verify results sorted correctly
3. Call with `limit=10`, note `next_cursor`
4. Call with `cursor=<next_cursor>`, verify next page
5. Test 3+ pages of results

**Filters**:
1. Call `search_contracts` with `pop_current=true`
2. Verify all results have current PoP
3. Call `search_opportunities` with `active_only=true`
4. Verify no expired opportunities
5. Call `get_vendor_profile` with `include_exclusion_status=true`
6. Verify exclusion status returned

**Analytics**:
1. Call `get_agency_spending` with specific agency
2. Verify totals, top vendors, NAICS aggregation
3. Call with `group_by='vendor'`
4. Verify top vendors across government
5. Test date range filtering (FY2024)

---

**Post-Merge Manual Tests** (in main, after each checkpoint):

**CP1: Detail Lookups**:
- [ ] All 3 detail tools discoverable
- [ ] Contract detail returns full data
- [ ] Grant detail returns full data
- [ ] Opportunity detail returns full data
- [ ] Cache working (30-min for contracts/grants, 15-min for opportunities)

**CP2: Data Completeness**:
- [ ] Contracts have 95%+ fields
- [ ] Grants have 95%+ fields
- [ ] Opportunities have 95%+ fields
- [ ] Vendors have 95%+ fields
- [ ] No regressions in existing tools

**CP3: Export & Pagination**:
- [ ] CSV export works for all 3 search tools
- [ ] CSV opens correctly in Excel
- [ ] Sorting works (asc/desc, multiple fields)
- [ ] Cursor pagination works (3+ pages)
- [ ] Cursor + sorting together works

**CP4: Advanced Filtering**:
- [ ] PoP date filtering works (contracts)
- [ ] Grant PoP filtering works
- [ ] Expiration filtering works (opportunities)
- [ ] Exclusion checking works (vendors)
- [ ] Date validation returns helpful errors

**CP5: Analytics Ready**:
- [ ] Agency spending tool functional
- [ ] Aggregation by agency works
- [ ] Aggregation by vendor works
- [ ] Aggregation by NAICS works
- [ ] Date range filtering works
- [ ] Cache working (60-min TTL)

**CP6: Phase 1 Complete**:
- [ ] All 141+ tests passing
- [ ] All 9 tools functional
- [ ] Performance targets met (P50 <1s uncached, <200ms cached)
- [ ] Agent can discover and use all tools
- [ ] Agent can compose workflows (search → detail → analytics)
- [ ] Agent handles errors gracefully
- [ ] Production deployment successful

---

### Performance Testing

**Performance Benchmarks**:

| Metric | Phase 0 Target | Phase 1 Target | Measurement |
|--------|----------------|----------------|-------------|
| **P50 Uncached** | <1000ms | <1000ms | 50th percentile response time (cache miss) |
| **P95 Uncached** | <2000ms | <2000ms | 95th percentile response time (cache miss) |
| **P50 Cached** | <200ms | <200ms | 50th percentile response time (cache hit) |
| **P95 Cached** | <500ms | <500ms | 95th percentile response time (cache hit) |
| **Cache Hit Rate** | >70% | >70% | Percentage of requests served from cache |
| **CSV Generation** | N/A | <500ms | Time to generate CSV (100 rows) |
| **Cursor Pagination** | N/A | <100ms | Time to encode/decode cursor |

**Performance Test Script**:
```bash
# Run performance benchmarks
npm run test:performance

# Expected output:
# Search Contracts (uncached): P50=850ms, P95=1200ms
# Search Contracts (cached): P50=150ms, P95=300ms
# Get Contract Detail (uncached): P50=900ms, P95=1500ms
# CSV Export (100 rows): 420ms
# Cursor Encode/Decode: 15ms
# Cache Hit Rate: 73%
```

**Performance Regression Testing**:
- Run performance tests before and after each checkpoint
- Alert if P50 increases >20%
- Alert if cache hit rate drops >10%
- Document any performance regressions and mitigation plan

---

## Section 7: Summary and Next Steps

### Phase 1 Summary

**What We're Building**:
- 3 new detail lookup tools (contracts, grants, opportunities)
- CSV export for all search tools
- Enhanced pagination (sorting, cursor-based)
- 95%+ field coverage in responses
- Advanced filtering (PoP dates, expiration, exclusion)
- Agency spending analytics tool

**Expected Results**:
- Tool count: 5 → 9 (+4 tools, 80% increase)
- API coverage: 60% → 85% (+25%, 42% increase)
- Test coverage: 78 → 141+ tests (+63 tests, 81% increase)
- Response fields: 70% → 95% (+25%, 36% increase)
- Export formats: 1 → 2 (JSON + CSV, 100% increase)

**Time Investment**:
- Parallelized: 18-22 hours (recommended)
- Sequential: 35+ hours (not recommended)
- Time Savings: 37-49% through parallelization

---

### Critical Success Factors

1. **Worktree Discipline**:
   - Each worktree owns distinct files
   - No unauthorized file modifications
   - Communicate before touching shared files

2. **Frequent Testing**:
   - Test after every 1-2 commits (20-30 min)
   - Run full suite before merge
   - Manual validation at each checkpoint

3. **Incremental Integration**:
   - Merge every 3-6 hours
   - Validate immediately after merge
   - Fix forward rather than rollback (preferred)

4. **Communication**:
   - Coordinate API client changes (lookups vs analytics)
   - Alert team before modifying tool files
   - Document any deviations from plan

5. **Quality Gates**:
   - TypeScript must compile (strict mode)
   - All tests must pass before merge
   - Performance targets must be met
   - Agent validation must succeed (final checkpoint)

---

### Immediate Next Steps

**Step 1: Setup (15 minutes)**
```bash
cd /Users/mikec/Tango-MCP

# Ensure on Phase 0 complete
git checkout main
git pull origin main
git log -1  # Verify commit 99669d1

# Create Phase 1 worktree directory
mkdir -p worktrees-phase1

# Create all 6 worktrees
git worktree add worktrees-phase1/phase1-lookups -b phase1-lookups
git worktree add worktrees-phase1/phase1-exports -b phase1-exports
git worktree add worktrees-phase1/phase1-pagination -b phase1-pagination
git worktree add worktrees-phase1/phase1-fields -b phase1-fields
git worktree add worktrees-phase1/phase1-filters -b phase1-filters
git worktree add worktrees-phase1/phase1-analytics -b phase1-analytics

# Verify worktrees
git worktree list
```

**Step 2: Start Development (Hour 0)**

Choose starting worktree(s) based on team size:

**Solo Developer** (recommended: start with lookups):
```bash
cd worktrees-phase1/phase1-lookups
npm install
npm run test:unit  # Verify baseline (78 tests)
# Start L1: Define detail lookup API types
```

**2 Developers** (recommended: lookups + fields):
```bash
# Dev 1: Lookups
cd worktrees-phase1/phase1-lookups
# Start L1

# Dev 2: Fields
cd worktrees-phase1/phase1-fields
# Start F1
```

**3+ Developers** (recommended: lookups + fields + pagination):
```bash
# Dev 1: Lookups
cd worktrees-phase1/phase1-lookups
# Start L1

# Dev 2: Fields
cd worktrees-phase1/phase1-fields
# Start F1

# Dev 3: Pagination
cd worktrees-phase1/phase1-pagination
# Start P1

# Optional Dev 4: Exports (can start immediately)
cd worktrees-phase1/phase1-exports
# Start E1
```

---

**Step 3: Execute Work Breakdown**

Follow task sequence from Section 3:
- Lookups: L1 → L2 → L3 → ... → L10
- Exports: E1 → E2 → E3 → ... → E6
- Pagination: P1 → P2 → P3 → ... → P8
- Fields: F1 → F2 → F3 → ... → F7
- Filters: FT1 → FT2 → ... → FT9 (after CP1)
- Analytics: A1 → A2 → ... → A6 (after CP1)

**Commit Frequency**: Every task completion (20-30 min intervals)
**Test Frequency**: After every 1-2 commits
**Merge Frequency**: Every 3-6 hours (at checkpoints)

---

**Step 4: Integration Checkpoints**

**CP1 (Hour 6)**:
```bash
# Merge lookups
cd /Users/mikec/Tango-MCP
git checkout main
git merge phase1-lookups --no-ff -m "merge(phase1): add detail lookup tools"
npm run test:unit  # 78 → 93 tests
npm run build
git push origin main

# Merge fields
git merge phase1-fields --no-ff -m "merge(phase1): add missing response fields"
npm run test:unit  # 93 → 105 tests
git push origin main
```

**CP3 (Hour 12)**:
```bash
# Merge exports
git merge phase1-exports --no-ff -m "merge(phase1): add CSV export"
npm run test:unit  # 105 → 110 tests
git push origin main

# Merge pagination
git merge phase1-pagination --no-ff -m "merge(phase1): add ordering and cursor pagination"
npm run test:unit  # 110 → 124 tests
git push origin main
```

**CP4 (Hour 16)**:
```bash
# Merge filters
git merge phase1-filters --no-ff -m "merge(phase1): add enhanced filtering"
npm run test:unit  # 124 → 134 tests
git push origin main
```

**CP5 (Hour 18)**:
```bash
# Merge analytics
git merge phase1-analytics --no-ff -m "merge(phase1): add agency spending analytics"
npm run test:unit  # 134 → 142 tests
git push origin main
```

**CP6 (Hour 22)**:
```bash
# Final validation
npm run test:all          # All 142+ tests
npm run test:e2e          # End-to-end
npm run test:performance  # Performance benchmarks
npm run build             # Production build
npm run deploy            # Deploy to production

# Tag release
git tag -a v1.1.0-phase1-complete -m "Phase 1: Quick Wins (85% API coverage)"
git push origin main --tags
```

---

### Success Metrics

**Phase 1 Complete When**:
- [ ] All 9 tools functional (5 search + 3 detail + 1 analytics)
- [ ] 141+ tests passing (100% pass rate)
- [ ] 85% API coverage achieved
- [ ] CSV export working for all search tools
- [ ] Cursor pagination working with sorting
- [ ] 95%+ response field coverage
- [ ] Enhanced filters functional (PoP, expiration, exclusion)
- [ ] Agency spending analytics working
- [ ] Performance targets met (P50 <1s uncached, <200ms cached)
- [ ] Agent validation successful (Claude Code can use all tools)
- [ ] Production deployment successful

**Documentation Updated**:
- [ ] README.md (new tool descriptions)
- [ ] API.md (new endpoints documented)
- [ ] CHANGELOG.md (Phase 1 features listed)
- [ ] Tool usage examples (CSV export, pagination, analytics)

---

### Risk Mitigation

**High-Risk Areas**:

1. **API Client Modifications** (lookups + analytics both modify):
   - **Mitigation**: Merge lookups first (CP1), analytics merges cleanly after
   - **Backup Plan**: Coordinate changes, merge together if needed

2. **Tool File Conflicts** (exports + pagination both modify search tools):
   - **Mitigation**: Merge exports first, pagination merges cleanly after
   - **Backup Plan**: Merge both together at CP3 (recommended)

3. **Normalizer Changes** (fields owns, others read-only):
   - **Mitigation**: Fields worktree owns normalizer exclusively
   - **Backup Plan**: Merge fields early (CP2), others read updated normalizer

4. **Performance Regression** (new features may slow responses):
   - **Mitigation**: Run performance tests at each checkpoint
   - **Backup Plan**: Optimize slow queries, add caching, feature flag if needed

5. **Agent Compatibility** (new features may confuse agent):
   - **Mitigation**: Clear tool descriptions, JSON Schema validation
   - **Backup Plan**: Update tool descriptions, add examples, test with agent

---

### Contingency Plans

**If Behind Schedule**:
- **Option 1**: Drop analytics (reduces scope by 2 hours, still hits 80% coverage)
- **Option 2**: Simplify pagination (drop cursor, keep sorting only, saves 1.5 hours)
- **Option 3**: Reduce field coverage (90% instead of 95%, saves 0.5 hours)

**If Feature Fails Validation**:
- **Option 1**: Fix forward (create hotfix branch, fix and re-merge)
- **Option 2**: Partial merge (merge working parts, defer broken feature)
- **Option 3**: Rollback (revert merge, fix in worktree, retry)

**If Conflicts Arise**:
- **Option 1**: Resolve manually (understand both changes, merge intelligently)
- **Option 2**: Merge together (exports + pagination as one merge)
- **Option 3**: Coordinate (pause one worktree, finish other first)

---

## Appendix: File Reference

### Key Files by Worktree

**Lookups**:
- `src/types/tango-api.ts` (add detail response types)
- `src/types/tool-args.ts` (add detail args)
- `src/api/tango-client.ts` (add GET methods)
- `src/tools/get-contract-detail.ts` (new)
- `src/tools/get-grant-detail.ts` (new)
- `src/tools/get-opportunity-detail.ts` (new)

**Exports**:
- `src/export/csv-formatter.ts` (new)
- `src/types/export.ts` (new)
- `src/types/tool-args.ts` (add export params)
- `src/tools/search-contracts.ts` (add CSV export)
- `src/tools/search-grants.ts` (add CSV export)
- `src/tools/search-opportunities.ts` (add CSV export)

**Pagination**:
- `src/pagination/sort-builder.ts` (new)
- `src/pagination/cursor-handler.ts` (new)
- `src/types/pagination.ts` (new)
- `src/types/tool-args.ts` (add pagination params)
- `src/tools/search-contracts.ts` (add pagination)
- `src/tools/search-grants.ts` (add pagination)
- `src/tools/search-opportunities.ts` (add pagination)

**Fields**:
- `src/types/tango-api.ts` (extend response types)
- `src/types/tool-args.ts` (extend normalized types)
- `src/utils/normalizer.ts` (add field extraction)
- `test/unit/utils/normalizer.test.ts` (add field tests)

**Filters**:
- `src/filters/date-validator.ts` (new)
- `src/filters/exclusion-checker.ts` (new)
- `src/types/tool-args.ts` (add filter params)
- `src/tools/search-contracts.ts` (add PoP filtering)
- `src/tools/search-grants.ts` (add PoP filtering)
- `src/tools/search-opportunities.ts` (add expiration filtering)
- `src/tools/get-vendor-profile.ts` (add exclusion checking)

**Analytics**:
- `src/types/tango-api.ts` (add analytics types)
- `src/analytics/aggregator.ts` (new)
- `src/api/tango-client.ts` (add analytics endpoint)
- `src/tools/get-agency-spending.ts` (new)

---

### Command Reference

**Worktree Management**:
```bash
# Create worktree
git worktree add worktrees-phase1/<name> -b <branch>

# List worktrees
git worktree list

# Remove worktree
git worktree remove worktrees-phase1/<name>

# Switch to worktree
cd worktrees-phase1/<name>
```

**Development**:
```bash
# Install dependencies
npm install

# Run tests
npm run test:unit
npm run test:unit:watch
npm run test:integration

# Build
npm run build

# Lint
npm run lint
```

**Merge**:
```bash
# Merge worktree to main
git checkout main
git merge <branch> --no-ff -m "merge(phase1): <description>"

# Validate
npm run test:unit
npm run build

# Push
git push origin main
```

**Rollback**:
```bash
# Immediate rollback
git reset --hard HEAD~1
git push origin main --force

# Fix forward
git checkout -b hotfix/<issue>
# Fix and commit
git checkout main
git merge hotfix/<issue> --no-ff
git push origin main
```

---

**Document Status**: READY FOR EXECUTION
**Last Updated**: 2025-11-18
**Version**: 1.0
**Next Review**: After CP3 (Hour 12)

---

*This plan enables 37-49% time savings through parallelization while maintaining high code quality and comprehensive testing. Follow the work breakdown sequentially within each worktree, merge at checkpoints, and validate thoroughly. Phase 1 success brings Tango MCP Server to 85% API coverage with production-ready features.*
