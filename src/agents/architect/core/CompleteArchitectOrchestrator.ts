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
        case "behavior-refinement":
          return await this.handleBehaviorRefinement(request);
        case "code-analysis":
          return await this.handleCodeAnalysis(request);
        case "system-status":
          return await this.handleSystemStatus(request);
        default:
          return await this.handleGenericRequest(request);
      }
    } catch (error) {
      console.error(`[CompleteArchitectOrchestrator] Error:`, error);
      return await this.voice.formatResponse(
        `I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. I'm learning from this to improve.`,
        { type: "error" }
      );
    }
  }

  private async handleAgentCreation(request: ArchitecturalRequest): Promise<string> {
    try {
      const buildResult = await this.builder.buildIntelligentAgent(request.description);
      
      if (buildResult.ready) {
        return await this.voice.formatResponse(`Agent created successfully!

${buildResult.summary}

Files: ${buildResult.files.length} generated
Ready: ${buildResult.ready ? "Yes" : "No"}

Your new intelligent agent is ready!`, { type: "creation" });
      } else {
        return await this.voice.formatResponse(
          `Agent creation failed: ${buildResult.error || "Unknown error"}`,
          { type: "error" }
        );
      }
    } catch (error) {
      return await this.voice.formatResponse(
        `Agent creation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        { type: "error" }
      );
    }
  }

  private async handleSystemModification(request: ArchitecturalRequest): Promise<string> {
    try {
      const plan = await this.modifier.planModification(request.description);
      const result = await this.modifier.executeModification(plan);
      
      return await this.voice.formatResponse(
        result.committed ? 
          `Modification complete: ${result.summary}` : 
          `Modification failed: ${result.summary}`,
        { type: result.committed ? "completion" : "error" }
      );
    } catch (error) {
      return await this.voice.formatResponse(
        `System modification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        { type: "error" }
      );
    }
  }

  private async handleBehaviorRefinement(request: ArchitecturalRequest): Promise<string> {
    try {
      const refinement = await this.refiner.refineBehavior(request.description);
      return await this.voice.formatResponse(
        `Behavior refinement: ${refinement.summary}`,
        { type: "refinement" }
      );
    } catch (error) {
      return await this.voice.formatResponse(
        `Behavior refinement failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        { type: "error" }
      );
    }
  }

  private async handleCodeAnalysis(request: ArchitecturalRequest): Promise<string> {
    try {
      const analysis = await this.codeAnalyzer.analyzeCodebase(request.description);
      
      return await this.voice.formatResponse(`Code Analysis Complete

Summary: ${analysis.summary}
Health Score: ${analysis.healthScore}%
Issues: ${analysis.issues.length > 0 ? analysis.issues.join(", ") : "None"}
Suggestions: ${analysis.suggestions.join(", ")}`, { type: "analysis" });
    } catch (error) {
      return await this.voice.formatResponse(
        `Code analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        { type: "error" }
      );
    }
  }

  private async handleSystemStatus(request: ArchitecturalRequest): Promise<string> {
    try {
      const status = await this.codeAnalyzer.getSystemHealth();
      
      return await this.voice.formatResponse(
        `System Status: ${status.summary}. ${status.issues.length > 0 ? "Issues: " + status.issues.join(", ") : "All systems operational."}`,
        { type: "status" }
      );
    } catch (error) {
      return await this.voice.formatResponse(
        `System status check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        { type: "error" }
      );
    }
  }

  private async handleGenericRequest(request: ArchitecturalRequest): Promise<string> {
    return await this.voice.formatResponse(
      `I understand you want: "${request.description}". I'm working on understanding this request type better.`,
      { type: "processing" }
    );
  }
}