# Prompts - Complete Development Guide

Prompts provide instructions that guide AI behavior through structured messages.

## Key Limitation

**Prompt arguments must be strings only** (SDK limitation)

For boolean-like options, use:
- Enums: `z.enum(["yes", "no"])`
- Comma-separated strings: `"option1,option2,option3"`

## Prompt Anatomy

```typescript
server.prompt(
  "prompt-name",
  "Description",
  ArgsSchema.shape,
  async (args) => {
    return {
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Your prompt template here`
        }
      }]
    };
  }
);
```

## Argument Schema (Strings Only!)

```typescript
const ArgsSchema = z.object({
  // String (required)
  topic: z.string().describe("Topic to explain"),
  
  // String (optional)
  language: z.string().optional().describe("Programming language"),
  
  // Enum (for limited options)
  style: z.enum(["quick", "thorough", "detailed"]).optional(),
  
  // NOT ALLOWED:
  // includeExamples: z.boolean() // ❌ Wrong!
  
  // USE INSTEAD:
  includeExamples: z.enum(["yes", "no"]).optional() // ✅ Correct
});
```

## Message Structures

### Single User Message
```typescript
return {
  messages: [{
    role: "user" as const,
    content: {
      type: "text" as const,
      text: `You are an expert in ${topic}. Provide guidance on...`
    }
  }]
};
```

### Multi-Turn Conversation
```typescript
return {
  messages: [
    {
      role: "user" as const,
      content: {
        type: "text" as const,
        text: "I need help with code review"
      }
    },
    {
      role: "assistant" as const,
      content: {
        type: "text" as const,
        text: "I'd be happy to review your code. Here's my approach..."
      }
    }
  ]
};
```

## Prompt Engineering Patterns

### 1. Role Assignment
```typescript
text: `You are a senior ${language} developer who specializes in ${domain}.

Your expertise includes:
- Best practices and design patterns
- Performance optimization
- Security considerations

When reviewing code, you...`
```

### 2. Task Definition
```typescript
text: `Your task is to analyze the provided code and:

1. Identify potential bugs or errors
2. Suggest performance improvements
3. Check for security vulnerabilities
4. Recommend better patterns

Focus on ${priority} issues first.`
```

### 3. Output Format
```typescript
text: `Provide your response in this format:

**Overall Assessment**: [Good/Needs Improvement/Critical Issues]

**Issues Found**:
- 🔴 Critical: [description]
- 🟡 Moderate: [description]
- 🔵 Minor: [description]

**Recommendations**:
1. [specific suggestion]
2. [specific suggestion]

**Next Steps**: [actionable items]`
```

### 4. Few-Shot Examples
```typescript
text: `Generate a commit message for the provided changes.

Example 1:
Input: Added error handling to API calls
Output: feat: Add error handling for API requests

Example 2:
Input: Fixed bug where users couldn't login
Output: fix: Resolve login authentication issue

Now generate a commit message for these changes: ...`
```

### 5. Context-Aware Prompts
```typescript
async (args) => {
  const styleInstructions = {
    quick: "Provide brief, actionable feedback in bullet points.",
    thorough: "Provide comprehensive analysis with detailed explanations.",
    detailed: "Provide in-depth analysis with examples and alternatives."
  };
  
  const style = args.style || "thorough";
  
  return {
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: `Review the code with a ${style} approach.

${styleInstructions[style]}

Additional context: ${args.context || "None provided"}`
      }
    }]
  };
}
```

## Testing Prompts

```typescript
describe("code-reviewer prompt", () => {
  it("should generate proper message structure", async () => {
    const server = new McpServer({ name: "test", version: "1.0.0" });
    registerCodeReviewerPrompt(server);
    
    // Test prompt returns correct structure
    // Note: Actual testing depends on your test harness
  });
  
  it("should handle optional parameters", async () => {
    // Test with and without optional args
  });
  
  it("should adapt to different styles", async () => {
    // Test different style values
  });
});
```

## Common Patterns

### Code Review Prompt
```typescript
return {
  messages: [{
    role: "user" as const,
    content: {
      type: "text" as const,
      text: `You are a senior software engineer performing a code review.

**Review Focus**: ${focus}
**Language**: ${language}

**Evaluation Criteria**:
1. Code correctness and logic
2. Performance and efficiency
3. Security concerns
4. Maintainability
5. Best practices

**Output Format**:
- List specific issues with line references
- Suggest concrete improvements
- Explain the reasoning
- Prioritize by severity

Be constructive and educational.`
    }
  }]
};
```

### Documentation Generator
```typescript
return {
  messages: [{
    role: "user" as const,
    content: {
      type: "text" as const,
      text: `Generate documentation for the provided code.

**Format**: ${format}
**Detail Level**: ${detail}

Include:
- Purpose and overview
- Parameters and return values
- Usage examples
- Edge cases and limitations

Use clear, concise language suitable for ${audience}.`
    }
  }]
};
```

### Test Generator
```typescript
return {
  messages: [{
    role: "user" as const,
    content: {
      type: "text" as const,
        text: `Generate comprehensive unit tests for the provided function.

**Testing Framework**: ${framework}
**Coverage**: ${coverage}

Generate tests for:
1. Happy path scenarios
2. Edge cases
3. Error conditions
4. Boundary values

Follow ${style} naming conventions.`
    }
  }]
};
```

## Best Practices

✅ **Be Specific**: Include exact instructions and format requirements
✅ **Use Examples**: Show desired output format
✅ **Set Context**: Define role, expertise level, audience
✅ **Structure Output**: Request specific sections or format
✅ **Handle Variability**: Use conditional logic for different scenarios

❌ **Don't Be Vague**: "Help with code" is too generic
❌ **Don't Overcomplicate**: Keep prompts focused
❌ **Don't Forget Constraints**: Specify limitations
❌ **Don't Use Non-String Args**: SDK limitation!

## Example: Complete Code Review Prompt

See example file: `examples/prompt-code-review.ts`

