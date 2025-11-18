# A6 Tango MCP

**MCP server providing AI agents with access to federal procurement and grants data**

This repository contains the Tango MCP server - a Model Context Protocol (MCP) implementation that connects AI agents to federal contracting data from multiple government sources (FPDS, SAM.gov, USASpending, Grants.gov) through the unified Tango API.

## Project Structure

```
A6-Tango-MCP/
├── tango-mcp/          # Main MCP server codebase
│   ├── src/            # TypeScript source code
│   ├── test/           # Unit and integration tests
│   ├── README.md       # Complete documentation
│   └── package.json    # NPM dependencies and scripts
└── working_documents/  # Local development notes (gitignored)
```

## Quick Start

All development happens in the `tango-mcp/` directory. See **[tango-mcp/README.md](./tango-mcp/README.md)** for:

- Installation and setup
- Tool documentation
- Deployment guides
- API usage examples
- Development workflow

## Features

- **10 MCP Tools** - Search contracts, grants, opportunities, vendor profiles, and agency analytics
- **Cloudflare Workers** - Serverless deployment with global edge network
- **KV Caching** - Intelligent caching with 5-minute TTL
- **Per-User API Keys** - Support for individual Tango API keys via headers
- **Type Safety** - Full TypeScript with Zod validation
- **Comprehensive Testing** - Unit tests and end-to-end YAML integration tests

## Technology Stack

- **Runtime**: Cloudflare Workers (serverless)
- **Language**: TypeScript
- **API Client**: Custom Tango API wrapper
- **Caching**: Cloudflare KV
- **Testing**: Vitest + mcp-server-kit integration tests
- **MCP Framework**: @modelcontextprotocol/sdk

## Links

- **Main Documentation**: [tango-mcp/README.md](./tango-mcp/README.md)
- **Deployment Guide**: [tango-mcp/DEPLOYMENT.md](./tango-mcp/DEPLOYMENT.md)
- **Tango API**: https://www.tango.gov
- **MCP Specification**: https://modelcontextprotocol.io

## License

See [tango-mcp/](./tango-mcp/) directory for license information.

---

**Built by Agile Six Applications**
