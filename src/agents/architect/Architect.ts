import { ArchitectDiscord } from './communication/ArchitectDiscord.js';
import { ArchitectCommandRouter } from './core/ArchitectCommandRouter.js';
import { ArchitectVoice } from './communication/ArchitectVoice.js';
import { ArchWatch } from '../watcher/archwatch/ArchWatch.js';
import { ArchitectConfig } from './types/index.js';

export class Architect {
  private discord: ArchitectDiscord;
  private commandRouter: ArchitectCommandRouter;
  private voice: ArchitectVoice;
  private watcher: ArchWatch;

  constructor(config: ArchitectConfig) {
    this.discord = new ArchitectDiscord(config);
    this.commandRouter = new ArchitectCommandRouter(config);
    this.voice = new ArchitectVoice(config.claudeApiKey);
    this.watcher = new ArchWatch();
    
    console.log('[Architect] Simplified architect initialized');
  }

  async start(): Promise<void> {
    this.discord.onMessage(async (message) => {
      const response = await this.processMessage(
        message.content, 
        message.author.id, 
        message.id
      );
      await this.discord.sendMessage(response);
    });

    await this.discord.start();
    console.log('[Architect] 🏗️ Architect online - simplified mode');
  }

  private async processMessage(
    input: string,
    userId: string, 
    messageId: string
  ): Promise<string> {
    
    console.log(`[Architect] Processing: "${input}"`);
    
    try {
      // Route through command system
      const response = await this.commandRouter.routeCommand(input, userId, messageId);
      
      // Log the architectural decision
      await this.watcher.logArchitecturalDecision(
        'system-interaction',
        input,
        response,
        'low'
      );
      
      return response;
      
    } catch (error) {
      console.error('[Architect] Error:', error);
      return await this.voice.formatResponse("System error occurred. Please try again or use /help for commands.", { type: 'error' });
    }
  }
}
