# Examples - Working Code Samples

This directory contains complete, working examples of MCP components.

## Example Files in This Project

### Tools
- `src/tools/_example-simple.ts` - Basic tool pattern
- `src/tools/_example-validated.ts` - Complex Zod validation
- `src/tools/_example-async.ts` - Async operations and error handling

### Prompts
- `src/prompts/_example-simple.ts` - Basic prompts and message structures
- `src/prompts/_example-advanced.ts` - Advanced prompt engineering patterns

### Resources
- `src/resources/_example-static.ts` - Static resources (config, docs)
- `src/resources/_example-dynamic.ts` - Dynamic resources with URI templates

## Quick Examples

### Simple Tool
```typescript
server.tool("echo", "Echo back a message", {
  message: z.string().describe("Message to echo")
}, async ({ message }) => {
  return {
    content: [{
      type: "text",
      text: JSON.stringify({ echo: message })
    }]
  };
});
```

### Simple Prompt
```typescript
server.prompt("helper", "Get coding help", {
  language: z.string().optional()
}, async ({ language }) => {
  return {
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: `You are a ${language || 'programming'} expert. Help the user...`
      }
    }]
  };
});
```

### Simple Resource
```typescript
server.resource("status", "status://server", {
  mimeType: "application/json"
}, async (uri) => {
  return {
    contents: [{
      uri: uri.href,
      text: JSON.stringify({ status: "ok", uptime: process.uptime() }),
      mimeType: "application/json"
    }]
  };
});
```

## How to Use Examples

1. **Read the example file** to understand the pattern
2. **Copy relevant parts** to your implementation
3. **Adapt to your needs** - change names, parameters, logic
4. **Test thoroughly** - ensure it works in your context

## Example Projects

Check the complete example server in this project to see:
- How components are organized
- How registration works
- How tests are structured
- How validation is implemented

Run the server to see it in action:
```bash
npm run dev
```

Then test the tools:
```bash
# In another terminal
npm run test:integration
```

