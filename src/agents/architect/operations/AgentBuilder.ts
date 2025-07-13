import { AgentSpec } from '../types/index.js';
import Anthropic from '@anthropic-ai/sdk';
import { promises as fs } from 'fs';
import { execSync } from 'child_process';
import { DiscordBotCreator } from './DiscordBotCreator.js';

export class AgentBuilder {
  private claude: Anthropic;
  private discordCreator?: DiscordBotCreator;

  constructor(claudeApiKey: string, discordToken?: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
    if (discordToken) {
      this.discordCreator = new DiscordBotCreator(claudeApiKey, discordToken);
    }
  }

  /**
   * Alias for generateAgent to maintain backward compatibility
   * This method was referenced in error messages but didn't exist
   */
  async buildCompleteAgent(spec: AgentSpec): Promise<any> {
    console.log(`[AgentBuilder] buildCompleteAgent called (redirecting to generateAgent)`);
    return await this.generateAgent(spec);
  }

  /**
   * Quick agent creation from simple request string
   */
  async buildCompleteAgentFromRequest(request: string): Promise<any> {
    console.log(`[AgentBuilder] Building agent from request: ${request}`);
    
    try {
      const spec = await this.parseAgentRequirements(request);
      return await this.generateAgent(spec);
    } catch (error) {
      console.error('[AgentBuilder] buildCompleteAgentFromRequest failed:', error);
      return {
        summary: `Failed to build agent from request: ${error.message}`,
        files: [],
        ready: false,
        error: error.message
      };
    }
  }

  async parseAgentRequirements(request: string): Promise<AgentSpec> {
    console.log(`[AgentBuilder] Parsing requirements: ${request}`);
    
    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307', // Fixed: Use correct model name
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Parse this agent creation request and extract specifications:

REQUEST: ${request}

Analyze what kind of agent is needed and respond in JSON format:
{
  "name": "AgentClassName",
  "purpose": "What this agent does",
  "capabilities": ["capability1", "capability2"],
  "dependencies": ["@anthropic-ai/sdk", "discord.js"],
  "structure": {
    "core": ["AgentName.ts", "AgentOrchestrator.ts"],
    "intelligence": ["AgentIntelligence.ts"],
    "communication": ["AgentVoice.ts", "AgentDiscord.ts"]
  },
  "discordIntegration": true,
  "voicePersonality": "Brief description of agent personality",
  "createWatcher": true,
  "watcherPurpose": "What patterns this watcher should learn"
}

Examples:
- "TestBot for ping responses" → TestBot with simple response capabilities
- "performance monitoring agent" → PerformanceMonitor + PerformanceWatch
- "deployment manager" → DeploymentManager + DeploymentWatch

Always include a watcher for learning and eventual local model replacement.`
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        try {
          let jsonText = content.text.trim();
          
          // Extract JSON from response if it has extra text
          const jsonStart = jsonText.indexOf('{');
          const jsonEnd = jsonText.lastIndexOf('}') + 1;
          
          if (jsonStart !== -1 && jsonEnd > jsonStart) {
            jsonText = jsonText.substring(jsonStart, jsonEnd);
          }
          
          const parsed = JSON.parse(jsonText);
          return {
            name: parsed.name || this.extractNameFromRequest(request),
            purpose: parsed.purpose || 'Custom functionality',
            capabilities: parsed.capabilities || ['basic-processing'],
            dependencies: parsed.dependencies || ['@anthropic-ai/sdk'],
            structure: parsed.structure || {
              core: [`${parsed.name || 'CustomAgent'}.ts`],
              intelligence: [`${parsed.name || 'CustomAgent'}Intelligence.ts`],
              communication: [`${parsed.name || 'CustomAgent'}Voice.ts`]
            },
            discordIntegration: parsed.discordIntegration !== false,
            voicePersonality: parsed.voicePersonality || 'Professional and helpful',
            createWatcher: parsed.createWatcher !== false,
            watcherPurpose: parsed.watcherPurpose || `Learning patterns for ${parsed.name || 'agent'} optimization`
          };
        } catch (parseError) {
          console.error('[AgentBuilder] Failed to parse agent spec JSON:', parseError);
          console.log('[AgentBuilder] Raw response:', content.text);
          // Fall back to extracted name from request
          return this.createFallbackSpec(request);
        }
      }
    } catch (error) {
      console.error('[AgentBuilder] Agent spec parsing failed:', error);
      // Create fallback spec with extracted name
      return this.createFallbackSpec(request);
    }

    return this.createFallbackSpec(request);
  }

  private extractNameFromRequest(request: string): string {
    // Try to extract agent name from request
    const patterns = [
      /named (\w+)/i,
      /agent (\w+)/i,
      /(\w+) agent/i,
      /build (\w+)/i,
      /create (\w+)/i
    ];
    
    for (const pattern of patterns) {
      const match = request.match(pattern);
      if (match && match[1] && match[1].toLowerCase() !== 'agent') {
        return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
      }
    }
    
    return 'CustomAgent';
  }

  private createFallbackSpec(request: string): AgentSpec {
    const name = this.extractNameFromRequest(request);
    return {
      name,
      purpose: `Agent for: ${request}`,
      capabilities: ['basic-processing', 'simple-responses'],
      dependencies: ['@anthropic-ai/sdk'],
      structure: {
        core: [`${name}.ts`],
        intelligence: [`${name}Intelligence.ts`],
        communication: [`${name}Voice.ts`]
      },
      discordIntegration: true,
      voicePersonality: 'Friendly and responsive',
      createWatcher: true,
      watcherPurpose: `Learning patterns for ${name} optimization`
    };
  }

  /**
   * Enhanced generateAgent with better error handling
   */
  async generateAgent(spec: AgentSpec): Promise<any> {
    console.log(`[AgentBuilder] Building complete agent: ${spec.name} with comprehensive structure`);
    
    const agentPath = `src/agents/${spec.name.toLowerCase()}`;
    const watcherPath = `src/agents/watcher/${spec.name.toLowerCase()}watch`;
    const createdFiles: string[] = [];
    let discordBotCreated = false;
    let inviteUrl = '';
    let channelId = '';
    
    try {
      // Ensure data directory exists
      await fs.mkdir('data', { recursive: true });
      
      // 1. Create directory structures
      console.log(`[AgentBuilder] Creating directories for ${spec.name}...`);
      await this.createAgentDirectories(agentPath);
      
      if (spec.createWatcher) {
        await this.createWatcherDirectories(watcherPath);
      }
      
      // 2. Generate all agent files with enhanced error handling
      try {
        const coreFiles = await this.generateCoreFiles(spec, agentPath);
        createdFiles.push(...coreFiles);
        console.log(`[AgentBuilder] ✅ Core files created: ${coreFiles.length}`);
      } catch (error) {
        console.error('[AgentBuilder] Core files creation failed:', error);
        throw new Error(`Core files creation failed: ${error.message}`);
      }
      
      try {
        const intelligenceFiles = await this.generateIntelligenceFiles(spec, agentPath);
        createdFiles.push(...intelligenceFiles);
        console.log(`[AgentBuilder] ✅ Intelligence files created: ${intelligenceFiles.length}`);
      } catch (error) {
        console.error('[AgentBuilder] Intelligence files creation failed:', error);
        // Continue - intelligence files are optional
      }
      
      try {
        const commFiles = await this.generateCommunicationFiles(spec, agentPath);
        createdFiles.push(...commFiles);
        console.log(`[AgentBuilder] ✅ Communication files created: ${commFiles.length}`);
      } catch (error) {
        console.error('[AgentBuilder] Communication files creation failed:', error);
        // Continue - some communication files might be optional
      }
      
      // 3. Generate types and index files
      try {
        const typesFile = await this.generateTypesFile(spec, agentPath);
        createdFiles.push(typesFile);
        
        const indexFile = await this.generateIndexFile(spec, agentPath);
        createdFiles.push(indexFile);
        
        console.log(`[AgentBuilder] ✅ Supporting files created`);
      } catch (error) {
        console.error('[AgentBuilder] Supporting files creation failed:', error);
        throw new Error(`Supporting files creation failed: ${error.message}`);
      }
      
      // 4. Generate watcher if requested
      if (spec.createWatcher) {
        try {
          const watcherFiles = await this.generateWatcherFiles(spec, watcherPath);
          createdFiles.push(...watcherFiles);
          console.log(`[AgentBuilder] ✅ Watcher created: ${watcherFiles.length} files`);
        } catch (error) {
          console.error('[AgentBuilder] Watcher creation failed:', error);
          // Continue without watcher
        }
      }
      
      // 5. Update main index.ts
      try {
        await this.updateMainIndex(spec);
        console.log(`[AgentBuilder] ✅ Main index updated`);
      } catch (error) {
        console.error('[AgentBuilder] Main index update failed:', error);
        // Continue - this can be done manually
      }
      
      // 6. Create Discord bot if needed (skip if it fails)
      if (spec.discordIntegration && this.discordCreator) {
        try {
          console.log(`[AgentBuilder] Attempting Discord bot creation for ${spec.name}...`);
          const botConfig = await this.discordCreator.createDiscordBot(
            spec.name, 
            `AI Agent for ${spec.purpose}`
          );
          
          if (botConfig) {
            discordBotCreated = true;
            inviteUrl = botConfig.inviteUrl;
            console.log(`[AgentBuilder] ✅ Discord bot created`);
            
            // Try to create channel
            const guildId = process.env.DISCORD_GUILD_ID;
            if (guildId) {
              const createdChannelId = await this.discordCreator.createChannelForAgent(guildId, spec.name);
              if (createdChannelId) {
                channelId = createdChannelId;
                console.log(`[AgentBuilder] ✅ Discord channel created: ${channelId}`);
              }
            }
          }
        } catch (error) {
          console.error('[AgentBuilder] Discord integration failed:', error);
          // Continue without Discord - agent can still function
          console.log('[AgentBuilder] Continuing without Discord integration...');
        }
      }
      
      console.log(`[AgentBuilder] 🎉 Agent ${spec.name} created successfully!`);
      console.log(`[AgentBuilder] Created ${createdFiles.length} files`);
      
      return {
        summary: `Agent ${spec.name} created with ${createdFiles.length} files. ${discordBotCreated ? 'Discord integration ready.' : 'Manual Discord setup needed.'}`,
        files: createdFiles,
        ready: true,
        agentName: spec.name,
        agentPath,
        discordBotCreated,
        botToken: undefined, // Never return sensitive tokens
        channelId: channelId || undefined,
        inviteUrl: discordBotCreated ? inviteUrl : undefined,
        watcherCreated: spec.createWatcher,
        environmentVars: spec.discordIntegration ? [
          `${spec.name.toUpperCase()}_DISCORD_TOKEN`,
          `${spec.name.toUpperCase()}_CHANNEL_ID`
        ] : []
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[AgentBuilder] ❌ Failed to build agent ${spec.name}:`, error);
      
      return {
        summary: `Failed to create agent ${spec.name}: ${errorMessage}`,
        files: createdFiles,
        ready: false,
        error: errorMessage,
        partialCreation: createdFiles.length > 0
      };
    }
  }

  private async createAgentDirectories(basePath: string): Promise<void> {
    const dirs = [
      basePath,
      `${basePath}/core`,
      `${basePath}/intelligence`, 
      `${basePath}/communication`,
      `${basePath}/types`
    ];
    
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private async createWatcherDirectories(basePath: string): Promise<void> {
    const dirs = [
      basePath,
      `${basePath}/core`,
      `${basePath}/intelligence`, 
      `${basePath}/communication`,
      `${basePath}/types`
    ];
    
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private async generateCoreFiles(spec: AgentSpec, basePath: string): Promise<string[]> {
    const files: string[] = [];
    
    const mainFile = `${basePath}/${spec.name}.ts`;
    const mainContent = await this.generateMainAgentFile(spec);
    await fs.writeFile(mainFile, mainContent);
    files.push(mainFile);
    
    const orchestratorFile = `${basePath}/core/${spec.name}Orchestrator.ts`;
    const orchestratorContent = await this.generateOrchestratorFile(spec);
    await fs.writeFile(orchestratorFile, orchestratorContent);
    files.push(orchestratorFile);
    
    return files;
  }

  private async generateIntelligenceFiles(spec: AgentSpec, basePath: string): Promise<string[]> {
    const files: string[] = [];
    
    const intelligenceFile = `${basePath}/intelligence/${spec.name}Intelligence.ts`;
    const intelligenceContent = await this.generateIntelligenceFile(spec);
    await fs.writeFile(intelligenceFile, intelligenceContent);
    files.push(intelligenceFile);
    
    return files;
  }

  private async generateCommunicationFiles(spec: AgentSpec, basePath: string): Promise<string[]> {
    const files: string[] = [];
    
    const voiceFile = `${basePath}/communication/${spec.name}Voice.ts`;
    const voiceContent = await this.generateVoiceFile(spec);
    await fs.writeFile(voiceFile, voiceContent);
    files.push(voiceFile);
    
    if (spec.discordIntegration) {
      const discordFile = `${basePath}/communication/${spec.name}Discord.ts`;
      const discordContent = await this.generateDiscordFile(spec);
      await fs.writeFile(discordFile, discordContent);
      files.push(discordFile);
    }
    
    return files;
  }

  private async generateWatcherFiles(spec: AgentSpec, basePath: string): Promise<string[]> {
    const files: string[] = [];
    
    const watcherFile = `${basePath}/${spec.name}Watch.ts`;
    const watcherContent = await this.generateWatcherFile(spec);
    await fs.writeFile(watcherFile, watcherContent);
    files.push(watcherFile);
    
    return files;
  }

  private async generateMainAgentFile(spec: AgentSpec): Promise<string> {
    return `import { ${spec.name}Discord } from './communication/${spec.name}Discord.js';
import { ${spec.name}Orchestrator } from './core/${spec.name}Orchestrator.js';
import { ${spec.name}Intelligence } from './intelligence/${spec.name}Intelligence.js';
import { ${spec.name}Voice } from './communication/${spec.name}Voice.js';
import { ${spec.name}Config } from './types/index.js';

export class ${spec.name} {
  private discord: ${spec.name}Discord;
  private orchestrator: ${spec.name}Orchestrator;
  private intelligence: ${spec.name}Intelligence;
  private voice: ${spec.name}Voice;

  constructor(config: ${spec.name}Config) {
    this.voice = new ${spec.name}Voice(config.claudeApiKey);
    this.intelligence = new ${spec.name}Intelligence(config.claudeApiKey);
    this.orchestrator = new ${spec.name}Orchestrator(config);
    ${spec.discordIntegration ? `this.discord = new ${spec.name}Discord(config);` : '// Discord integration disabled'}
  }

  async start(): Promise<void> {
    console.log('[${spec.name}] Starting ${spec.purpose}...');
    
    ${spec.discordIntegration ? `
    this.discord.onMessage(async (message) => {
      try {
        const response = await this.processRequest(message.content, message.author.id);
        await this.discord.sendMessage(response);
      } catch (error) {
        console.error('[${spec.name}] Error processing message:', error);
        await this.discord.sendMessage('I encountered an error processing your request.');
      }
    });

    await this.discord.start();` : ''}
    
    console.log('[${spec.name}] 🤖 ${spec.name} online - ${spec.purpose}');
  }

  private async processRequest(input: string, userId: string): Promise<string> {
    try {
      // Analyze the request
      const analysis = await this.intelligence.analyzeRequest(input);
      
      // Execute the request
      const result = await this.orchestrator.execute(analysis);
      
      // Format response
      return await this.voice.formatResponse(result);
      
    } catch (error) {
      console.error('[${spec.name}] Request processing failed:', error);
      return await this.voice.formatError('Request processing failed');
    }
  }
}`;
  }

  private async generateOrchestratorFile(spec: AgentSpec): Promise<string> {
    return `import { ${spec.name}Config } from '../types/index.js';

export class ${spec.name}Orchestrator {
  private config: ${spec.name}Config;

  constructor(config: ${spec.name}Config) {
    this.config = config;
  }

  async execute(analysis: any): Promise<any> {
    console.log('[${spec.name}Orchestrator] Executing:', analysis.type);
    
    switch (analysis.type) {
      case 'ping':
        return await this.handlePing(analysis);
      case 'simple-response':
        return await this.handleSimpleResponse(analysis);
      default:
        return { success: false, message: 'Unknown request type' };
    }
  }

  private async handlePing(analysis: any): Promise<any> {
    // Simple ping-pong response for ${spec.name}
    return {
      success: true,
      message: 'Pong! ${spec.name} is online and responsive.',
      data: { timestamp: new Date().toISOString() }
    };
  }

  private async handleSimpleResponse(analysis: any): Promise<any> {
    // Handle simple responses
    return {
      success: true,
      message: \`${spec.name} processed: \${analysis.input}\`,
      data: analysis
    };
  }
}`;
  }

  private async generateIntelligenceFile(spec: AgentSpec): Promise<string> {
    return `import Anthropic from '@anthropic-ai/sdk';

export class ${spec.name}Intelligence {
  private claude: Anthropic;

  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
  }

  async analyzeRequest(input: string): Promise<any> {
    console.log('[${spec.name}Intelligence] Analyzing:', input);
    
    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: \`You are ${spec.name}, specialized in ${spec.purpose}.

Analyze this request and classify it:

REQUEST: \${input}

Respond with JSON:
{
  "type": "ping" | "simple-response",
  "confidence": 0.0-1.0,
  "input": "\${input}",
  "reasoning": "Why this classification"
}\`
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        try {
          return JSON.parse(content.text);
        } catch (parseError) {
          return this.fallbackAnalysis(input);
        }
      }
    } catch (error) {
      console.error('[${spec.name}Intelligence] Analysis failed:', error);
    }

    return this.fallbackAnalysis(input);
  }

  private fallbackAnalysis(input: string): any {
    // Simple ping detection
    if (input.toLowerCase().includes('ping')) {
      return {
        type: 'ping',
        confidence: 0.9,
        input,
        reasoning: 'Detected ping keyword'
      };
    }
    
    return {
      type: 'simple-response',
      confidence: 0.5,
      input,
      reasoning: 'Fallback analysis - treating as simple response'
    };
  }
}`;
  }

  private async generateVoiceFile(spec: AgentSpec): Promise<string> {
    return `import Anthropic from '@anthropic-ai/sdk';

export class ${spec.name}Voice {
  private claude: Anthropic;

  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
  }

  async formatResponse(result: any): Promise<string> {
    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: \`You are ${spec.name} with this personality: ${spec.voicePersonality}

Format this result into a natural response:

RESULT: \${JSON.stringify(result)}

Keep it conversational and helpful. Focus on ${spec.purpose}.\`
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        return content.text;
      }
    } catch (error) {
      console.error('[${spec.name}Voice] Response formatting failed:', error);
    }

    return this.fallbackResponse(result);
  }

  async formatError(error: string): Promise<string> {
    return \`I encountered an issue: \${error}. Please try again or contact support if the problem persists.\`;
  }

  private fallbackResponse(result: any): string {
    if (result.success) {
      return \`✅ \${result.message}\`;
    } else {
      return \`❌ \${result.message || 'Operation failed'}\`;
    }
  }
}`;
  }

  private async generateDiscordFile(spec: AgentSpec): Promise<string> {
    return `import { Client, GatewayIntentBits, Message } from 'discord.js';
import { ${spec.name}Config } from '../types/index.js';

export class ${spec.name}Discord {
  private client: Client;
  private config: ${spec.name}Config;
  private messageHandler?: (message: Message) => Promise<void>;

  constructor(config: ${spec.name}Config) {
    this.config = config;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('ready', () => {
      console.log(\`[${spec.name}Discord] Connected as \${this.client.user?.tag}\`);
    });

    this.client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      if (message.channelId !== this.config.${spec.name.toLowerCase()}ChannelId) return;

      if (this.messageHandler) {
        await this.messageHandler(message);
      }
    });

    this.client.on('error', (error) => {
      console.error('[${spec.name}Discord] Client error:', error);
    });
  }

  onMessage(handler: (message: Message) => Promise<void>): void {
    this.messageHandler = handler;
  }

  async sendMessage(content: string): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(this.config.${spec.name.toLowerCase()}ChannelId);
      if (channel?.isTextBased()) {
        await channel.send(content);
      }
    } catch (error) {
      console.error('[${spec.name}Discord] Failed to send message:', error);
    }
  }

  async start(): Promise<void> {
    await this.client.login(this.config.${spec.name.toLowerCase()}Token);
  }

  async stop(): Promise<void> {
    await this.client.destroy();
  }

  get isReady(): boolean {
    return this.client.readyAt !== null;
  }
}`;
  }

  private async generateWatcherFile(spec: AgentSpec): Promise<string> {
    return `export class ${spec.name}Watch {
  private patterns: Map<string, number> = new Map();
  private learningData: any[] = [];

  constructor() {
    console.log('[${spec.name}Watch] Watcher initialized for ${spec.watcherPurpose}');
  }

  logInteraction(input: string, output: string, success: boolean): void {
    const pattern = this.extractPattern(input);
    const current = this.patterns.get(pattern) || 0;
    this.patterns.set(pattern, current + 1);

    this.learningData.push({
      timestamp: new Date().toISOString(),
      input,
      output,
      success,
      pattern
    });

    // Keep only recent data
    if (this.learningData.length > 1000) {
      this.learningData = this.learningData.slice(-1000);
    }
  }

  private extractPattern(input: string): string {
    // Simple pattern extraction - can be enhanced
    const words = input.toLowerCase().split(' ').slice(0, 3);
    return words.join('-');
  }

  getTopPatterns(limit: number = 10): Array<{pattern: string, count: number}> {
    return Array.from(this.patterns.entries())
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  getLearningData(): any[] {
    return this.learningData;
  }
}`;
  }

  private async generateTypesFile(spec: AgentSpec, basePath: string): Promise<string> {
    const typesFile = `${basePath}/types/index.ts`;
    const content = `export interface ${spec.name}Config {
  ${spec.discordIntegration ? `${spec.name.toLowerCase()}Token: string;\n  ${spec.name.toLowerCase()}ChannelId: string;\n  ` : ''}claudeApiKey: string;
}

export interface ${spec.name}Request {
  type: string;
  description: string;
  userId: string;
  priority: 'low' | 'medium' | 'high';
}

export interface ${spec.name}Response {
  success: boolean;
  message: string;
  data?: any;
}`;

    await fs.writeFile(typesFile, content);
    return typesFile;
  }

  private async generateIndexFile(spec: AgentSpec, basePath: string): Promise<string> {
    const indexFile = `${basePath}/index.ts`;
    const content = `export { ${spec.name} } from './${spec.name}.js';
export * from './types/index.js';`;

    await fs.writeFile(indexFile, content);
    return indexFile;
  }

  private async updateMainIndex(spec: AgentSpec): Promise<void> {
    try {
      const indexPath = 'src/index.ts';
      const currentContent = await fs.readFile(indexPath, 'utf8');
      
      const importLine = `import { ${spec.name} } from './agents/${spec.name.toLowerCase()}/${spec.name}.js';`;
      const watcherImportLine = spec.createWatcher ? 
        `import { ${spec.name}Watch } from './agents/watcher/${spec.name.toLowerCase()}watch/${spec.name}Watch.js';` : '';
      
      if (currentContent.includes(importLine)) {
        console.log(`[AgentBuilder] ${spec.name} already integrated in index.ts`);
        return;
      }
      
      const lines = currentContent.split('\n');
      const lastImportIndex = lines.map((line, index) => line.startsWith('import') ? index : -1)
        .filter(index => index !== -1)
        .pop() ?? -1;
      
      lines.splice(lastImportIndex + 1, 0, importLine);
      if (watcherImportLine) {
        lines.splice(lastImportIndex + 2, 0, watcherImportLine);
      }
      
      const startFunctionName = `start${spec.name}`;
      const startFunction = `
async function ${startFunctionName}() {
  const ${spec.name.toLowerCase()}Config = {
    ${spec.discordIntegration ? `${spec.name.toLowerCase()}Token: process.env.${spec.name.toUpperCase()}_DISCORD_TOKEN!,\n    ${spec.name.toLowerCase()}ChannelId: process.env.${spec.name.toUpperCase()}_CHANNEL_ID!,\n    ` : ''}claudeApiKey: process.env.CLAUDE_API_KEY!
  };

  if (${spec.discordIntegration ? `${spec.name.toLowerCase()}Config.${spec.name.toLowerCase()}Token && ${spec.name.toLowerCase()}Config.${spec.name.toLowerCase()}ChannelId` : 'true'}) {
    const ${spec.name.toLowerCase()} = new ${spec.name}(${spec.name.toLowerCase()}Config);${spec.createWatcher ? `\n    const ${spec.name.toLowerCase()}Watch = new ${spec.name}Watch();` : ''}
    await ${spec.name.toLowerCase()}.start();
  } else {
    console.log('[${spec.name}] Environment variables not set, skipping startup');
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
      } else {
        lines.push(startFunction);
        lines.push(`\n${startFunctionName}().catch(console.error);`);
      }
      
      await fs.writeFile(indexPath, lines.join('\n'));
      console.log(`[AgentBuilder] Updated index.ts to include ${spec.name}${spec.createWatcher ? ' with watcher' : ''}`);
      
    } catch (error) {
      console.error('[AgentBuilder] Failed to update main index:', error);
      throw error;
    }
  }
}
