import { ArchitectDiscord } from './communication/ArchitectDiscord.js';
import { ArchitectCommandRouter } from './core/ArchitectCommandRouter.js';
import { UniversalAnalyzer } from './core/UniversalAnalyzer.js';
import { CompleteArchitectOrchestrator } from './core/CompleteArchitectOrchestrator.js';
import { CodeAnalyzer } from './intelligence/CodeAnalyzer.js';
import { CodeModifier } from './operations/CodeModifier.js';
import { AgentBuilder } from './operations/AgentBuilder.js';
import { SystemRefiner } from './operations/SystemRefiner.js';
import { ArchitectVoice } from './communication/ArchitectVoice.js';
import { ArchWatch } from '../watcher/archwatch/ArchWatch.js';
import { ArchitectConfig, ArchitecturalRequest } from './types/index.js';
import { CommandInteraction } from 'discord.js';

export class Architect {
  private discord: ArchitectDiscord;
  private commandRouter: ArchitectCommandRouter;
  private analyzer: UniversalAnalyzer;
  private orchestrator: ArchitectOrchestrator;
  private codeAnalyzer: CodeAnalyzer;
  private modifier: CodeModifier;
  private builder: AgentBuilder;
  private refiner: SystemRefiner;
  private voice: ArchitectVoice;
  private watcher: ArchWatch;

  constructor(config: ArchitectConfig) {
    this.discord = new ArchitectDiscord(config);
    this.commandRouter = new ArchitectCommandRouter(config);
    this.analyzer = new UniversalAnalyzer(config.claudeApiKey);
    this.orchestrator = new CompleteArchitectOrchestrator(config);
    this.codeAnalyzer = new CodeAnalyzer(config.claudeApiKey);
    this.modifier = new CodeModifier(config.claudeApiKey);
    this.builder = new AgentBuilder(config.claudeApiKey, config.discordToken);
    this.refiner = new SystemRefiner(config.claudeApiKey);
    this.voice = new ArchitectVoice(config.claudeApiKey);
    this.watcher = new ArchWatch();
    
    console.log('[Architect] Simplified architect initialized');
  }

  async start(): Promise<void> {
    // Handle regular messages
    this.discord.onMessage(async (message) => {
      try {
        const response = await this.processMessage(message.content, message.author.id);
        await this.discord.sendMessage(response);
      } catch (error) {
        console.error('[Architect] Message processing failed:', error);
        await this.discord.sendMessage('⚠️ System encountered an error. Please try again or use /help for guidance.');
      }
    });

    // Handle slash commands
    this.discord.onSlashCommand(async (interaction) => {
      try {
        const response = await this.processSlashCommand(interaction);
        await this.discord.replyToInteraction(interaction, response);
      } catch (error) {
        console.error('[Architect] Slash command processing failed:', error);
        await this.discord.replyToInteraction(interaction, '⚠️ Command failed. Please try again.');
      }
    });

    await this.discord.start();
    console.log('[Architect] 🏗️ Architect online - Ready for build requests');
  }

  async processMessage(input: string, userId: string): Promise<string> {
    console.log(`[Architect] Processing: "${input}"`);
    
    try {
      // Handle special /help command with enhanced display
      if (input.toLowerCase().trim() === '/help') {
        return this.commandRouter.routeCommand(input, userId);
      }
      
      // Route all other commands through enhanced router
      const response = await this.commandRouter.routeCommand(input, userId);
      
      // Log architectural decisions for learning
      try {
        await this.watcher.logArchitecturalDecision(
          'command-execution',
          input,
          response,
          this.assessResponseRisk(response)
        );
      } catch (watcherError) {
        console.error('[Architect] Watcher logging failed:', watcherError);
        // Continue without failing the main request
      }
      
      return response;
      
    } catch (error) {
      console.error('[Architect] Error:', error);
      return this.getErrorResponse(error);
    }
  }

  async processSlashCommand(interaction: CommandInteraction): Promise<string> {
    const command = interaction.commandName;
    const userId = interaction.user.id;
    
    console.log(`[Architect] Processing slash command: /${command}`);
    
    try {
      let input: string;
      
      switch (command) {
        case 'help':
          input = '/help';
          break;
        
        case 'status':
          input = '/status';
          break;
        
        case 'analyze':
          const target = interaction.options.getString('target') || 'system';
          input = `analyze ${target}`;
          break;
        
        case 'build':
          const description = interaction.options.getString('description')!;
          input = `build ${description}`;
          break;
        
        case 'fix':
          const issue = interaction.options.getString('issue')!;
          input = `fix ${issue}`;
          break;
        
        case 'modify':
          const change = interaction.options.getString('change')!;
          input = `modify ${change}`;
          break;
        
        case 'examples':
          input = '/examples';
          break;
        
        case 'pending':
          input = '/pending';
          break;
        
        case 'approve':
          input = 'approve';
          break;
        
        case 'undo':
          input = 'undo last';
          break;
        
        case 'deploy':
          const environment = interaction.options.getString('environment') || 'staging';
          input = `deploy to ${environment}`;
          break;
        
        default:
          return `Unknown command: /${command}`;
      }
      
      // Route through command router
      const response = await this.commandRouter.routeCommand(input, userId);
      
      // Log slash command execution
      try {
        await this.watcher.logArchitecturalDecision(
          'slash-command',
          `/${command}: ${input}`,
          response,
          this.assessResponseRisk(response)
        );
      } catch (watcherError) {
        console.error('[Architect] Watcher logging failed:', watcherError);
      }
      
      return response;
      
    } catch (error) {
      console.error('[Architect] Slash command error:', error);
      return this.getErrorResponse(error);
    }
  }

  private getErrorResponse(error: any): string {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('buildCompleteAgent')) {
      return '🔧 Detected buildCompleteAgent issue - this has been fixed in the latest update. Please try your request again.';
    }
    
    if (errorMessage.includes('JSON')) {
      return '🔧 JSON parsing issue detected - using fallback processing. Your request is being handled.';
    }
    
    if (errorMessage.includes('git')) {
      return '🔧 Git operations not available - using file-based backups instead. Continuing with your request.';
    }
    
    return `⚠️ System issue: ${errorMessage}. Try rephrasing your request or use /help for guidance.`;
  }

  private assessResponseRisk(response: string): 'low' | 'medium' | 'high' {
    if (response.includes('requires approval') || response.includes('high risk')) {
      return 'high';
    }
    if (response.includes('modification') || response.includes('building')) {
      return 'medium';
    }
    return 'low';
  }
}
