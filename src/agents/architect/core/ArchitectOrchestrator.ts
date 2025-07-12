import { ArchitecturalRequest, ArchitectConfig } from '../types/index.js';
import { CodeAnalyzer } from '../intelligence/CodeAnalyzer.js';
import { CodeModifier } from '../operations/CodeModifier.js';
import { ArchitectOrchestrator } from '../operations/AgentBuilder.js'; 
import { SystemRefiner } from '../operations/SystemRefiner.js';
import { ArchitectVoice } from '../communication/ArchitectVoice.js';
import { CodeIntelligence } from '../intelligence/CodeIntelligence.js';
import { DiscordBotCreator } from '../operations/DiscordBotCreator.js';

export class ArchitectOrchestrator {
  private codeAnalyzer: CodeAnalyzer;
  private modifier: CodeModifier;
  private refiner: SystemRefiner;
  private voice: ArchitectVoice;
  private intelligence: CodeIntelligence;
  private discordCreator?: DiscordBotCreator;
  
  // Add state management for pending operations
  private pendingModifications: Map<string, any> = new Map();
  private lastResponse: Map<string, string> = new Map();

  constructor(config: ArchitectConfig) {
    this.codeAnalyzer = new CodeAnalyzer(config.claudeApiKey);
    this.modifier = new CodeModifier(config.claudeApiKey);
    this.refiner = new SystemRefiner(config.claudeApiKey);
    this.voice = new ArchitectVoice(config.claudeApiKey);
    this.intelligence = new CodeIntelligence(config.claudeApiKey);
    
    if (config.discordToken) {
      this.discordCreator = new DiscordBotCreator(config.claudeApiKey, config.discordToken);
    }
  }

  async executeArchitecturalWork(request: ArchitecturalRequest): Promise<string> {
    console.log(`[ArchitectOrchestrator] Executing: ${request.type} - ${request.description}`);
    
    // Check for approval of pending modifications
    if (request.description.toLowerCase().trim() === 'approve') {
      return await this.handleApproval(request);
    }
    
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
        return await this.voice.formatResponse("Request type not recognized. Please specify what you'd like me to analyze, modify, or build.", { type: 'error' });
    }
  }

  // Maintain backward compatibility - wrapper for existing callers
  async executeOperation(operation: string, request: string): Promise<string> {
    const architecturalRequest: ArchitecturalRequest = {
      type: operation as any,
      description: request,
      priority: 'medium',
      timestamp: new Date()
    };
    
    return await this.executeArchitecturalWork(architecturalRequest);
  }

  private async handleApproval(request: ArchitecturalRequest): Promise<string> {
    // Check if there are any pending modifications to approve
    const pendingKeys = Array.from(this.pendingModifications.keys());
    
    if (pendingKeys.length === 0) {
      return await this.voice.formatResponse("No pending modifications to approve.", { type: 'info' });
    }
    
    // Get the most recent pending modification
    const latestKey = pendingKeys[pendingKeys.length - 1];
    const pendingPlan = this.pendingModifications.get(latestKey);
    
    if (!pendingPlan) {
      return await this.voice.formatResponse("No valid modification plan found.", { type: 'error' });
    }
    
    try {
      // Execute the pending modification
      const result = await this.modifier.executeModification(pendingPlan);
      
      // Clear the pending modification
      this.pendingModifications.delete(latestKey);
      
      if (result.committed) {
        return await this.voice.formatResponse(`Approved and executed: ${result.summary}. Changes deployed automatically.`, { type: 'completion' });
      } else {
        return await this.voice.formatResponse(`Execution failed: ${result.summary}`, { type: 'error' });
      }
    } catch (error) {
      this.pendingModifications.delete(latestKey);
      return await this.voice.formatResponse(`Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { type: 'error' });
    }
  }

  private async handleCodeAnalysis(request: ArchitecturalRequest): Promise<string> {
    const analysis = await this.codeAnalyzer.analyzeCodebase(request.description);
    
    const summary = `Analysis complete: ${analysis.summary}
    
Issues found: ${analysis.issues.length > 0 ? analysis.issues.join(', ') : 'None'}
Suggestions: ${analysis.suggestions.join(', ')}
Health: ${analysis.healthScore}%`;
    
    return await this.voice.formatResponse(summary, { type: 'analysis' });
  }

  private async handleSystemModification(request: ArchitecturalRequest): Promise<string> {
    const plan = await this.modifier.planModification(request.description);
    
    if (plan.requiresApproval) {
      // Store the plan for later approval
      const planKey = `plan_${Date.now()}`;
      this.pendingModifications.set(planKey, plan);
      
      return await this.voice.formatResponse(`Plan generated: ${plan.description}. Files: ${plan.files.join(', ')}. Risk: ${plan.riskLevel}. Reply "approve" to execute.`, { type: 'confirmation' });
    }
    
    const result = await this.modifier.executeModification(plan);
    
    if (result.committed) {
      return await this.voice.formatResponse(`Modification complete: ${result.summary}. Changes deployed automatically.`, { type: 'completion' });
    } else {
      return await this.voice.formatResponse(`Modification failed: ${result.summary}`, { type: 'error' });
    }
  }

  private async handleAgentCreation(request: ArchitecturalRequest): Promise<string> {
    console.log(`[ArchitectOrchestrator] Creating agent from request: ${request.description}`);
    
    try {
      // Use the fixed AgentBuilder
      const success = await agentBuilder.buildCompleteAgent(request.description);
      
      if (success) {
        const config = agentBuilder.parseRequirements(request.description);
        const storedAgents = agentBuilder.getStoredAgents();
        
        // Check if environment variables are needed
        const envVars = config.discordEnabled ? 
          [`${config.name.toUpperCase()}_DISCORD_TOKEN`] : [];
        
        const envVarInstructions = envVars.length > 0 ? 
          `\n\nTo complete setup:\n${envVars.map(v => `railway variables --set ${v}=your_token_here`).join('\n')}` : '';
        
        const summary = `Agent ${config.name} created successfully. Files generated: ${Object.keys({
          [`${config.name}.ts`]: '',
          [`communication/${config.name}Discord.ts`]: '',
          [`core/${config.name}Core.ts`]: '',
          [`intelligence/${config.name}Watcher.ts`]: '',
          'index.ts': '',
          'README.md': ''
        }).length}.${envVarInstructions}`;
        
        return await this.voice.formatResponse(summary, { type: 'creation' });
      } else {
        // Partial success - agent in memory but files may have failed
        const config = agentBuilder.parseRequirements(request.description);
        const isRailway = process.env.RAILWAY_ENVIRONMENT === 'production';
        
        const message = `Agent ${config.name} partially created. ${isRailway ? 
          'Files are ephemeral on Railway but agent is functional in memory.' : 
          'Some file operations failed. Check permissions and disk space.'}`;
        
        return await this.voice.formatResponse(message, { type: 'creation' });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return await this.voice.formatResponse(`Agent creation failed: ${errorMsg}`, { type: 'error' });
    }
  }

  private async handleBehaviorRefinement(request: ArchitecturalRequest): Promise<string> {
    const refinement = await this.refiner.refineBehavior(request.description);
    return await this.voice.formatResponse(`Behavior refinement: ${refinement.summary}`, { type: 'refinement' });
  }

  private async handleSystemStatus(request: ArchitecturalRequest): Promise<string> {
    const status = await this.codeAnalyzer.getSystemHealth();
    const agents = agentBuilder.getStoredAgents();
    
    const agentStatus = agents.length > 0 ? 
      ` Active agents: ${agents.length} (${agents.map(a => a.name).join(', ')}).` : 
      ' No agents in memory.';
    
    return await this.voice.formatResponse(`System status: ${status.summary}. ${status.issues.length > 0 ? 'Issues: ' + status.issues.join(', ') : 'All systems operational.'}${agentStatus}`, { type: 'status' });
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
    
    // Check if agent exists in codebase or memory
    const agentExists = await this.checkAgentExists(agentName);
    if (!agentExists) {
      // Check in memory (AgentBuilder's stored agents)
      const storedAgent = agentBuilder.getAgentConfig(agentName);
      if (!storedAgent) {
        const availableAgents = agentBuilder.getStoredAgents().map(a => a.name).join(', ') || 'None';
        return await this.voice.formatResponse(`Agent '${agentName}' not found in codebase or memory. Available agents: ${availableAgents}`, { type: 'error' });
      }
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
      
      const summary = `Discord bot created for ${agentName}!
      
🤖 Application: ${agentName} Agent (${botConfig.clientId})
🔑 Token: ${botConfig.token.substring(0, 20)}...
📺 Channel: ${channelId ? `#${agentName.toLowerCase()} (${channelId})` : 'Channel creation pending'}
🔗 Invite URL: ${botConfig.inviteUrl}

🚀 Environment variables set automatically via Railway CLI
⚙️ Deployment triggered automatically

Next steps:
1. Add bot to Discord server using invite URL above
2. Verify ${agentName} starts successfully in logs
3. Test ${agentName} responds in #${agentName.toLowerCase()} channel

Setup complete!`;

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
      /(?:set up|setup|create) discord bot for (\w+)/i,
      /discord (?:bot|integration) for (\w+)/i,
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
        let response = `${result.summary}\n\n${result.details}`;
        
        if (result.configurations && result.configurations.length > 0) {
          response += `\n\nKey Configurations:\n`;
          result.configurations.slice(0, 5).forEach(config => {
            response += `• ${config.key}: ${config.value} (${config.file.split('/').pop()}:${config.line})\n`;
          });
        }
        
        if (result.modifications && result.modifications.length > 0) {
          response += `\n\nProposed Changes:\n`;
          result.modifications.forEach(mod => {
            response += `• ${mod}\n`;
          });
        }
        
        if (result.affectedFiles.length > 0) {
          response += `\n\nFiles Analyzed: ${result.affectedFiles.length} files`;
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

  // Wrapper methods for backward compatibility
  async createAgent(request: string): Promise<string> {
    const architecturalRequest: ArchitecturalRequest = {
      type: 'agent-creation',
      description: request,
      priority: 'medium',
      timestamp: new Date()
    };
    
    return await this.handleAgentCreation(architecturalRequest);
  }

  async getSystemStatus(): Promise<string> {
    const architecturalRequest: ArchitecturalRequest = {
      type: 'system-status',
      description: 'Get system status',
      priority: 'low',
      timestamp: new Date()
    };
    
    return await this.handleSystemStatus(architecturalRequest);
  }
}
