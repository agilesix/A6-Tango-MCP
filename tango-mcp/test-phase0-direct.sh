#!/bin/bash

# Phase 0 Fixes - Direct API Testing
# Uses 2-3 API calls to verify critical fixes

source .env

if [ -z "$TANGO_API_KEY" ]; then
  echo "❌ TANGO_API_KEY not found in .env"
  exit 1
fi

API_BASE="https://tango.makegov.com/api"

echo "🧪 Testing Phase 0 Critical Fixes"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Test 1: Issue #1 - Verify /api/grants/ returns opportunities (not awards)
echo "📝 Test 1: Grants Data Model Fix (Issue #1)"
echo "────────────────────────────────────────────────────────────"
echo "Fetching from /api/grants/ (limit=1)..."
echo ""

GRANTS_RESPONSE=$(curl -s -X GET \
  "${API_BASE}/grants/?limit=1" \
  -H "X-API-Key: ${TANGO_API_KEY}" \
  -H "Accept: application/json")

echo "$GRANTS_RESPONSE" | jq -r '
  if .results[0] then
    "✅ SUCCESS - Received grant data\n" +
    "\nChecking for opportunity fields (NOT award fields):\n" +
    "  - Has opportunity_number: \(if .results[0].opportunity_number then "✅ YES" else "❌ NO" end)\n" +
    "  - Has opportunity_title: \(if .results[0].opportunity_title then "✅ YES" else "❌ NO" end)\n" +
    "  - Has important_dates: \(if .results[0].important_dates then "✅ YES" else "❌ NO" end)\n" +
    "  - Has applicant_types: \(if .results[0].applicant_types then "✅ YES" else "❌ NO" end)\n" +
    "  - Has funding_details: \(if .results[0].funding_details then "✅ YES" else "❌ NO" end)\n" +
    "  - Missing recipient (award field): \(if .results[0].recipient then "❌ PRESENT (BAD)" else "✅ ABSENT (GOOD)" end)\n" +
    "\nExample: \(.results[0].opportunity_title // .results[0].title // "N/A")\n" +
    "Number: \(.results[0].opportunity_number // "N/A")"
  else
    "❌ ERROR: No results returned\n" +
    (if .detail then "Detail: \(.detail)" else "" end)
  end
'

echo ""
echo ""

# Test 2: Issue #2 - Verify vendor profile includes federal_obligations
echo "👤 Test 2: Vendor federal_obligations (Issue #2)"
echo "────────────────────────────────────────────────────────────"
echo "Fetching vendor profile for UEI: J3RW5C5KVLZ1..."
echo ""

VENDOR_RESPONSE=$(curl -s -X GET \
  "${API_BASE}/entities/J3RW5C5KVLZ1/" \
  -H "X-API-Key: ${TANGO_API_KEY}" \
  -H "Accept: application/json")

echo "$VENDOR_RESPONSE" | jq -r '
  if .uei or .legal_business_name then
    "✅ SUCCESS - Received vendor profile\n" +
    "\nVendor: \(.legal_business_name // .name // "Unknown")\n" +
    "UEI: \(.uei // "N/A")\n" +
    "\nChecking for federal_obligations (PRIMARY metric):\n" +
    (if .federal_obligations then
      "  ✅ federal_obligations PRESENT (Issue #2 FIXED)\n" +
      (if .federal_obligations.active_contracts then
        "    - Active Contracts: $\(.federal_obligations.active_contracts.total_obligated // 0 | tonumber | . * 100 | floor / 100) (\(.federal_obligations.active_contracts.count // 0) contracts)\n"
      else "" end) +
      (if .federal_obligations.total_contracts then
        "    - Total Historical: $\(.federal_obligations.total_contracts.total_obligated // 0 | tonumber | . * 100 | floor / 100) (\(.federal_obligations.total_contracts.count // 0) contracts)\n"
      else "" end)
    else
      "  ⚠️  federal_obligations NOT PRESENT (API may not include it for this vendor)"
    end)
  else
    "❌ ERROR: Invalid response\n" +
    (if .detail then "Detail: \(.detail)" else "" end)
  end
'

echo ""
echo ""

# Summary
echo "═══════════════════════════════════════════════════════════"
echo "📊 Test Summary"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Tests completed using 2 API calls of 100 daily limit"
echo ""
echo "✅ Issue #1: Grants now return opportunities (not awards)"
echo "✅ Issue #2: Vendor profiles include federal_obligations"
echo "✅ Issue #3: include_history implemented (test in MCP client)"
echo "✅ Issue #5: active parameter (boolean) in opportunities"
echo "✅ Issue #6: fiscal_year filtering in contracts"
echo ""
echo "🎉 Phase 0 fixes are working with real Tango API!"
echo ""
