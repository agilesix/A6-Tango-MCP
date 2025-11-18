---
name: mcp-server-development
description: Build MCP (Model Context Protocol) servers with tools, prompts, and resources. Use when developing MCP servers, implementing tools/prompts/resources, debugging MCP issues, writing tests, or deploying servers. Covers SDK patterns, validation, and best practices.
allowed-tools: Read, Write, Grep, Glob, RunTerminalCommand
---

# MCP Server Development

Expert guidance for building Model Context Protocol servers.

## Quick Start

### CLI Commands
```bash
# Add components (auto-scaffolds everything)
mcp-server-kit add tool <name> --description "<desc>"
mcp-server-kit add prompt <name> --description "<desc>"
mcp-server-kit add resource <name> --description "<desc>"

# Add Cloudflare bindings (KV, D1, R2, AI)
mcp-server-kit add binding kv --name SESSION_CACHE
mcp-server-kit add binding d1 --name USER_DB --database users
mcp-server-kit add binding r2 --name FILE_STORAGE
mcp-server-kit add binding ai --name AI

# Add authentication (Cloudflare Workers)
mcp-server-kit add-auth <provider>  # stytch, auth0, or workos

# Validate project health
mcp-server-kit validate

# List components
mcp-server-kit list tools
mcp-server-kit list prompts
mcp-server-kit list resources
```

### Automatic Binding Detection

**When you create tools/prompts/resources**, the CLI automatically detects configured Cloudflare bindings and adds usage examples as comments in your generated files.

**Supported Bindings**:
- **KV** - Type-safe helper classes (e.g., `SessionCacheKV`)
- **D1** - Type-safe helper classes (e.g., `UserDbD1`)
- **R2** - Type-safe helper classes (e.g., `FileStorageR2`)
- **AI** - Direct `env.AI` usage (no helper class)

**Example** (generated tool with AI binding):
```typescript
server.tool("search", "Search docs", schema, async (params, { env }) => {
  // Available Cloudflare bindings: AI: AI
  //
  // RAG with LLM:
  // const ragResult = await env.AI.aiSearch('docs-index', 'query text');
  //
  // Vector-only search:
  // const searchResult = await env.AI.search('docs-index', 'query text');

  // Your implementation here
});
```

**See**: [CLOUDFLARE-BINDINGS.md](CLOUDFLARE-BINDINGS.md) for complete binding documentation

### When to Use What

| Need | Use | Example |
|------|-----|---------|
| Execute action | Tool | Fetch data, call API, process files |
| Guide AI behavior | Prompt | Code review template, instructions |
| Expose data | Resource | Config, docs, logs |

## MCP Primitives

### Tools (Actions)
Execute operations and return results.
- **Accept**: Any parameter types (string, number, boolean, objects)
- **Do**: Async operations, API calls, state changes
- **Return**: Structured content with results

**Learn more**: [TOOLS.md](TOOLS.md)

### Prompts (Templates)
Provide instructions that guide AI behavior.
- **Accept**: String parameters ONLY (SDK limitation)
- **Do**: Define conversation context, set behavior
- **Return**: Message arrays

**Learn more**: [PROMPTS.md](PROMPTS.md)

### Resources (Data)
Expose data via URIs.
- **Types**: Static (fixed URIs) or Dynamic (parameterized)
- **Do**: Provide configuration, documentation, database queries
- **Return**: Content with mimeType

**Learn more**: [RESOURCES.md](RESOURCES.md)

## Essential Patterns

### 1. Validation (Required)
Always use Zod schemas:
```typescript
const ParamsSchema = z.object({
  required: z.string().min(1),
  optional: z.number().optional(),
  withDefault: z.boolean().default(false)
});
```

### 2. Error Handling (Critical)
Return errors, don't throw:
```typescript
try {
  const result = await operation();
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
} catch (error) {
  return {
    content: [{ type: "text", text: JSON.stringify({ 
      error: true, 
      message: error.message 
    })}],
    isError: true
  };
}
```

### 3. Response Format (Standard)
```typescript
return {
  content: [{
    type: "text",
    text: JSON.stringify(data, null, 2)
  }]
};
```

## Development Workflow

1. **Scaffold**: Run CLI command to generate files
2. **Implement**: Edit the generated file, add logic
3. **Test**: Run `npm run test:unit`
4. **Validate**: Run `mcp-server-kit validate`
5. **Deploy**: Follow platform guide

## Common Issues

**"Tool not found"** → Check registration in `src/index.ts`
**"Invalid parameters"** → Verify Zod schema matches input
**"Prompt arguments must be strings"** → Use enums or comma-separated values
**"Resource not found"** → Check URI pattern and registration

## Example Files

This project includes working examples:
- `src/tools/_example-*.ts` - Tool patterns
- `src/prompts/_example-*.ts` - Prompt patterns
- `src/resources/_example-*.ts` - Resource patterns

See [EXAMPLES.md](EXAMPLES.md) for detailed walkthroughs.

## Deep Dive Guides

**Implementation:**
- [TOOLS.md](TOOLS.md) - Complete tool development
- [PROMPTS.md](PROMPTS.md) - Prompt engineering for MCP
- [RESOURCES.md](RESOURCES.md) - Resource patterns and URIs
- [CLOUDFLARE-BINDINGS.md](CLOUDFLARE-BINDINGS.md) - KV, D1, R2, AI bindings

**Quality:**
- [TESTING.md](TESTING.md) - Testing strategies
- [VALIDATION.md](VALIDATION.md) - Input validation
- [PATTERNS.md](PATTERNS.md) - Design patterns

**Deployment:**
- [DEPLOYMENT.md](DEPLOYMENT.md) - Platform-specific guides

## Best Practices Checklist

✅ Use Zod for parameter validation
✅ Return errors (don't throw)
✅ Write unit and integration tests
✅ Keep components focused (single responsibility)
✅ Document parameters with `.describe()`
✅ Handle async operations properly
✅ Test before deploying

❌ Don't use non-string types in prompt arguments
❌ Don't skip validation
❌ Don't forget error handling
❌ Don't create overly broad tools

## Getting Help

1. Check example files in this project
2. Read detailed guides (links above)
3. Run `mcp-server-kit validate`
4. Review test output: `npm run test:unit`
5. Check MCP SDK docs: https://modelcontextprotocol.io/

---

**For specific topics, see the linked guides above. Claude loads them only when needed.**
