import { ArchitecturalRequest, ArchitectConfig } from '../types/index.js';
import { CodeAnalyzer } from '../intelligence/CodeAnalyzer.js';
import { CodeModifier } from '../operations/CodeModifier.js';
import { AgentBuilder } from '../operations/AgentBuilder.js';
import { DiscordBotCreator } from '../operations/DiscordBotCreator.js';

export class ArchitectOrchestrator {
  private codeAnalyzer: CodeAnalyzer;
  private modifier: CodeModifier;
  private builder: AgentBuilder;
  private discordCreator?: DiscordBotCreator;
  private discord: any; // Discord interface

  constructor(config: ArchitectConfig, discord: any) {
    this.codeAnalyzer = new CodeAnalyzer(config.claudeApiKey);
    this.modifier = new CodeModifier(config.claudeApiKey);
    this.builder = new AgentBuilder(config.claudeApiKey, config.discordToken);
    this.discord = discord;
    
    if (config.discordToken) {
      this.discordCreator = new DiscordBotCreator(config.claudeApiKey, config.discordToken);
    }
  }

  async executeArchitecturalWork(request: ArchitecturalRequest): Promise<string> {
    console.log(`[Architect] Executing: ${request.type} - ${request.description}`);
    
    // Send start notification
    await this.sendProgressUpdate(`🏗️ **Started**: ${request.description}`, 'started');
    
    try {
      let result: any;
      
      switch (request.type) {
        case 'code-analysis':
          result = await this.handleCodeAnalysis(request);
          break;
        case 'system-modification':
          result = await this.handleSystemModification(request);
          break;
        case 'agent-creation':
          result = await this.handleAgentCreation(request);
          break;
        case 'discord-bot-setup':
          result = await this.handleDiscordBotSetup(request);
          break;
        default:
          result = `Unknown request type: ${request.type}`;
      }

      // Send completion notification
      await this.sendProgressUpdate(`✅ **Completed**: ${request.description}\n\n${result}`, 'completed');
      return result;

    } catch (error) {
      const errorMsg = `❌ **Failed**: ${request.description}\n\nError: ${error.message}`;
      await this.sendProgressUpdate(errorMsg, 'failed');
      return errorMsg;
    }
  }

  private async handleCodeAnalysis(request: ArchitecturalRequest): Promise<string> {
    await this.sendProgressUpdate(`🔍 Analyzing codebase...`, 'progress');
    
    const analysis = await this.codeAnalyzer.analyzeCodebase(request.description);
    
    return `Code Analysis Complete:
- Health Score: ${analysis.healthScore}%
- Issues: ${analysis.issues.length}
- Files Analyzed: ${analysis.files?.length || 0}
- Suggestions: ${analysis.suggestions.join(', ')}`;
  }

  private async handleSystemModification(request: ArchitecturalRequest): Promise<string> {
    await this.sendProgressUpdate(`⚙️ Planning modifications...`, 'progress');
    
    const plan = await this.modifier.planModification(request.description);
    
    if (plan.requiresApproval) {
      return `Modification plan ready:
- Risk Level: ${plan.riskLevel}
- Files: ${plan.files.join(', ')}
- Changes: ${plan.changes.length}

Reply "approve" to execute.`;
    }
    
    await this.sendProgressUpdate(`🔧 Executing modifications...`, 'progress');
    const result = await this.modifier.executeModification(plan);
    
    return `Modification ${result.committed ? 'completed' : 'failed'}:
${result.summary}
Files changed: ${plan.files.join(', ')}`;
  }

  private async handleAgentCreation(request: ArchitecturalRequest): Promise<string> {
    await this.sendProgressUpdate(`🤖 Building new agent...`, 'progress');
    
    const agentSpec = await this.builder.parseAgentRequirements(request.description);
    
    await this.sendProgressUpdate(`📁 Creating agent structure...`, 'progress');
    const buildResult = await this.builder.generateAgent(agentSpec);
    
    if (buildResult.ready) {
      return `Agent ${agentSpec.name} created successfully:
- Files: ${buildResult.files?.length || 0}
- Discord Integration: ${buildResult.discordBotCreated ? 'Yes' : 'Pending'}
- Watcher: ${buildResult.watcherCreated ? 'Yes' : 'No'}

Agent is ready for deployment.`;
    }
    
    return `Agent creation failed: ${buildResult.error}`;
  }

  private async handleDiscordBotSetup(request: ArchitecturalRequest): Promise<string> {
    if (!this.discordCreator) {
      return "Discord bot creation unavailable - Discord token not configured";
    }
    
    // Extract agent name
    const agentName = this.extractAgentName(request.description);
    if (!agentName) {
      return "Could not identify agent name from request";
    }
    
    await this.sendProgressUpdate(`🤖 Creating Discord bot for ${agentName}...`, 'progress');
    
    // Check if agent exists
    const agentExists = await this.checkAgentExists(agentName);
    if (!agentExists) {
      return `Agent '${agentName}' not found. Available: Commander, Architect, Dashboard`;
    }
    
    try {
      await this.sendProgressUpdate(`⚙️ Creating Discord application...`, 'progress');
      const botConfig = await this.discordCreator.createDiscordBot(agentName, `AI Agent for ${agentName}`);
      
      if (!botConfig) {
        return `Failed to create Discord bot for ${agentName}`;
      }
      
      await this.sendProgressUpdate(`📺 Creating dedicated channel...`, 'progress');
      let channelId = '';
      const guildId = process.env.DISCORD_GUILD_ID;
      if (guildId) {
        const createdChannelId = await this.discordCreator.createChannelForAgent(guildId, agentName);
        if (createdChannelId) {
          channelId = createdChannelId;
        }
      }
      
      await this.sendProgressUpdate(`🚀 Setting environment variables...`, 'progress');
      
      return `Discord bot created for ${agentName}:

🤖 **Bot Details:**
- Application: ${agentName} Agent
- Token: ${botConfig.token.substring(0, 20)}...
- Channel: ${channelId ? `#${agentName.toLowerCase()}` : 'Pending'}
- Invite: ${botConfig.inviteUrl}

🔧 **Next Steps:**
1. Add bot to server using invite URL
2. Verify ${agentName} starts successfully
3. Test bot responds in channel

Setup complete!`;

    } catch (error) {
      return `Discord bot setup failed: ${error.message}`;
    }
  }

  private async sendProgressUpdate(message: string, status: 'started' | 'progress' | 'completed' | 'failed'): Promise<void> {
    if (!this.discord) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const statusIcon = {
      started: '🏗️',
      progress: '⏳', 
      completed: '✅',
      failed: '❌'
    }[status];
    
    const formattedMessage = `${statusIcon} **[${timestamp}]** ${message}`;
    
    try {
      await this.discord.sendMessage(formattedMessage);
    } catch (error) {
      console.error('[Architect] Failed to send progress update:', error);
    }
  }

  private extractAgentName(description: string): string | null {
    const patterns = [
      /set up discord bot for (\w+)/i,
      /discord bot for (\w+)/i,
      /(\w+) agent/i
    ];
    
    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match) {
        return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
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
}
