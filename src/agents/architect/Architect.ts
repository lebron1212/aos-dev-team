// src/agents/architect/Architect.ts
import { ArchitectDiscord } from './communication/ArchitectDiscord.js';
import { EnhancedUniversalAnalyzer } from './core/EnhancedUniversalAnalyzer.js';
import { CompleteArchitectOrchestrator } from './core/CompleteArchitectOrchestrator.js';
import { CodeAnalyzer } from './intelligence/CodeAnalyzer.js';
import { CodeModifier } from './operations/CodeModifier.js';
import { IntelligentAgentBuilder } from './operations/IntelligentAgentBuilder.js';
import { SystemRefiner } from './operations/SystemRefiner.js';
import { ArchitectVoice } from './communication/ArchitectVoice.js';
import { ArchWatch } from '../watcher/archwatch/ArchWatch.js';
import { ArchitectConfig, ArchitecturalRequest } from './types/index.js';

export class Architect {
  private discord: ArchitectDiscord;
  private analyzer: EnhancedUniversalAnalyzer;
  private orchestrator: CompleteArchitectOrchestrator;
  private codeAnalyzer: CodeAnalyzer;
  private modifier: CodeModifier;
  private builder: IntelligentAgentBuilder;
  private refiner: SystemRefiner;
  private voice: ArchitectVoice;
  private watcher: ArchWatch;

  constructor(config: ArchitectConfig) {
    this.discord = new ArchitectDiscord(config);
    this.analyzer = new EnhancedUniversalAnalyzer(config.claudeApiKey);
    this.orchestrator = new CompleteArchitectOrchestrator(config);
    this.codeAnalyzer = new CodeAnalyzer(config.claudeApiKey);
    this.modifier = new CodeModifier(config.claudeApiKey);
    this.builder = new IntelligentAgentBuilder(config.claudeApiKey);
    this.refiner = new SystemRefiner(config.claudeApiKey);
    this.voice = new ArchitectVoice(config.claudeApiKey);
    this.watcher = new ArchWatch();
    
    console.log('[Architect] 🧠 Intelligent systems architect initialized');
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
    console.log('[Architect] 🏗️ Intelligent Architect online - ready to build anything');
  }

  private async processArchitecturalRequest(
    input: string,
    userId: string, 
    messageId: string
  ): Promise<string> {
    
    console.log(`[Architect] 🎯 Processing: "${input}"`);
    
    try {
      // Use the new intelligent orchestrator that handles its own analysis
      const response = await this.orchestrator.executeArchitecturalWork(input, userId, {
        messageId,
        channel: 'architect',
        timestamp: new Date()
      });
      
      // Log the architectural decision with enhanced learning
      await this.watcher.logArchitecturalDecision(
        'intelligent-processing',
        input,
        response,
        'medium' // The system will assess risk intelligently
      );
      
      return response;
      
    } catch (error) {
      console.error('[Architect] Error:', error);
      return await this.voice.formatResponse(
        "I encountered an error but I'm learning from it to improve. Let me try a different approach.", 
        { type: 'error' }
      );
    }
  }

  async stop(): Promise<void> {
    console.log('[Architect] 🛑 Intelligent Architect shutting down...');
    await this.discord.stop();
    console.log('[Architect] ✅ Intelligent Architect stopped');
  }
}
