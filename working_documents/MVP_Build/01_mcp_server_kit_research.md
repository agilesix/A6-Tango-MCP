# MCP Server Kit Research - Cloudflare Remote Template

## Overview

**mcp-server-kit** is an extensible scaffolding tool and test harness for Model Context Protocol (MCP) servers. It creates production-ready MCP server projects with built-in testing infrastructure, supporting multiple deployment targets through a template system.

**Key Value Proposition**: Automates boilerplate setup while allowing developers to focus on implementing tool logic. Specifically optimized for AI agent development.

## Core Capabilities

### 1. Quick Scaffolding
- Generates complete MCP server projects with a single command
- Includes TypeScript, testing, linting, and deployment configuration
- Auto-generates example tools showing best practices

### 2. Built-in Testing Infrastructure
- Integrated test harness with declarative YAML test specifications
- Unit testing with Vitest
- Integration testing with test runner
- Test utilities and assertions included

### 3. Template System
- Plugin architecture supporting multiple MCP frameworks
- Currently available: `cloudflare-remote` (Cloudflare Workers)
- Coming: `vercel-edge`, `node-stdio`

### 4. Development Tools (AI Agent Optimized)
- Add tools/prompts/resources via CLI
- Auto-scaffolds files with registration and imports
- Validation to catch common mistakes
- List/discover entities in project
- Cloudflare binding scaffolding (KV, D1, R2, Workers AI)
- Authentication provider scaffolding (Stytch, Auth0, WorkOS)

### 5. JSON Mode
- Machine-readable output with NDJSON progress reporting
- All commands support `--json` flag for automation
- Programmatic API for custom tooling

## Cloudflare Remote Template

### What It Provides

The `cloudflare-remote` template scaffolds an MCP server designed to run as a Cloudflare Worker with SSE (Server-Sent Events) transport.

**Generated Project Includes**:
- Complete MCP server implementation with example tools
- Unit test infrastructure (Vitest)
- Integration test setup with YAML specs
- TypeScript strict mode configuration
- Code quality tools (Biome for formatting/linting)
- Cloudflare Workers deployment configuration
- Development scripts and documentation
- Optional utility libraries and helpers
- README with "For AI Agents" section

### Server Endpoint
- Default development URL: `http://localhost:8788/sse`
- Health check endpoint: `http://localhost:8788/health`

### Cloudflare-Specific Features

**Cloudflare Bindings Support**:
- **KV (Key-Value)**: Session storage, caching
- **D1 (Database)**: SQLite-compatible database
- **R2 (Object Storage)**: File storage
- **Workers AI**: AI model inference

Bindings are scaffolded with:
- Type-safe helper code
- Configuration in `wrangler.toml`
- Example usage in generated tools

## Project Structure

```
my-mcp-server/
├── src/
│   ├── index.ts              # Server entry point
│   ├── tools/                # MCP tools
│   │   └── example.ts        # Example tool implementation
│   ├── prompts/              # MCP prompts (if added)
│   ├── resources/            # MCP resources (if added)
│   └── utils/                # Optional utility libraries
│
├── test/
│   ├── unit/                 # Unit tests
│   │   └── tools/            # Tool unit tests
│   └── integration/
│       └── specs/            # YAML test specifications
│
├── wrangler.toml             # Cloudflare Workers configuration
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── biome.json                # Code quality configuration
└── README.md                 # Project documentation
```

## Scaffolding Process

### Installation
```bash
npm install -g mcp-server-kit
```

### Create New Project
```bash
mcp-server-kit new server \
  --name my-mcp-server \
  --template cloudflare-remote \
  --description "My awesome MCP server"
```

**Process**:
1. Validates configuration
2. Creates project directory
3. Generates files from template
4. Installs dependencies (npm/pnpm/yarn)
5. Outputs next steps

**Flags**:
- `--output <path>`: Custom output directory
- `--json`: Machine-readable output
- `--dev`: Use local mcp-server-kit paths (for testing)
- `--no-install`: Skip dependency installation

### Add Components

**Tools** (API integrations, data fetching):
```bash
mcp-server-kit add tool weather --description "Get weather data"
```

**Prompts** (reusable prompt templates):
```bash
mcp-server-kit add prompt code-reviewer --description "Review code quality"
```

**Resources** (expose data/configs):
```bash
# Dynamic resource
mcp-server-kit add resource snippet --description "Code snippet by ID"

# Static resource
mcp-server-kit add resource config --static --description "App configuration"
```

**Cloudflare Bindings**:
```bash
# KV store
mcp-server-kit add binding kv --name SESSION_CACHE

# D1 database
mcp-server-kit add binding d1 --name USER_DB --database users

# R2 storage
mcp-server-kit add binding r2 --name FILE_STORAGE

# Workers AI
mcp-server-kit add binding ai --name AI
```

**Authentication**:
```bash
mcp-server-kit add-auth stytch  # or auth0, workos
```

**Auto-scaffolding Features**:
- Creates source files with TODO markers
- Auto-registers in main index
- Manages imports automatically
- Generates unit test stubs
- Creates integration test YAML specs
- Adds binding helper code and types

## Dependencies and Configuration

### Core Dependencies (Cloudflare Template)
- **@modelcontextprotocol/sdk**: MCP protocol implementation
- **@cloudflare/workers-types**: TypeScript types for Workers
- **wrangler**: Cloudflare Workers CLI/dev server

### Development Dependencies
- **typescript**: Type safety
- **vitest**: Unit testing
- **@biomejs/biome**: Code formatting and linting
- **mcp-server-kit**: Test harness and utilities

### Configuration Files

**wrangler.toml**:
```toml
name = "my-mcp-server"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[observability]
enabled = true

# Bindings added here when using 'add binding' command
```

**package.json scripts**:
- `npm run dev`: Start development server (wrangler)
- `npm run deploy`: Deploy to Cloudflare
- `npm run test:unit`: Run unit tests
- `npm run integration:run`: Run integration tests
- `npm run check`: Type checking
- `npm run format`: Code formatting
- `npm run lint`: Code linting

## Development Workflow

### 1. Scaffold Project
```bash
mcp-server-kit new server --name my-server --template cloudflare-remote
cd my-server
```

### 2. Add Components
```bash
# Add tools, prompts, resources as needed
mcp-server-kit add tool <name> --description "<desc>"
```

### 3. Implement Logic
- Edit generated files (look for TODO markers)
- Implement tool logic, prompt templates, resource handlers
- Use provided example code as reference

### 4. Validate
```bash
# Catch common mistakes (missed registrations, missing tests)
mcp-server-kit validate

# Auto-fix issues
mcp-server-kit validate --fix
```

### 5. Test
```bash
# Unit tests
npm run test:unit

# Integration tests (declarative YAML)
npm run integration:run

# Manual testing via development server
npm run dev
curl http://localhost:8788/health
```

### 6. Deploy
```bash
npm run deploy
```

## Testing Approach

### Unit Tests
- Framework: Vitest
- Location: `test/unit/`
- Auto-generated stubs when adding components
- Test individual tool/prompt/resource logic

### Integration Tests
- Declarative YAML specifications
- Location: `test/integration/specs/`
- Framework-agnostic test harness

**Example YAML Test**:
```yaml
name: "Test echo tool"
tool: "echo"
arguments:
  message: "Hello, MCP!"

assertions:
  - type: "success"
  - type: "response_time_ms"
    max: 3000
  - type: "contains_text"
    text: "Hello, MCP!"
```

**Assertion Types**:
- `success`: Tool executed without errors
- `response_time_ms`: Performance threshold
- `contains_text`: Response content validation
- More available (see test harness docs)

## Deployment Process (Cloudflare)

### Prerequisites
1. Cloudflare account
2. Wrangler CLI configured (`wrangler login`)

### Development Deployment
```bash
npm run dev
# Server runs at http://localhost:8788/sse
```

### Production Deployment
```bash
npm run deploy
```

**What Happens**:
1. TypeScript compilation
2. Bundling for Workers runtime
3. Upload to Cloudflare
4. Configuration of bindings (KV, D1, R2, AI)
5. Returns deployment URL

### Wrangler Configuration
- Project name and routes in `wrangler.toml`
- Bindings (KV namespaces, D1 databases, R2 buckets) configured per environment
- Secrets managed via `wrangler secret put <NAME>`

### Environment Variables
```bash
# Set secrets (not in wrangler.toml)
wrangler secret put API_KEY
wrangler secret put DATABASE_URL
```

## Programmatic API (Advanced)

All CLI functionality available as programmatic API:

```typescript
// Entity scaffolding
import { EntityScaffolder } from 'mcp-server-kit/scaffolding';

// Validation
import { validateProject } from 'mcp-server-kit/validation';

// Template system
import { TemplateProcessor, TemplateRegistry } from 'mcp-server-kit';

// Test harness
import { TestRunner, loadTestSpec } from 'mcp-server-kit/harness';

// Progress reporting (NDJSON)
import { ProgressReporter } from 'mcp-server-kit/reporting';

// Error handling
import { CLIError, ValidationError, RuntimeError } from 'mcp-server-kit/errors';
```

**Use Cases**:
- Custom CI/CD integrations
- IDE plugins
- Custom project generators
- Automated testing pipelines

## Limitations and Considerations

### Template-Specific

**Cloudflare Workers Constraints**:
- No Node.js standard library (Workers runtime)
- Limited file system access
- Cold start latency considerations
- Request duration limits (CPU time)
- Memory limits per request

### Project Structure

**Auto-Registration**:
- CLI handles registration automatically
- Manual edits to index.ts can break auto-registration
- Use `mcp-server-kit validate` to catch issues

**Testing**:
- Integration tests require running server
- YAML specs are declarative but limited in complexity
- Unit tests give more control for complex scenarios

### Development

**Validation**:
- `validate` command catches common mistakes
- Checks: registration, test coverage, imports
- `--strict` mode enforces best practices
- `--fix` attempts automatic repairs

**Example Code**:
- Generated examples are comprehensive but generic
- May need significant customization for production use
- TODO markers indicate required implementation

### Deployment

**Cloudflare-Specific**:
- Bindings must be pre-provisioned in Cloudflare dashboard
- Wrangler configuration must match dashboard setup
- Secrets managed separately (not in code)
- Preview deployments vs production deployments

**Cost Considerations**:
- Cloudflare Workers: Free tier + paid tiers
- KV, D1, R2, AI have separate pricing
- Monitor usage to avoid unexpected costs

### Documentation

**Learning Curve**:
- MCP protocol knowledge required
- Cloudflare Workers familiarity helpful
- Test harness concepts (assertions, YAML specs)

**Agent Optimization**:
- Toolkit assumes AI agent usage patterns
- Human developers may prefer different workflows
- Documentation skews toward agent instructions

## Key Takeaways for Implementation

1. **Start Simple**: Use `new server` command, implement one tool first
2. **Use CLI Tools**: `add tool/prompt/resource` handles boilerplate
3. **Validate Early**: Run `validate` frequently to catch issues
4. **Test Incrementally**: Write tests as you add features
5. **Reference Examples**: Generated example code shows patterns
6. **Cloudflare Bindings**: Scaffold bindings even if not immediately used
7. **JSON Mode**: Use `--json` flag for automation/scripting
8. **Programmatic API**: Available for advanced custom tooling

## Additional Resources

- [MCP Specification](https://modelcontextprotocol.io/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- Template-specific docs in generated `README.md`
- CLI Guide: `.claude/skills/mcp-server-kit-cli/SKILL.md` (in mcp-server-kit repo)
- Test Harness API: `src/harness/README.md` (in generated project)

---

**Document Version**: 1.0
**Date**: 2025-11-18
**Source**: npm package `mcp-server-kit` README
