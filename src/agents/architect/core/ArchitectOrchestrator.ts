import { ArchitecturalRequest, ArchitectConfig } from '../types/index.js';
import { CodeAnalyzer } from '../intelligence/CodeAnalyzer.js';
import { CodeModifier } from '../operations/CodeModifier.js';
import { AgentBuilder } from '../operations/AgentBuilder.js';
import { SystemRefiner } from '../operations/SystemRefiner.js';
import { ArchitectVoice } from '../communication/ArchitectVoice.js';

export class ArchitectOrchestrator {
  private codeAnalyzer: CodeAnalyzer;
  private modifier: CodeModifier;
  private builder: AgentBuilder;
  private refiner: SystemRefiner;
  private voice: ArchitectVoice;

  constructor(config: ArchitectConfig) {
    this.codeAnalyzer = new CodeAnalyzer(config.claudeApiKey);
    this.modifier = new CodeModifier(config.claudeApiKey);
    this.builder = new AgentBuilder(config.claudeApiKey);
    this.refiner = new SystemRefiner(config.claudeApiKey);
    this.voice = new ArchitectVoice(config.claudeApiKey);
  }

  async executeArchitecturalWork(request: ArchitecturalRequest): Promise<string> {
    
    console.log(`[ArchitectOrchestrator] Executing: ${request.type} - ${request.description}`);
    
    switch (request.type) {
      case 'analyze-code':
        return await this.handleCodeAnalysis(request);
      case 'modify-system':
        return await this.handleSystemModification(request);
      case 'build-agent':
        return await this.handleAgentCreation(request);
      case 'refine-behavior':
        return await this.handleBehaviorRefinement(request);
      case 'system-status':
        return await this.handleSystemStatus(request);
      default:
        return await this.voice.formatResponse("Unknown architectural request type. Please clarify.", { type: 'error' });
    }
  }

  private async handleCodeAnalysis(request: ArchitecturalRequest): Promise<string> {
    const analysis = await this.codeAnalyzer.analyzeCodebase(request.description);
    return await this.voice.formatResponse(`Code analysis complete. ${analysis.summary}`, { type: 'analysis' });
  }

  private async handleSystemModification(request: ArchitecturalRequest): Promise<string> {
    const modification = await this.modifier.planModification(request.description);
    
    if (modification.requiresApproval) {
      return await this.voice.formatResponse(`Proposed change: ${modification.description}. Confirm to execute.`, { type: 'confirmation' });
    }
    
    const result = await this.modifier.executeModification(modification);
    return await this.voice.formatResponse(`System modified. ${result.summary}`, { type: 'completion' });
  }

  private async handleAgentCreation(request: ArchitecturalRequest): Promise<string> {
    const agentSpec = await this.builder.parseAgentRequirements(request.description);
    const buildResult = await this.builder.generateAgent(agentSpec);
    return await this.voice.formatResponse(`Agent ${agentSpec.name} created. ${buildResult.summary}`, { type: 'creation' });
  }

  private async handleBehaviorRefinement(request: ArchitecturalRequest): Promise<string> {
    const refinement = await this.refiner.refineBehavior(request.description);
    return await this.voice.formatResponse(`Behavior refined. ${refinement.summary}`, { type: 'refinement' });
  }

  private async handleSystemStatus(request: ArchitecturalRequest): Promise<string> {
    const status = await this.codeAnalyzer.getSystemHealth();
    return await this.voice.formatResponse(`System status: ${status.summary}`, { type: 'status' });
  }
}
