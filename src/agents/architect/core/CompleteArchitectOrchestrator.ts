// src/agents/architect/core/CompleteArchitectOrchestrator.ts
import { ArchitecturalRequest, ArchitectConfig } from "../types/index.js";
import { ArchitectVoice } from "../communication/ArchitectVoice.js";
import { CodeAnalyzer } from "../intelligence/CodeAnalyzer.js";
import { CodeModifier } from "../operations/CodeModifier.js";
import { IntelligentAgentBuilder } from "../operations/IntelligentAgentBuilder.js";
import { SystemRefiner } from "../operations/SystemRefiner.js";
import { EnhancedUniversalAnalyzer } from "./EnhancedUniversalAnalyzer.js";

export class CompleteArchitectOrchestrator {
  private analyzer: EnhancedUniversalAnalyzer;
  private voice: ArchitectVoice;
  private codeAnalyzer: CodeAnalyzer;
  private modifier: CodeModifier;
  private builder: IntelligentAgentBuilder;
  private refiner: SystemRefiner;
  private config: ArchitectConfig;

  constructor(config: ArchitectConfig) {
    this.config = config;
    this.analyzer = new EnhancedUniversalAnalyzer(config.claudeApiKey);
    this.voice = new ArchitectVoice(config.claudeApiKey);
    this.codeAnalyzer = new CodeAnalyzer(config.claudeApiKey);
    this.modifier = new CodeModifier(config.claudeApiKey);
    this.builder = new IntelligentAgentBuilder(config.claudeApiKey);
    this.refiner = new SystemRefiner(config.claudeApiKey);
  }

  async executeArchitecturalWork(input: string, userId: string, context?: any): Promise<string> {
    console.log(`[CompleteArchitectOrchestrator] Processing: "${input}"`);
    
    try {
      const request = await this.analyzer.analyzeArchitecturalRequest(input, userId, context);
      
      switch (request.type) {
        case "agent-creation":
          return await this.handleAgentCreation(request);
        case "system-modification":
          return await this.handleSystemModification(request);
        default:
          return await this.handleGenericRequest(request);
      }
    } catch (error) {
      console.error(`[CompleteArchitectOrchestrator] Error:`, error);
      return await this.handleIntelligentError(input, error);
    }
  }

  private async handleAgentCreation(request: ArchitecturalRequest): Promise<string> {
    try {
      const buildResult = await this.builder.buildIntelligentAgent(request.description);
      
      if (buildResult.ready) {
        return `Perfect! I've created your intelligent agent.

${buildResult.summary}

Files Generated: ${buildResult.files.length} TypeScript files
Status: Ready to deploy

Your agent should be online shortly!`;
      } else {
        return this.handleIntelligentError(request.description, new Error(buildResult.error || "Agent creation failed"));
      }
    } catch (error) {
      return this.handleIntelligentError(request.description, error);
    }
  }

  private async handleSystemModification(request: ArchitecturalRequest): Promise<string> {
    try {
      const plan = await this.modifier.planModification(request.description);
      const result = await this.modifier.executeModification(plan);
      
      return result.committed ? 
        `Done! ${result.summary}` : 
        `Had trouble with that: ${result.summary}. What specifically did you want to change?`;
    } catch (error) {
      return this.handleIntelligentError(request.description, error);
    }
  }

  private async handleIntelligentError(request: string, error: any): Promise<string> {
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    if (errorMsg.includes("Unknown change type 'add'")) {
      return `I see what happened! The system uses 'create' instead of 'add'.

What you wanted: Create something new
The fix: I'll convert your request to use 'create'

Should I go ahead and implement this?`;
    }
    
    if (errorMsg.includes("not a function")) {
      return `I found a missing method. Let me implement the functionality you need.

What you wanted: ${request}
The fix: I'll add the missing code

Want me to proceed?`;
    }
    
    return `I encountered an issue with "${request}": ${errorMsg}

Let me analyze this and find a solution. What specifically were you trying to do?`;
  }

  private async handleGenericRequest(request: ArchitecturalRequest): Promise<string> {
    return `I want to help with "${request.description}" but need clarification.

Could you specify if you want me to:
• Build something new
• Modify existing code  
• Analyze the system
• Fix an issue

What would be most helpful?`;
  }
}