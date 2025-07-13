import { AgentSpec } from '../types/index.js';
import Anthropic from '@anthropic-ai/sdk';
import { promises as fs } from 'fs';
import { IntelligentAgentAnalyzer } from './IntelligentAgentAnalyzer.js';
import { PurposeDrivenAgentBuilder } from './PurposeDrivenAgentBuilder.js';
import { DiscordBotCreator } from './DiscordBotCreator.js';

interface AgentPurposeAnalysis {
  agentName: string;
  corePurpose: string;
  specificCapabilities: string[];
  interactionPatterns: string[];
  responseTypes: string[];
  dataNeeds: string[];
  integrationNeeds: string[];
  learningAspects: string[];
  clarifyingQuestions: string[];
  readyToBuild: boolean;
  confidence: number;
}

export class AgentBuilder {
  private claude: Anthropic;
  private intelligentAnalyzer: IntelligentAgentAnalyzer;
  private purposeBuilder: PurposeDrivenAgentBuilder;
  private discordCreator?: DiscordBotCreator;
  private pendingAnalyses: Map<string, AgentPurposeAnalysis> = new Map();

  constructor(claudeApiKey: string, discordToken?: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
    this.intelligentAnalyzer = new IntelligentAgentAnalyzer(claudeApiKey);
    this.purposeBuilder = new PurposeDrivenAgentBuilder(claudeApiKey, discordToken);
    
    if (discordToken) {
      this.discordCreator = new DiscordBotCreator(claudeApiKey, discordToken);
    }
    
    console.log('[AgentBuilder] Intelligent purpose-driven agent builder initialized');
  }

  /**
   * Main entry point for intelligent agent creation
   * Analyzes purpose, asks clarifying questions if needed, then builds
   */
  async createIntelligentAgent(request: string, userId: string = 'system'): Promise<any> {
    console.log(`[AgentBuilder] Creating intelligent agent from: "${request}"`);
    
    try {
      // Step 1: Analyze the agent's purpose
      const analysis = await this.intelligentAnalyzer.analyzeAgentPurpose(request);
      
      // Step 2: Check if we need clarification
      if (!analysis.readyToBuild && analysis.clarifyingQuestions.length > 0) {
        // Store analysis for follow-up
        this.pendingAnalyses.set(userId, analysis);
        
        return {
          needsClarification: true,
          agentName: analysis.agentName,
          purpose: analysis.corePurpose,
          questions: analysis.clarifyingQuestions,
          confidence: analysis.confidence,
          message: `I understand you want to create ${analysis.agentName} for ${analysis.corePurpose}. To build exactly what you need, I have a few questions:`,
          ready: false
        };
      }
      
      // Step 3: Build the purpose-driven agent
      return await this.buildFromAnalysis(analysis);
      
    } catch (error) {
      console.error('[AgentBuilder] Intelligent agent creation failed:', error);
      return {
        summary: `Failed to create intelligent agent: ${error.message}`,
        files: [],
        ready: false,
        error: error.message
      };
    }
  }

  /**
   * Handle answers to clarifying questions
   */
  async answerClarifyingQuestions(userId: string, answers: Record<string, string>): Promise<any> {
    const pendingAnalysis = this.pendingAnalyses.get(userId);
    
    if (!pendingAnalysis) {
      return {
        summary: 'No pending agent creation found. Please start a new agent creation request.',
        ready: false,
        error: 'No pending analysis'
      };
    }
    
    console.log(`[AgentBuilder] Processing clarifying answers for ${pendingAnalysis.agentName}`);
    
    try {
      // Refine analysis with answers
      const refinedAnalysis = await this.intelligentAnalyzer.refineAnalysisWithAnswers(
        pendingAnalysis.agentName,
        answers
      );
      
      // Clear pending analysis
      this.pendingAnalyses.delete(userId);
      
      // Build the agent with refined understanding
      return await this.buildFromAnalysis(refinedAnalysis);
      
    } catch (error) {
      console.error('[AgentBuilder] Failed to process clarifying answers:', error);
      return {
        summary: `Failed to process answers: ${error.message}`,
        ready: false,
        error: error.message
      };
    }
  }

  /**
   * Build agent from completed analysis
   */
  private async buildFromAnalysis(analysis: AgentPurposeAnalysis): Promise<any> {
    console.log(`[AgentBuilder] Building ${analysis.agentName} with purpose: ${analysis.corePurpose}`);
    
    try {
      // Build the purpose-driven agent
      const buildResult = await this.purposeBuilder.buildPurposeDrivenAgent(analysis);
      
      if (!buildResult.ready) {
        return buildResult;
      }
      
      // Add Discord integration if possible
      let discordResult = null;
      if (this.discordCreator) {
        try {
          discordResult = await this.createDiscordIntegration(analysis);
        } catch (discordError) {
          console.error('[AgentBuilder] Discord integration failed:', discordError);
          // Continue without Discord - agent can still function
        }
      }
      
      // Generate setup instructions
      const setupInstructions = this.generateSetupInstructions(analysis, discordResult);
      
      console.log(`[AgentBuilder] ✅ Successfully created ${analysis.agentName}!`);
      
      return {
        ...buildResult,
        discordIntegration: discordResult,
        setupInstructions,
        analysis: {
          purpose: analysis.corePurpose,
          capabilities: analysis.specificCapabilities,
          confidence: analysis.confidence
        }
      };
      
    } catch (error) {
      console.error(`[AgentBuilder] Failed to build ${analysis.agentName}:`, error);
      return {
        summary: `Failed to build ${analysis.agentName}: ${error.message}`,
        ready: false,
        error: error.message
      };
    }
  }

  /**
   * Create Discord integration for the agent
   */
  private async createDiscordIntegration(analysis: AgentPurposeAnalysis): Promise<any> {
    if (!this.discordCreator) {
      return null;
    }
    
    console.log(`[AgentBuilder] Creating Discord integration for ${analysis.agentName}...`);
    
    try {
      // Create Discord bot
      const botConfig = await this.discordCreator.createDiscordBot(
        analysis.agentName,
        `AI Agent for ${analysis.corePurpose}`
      );
      
      if (!botConfig) {
        return null;
      }
      
      // Try to create dedicated channels
      const guildId = process.env.DISCORD_GUILD_ID;
      let userChannelId = null;
      let agentChannelId = null;
      
      if (guildId) {
        try {
          userChannelId = await this.discordCreator.createChannelForAgent(
            guildId, 
            `${analysis.agentName.toLowerCase()}-users`
          );
          agentChannelId = await this.discordCreator.createChannelForAgent(
            guildId, 
            `${analysis.agentName.toLowerCase()}-agents`
          );
        } catch (channelError) {
          console.error('[AgentBuilder] Channel creation failed:', channelError);
        }
      }
      
      return {
        botCreated: true,
        botToken: botConfig.token.substring(0, 20) + '...', // Masked for security
        clientId: botConfig.clientId,
        inviteUrl: botConfig.inviteUrl,
        userChannelId,
        agentChannelId
      };
      
    } catch (error) {
      console.error('[AgentBuilder] Discord integration failed:', error);
      return null;
    }
  }

  /**
   * Generate comprehensive setup instructions
   */
  private generateSetupInstructions(analysis: AgentPurposeAnalysis, discordResult: any): string {
    const envVars = [
      `${analysis.agentName.toUpperCase()}_DISCORD_TOKEN=your_discord_token`,
      `${analysis.agentName.toUpperCase()}_USER_CHANNEL_ID=user_channel_id`,
      `${analysis.agentName.toUpperCase()}_AGENT_CHANNEL_ID=agent_channel_id`,
      'CLAUDE_API_KEY=your_claude_api_key'
    ];

    let discordSetupSection = '';
    if (discordResult?.botCreated) {
      discordSetupSection = `
## 🤖 Discord Integration

✅ **Discord bot created successfully!**

- **Bot Name:** ${analysis.agentName}
- **Client ID:** ${discordResult.clientId}
- **Invite URL:** ${discordResult.inviteUrl}
${discordResult.userChannelId ? `- **User Channel:** ${discordResult.userChannelId}` : ''}
${discordResult.agentChannelId ? `- **Agent Channel:** ${discordResult.agentChannelId}` : ''}

**Next Steps:**
1. Use the invite URL to add ${analysis.agentName} to your Discord server
2. Set the environment variables with the channel IDs
3. Restart the system`;
    } else {
      discordSetupSection = `
## ⚠️ Discord Setup Required

Create a Discord application and bot:
1. Go to https://discord.com/developers/applications
2. Create new application named "${analysis.agentName}"
3. Go to Bot section and create bot
4. Copy the token and set it in environment variables
5. Create channels for user and agent communication`;
    }

    return `# ${analysis.agentName} Setup Guide

## 🎯 Agent Purpose
**${analysis.corePurpose}**

## 🛠️ Capabilities
${analysis.specificCapabilities.map(cap => `- ${cap}`).join('\n')}

## 📋 Environment Variables
Add these to your environment:
\`\`\`
${envVars.join('\n')}
\`\`\`
${discordSetupSection}

## 🏗️ Architecture
${analysis.agentName} uses the proven Commander architecture with purpose-specific adaptations:

- **Core:** Main agent, PurposeRouter, CapabilityHandler
- **Communication:** Discord integration, Voice system  
- **Intelligence:** Purpose-specific intent analysis, Learning system
- **Workflow:** Work management for ${analysis.corePurpose}

## 🚀 Usage
1. Set environment variables
2. Restart system: \`npm start\`
3. ${analysis.agentName} will appear in Discord
4. Test with: "Hello ${analysis.agentName}" or "${analysis.specificCapabilities[0]}"

## 📚 Learning & Improvement
${analysis.agentName} learns from interactions to improve at:
${analysis.learningAspects.map(aspect => `- ${aspect}`).join('\n')}

The more you use ${analysis.agentName}, the better it gets at ${analysis.corePurpose}!`;
  }

  // Legacy compatibility methods
  async buildCompleteAgent(spec: AgentSpec): Promise<any> {
    console.log(`[AgentBuilder] Legacy buildCompleteAgent called, converting to intelligent creation`);
    
    const request = `Create ${spec.name} for ${spec.purpose}`;
    return await this.createIntelligentAgent(request);
  }

  async generateAgent(spec: AgentSpec): Promise<any> {
    console.log(`[AgentBuilder] Legacy generateAgent called, converting to intelligent creation`);
    
    const request = `Create ${spec.name} for ${spec.purpose}`;
    return await this.createIntelligentAgent(request);
  }

  async parseAgentRequirements(request: string): Promise<AgentSpec> {
    console.log(`[AgentBuilder] Legacy parseAgentRequirements called`);
    
    // Use intelligent analyzer to create a basic spec
    const analysis = await this.intelligentAnalyzer.analyzeAgentPurpose(request);
    
    return {
      name: analysis.agentName,
      purpose: analysis.corePurpose,
      capabilities: analysis.specificCapabilities,
      dependencies: ['@anthropic-ai/sdk', 'discord.js'],
      structure: {
        core: ['Agent.ts', 'PurposeRouter.ts', 'CapabilityHandler.ts'],
        intelligence: ['Intelligence.ts', 'LearningSystem.ts'],
        communication: ['DiscordInterface.ts', 'VoiceSystem.ts']
      },
      discordIntegration: true,
      voicePersonality: 'Helpful and focused on specific purpose',
      createWatcher: false,
      watcherPurpose: 'Using built-in learning system instead'
    };
  }

  // Utility methods
  getPendingAnalyses(): string[] {
    return Array.from(this.pendingAnalyses.keys());
  }

  clearPendingAnalysis(userId: string): boolean {
    return this.pendingAnalyses.delete(userId);
  }

  getAnalysisHistory(): any[] {
    return this.intelligentAnalyzer.getAnalysisHistory();
  }
}
