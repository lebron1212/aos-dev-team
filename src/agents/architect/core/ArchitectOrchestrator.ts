import { ArchitecturalRequest, ArchitectConfig } from '../types/index.js';
import { CodeAnalyzer } from '../intelligence/CodeAnalyzer.js';
import { CodeModifier } from '../operations/CodeModifier.js';
import { AgentBuilder } from '../operations/AgentBuilder.js';
import { SystemRefiner } from '../operations/SystemRefiner.js';
import { ArchitectVoice } from '../communication/ArchitectVoice.js';
import { CodeIntelligence } from '../intelligence/CodeIntelligence.js';

export class ArchitectOrchestrator {
  private codeAnalyzer: CodeAnalyzer;
  private modifier: CodeModifier;
  private builder: AgentBuilder;
  private refiner: SystemRefiner;
  private voice: ArchitectVoice;
  private intelligence: CodeIntelligence;

  constructor(config: ArchitectConfig) {
    this.codeAnalyzer = new CodeAnalyzer(config.claudeApiKey);
    this.modifier = new CodeModifier(config.claudeApiKey);
    this.builder = new AgentBuilder(config.claudeApiKey);
    this.refiner = new SystemRefiner(config.claudeApiKey);
    this.voice = new ArchitectVoice(config.claudeApiKey);
    this.intelligence = new CodeIntelligence(config.claudeApiKey);
  }

  async executeArchitecturalWork(request: ArchitecturalRequest): Promise<string> {
    
    console.log(`[ArchitectOrchestrator] Executing: ${request.type} - ${request.description}`);
    
    // Handle special commands first
    if (request.description.toLowerCase().includes('undo last')) {
      return await this.handleUndo();
    }
    
    if (request.description.toLowerCase().includes('redo') || request.description.toLowerCase().includes('history')) {
      return await this.handleHistory();
    }
    
    // Check if this is an intelligence request that should be handled specially
    if (await this.shouldUseIntelligence(request)) {
      return await this.handleIntelligenceRequest(request);
    }
    
    switch (request.type) {
      case 'code-analysis':
        return await this.handleCodeAnalysis(request);
      case 'system-modification':
        return await this.handleSystemModification(request);
      case 'agent-creation':
        return await this.handleAgentCreation(request);
      case 'behavior-refinement':
        return await this.handleBehaviorRefinement(request);
      case 'system-status':
        return await this.handleSystemStatus(request);
      default:
        return await this.voice.formatResponse("Unknown architectural request type. Please clarify.", { type: 'error' });
    }
  }

  private async handleCodeAnalysis(request: ArchitecturalRequest): Promise<string> {
    const analysis = await this.codeAnalyzer.analyzeCodebase(request.description);
    
    const summary = `Analysis: ${analysis.summary}
    
Issues found: ${analysis.issues.length > 0 ? analysis.issues.join(', ') : 'None'}
Suggestions: ${analysis.suggestions.join(', ')}
Health: ${analysis.healthScore}%`;
    
    return await this.voice.formatResponse(summary, { type: 'analysis' });
  }

  private async handleSystemModification(request: ArchitecturalRequest): Promise<string> {
    const plan = await this.modifier.planModification(request.description);
    
    if (plan.requiresApproval) {
      return await this.voice.formatResponse(`Plan: ${plan.description}. Files: ${plan.files.join(', ')}. Risk: ${plan.riskLevel}. Confirm to execute.`, { type: 'confirmation' });
    }
    
    const result = await this.modifier.executeModification(plan);
    
    if (result.committed) {
      return await this.voice.formatResponse(`Modification complete. ${result.summary}. Changes synced to Railway. (Can undo with "undo last")`, { type: 'completion' });
    } else {
      return await this.voice.formatResponse(`Modification failed: ${result.summary}`, { type: 'error' });
    }
  }

  private async handleAgentCreation(request: ArchitecturalRequest): Promise<string> {
    const agentSpec = await this.builder.parseAgentRequirements(request.description);
    const buildResult = await this.builder.generateAgent(agentSpec);
    
    if (buildResult.ready) {
      const envVars = buildResult.environmentVars ? 
        `\n\nTo complete setup:\n${buildResult.environmentVars.map((v: string) => `railway variables --set ${v}=your_token_here`).join('\n')}` : '';
      
      return await this.voice.formatResponse(`Agent ${agentSpec.name} created with full structure. ${buildResult.summary}.${envVars}`, { type: 'creation' });
    } else {
      return await this.voice.formatResponse(`Agent creation failed: ${buildResult.error}`, { type: 'error' });
    }
  }

  private async handleBehaviorRefinement(request: ArchitecturalRequest): Promise<string> {
    const refinement = await this.refiner.refineBehavior(request.description);
    return await this.voice.formatResponse(`Behavior refinement: ${refinement.summary}`, { type: 'refinement' });
  }

  private async handleSystemStatus(request: ArchitecturalRequest): Promise<string> {
    const status = await this.codeAnalyzer.getSystemHealth();
    return await this.voice.formatResponse(`System status: ${status.summary}. ${status.issues.length > 0 ? 'Issues: ' + status.issues.join(', ') : 'All systems operational.'}`, { type: 'status' });
  }

  private async handleUndo(): Promise<string> {
    const result = await this.modifier.undoLastModification();
    
    if (result.success) {
      return await this.voice.formatResponse(`Undone: ${result.message}. Files restored: ${result.restoredFiles?.join(', ') || 'various'}`, { type: 'completion' });
    } else {
      return await this.voice.formatResponse(`Undo failed: ${result.message}`, { type: 'error' });
    }
  }

  private async handleHistory(): Promise<string> {
    // This would show modification history
    return await this.voice.formatResponse("Modification history available. Recent changes tracked with git commits.", { type: 'info' });
  }

  /**
   * Check if request should use the new intelligence system
   */
  private async shouldUseIntelligence(request: ArchitecturalRequest): Promise<boolean> {
    const lowerDesc = request.description.toLowerCase();
    
    // Intelligence patterns
    const isConfigQuery = lowerDesc.includes('what\'s') || lowerDesc.includes('current') || 
                         lowerDesc.includes('how many') || lowerDesc.includes('show me');
    
    const isTargetedModification = lowerDesc.includes('tone down') || lowerDesc.includes('increase') ||
                                  lowerDesc.includes('change') && (lowerDesc.includes('to') || lowerDesc.includes('from'));
    
    const isFeatureAnalysis = lowerDesc.includes('how does') && lowerDesc.includes('work');
    
    return isConfigQuery || isTargetedModification || isFeatureAnalysis;
  }

  /**
   * Handle requests using the new intelligence system
   */
  private async handleIntelligenceRequest(request: ArchitecturalRequest): Promise<string> {
    console.log(`[ArchitectOrchestrator] Using intelligence system for: ${request.description}`);
    
    try {
      const result = await this.intelligence.processRequest(request.description);
      
      if (result.success) {
        let response = `**${result.summary}**\n\n${result.details}`;
        
        if (result.configurations && result.configurations.length > 0) {
          response += `\n\n**Key Configurations:**\n`;
          result.configurations.slice(0, 5).forEach(config => {
            response += `• ${config.key}: ${config.value} (${config.file.split('/').pop()}:${config.line})\n`;
          });
        }
        
        if (result.modifications && result.modifications.length > 0) {
          response += `\n\n**Proposed Changes:**\n`;
          result.modifications.forEach(mod => {
            response += `• ${mod}\n`;
          });
        }
        
        if (result.affectedFiles.length > 0) {
          response += `\n\n**Files Analyzed:** ${result.affectedFiles.length} files`;
        }
        
        return await this.voice.formatResponse(response, { type: 'intelligence' });
      } else {
        // Fall back to standard processing
        console.log(`[ArchitectOrchestrator] Intelligence processing failed, falling back to standard: ${result.summary}`);
        return await this.handleCodeAnalysis(request);
      }
    } catch (error) {
      console.error('[ArchitectOrchestrator] Intelligence system error:', error);
      // Fall back to standard processing
      return await this.handleCodeAnalysis(request);
    }
  }
}
