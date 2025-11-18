# tango-mcp

MCP server powered by Cloudflare Workers

## Quick Start

### Prerequisites
- Node.js 18+ (LTS recommended)
- npm 9+

### Development

```bash
# Start development server
npm run dev
```

Server runs at `http://localhost:8788/sse`

### Health Check

```bash
curl http://localhost:8788/health
```

Expected: `{"status":"ok","service":"tango-mcp","version":"1.0.0"}`

## Development Scripts

### Quick Commands (for AI Agents)
```bash
# Scaffold a new tool
npm run tools:add my_tool -- --description "Tool description"

# Add authentication
mcp-server-kit add-auth <provider>  # stytch, auth0, or workos

# List all tools
npm run tools:list

# Validate project
npm run validate

# Run quality checks (type-check + lint + unit tests)
npm run check

# Pre-commit checks (format + check + validate)
npm run precommit
```

### Testing
```bash
# Run all tests
npm run test:all

# Run unit tests only
npm run test:unit

# Run integration tests (requires dev server running)
npm run test:integration

# Generate coverage report
npm run test:coverage

# Watch mode (re-run on changes)
npm run test:watch
```

## Deployment

```bash
# Deploy to Cloudflare Workers
npm run deploy
```

## Tools

This MCP server provides the following tools:

- **`health`** - Returns server health status
- **`echo`** - Echoes back the provided message (useful for testing)

## Project Structure

```
tango-mcp/
├── src/
│   ├── index.ts              # MCP server entry point
│   └── tools/                # Tool implementations
│       ├── health.ts
│       └── echo.ts
├── test/
│   ├── unit/                 # Unit tests
│   └── integration/          # Integration tests
│       ├── adapters/         # MCP client adapters
│       ├── specs/            # Test specifications (YAML)
│       └── cli.ts            # Integration test CLI
├── wrangler.jsonc            # Cloudflare Workers config
├── tsconfig.json             # TypeScript configuration
└── package.json              # Dependencies and scripts
```

## Adding New Tools

### Using mcp-server-kit CLI (Recommended for AI Agents)

```bash
# Auto-scaffold a new tool with tests
mcp-server-kit add tool weather --description "Get weather information"

# This automatically:
# - Creates src/tools/weather.ts with TODO markers
# - Generates test/unit/tools/weather.test.ts
# - Generates test/integration/specs/weather.yaml
# - Registers tool in src/index.ts
# - Updates .mcp-template.json metadata
```

### Manual Process

1. Create a new file in `src/tools/`
2. Implement the tool using the MCP SDK
3. Register the tool in `src/index.ts`
4. Add unit tests in `test/unit/`
5. Add integration test spec in `test/integration/specs/`

### Validation

```bash
# Check project structure and configuration
mcp-server-kit validate

# This checks:
# - All tools are registered in index.ts
# - Test files exist for all tools
# - Integration test YAMLs are valid
# - Metadata is in sync
```

---

## For AI Agents 🤖

**This project is optimized for AI agent development.** Use the patterns and utilities below to build tools efficiently.

### Quick Reference

**Example Tools** (in `src/tools/`):
- `_example-simple.ts` - Basic tool pattern
- `_example-validated.ts` - Complex Zod validation
- `_example-async.ts` - Async operations & error handling

**Optional Utilities** (in `src/utils/`):
- `mcp-helpers.ts` - Response formatting helpers
- `validation.ts` - Reusable Zod schemas

**Test Utilities** (in `test/utils/`):
- `test-utils.ts` - Testing helpers for Vitest

### Tool Development Workflow

1. **Scaffold** (automates the forgettable):
   ```bash
   mcp-server-kit add tool my_tool --description "Tool description"
   ```

2. **Implement** (focus on logic):
   - Define Zod schema for parameters
   - Implement tool handler
   - Use utilities if helpful (optional)

3. **Test** (validate correctness):
   ```bash
   npm run test:unit         # Fast unit tests
   npm run test:integration  # End-to-end tests
   ```

4. **Validate** (catch issues):
   ```bash
   mcp-server-kit validate
   ```

### Common Patterns

#### Simple Tool (No Validation)
```typescript
export function registerMyTool(server: McpServer): void {
  server.tool("my_tool", "Description", {}, async () => {
    return {
      content: [{ type: "text", text: "result" }],
    };
  });
}
```

#### Tool with Parameters
```typescript
const MyParamsSchema = z.object({
  input: z.string().describe("Input parameter"),
  limit: z.number().int().positive().default(10).describe("Max results"),
});

export function registerMyTool(server: McpServer): void {
  server.tool("my_tool", "Description", MyParamsSchema.shape, async ({ input, limit }) => {
    // Implementation
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  });
}
```

#### Error Handling
```typescript
async (params) => {
  try {
    const result = await someAsyncOperation(params);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  } catch (error) {
    // Return error, don't throw
    return {
      content: [{ type: "text", text: JSON.stringify({ error: true, message: ... }) }],
      isError: true,
    };
  }
}
```

### Testing Patterns

```typescript
import { describe, it, expect } from "vitest";
import { createMockServer, expectToolSuccess, parseToolResponse } from "../../utils/test-utils.js";
import { registerMyTool } from "../../../src/tools/my-tool.js";

describe("My Tool", () => {
  it("should handle valid input", async () => {
    const server = createMockServer();
    registerMyTool(server);

    const response = await expectToolSuccess(server, "my_tool", { input: "test" });
    const data = parseToolResponse(response);

    expect(data).toEqual({ result: "test" });
  });
});
```

### Validation Helpers

Use reusable schemas from `src/utils/validation.ts`:

```typescript
import { urlSchema, paginationParams, dateRangeParams } from "../utils/validation.js";

const MyParamsSchema = z.object({
  url: urlSchema.describe("API endpoint"),
  ...paginationParams(50, 10),
  ...dateRangeParams(),
});
```

### Response Helpers

Optional helpers from `src/utils/mcp-helpers.ts`:

```typescript
import { createToolResponse, createErrorResponse } from "../utils/mcp-helpers.js";

// Simple response
return createToolResponse({ status: "ok" });

// Error response
return createErrorResponse(error, "Operation failed");
```

### Best Practices for Agents

✅ **DO**:
- Use `mcp-server-kit add tool` for scaffolding
- Implement tool logic (the creative part)
- Write unit tests using test utilities
- Run `mcp-server-kit validate` before committing
- Check `_example-*.ts` files when stuck

❌ **DON'T**:
- Manually create/register tool files (use CLI)
- Forget error handling in async operations
- Throw errors in tool handlers (return error responses)
- Skip validation of user inputs (use Zod)
- Forget to update tests when changing tools

---

## Documentation

- [MCP SDK Documentation](https://modelcontextprotocol.io/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)

## License

MIT
