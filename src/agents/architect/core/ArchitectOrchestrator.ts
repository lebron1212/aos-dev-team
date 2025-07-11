import { ArchitecturalRequest, ArchitectConfig } from '../types/index.js';
import { CodeAnalyzer } from '../intelligence/CodeAnalyzer.js';
import { CodeModifier } from '../operations/CodeModifier.js';
import { AgentBuilder } from '../operations/AgentBuilder.js';
import { SystemRefiner } from '../operations/SystemRefiner.js';
import { ArchitectVoice } from '../communication/ArchitectVoice.js';
import { CodeIntelligence } from '../intelligence/CodeIntelligence.js';
import { DiscordBotCreator } from '../operations/DiscordBotCreator.js';

export class ArchitectOrchestrator {
  private codeAnalyzer: CodeAnalyzer;
  private modifier: CodeModifier;
  private builder: AgentBuilder;
  private refiner: SystemRefiner;
  private voice: ArchitectVoice;
  private intelligence: CodeIntelligence;
  private discordCreator?: DiscordBotCreator;

  constructor(config: ArchitectConfig) {
    this.codeAnalyzer = new CodeAnalyzer(config.claudeApiKey);
    this.modifier = new CodeModifier(config.claudeApiKey);
    this.builder = new AgentBuilder(config.claudeApiKey, config.discordToken);
    this.refiner = new SystemRefiner(config.claudeApiKey);
    this.voice = new ArchitectVoice(config.claudeApiKey);
    this.intelligence = new CodeIntelligence(config.claudeApiKey);
    
    if (config.discordToken) {
      this.discordCreator = new DiscordBotCreator(config.claudeApiKey, config.discordToken);
    }
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
      case 'discord-bot-setup':
        return await this.handleDiscordBotSetup(request);
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

  private async handleDiscordBotSetup(request: ArchitecturalRequest): Promise<string> {
    console.log(`[ArchitectOrchestrator] Setting up Discord bot: ${request.description}`);
    
    if (!this.discordCreator) {
      return await this.voice.formatResponse("Discord bot creation unavailable - Discord token not configured", { type: 'error' });
    }
    
    // Extract agent name from request
    const agentName = this.extractAgentName(request.description);
    if (!agentName) {
      return await this.voice.formatResponse("Could not identify agent name. Please specify which agent needs Discord setup (e.g., 'Set up Discord bot for Dashboard agent')", { type: 'error' });
    }
    
    // Check if agent exists in codebase
    const agentExists = await this.checkAgentExists(agentName);
    if (!agentExists) {
      return await this.voice.formatResponse(`Agent '${agentName}' not found in codebase. Available agents: Commander, Architect, Dashboard`, { type: 'error' });
    }
    
    try {
      // Create Discord bot for the existing agent
      const botConfig = await this.discordCreator.createDiscordBot(agentName, `AI Agent for ${agentName} operations`);
      
      if (!botConfig) {
        return await this.voice.formatResponse(`Failed to create Discord bot for ${agentName}. Check Discord API access and try again.`, { type: 'error' });
      }
      
      // Create dedicated channel 
      let channelId = '';
      const guildId = process.env.DISCORD_GUILD_ID;
      if (guildId) {
        const createdChannelId = await this.discordCreator.createChannelForAgent(guildId, agentName);
        if (createdChannelId) {
          channelId = createdChannelId;
        }
      }
      
      // Update environment variables automatically (handled by DiscordBotCreator)
      
      const summary = `✅ Discord bot created for ${agentName}!
      
🤖 Application: ${agentName} Agent (${botConfig.clientId})
🔑 Token: ${botConfig.token.substring(0, 20)}...
📺 Channel: ${channelId ? `#${agentName.toLowerCase()} (${channelId})` : 'Channel creation pending'}
🔗 Invite URL: ${botConfig.inviteUrl}

🚀 Environment variables set automatically via Railway CLI
⚙️ Deployment triggered automatically to apply new configuration

Next steps:
1. Add bot to Discord server using invite URL above
2. Verify ${agentName} starts successfully in logs
3. Test ${agentName} responds in #${agentName.toLowerCase()} channel

The automated setup is complete!`;

      return await this.voice.formatResponse(summary, { type: 'creation' });
      
    } catch (error) {
      console.error('[ArchitectOrchestrator] Discord bot setup failed:', error);
      return await this.voice.formatResponse(`Discord bot setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { type: 'error' });
    }
  }

  private extractAgentName(description: string): string | null {
    const lowerDesc = description.toLowerCase();
    
    // Look for common patterns
    const patterns = [
      /set up discord bot for (\w+)/i,
      /setup discord bot for (\w+)/i,
      /create discord bot for (\w+)/i,
      /discord bot for (\w+)/i,
      /(\w+) agent/i,
      /(\w+) discord/i
    ];
    
    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match) {
        const agentName = match[1];
        // Capitalize first letter
        return agentName.charAt(0).toUpperCase() + agentName.slice(1).toLowerCase();
      }
    }
    
    return null;
  }

  private async checkAgentExists(agentName: string): Promise<boolean> {
    try {
      const { promises: fs } = await import('fs');
      const agentPath = `src/agents/${agentName.toLowerCase()}`;
      await fs.access(agentPath);
      return true;
    } catch {
      return false;
    }
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
