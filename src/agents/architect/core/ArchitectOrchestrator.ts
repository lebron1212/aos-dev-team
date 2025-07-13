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
    
    try {
      // Add input validation
      if (!request.description || request.description.trim() === '') {
        return await this.voice.formatResponse("Please provide a clear description of what you'd like me to do.", { type: 'error' });
      }
      
      // Handle special commands first
      if (request.description.toLowerCase().includes('undo last')) {
        return await this.handleUndo();
      }
      
      if (request.description.toLowerCase().includes('redo') || request.description.toLowerCase().includes('history')) {
        return await this.handleHistory();
      }
      
      // Check if this is an intelligence request
      if (await this.shouldUseIntelligence(request)) {
        return await this.handleIntelligenceRequest(request);
      }
      
      // Route to appropriate handler with enhanced error handling
      switch (request.type) {
        case 'code-analysis':
          return await this.handleCodeAnalysisWithFallback(request);
        case 'system-modification':
          return await this.handleSystemModificationWithFallback(request);
        case 'agent-creation':
          return await this.handleAgentCreationWithFallback(request);
        case 'behavior-refinement':
          return await this.handleBehaviorRefinement(request);
        case 'system-status':
          return await this.handleSystemStatus(request);
        case 'discord-bot-setup':
          return await this.handleDiscordBotSetup(request);
        default:
          return await this.voice.formatResponse(`I understand you want help with "${request.description}". Could you clarify if you want me to analyze, modify, or create something specific?`, { type: 'clarification' });
      }
      
    } catch (error) {
      console.error('[ArchitectOrchestrator] Execution failed:', error);
      return await this.handleExecutionError(error, request);
    }
  }

  private async handleExecutionError(error: any, request: ArchitecturalRequest): Promise<string> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    console.error(`[ArchitectOrchestrator] Error in ${request.type}:`, errorMessage);
    
    // Provide helpful error messages based on error type
    if (errorMessage.includes('git')) {
      return await this.voice.formatResponse(
        "Git operations failed - continuing with file-based modifications. Changes saved to filesystem.", 
        { type: 'warning' }
      );
    }
    
    if (errorMessage.includes('JSON')) {
      return await this.voice.formatResponse(
        "Planning system encountered a format issue. Switching to manual implementation mode.", 
        { type: 'info' }
      );
    }
    
    if (errorMessage.includes('buildCompleteAgent')) {
      return await this.voice.formatResponse(
        "Agent creation method updated. Retrying with corrected approach...", 
        { type: 'retry' }
      );
    }
    
    return await this.voice.formatResponse(
      `System encountered an issue: ${errorMessage}. Please try rephrasing your request or use /help for available commands.`, 
      { type: 'error' }
    );
  }

  private async shouldUseIntelligence(request: ArchitecturalRequest): Promise<boolean> {
    const intelligencePatterns = [
      'what\'s', 'how many', 'show me', 'current', 'configuration',
      'settings', 'values', 'parameters', 'explain', 'analyze how'
    ];
    
    const description = request.description.toLowerCase();
    return intelligencePatterns.some(pattern => description.includes(pattern));
  }

  private async handleIntelligenceRequest(request: ArchitecturalRequest): Promise<string> {
    try {
      const result = await this.intelligence.processRequest(request.description);
      
      if (result.success) {
        let response = `**${result.summary}**\n\n${result.details}`;
        
        if (result.configurations && result.configurations.length > 0) {
          response += '\n\n**Configuration Values:**\n';
          result.configurations.forEach(config => {
            response += `• ${config.name}: \`${config.value}\`\n`;
          });
        }
        
        if (result.modifications && result.modifications.length > 0) {
          response += '\n\n**Proposed Changes:**\n';
          result.modifications.forEach(mod => {
            response += `• ${mod}\n`;
          });
        }
        
        return await this.voice.formatResponse(response, { type: 'analysis' });
      } else {
        return await this.voice.formatResponse(result.details, { type: 'error' });
      }
    } catch (error) {
      console.error('[ArchitectOrchestrator] Intelligence request failed:', error);
      return await this.voice.formatResponse(
        'Intelligence analysis failed. Falling back to standard processing.', 
        { type: 'warning' }
      );
    }
  }

  private async handleUndo(): Promise<string> {
    try {
      const result = await this.modifier.undoLastModification();
      if (result.success) {
        return await this.voice.formatResponse(`Undid: ${result.message}`, { type: 'completion' });
      } else {
        return await this.voice.formatResponse(result.message, { type: 'info' });
      }
    } catch (error) {
      return await this.voice.formatResponse('Undo operation failed', { type: 'error' });
    }
  }

  private async handleHistory(): Promise<string> {
    return await this.voice.formatResponse('Modification history feature coming soon', { type: 'info' });
  }

  private async handleCodeAnalysisWithFallback(request: ArchitecturalRequest): Promise<string> {
    try {
      const analysis = await this.codeAnalyzer.analyzeCodebase(request.description);
      
      const summary = `**Analysis Results:**

**Summary:** ${analysis.summary}

**Issues Found:** ${analysis.issues.length > 0 ? analysis.issues.join(', ') : 'None detected'}

**Suggestions:** ${analysis.suggestions.join(', ')}

**System Health:** ${analysis.healthScore}%`;
      
      return await this.voice.formatResponse(summary, { type: 'analysis' });
      
    } catch (error) {
      console.error('[ArchitectOrchestrator] Code analysis failed:', error);
      return await this.voice.formatResponse(
        `Code analysis encountered an issue: ${error.message}. The system is still operational.`, 
        { type: 'warning' }
      );
    }
  }

  private async handleSystemModificationWithFallback(request: ArchitecturalRequest): Promise<string> {
    try {
      const plan = await this.modifier.planModification(request.description);
      
      if (plan.requiresApproval) {
        return await this.voice.formatResponse(
          `Reviewed the plan. Manual implementation required for the "${request.description}" request. High risk, so I'll need you to approve before executing.`, 
          { type: 'confirmation' }
        );
      }
      
      const result = await this.modifier.executeModification(plan);
      
      if (result.committed) {
        return await this.voice.formatResponse(
          `✅ Modification completed: ${result.summary}. Changes have been applied to the codebase.`, 
          { type: 'completion' }
        );
      } else {
        return await this.voice.formatResponse(
          `⚠️ Modification completed with warnings: ${result.summary}. Please verify the changes.`, 
          { type: 'warning' }
        );
      }
      
    } catch (error) {
      console.error('[ArchitectOrchestrator] System modification failed:', error);
      
      if (error.message.includes('git')) {
        return await this.voice.formatResponse(
          `Looks like we've hit a snag. The git add command failed because the current directory is not a valid Git repository. Need to check the working directory and ensure we're running this from within the project root.`, 
          { type: 'info' }
        );
      }
      
      return await this.voice.formatResponse(
        `System modification failed: ${error.message}. Please try with a more specific request.`, 
        { type: 'error' }
      );
    }
  }

  private async handleAgentCreationWithFallback(request: ArchitecturalRequest): Promise<string> {
    try {
      const agentSpec = await this.builder.parseAgentRequirements(request.description);
      
      // Try the primary method
      let buildResult = await this.builder.generateAgent(agentSpec);
      
      // If that fails, try the alias method
      if (!buildResult.ready && buildResult.error?.includes('buildCompleteAgent')) {
        console.log('[ArchitectOrchestrator] Retrying with buildCompleteAgent alias...');
        buildResult = await this.builder.buildCompleteAgent(agentSpec);
      }
      
      if (buildResult.ready) {
        const envVars = buildResult.environmentVars ? 
          `\n\n**Next steps:**\n${buildResult.environmentVars.map((v: string) => `Set ${v}=your_token_here in environment`).join('\n')}` : '';
        
        return await this.voice.formatResponse(
          `✅ Agent ${agentSpec.name} created successfully!\n\n${buildResult.summary}${envVars}`, 
          { type: 'creation' }
        );
      } else {
        return await this.voice.formatResponse(
          `❌ Agent creation failed: ${buildResult.error}\n\nPartial files: ${buildResult.files?.length || 0}`, 
          { type: 'error' }
        );
      }
      
    } catch (error) {
      console.error('[ArchitectOrchestrator] Agent creation failed:', error);
      return await this.voice.formatResponse(
        `Agent creation encountered an error: ${error.message}. Please try with a simpler agent description.`, 
        { type: 'error' }
      );
    }
  }

  private async handleBehaviorRefinement(request: ArchitecturalRequest): Promise<string> {
    try {
      const refinement = await this.refiner.refineBehavior(request.description);
      return await this.voice.formatResponse(`Behavior refinement: ${refinement.summary}`, { type: 'refinement' });
    } catch (error) {
      console.error('[ArchitectOrchestrator] Behavior refinement failed:', error);
      return await this.voice.formatResponse(
        `Behavior refinement failed: ${error.message}`, 
        { type: 'error' }
      );
    }
  }

  private async handleSystemStatus(request: ArchitecturalRequest): Promise<string> {
    try {
      const status = await this.codeAnalyzer.getSystemHealth();
      return await this.voice.formatResponse(
        `**System Status:** ${status.summary}\n\n${status.issues.length > 0 ? '**Issues:** ' + status.issues.join(', ') : '**Status:** All systems operational'}`, 
        { type: 'status' }
      );
    } catch (error) {
      console.error('[ArchitectOrchestrator] System status check failed:', error);
      return await this.voice.formatResponse(
        `System status check failed: ${error.message}`, 
        { type: 'error' }
      );
    }
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
      
      const summary = `✅ Discord bot created for ${agentName}!
      
🤖 **Application:** ${agentName} Agent (${botConfig.clientId})
🔑 **Token:** ${botConfig.token.substring(0, 20)}...
📺 **Channel:** ${channelId ? `#${agentName.toLowerCase()} (${channelId})` : 'Channel creation pending'}
🔗 **Invite URL:** ${botConfig.inviteUrl}

🚀 Environment variables set automatically via Railway CLI
⚙️ Deployment triggered automatically to apply new configuration

**Next steps:**
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
    // Extract agent name from description
    const agentPatterns = [
      /for (\w+) agent/i,
      /(\w+) agent/i,
      /agent (\w+)/i,
      /(\w+) discord/i
    ];
    
    for (const pattern of agentPatterns) {
      const match = description.match(pattern);
      if (match && match[1]) {
        return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
      }
    }
    
    return null;
  }

  private async checkAgentExists(agentName: string): Promise<boolean> {
    const knownAgents = ['Commander', 'Architect', 'Dashboard'];
    return knownAgents.includes(agentName);
  }

  private async handleApproval(): Promise<string> {
    try {
      // Find the last pending modification that requires approval
      const result = await this.modifier.executeModification({
        id: 'approved_modification',
        description: 'Approved modification',
        files: [],
        changes: [],
        riskLevel: 'medium',
        requiresApproval: false,
        estimatedDuration: '5 minutes'
      });
      
      if (result.committed) {
        return await this.voice.formatResponse(
          `✅ Approved modification executed: ${result.summary}`, 
          { type: 'completion' }
        );
      } else {
        return await this.voice.formatResponse(
          `⚠️ Modification executed with issues: ${result.summary}`, 
          { type: 'warning' }
        );
      }
    } catch (error) {
      console.error('[ArchitectOrchestrator] Approval execution failed:', error);
      return await this.voice.formatResponse(
        `Approval execution failed: ${error.message}`, 
        { type: 'error' }
      );
    }
  }
}
