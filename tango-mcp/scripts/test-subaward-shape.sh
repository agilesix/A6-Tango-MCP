#!/bin/bash
# Test if Tango API /subawards/ endpoint supports shape parameter

set -e

# Check if API key is in environment
if [ -f ".env" ]; then
    source .env
fi

if [ -z "$TANGO_API_KEY" ]; then
    echo "ERROR: TANGO_API_KEY not set"
    echo "Set it in .env file or environment"
    exit 1
fi

echo "Testing subawards API with shape parameter..."
echo ""

# Test 1: Without shape (baseline)
echo "1. Without shape parameter (should work):"
curl -s "https://tango.makegov.com/api/subawards/?limit=1" \
  -H "X-API-Key: $TANGO_API_KEY" | jq -c '{count: (.results | length), has_error: has("detail")}'
echo ""

# Test 2: With shape parameter
echo "2. With shape parameter:"
curl -s "https://tango.makegov.com/api/subawards/?limit=1&shape=key,amount" \
  -H "X-API-Key: $TANGO_API_KEY" | jq -c '{count: (.results | length), has_error: has("detail"), error: .detail}'
echo ""

# Test 3: Compare with contracts (known to work)
echo "3. Contracts with shape (should work):"
curl -s "https://tango.makegov.com/api/contracts/?limit=1&shape=key,obligated" \
  -H "X-API-Key: $TANGO_API_KEY" | jq -c '{count: (.results | length), has_error: has("detail")}'
echo ""

# Test 4: IDVs with shape (known to work)
echo "4. IDVs with shape (should work):"
curl -s "https://tango.makegov.com/api/idvs/?limit=1&shape=key,obligated" \
  -H "X-API-Key: $TANGO_API_KEY" | jq -c '{count: (.results | length), has_error: has("detail")}'
echo ""

echo "Test complete!"
