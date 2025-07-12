import { Client, GatewayIntentBits, TextChannel, EmbedBuilder, Message } from 'discord.js';
import { ArchitectConfig, ArchitecturalRequest } from '../types/index.js';

interface Command {
  name: string;
  description: string;
  usage: string;
  examples: string[];
}

interface ParsedCommand {
  command: string;
  subcommand?: string;
  target?: string;
  description?: string;
  args: string[];
  fullText: string;
}

export class ArchitectDiscord {
  private client: Client;
  private architectChannel: TextChannel | null = null;
  private config: ArchitectConfig;
  private messageHandlers: Array<(message: Message) => Promise<void>> = [];
  
  private commands: Map<string, Command> = new Map([
    ['build', {
      name: 'build',
      description: 'Build new agents or components',
      usage: '/build agent <name> <description>',
      examples: [
        '/build agent Chronicler "Idea storage and queue management system"',
        '/build agent Builder "Code generation and implementation system"'
      ]
    }],
    ['analyze', {
      name: 'analyze',
      description: 'Analyze code or system components',
      usage: '/analyze <target> [specific-component]',
      examples: [
        '/analyze code',
        '/analyze system health',
        '/analyze commander voice'
      ]
    }],
    ['modify', {
      name: 'modify',
      description: 'Modify existing system components',
      usage: '/modify <component> <change-description>',
      examples: [
        '/modify commander "increase response length to 2-3 sentences"',
        '/modify voice "tone down humor by 20%"'
      ]
    }],
    ['setup', {
      name: 'setup',
      description: 'Setup integrations and configurations',
      usage: '/setup discord <agent-name>',
      examples: [
        '/setup discord Dashboard',
        '/setup discord Chronicler'
      ]
    }],
    ['status', {
      name: 'status',
      description: 'Check system status and health',
      usage: '/status [component]',
      examples: [
        '/status',
        '/status system',
        '/status agents'
      ]
    }],
    ['help', {
      name: 'help',
      description: 'Show available commands and usage',
      usage: '/help [command]',
      examples: [
        '/help',
        '/help build',
        '/help modify'
      ]
    }]
  ]);

  constructor(config: ArchitectConfig) {
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
      console.log(`[ArchitectDiscord] Connected as ${this.client.user?.tag}`);
      this.architectChannel = this.client.channels.cache.get(this.config.architectChannelId) as TextChannel;
      
      this.client.user?.setPresence({
        activities: [{ name: 'Building Systems | /help for commands', type: 3 }],
        status: 'online'
      });

      // Send startup message with command info
      await this.sendMessage(`🏗️ **Architect Online** - Command-driven system building ready!

**Quick Commands:**
\`/build agent <name> <description>\` - Create new agent
\`/analyze <target>\` - Analyze code/system  
\`/modify <component> <change>\` - Modify existing code
\`/setup discord <agent>\` - Setup Discord integration
\`/status\` - System health check
\`/help\` - Full command reference

Natural language also supported with confirmation prompts.`);
    });

    this.client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      if (message.channelId !== this.config.architectChannelId) return;
      
      // Handle command or natural language
      const response = await this.processMessage(message);
      if (response) {
        await this.sendMessage(response);
      }
      
      // Call registered handlers for backward compatibility
      for (const handler of this.messageHandlers) {
        await handler(message);
      }
    });
  }

  private async processMessage(message: Message): Promise<string | null> {
    const content = message.content.trim();
    
    // Handle commands
    if (content.startsWith('/')) {
      return await this.handleCommand(content, message.author.id);
    }
    
    // Handle natural language with confirmation
    return await this.handleNaturalLanguage(content, message.author.id);
  }

  private async handleCommand(input: string, userId: string): Promise<string> {
    try {
      const parsed = this.parseCommand(input);
      
      if (!parsed) {
        return `❌ Invalid command format. Use \`/help\` to see available commands.`;
      }

      // Route to appropriate handler
      switch (parsed.command) {
        case 'build':
          return await this.handleBuildCommand(parsed);
        
        case 'analyze':
          return await this.handleAnalyzeCommand(parsed);
        
        case 'modify':
          return await this.handleModifyCommand(parsed);
        
        case 'setup':
          return await this.handleSetupCommand(parsed);
        
        case 'status':
          return await this.handleStatusCommand(parsed);
        
        case 'help':
          return this.handleHelpCommand(parsed);
        
        default:
          return `❌ Unknown command: \`${parsed.command}\`. Use \`/help\` to see available commands.`;
      }
    } catch (error) {
      console.error('[ArchitectDiscord] Command handling error:', error);
      return `❌ Error processing command: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async handleNaturalLanguage(input: string, userId: string): Promise<string | null> {
    // Detect intent and ask for confirmation
    const detectedIntent = this.detectIntent(input);
    
    if (detectedIntent) {
      return `🤔 I detected this intent: **${detectedIntent.description}**

Suggested command: \`${detectedIntent.command}\`

Type \`yes\` to proceed, or use the command directly for better accuracy.`;
    }
    
    return null; // Let existing handlers process
  }

  private parseCommand(input: string): ParsedCommand | null {
    const parts = input.slice(1).split(' ').filter(p => p.length > 0);
    
    if (parts.length === 0) return null;
    
    const command = parts[0].toLowerCase();
    
    // Parse based on command type
    switch (command) {
      case 'build':
        if (parts.length < 3) return null;
        const subcommand = parts[1]; // 'agent'
        const target = parts[2]; // agent name
        const description = parts.slice(3).join(' '); // description
        return { command, subcommand, target, description, args: parts.slice(3), fullText: input };
      
      case 'analyze':
      case 'modify':
      case 'setup':
        if (parts.length < 2) return null;
        return {
          command,
          target: parts[1],
          description: parts.slice(2).join(' '),
          args: parts.slice(2),
          fullText: input
        };
      
      case 'status':
      case 'help':
        return {
          command,
          target: parts[1],
          args: parts.slice(1),
          fullText: input
        };
      
      default:
        return null;
    }
  }

  private async handleBuildCommand(parsed: ParsedCommand): Promise<string> {
    if (parsed.subcommand !== 'agent') {
      return `❌ Build subcommand not supported: \`${parsed.subcommand}\`
      
**Usage:** \`/build agent <name> <description>\`
**Example:** \`/build agent Chronicler "Idea storage and queue management"\``;
    }

    if (!parsed.target || !parsed.description) {
      return `❌ Missing required parameters for agent creation.

**Usage:** \`/build agent <name> <description>\`
**Example:** \`/build agent Chronicler "Idea storage and queue management"\``;
    }

    // Create architectural request for agent creation
    const request: ArchitecturalRequest = {
      type: 'agent-creation',
      description: `Create ${parsed.target} agent: ${parsed.description}`,
      target: parsed.target,
      priority: 'high',
      riskLevel: 'medium'
    };

    // Execute through handlers
    for (const handler of this.messageHandlers) {
      // Create a mock message object for handlers
      const mockMessage = {
        content: `Build ${parsed.target} agent with: ${parsed.description}`,
        author: { id: 'command-system' },
        id: `cmd_${Date.now()}`
      } as Message;
      
      await handler(mockMessage);
    }

    return `🏗️ **Agent Creation Started**

**Agent:** ${parsed.target}
**Description:** ${parsed.description}
**Status:** Building agent structure with full Discord integration

This will create:
- Complete agent architecture
- Discord bot setup (if integration enabled)
- Learning watcher system
- Full EPOCH I compliance

⏱️ Estimated completion: 2-3 minutes`;
  }

  private async handleAnalyzeCommand(parsed: ParsedCommand): Promise<string> {
    if (!parsed.target) {
      return `❌ Analysis target required.

**Usage:** \`/analyze <target>\`
**Examples:**
- \`/analyze code\` - Analyze codebase health
- \`/analyze system\` - Check system status
- \`/analyze commander voice\` - Analyze specific component`;
    }

    // Create analysis request
    const request: ArchitecturalRequest = {
      type: 'code-analysis',
      description: `Analyze ${parsed.target}${parsed.description ? ': ' + parsed.description : ''}`,
      target: parsed.target,
      priority: 'medium',
      riskLevel: 'low'
    };

    // Execute through handlers
    for (const handler of this.messageHandlers) {
      const mockMessage = {
        content: `Analyze ${parsed.target} ${parsed.description || ''}`,
        author: { id: 'command-system' },
        id: `cmd_${Date.now()}`
      } as Message;
      
      await handler(mockMessage);
    }

    return `🔍 **Analysis Started**

**Target:** ${parsed.target}
**Scope:** ${parsed.description || 'Comprehensive analysis'}

Running system analysis...`;
  }

  private async handleModifyCommand(parsed: ParsedCommand): Promise<string> {
    if (!parsed.target || !parsed.description) {
      return `❌ Modification requires target and description.

**Usage:** \`/modify <component> <change>\`
**Examples:**
- \`/modify commander "increase response length to 2-3 sentences"\`
- \`/modify voice "tone down humor by 20%"\``;
    }

    // Create modification request
    const request: ArchitecturalRequest = {
      type: 'system-modification',
      description: `Modify ${parsed.target}: ${parsed.description}`,
      target: parsed.target,
      priority: 'medium',
      riskLevel: 'medium'
    };

    // Execute through handlers
    for (const handler of this.messageHandlers) {
      const mockMessage = {
        content: `Modify ${parsed.target}: ${parsed.description}`,
        author: { id: 'command-system' },
        id: `cmd_${Date.now()}`
      } as Message;
      
      await handler(mockMessage);
    }

    return `🔧 **Modification Started**

**Component:** ${parsed.target}
**Change:** ${parsed.description}

Analyzing current configuration and planning modifications...`;
  }

  private async handleSetupCommand(parsed: ParsedCommand): Promise<string> {
    if (!parsed.target) {
      return `❌ Setup requires target specification.

**Usage:** \`/setup discord <agent-name>\`
**Example:** \`/setup discord Dashboard\``;
    }

    if (parsed.target === 'discord') {
      if (!parsed.description) {
        return `❌ Discord setup requires agent name.

**Usage:** \`/setup discord <agent-name>\`
**Example:** \`/setup discord Dashboard\``;
      }

      // Create Discord bot setup request
      const request: ArchitecturalRequest = {
        type: 'discord-bot-setup',
        description: `Set up Discord bot for ${parsed.description} agent`,
        target: parsed.description,
        priority: 'medium',
        riskLevel: 'medium'
      };

      // Execute through handlers
      for (const handler of this.messageHandlers) {
        const mockMessage = {
          content: `Set up Discord bot for ${parsed.description} agent`,
          author: { id: 'command-system' },
          id: `cmd_${Date.now()}`
        } as Message;
        
        await handler(mockMessage);
      }

      return `🤖 **Discord Bot Setup Started**

**Agent:** ${parsed.description}

This will:
- Create Discord application
- Generate bot token  
- Set up dedicated channel
- Configure environment variables
- Enable automatic deployment

⏱️ Estimated completion: 1-2 minutes`;
    }

    return `❌ Setup type not supported: ${parsed.target}

**Available:** \`discord\``;
  }

  private async handleStatusCommand(parsed: ParsedCommand): Promise<string> {
    // Create status request
    const request: ArchitecturalRequest = {
      type: 'system-status',
      description: `System status check${parsed.target ? ' for ' + parsed.target : ''}`,
      target: parsed.target,
      priority: 'low',
      riskLevel: 'low'
    };

    // Execute through handlers
    for (const handler of this.messageHandlers) {
      const mockMessage = {
        content: `System status${parsed.target ? ' ' + parsed.target : ''}`,
        author: { id: 'command-system' },
        id: `cmd_${Date.now()}`
      } as Message;
      
      await handler(mockMessage);
    }

    return `📊 **System Status Check**

Checking system health and component status...`;
  }

  private handleHelpCommand(parsed: ParsedCommand): string {
    if (parsed.target) {
      const command = this.commands.get(parsed.target);
      if (command) {
        return `📖 **Command Help: /${command.name}**

**Description:** ${command.description}
**Usage:** \`${command.usage}\`

**Examples:**
${command.examples.map(ex => `- \`${ex}\``).join('\n')}`;
      } else {
        return `❌ Unknown command: \`${parsed.target}\`

Use \`/help\` to see all available commands.`;
      }
    }

    // Show all commands
    const commandList = Array.from(this.commands.values())
      .map(cmd => `\`${cmd.usage}\` - ${cmd.description}`)
      .join('\n');

    return `📖 **Architect Commands**

${commandList}

**Examples:**
- \`/build agent Chronicler "Idea storage system"\`
- \`/analyze code\`
- \`/modify commander "increase response length"\`
- \`/setup discord Dashboard\`

Use \`/help <command>\` for detailed help on specific commands.`;
  }

  private detectIntent(input: string): { description: string; command: string } | null {
    const lower = input.toLowerCase();
    
    // Agent creation patterns
    if ((lower.includes('build') || lower.includes('create')) && lower.includes('agent')) {
      const agentMatch = input.match(/(?:build|create)\s+(\w+)\s+agent/i);
      const agentName = agentMatch ? agentMatch[1] : 'NewAgent';
      return {
        description: 'Agent creation',
        command: `/build agent ${agentName} "${input}"`
      };
    }
    
    // Analysis patterns
    if (lower.includes('analyze') || lower.includes('check') || (lower.includes('how') && lower.includes('work'))) {
      return {
        description: 'Code/system analysis',
        command: `/analyze ${input.split(' ').slice(1).join(' ')}`
      };
    }
    
    // Modification patterns
    if (lower.includes('modify') || lower.includes('change') || lower.includes('update') || lower.includes('fix')) {
      return {
        description: 'System modification',
        command: `/modify ${input}`
      };
    }
    
    // Discord setup patterns
    if (lower.includes('discord') && (lower.includes('setup') || lower.includes('bot'))) {
      const agentMatch = input.match(/(\w+)\s+agent/i);
      const agentName = agentMatch ? agentMatch[1] : 'Agent';
      return {
        description: 'Discord bot setup',
        command: `/setup discord ${agentName}`
      };
    }
    
    return null;
  }

  onMessage(handler: (message: Message) => Promise<void>): void {
    this.messageHandlers.push(handler);
  }

  async sendMessage(content: string): Promise<Message | null> {
    if (!this.architectChannel) return null;
    
    try {
      // Split long messages
      const chunks = this.splitMessage(content);
      let lastMessage: Message | null = null;
      
      for (const chunk of chunks) {
        lastMessage = await this.architectChannel.send(chunk);
      }
      
      return lastMessage;
    } catch (error) {
      console.error('[ArchitectDiscord] Failed to send message:', error);
      return null;
    }
  }

  async sendEmbed(title: string, description: string, color: number = 0x3498db): Promise<Message | null> {
    if (!this.architectChannel) return null;
    
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color)
      .setTimestamp();
    
    try {
      return await this.architectChannel.send({ embeds: [embed] });
    } catch (error) {
      console.error('[ArchitectDiscord] Failed to send embed:', error);
      return null;
    }
  }

  private splitMessage(content: string): string[] {
    const maxLength = 2000;
    if (content.length <= maxLength) return [content];
    
    const chunks: string[] = [];
    let current = '';
    
    const lines = content.split('\n');
    for (const line of lines) {
      if ((current + line + '\n').length > maxLength) {
        if (current) chunks.push(current.trim());
        current = line + '\n';
      } else {
        current += line + '\n';
      }
    }
    
    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }

  async start(): Promise<void> {
    await this.client.login(this.config.architectToken);
  }

  get isReady(): boolean {
    return this.client.isReady();
  }
}
