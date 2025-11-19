# Multi-Word Query Handling: Solution Analysis and Recommendations

**Date:** 2025-11-19
**Author:** Claude (Sonnet 4.5)
**Status:** Analysis Complete - Ready for Implementation

---

## Executive Summary

**Problem:** Users naturally try multi-word descriptive queries like "artificial intelligence AI machine learning" but these return 0 results. Simple keywords like "AI" work great (59 results).

**Root Cause:** The Tango API performs exact phrase matching, not keyword OR matching. Multi-word queries fail because the API searches for the entire phrase as-is.

**Recommended Solution:** **Hybrid Approach - Combine Solutions 1, 2, and 4**
- Implement smart retry logic (Solution 1) for forecasts tool only
- Enhance error messages (Solution 4) with actionable guidance
- Update documentation (Solution 2) with best practices
- Skip query preprocessing (Solution 3) - too complex, not needed

**Implementation Status:**
- ✅ Contracts tool already has this solution (commit b3553dd)
- ⏳ Forecasts tool needs implementation
- ⏳ Opportunities tool may benefit (lower priority)

---

## Current State Analysis

### What's Already Working

The **search_tango_contracts** tool (as of commit b3553dd) already implements an intelligent solution for multi-word queries:

1. **Query Analyzer Utility** (`src/utils/query-analyzer.ts`)
   - Detects 20 federal agencies (VA, DOD, DHS, GSA, etc.)
   - Extracts NAICS codes from queries
   - Returns confidence levels (high/medium/low)
   - Provides refined query suggestions

2. **Zero-Results Detection** (`src/tools/search-contracts.ts`, lines 469-519)
   ```typescript
   if (normalizedContracts.length === 0 && sanitized.query) {
     const analysis = analyzeQuery(sanitized.query);

     if (analysis.confidence === "high" && analysis.suggestedAgency) {
       return {
         suggestions: {
           detected_issue: "Zero results for multi-concept query",
           recommended_approach: {
             awarding_agency: analysis.suggestedAgency,
             query: analysis.refinedQuery || sanitized.query
           },
           explanation: "Your query appears to mix agency and topic keywords...",
           example: { /* executable example */ }
         }
       };
     }
   }
   ```

3. **Enhanced Documentation** (lines 52-53)
   - Clear guidance on what works vs what doesn't
   - Examples of good vs bad queries
   - Explains API behavior

### What's Missing

1. **search_tango_forecasts** tool has NO smart retry logic
   - Tool description is generic (line 31)
   - No query analysis on zero results
   - No helpful suggestions when searches fail
   - Simple parameter descriptions without examples

2. **search_tango_opportunities** tool has basic descriptions
   - Adequate documentation (lines 40-47)
   - No smart retry logic
   - Could benefit from similar enhancements

---

## Solution Evaluation

### Solution 1: Smart Retry Logic ⭐ RECOMMENDED

**Description:** Automatically try simpler variations when 0 results

**Pros:**
- ✅ Best UX - transparent and helpful
- ✅ Non-intrusive - only activates on failure
- ✅ Educational - teaches users correct patterns
- ✅ Already proven in contracts tool
- ✅ Agent-friendly - provides executable examples

**Cons:**
- ⚠️ Adds ~100ms latency on zero-result queries (minimal impact)
- ⚠️ Requires query analyzer utility (already exists)

**Performance Impact:**
- Zero-result queries: +100ms (query analysis)
- Successful queries: 0ms overhead
- Overall: Negligible (zero results are rare)

**Implementation Complexity:** Low (reuse existing utilities)

**Maintenance Burden:** Low (isolated, well-tested utility)

**Verdict:** ✅ **IMPLEMENT** - Proven, effective, low cost

---

### Solution 2: Better Documentation ⭐ RECOMMENDED

**Description:** Update tool descriptions to explain search behavior

**Pros:**
- ✅ Zero runtime cost
- ✅ Helps LLMs choose better queries upfront
- ✅ Quick to implement
- ✅ Already proven in contracts tool

**Cons:**
- ⚠️ Doesn't help when LLMs ignore guidance
- ⚠️ Requires ongoing maintenance

**Performance Impact:** None

**Implementation Complexity:** Very Low

**Maintenance Burden:** Low

**Verdict:** ✅ **IMPLEMENT** - Essential complement to Solution 1

---

### Solution 3: Query Preprocessing ❌ NOT RECOMMENDED

**Description:** Transform complex queries before sending to API

**Pros:**
- ✅ Could improve success rate upfront

**Cons:**
- ❌ High complexity - requires NLP logic
- ❌ Risk of false positives (breaking valid queries)
- ❌ Hard to maintain and test
- ❌ Adds latency to ALL queries
- ❌ May interfere with user intent
- ❌ Not transparent to users

**Performance Impact:** +50-100ms on every query

**Implementation Complexity:** High

**Maintenance Burden:** High

**Verdict:** ❌ **DO NOT IMPLEMENT** - Too complex, not worth it

---

### Solution 4: Enhanced Error Messages ⭐ RECOMMENDED

**Description:** When 0 results, provide actionable guidance

**Pros:**
- ✅ Already part of Solution 1
- ✅ No additional work needed
- ✅ Highly effective for UX

**Cons:**
- None (covered by Solution 1)

**Verdict:** ✅ **IMPLEMENT** - Part of Solution 1

---

## Recommended Solution: Hybrid Approach

### Implementation Plan

**Phase 1: Forecasts Tool Enhancement (High Priority)**

1. **Update Tool Description** (~15 minutes)
   - File: `src/tools/search-forecasts.ts`, line 31
   - Add clear guidance on query patterns
   - Provide examples of good vs bad queries
   - Explain that simple keywords work best

   ```typescript
   "Search federal procurement forecast opportunities...
   BEST PRACTICES: Use for single concepts like 'cloud services' or 'IT modernization'.
   AVOID mixing multiple concepts in one query.
   EXAMPLES OF WHAT WORKS WELL: query='cybersecurity' with agency='HHS',
   query='professional services', query='data analytics'.
   EXAMPLES OF WHAT DOESN'T WORK: query='HHS cloud services AI' (mixing agency + multiple topics).
   INSTEAD USE: agency='HHS' with query='cloud services'.
   For agency searches, use the 'agency' parameter."
   ```

2. **Add Zero-Results Detection** (~30 minutes)
   - File: `src/tools/search-forecasts.ts`, after line 255
   - Import and use existing `analyzeQuery` utility
   - Provide suggestions when searches fail with agency patterns

   ```typescript
   // Add after normalization (line 255)
   if (normalizedForecasts.length === 0 && sanitized.query) {
     const analysis = analyzeQuery(sanitized.query);

     if (analysis.confidence === "high" && analysis.suggestedAgency) {
       logger.info("Zero results with detected agency pattern", {
         query: sanitized.query,
         detectedAgency: analysis.suggestedAgency,
         confidence: analysis.confidence,
       });

       return {
         content: [{
           type: "text",
           text: JSON.stringify({
             data: [],
             total: 0,
             returned: 0,
             filters: sanitized,
             suggestions: {
               detected_issue: "Zero results for multi-concept query",
               recommended_approach: {
                 agency: analysis.suggestedAgency,
                 query: analysis.refinedQuery || sanitized.query,
               },
               explanation: `Your query "${sanitized.query}" appears to mix agency and topic keywords. The API works best when agency filters are separated from free-text search. Try using agency="${analysis.suggestedAgency}" with query="${analysis.refinedQuery || sanitized.query}".`,
               example: {
                 tool: "search_tango_forecasts",
                 params: {
                   agency: analysis.suggestedAgency,
                   query: analysis.refinedQuery || undefined,
                   limit: sanitized.limit,
                 },
               },
             },
             execution: {
               duration_ms: Date.now() - startTime,
               cached: response.cache?.hit || false,
               api_calls: 1,
             },
           }, null, 2),
         }],
       };
     }
   }
   ```

3. **Update Query Parameter Description** (~5 minutes)
   - File: `src/tools/search-forecasts.ts`, lines 35-38
   - Add examples and best practices

   ```typescript
   query: z
     .string()
     .optional()
     .describe(
       "Free-text search across forecast titles and descriptions. BEST PRACTICES: Use for single concepts like 'cloud infrastructure' or 'professional services'. AVOID mixing multiple concepts. EXAMPLES: query='cybersecurity', query='IT modernization', query='medical equipment'. For agency searches, use the 'agency' parameter instead of including agency names in the query.",
     ),
   ```

**Phase 2: Opportunities Tool Enhancement (Medium Priority)**

1. **Update Tool Description** (~10 minutes)
   - File: `src/tools/search-opportunities.ts`, line 40
   - Add best practices similar to forecasts tool

2. **Add Zero-Results Detection** (~20 minutes)
   - Similar to forecasts implementation
   - Lower priority since opportunities are less problematic

**Phase 3: Testing and Validation** (~30 minutes)

1. **Unit Tests**
   - Test zero-result detection logic
   - Test suggestion generation
   - Test that existing functionality is preserved

2. **Integration Tests**
   - Test with known problematic queries
   - Verify suggestions are helpful
   - Ensure performance is acceptable

3. **Manual Testing**
   - Test with actual usability study queries
   - "artificial intelligence AI machine learning"
   - "HHS forecasts for cloud services"
   - "VA cybersecurity contracts"

---

## Which Tools Need Updates?

| Tool | Priority | Reason | Estimated Effort |
|------|----------|--------|------------------|
| **search_tango_forecasts** | 🔴 **HIGH** | Most affected by multi-word queries. Users expect forecasts to be searchable by topic. | 50 minutes |
| **search_tango_opportunities** | 🟡 **MEDIUM** | Moderate impact. Opportunities often searched by topic + agency. | 35 minutes |
| **search_tango_contracts** | ✅ **DONE** | Already implemented (commit b3553dd). No action needed. | 0 minutes |
| **search_tango_grants** | 🟢 **LOW** | Less affected. Grants typically searched by CFDA or recipient. | Optional |
| **search_tango_idvs** | 🟢 **LOW** | Less affected. IDVs searched by vehicle name or agency. | Optional |

**Total Estimated Effort:** 85 minutes (~1.5 hours)

---

## Testing Strategy

### Test Cases

1. **Zero-Result Query with Agency Pattern**
   ```typescript
   // Input
   query: "VA digital services forecasts"

   // Expected Output
   {
     data: [],
     total: 0,
     suggestions: {
       detected_issue: "Zero results for multi-concept query",
       recommended_approach: {
         agency: "VA",
         query: "digital services forecasts"
       },
       explanation: "...",
       example: { /* executable */ }
     }
   }
   ```

2. **Zero-Result Query without Agency Pattern**
   ```typescript
   // Input
   query: "artificial intelligence machine learning"

   // Expected Output
   {
     data: [],
     total: 0,
     returned: 0,
     filters: { query: "artificial intelligence machine learning" }
     // No suggestions (no agency detected)
   }
   ```

3. **Successful Query (No Suggestion)**
   ```typescript
   // Input
   query: "cybersecurity"

   // Expected Output
   {
     data: [ /* results */ ],
     total: 59,
     returned: 10
     // No suggestions (query succeeded)
   }
   ```

4. **Zero-Result Query with NAICS Pattern**
   ```typescript
   // Input
   query: "NAICS 541512 cloud services"

   // Expected Output (if implemented)
   {
     data: [],
     total: 0,
     suggestions: {
       detected_issue: "Zero results for multi-concept query",
       recommended_approach: {
         naics_code: "541512",
         query: "cloud services"
       }
     }
   }
   ```

### Performance Tests

1. **Measure Latency Impact**
   - Baseline: Successful query latency
   - Zero-result query with suggestion: +100ms max
   - Zero-result query without suggestion: +50ms max

2. **Cache Effectiveness**
   - Ensure cache still works with new logic
   - Verify cache keys are consistent

### Integration Tests

1. **Test with Real API**
   - Use actual problematic queries from usability study
   - Verify suggestions are helpful and accurate
   - Ensure examples are executable

2. **Test with Multiple Tools**
   - Verify consistency across tools
   - Ensure error handling is uniform

---

## Implementation Guidance

### Code Reuse

**Existing Utilities to Reuse:**
1. `src/utils/query-analyzer.ts` - Already exists, fully tested
   - 368 lines, 100+ test cases
   - Detects agencies, NAICS codes, confidence levels
   - No changes needed

2. Pattern from `src/tools/search-contracts.ts` (lines 469-519)
   - Copy and adapt for forecasts tool
   - Minimal modifications needed

### Code Quality Checklist

- ✅ Import existing utilities (no duplication)
- ✅ Use existing logger for observability
- ✅ Preserve all existing functionality
- ✅ Add comprehensive tests
- ✅ Update documentation
- ✅ Follow existing code style
- ✅ Type safety with TypeScript

### Error Handling

- ✅ Graceful degradation if query analysis fails
- ✅ Log all suggestion events for monitoring
- ✅ Ensure suggestions don't break API responses
- ✅ Validate suggestions before returning

---

## Trade-offs Analysis

### Performance vs UX

**Decision:** Prioritize UX over minimal latency increase

**Rationale:**
- Zero-result queries are frustrating
- +100ms latency is imperceptible
- Suggestions provide significant value
- Only affects failed queries (rare)

### Complexity vs Completeness

**Decision:** Simple, proven approach over complex preprocessing

**Rationale:**
- Query preprocessing is complex and error-prone
- Zero-result detection is simple and reliable
- Already proven in contracts tool
- Low maintenance burden

### Consistency vs Customization

**Decision:** Consistent approach across all search tools

**Rationale:**
- Easier to maintain
- Consistent UX for users
- Reusable utilities
- Lower testing burden

---

## Success Metrics

### Quantitative Metrics

1. **Zero-Result Rate Reduction**
   - Baseline: % of queries returning 0 results
   - Target: 20% reduction after implementation
   - Measurement: Compare 30 days before/after

2. **Suggestion Acceptance Rate**
   - Track: % of suggestions followed by retry with recommended params
   - Target: >50% acceptance rate
   - Measurement: Log analysis

3. **Query Latency**
   - Baseline: Median query latency
   - Target: <10% increase on zero-result queries
   - Measurement: Performance monitoring

### Qualitative Metrics

1. **User Satisfaction**
   - Measure: User feedback, error reports
   - Target: Fewer complaints about "no results"

2. **Error Message Quality**
   - Measure: Support ticket reduction
   - Target: Fewer "how do I search" questions

---

## Rollout Plan

### Phase 1: Implementation (Week 1)
- Day 1: Implement forecasts tool enhancements
- Day 2: Add comprehensive tests
- Day 3: Update documentation

### Phase 2: Testing (Week 1)
- Day 4: Unit and integration testing
- Day 5: Manual testing with usability study queries

### Phase 3: Deployment (Week 2)
- Day 1: Deploy to staging
- Day 2: Monitor metrics
- Day 3: Deploy to production

### Phase 4: Monitoring (Week 2-4)
- Monitor zero-result rate
- Track suggestion acceptance
- Gather user feedback
- Iterate if needed

---

## Post-Implementation Actions

1. **Monitor Metrics**
   - Track zero-result rate
   - Monitor suggestion acceptance
   - Watch for performance regression

2. **Gather Feedback**
   - User surveys
   - Support ticket analysis
   - LLM behavior observation

3. **Iterate**
   - Add more agency patterns if needed
   - Refine suggestion messages
   - Optimize query analysis logic

4. **Document Learnings**
   - Update best practices guide
   - Share learnings with team
   - Update training materials

---

## Risks and Mitigations

### Risk 1: False Positives
**Risk:** Query analyzer detects agencies in queries where they shouldn't be split

**Mitigation:**
- Only activate on zero results (no false positives on successful queries)
- Use high confidence threshold
- Log all suggestions for review

### Risk 2: Performance Degradation
**Risk:** Query analysis adds too much latency

**Mitigation:**
- Only run on zero-result queries
- Optimize regex patterns
- Cache analysis results
- Monitor performance metrics

### Risk 3: Suggestion Confusion
**Risk:** Suggestions confuse users instead of helping

**Mitigation:**
- Clear, actionable language
- Provide executable examples
- A/B test message variations
- Gather user feedback

### Risk 4: Maintenance Burden
**Risk:** Solution becomes hard to maintain

**Mitigation:**
- Comprehensive test coverage
- Isolated, reusable utilities
- Clear documentation
- Simple, proven patterns

---

## Alternatives Considered and Rejected

### 1. Server-Side Query Rewriting
**Why Rejected:** Too invasive, risk of breaking user intent

### 2. Client-Side AI Query Optimization
**Why Rejected:** Beyond scope, requires LLM integration

### 3. Multiple API Calls with OR Logic
**Why Rejected:** Performance penalty, API rate limits

### 4. Full-Text Search Index
**Why Rejected:** API limitation, not under our control

---

## Conclusion

**Recommended Implementation:**
1. ✅ **Solution 1 + 4:** Smart retry logic with enhanced error messages
2. ✅ **Solution 2:** Better documentation
3. ❌ **Solution 3:** Skip query preprocessing (too complex)

**Target Tools:**
- 🔴 **High Priority:** search_tango_forecasts (50 minutes)
- 🟡 **Medium Priority:** search_tango_opportunities (35 minutes)
- ✅ **Done:** search_tango_contracts

**Total Effort:** ~85 minutes (~1.5 hours)

**Expected Impact:**
- 20% reduction in zero-result queries
- Better UX for failed searches
- Minimal performance impact (+100ms on failures only)
- Educational for users (teaches correct patterns)

**Risk Level:** Low (proven approach, comprehensive testing)

**Confidence:** High (95%)

---

**Next Steps:**
1. Review and approve this analysis
2. Implement forecasts tool enhancements
3. Test with usability study queries
4. Deploy and monitor
5. Iterate based on metrics

---

**Document Version:** 1.0
**Last Updated:** 2025-11-19
**Approved By:** Pending Review
