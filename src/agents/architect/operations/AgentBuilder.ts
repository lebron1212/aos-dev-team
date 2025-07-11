import { AgentSpec } from '../types/index.js';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import { execSync } from 'child_process';

export class AgentBuilder {
  private claude: Anthropic;

  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
  }

  async parseAgentRequirements(request: string): Promise<AgentSpec> {
    console.log(`[AgentBuilder] Parsing requirements: ${request}`);
    
    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-opus-20240229',
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
  "voicePersonality": "Brief description of agent personality"
}

Examples:
- "performance monitoring agent" → PerformanceMonitor
- "deployment manager" → DeploymentManager  
- "code quality checker" → QualityChecker`
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        try {
          const parsed = JSON.parse(content.text);
          return {
            name: parsed.name || 'CustomAgent',
            purpose: parsed.purpose || 'Custom functionality',
            capabilities: parsed.capabilities || ['basic-processing'],
            dependencies: parsed.dependencies || ['@anthropic-ai/sdk'],
            structure: parsed.structure || {
              core: [`${parsed.name || 'CustomAgent'}.ts`],
              intelligence: [`${parsed.name || 'CustomAgent'}Intelligence.ts`],
              communication: [`${parsed.name || 'CustomAgent'}Voice.ts`]
            },
            discordIntegration: parsed.discordIntegration !== false,
            voicePersonality: parsed.voicePersonality || 'Professional and helpful'
          };
        } catch (parseError) {
          console.error('[AgentBuilder] Failed to parse agent spec:', parseError);
        }
      }
    } catch (error) {
      console.error('[AgentBuilder] Agent spec parsing failed:', error);
    }

    // Fallback parsing
    return this.fallbackAgentSpec(request);
  }

  async generateAgent(spec: AgentSpec): Promise<any> {
    console.log(`[AgentBuilder] Building complete agent: ${spec.name}`);
    
    const agentPath = `src/agents/${spec.name.toLowerCase()}`;
    const createdFiles: string[] = [];
    
    try {
      // 1. Create directory structure
      await this.createAgentDirectories(agentPath);
      
      // 2. Generate core agent files
      const coreFiles = await this.generateCoreFiles(spec, agentPath);
      createdFiles.push(...coreFiles);
      
      // 3. Generate intelligence files
      const intelligenceFiles = await this.generateIntelligenceFiles(spec, agentPath);
      createdFiles.push(...intelligenceFiles);
      
      // 4. Generate communication files
      const commFiles = await this.generateCommunicationFiles(spec, agentPath);
      createdFiles.push(...commFiles);
      
      // 5. Generate types
      const typesFile = await this.generateTypesFile(spec, agentPath);
      createdFiles.push(typesFile);
      
      // 6. Generate index file
      const indexFile = await this.generateIndexFile(spec, agentPath);
      createdFiles.push(indexFile);
      
      // 7. Update main index.ts to include new agent
      await this.updateMainIndex(spec);
      
      // 8. Commit the new agent
      await this.commitNewAgent(spec, createdFiles);
      
      return {
        summary: `Agent ${spec.name} created with full Discord integration`,
        files: createdFiles,
        capabilities: spec.capabilities,
        ready: true,
        discordSetupNeeded: spec.discordIntegration,
        environmentVars: spec.discordIntegration ? [
          `${spec.name.toUpperCase()}_DISCORD_TOKEN`,
          `${spec.name.toUpperCase()}_CHANNEL_ID`
        ] : []
      };
      
    } catch (error) {
      console.error(`[AgentBuilder] Failed to build agent ${spec.name}:`, error);
      return {
        summary: `Failed to create agent ${spec.name}: ${error.message}`,
        files: createdFiles,
        ready: false,
        error: error.message
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

  private async generateCoreFiles(spec: AgentSpec, basePath: string): Promise<string[]> {
    const files: string[] = [];
    
    // Main agent file
    const mainFile = `${basePath}/${spec.name}.ts`;
    const mainContent = await this.generateMainAgentFile(spec);
    await fs.writeFile(mainFile, mainContent);
    files.push(mainFile);
    
    return files;
  }

  private async generateIntelligenceFiles(spec: AgentSpec, basePath: string): Promise<string[]> {
    const files: string[] = [];
    
    // Intelligence file
    const intelligenceFile = `${basePath}/intelligence/${spec.name}Intelligence.ts`;
    const intelligenceContent = await this.generateIntelligenceFile(spec);
    await fs.writeFile(intelligenceFile, intelligenceContent);
    files.push(intelligenceFile);
    
    return files;
  }

  private async generateCommunicationFiles(spec: AgentSpec, basePath: string): Promise<string[]> {
    const files: string[] = [];
    
    if (spec.discordIntegration) {
      // Discord interface
      const discordFile = `${basePath}/communication/${spec.name}Discord.ts`;
      const discordContent = await this.generateDiscordFile(spec);
      await fs.writeFile(discordFile, discordContent);
      files.push(discordFile);
      
      // Voice system
      const voiceFile = `${basePath}/communication/${spec.name}Voice.ts`;
      const voiceContent = await this.generateVoiceFile(spec);
      await fs.writeFile(voiceFile, voiceContent);
      files.push(voiceFile);
    }
    
    return files;
  }

  private async generateMainAgentFile(spec: AgentSpec): Promise<string> {
    const discordImport = spec.discordIntegration ? 
      `import { ${spec.name}Discord } from './communication/${spec.name}Discord.js';\nimport { ${spec.name}Voice } from './communication/${spec.name}Voice.js';` : '';
    
    const discordProperties = spec.discordIntegration ? 
      `  private discord: ${spec.name}Discord;\n  private voice: ${spec.name}Voice;` : '';
    
    const discordInit = spec.discordIntegration ? 
      `    this.discord = new ${spec.name}Discord(config);\n    this.voice = new ${spec.name}Voice(config.claudeApiKey);` : '';
    
    const discordStart = spec.discordIntegration ? 
      `    this.discord.onMessage(async (message) => {\n      const response = await this.processRequest(message.content, message.author.id, message.id);\n      await this.discord.sendMessage(response);\n    });\n\n    await this.discord.start();` : '';

    return `import { ${spec.name}Intelligence } from './intelligence/${spec.name}Intelligence.js';
${discordImport}

export interface ${spec.name}Config {
  ${spec.discordIntegration ? `${spec.name.toLowerCase()}Token: string;\n  ${spec.name.toLowerCase()}ChannelId: string;\n  ` : ''}claudeApiKey: string;
}

export class ${spec.name} {
  private intelligence: ${spec.name}Intelligence;
${discordProperties}

  constructor(config: ${spec.name}Config) {
    this.intelligence = new ${spec.name}Intelligence(config.claudeApiKey);
${discordInit}
    
    console.log('[${spec.name}] ${spec.purpose} initialized');
  }

  async start(): Promise<void> {
${discordStart}
    console.log('[${spec.name}] 🚀 ${spec.name} is online and ready!');
  }

  private async processRequest(input: string, userId: string, messageId: string): Promise<string> {
    console.log(\`[${spec.name}] Processing: "\${input}"\`);
    
    try {
      const result = await this.intelligence.process(input, userId);
      ${spec.discordIntegration ? `return await this.voice.formatResponse(result, { type: 'response' });` : `return result;`}
    } catch (error) {
      console.error('[${spec.name}] Error:', error);
      ${spec.discordIntegration ? `return await this.voice.formatResponse('Error processing request. Please try again.', { type: 'error' });` : `return 'Error processing request.';`}
    }
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

  async process(input: string, userId: string): Promise<string> {
    console.log(\`[${spec.name}Intelligence] Processing: \${input}\`);
    
    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        system: \`You are the ${spec.name} agent. Purpose: ${spec.purpose}
        
Capabilities: ${spec.capabilities.join(', ')}

Respond helpfully and professionally to user requests related to your purpose.\`,
        messages: [{
          role: 'user',
          content: input
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        return content.text;
      }
    } catch (error) {
      console.error(\`[${spec.name}Intelligence] Claude API failed:\`, error);
    }

    return \`I'm the ${spec.name} agent. I can help with: \${spec.capabilities.join(', ')}\`;
  }
}`;
  }

  private async generateDiscordFile(spec: AgentSpec): Promise<string> {
    return `import { Client, GatewayIntentBits, TextChannel, Message } from 'discord.js';

export class ${spec.name}Discord {
  private client: Client;
  private channel: TextChannel | null = null;
  private config: any;
  private messageHandlers: Array<(message: Message) => Promise<void>> = [];

  constructor(config: any) {
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
    this.client.once('ready', async () => {
      console.log(\`[${spec.name}Discord] Connected as \${this.client.user?.tag}\`);
      this.channel = this.client.channels.cache.get(this.config.${spec.name.toLowerCase()}ChannelId) as TextChannel;
      
      this.client.user?.setPresence({
        activities: [{ name: '${spec.purpose}', type: 3 }],
        status: 'online'
      });
    });

    this.client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      if (message.channelId !== this.config.${spec.name.toLowerCase()}ChannelId) return;
      
      for (const handler of this.messageHandlers) {
        await handler(message);
      }
    });

    this.client.on('error', (error) => {
      console.error('[${spec.name}Discord] Client error:', error);
    });
  }

  onMessage(handler: (message: Message) => Promise<void>): void {
    this.messageHandlers.push(handler);
  }

  async sendMessage(content: string): Promise<Message | null> {
    if (!this.channel) return null;
    
    try {
      return await this.channel.send(content);
    } catch (error) {
      console.error('[${spec.name}Discord] Failed to send message:', error);
      return null;
    }
  }

  async start(): Promise<void> {
    await this.client.login(this.config.${spec.name.toLowerCase()}Token);
  }

  get isReady(): boolean {
    return this.client.isReady();
  }
}`;
  }

  private async generateVoiceFile(spec: AgentSpec): Promise<string> {
    return `import Anthropic from '@anthropic-ai/sdk';

export class ${spec.name}Voice {
  private claude: Anthropic;
  
  private static readonly VOICE_PROMPT = \`You are the ${spec.name} agent.

PERSONALITY: ${spec.voicePersonality || 'Professional and helpful'}
PURPOSE: ${spec.purpose}
CAPABILITIES: ${spec.capabilities.join(', ')}

VOICE RULES:
- Be helpful and professional
- Stay focused on your purpose
- Provide clear, actionable responses
- Be concise but thorough when needed

AVOID: Being overly verbose, going outside your domain\`;

  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
  }

  async formatResponse(content: string, options: { type?: string } = {}): Promise<string> {
    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 200,
        system: ${spec.name}Voice.VOICE_PROMPT,
        messages: [{
          role: 'user',
          content: \`Format this response in the ${spec.name} voice:

"\${content}"

Context: \${options.type || 'general'}\`
        }]
      });
      
      const voiceContent = response.content[0];
      if (voiceContent.type === 'text') {
        return this.cleanResponse(voiceContent.text);
      }
    } catch (error) {
      console.error('[${spec.name}Voice] AI formatting failed:', error);
    }
    
    return this.cleanResponse(content);
  }

  private cleanResponse(response: string): string {
    return response
      .replace(/\\*[^*]*\\*/g, '')
      .trim();
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
      const startFunctionName = `start${spec.name}`;
      
      if (currentContent.includes(importLine)) {
        console.log(`[AgentBuilder] ${spec.name} already integrated in index.ts`);
        return;
      }
      
      // Add import
      const lines = currentContent.split('\n');
      const lastImportIndex = lines.findLastIndex(line => line.startsWith('import'));
      lines.splice(lastImportIndex + 1, 0, importLine);
      
      // Add start function
      const startFunction = `
async function ${startFunctionName}() {
  const ${spec.name.toLowerCase()}Config = {
    ${spec.discordIntegration ? `${spec.name.toLowerCase()}Token: process.env.${spec.name.toUpperCase()}_DISCORD_TOKEN!,\n    ${spec.name.toLowerCase()}ChannelId: process.env.${spec.name.toUpperCase()}_CHANNEL_ID!,\n    ` : ''}claudeApiKey: process.env.CLAUDE_API_KEY!
  };

  if (${spec.discordIntegration ? `${spec.name.toLowerCase()}Config.${spec.name.toLowerCase()}Token && ${spec.name.toLowerCase()}Config.${spec.name.toLowerCase()}ChannelId` : 'true'}) {
    const ${spec.name.toLowerCase()} = new ${spec.name}(${spec.name.toLowerCase()}Config);
    await ${spec.name.toLowerCase()}.start();
  } else {
    console.log('[${spec.name}] Environment variables not set, skipping startup');
  }
}`;
      
      // Find the Promise.all call and add the new start function
      const promiseAllIndex = lines.findIndex(line => line.includes('Promise.all'));
      if (promiseAllIndex !== -1) {
        lines.splice(promiseAllIndex, 0, startFunction);
        
        // Update Promise.all to include new function
        const promiseAllLine = lines[promiseAllIndex + startFunction.split('\n').length];
        if (promiseAllLine.includes('startCommander()')) {
          lines[promiseAllIndex + startFunction.split('\n').length] = promiseAllLine.replace(
            '])',
            `,\n  ${startFunctionName}()\n])`
          );
        }
      } else {
        // Add at the end
        lines.push(startFunction);
        lines.push(`\n${startFunctionName}().catch(console.error);`);
      }
      
      await fs.writeFile(indexPath, lines.join('\n'));
      console.log(`[AgentBuilder] Updated index.ts to include ${spec.name}`);
      
    } catch (error) {
      console.error(`[AgentBuilder] Failed to update index.ts:`, error);
    }
  }

  private async commitNewAgent(spec: AgentSpec, files: string[]): Promise<void> {
    try {
      execSync('git add .', { stdio: 'pipe' });
      execSync(`git commit -m "🤖 Add ${spec.name} agent with full Discord integration\\n\\nFiles created:\\n${files.map(f => `- ${f}`).join('\\n')}"`, { stdio: 'pipe' });
      execSync('git push origin main', { stdio: 'pipe' });
      console.log(`[AgentBuilder] Committed and deployed ${spec.name} agent`);
    } catch (error) {
      console.error(`[AgentBuilder] Failed to commit ${spec.name}:`, error);
    }
  }

  private fallbackAgentSpec(request: string): AgentSpec {
    const name = request.includes('monitor') ? 'Monitor' : 
                request.includes('deploy') ? 'Deployer' :
                request.includes('quality') ? 'QualityChecker' : 'CustomAgent';
    
    return {
      name,
      purpose: `Agent for ${request}`,
      capabilities: ['basic-processing'],
      dependencies: ['@anthropic-ai/sdk'],
      structure: {
        core: [`${name}.ts`],
        intelligence: [`${name}Intelligence.ts`],
        communication: [`${name}Voice.ts`]
      },
      discordIntegration: true,
      voicePersonality: 'Professional and helpful'
    };
  }
}
