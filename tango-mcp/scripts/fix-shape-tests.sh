#!/bin/bash
# Fix shape parameter tests - replace cache-focused tests with API parameter tests

set -e

echo "Fixing shape parameter tests..."

# Fix search-idvs.test.ts
sed -i '' 's/it("should include shape parameter in cache key when present"/it("should pass shape parameter to API when present"/' /Users/mikec/Tango-MCP/tango-mcp/test/unit/tools/search-idvs.test.ts
sed -i '' 's/it("should differentiate cache keys with different shapes"/it("should pass different shape values to API"/' /Users/mikec/Tango-MCP/tango-mcp/test/unit/tools/search-idvs.test.ts
sed -i '' 's/it("should pass empty shape parameter as-is"/it("should omit shape parameter when empty"/' /Users/mikec/Tango-MCP/tango-mcp/test/unit/tools/search-idvs.test.ts

# Fix search-subawards.test.ts
sed -i '' 's/it("should include shape parameter in cache key when present"/it("should pass shape parameter to API when present"/' /Users/mikec/Tango-MCP/tango-mcp/test/unit/tools/search-subawards.test.ts
sed -i '' 's/it("should differentiate cache keys with different shapes"/it("should pass different shape values to API"/' /Users/mikec/Tango-MCP/tango-mcp/test/unit/tools/search-subawards.test.ts
sed -i '' 's/it("should pass empty shape parameter as-is"/it("should omit shape parameter when empty"/' /Users/mikec/Tango-MCP/tango-mcp/test/unit/tools/search-subawards.test.ts

echo "Test names updated. Now updating test implementations..."

# For now, just delete the problematic tests and we'll rewrite them
# This is faster than trying to sed complex multi-line patterns

cat > /tmp/fix-tests.py << 'EOF'
import re

def fix_test_file(filepath, api_method):
    with open(filepath, 'r') as f:
        content = f.read()

    # Pattern 1: Fix "should pass shape parameter to API when present" test
    pattern1 = r'(it\("should pass shape parameter to API when present".*?)(\/\/ Verify cache\.get was called.*?expect\(cacheKey\)\.toContain\("shape"\);)'
    replacement1 = r'\1// Verify shape was passed to API\n\t\tconst callParams = ' + api_method + r'.mock.calls[0][0];\n\t\texpect(callParams).toHaveProperty("shape");\n\t\texpect(callParams.shape).toBe("key,piid,obligated");'
    content = re.sub(pattern1, replacement1, content, flags=re.DOTALL)

    # Pattern 2: Remove mockCache from first test
    pattern2 = r'(it\("should pass shape parameter to API when present".*?const mockCache = \{\s*get:.*?} as any;\s*)'
    content = re.sub(pattern2, lambda m: m.group(0).replace(re.search(r'const mockCache = \{.*?} as any;\s*', m.group(0), re.DOTALL).group(0), ''), content, flags=re.DOTALL)

    pattern3 = r'registerSearch\w+Tool\(mockServer, mockEnv, mockCache\);'
    content = re.sub(pattern3, lambda m: m.group(0).replace(', mockCache', ''), content)

    # Write back
    with open(filepath, 'w') as f:
        f.write(content)

# Process files
fix_test_file('/Users/mikec/Tango-MCP/tango-mcp/test/unit/tools/search-idvs.test.ts', 'mockSearchIDVs')
fix_test_file('/Users/mikec/Tango-MCP/tango-mcp/test/unit/tools/search-subawards.test.ts', 'mockSearchSubawards')

print("Tests fixed!")
EOF

python3 /tmp/fix-tests.py

echo "Done!"
