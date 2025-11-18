# mcp-server-kit

[![npm version](https://img.shields.io/npm/v/mcp-server-kit.svg)](https://www.npmjs.com/package/mcp-server-kit)
[![npm downloads](https://img.shields.io/npm/dm/mcp-server-kit.svg)](https://www.npmjs.com/package/mcp-server-kit)

## For Human Users 👤

**Using with Claude Code (Recommended)**: Start from a Claude Code terminal for the best experience with seamless project creation.

### Quick Start

1. **Start Claude Code in your terminal**
2. **Paste this prompt**:

```
I want you to scaffold a new MCP server project using the mcp-server-kit CLI. Follow these steps EXACTLY:

1. Install the CLI globally:
   npm install -g mcp-server-kit

2. Read the documentation: After installation, run this command to see the full README:
   npm view mcp-server-kit readme

   Read it carefully to understand all capabilities before proceeding.

3. Use the CLI to scaffold the project:
   mcp-server-kit new server --template cloudflare-remote --name <PROJECT_NAME>

   Note: Replace <PROJECT_NAME> with your desired name (e.g., my-weather-server, slack-bot, github-integration)

4. After scaffolding completes, show me:
   - The generated project structure
   - The next steps from the CLI output

IMPORTANT: The mcp-server-kit CLI handles everything automatically - directory creation, file generation, and dependency installation. Do NOT create directories or files manually. Your job is to run the commands and explain what was created.
```

3. **Claude Code will**:
   - Install mcp-server-kit globally
   - Read the package documentation
   - Create your project directory
   - Scaffold the project
   - Install dependencies
   - Explain next steps

### Why Claude Code?

- **Integrated terminal** - Runs commands directly
- **Context aware** - Understands full project structure
- **Auto error handling** - Fixes issues automatically

**Works with other AI agents too**, but Claude Code provides the smoothest experience with built-in terminal integration.

---

**Extensible scaffolding tool and test harness for Model Context Protocol (MCP) servers**

Create production-ready MCP servers in seconds with built-in testing infrastructure. Supports multiple deployment targets (Cloudflare Workers, Vercel Edge, Node.js) through an extensible template system.

## Features

- 🚀 **Quick Scaffolding** - Generate complete MCP server projects with one command
- 🧪 **Built-in Testing** - Integrated test harness with declarative YAML test specs
- 🔌 **Extensible Templates** - Plugin architecture for multiple MCP frameworks
- 📦 **Production Ready** - Includes TypeScript, testing, linting, and deployment config
- 🤖 **Agent-Optimized** - Built specifically for AI agents with auto-scaffolding, examples, and validation
- 🛠️ **Development Tools** - Add tools/prompts/resources, validate projects, list components, all from CLI
- ☁️ **Cloudflare Bindings** - Scaffold KV, D1, R2, and Workers AI bindings with type-safe helpers
- 🔐 **Authentication Support** - Add auth scaffolding with provider-specific code (Stytch, Auth0, WorkOS)
- 📚 **Rich Examples** - Comprehensive example tools and utilities showing best practices
- 🤖 **JSON Mode** - Machine-readable output with NDJSON progress reporting for automation

## For AI Agents 🤖

**This toolkit is specifically optimized for AI agent development.** It automates the mechanical tasks agents forget (file creation, registration, imports) while preserving flexibility for creative problem-solving.

**Claude Code Users**: See [For Human Users](#for-human-users-) for a streamlined setup experience.

### Agent Workflow

1. **Scaffold** - Let the CLI handle boilerplate
2. **Implement** - Focus on tool logic (the creative part)
3. **Validate** - Catch issues automatically
4. **Test** - Use provided test utilities

```bash
# 1. Create project
mcp-server-kit new server --template cloudflare-remote --name my-server

# 2. Add tools, prompts, and resources (auto-scaffolds everything)
cd my-server
mcp-server-kit add tool weather --description "Get weather data"
mcp-server-kit add prompt code-reviewer --description "Review code quality"
mcp-server-kit add resource snippet --description "Code snippet by ID"
mcp-server-kit add resource config --static --description "App configuration"

# 3. (Optional) Add Cloudflare bindings
mcp-server-kit add binding kv --name SESSION_CACHE
mcp-server-kit add binding d1 --name USER_DB --database users
mcp-server-kit add binding r2 --name FILE_STORAGE
mcp-server-kit add binding ai --name AI

# 4. (Optional) Add authentication
mcp-server-kit add-auth stytch  # or auth0, workos

# 5. Implement (TODO markers show what to code)
# Edit src/tools/weather.ts, src/prompts/code-reviewer.ts, etc.
# Binding examples appear automatically in generated tools

# 6. Validate (catches missed registrations, tests, etc.)
mcp-server-kit validate

# 7. Test
npm run test:unit
npm run integration:run
```

**What agents get:**
- Example tools showing all patterns
- Optional utility helpers
- Auto-registration (no manual import management)
- Validation catching common mistakes
- Comprehensive inline documentation

---

## Quick Start

### Installation

```bash
npm install -g mcp-server-kit
```

### Create Your First MCP Server

```bash
# Scaffold a new Cloudflare Workers MCP server
mcp-server-kit new server \
  --name my-mcp-server \
  --template cloudflare-remote \
  --description "My awesome MCP server"

# Navigate to the project
cd my-mcp-server

# Start development server
npm run dev

# Server runs at http://localhost:8788/sse
```

**Testing mcp-server-kit itself?** Use the `--dev` flag to use local mcp-server-kit paths:
```bash
mcp-server-kit new server --name test-project --dev
```

**Scaffolding at git repository root?** Navigate there first:
```bash
cd $(git rev-parse --show-toplevel)
mcp-server-kit new server --name my-server
```

### Verify It Works

```bash
# Check health endpoint
curl http://localhost:8788/health

# Run unit tests
npm run test:unit

# Run integration tests
npm run integration:run

# Validate project structure
mcp-server-kit validate
```

## What's Included in a Scaffolded Project

Every scaffolded project includes:

- ✅ **MCP Server** - Complete server implementation with example tools
- ✅ **Unit Tests** - Test infrastructure with Vitest and test utilities
- ✅ **Integration Tests** - Declarative YAML test specs using the test harness
- ✅ **TypeScript** - Strict mode configuration with proper types
- ✅ **Code Quality** - Biome for formatting and linting
- ✅ **Deployment** - Ready to deploy (Cloudflare, Vercel, etc.)
- ✅ **Documentation** - README with "For AI Agents" section
- ✅ **Example Tools** - Comprehensive example files
- ✅ **Utility Libraries** - Optional helpers
- ✅ **Development Scripts** - npm shortcuts for common tasks

## Architecture

```
mcp-server-kit/
├── src/
│   ├── harness/              # Portable test harness (framework-agnostic)
│   │   ├── types/            # TypeScript interfaces
│   │   ├── assertions/       # Test assertion implementations
│   │   ├── reporters/        # Output formatters
│   │   ├── validation/       # Zod schemas
│   │   └── runner.ts         # Test execution engine
│   │
│   └── core/
│       ├── cli/              # CLI commands
│       ├── commands/         # Command implementations
│       └── template-system/  # Extensible template system
│
└── templates/                # Template plugins
    ├── cloudflare-remote/    # Cloudflare Workers template
    ├── vercel-edge/          # (Coming soon)
    └── node-stdio/           # (Coming soon)
```

## Key Design Principles

### 1. **Template-Driven Extensibility**

Each MCP framework is a self-contained template plugin. Adding support for a new framework requires only creating a new template directory—no core code changes.

### 2. **Framework-Agnostic Test Harness**

The test harness uses dependency injection (`IMCPTestClient` interface) to remain portable across different MCP implementations.

### 3. **Declarative Testing**

Write tests in simple YAML files instead of code:

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

## Documentation

**For AI Agents:**
- **[CLI Guide](./.claude/skills/mcp-server-kit-cli/SKILL.md)** - Quick reference with decision trees
- **[CLI Commands](./.claude/skills/mcp-server-kit-cli/CLI-COMMANDS.md)** - Complete command documentation
- **[Testing Guide](./.claude/skills/mcp-server-kit-cli/TESTING.md)** - Testing the toolkit

**For MCP Development** (in generated projects):
- **[Test Harness API](./src/harness/README.md)** - Detailed test harness documentation

## CLI Commands

Quick reference (see [CLI Guide](./.claude/skills/mcp-server-kit-cli/SKILL.md) for details):

```bash
# Project creation
mcp-server-kit new server --name <name> --template <template> [--output <path>] [--json]

# Development commands (for AI agents)
mcp-server-kit add tool <name> --description "<desc>" [--json]
mcp-server-kit add prompt <name> --description "<desc>" [--json]
mcp-server-kit add resource <name> --description "<desc>" [--static] [--json]
mcp-server-kit add binding <type> --name <BINDING_NAME> [--database <name>] [--json]
mcp-server-kit add-auth <provider> [--platform cloudflare] [--json]
mcp-server-kit validate [--strict] [--fix] [--json]
mcp-server-kit list tools [--json]
mcp-server-kit list prompts [--json]
mcp-server-kit list resources [--json]

# Template management
mcp-server-kit template list
mcp-server-kit template info <template-id>
mcp-server-kit template validate <template-id>
```

### JSON Output

All commands support `--json` flag for programmatic use:

```bash
# Get parseable JSON output
mcp-server-kit add tool weather --description "Weather API" --json
# Output: {"success": true, "entityType": "tool", "entityName": "weather", ...}

# Pipe to jq for processing
mcp-server-kit validate --json | jq '.summary'
# Output: {"errors": 0, "warnings": 2, "info": 1}

# Use in scripts
RESULT=$(mcp-server-kit new server --name test --json)
echo $RESULT | jq '.path'
# Output: "/path/to/test"
```

## Programmatic API Usage

While mcp-server-kit provides a CLI for interactive use, **all core functionality is also available as a programmatic API** for building custom tooling, CI/CD integrations, and advanced workflows.

### Available API Modules

```typescript
// Scaffolding API - Create entities programmatically
import { EntityScaffolder } from 'mcp-server-kit/scaffolding';

// Validation API - Validate projects programmatically
import { validateProject } from 'mcp-server-kit/validation';

// Template System API - Scaffold entire projects
import { TemplateProcessor, TemplateRegistry } from 'mcp-server-kit';

// Test Harness API - Run integration tests
import { TestRunner, loadTestSpec } from 'mcp-server-kit/harness';

// Progress Reporter API - Track operation progress
import { ProgressReporter } from 'mcp-server-kit/reporting';

// Error Handling API - Structured error management
import { CLIError, ValidationError, RuntimeError } from 'mcp-server-kit/errors';
```

### Scaffolding API

Create tools, prompts, and resources programmatically:

```typescript
import { EntityScaffolder } from 'mcp-server-kit/scaffolding';

const scaffolder = new EntityScaffolder();

// Create a tool
const result = await scaffolder.scaffold(process.cwd(), {
  entityType: 'tool',
  name: 'weather-api',
  description: 'Get weather data',
  generateTests: true,
  autoRegister: true,
});

console.log(`Created: ${result.filesCreated.join(', ')}`);
console.log(`Registered: ${result.registered}`);
// No console output from scaffolder - you control output!
```

**Use Cases**:
- Custom project generators
- IDE plugins for code generation
- Automated entity scaffolding in CI/CD

### Validation API

Validate MCP server projects programmatically:

```typescript
import { validateProject } from 'mcp-server-kit/validation';

const result = await validateProject(process.cwd(), { strict: true });

if (!result.passed) {
  for (const issue of result.issues) {
    if (issue.severity === 'error') {
      console.error(`❌ ${issue.message}`);
      if (issue.file) console.error(`   File: ${issue.file}`);
      if (issue.suggestion) console.error(`   Fix: ${issue.suggestion}`);
    }
  }
  process.exit(1);
}

console.log(`✅ Valid! (${result.summary.errors} errors, ${result.summary.warnings} warnings)`);
```

**Use Cases**:
- Custom CI/CD validation
- Pre-commit hooks
- IDE validation on save
- Project health dashboards

### Template System API

Scaffold complete projects programmatically:

```typescript
import { TemplateProcessor, TemplateRegistry } from 'mcp-server-kit';

const registry = new TemplateRegistry();
const processor = new TemplateProcessor(registry);

const result = await processor.scaffold({
  template: 'cloudflare-remote',
  targetDir: './my-project',
  variables: {
    PROJECT_NAME: 'my-server',
    MCP_SERVER_NAME: 'My MCP Server',
    PORT: '8788',
  },
  noInstall: false,
  packageManager: 'npm',
});

if (result.success) {
  console.log(`✅ Project created at: ${result.targetDir}`);
}
```

**Use Cases**:
- Custom project templates
- Multi-project generators
- Template testing automation

### Entity Discovery API

List and discover entities in a project:

```typescript
import { EntityLister } from 'mcp-server-kit/scaffolding';

const lister = new EntityLister({
  entityType: 'tool',
  entityTypePlural: 'tools',
  sourceDir: 'src/tools',
  registrationPattern: /register(\w+)Tool/g,
  unitTestDir: 'test/unit/tools',
  integrationTestDir: 'test/integration/specs',
  descriptionPattern: /\/\*\*[\s\S]*?\*\s*([^\n]+)/,
});

const entities = await lister.discoverEntities(process.cwd(), false);

for (const entity of entities) {
  console.log(`${entity.name}: registered=${entity.registered}, tested=${entity.hasUnitTest}`);
}
```

**Use Cases**:
- Custom status reporting
- IDE entity browser
- Documentation generation

### Test Harness API

Run integration tests programmatically:

```typescript
import { TestRunner, loadTestSpec } from 'mcp-server-kit/harness';
import { MyMCPClient } from './my-client';

// Create client adapter
const client = new MyMCPClient();
const runner = new TestRunner(client);

// Connect
await runner.connect();

// Load and run tests
const spec = await loadTestSpec('./test.yaml');
const result = await runner.runTest(spec);

console.log(`Test: ${result.name}`);
console.log(`Status: ${result.passed ? 'PASS' : 'FAIL'}`);
console.log(`Duration: ${result.duration}ms`);

// Cleanup
await runner.disconnect();
```

**Use Cases**:
- Custom test runners
- CI/CD integration
- Performance testing
- Monitoring and alerts

### Progress Reporter API

Track operation progress with machine-readable events:

```typescript
import { ProgressReporter } from 'mcp-server-kit/reporting';

const reporter = new ProgressReporter({
  format: 'json', // or 'text'
  output: process.stdout,
});

// Start operation
reporter.start('Creating MCP server', [
  'validating-configuration',
  'creating-files',
  'installing-dependencies',
]);

// Update step status
reporter.stepInProgress('validating-configuration');
reporter.stepCompleted('validating-configuration', 150);

reporter.stepInProgress('creating-files');
reporter.stepCompleted('creating-files', 300);

// Complete operation
reporter.complete(true, {
  projectName: 'my-server',
  path: '/path/to/my-server',
});
```

**Output (NDJSON)**:
```json
{"type":"start","operation":"Creating MCP server","steps":[...],"timestamp":"..."}
{"type":"step","step":"validating-configuration","status":"in_progress","timestamp":"..."}
{"type":"step","step":"validating-configuration","status":"completed","duration":150,"timestamp":"..."}
{"type":"complete","success":true,"duration":450,"result":{...},"timestamp":"..."}
```

**Use Cases**:
- CI/CD progress tracking
- Real-time operation monitoring
- Custom progress UI
- Automation workflows

### Error Handling API

Handle errors with structured, typed error classes:

```typescript
import { ValidationError, RuntimeError, CLIError } from 'mcp-server-kit/errors';

// Validation errors (exit code 1)
throw new ValidationError(
  'Invalid tool name',
  {
    field: 'name',
    provided: 'MyTool',
    expected: 'lowercase-with-hyphens',
  },
  'Use "my-tool" instead',
);

// Runtime errors (exit code 2)
throw new RuntimeError(
  'npm install failed',
  { command: 'npm install', exitCode: 1 },
  'Check your package.json for syntax errors',
);

// Catch and handle
try {
  await scaffolder.scaffold(options);
} catch (error) {
  if (error instanceof CLIError) {
    console.error(`Error: ${error.message}`);
    if (error.suggestion) console.error(`Suggestion: ${error.suggestion}`);
    process.exit(error.exitCode);
  }
  throw error;
}
```

**Error Types**:
- `ValidationError` - Input validation failures (exit code 1)
- `RuntimeError` - Execution failures (exit code 2)
- `FileSystemError` - File/directory errors (exit code 3)
- `CLIError` - Base class for all CLI errors

**Use Cases**:
- Consistent error handling
- Machine-readable error output
- CI/CD error parsing
- User-friendly error messages

### TypeScript Type Safety

All APIs are fully typed:

```typescript
import type {
  ScaffoldResult,
  ValidationResult,
  EntityInfo,
  TestResult,
  ProgressEvent,
  ErrorDetails,
} from 'mcp-server-kit/scaffolding';
```

**Benefits**:
- IntelliSense in VS Code
- Compile-time type checking
- Self-documenting APIs

### Package Exports

```json
{
  "imports": {
    "mcp-server-kit": "Main exports (template system, utils, services)",
    "mcp-server-kit/harness": "Test harness (portable)",
    "mcp-server-kit/scaffolding": "Entity scaffolding services",
    "mcp-server-kit/validation": "Project validation",
    "mcp-server-kit/reporting": "Progress reporting (NDJSON)",
    "mcp-server-kit/errors": "Structured error classes",
    "mcp-server-kit/commands": "CLI commands (Commander.js)"
  }
}
```

## Development

### Building from Source

```bash
git clone https://github.com/mikec-ai/mcp-server-kit.git
cd mcp-server-kit
npm install
npm run build
```

### Project Structure

- **`src/harness/`** - Portable test harness (zero dependencies on core)
- **`src/core/`** - CLI and template system
- **`templates/`** - Template plugins
- **`test/`** - Unit and integration tests
- **`.claude/skills/`** - Agent guidance and documentation

### Running Tests

```bash
# Unit tests (fast)
npm run test:unit

# E2E template tests (slow)
npm run test:e2e

# Type checking
npm run type-check
```

## Contributing

We welcome contributions! Areas we'd love help with:

- **New Templates** - Add support for Vercel, Deno, etc.
- **Test Harness Features** - New assertion types, reporters
- **Documentation** - Guides, examples, tutorials
- **Bug Fixes** - See [issues](https://github.com/mikec-ai/mcp-server-kit/issues)

## License

MIT

## Resources

- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [CLI Guide](./.claude/skills/mcp-server-kit-cli/SKILL.md)
- [CLI Commands](./.claude/skills/mcp-server-kit-cli/CLI-COMMANDS.md)
- [Testing Guide](./.claude/skills/mcp-server-kit-cli/TESTING.md)

---

**Built for Agents, by Agents** 🤖
