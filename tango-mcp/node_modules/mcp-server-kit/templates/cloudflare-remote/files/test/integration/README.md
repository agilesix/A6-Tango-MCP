# Integration Tests

Declarative YAML-based integration tests for your MCP server tools.

## Quick Start

### Running Tests

```bash
# Run all integration tests
npm run integration:run

# List available tests
npm run integration:list

# Run specific test
npm run integration:run -- --spec base64-encode
```

### Writing Your First Test

Create a test spec in `specs/` directory (e.g., `specs/my-tool.yaml`):

```yaml
name: "My Tool - Basic Test"
description: "Test that my-tool works correctly"
tool: "my-tool"
arguments:
  input: "test data"

assertions:
  - type: "success"
  - type: "response_time_ms"
    max: 5000
  - type: "contains_text"
    text: "expected output"
```

Run the test:
```bash
npm run integration:run
```

---

## Test Specification Format

### Required Fields

```yaml
name: string           # Human-readable test name
tool: string           # MCP tool name to test
arguments: object      # Tool arguments
assertions: array      # Array of assertions
```

### Optional Fields

```yaml
description: string    # Test description
timeout: number        # Test timeout (milliseconds)
skip: boolean          # Skip this test
only: boolean          # Only run this test
```

---

## Common Assertion Types

### Success/Error Checks

```yaml
# Verify tool succeeds
- type: "success"

# Verify tool fails
- type: "error"
  messageContains: "not found"  # optional
```

### Response Content

```yaml
# Check for text in response
- type: "contains_text"
  text: "expected string"
  caseInsensitive: false  # optional

# Check text is NOT present
- type: "not_contains_text"
  text: "unwanted string"

# Regex pattern matching
- type: "regex_match"
  pattern: "^Success: "
```

### Performance

```yaml
# Verify response time
- type: "response_time_ms"
  max: 5000  # milliseconds
```

### JSON Data Validation

The `json_path` assertion supports two modes:

**Existence Check** (when `expected` is omitted):
```yaml
# Check if path exists (any value including null, false, 0, "")
- type: "json_path"
  path: "$.data.id"
```

**Value Check** (when `expected` is provided):
```yaml
# Check path has specific value (uses deep equality)
- type: "json_path"
  path: "$.status"
  expected: "success"

# Supports nested objects, arrays, and all JSON types
- type: "json_path"
  path: "$.items"
  expected: [1, 2, 3]
```

**Important**: Type matching is strict - `42` ≠ `"42"`. Use the correct type in your `expected` value.

---

## Complete Example

```yaml
name: "Data Processor - CSV to JSON"
description: "Test CSV to JSON conversion with validation"
tool: "csv-to-json"
arguments:
  csv: "name,age\nAlice,30\nBob,25"
  delimiter: ","
timeout: 10000

assertions:
  - type: "success"
  - type: "response_time_ms"
    max: 3000
  - type: "contains_text"
    text: "Alice"
  - type: "json_path"
    path: "$[0].name"
    expected: "Alice"
  - type: "json_path"
    path: "$[0].age"
    expected: "30"
```

---

## Tips & Best Practices

### Testing Error Cases

```yaml
name: "My Tool - Invalid Input"
tool: "my-tool"
arguments:
  input: ""

assertions:
  - type: "error"
    messageContains: "input is required"
```

### Testing Performance

```yaml
assertions:
  - type: "response_time_ms"
    max: 1000  # Fail if slower than 1 second
```

### Multiple Scenarios

Create separate YAML files for different scenarios:
- `my-tool-success.yaml` - Happy path
- `my-tool-invalid-input.yaml` - Error handling
- `my-tool-edge-cases.yaml` - Boundary conditions

### Debugging Failed Tests

1. Check test output for specific assertion that failed
2. Run single test: `npm run integration:run -- --spec tool-name`
3. Verify tool arguments are correct
4. Test tool manually in development mode

---

## All Available Assertion Types

| Type | Purpose | Parameters |
|------|---------|------------|
| `success` | Tool succeeded | - |
| `error` | Tool failed | `messageContains` (optional) |
| `contains_text` | Response includes text | `text`, `caseInsensitive` |
| `not_contains_text` | Response excludes text | `text`, `caseInsensitive` |
| `regex_match` | Regex pattern match | `pattern` |
| `response_time_ms` | Performance check | `max` |
| `json_path` | JSON path validation | `path`, `expected` (optional) |

---

## Additional Resources

- **Full Harness Documentation**: See [mcp-server-kit harness README](https://github.com/mikec-ai/mcp-server-kit/blob/master/src/harness/README.md)
- **Example Tests**: Check `specs/health.yaml` and `specs/echo.yaml`
- **CLI Reference**: Run `npx mcp-server-kit --help`

---

## Troubleshooting

### Tests not found
- Ensure YAML files are in `test/integration/specs/` directory
- File names should match tool names (e.g., `my-tool.yaml` for tool `my-tool`)

### Tests timing out
- Increase timeout in test spec: `timeout: 30000`
- Check if tool is hanging or has infinite loops

### JSON path not working
- Verify response is valid JSON
- Test JSON path with online tools
- Ensure path starts with `$`

### Tool not found
- Verify tool is registered in `src/index.ts`
- Run `npx mcp-server-kit list tools` to see registered tools
- Check tool name matches exactly (case-sensitive)

---

## Next Steps

1. Write integration tests for all your tools
2. Run tests before deployment: `npm run integration:run`
3. Add tests to CI/CD pipeline
4. Aim for 100% tool coverage

Happy testing! 🎯
