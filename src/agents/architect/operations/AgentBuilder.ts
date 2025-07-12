import Anthropic from '@anthropic-ai/sdk';
import { AgentSpec } from '../types/index.js';
import { DiscordBotCreator } from './DiscordBotCreator.js';
import { GitHubFileManager } from './GitHubFileManager.js';

interface BuildResult {
  summary: string;
  files: string[];
  ready: boolean;
  error?: string;
  discordSetupNeeded?: boolean;
  discordBotCreated?: boolean;
  botToken?: string;
  channelId?: string;
  inviteUrl?: string;
  watcherCreated?: boolean;
  environmentVars?: string[];
  commitSha?: string;
}

export class AgentBuilder {
  private claude: Anthropic;
  private discordCreator?: DiscordBotCreator;
  private github: GitHubFileManager;

  constructor(claudeApiKey: string, discordToken?: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
    
    if (discordToken) {
      this.discordCreator = new DiscordBotCreator(claudeApiKey, discordToken);
    }

    // Initialize GitHub API
    this.github = new GitHubFileManager(
      process.env.GITHUB_TOKEN!,
      process.env.GITHUB_REPO_OWNER!,
      process.env.GITHUB_REPO_NAME!
    );
  }

  async parseAgentRequirements(request: string): Promise<AgentSpec> {
    console.log(`[AgentBuilder] Parsing agent requirements: ${request}`);
    
    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Parse this agent creation request into a structured specification:

"${request}"

Return JSON in this exact format:
{
  "name": "AgentName",
  "purpose": "Brief description of what the agent does",
  "capabilities": ["capability1", "capability2"],
  "dependencies": ["@anthropic-ai/sdk"],
  "structure": {
    "core": ["AgentName.ts"],
    "intelligence": ["AgentNameIntelligence.ts"],
    "communication": ["AgentNameVoice.ts"]
  },
  "discordIntegration": true,
  "voicePersonality": "Professional and helpful",
  "createWatcher": true,
  "watcherPurpose": "Learning patterns for optimization"
}`
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        try {
          const parsed = JSON.parse(content.text);
          return {
            name: parsed.name || 'CustomAgent',
            purpose: parsed.purpose || `Agent for ${request}`,
            capabilities: parsed.capabilities || ['basic-processing'],
            dependencies: parsed.dependencies || ['@anthropic-ai/sdk'],
            structure: {
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
          console.error('[AgentBuilder] Failed to parse agent spec:', parseError);
        }
      }
    } catch (error) {
      console.error('[AgentBuilder] Agent spec parsing failed:', error);
    }

    return this.fallbackAgentSpec(request);
  }

  async generateAgent(spec: AgentSpec): Promise<BuildResult> {
    console.log(`[AgentBuilder] Building complete agent: ${spec.name} via GitHub API`);
    
    const agentPath = `src/agents/${spec.name.toLowerCase()}`;
    const watcherPath = `src/agents/watcher/${spec.name.toLowerCase()}watch`;
    const filesToCreate: Array<{path: string, content: string}> = [];
    
    try {
      // 1. Generate all file contents
      console.log(`[AgentBuilder] Generating files for ${spec.name}...`);
      
      // Core agent files
      const mainContent = await this.generateMainAgentFile(spec);
      filesToCreate.push({
        path: `${agentPath}/${spec.name}.ts`,
        content: mainContent
      });

      // Intelligence files
      const intelligenceContent = await this.generateIntelligenceFile(spec);
      filesToCreate.push({
        path: `${agentPath}/intelligence/${spec.name}Intelligence.ts`,
        content: intelligenceContent
      });

      // Communication files (if Discord integration)
      if (spec.discordIntegration) {
        const discordContent = await this.generateDiscordFile(spec);
        filesToCreate.push({
          path: `${agentPath}/communication/${spec.name}Discord.ts`,
          content: discordContent
        });

        const voiceContent = await this.generateVoiceFile(spec);
        filesToCreate.push({
          path: `${agentPath}/communication/${spec.name}Voice.ts`,
          content: voiceContent
        });
      }

      // Types
      const typesContent = await this.generateTypesFile(spec);
      filesToCreate.push({
        path: `${agentPath}/types/index.ts`,
        content: typesContent
      });

      // Index
      const indexContent = await this.generateIndexFile(spec);
      filesToCreate.push({
        path: `${agentPath}/index.ts`,
        content: indexContent
      });

      // Watcher files (if requested)
      if (spec.createWatcher) {
        const watcherFiles = await this.generateWatcherFiles(spec, watcherPath);
        filesToCreate.push(...watcherFiles);
      }

      // Update main index.ts
      const updatedIndexContent = await this.generateUpdatedMainIndex(spec);
      filesToCreate.push({
        path: 'src/index.ts',
        content: updatedIndexContent
      });

      // 2. Create Discord bot if integration enabled
      let discordBotCreated = false;
      let botToken = '';
      let channelId = '';
      let inviteUrl = '';
      
      if (spec.discordIntegration && this.discordCreator) {
        console.log(`[AgentBuilder] Creating Discord bot for ${spec.name}...`);
        const botConfig = await this.discordCreator.createDiscordBot(spec.name, spec.purpose);
        
        if (botConfig) {
          discordBotCreated = true;
          botToken = botConfig.token;
          inviteUrl = botConfig.inviteUrl;
          
          const guildId = process.env.DISCORD_GUILD_ID;
          if (guildId) {
            const createdChannelId = await this.discordCreator.createChannelForAgent(guildId, spec.name);
            if (createdChannelId) {
              channelId = createdChannelId;
            }
          }
          
          console.log(`[AgentBuilder] Discord bot created successfully for ${spec.name}`);
        }
      }

      // 3. Register with Commander
      if (spec.discordIntegration) {
        const registryContent = await this.generateBotRegistry(spec, channelId);
        filesToCreate.push({
          path: 'data/registered-bots.json',
          content: registryContent
        });
      }

      // 4. Commit all files to GitHub
      console.log(`[AgentBuilder] Committing ${filesToCreate.length} files to GitHub...`);
      const commitResult = await this.github.writeFiles(
        filesToCreate,
        `🤖 Add ${spec.name} agent with full integration\n\nFeatures:\n- ${spec.discordIntegration ? 'Discord integration' : 'Standalone agent'}\n- ${spec.createWatcher ? 'Learning watcher' : 'Standard operation'}\n- ${spec.capabilities.join(', ')}`
      );

      if (!commitResult.success) {
        throw new Error('Failed to commit files to GitHub');
      }

      console.log(`[AgentBuilder] Successfully committed to GitHub: ${commitResult.commitSha}`);

      return {
        summary: `Agent ${spec.name} created and deployed via GitHub API`,
        files: filesToCreate.map(f => f.path),
        ready: true,
        discordSetupNeeded: spec.discordIntegration && !discordBotCreated,
        discordBotCreated,
        botToken: discordBotCreated ? botToken : undefined,
        channelId: channelId || undefined,
        inviteUrl: discordBotCreated ? inviteUrl : undefined,
        watcherCreated: spec.createWatcher,
        environmentVars: spec.discordIntegration ? [
          `${spec.name.toUpperCase()}_DISCORD_TOKEN`,
          `${spec.name.toUpperCase()}_CHANNEL_ID`
        ] : [],
        commitSha: commitResult.commitSha
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[AgentBuilder] Failed to build agent ${spec.name}:`, error);
      return {
        summary: `Failed to create agent ${spec.name}: ${errorMessage}`,
        files: filesToCreate.map(f => f.path),
        ready: false,
        error: errorMessage
      };
    }
  }

  async getStoredAgents(): Promise<Array<{name: string, purpose: string, capabilities: string[], isOnline: boolean}>> {
    try {
      // Try to get from GitHub first, fallback to defaults
      try {
        const registryFile = await this.github.getFile('data/registered-bots.json');
        const content = Buffer.from(registryFile.content, 'base64').toString();
        const agents = JSON.parse(content);
        return agents.map((agent: any) => ({
          name: agent.name,
          purpose: agent.purpose,
          capabilities: agent.capabilities || agent.specialties || [],
          isOnline: agent.isOnline || false
        }));
      } catch (error) {
        // File doesn't exist yet, return default agents
        return [
          {
            name: 'Commander',
            purpose: 'Universal task router and delegation',
            capabilities: ['task-routing', 'work-item-management', 'agent-coordination'],
            isOnline: true
          },
          {
            name: 'Architect',
            purpose: 'System building and code modification',
            capabilities: ['system-modification', 'agent-creation', 'code-analysis'],
            isOnline: true
          },
          {
            name: 'Dashboard',
            purpose: 'System monitoring and analytics',
            capabilities: ['performance-monitoring', 'cost-analysis', 'system-health'],
            isOnline: false
          }
        ];
      }
    } catch (error) {
      console.error('[AgentBuilder] Failed to get stored agents:', error);
      return [];
    }
  }

  // File generation methods remain the same but return content instead of writing files
  private async generateMainAgentFile(spec: AgentSpec): Promise<string> {
    const discordImport = spec.discordIntegration ? 
      `import { ${spec.name}Discord } from './communication/${spec.name}Discord.js';\nimport { ${spec.name}Voice } from './communication/${spec.name}Voice.js';` : '';
    
    const watcherImport = spec.createWatcher ?
      `import { ${spec.name}Watch } from '../watcher/${spec.name.toLowerCase()}watch/${spec.name}Watch.js';` : '';
    
    const discordProperties = spec.discordIntegration ? 
      `  private discord: ${spec.name}Discord;\n  private voice: ${spec.name}Voice;` : '';
    
    const watcherProperty = spec.createWatcher ?
      `  private watcher: ${spec.name}Watch;` : '';
    
    const discordInit = spec.discordIntegration ? 
      `    this.discord = new ${spec.name}Discord(config);\n    this.voice = new ${spec.name}Voice(config.claudeApiKey);` : '';
      
    const watcherInit = spec.createWatcher ?
      `    this.watcher = new ${spec.name}Watch();` : '';
    
    const discordStart = spec.discordIntegration ? 
      `    this.discord.onMessage(async (message) => {\n      const response = await this.processRequest(message.content, message.author.id, message.id);\n      await this.discord.sendMessage(response);\n    });\n\n    await this.discord.start();` : '';

    const watcherLogging = spec.createWatcher ?
      `      // Log interaction to watcher for learning\n      await this.watcher.log${spec.name}Interaction(input, result, []);` : '';

    return `import { ${spec.name}Intelligence } from './intelligence/${spec.name}Intelligence.js';
${discordImport}
${watcherImport}

export interface ${spec.name}Config {
  ${spec.discordIntegration ? `${spec.name.toLowerCase()}Token: string;\n  ${spec.name.toLowerCase()}ChannelId: string;\n  ` : ''}claudeApiKey: string;
}

export class ${spec.name} {
  private intelligence: ${spec.name}Intelligence;
${discordProperties}
${watcherProperty}

  constructor(config: ${spec.name}Config) {
    this.intelligence = new ${spec.name}Intelligence(config.claudeApiKey);
${discordInit}
${watcherInit}
    
    console.log('[${spec.name}] ${spec.purpose} initialized${spec.createWatcher ? ' with learning watcher' : ''}');
  }

  async start(): Promise<void> {
${discordStart}
    console.log('[${spec.name}] 🚀 ${spec.name} is online and ready!');
  }

  private async processRequest(input: string, userId: string, messageId: string): Promise<string> {
    console.log(\`[${spec.name}] Processing: "\${input}"\`);
    
    try {
      const result = await this.intelligence.process(input, userId);
      
${watcherLogging}
      
      ${spec.discordIntegration ? `return await this.voice.formatResponse(result, { type: 'response' });` : `return result;`}
    } catch (error) {
      console.error('[${spec.name}] Error:', error);
      ${spec.discordIntegration ? `return await this.voice.formatResponse('Error processing request. Please try again.', { type: 'error' });` : `return 'Error processing request. Please try again.';`}
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
    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: \`You are the ${spec.name} agent.
        
Purpose: ${spec.purpose}
        
Capabilities: ${spec.capabilities.join(', ')}

Respond helpfully and professionally to user requests related to your purpose.\`,
        }, {
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
      
      if (this.channel) {
        await this.channel.send(\`🤖 **${spec.name} Online** - ${spec.purpose}\`);
      }
      
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
  
  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
  }

  async formatResponse(content: string, options: { type: string }): Promise<string> {
    const emoji = options.type === 'error' ? '❌' : 
                 options.type === 'success' ? '✅' : '🤖';
    
    return \`\${emoji} **${spec.name}**: \${content}\`;
  }
}`;
  }

  private async generateTypesFile(spec: AgentSpec): Promise<string> {
    return `export interface ${spec.name}Config {
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
  }

  private async generateIndexFile(spec: AgentSpec): Promise<string> {
    return `export { ${spec.name} } from './${spec.name}.js';
export * from './types/index.js';`;
  }

  private async generateWatcherFiles(spec: AgentSpec, watcherPath: string): Promise<Array<{path: string, content: string}>> {
    const watcherName = `${spec.name}Watch`;
    const files: Array<{path: string, content: string}> = [];

    // Main watcher file
    files.push({
      path: `${watcherPath}/${watcherName}.ts`,
      content: `import { ${watcherName}Intelligence } from './intelligence/${watcherName}Intelligence.js';

export class ${watcherName} {
  private intelligence: ${watcherName}Intelligence;

  constructor() {
    this.intelligence = new ${watcherName}Intelligence();
    console.log('[${watcherName}] ${spec.watcherPurpose} watcher initialized');
  }

  async log${spec.name}Interaction(input: string, output: string, metadata: any[]): Promise<void> {
    await this.intelligence.analyzeInteraction(input, output, metadata);
  }
}`
    });

    // Watcher intelligence
    files.push({
      path: `${watcherPath}/intelligence/${watcherName}Intelligence.ts`,
      content: `export class ${watcherName}Intelligence {
  
  async analyzeInteraction(input: string, output: string, metadata: any[]): Promise<void> {
    console.log(\`[${watcherName}Intelligence] Analyzing interaction for ${spec.name}\`);
    // Learning logic will be implemented here
  }
}`
    });

    // Watcher types
    files.push({
      path: `${watcherPath}/types/index.ts`,
      content: `export interface ${watcherName}Metrics {
  interactions: number;
  successRate: number;
  averageResponseTime: number;
}

export interface ${watcherName}Analysis {
  summary: string;
  patterns: string[];
  optimizations: string[];
}`
    });

    // Watcher index
    files.push({
      path: `${watcherPath}/index.ts`,
      content: `export { ${watcherName} } from './${watcherName}.js';
export * from './types/index.js';`
    });

    return files;
  }

  private async generateUpdatedMainIndex(spec: AgentSpec): Promise<string> {
    // This would need to read the current index.ts and update it
    // For now, return a basic version that includes the new agent
    return `import { Commander } from './agents/commander/Commander.js';
import { Architect } from './agents/architect/Architect.js';
import { Dashboard } from './agents/dashboard/Dashboard.js';
import { ${spec.name} } from './agents/${spec.name.toLowerCase()}/${spec.name}.js';

console.log('🚀 Starting AI Development Team...');

// Existing startup functions...
async function startCommander() {
  const commander = new Commander();
  await commander.start();
}

async function startArchitect() {
  const architectConfig = {
    architectToken: process.env.ARCHITECT_DISCORD_TOKEN!,
    architectChannelId: process.env.ARCHITECT_CHANNEL_ID!,
    claudeApiKey: process.env.CLAUDE_API_KEY!,
    discordToken: process.env.DISCORD_TOKEN
  };

  if (architectConfig.architectToken && architectConfig.architectChannelId) {
    const architect = new Architect(architectConfig);
    await architect.start();
  } else {
    console.log('[Architect] Environment variables not set, skipping architect startup');
  }
}

async function startDashboard() {
  const dashboardConfig = {
    dashboardToken: process.env.DASHBOARD_DISCORD_TOKEN!,
    dashboardChannelId: process.env.DASHBOARD_CHANNEL_ID!,
    agentCoordinationChannelId: process.env.AGENT_COORDINATION_CHANNEL_ID || '1393086808866426930',
    claudeApiKey: process.env.CLAUDE_API_KEY!
  };

  if (dashboardConfig.dashboardToken && dashboardConfig.dashboardChannelId) {
    const dashboard = new Dashboard(dashboardConfig);
    await dashboard.start();
  } else {
    console.log('[Dashboard] Environment variables not set, skipping dashboard startup');
  }
}

async function start${spec.name}() {
  const ${spec.name.toLowerCase()}Config = {
    ${spec.discordIntegration ? `${spec.name.toLowerCase()}Token: process.env.${spec.name.toUpperCase()}_DISCORD_TOKEN!,
    ${spec.name.toLowerCase()}ChannelId: process.env.${spec.name.toUpperCase()}_CHANNEL_ID!,
    ` : ''}claudeApiKey: process.env.CLAUDE_API_KEY!
  };

  if (${spec.discordIntegration ? `${spec.name.toLowerCase()}Config.${spec.name.toLowerCase()}Token && ${spec.name.toLowerCase()}Config.${spec.name.toLowerCase()}ChannelId` : 'true'}) {
    const ${spec.name.toLowerCase()} = new ${spec.name}(${spec.name.toLowerCase()}Config);
    await ${spec.name.toLowerCase()}.start();
  } else {
    console.log('[${spec.name}] Environment variables not set, skipping startup');
  }
}

// Start all systems
Promise.all([
  startCommander(),
  startArchitect(),
  startDashboard(),
  start${spec.name}()
]).catch(console.error);`;
  }

  private async generateBotRegistry(spec: AgentSpec, channelId: string): Promise<string> {
    const defaultBots = [
      {
        name: 'Commander',
        purpose: 'Universal task router and delegation',
        capabilities: ['task-routing', 'work-item-management', 'agent-coordination'],
        channelId: process.env.AGENT_CHANNEL_ID,
        isOnline: true,
        specialties: ['task-routing', 'work-item-management', 'agent-coordination'],
        lastSeen: new Date().toISOString()
      },
      {
        name: 'Architect', 
        purpose: 'System building and code modification',
        capabilities: ['system-modification', 'agent-creation', 'code-analysis'],
        channelId: process.env.ARCHITECT_CHANNEL_ID,
        isOnline: true,
        specialties: ['system-modification', 'agent-creation', 'code-analysis'],
        lastSeen: new Date().toISOString()
      },
      {
        name: spec.name,
        purpose: spec.purpose,
        capabilities: spec.capabilities,
        channelId,
        isOnline: true,
        specialties: spec.capabilities,
        lastSeen: new Date().toISOString()
      }
    ];

    return JSON.stringify(defaultBots, null, 2);
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
      voicePersonality: 'Professional and helpful',
      createWatcher: true,
      watcherPurpose: `Learning optimization patterns for ${name}`
    };
  }
}
