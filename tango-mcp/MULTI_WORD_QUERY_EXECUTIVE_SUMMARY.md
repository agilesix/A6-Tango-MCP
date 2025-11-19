# Multi-Word Query Solution: Executive Summary

**Date:** 2025-11-19
**Status:** Ready for Implementation
**Estimated Effort:** 85 minutes (~1.5 hours)
**Risk Level:** Low
**Confidence:** 95%

---

## The Problem

Users naturally try descriptive multi-word queries like:
- "artificial intelligence AI machine learning" → **0 results**
- Simple "AI" → **59 results** ✓

**Root Cause:** Tango API performs exact phrase matching, not keyword OR matching.

---

## The Solution: Hybrid Approach

### ✅ IMPLEMENT (3 of 4 solutions)

**1. Smart Retry Logic** (Solution 1)
- Automatically detect problematic query patterns
- Provide suggestions when searches fail
- **Status:** Already working in contracts tool (commit b3553dd)
- **Needed:** Implement in forecasts tool

**2. Better Documentation** (Solution 2)
- Update tool descriptions with clear guidance
- Provide examples of good vs bad queries
- **Status:** Already done in contracts tool
- **Needed:** Update forecasts and opportunities tools

**3. Enhanced Error Messages** (Solution 4)
- When 0 results, provide actionable guidance
- Include executable examples
- **Status:** Part of Solution 1
- **Needed:** Included in forecasts implementation

### ❌ DO NOT IMPLEMENT

**4. Query Preprocessing** (Solution 3)
- **Why:** Too complex, high risk, not worth maintenance burden
- **Alternative:** Let zero-result detection handle it

---

## Implementation Breakdown

| Tool | Priority | Status | Effort |
|------|----------|--------|--------|
| **search_tango_contracts** | HIGH | ✅ **DONE** (commit b3553dd) | 0 min |
| **search_tango_forecasts** | HIGH | ⏳ **TODO** | 50 min |
| **search_tango_opportunities** | MEDIUM | ⏳ **TODO** | 35 min |
| **search_tango_grants** | LOW | Optional | - |
| **search_tango_idvs** | LOW | Optional | - |

**Total:** 85 minutes for high-priority tools

---

## What Gets Updated?

### Forecasts Tool (50 minutes)

**File:** `src/tools/search-forecasts.ts`

**Changes:**
1. Enhanced tool description (line 31) - 15 min
2. Zero-results detection logic (after line 255) - 30 min
3. Query parameter documentation (lines 35-38) - 5 min

**Approach:** Copy proven pattern from contracts tool

### Opportunities Tool (35 minutes)

**File:** `src/tools/search-opportunities.ts`

**Changes:**
1. Enhanced tool description - 10 min
2. Zero-results detection logic - 20 min
3. Query parameter documentation - 5 min

---

## Technical Approach

### Reuse Existing Code ✓

1. **Query Analyzer Utility** (`src/utils/query-analyzer.ts`)
   - Already exists, fully tested (368 lines, 100+ tests)
   - Detects 20 federal agencies
   - Extracts NAICS codes
   - No changes needed

2. **Zero-Results Pattern** (`src/tools/search-contracts.ts`, lines 469-519)
   - Copy and adapt for forecasts tool
   - Minimal modifications needed

### Example Output

```json
{
  "data": [],
  "total": 0,
  "suggestions": {
    "detected_issue": "Zero results for multi-concept query",
    "recommended_approach": {
      "agency": "VA",
      "query": "digital services"
    },
    "explanation": "Your query 'VA digital services' appears to mix agency and topic keywords. Try using agency='VA' with query='digital services'.",
    "example": {
      "tool": "search_tango_forecasts",
      "params": {
        "agency": "VA",
        "query": "digital services",
        "limit": 10
      }
    }
  }
}
```

---

## Trade-offs

### Performance vs UX
**Decision:** Prioritize UX
**Impact:** +100ms latency on zero-result queries only
**Rationale:** Imperceptible, only affects failed queries (rare)

### Complexity vs Maintainability
**Decision:** Simple, proven approach
**Impact:** Reuse existing utilities, low maintenance
**Rationale:** Already proven in contracts tool

---

## Success Metrics

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Zero-result rate | Current % | -20% | 30-day comparison |
| Suggestion acceptance | - | >50% | Log analysis |
| Query latency | Current | <+10% | Performance monitoring |

---

## Testing Strategy

### Test Cases
1. ✓ Zero-result query with agency pattern → Show suggestions
2. ✓ Zero-result query without pattern → No suggestions
3. ✓ Successful query → No suggestions (normal behavior)
4. ✓ Performance: <100ms overhead on failures

### Queries from Usability Study
- "artificial intelligence AI machine learning"
- "HHS forecasts for cloud services"
- "VA cybersecurity contracts"

---

## Risks & Mitigations

| Risk | Mitigation | Severity |
|------|------------|----------|
| False positives | Only activate on zero results, high confidence threshold | Low |
| Performance impact | Only run on failures, monitor metrics | Low |
| Suggestion confusion | Clear language, executable examples, A/B test | Low |
| Maintenance burden | Comprehensive tests, isolated utilities, clear docs | Low |

---

## Rollout Plan

### Week 1: Implementation & Testing
- **Days 1-3:** Implement forecasts + opportunities tools
- **Days 4-5:** Unit, integration, and manual testing

### Week 2: Deployment & Monitoring
- **Day 1:** Deploy to staging
- **Day 2:** Monitor metrics
- **Day 3:** Deploy to production
- **Days 4-7:** Monitor and iterate

---

## Why This Approach?

### ✅ Proven Track Record
- Already working in contracts tool since commit b3553dd
- 100+ test cases, no issues reported

### ✅ Low Risk
- Only affects zero-result queries (rare)
- Graceful degradation if analysis fails
- Comprehensive test coverage

### ✅ Best UX
- Transparent and helpful
- Educational for users
- Provides executable examples

### ✅ Easy Maintenance
- Reuses existing utilities
- Isolated, well-tested code
- Clear documentation

### ✅ Fast Implementation
- 85 minutes total
- Copy proven pattern
- No complex logic needed

---

## Alternatives Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Query Preprocessing | Too complex, high maintenance, risk of breaking user intent |
| Server-Side Rewriting | Too invasive, API limitation |
| Multiple API Calls | Performance penalty, rate limits |
| Full-Text Search | API limitation, not under our control |

---

## Recommendation

**✅ APPROVE AND IMPLEMENT**

**Confidence:** 95%
**Risk:** Low
**ROI:** High (significant UX improvement for minimal effort)

**Next Steps:**
1. Approve this approach
2. Implement forecasts tool (50 min)
3. Test with usability study queries
4. Deploy and monitor
5. Implement opportunities tool if needed (35 min)

---

**Key Files:**
- Full Analysis: `/Users/mikec/Tango-MCP/tango-mcp/MULTI_WORD_QUERY_SOLUTION.md`
- Implementation Reference: `src/tools/search-contracts.ts` (lines 469-519)
- Utility to Reuse: `src/utils/query-analyzer.ts`

**Document Version:** 1.0
**Last Updated:** 2025-11-19
