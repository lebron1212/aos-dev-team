// src/agents/architect/core/IntelligentErrorHandler.ts
import Anthropic from ‘@anthropic-ai/sdk’;

interface ErrorAnalysis {
intent: string;
solution: string;
implementation: string;
confidence: number;
}

export class IntelligentErrorHandler {
private claude: Anthropic;

constructor(claudeApiKey: string) {
this.claude = new Anthropic({ apiKey: claudeApiKey });
}

async analyzeAndSolve(
originalRequest: string,
error: any,
context?: any
): Promise<string> {
const errorMessage = error instanceof Error ? error.message : String(error);

```
console.log(`[IntelligentErrorHandler] Analyzing error: ${errorMessage}`);

try {
  const analysis = await this.analyzeError(originalRequest, errorMessage, context);
  return this.formatIntelligentResponse(analysis, originalRequest);
} catch (analysisError) {
  console.error('[IntelligentErrorHandler] Analysis failed:', analysisError);
  return this.getFallbackResponse(originalRequest, errorMessage);
}
```

}

private async analyzeError(
request: string,
error: string,
context?: any
): Promise<ErrorAnalysis> {

```
const response = await this.claude.messages.create({
  model: 'claude-3-sonnet-20240229',
  max_tokens: 1000,
  system: `You are an intelligent architect that analyzes errors and provides helpful solutions. When you encounter an error, you:
```

1. Understand what the user was trying to do
1. Identify the real issue behind the error
1. Provide a clear, actionable solution
1. Offer to implement the fix

Be conversational and helpful, like a skilled developer mentor.`, messages: [{ role: 'user', content: `The user requested: “${request}”

But encountered this error: “${error}”

Context: ${JSON.stringify(context || {})}

Analyze what went wrong and provide:

1. What the user actually wanted to do
1. A clear solution to fix this
1. Specific implementation steps
1. Your confidence level (0-100)

Return JSON format:
{
“intent”: “What the user actually wanted”,
“solution”: “Clear explanation of how to fix this”,
“implementation”: “Specific steps to implement the fix”,
“confidence”: 85
}`
}]
});

```
const content = response.content[0];
if (content.type === 'text') {
  try {
    return JSON.parse(content.text);
  } catch (parseError) {
    return this.extractFromText(content.text, request, error);
  }
}

return this.createFallbackAnalysis(request, error);
```

}

private formatIntelligentResponse(analysis: ErrorAnalysis, originalRequest: string): string {
if (analysis.confidence > 70) {
return `I see what happened! ${analysis.solution}

**What you wanted:** ${analysis.intent}

**The fix:** ${analysis.implementation}

Should I go ahead and implement this solution for you?`; } else { return `I encountered an issue with “${originalRequest}”. ${analysis.solution}

${analysis.implementation}

Would you like me to try this approach, or would you prefer to clarify what you’re looking for?`;
}
}

private extractFromText(text: string, request: string, error: string): ErrorAnalysis {
// Basic extraction if JSON parsing fails
return {
intent: `Trying to: ${request}`,
solution: “Let me help you fix this issue”,
implementation: “I’ll analyze your request and provide a working solution”,
confidence: 60
};
}

private createFallbackAnalysis(request: string, error: string): ErrorAnalysis {
// Smart fallback based on common error patterns
if (error.includes(“Unknown change type ‘add’”)) {
return {
intent: “Add/create something new in the system”,
solution: “The system uses ‘create’ instead of ‘add’ for new items”,
implementation: “I’ll convert your ‘add’ request to ‘create’ and proceed”,
confidence: 90
};
}

```
if (error.includes("not a function")) {
  return {
    intent: request,
    solution: "There's a missing method in the codebase",
    implementation: "I'll implement the missing functionality or use an alternative approach",
    confidence: 80
  };
}

if (error.includes("Cannot find module")) {
  return {
    intent: request,
    solution: "Missing file or incorrect import path",
    implementation: "I'll create the missing file or fix the import path",
    confidence: 85
  };
}

return {
  intent: request,
  solution: "Let me analyze this error and find a solution",
  implementation: "I'll investigate the issue and provide a working fix",
  confidence: 50
};
```

}

private getFallbackResponse(request: string, error: string): string {
return `I encountered an issue with “${request}”: ${error}

Let me analyze this and find a solution. What specifically were you trying to accomplish?`;
}
}

// Enhanced CompleteArchitectOrchestrator with intelligent error handling
// Add this to src/agents/architect/core/CompleteArchitectOrchestrator.ts

import { IntelligentErrorHandler } from ‘./IntelligentErrorHandler.js’;

// In the constructor, add:
// private errorHandler: IntelligentErrorHandler;
// this.errorHandler = new IntelligentErrorHandler(config.claudeApiKey);

// Replace the catch blocks with:
/*
} catch (error) {
console.error(`[CompleteArchitectOrchestrator] Error:`, error);
return await this.errorHandler.analyzeAndSolve(input, error, {
userId,
context,
requestType: ‘agent-creation’ // or whatever the type is
});
}
*/