// src/agents/architect/core/CompleteArchitectOrchestrator.ts
import { ArchitecturalRequest, ArchitectConfig } from “../types/index.js”;
import { ArchitectVoice } from “../communication/ArchitectVoice.js”;
import { CodeAnalyzer } from “../intelligence/CodeAnalyzer.js”;
import { CodeModifier } from “../operations/CodeModifier.js”;
import { IntelligentAgentBuilder } from “../operations/IntelligentAgentBuilder.js”;
import { SystemRefiner } from “../operations/SystemRefiner.js”;
import { EnhancedUniversalAnalyzer } from “./EnhancedUniversalAnalyzer.js”;
import { IntelligentErrorHandler } from “./IntelligentErrorHandler.js”;

export class CompleteArchitectOrchestrator {
private analyzer: EnhancedUniversalAnalyzer;
private voice: ArchitectVoice;
private codeAnalyzer: CodeAnalyzer;
private modifier: CodeModifier;
private builder: IntelligentAgentBuilder;
private refiner: SystemRefiner;
private errorHandler: IntelligentErrorHandler;
private config: ArchitectConfig;

constructor(config: ArchitectConfig) {
this.config = config;
this.analyzer = new EnhancedUniversalAnalyzer(config.claudeApiKey);
this.voice = new ArchitectVoice(config.claudeApiKey);
this.codeAnalyzer = new CodeAnalyzer(config.claudeApiKey);
this.modifier = new CodeModifier(config.claudeApiKey);
this.builder = new IntelligentAgentBuilder(config.claudeApiKey);
this.refiner = new SystemRefiner(config.claudeApiKey);
this.errorHandler = new IntelligentErrorHandler(config.claudeApiKey);
}

async executeArchitecturalWork(input: string, userId: string, context?: any): Promise<string> {
console.log(`[CompleteArchitectOrchestrator] Processing: "${input}"`);

```
try {
  const request = await this.analyzer.analyzeArchitecturalRequest(input, userId, context);
  
  switch (request.type) {
    case "agent-creation":
      return await this.handleAgentCreation(request, input, userId, context);
    case "system-modification":
      return await this.handleSystemModification(request, input, userId, context);
    case "behavior-refinement":
      return await this.handleBehaviorRefinement(request, input, userId, context);
    case "code-analysis":
      return await this.handleCodeAnalysis(request, input, userId, context);
    case "system-status":
      return await this.handleSystemStatus(request, input, userId, context);
    default:
      return await this.handleGenericRequest(request);
  }
} catch (error) {
  console.error(`[CompleteArchitectOrchestrator] Error:`, error);
  return await this.errorHandler.analyzeAndSolve(input, error, {
    userId,
    context,
    requestType: "general"
  });
}
```

}

private async handleAgentCreation(
request: ArchitecturalRequest,
originalInput: string,
userId: string,
context?: any
): Promise<string> {
try {
const buildResult = await this.builder.buildIntelligentAgent(request.description);

```
  if (buildResult.ready) {
    return await this.voice.formatResponse(`✅ Perfect! I've created your intelligent agent.
```

${buildResult.summary}

**Files Generated:** ${buildResult.files.length} TypeScript files
**Status:** Ready to deploy
**Next Steps:** Test it out - your agent should be online shortly!

Want me to set up anything else for it?`, { type: “creation” });
} else {
return await this.errorHandler.analyzeAndSolve(originalInput, new Error(buildResult.error || “Agent creation failed”), {
userId,
context,
requestType: “agent-creation”,
buildResult
});
}
} catch (error) {
return await this.errorHandler.analyzeAndSolve(originalInput, error, {
userId,
context,
requestType: “agent-creation”
});
}
}

private async handleSystemModification(
request: ArchitecturalRequest,
originalInput: string,
userId: string,
context?: any
): Promise<string> {
try {
const plan = await this.modifier.planModification(request.description);

```
  if (plan.requiresApproval) {
    return await this.voice.formatResponse(
      `I can ${plan.description} for you. This will modify ${plan.files.length} files with ${plan.riskLevel} risk.
```

**Changes planned:**
${plan.changes.map(c => `• ${c.description}`).join(’\n’)}

Should I go ahead and make these changes?`,
{ type: “confirmation” }
);
}

```
  const result = await this.modifier.executeModification(plan);
  
  return await this.voice.formatResponse(
    result.committed ? 
      `✅ Done! ${result.summary}\n\nThe changes are live. Anything else you'd like me to adjust?` : 
      `I had trouble with that modification: ${result.summary}\n\nLet me try a different approach - what specifically did you want to change?`,
    { type: result.committed ? "completion" : "clarification" }
  );
  
} catch (error) {
  return await this.errorHandler.analyzeAndSolve(originalInput, error, {
    userId,
    context,
    requestType: "system-modification"
  });
}
```

}

private async handleBehaviorRefinement(
request: ArchitecturalRequest,
originalInput: string,
userId: string,
context?: any
): Promise<string> {
try {
const refinement = await this.refiner.refineBehavior(request.description);
return await this.voice.formatResponse(
`✅ Behavior updated! ${refinement.summary}

The changes should take effect immediately. Try it out and let me know if you want any further adjustments!`,
{ type: “refinement” }
);
} catch (error) {
return await this.errorHandler.analyzeAndSolve(originalInput, error, {
userId,
context,
requestType: “behavior-refinement”
});
}
}

private async handleCodeAnalysis(
request: ArchitecturalRequest,
originalInput: string,
userId: string,
context?: any
): Promise<string> {
try {
const analysis = await this.codeAnalyzer.analyzeCodebase(request.description);

```
  return await this.voice.formatResponse(`🔍 Here's what I found:
```

**Overall Health:** ${analysis.healthScore}%
**Summary:** ${analysis.summary}

${analysis.issues.length > 0 ? `**Issues to address:**\n${analysis.issues.map(i => `• ${i}`).join('\n')}\n` : “”}
${analysis.suggestions.length > 0 ? `**Suggestions:**\n${analysis.suggestions.map(s => `• ${s}`).join('\n')}` : “”}

Want me to fix any of these issues?`, { type: “analysis” });
} catch (error) {
return await this.errorHandler.analyzeAndSolve(originalInput, error, {
userId,
context,
requestType: “code-analysis”
});
}
}

private async handleSystemStatus(
request: ArchitecturalRequest,
originalInput: string,
userId: string,
context?: any
): Promise<string> {
try {
const status = await this.codeAnalyzer.getSystemHealth();

```
  return await this.voice.formatResponse(
    `📊 **System Status:** ${status.summary}
```

${status.issues.length > 0 ? `**Issues found:**\n${status.issues.map(i => `• ${i}`).join('\n')}\n\nShould I fix these?` : “✅ Everything looks good!”}`,
{ type: “status” }
);
} catch (error) {
return await this.errorHandler.analyzeAndSolve(originalInput, error, {
userId,
context,
requestType: “system-status”
});
}
}

private async handleGenericRequest(request: ArchitecturalRequest): Promise<string> {
return await this.voice.formatResponse(
`I want to help with “${request.description}” but I’m not sure what specific action you need.

Could you clarify if you want me to:
• **Build** something new
• **Modify** existing code  
• **Analyze** the current system
• **Fix** a specific issue

What would be most helpful?`,
{ type: “clarification” }
);
}
}