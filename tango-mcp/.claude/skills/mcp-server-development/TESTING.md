# Testing - Strategies and Patterns

Complete guide to testing MCP servers.

## Test Types

### Unit Tests
Fast, isolated tests for individual components.
- **Location**: `test/unit/`
- **Speed**: ~1 second
- **Run**: `npm run test:unit`

### Integration Tests  
End-to-end tests using YAML specs.
- **Location**: `test/integration/specs/`
- **Speed**: ~5-30 seconds
- **Run**: `npm run test:integration`

## Unit Testing Tools

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerWeatherTool } from "../../../src/tools/weather.js";

describe("weather tool", () => {
  let server: McpServer;

  beforeEach(() => {
    server = new McpServer({
      name: "test-server",
      version: "1.0.0"
    });
    registerWeatherTool(server);
  });

  it("should handle valid parameters", async () => {
    // TODO: Implement test
    expect(server).toBeDefined();
  });

  it("should validate parameters", async () => {
    // Test Zod schema validation
  });

  it("should handle errors gracefully", async () => {
    // Test error handling
  });
});
```

## Integration Test YAML

### Tool Test Spec
```yaml
name: "weather - Get current weather"
description: "Test weather tool with valid location"
tool: "weather"
arguments:
  location: "San Francisco"
  units: "celsius"

assertions:
  - type: "success"
  - type: "response_time_ms"
    max: 5000
  - type: "contains_text"
    text: "San Francisco"
  - type: "json_path"
    path: "$.location"
    expected: "San Francisco"
```

### Prompt Test Spec
```yaml
name: "code-reviewer - Basic review"
description: "Test code review prompt"
prompt: "code-reviewer"
arguments:
  language: "typescript"
  style: "thorough"

assertions:
  - type: "success"
  - type: "contains_text"
    text: "code review"
```

### Resource Test Spec
```yaml
name: "config - App configuration"
description: "Test configuration resource"
resource: "app-config"
uri: "config://app/settings"

assertions:
  - type: "success"
  - type: "json_path"
    path: "$.version"
    expected: "1.0.0"
```

## Assertion Types

### Success Assertion
Tests that operation completed without errors.
```yaml
- type: "success"
```

### Response Time
Tests performance.
```yaml
- type: "response_time_ms"
  max: 3000
```

### Contains Text
Tests for specific text in response.
```yaml
- type: "contains_text"
  text: "expected string"
```

### JSON Path
Tests JSON structure and values.
```yaml
- type: "json_path"
  path: "$.data.items[0].name"
  expected: "value"
```

### Regex
Tests pattern matching.
```yaml
- type: "regex"
  pattern: "^\\d{4}-\\d{2}-\\d{2}$"
```

### Error Assertion
Tests that error occurred.
```yaml
- type: "error"
  expectedMessage: "Invalid parameter"
```

## Choosing the Right Assertion

### json_path vs contains_text

**Use `json_path` when**:
- Testing structured JSON responses
- Checking specific fields exist or have values
- Verifying nested data structures
- Need type-safe value checking (numbers, booleans, objects, arrays)

**Use `contains_text` when**:
- Testing unstructured text responses
- Looking for keywords anywhere in response
- Case-insensitive matching needed
- Don't care about JSON structure

### Common json_path Patterns

**Existence checks** (omit `expected`):
```yaml
# Check if field exists (any value)
- type: "json_path"
  path: "$.data.id"

# Check if array has elements
- type: "json_path"
  path: "$.results[0]"
```

**Value checks** (provide `expected`):
```yaml
# String value
- type: "json_path"
  path: "$.status"
  expected: "success"

# Number value (not string!)
- type: "json_path"
  path: "$.count"
  expected: 42

# Boolean value
- type: "json_path"
  path: "$.active"
  expected: true

# Array value
- type: "json_path"
  path: "$.tags"
  expected: ["typescript", "mcp"]

# Object value
- type: "json_path"
  path: "$.user"
  expected:
    name: "Alice"
    role: "admin"
```

**Nested paths**:
```yaml
- type: "json_path"
  path: "$.data.user.profile.email"
  expected: "user@example.com"
```

**Array indexing**:
```yaml
- type: "json_path"
  path: "$.items[0].name"
  expected: "First Item"
```

## Troubleshooting

### json_path Assertion Failures

**Problem**: "Value at path does not match expected (type mismatch: number vs string)"

**Cause**: Type mismatch between actual and expected values.

**Fix**: Use correct type in YAML:
```yaml
❌ Wrong:
- type: "json_path"
  path: "$.count"
  expected: "42"  # String

✅ Right:
- type: "json_path"
  path: "$.count"
  expected: 42  # Number
```

**Problem**: "Path does not exist in response"

**Cause**: Path is incorrect or response structure differs.

**Fix**:
1. Check actual response structure
2. Verify path syntax (use `$.` prefix)
3. Check for typos in field names

**Problem**: Deep equality fails for similar objects

**Cause**: Extra fields or different field order.

**Fix**: Ensure `expected` matches actual structure exactly:
```yaml
# Actual: {name: "Alice", age: 30, active: true}

❌ Fails (missing field):
- type: "json_path"
  path: "$.user"
  expected:
    name: "Alice"
    age: 30

✅ Passes (exact match):
- type: "json_path"
  path: "$.user"
  expected:
    name: "Alice"
    age: 30
    active: true
```

## Testing Patterns

### Test Valid Input
```typescript
it("should process valid input", async () => {
  const result = await callTool("weather", {
    location: "Paris",
    units: "celsius"
  });
  
  expect(result.content[0].text).toContain("Paris");
});
```

### Test Invalid Input
```typescript
it("should reject invalid input", async () => {
  const result = await callTool("weather", {
    location: "",  // Invalid: empty
    units: "invalid"  // Invalid: not in enum
  });
  
  expect(result.isError).toBe(true);
});
```

### Test Edge Cases
```typescript
it("should handle edge cases", async () => {
  // Test with null, undefined, extreme values
  const result = await callTool("weather", {
    location: "A".repeat(1000),  // Very long input
    units: "celsius"
  });
  
  expect(result).toBeDefined();
});
```

### Test Async Operations
```typescript
it("should handle async operations", async () => {
  const result = await callTool("fetch-data", {
    url: "https://api.example.com/data"
  });
  
  expect(result.content).toBeDefined();
});
```

## Coverage Goals

Aim for:
- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

Run coverage:
```bash
npm run test:coverage
```

## Best Practices

✅ **Test Happy Path**: Ensure normal operations work
✅ **Test Edge Cases**: Boundary values, nulls, empty strings
✅ **Test Error Handling**: Verify errors are handled gracefully
✅ **Test Async**: Ensure promises resolve/reject correctly
✅ **Use Descriptive Names**: Clear test descriptions
✅ **Keep Tests Fast**: Unit tests should be < 1 second
✅ **Mock External Dependencies**: Don't call real APIs in tests

❌ **Don't Skip Tests**: Every component needs tests
❌ **Don't Test Implementation**: Test behavior, not internals
❌ **Don't Make Tests Dependent**: Each test should be independent
❌ **Don't Ignore Failures**: Fix failing tests immediately

## Running Tests

```bash
# All unit tests
npm run test:unit

# Specific test file
npm run test:unit test/unit/tools/weather.test.ts

# Watch mode (re-run on changes)
npm run test:watch

# With coverage
npm run test:coverage

# Integration tests (requires dev server)
npm run dev  # Terminal 1
npm run test:integration  # Terminal 2
```

