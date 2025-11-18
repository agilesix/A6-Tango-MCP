
# Tools - Complete Development Guide

Tools execute operations and return results. This is the most commonly used MCP primitive.

## Tool Anatomy

```typescript
server.tool(
  "tool-name",              // Name (kebab-case)
  "Description of tool",    // Description (what it does)
  ParamsSchema.shape,       // Zod schema shape
  async (params) => {       // Handler function
    // Implementation
    return { content: [...] };
  }
);
```

## Parameter Validation

### Basic Schema
```typescript
const ParamsSchema = z.object({
  // Required string
  location: z.string().min(1).describe("City name"),
  
  // Optional number
  limit: z.number().int().positive().optional().describe("Max results"),
  
  // Enum
  units: z.enum(["celsius", "fahrenheit"]).default("celsius"),
  
  // Boolean
  includeDetails: z.boolean().default(false),
  
  // Array
  tags: z.array(z.string()).describe("Filter tags"),
  
  // Nested object
  filters: z.object({
    minPrice: z.number().optional(),
    maxPrice: z.number().optional()
  }).optional()
});
```

### Advanced Validation
```typescript
// Custom validation
const RangeSchema = z.object({
  start: z.number(),
  end: z.number()
}).refine(
  (data) => data.end > data.start,
  { message: "End must be greater than start" }
);

// Conditional fields
const ConfigSchema = z.object({
  mode: z.enum(["simple", "advanced"]),
  advancedOptions: z.object({
    // only required when mode is "advanced"
  }).optional()
});
```

## Error Handling

### Standard Pattern
```typescript
server.tool("my-tool", "Description", schema, async (params) => {
  try {
    // Validate business rules
    if (params.value < 0) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: true,
            message: "Value must be positive",
            code: "INVALID_VALUE"
          })
        }],
        isError: true
      };
    }
    
    // Perform operation
    const result = await operation(params);
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
    
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: true,
          message: error instanceof Error ? error.message : String(error),
          code: "OPERATION_FAILED"
        })
      }],
      isError: true
    };
  }
});
```

## Async Operations

### API Calls
```typescript
async (params) => {
  try {
    // Set timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
    };
  } catch (error) {
    // Handle error...
  }
}
```

### Database Queries
```typescript
async (params) => {
  try {
    const results = await db.query(
      "SELECT * FROM users WHERE name = $1",
      [params.name]
    );
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          count: results.length,
          data: results
        }, null, 2)
      }]
    };
  } catch (error) {
    // Handle error...
  }
}
```

## Response Formatting

### JSON Response (Standard)
```typescript
return {
  content: [{
    type: "text",
    text: JSON.stringify({
      success: true,
      data: results,
      metadata: {
        count: results.length,
        timestamp: new Date().toISOString()
      }
    }, null, 2)
  }]
};
```

### Multiple Content Blocks
```typescript
return {
  content: [
    {
      type: "text",
      text: "Summary: Found 10 results"
    },
    {
      type: "text",
      text: JSON.stringify(results, null, 2)
    }
  ]
};
```

## Using Cloudflare Bindings in Tools

### Automatic Binding Detection

When you run `mcp-server-kit add tool`, the CLI automatically detects configured Cloudflare bindings and adds usage examples as comments in your tool file.

**Supported Bindings**:
- **KV Namespaces** - Type-safe helper classes
- **D1 Databases** - Type-safe helper classes
- **R2 Buckets** - Type-safe helper classes
- **Workers AI** - Direct `env.AI` usage (no helper class)

### Adding Bindings

```bash
# Add bindings before creating tools
mcp-server-kit add binding kv --name SESSION_CACHE
mcp-server-kit add binding d1 --name USER_DB --database users
mcp-server-kit add binding r2 --name FILE_STORAGE
mcp-server-kit add binding ai --name AI

# Now create tools - binding examples appear automatically
mcp-server-kit add tool user-manager
```

### KV Namespace Example

```typescript
import { SessionCacheKV } from "./utils/bindings/kv-session-cache.js";

server.tool(
  "cache-user",
  "Cache user data",
  { userId: z.string(), data: z.object({}) },
  async ({ userId, data }, { env }) => {
    const cache = new SessionCacheKV(env.SESSION_CACHE);

    await cache.set(`user:${userId}`, data, {
      expirationTtl: 3600  // 1 hour
    });

    return {
      content: [{
        type: "text",
        text: `User ${userId} cached successfully`
      }]
    };
  }
);
```

### D1 Database Example

```typescript
import { UserDbD1 } from "./utils/bindings/d1-user-db.js";

server.tool(
  "find-users",
  "Find users by criteria",
  { active: z.boolean().optional() },
  async ({ active }, { env }) => {
    const db = new UserDbD1(env.USER_DB);

    const users = await db.query(
      "SELECT * FROM users WHERE active = ?",
      [active ?? true]
    );

    return {
      content: [{
        type: "text",
        text: JSON.stringify(users, null, 2)
      }]
    };
  }
);
```

### R2 Bucket Example

```typescript
import { FileStorageR2 } from "./utils/bindings/r2-file-storage.js";

server.tool(
  "upload-file",
  "Upload file to storage",
  { filename: z.string(), content: z.string() },  // base64
  async ({ filename, content }, { env }) => {
    const storage = new FileStorageR2(env.FILE_STORAGE);

    const buffer = Buffer.from(content, 'base64');
    await storage.put(`uploads/${filename}`, buffer, {
      httpMetadata: { contentType: 'application/octet-stream' }
    });

    return {
      content: [{
        type: "text",
        text: `File uploaded: ${filename} (${buffer.length} bytes)`
      }]
    };
  }
);
```

### Workers AI Example

**No helper class** - use `env.AI` directly:

```typescript
server.tool(
  "semantic-search",
  "Search using AI-powered semantic search",
  { query: z.string() },
  async ({ query }, { env }) => {
    // RAG with LLM (vector search + generated answer)
    const ragResult = await env.AI.aiSearch('docs-index', query);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          answer: ragResult.response,
          sources: ragResult.context
        }, null, 2)
      }]
    };
  }
);
```

**Vector-only search**:

```typescript
server.tool(
  "vector-search",
  "Search using vector similarity only",
  { query: z.string() },
  async ({ query }, { env }) => {
    // Raw search results without LLM
    const searchResults = await env.AI.search('docs-index', query);

    return {
      content: [{
        type: "text",
        text: JSON.stringify(searchResults.matches, null, 2)
      }]
    };
  }
);
```

### Env Parameter

All tools receive an optional `{ env }` second parameter:

```typescript
server.tool(
  "my-tool",
  "Description",
  ParamsSchema.shape,
  async (params, { env }) => {
    // Access bindings via env
    if (env?.SESSION_CACHE) {
      const cache = new SessionCacheKV(env.SESSION_CACHE);
      // ...
    }
  }
);
```

**Note**: `env` is optional during testing (unit tests don't provide it).

### Complete Binding Documentation

See `CLOUDFLARE-BINDINGS.md` for:
- Complete binding patterns
- Configuration examples
- Best practices
- Error handling

---

## Testing Tools

### Unit Test Pattern
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMyTool } from "../../../src/tools/my-tool.js";

describe("my-tool", () => {
  let server: McpServer;

  beforeEach(() => {
    server = new McpServer({
      name: "test-server",
      version: "1.0.0"
    });
    registerMyTool(server);
  });

  it("should handle valid parameters", async () => {
    // Test implementation
  });

  it("should validate parameters", async () => {
    // Test validation
  });

  it("should handle errors gracefully", async () => {
    // Test error handling
  });
});
```

## Performance Tips

1. **Cache expensive operations**
```typescript
const cache = new Map();

async (params) => {
  const key = JSON.stringify(params);
  if (cache.has(key)) {
    return cache.get(key);
  }
  
  const result = await expensiveOperation(params);
  cache.set(key, result);
  return result;
}
```

2. **Batch operations when possible**
```typescript
// Bad: Multiple separate calls
for (const item of items) {
  await processItem(item);
}

// Good: Batch processing
await processBatch(items);
```

3. **Use streaming for large responses** (when supported)

## Common Anti-Patterns

❌ **Throwing errors**
```typescript
async (params) => {
  throw new Error("Something failed"); // Wrong!
}
```

✅ **Returning errors**
```typescript
async (params) => {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: true, ... }) }],
    isError: true
  };
}
```

❌ **No validation**
```typescript
async (params) => {
  // Using params without validation
  const result = await api.call(params.url); // Dangerous!
}
```

✅ **Proper validation**
```typescript
const ParamsSchema = z.object({
  url: z.string().url()
});
```

❌ **Overly broad tools**
```typescript
server.tool("do-everything", ...); // Too generic!
```

✅ **Focused tools**
```typescript
server.tool("fetch-weather", ...);
server.tool("search-locations", ...);
```

## Security Considerations

1. **Validate all inputs** - Use Zod schemas
2. **Sanitize user data** - Escape special characters
3. **Limit resource access** - Check permissions
4. **Don't expose secrets** - Keep credentials secure
5. **Rate limit expensive operations** - Prevent abuse

## Example: Complete Weather Tool

See example file: `examples/tool-weather.ts`

This file shows a complete, production-ready tool implementation with:
- Proper validation
- Error handling
- Async operations
- Response formatting
- Type safety
- Documentation

