import { promises as fs } from 'fs';
import { AgentSpec } from '../types/index.js';

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

export class PurposeDrivenAgentBuilder {
  private claudeApiKey: string;
  private discordToken?: string;

  constructor(claudeApiKey: string, discordToken?: string) {
    this.claudeApiKey = claudeApiKey;
    this.discordToken = discordToken;
  }

  async buildPurposeDrivenAgent(analysis: AgentPurposeAnalysis): Promise<any> {
    console.log(`[PurposeDrivenAgentBuilder] Building ${analysis.agentName} for: ${analysis.corePurpose}`);
    
    const agentPath = `src/agents/${analysis.agentName.toLowerCase()}`;
    const createdFiles: string[] = [];
    
    try {
      // 1. Create Commander-style folder structure
      await this.createStandardDirectories(agentPath);
      
      // 2. Generate purpose-specific core files
      const coreFiles = await this.generatePurposeSpecificCore(analysis, agentPath);
      createdFiles.push(...coreFiles);
      
      // 3. Generate communication layer
      const commFiles = await this.generateCommunicationLayer(analysis, agentPath);
      createdFiles.push(...commFiles);
      
      // 4. Generate intelligence layer
      const intelligenceFiles = await this.generateIntelligenceLayer(analysis, agentPath);
      createdFiles.push(...intelligenceFiles);
      
      // 5. Generate workflow layer
      const workflowFiles = await this.generateWorkflowLayer(analysis, agentPath);
      createdFiles.push(...workflowFiles);
      
      // 6. Generate types and index
      const supportFiles = await this.generateSupportFiles(analysis, agentPath);
      createdFiles.push(...supportFiles);
      
      // 7. Update main index.ts
      await this.updateMainIndex(analysis);
      
      console.log(`[PurposeDrivenAgentBuilder] ✅ Created ${analysis.agentName} with ${createdFiles.length} files`);
      
      return {
        summary: `${analysis.agentName} created for ${analysis.corePurpose}`,
        files: createdFiles,
        ready: true,
        agentName: analysis.agentName,
        agentPath,
        architecture: 'Purpose-driven with Commander structure',
        purpose: analysis.corePurpose,
        capabilities: analysis.specificCapabilities,
        environmentVars: [
          `${analysis.agentName.toUpperCase()}_DISCORD_TOKEN`,
          `${analysis.agentName.toUpperCase()}_USER_CHANNEL_ID`,
          `${analysis.agentName.toUpperCase()}_AGENT_CHANNEL_ID`,
          'CLAUDE_API_KEY'
        ]
      };
      
    } catch (error) {
      console.error(`[PurposeDrivenAgentBuilder] Failed to create ${analysis.agentName}:`, error);
      return {
        summary: `Failed to create ${analysis.agentName}: ${error.message}`,
        files: createdFiles,
        ready: false,
        error: error.message
      };
    }
  }

  private async createStandardDirectories(basePath: string): Promise<void> {
    const dirs = [
      basePath,
      `${basePath}/core`,
      `${basePath}/communication`,
      `${basePath}/intelligence`,
      `${basePath}/workflow`,
      `${basePath}/types`
    ];
    
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private async generatePurposeSpecificCore(analysis: AgentPurposeAnalysis, basePath: string): Promise<string[]> {
    const files: string[] = [];
    
    // Main agent file - purpose-specific
    const mainFile = `${basePath}/${analysis.agentName}.ts`;
    const mainContent = this.generateMainAgentFile(analysis);
    await fs.writeFile(mainFile, mainContent);
    files.push(mainFile);
    
    // Purpose-specific router
    const routerFile = `${basePath}/core/PurposeRouter.ts`;
    const routerContent = this.generatePurposeRouter(analysis);
    await fs.writeFile(routerFile, routerContent);
    files.push(routerFile);
    
    // Capability handler
    const capabilityFile = `${basePath}/core/CapabilityHandler.ts`;
    const capabilityContent = this.generateCapabilityHandler(analysis);
    await fs.writeFile(capabilityFile, capabilityContent);
    files.push(capabilityFile);
    
    return files;
  }

  private generateMainAgentFile(analysis: AgentPurposeAnalysis): string {
    return `import { DiscordInterface } from './communication/DiscordInterface.js';
import { VoiceSystem } from './communication/VoiceSystem.js';
import { PurposeRouter } from './core/PurposeRouter.js';
import { ${analysis.agentName}Intelligence } from './intelligence/${analysis.agentName}Intelligence.js';
import { LearningSystem } from './intelligence/LearningSystem.js';
import { WorkManager } from './workflow/WorkManager.js';
import { ${analysis.agentName}Config } from './types/index.js';

export class ${analysis.agentName} {
  private discordInterface: DiscordInterface;
  private voiceSystem: VoiceSystem;
  private router: PurposeRouter;
  private intelligence: ${analysis.agentName}Intelligence;
  private learningSystem: LearningSystem;
  private workManager: WorkManager;
  private config: ${analysis.agentName}Config;

  constructor(config: ${analysis.agentName}Config) {
    this.config = config;
    
    // Initialize systems
    this.discordInterface = new DiscordInterface(config);
    this.voiceSystem = new VoiceSystem(config.claudeApiKey, "${analysis.agentName}");
    this.intelligence = new ${analysis.agentName}Intelligence(config.claudeApiKey);
    this.learningSystem = new LearningSystem(config.claudeApiKey);
    this.workManager = new WorkManager();
    this.router = new PurposeRouter(
      this.intelligence,
      this.learningSystem,
      this.workManager,
      this.voiceSystem
    );
    
    console.log('[${analysis.agentName}] Purpose: ${analysis.corePurpose}');
  }

  async start(): Promise<void> {
    console.log('[${analysis.agentName}] Starting - ${analysis.corePurpose}');
    
    // Set up Discord message handling
    this.discordInterface.onMessage(async (message) => {
      try {
        await this.handleUserInteraction(message.content, message.author.id, message.id);
      } catch (error) {
        console.error('[${analysis.agentName}] Error handling message:', error);
        await this.discordInterface.sendMessage('I encountered an error. Please try again.');
      }
    });

    // Start Discord interface
    await this.discordInterface.start();
    
    console.log('[${analysis.agentName}] 🤖 ${analysis.agentName} online - Ready for ${analysis.corePurpose}');
  }

  private async handleUserInteraction(input: string, userId: string, messageId: string): Promise<void> {
    console.log(\`[${analysis.agentName}] Processing: "\${input}"\`);
    
    try {
      // Route through purpose-specific router
      const response = await this.router.routePurposeRequest(input, userId, messageId);
      
      // Send response back to user
      await this.discordInterface.sendMessage(response);
      
      // Learn from this interaction
      await this.learningSystem.logInteraction(input, response, 'success', userId);
      
      // Track for feedback
      await this.discordInterface.trackMessage(input, response, messageId);
      
    } catch (error) {
      console.error(\`[${analysis.agentName}] Request processing failed:\`, error);
      const errorResponse = await this.voiceSystem.formatResponse(
        'I had trouble with that request. Could you try rephrasing it?',
        { type: 'error' }
      );
      await this.discordInterface.sendMessage(errorResponse);
      await this.learningSystem.logInteraction(input, errorResponse, 'error', userId);
    }
  }

  // Health check methods
  getStatus(): { ready: boolean; purpose: string; capabilities: string[] } {
    return {
      ready: this.discordInterface.isReady,
      purpose: '${analysis.corePurpose}',
      capabilities: ${JSON.stringify(analysis.specificCapabilities)}
    };
  }
}`;
  }

  private generatePurposeRouter(analysis: AgentPurposeAnalysis): string {
    const capabilityMethods = analysis.specificCapabilities.map(cap => {
      const methodName = cap.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      return `handle${methodName.charAt(0).toUpperCase() + methodName.slice(1)}`;
    });

    return `import { ${analysis.agentName}Intelligence } from '../intelligence/${analysis.agentName}Intelligence.js';
import { LearningSystem } from '../intelligence/LearningSystem.js';
import { WorkManager } from '../workflow/WorkManager.js';
import { VoiceSystem } from '../communication/VoiceSystem.js';
import { CapabilityHandler } from './CapabilityHandler.js';

export class PurposeRouter {
  private intelligence: ${analysis.agentName}Intelligence;
  private learningSystem: LearningSystem;
  private workManager: WorkManager;
  private voiceSystem: VoiceSystem;
  private capabilityHandler: CapabilityHandler;

  constructor(
    intelligence: ${analysis.agentName}Intelligence,
    learningSystem: LearningSystem,
    workManager: WorkManager,
    voiceSystem: VoiceSystem
  ) {
    this.intelligence = intelligence;
    this.learningSystem = learningSystem;
    this.workManager = workManager;
    this.voiceSystem = voiceSystem;
    this.capabilityHandler = new CapabilityHandler();
    
    console.log('[${analysis.agentName}Router] Purpose router initialized');
  }

  async routePurposeRequest(input: string, userId: string, messageId: string): Promise<string> {
    console.log(\`[${analysis.agentName}Router] Routing purpose-specific request: "\${input}"\`);
    
    try {
      // Analyze the intent specific to this agent's purpose
      const intent = await this.intelligence.analyzePurposeIntent(input);
      
      // Route based on specific capabilities
      const result = await this.routeToCapability(intent, input, userId);
      
      // Format response using voice system
      return await this.voiceSystem.formatResponse(result.message, {
        type: result.type || 'response',
        capability: intent.capability,
        confidence: intent.confidence
      });
      
    } catch (error) {
      console.error(\`[${analysis.agentName}Router] Routing failed:\`, error);
      return await this.voiceSystem.formatResponse(
        'I\\'m having trouble understanding that request. Could you try rephrasing it?',
        { type: 'error' }
      );
    }
  }

  private async routeToCapability(intent: any, input: string, userId: string): Promise<{ message: string; type: string }> {
    const capability = intent.capability || 'general';
    
    console.log(\`[${analysis.agentName}Router] Routing to capability: \${capability}\`);
    
    // Route to specific capability handlers
    switch (capability) {
${analysis.specificCapabilities.map(cap => {
  const methodName = cap.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return `      case '${cap.toLowerCase()}':
        return await this.capabilityHandler.${methodName}(input, intent, userId);`;
}).join('\n')}
      
      case 'help':
        return await this.handleHelpRequest();
      
      case 'status':
        return await this.handleStatusRequest();
      
      default:
        return await this.handleGeneralRequest(input, intent, userId);
    }
  }

  private async handleHelpRequest(): Promise<{ message: string; type: string }> {
    const capabilities = ${JSON.stringify(analysis.specificCapabilities)};
    return {
      message: \`I'm ${analysis.agentName}, here for ${analysis.corePurpose}.\\n\\nI can help with:\\n\${capabilities.map(c => \`• \${c}\`).join('\\n')}\\n\\nJust tell me what you need!\`,
      type: 'help'
    };
  }

  private async handleStatusRequest(): Promise<{ message: string; type: string }> {
    return {
      message: \`✅ ${analysis.agentName} is online and ready for ${analysis.corePurpose}\`,
      type: 'status'
    };
  }

  private async handleGeneralRequest(input: string, intent: any, userId: string): Promise<{ message: string; type: string }> {
    // Handle general requests that don't match specific capabilities
    return {
      message: \`I understand you want help with "\${input}". As ${analysis.agentName}, I'm specialized in ${analysis.corePurpose}. Could you be more specific about what you need?\`,
      type: 'clarification'
    };
  }
}`;
  }

  private generateCapabilityHandler(analysis: AgentPurposeAnalysis): string {
    const capabilityMethods = analysis.specificCapabilities.map(cap => {
      const methodName = cap.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      
      return `  async ${methodName}(input: string, intent: any, userId: string): Promise<{ message: string; type: string }> {
    console.log(\`[${analysis.agentName}Capabilities] Handling ${cap}\`);
    
    // ${analysis.agentName}-specific logic for: ${cap}
    try {
      // TODO: Implement specific logic for ${cap}
      return {
        message: \`I'm handling your request for ${cap}. Input: "\${input}"\`,
        type: 'working'
      };
    } catch (error) {
      console.error(\`[${analysis.agentName}Capabilities] ${cap} failed:\`, error);
      return {
        message: \`I had trouble with ${cap}. Please try again.\`,
        type: 'error'
      };
    }
  }`;
    });

    return `export class CapabilityHandler {
  constructor() {
    console.log('[${analysis.agentName}Capabilities] Capability handler initialized');
  }

${capabilityMethods.join('\n\n')}
}`;
  }

  private async generateCommunicationLayer(analysis: AgentPurposeAnalysis, basePath: string): Promise<string[]> {
    const files: string[] = [];
    
    // Discord interface - standard
    const discordFile = `${basePath}/communication/DiscordInterface.ts`;
    const discordContent = this.generateDiscordInterface(analysis);
    await fs.writeFile(discordFile, discordContent);
    files.push(discordFile);
    
    // Voice system - purpose-specific
    const voiceFile = `${basePath}/communication/VoiceSystem.ts`;
    const voiceContent = this.generateVoiceSystem(analysis);
    await fs.writeFile(voiceFile, voiceContent);
    files.push(voiceFile);
    
    return files;
  }

  private generateDiscordInterface(analysis: AgentPurposeAnalysis): string {
    return `import { Client, GatewayIntentBits, TextChannel, Message } from 'discord.js';
import { ${analysis.agentName}Config } from '../types/index.js';

export class DiscordInterface {
  private client: Client;
  private userChannel: TextChannel | null = null;
  private agentChannel: TextChannel | null = null;
  private config: ${analysis.agentName}Config;
  private messageHandlers: Array<(message: Message) => Promise<void>> = [];
  private messageContext: Map<string, {input: string, response: string}> = new Map();

  constructor(config: ${analysis.agentName}Config) {
    this.config = config;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
      ]
    });
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.once('ready', async () => {
      console.log(\`[${analysis.agentName}Discord] Connected as \${this.client.user?.tag}\`);
      this.userChannel = this.client.channels.cache.get(this.config.userChannelId) as TextChannel;
      this.agentChannel = this.client.channels.cache.get(this.config.agentChannelId) as TextChannel;
      
      this.client.user?.setPresence({
        activities: [{ name: '${analysis.corePurpose}', type: 3 }],
        status: 'online'
      });
    });

    this.client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      if (message.channelId !== this.config.userChannelId) return;
      
      for (const handler of this.messageHandlers) {
        await handler(message);
      }
    });
  }

  onMessage(handler: (message: Message) => Promise<void>): void {
    this.messageHandlers.push(handler);
  }

  async sendMessage(content: string): Promise<Message | null> {
    if (!this.userChannel) return null;
    
    try {
      return await this.userChannel.send(content);
    } catch (error) {
      console.error('[${analysis.agentName}Discord] Failed to send message:', error);
      return null;
    }
  }

  async trackMessage(input: string, response: string, messageId: string): Promise<void> {
    this.messageContext.set(messageId, { input, response });
    
    // Keep only last 20 messages
    if (this.messageContext.size > 20) {
      const firstKey = this.messageContext.keys().next().value;
      this.messageContext.delete(firstKey);
    }
  }

  async start(): Promise<void> {
    await this.client.login(this.config.${analysis.agentName.toLowerCase()}Token);
  }

  get isReady(): boolean {
    return this.client.isReady();
  }
}`;
  }

  private generateVoiceSystem(analysis: AgentPurposeAnalysis): string {
    return `import Anthropic from '@anthropic-ai/sdk';

export class VoiceSystem {
  private claude: Anthropic;
  private agentName: string;
  private totalTokens = 0;
  private totalCost = 0;

  constructor(claudeApiKey: string, agentName: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
    this.agentName = agentName;
  }

  async formatResponse(content: string, context: any = {}): Promise<string> {
    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: \`You are \${this.agentName}, specialized in ${analysis.corePurpose}.

Your purpose: ${analysis.corePurpose}
Your capabilities: ${analysis.specificCapabilities.join(', ')}

Personality: Helpful, focused on your specific purpose, and eager to assist with ${analysis.corePurpose}.

Context: \${JSON.stringify(context)}

Format this response naturally and helpfully: \${content}

Keep it:
- Focused on your purpose
- Clear and actionable  
- Encouraging
- Professional but friendly\`
        }]
      });

      // Track usage
      if (response.usage) {
        this.totalTokens += response.usage.input_tokens + response.usage.output_tokens;
        this.totalCost += (response.usage.input_tokens * 0.00025 + response.usage.output_tokens * 0.00125) / 1000;
      }

      const formatted = response.content[0];
      if (formatted.type === 'text') {
        return formatted.text;
      }
      
      return content;
      
    } catch (error) {
      console.error('[\${this.agentName}Voice] Formatting failed:', error);
      return this.fallbackFormat(content, context);
    }
  }

  private fallbackFormat(content: string, context: any): string {
    const prefix = context.type === 'error' ? '❌' : 
                  context.type === 'working' ? '⚡' : 
                  context.type === 'help' ? 'ℹ️' : '✅';
    return \`\${prefix} \${content}\`;
  }

  getUsageStats(): { tokens: number; cost: number } {
    return {
      tokens: this.totalTokens,
      cost: this.totalCost
    };
  }
}`;
  }

  private async generateIntelligenceLayer(analysis: AgentPurposeAnalysis, basePath: string): Promise<string[]> {
    const files: string[] = [];
    
    // Purpose-specific intelligence
    const intelligenceFile = `${basePath}/intelligence/${analysis.agentName}Intelligence.ts`;
    const intelligenceContent = this.generatePurposeIntelligence(analysis);
    await fs.writeFile(intelligenceFile, intelligenceContent);
    files.push(intelligenceFile);
    
    // Learning system
    const learningFile = `${basePath}/intelligence/LearningSystem.ts`;
    const learningContent = this.generateLearningSystem(analysis);
    await fs.writeFile(learningFile, learningContent);
    files.push(learningFile);
    
    return files;
  }

  private generatePurposeIntelligence(analysis: AgentPurposeAnalysis): string {
    return `import Anthropic from '@anthropic-ai/sdk';

export class ${analysis.agentName}Intelligence {
  private claude: Anthropic;
  
  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
  }

  async analyzePurposeIntent(input: string): Promise<any> {
    console.log('[${analysis.agentName}Intelligence] Analyzing purpose-specific intent');
    
    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: \`You are ${analysis.agentName}, specialized in ${analysis.corePurpose}.

Your specific capabilities:
${analysis.specificCapabilities.map(cap => `- ${cap}`).join('\n')}

Analyze this user input and determine which of your specific capabilities they need:

USER INPUT: "\${input}"

Respond with JSON:
{
  "capability": "which specific capability from the list above",
  "confidence": 0.0-1.0,
  "parameters": {
    "extracted_info": "relevant details from input"
  },
  "reasoning": "why you chose this capability"
}

If the input doesn't match any specific capability, use "general" as the capability.\`
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        try {
          return JSON.parse(content.text);
        } catch (parseError) {
          return this.fallbackIntent(input);
        }
      }
    } catch (error) {
      console.error('[${analysis.agentName}Intelligence] Analysis failed:', error);
    }

    return this.fallbackIntent(input);
  }

  private fallbackIntent(input: string): any {
    return {
      capability: 'general',
      confidence: 0.5,
      parameters: { extracted_info: input },
      reasoning: 'Fallback analysis'
    };
  }
}`;
  }

  private generateLearningSystem(analysis: AgentPurposeAnalysis): string {
    return `export class LearningSystem {
  private interactions: any[] = [];
  private patterns: Map<string, number> = new Map();
  private improvements: string[] = [];

  constructor(claudeApiKey: string) {
    console.log('[${analysis.agentName}Learning] Learning system for ${analysis.corePurpose} initialized');
  }

  async logInteraction(input: string, output: string, result: 'success' | 'error', userId: string): Promise<void> {
    const interaction = {
      timestamp: new Date().toISOString(),
      input,
      output,
      result,
      userId,
      purpose: '${analysis.corePurpose}'
    };

    this.interactions.push(interaction);
    
    // Track patterns for this specific purpose
    const pattern = this.extractPurposePattern(input);
    const current = this.patterns.get(pattern) || 0;
    this.patterns.set(pattern, current + 1);

    console.log(\`[${analysis.agentName}Learning] Logged \${result} interaction for pattern: \${pattern}\`);

    // Keep only recent interactions
    if (this.interactions.length > 1000) {
      this.interactions = this.interactions.slice(-1000);
    }
  }

  private extractPurposePattern(input: string): string {
    // Extract patterns relevant to this agent's purpose
    const purposeKeywords = ${JSON.stringify(analysis.specificCapabilities)};
    const words = input.toLowerCase().split(' ');
    
    // Find purpose-related words
    const relevantWords = words.filter(word => 
      purposeKeywords.some(keyword => 
        keyword.toLowerCase().includes(word) || word.includes(keyword.toLowerCase())
      )
    );
    
    return relevantWords.length > 0 ? relevantWords.join('-') : words.slice(0, 2).join('-');
  }

  getTopPatterns(limit: number = 10): Array<{pattern: string, count: number}> {
    return Array.from(this.patterns.entries())
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  getLearningStats(): any {
    return {
      totalInteractions: this.interactions.length,
      uniquePatterns: this.patterns.size,
      successRate: this.calculateSuccessRate(),
      topPatterns: this.getTopPatterns(5),
      purpose: '${analysis.corePurpose}'
    };
  }

  private calculateSuccessRate(): number {
    if (this.interactions.length === 0) return 1.0;
    
    const successful = this.interactions.filter(i => i.result === 'success').length;
    return successful / this.interactions.length;
  }
}`;
  }

  private async generateWorkflowLayer(analysis: AgentPurposeAnalysis, basePath: string): Promise<string[]> {
    const files: string[] = [];
    
    // Work manager
    const workManagerFile = `${basePath}/workflow/WorkManager.ts`;
    const workManagerContent = this.generateWorkManager(analysis);
    await fs.writeFile(workManagerFile, workManagerContent);
    files.push(workManagerFile);
    
    return files;
  }

  private generateWorkManager(analysis: AgentPurposeAnalysis): string {
    return `export class WorkManager {
  private activeWork: Map<string, any> = new Map();
  private workHistory: any[] = [];

  constructor() {
    console.log('[${analysis.agentName}Work] Work manager for ${analysis.corePurpose} initialized');
  }

  async createWork(description: string, type: string, userId: string): Promise<string> {
    const workId = \`work_\${Date.now()}\`;
    const workItem = {
      id: workId,
      description,
      type,
      userId,
      status: 'started',
      created: new Date(),
      purpose: '${analysis.corePurpose}',
      capability: type
    };

    this.activeWork.set(workId, workItem);
    console.log(\`[${analysis.agentName}Work] Created work item: \${workId}\`);
    
    return workId;
  }

  async completeWork(workId: string, result: any): Promise<void> {
    const workItem = this.activeWork.get(workId);
    if (workItem) {
      workItem.status = 'completed';
      workItem.completed = new Date();
      workItem.result = result;
      
      this.workHistory.push(workItem);
      this.activeWork.delete(workId);
      
      console.log(\`[${analysis.agentName}Work] Completed work item: \${workId}\`);
    }
  }

  getActiveWork(): any[] {
    return Array.from(this.activeWork.values());
  }

  getWorkHistory(): any[] {
    return this.workHistory.slice(-50); // Last 50 items
  }
}`;
  }

  private async generateSupportFiles(analysis: AgentPurposeAnalysis, basePath: string): Promise<string[]> {
    const files: string[] = [];
    
    // Types
    const typesFile = `${basePath}/types/index.ts`;
    const typesContent = this.generateTypes(analysis);
    await fs.writeFile(typesFile, typesContent);
    files.push(typesFile);
    
    // Index
    const indexFile = `${basePath}/index.ts`;
    const indexContent = this.generateIndex(analysis);
    await fs.writeFile(indexFile, indexContent);
    files.push(indexFile);
    
    return files;
  }

  private generateTypes(analysis: AgentPurposeAnalysis): string {
    return `// ${analysis.agentName} Types - Purpose: ${analysis.corePurpose}

export interface ${analysis.agentName}Config {
  ${analysis.agentName.toLowerCase()}Token: string;
  userChannelId: string;
  agentChannelId: string;
  claudeApiKey: string;
}

export interface PurposeIntent {
  capability: string;
  confidence: number;
  parameters: Record<string, any>;
  reasoning: string;
}

export interface WorkItem {
  id: string;
  description: string;
  type: string;
  userId: string;
  status: 'started' | 'completed' | 'failed';
  created: Date;
  completed?: Date;
  purpose: string;
  capability: string;
  result?: any;
}

export interface LearningInteraction {
  timestamp: string;
  input: string;
  output: string;
  result: 'success' | 'error';
  userId: string;
  purpose: string;
}`;
  }

  private generateIndex(analysis: AgentPurposeAnalysis): string {
    return `// ${analysis.agentName} - ${analysis.corePurpose}
export { ${analysis.agentName} } from './${analysis.agentName}.js';
export { PurposeRouter } from './core/PurposeRouter.js';
export { CapabilityHandler } from './core/CapabilityHandler.js';
export { ${analysis.agentName}Intelligence } from './intelligence/${analysis.agentName}Intelligence.js';
export { LearningSystem } from './intelligence/LearningSystem.js';
export { WorkManager } from './workflow/WorkManager.js';
export { DiscordInterface } from './communication/DiscordInterface.js';
export { VoiceSystem } from './communication/VoiceSystem.js';

// Export all types
export * from './types/index.js';

// Quick start function
export async function start${analysis.agentName}(): Promise<void> {
  const { ${analysis.agentName} } from await import('./${analysis.agentName}.js');
  
  const config = {
    ${analysis.agentName.toLowerCase()}Token: process.env.${analysis.agentName.toUpperCase()}_DISCORD_TOKEN!,
    userChannelId: process.env.${analysis.agentName.toUpperCase()}_USER_CHANNEL_ID!,
    agentChannelId: process.env.${analysis.agentName.toUpperCase()}_AGENT_CHANNEL_ID!,
    claudeApiKey: process.env.CLAUDE_API_KEY!
  };
  
  const ${analysis.agentName.toLowerCase()} = new ${analysis.agentName}(config);
  await ${analysis.agentName.toLowerCase()}.start();
}`;
  }

  private async updateMainIndex(analysis: AgentPurposeAnalysis): Promise<void> {
    try {
      const indexPath = 'src/index.ts';
      const currentContent = await fs.readFile(indexPath, 'utf8');
      
      const importLine = `import { ${analysis.agentName} } from './agents/${analysis.agentName.toLowerCase()}/${analysis.agentName}.js';`;
      
      if (currentContent.includes(importLine)) {
        console.log(`[PurposeDrivenAgentBuilder] ${analysis.agentName} already integrated in index.ts`);
        return;
      }
      
      const lines = currentContent.split('\n');
      const lastImportIndex = lines.map((line, index) => line.startsWith('import') ? index : -1)
        .filter(index => index !== -1)
        .pop() ?? -1;
      
      lines.splice(lastImportIndex + 1, 0, importLine);
      
      const startFunctionName = `start${analysis.agentName}`;
      const startFunction = `
async function ${startFunctionName}() {
  const ${analysis.agentName.toLowerCase()}Config = {
    ${analysis.agentName.toLowerCase()}Token: process.env.${analysis.agentName.toUpperCase()}_DISCORD_TOKEN!,
    userChannelId: process.env.${analysis.agentName.toUpperCase()}_USER_CHANNEL_ID!,
    agentChannelId: process.env.${analysis.agentName.toUpperCase()}_AGENT_CHANNEL_ID!,
    claudeApiKey: process.env.CLAUDE_API_KEY!
  };

  if (${analysis.agentName.toLowerCase()}Config.${analysis.agentName.toLowerCase()}Token && ${analysis.agentName.toLowerCase()}Config.userChannelId) {
    const ${analysis.agentName.toLowerCase()} = new ${analysis.agentName}(${analysis.agentName.toLowerCase()}Config);
    await ${analysis.agentName.toLowerCase()}.start();
  } else {
    console.log('[${analysis.agentName}] Environment variables not set, skipping startup');
  }
}`;
      
      const promiseAllIndex = lines.findIndex(line => line.includes('Promise.all'));
      if (promiseAllIndex !== -1) {
        lines.splice(promiseAllIndex, 0, startFunction);
        
        const promiseAllLine = lines[promiseAllIndex + startFunction.split('\n').length];
        if (promiseAllLine.includes('startCommander()')) {
          lines[promiseAllIndex + startFunction.split('\n').length] = promiseAllLine.replace(
            '])',
            `,\n  ${startFunctionName}()\n])`
          );
        }
      }
      
      await fs.writeFile(indexPath, lines.join('\n'));
      console.log(`[PurposeDrivenAgentBuilder] Updated index.ts to include ${analysis.agentName}`);
      
    } catch (error) {
      console.error('[PurposeDrivenAgentBuilder] Failed to update main index:', error);
      throw error;
    }
  }
}
