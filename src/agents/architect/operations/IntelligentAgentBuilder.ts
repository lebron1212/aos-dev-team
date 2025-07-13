// src/agents/architect/operations/IntelligentAgentBuilder.ts
import { AgentSpec } from '../types/index.js';
import Anthropic from '@anthropic-ai/sdk';
import { promises as fs } from 'fs';
import { execSync } from 'child_process';

export class IntelligentAgentBuilder {
  private claude: Anthropic;

  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
  }

  async buildIntelligentAgent(request: string): Promise<any> {
    console.log(`[IntelligentAgentBuilder] Building: ${request}`);
    
    try {
      const spec = await this.parseRequest(request);
      const agentPath = `src/agents/${spec.name.toLowerCase()}`;
      const createdFiles: string[] = [];
      
      // Create directories
      await this.createDirectories(agentPath);
      
      // Generate core files
      const coreFiles = await this.generateCoreFiles(spec, agentPath);
      createdFiles.push(...coreFiles);
      
      // Generate intelligence layer
      const intelligenceFiles = await this.generateIntelligenceLayer(spec, agentPath);
      createdFiles.push(...intelligenceFiles);
      
      // Generate communication layer
      const communicationFiles = await this.generateCommunicationLayer(spec, agentPath);
      createdFiles.push(...communicationFiles);
      
      // Generate types
      const typesFile = await this.generateTypes(spec, agentPath);
      createdFiles.push(typesFile);
      
      // Update main index
      await this.updateMainIndex(spec);
      
      // Commit changes
      const committed = await this.commitChanges(spec, createdFiles);
      
      return {
        summary: `${spec.name} created with ${createdFiles.length} files`,
        files: createdFiles,
        ready: true,
        committed,
        discordConfigured: true
      };
      
    } catch (error) {
      return {
        summary: `Failed to create agent`,
        files: [],
        ready: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async parseRequest(request: string): Promise<AgentSpec> {
    const name = this.extractName(request) || 'TestBot';
    const purpose = this.extractPurpose(request) || 'Simple ping-pong responses';
    const capabilities = this.extractCapabilities(request);
    
    return {
      name,
      purpose,
      capabilities,
      dependencies: ['@anthropic-ai/sdk', 'discord.js'],
      structure: {
        core: [`${name}.ts`, `${name}Orchestrator.ts`],
        intelligence: [`${name}Intelligence.ts`],
        communication: [`${name}Discord.ts`, `${name}Voice.ts`]
      },
      discordIntegration: true,
      voicePersonality: 'Friendly and responsive',
      createWatcher: true,
      watcherPurpose: `Learning patterns for ${name}`
    };
  }

  private async createDirectories(basePath: string): Promise<void> {
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
    
    // Main agent class
    const mainContent = `import { ${spec.name}Discord } from './communication/${spec.name}Discord.js';
import { ${spec.name}Voice } from './communication/${spec.name}Voice.js';
import { ${spec.name}Orchestrator } from './core/${spec.name}Orchestrator.js';

export class ${spec.name} {
  private discord: ${spec.name}Discord;
  private voice: ${spec.name}Voice;
  private orchestrator: ${spec.name}Orchestrator;

  constructor(config: any) {
    this.voice = new ${spec.name}Voice();
    this.orchestrator = new ${spec.name}Orchestrator(config.claudeApiKey);
    this.discord = new ${spec.name}Discord(
      config.${spec.name.toLowerCase()}Token,
      config.${spec.name.toLowerCase()}ChannelId,
      this.voice,
      this.orchestrator
    );
    
    console.log('[${spec.name}] Initialized');
  }

  async start(): Promise<void> {
    await this.discord.start();
    console.log('[${spec.name}] Started - ready for ${spec.purpose}!');
  }

  async stop(): Promise<void> {
    await this.discord.stop();
    console.log('[${spec.name}] Stopped');
  }
}`;
    
    await fs.writeFile(`${basePath}/${spec.name}.ts`, mainContent);
    files.push(`${basePath}/${spec.name}.ts`);
    
    // Orchestrator
    const orchestratorContent = `import Anthropic from '@anthropic-ai/sdk';

export class ${spec.name}Orchestrator {
  private claude: Anthropic;

  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
  }

  async processMessage(message: string, userId: string): Promise<string> {
    const lower = message.toLowerCase();
    
    ${spec.name === 'TestBot' ? `
    if (lower.includes('ping')) {
      return 'pong! 🏓';
    }
    
    if (lower.includes('hello') || lower.includes('hi')) {
      return 'Hello! Send me "ping" and I\\'ll respond with "pong"! 👋';
    }
    
    return 'I\\'m a simple ping-pong bot! Try sending "ping" 🏓';
    ` : `
    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 300,
        messages: [{ role: 'user', content: message }]
      });
      
      const content = response.content[0];
      return content.type === 'text' ? content.text : 'Processing...';
    } catch (error) {
      return 'Sorry, I encountered an error processing your message.';
    }
    `}
  }
}`;
    
    await fs.writeFile(`${basePath}/core/${spec.name}Orchestrator.ts`, orchestratorContent);
    files.push(`${basePath}/core/${spec.name}Orchestrator.ts`);
    
    return files;
  }

  private async generateIntelligenceLayer(spec: AgentSpec, basePath: string): Promise<string[]> {
    const content = `export class ${spec.name}Intelligence {
  constructor(private claudeApiKey: string) {}
  
  async analyzeMessage(message: string): Promise<any> {
    const lower = message.toLowerCase();
    
    return {
      messageType: ${spec.name === 'TestBot' ? 
        `lower.includes('ping') ? 'ping-request' : 'general'` :
        `lower.includes('?') ? 'question' : 'statement'`},
      sentiment: this.analyzeSentiment(message),
      intent: ${spec.name === 'TestBot' ? 
        `lower.includes('ping') ? 'test-response' : 'interaction'` :
        `'general-query'`}
    };
  }
  
  private analyzeSentiment(message: string): string {
    const positive = ['good', 'great', 'awesome', 'thanks'];
    const negative = ['bad', 'terrible', 'hate', 'awful'];
    const lower = message.toLowerCase();
    
    if (positive.some(word => lower.includes(word))) return 'positive';
    if (negative.some(word => lower.includes(word))) return 'negative';
    return 'neutral';
  }
}`;
    
    await fs.writeFile(`${basePath}/intelligence/${spec.name}Intelligence.ts`, content);
    return [`${basePath}/intelligence/${spec.name}Intelligence.ts`];
  }

  private async generateCommunicationLayer(spec: AgentSpec, basePath: string): Promise<string[]> {
    const files: string[] = [];
    
    // Discord integration
    const discordContent = `import { Client, GatewayIntentBits } from 'discord.js';

export class ${spec.name}Discord {
  private client: Client;
  private token: string;
  private channelId: string;
  private voice: any;
  private orchestrator: any;

  constructor(token: string, channelId: string, voice: any, orchestrator: any) {
    this.token = token;
    this.channelId = channelId;
    this.voice = voice;
    this.orchestrator = orchestrator;
    
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
    this.client.once('ready', () => {
      console.log(\`[${spec.name}Discord] Ready as \${this.client.user?.tag}\`);
    });

    this.client.on('messageCreate', async (message) => {
      if (message.author.bot || message.channelId !== this.channelId) return;

      try {
        const response = await this.orchestrator.processMessage(message.content, message.author.id);
        if (response) {
          await message.reply(response);
        }
      } catch (error) {
        console.error(\`[${spec.name}Discord] Error:\`, error);
        await message.reply('Sorry, I encountered an error.');
      }
    });
  }

  async start(): Promise<void> {
    await this.client.login(this.token);
  }

  async stop(): Promise<void> {
    this.client.destroy();
  }
}`;
    
    await fs.writeFile(`${basePath}/communication/${spec.name}Discord.ts`, discordContent);
    files.push(`${basePath}/communication/${spec.name}Discord.ts`);
    
    // Voice system
    const voiceContent = `export class ${spec.name}Voice {
  formatResponse(message: string, context: any = {}): string {
    return message;
  }

  getPersonality(): string {
    return '${spec.voicePersonality}';
  }
}`;
    
    await fs.writeFile(`${basePath}/communication/${spec.name}Voice.ts`, voiceContent);
    files.push(`${basePath}/communication/${spec.name}Voice.ts`);
    
    return files;
  }

  private async generateTypes(spec: AgentSpec, basePath: string): Promise<string> {
    const content = `export interface ${spec.name}Config {
  ${spec.name.toLowerCase()}Token: string;
  ${spec.name.toLowerCase()}ChannelId: string;
  claudeApiKey: string;
}

export interface ${spec.name}Message {
  content: string;
  userId: string;
  timestamp: Date;
}`;
    
    const typesFile = `${basePath}/types/index.ts`;
    await fs.writeFile(typesFile, content);
    return typesFile;
  }

  private async updateMainIndex(spec: AgentSpec): Promise<void> {
    try {
      const indexPath = 'src/index.ts';
      const content = await fs.readFile(indexPath, 'utf8');
      const lines = content.split('\n');
      
      // Add import
      const importStatement = `import { ${spec.name} } from './agents/${spec.name.toLowerCase()}/${spec.name}.js';`;
      if (!content.includes(importStatement)) {
        lines.splice(1, 0, importStatement);
      }
      
      // Add startup function
      const startFunction = `
async function start${spec.name}() {
  const ${spec.name.toLowerCase()}Config = {
    ${spec.name.toLowerCase()}Token: process.env.${spec.name.toUpperCase()}_DISCORD_TOKEN!,
    ${spec.name.toLowerCase()}ChannelId: process.env.${spec.name.toUpperCase()}_CHANNEL_ID!,
    claudeApiKey: process.env.CLAUDE_API_KEY!
  };

  if (${spec.name.toLowerCase()}Config.${spec.name.toLowerCase()}Token && ${spec.name.toLowerCase()}Config.${spec.name.toLowerCase()}ChannelId) {
    const ${spec.name.toLowerCase()} = new ${spec.name}(${spec.name.toLowerCase()}Config);
    await ${spec.name.toLowerCase()}.start();
  } else {
    console.log('[${spec.name}] Environment variables not set, skipping startup');
  }
}`;
      
      const promiseAllIndex = lines.findIndex(line => line.includes('Promise.all'));
      if (promiseAllIndex !== -1) {
        lines.splice(promiseAllIndex, 0, startFunction);
        const promiseAllLine = lines[promiseAllIndex + startFunction.split('\n').length];
        lines[promiseAllIndex + startFunction.split('\n').length] = promiseAllLine.replace(
          '])',
          `,\n  start${spec.name}()\n])`
        );
      }
      
      await fs.writeFile(indexPath, lines.join('\n'));
      console.log(`[IntelligentAgentBuilder] Updated index.ts for ${spec.name}`);
    } catch (error) {
      console.error(`[IntelligentAgentBuilder] Failed to update index.ts:`, error);
    }
  }

  private async commitChanges(spec: AgentSpec, files: string[]): Promise<boolean> {
    try {
      execSync('git add .', { stdio: 'pipe' });
      execSync(`git commit -m "Add ${spec.name} agent - ${spec.purpose}"`, { stdio: 'pipe' });
      execSync('git push origin main', { stdio: 'pipe' });
      return true;
    } catch (error) {
      console.error(`[IntelligentAgentBuilder] Git operations failed:`, error);
      return false;
    }
  }

  private extractName(request: string): string | null {
    const patterns = [
      /agent named (\w+)/i,
      /(\w+) agent/i,
      /build (\w+)/i,
      /create (\w+)/i
    ];
    
    for (const pattern of patterns) {
      const match = request.match(pattern);
      if (match) {
        return match[1].charAt(0).toUpperCase() + match[1].slice(1);
      }
    }
    return null;
  }

  private extractPurpose(request: string): string | null {
    const match = request.match(/for (.+)$/i);
    return match ? match[1] : null;
  }

  private extractCapabilities(request: string): string[] {
    const capabilities = ['basic-processing'];
    const lower = request.toLowerCase();
    
    if (lower.includes('ping')) capabilities.push('ping-response');
    if (lower.includes('chat')) capabilities.push('conversation');
    if (lower.includes('monitor')) capabilities.push('monitoring');
    
    return capabilities;
  }
}