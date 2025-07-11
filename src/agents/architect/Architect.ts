import { ArchitectDiscord } from './communication/ArchitectDiscord.js';
import { UniversalAnalyzer } from './core/UniversalAnalyzer.js';
import { ArchitectOrchestrator } from './core/ArchitectOrchestrator.js';
import { CodeAnalyzer } from './intelligence/CodeAnalyzer.js';
import { CodeModifier } from './operations/CodeModifier.js';
import { AgentBuilder } from './operations/AgentBuilder.js';
import { SystemRefiner } from './operations/SystemRefiner.js';
import { ArchitectVoice } from './communication/ArchitectVoice.js';
import { ArchWatch } from '../watcher/archwatch/ArchWatch.js';
import { ArchitectConfig, ArchitecturalRequest } from './types/index.js';

export class Architect {
  private discord: ArchitectDiscord;
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
    this.analyzer = new UniversalAnalyzer(config.claudeApiKey);
    this.orchestrator = new ArchitectOrchestrator(config);
    this.codeAnalyzer = new CodeAnalyzer(config.claudeApiKey);
    this.modifier = new CodeModifier(config.claudeApiKey);
    this.builder = new AgentBuilder(config.claudeApiKey, config.discordToken);
    this.refiner = new SystemRefiner(config.claudeApiKey);
    this.voice = new ArchitectVoice(config.claudeApiKey);
    this.watcher = new ArchWatch();
    
    console.log('[Architect] Internal systems architect initialized');
  }

  async start(): Promise<void> {
    this.discord.onMessage(async (message) => {
      const response = await this.processArchitecturalRequest(
        message.content, 
        message.author.id, 
        message.id
      );
      await this.discord.sendMessage(response);
    });

    await this.discord.start();
    console.log('[Architect] 🏗️ Internal Architect online - ready to build');
  }

  private async processArchitecturalRequest(
    input: string,
    userId: string, 
    messageId: string
  ): Promise<string> {
    
    console.log(`[Architect] Processing: "${input}"`);
    
    try {
      // Analyze the architectural request
      const request = await this.analyzer.analyzeArchitecturalRequest(input, userId);
      
      // Route to appropriate handler
      const response = await this.orchestrator.executeArchitecturalWork(request);
      
      // Log the architectural decision
      await this.watcher.logArchitecturalDecision(
        request.type,
        input,
        response,
        request.riskLevel
      );
      
      return response;
      
    } catch (error) {
      console.error('[Architect] Error:', error);
      return await this.voice.formatResponse("System modification failed. Reviewing approach.", { type: 'error' });
    }
  }
}
