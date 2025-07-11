import { ArchitectDiscord } from './communication/ArchitectDiscord.js';
import { UniversalAnalyzer } from './core/UniversalAnalyzer.js';
import { ArchitectOrchestrator } from './core/ArchitectOrchestrator.js';
import { ArchWatch } from '../watcher/archwatch/ArchWatch.js';
import { ArchitectConfig } from './types/index.js';

export class Architect {
  private discord: ArchitectDiscord;
  private analyzer: UniversalAnalyzer;
  private orchestrator: ArchitectOrchestrator;
  private watcher: ArchWatch;

  constructor(config: ArchitectConfig) {
    this.discord = new ArchitectDiscord(config);
    this.analyzer = new UniversalAnalyzer(config.claudeApiKey);
    this.watcher = new ArchWatch();
    
    // Pass discord interface to orchestrator for progress updates
    this.orchestrator = new ArchitectOrchestrator(config, this.discord);
    
    console.log('[Architect] Simplified architect initialized');
  }

  async start(): Promise<void> {
    this.discord.onMessage(async (message) => {
      const response = await this.processArchitecturalRequest(
        message.content, 
        message.author.id, 
        message.id
      );
      
      // Only send final response if it's not already sent via progress updates
      if (!response.includes('**Started**') && !response.includes('**Completed**')) {
        await this.discord.sendMessage(response);
      }
    });

    await this.discord.start();
    
    // Send startup notification
    await this.discord.sendMessage('🏗️ **Architect Online** - Ready for build requests');
    console.log('[Architect] 🏗️ Architect online - simplified mode');
  }

  private async processArchitecturalRequest(
    input: string,
    userId: string, 
    messageId: string
  ): Promise<string> {
    
    console.log(`[Architect] Processing: "${input}"`);
    
    try {
      // Quick undo handling
      if (input.toLowerCase().includes('undo last')) {
        const result = await this.orchestrator.undoLastModification();
        return result.success ? `✅ ${result.message}` : `❌ ${result.message}`;
      }
      
      // Analyze the request
      const request = await this.analyzer.analyzeArchitecturalRequest(input, userId);
      console.log(`[Architect] Classified as: ${request.type}`);
      
      // Execute the work (progress updates sent automatically)
      const response = await this.orchestrator.executeArchitecturalWork(request);
      
      // Log the decision
      await this.watcher.logArchitecturalDecision(
        request.type,
        input,
        response,
        request.riskLevel
      );
      
      return response;
      
    } catch (error) {
      console.error('[Architect] Error:', error);
      const errorMsg = `❌ **System Error**: ${error.message}`;
      await this.discord.sendMessage(errorMsg);
      return errorMsg;
    }
  }
}
