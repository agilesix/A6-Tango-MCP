# Cloudflare Bindings for MCP Servers

Guidance for using Cloudflare primitives (KV, D1, R2, Queues, Workers AI, Vectorize, Hyperdrive) in MCP server development.

---

## Quick Reference

| Primitive | Use Case | When to Use | Configuration |
|-----------|----------|-------------|---------------|
| **KV** | Key-value cache | Fast reads, configuration, sessions | `kv_namespaces` |
| **D1** | SQL database | Structured data, relations, queries | `d1_databases` |
| **R2** | Object storage | Files, media, large objects | `r2_buckets` |
| **Queues** | Message queue | Background jobs, async processing | `queues` |
| **Workers AI** | ML inference | Text generation, embeddings | `ai` |
| **Vectorize** | Vector database | Semantic search, RAG | `vectorize` |
| **Hyperdrive** | DB pooling | External PostgreSQL/MySQL | `hyperdrive` |

---

## Binding Support Status

**Automated Scaffolding Available:**

**Phase 1 - Storage Primitives** (✅ Production-Ready):
- **KV Namespaces** - Type-safe helper classes with `add binding kv`
- **D1 Databases** - Type-safe helper classes with `add binding d1`
- **R2 Buckets** - Type-safe helper classes with `add binding r2`

**Phase 2 - AI/ML Primitives** (✅ Production-Ready):
- **Workers AI** - Direct `env.AI` usage with `add binding ai` (no helper class)

**Manual Setup Required**:
- **Queues**, **Vectorize**, **Hyperdrive** - Not yet automated (follow patterns below)

**Usage**:
```bash
# Add bindings with automated scaffolding
mcp-server-kit add binding kv --name SESSION_CACHE
mcp-server-kit add binding d1 --name USER_DB --database users
mcp-server-kit add binding r2 --name FILE_STORAGE
mcp-server-kit add binding ai --name AI
```

---

## KV Namespaces (Key-Value Storage)

### Use For
- ✅ Caching API responses, computed results
- ✅ Configuration storage (feature flags, settings)
- ✅ Session data, OAuth tokens (with TTL)
- ✅ Rate limiting counters
- ❌ Large values (>25MB limit)
- ❌ Strong consistency required (eventual consistency)

### Configuration

**wrangler.jsonc**:
```jsonc
{
  "kv_namespaces": [
    {
      "binding": "MY_CACHE",
      "id": "<namespace-id>"
    }
  ]
}
```

**Create namespace**:
```bash
npx wrangler kv namespace create MY_CACHE
# Copy the ID into wrangler.jsonc
```

### Code Patterns

**Basic Operations**:
```typescript
// Get (auto-parse JSON)
const data = await env.MY_CACHE.get('key', 'json');

// Set with TTL
await env.MY_CACHE.put('key', JSON.stringify(value), {
  expirationTtl: 3600  // 1 hour
});

// Delete
await env.MY_CACHE.delete('key');

// List with prefix
const list = await env.MY_CACHE.list({ prefix: 'user:' });
```

**MCP Resource Example**:
```typescript
server.resource(
  "app-config",
  "config://app",
  { description: "Application configuration from KV" },
  async (uri) => {
    const config = await env.CONFIG.get('app-config', 'json');

    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(config, null, 2),
        mimeType: "application/json"
      }]
    };
  }
);
```

**MCP Tool Example**:
```typescript
server.tool(
  "cache-get",
  "Retrieve value from cache",
  { key: z.string() },
  async ({ key }) => {
    const value = await env.CACHE.get(key, 'json');

    if (!value) {
      throw new Error(`Key not found: ${key}`);
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify(value, null, 2)
      }]
    };
  }
);
```

---

## D1 Database (SQL Database)

### Use For
- ✅ Structured, relational data
- ✅ User profiles, application data
- ✅ SQL queries, joins, transactions
- ✅ CRUD operations
- ❌ Very large databases (>10GB limit)
- ❌ High write throughput (use KV for counters)

### Configuration

**wrangler.jsonc**:
```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "my-database",
      "database_id": "<database-id>"
    }
  ]
}
```

**Create database**:
```bash
npx wrangler d1 create my-database
# Copy the database_id into wrangler.jsonc
```

**Migrations**:
```bash
# Create migration
npx wrangler d1 migrations create my-database add_users_table

# Apply locally
npx wrangler d1 migrations apply my-database --local

# Apply to production
npx wrangler d1 migrations apply my-database --remote
```

### Code Patterns

**Query with Parameters** (prevents SQL injection):
```typescript
// Single row
const user = await env.DB.prepare(
  'SELECT * FROM users WHERE id = ?'
).bind(userId).first();

// All rows
const users = await env.DB.prepare(
  'SELECT * FROM users WHERE active = ?'
).bind(true).all();

// Insert/Update/Delete
const result = await env.DB.prepare(
  'INSERT INTO users (email, name) VALUES (?, ?)'
).bind(email, name).run();

console.log('Inserted ID:', result.meta.last_row_id);
```

**Batch Operations** (atomic):
```typescript
await env.DB.batch([
  env.DB.prepare('INSERT INTO users (name) VALUES (?)').bind('Alice'),
  env.DB.prepare('INSERT INTO users (name) VALUES (?)').bind('Bob')
]);
```

**MCP Tool Example**:
```typescript
server.tool(
  "user-lookup",
  "Find user by email",
  { email: z.string().email() },
  async ({ email }) => {
    const user = await env.DB.prepare(
      'SELECT id, name, email, created_at FROM users WHERE email = ?'
    ).bind(email).first();

    if (!user) {
      throw new Error(`User not found: ${email}`);
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify(user, null, 2)
      }]
    };
  }
);
```

---

## R2 Storage (Object Storage)

### Use For
- ✅ Large files, documents, media
- ✅ File uploads/downloads
- ✅ Backup storage
- ✅ User-generated content
- ❌ Small values (use KV instead)
- ❌ Frequent small updates (not optimized for this)

### Configuration

**wrangler.jsonc**:
```jsonc
{
  "r2_buckets": [
    {
      "binding": "MY_BUCKET",
      "bucket_name": "my-bucket"
    }
  ]
}
```

**Create bucket**:
```bash
npx wrangler r2 bucket create my-bucket
```

### Code Patterns

**Upload**:
```typescript
await env.BUCKET.put('path/to/file.txt', fileData, {
  httpMetadata: {
    contentType: 'text/plain'
  },
  customMetadata: {
    userId: '123',
    uploadedAt: new Date().toISOString()
  }
});
```

**Download**:
```typescript
const object = await env.BUCKET.get('path/to/file.txt');

if (object === null) {
  throw new Error('File not found');
}

const text = await object.text();
// or: const arrayBuffer = await object.arrayBuffer();
// or: const stream = object.body;
```

**List Files**:
```typescript
const listed = await env.BUCKET.list({
  prefix: 'uploads/',
  limit: 100
});

for (const obj of listed.objects) {
  console.log(obj.key, obj.size, obj.uploaded);
}
```

**MCP Tool Example**:
```typescript
server.tool(
  "upload-file",
  "Upload a file to R2 storage",
  {
    filename: z.string(),
    content: z.string(),  // base64-encoded
    mimeType: z.string().optional()
  },
  async ({ filename, content, mimeType }) => {
    const buffer = Buffer.from(content, 'base64');

    await env.FILES.put(`uploads/${filename}`, buffer, {
      httpMetadata: {
        contentType: mimeType || 'application/octet-stream'
      }
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

---

## Queues (Message Queues)

### Use For
- ✅ Background job processing
- ✅ Async event handling
- ✅ Buffering requests to external APIs
- ✅ Batch processing
- ❌ Real-time responses (use directly instead)
- ❌ Strong ordering guarantees (at-least-once delivery)

### Configuration

**Producer** (wrangler.jsonc):
```jsonc
{
  "queues": {
    "producers": [
      {
        "binding": "MY_QUEUE",
        "queue": "my-queue-name"
      }
    ]
  }
}
```

**Consumer** (wrangler.jsonc):
```jsonc
{
  "queues": {
    "consumers": [
      {
        "queue": "my-queue-name",
        "max_batch_size": 10,
        "max_batch_timeout": 5
      }
    ]
  }
}
```

### Code Patterns

**Producer** (send messages):
```typescript
// Single message
await env.MY_QUEUE.send({
  userId: 123,
  action: 'signup',
  timestamp: Date.now()
});

// Batch
await env.MY_QUEUE.sendBatch([
  { body: { id: 1, type: 'email' } },
  { body: { id: 2, type: 'sms' } }
]);
```

**Consumer** (receive messages):
```typescript
export default {
  async queue(batch: MessageBatch, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      try {
        // Process message
        await processMessage(msg.body);

        // Acknowledge success
        msg.ack();
      } catch (error) {
        console.error('Processing failed:', error);

        // Retry (up to max attempts)
        if (msg.attempts < 3) {
          msg.retry({ delaySeconds: 60 });
        }
      }
    }
  }
};
```

**MCP Tool Example** (producer):
```typescript
server.tool(
  "send-email",
  "Queue an email to be sent",
  {
    to: z.string().email(),
    subject: z.string(),
    body: z.string()
  },
  async ({ to, subject, body }) => {
    await env.EMAIL_QUEUE.send({
      to,
      subject,
      body,
      queuedAt: Date.now()
    });

    return {
      content: [{
        type: "text",
        text: "Email queued for delivery"
      }]
    };
  }
);
```

---

## Workers AI (Machine Learning)

### Use For
- ✅ Text generation (chatbots, content creation)
- ✅ Text embeddings (for RAG, semantic search)
- ✅ Text classification, sentiment analysis
- ✅ **RAG with LLM** - `.aiSearch()` for retrieval + generation
- ✅ **Vector search** - `.search()` for semantic search only
- ❌ Training models (inference only)
- ❌ Very long documents (token limits apply)

### Configuration

**Automated Setup**:
```bash
mcp-server-kit add binding ai --name AI
```

This updates `wrangler.jsonc`:
```jsonc
{
  "ai": {
    "binding": "AI"
  }
}
```

**Note**: AI binding doesn't generate a helper class. Use `env.AI` directly in your tools.

### Code Patterns

**RAG with LLM** (`.aiSearch()` method):
```typescript
// Combines vector search with LLM response
const ragResult = await env.AI.aiSearch('docs-index', 'how to deploy');

// Returns: { response: "To deploy...", context: [...] }
console.log(ragResult.response);  // Generated answer
console.log(ragResult.context);   // Retrieved documents
```

**Vector-Only Search** (`.search()` method):
```typescript
// Returns raw search results without LLM
const searchResults = await env.AI.search('docs-index', 'deployment guide');

// Returns: { matches: [{id, score, metadata}, ...] }
for (const match of searchResults.matches) {
  console.log(match.id, match.score, match.metadata);
}
```

**Note**: Instance names (`'docs-index'`) are runtime parameters created in Cloudflare dashboard, not config entries.

**Text Generation**:
```typescript
const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
  messages: [
    { role: 'system', content: 'You are a helpful assistant' },
    { role: 'user', content: 'What is TypeScript?' }
  ]
});

console.log(response.response);
```

**Text Embeddings**:
```typescript
const embeddings = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
  text: ['Document 1', 'Document 2']
});

// Returns: { data: [[0.1, 0.2, ...], ...], shape: [2, 768] }
const vector1 = embeddings.data[0];  // 768-dimensional vector
```

**Streaming** (for long responses):
```typescript
const stream = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
  prompt: 'Tell me a story',
  stream: true
});

return new Response(stream, {
  headers: { 'Content-Type': 'text/event-stream' }
});
```

**MCP Tool Example**:
```typescript
server.tool(
  "ai-generate",
  "Generate text using AI",
  { prompt: z.string() },
  async ({ prompt }) => {
    const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      prompt
    });

    return {
      content: [{
        type: "text",
        text: result.response
      }]
    };
  }
);
```

---

## Vectorize (Vector Database)

### Use For
- ✅ Semantic search, similarity search
- ✅ RAG (Retrieval Augmented Generation)
- ✅ Recommendation systems
- ✅ Knowledge base search
- ❌ Traditional database queries (use D1 instead)
- ❌ Exact matching (use KV or D1)

### Configuration

**wrangler.jsonc**:
```jsonc
{
  "vectorize": [
    {
      "binding": "VECTOR_INDEX",
      "index_name": "my-embeddings"
    }
  ]
}
```

**Create index**:
```bash
npx wrangler vectorize create my-embeddings --dimensions=768 --metric=cosine
```

### Code Patterns

**Insert Vectors**:
```typescript
await env.VECTOR_INDEX.upsert([
  {
    id: 'doc-1',
    values: embeddings,  // 768-dimensional array
    metadata: {
      title: 'Introduction to AI',
      category: 'tech'
    }
  }
]);
```

**Query Vectors**:
```typescript
const results = await env.VECTOR_INDEX.query(queryVector, {
  topK: 5,
  returnMetadata: 'all',
  filter: { category: 'tech' }
});

for (const match of results.matches) {
  console.log(match.id, match.score, match.metadata);
}
```

---

## RAG Pattern (Workers AI + Vectorize + D1)

**Complete RAG implementation** combining multiple primitives:

### 1. Ingest Documents (Background Job)

```typescript
server.tool(
  "ingest-document",
  "Add document to knowledge base",
  {
    title: z.string(),
    content: z.string()
  },
  async ({ title, content }) => {
    // 1. Store in D1
    const result = await env.DB.prepare(
      'INSERT INTO documents (title, content) VALUES (?, ?)'
    ).bind(title, content).run();

    const docId = result.meta.last_row_id;

    // 2. Generate embedding
    const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
      text: [content]
    });

    // 3. Store vector
    await env.VECTORS.upsert([{
      id: docId.toString(),
      values: embedding.data[0],
      metadata: { title }
    }]);

    return {
      content: [{
        type: "text",
        text: `Document ingested: ${docId}`
      }]
    };
  }
);
```

### 2. Search Knowledge Base

```typescript
server.tool(
  "knowledge-search",
  "Search knowledge base using semantic search",
  { query: z.string() },
  async ({ query }) => {
    // 1. Generate query embedding
    const queryEmbedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
      text: [query]
    });

    // 2. Query vectors (find similar documents)
    const results = await env.VECTORS.query(queryEmbedding.data[0], {
      topK: 5,
      returnMetadata: 'all'
    });

    // 3. Fetch full documents from D1
    const docIds = results.matches.map(m => m.id);
    const docs = await env.DB.prepare(
      `SELECT * FROM documents WHERE id IN (${docIds.map(() => '?').join(',')})`
    ).bind(...docIds).all();

    // 4. Generate answer with context
    const context = docs.results.map(d => d.content).join('\n\n');
    const answer = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: 'Answer the question using only the provided context. If the context does not contain the answer, say so.'
        },
        {
          role: 'user',
          content: `Context:\n${context}\n\nQuestion: ${query}`
        }
      ]
    });

    return {
      content: [{
        type: "text",
        text: answer.response
      }]
    };
  }
);
```

---

## Hyperdrive (Database Connection Pooling)

### Use For
- ✅ Connecting to external PostgreSQL/MySQL
- ✅ Reducing connection overhead
- ✅ Query caching for reads
- ❌ Databases inside Cloudflare (use D1 instead)

### Configuration

**wrangler.jsonc**:
```jsonc
{
  "hyperdrive": [
    {
      "binding": "HYPERDRIVE",
      "id": "<hyperdrive-id>"
    }
  ]
}
```

**Create configuration**:
```bash
npx wrangler hyperdrive create my-postgres \
  --connection-string="postgres://user:pass@host:5432/db"
```

### Code Patterns

```typescript
import { Client } from 'pg';

const client = new Client({
  connectionString: env.HYPERDRIVE.connectionString
});

await client.connect();

const result = await client.query(
  'SELECT * FROM users WHERE id = $1',
  [userId]
);

await client.end();
```

---

## Best Practices

### Choosing the Right Primitive

```
Simple key-value, fast reads     → KV Namespace
Structured data, SQL queries     → D1 Database
Large files, media               → R2 Storage
Background processing            → Queues
AI text generation/embeddings    → Workers AI
Semantic search, RAG             → Vectorize + Workers AI + D1
External PostgreSQL/MySQL        → Hyperdrive
```

### Type Safety

**Always run cf-typegen** after modifying `wrangler.jsonc`:

```bash
npm run cf-typegen
```

This generates `worker-configuration.d.ts` with type-safe binding access:

```typescript
interface Env {
  MY_CACHE: KVNamespace;
  DB: D1Database;
  MY_BUCKET: R2Bucket;
  MY_QUEUE: Queue;
  AI: Ai;
  VECTORS: Vectorize;
  HYPERDRIVE: Hyperdrive;
}
```

### Error Handling

```typescript
// KV - handle null
const value = await env.KV.get('key', 'json');
if (!value) {
  throw new Error('Key not found');
}

// D1 - check success
const result = await env.DB.prepare(sql).bind(...params).run();
if (!result.success) {
  throw new Error('Query failed');
}

// R2 - handle not found
const object = await env.BUCKET.get(key);
if (object === null) {
  throw new Error('Object not found');
}
```

### Performance Tips

- **KV**: Set TTL for cache invalidation, use prefix-based keys
- **D1**: Use prepared statements, batch operations, create indexes
- **R2**: Use streaming for large files, multipart for >100MB
- **Queues**: Batch messages, use explicit ack/retry
- **Workers AI**: Cache embeddings, use streaming for long responses
- **Vectorize**: Batch upsert (up to 1000 vectors), use metadata filtering

---

## Troubleshooting

### Common Issues

**"Binding not found" error**:
- Check binding name matches `wrangler.jsonc`
- Run `npm run cf-typegen` to update types
- Restart dev server: `npm run dev`

**KV writes not visible immediately**:
- KV is eventually consistent (up to 60 seconds)
- Use D1 if you need strong consistency

**D1 query timeout**:
- Add indexes for frequently queried columns
- Limit result set size
- Use batch operations for multiple queries

**R2 large file upload fails**:
- Use multipart upload for files >100MB
- Check object size limit (5TB max)

**Queue messages not processing**:
- Check consumer is configured in `wrangler.jsonc`
- Verify consumer Worker is deployed
- Check batch size/timeout settings

**Workers AI rate limits**:
- Cache embeddings (expensive to regenerate)
- Use lower-cost models when possible
- Monitor neuron usage

**Vectorize query returns no results**:
- Check vector dimensions match index
- Verify vectors were upserted successfully
- Try lower `topK` value

---

## Additional Resources

- **Cloudflare Docs**: https://developers.cloudflare.com/workers/
- **MCP SDK Docs**: https://modelcontextprotocol.io/
- **CLI Commands**: See `.claude/skills/mcp-server-kit-cli/CLI-COMMANDS.md` for complete `add binding` documentation
