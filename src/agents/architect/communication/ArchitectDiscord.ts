import { Client, GatewayIntentBits, TextChannel, EmbedBuilder, Message, SlashCommandBuilder, REST, Routes, CommandInteraction } from 'discord.js';
import { ArchitectConfig } from '../types/index.js';

export class ArchitectDiscord {
  private client: Client;
  private architectChannel: TextChannel | null = null;
  private config: ArchitectConfig;
  private messageHandlers: Array<(message: Message) => Promise<void>> = [];
  private slashCommandHandlers: Array<(interaction: CommandInteraction) => Promise<void>> = [];

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
      console.log(`[ArchitectDiscord] Looking for channel ID: ${this.config.architectChannelId}`);
      
      this.architectChannel = this.client.channels.cache.get(this.config.architectChannelId) as TextChannel;
      
      if (this.architectChannel) {
        console.log(`[ArchitectDiscord] Channel found: #${this.architectChannel.name}`);
      } else {
        console.error(`[ArchitectDiscord] Channel not found: ${this.config.architectChannelId}`);
      }
      
      // Register slash commands
      await this.registerSlashCommands();
      
      this.client.user?.setPresence({
        activities: [{ name: 'Building Systems', type: 3 }],
        status: 'online'
      });
    });

    this.client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      if (message.channelId !== this.config.architectChannelId) return;
      
      for (const handler of this.messageHandlers) {
        await handler(message);
      }
    });

    // Handle slash command interactions
    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      if (interaction.channelId !== this.config.architectChannelId) return;

      for (const handler of this.slashCommandHandlers) {
        await handler(interaction);
      }
    });
  }

  private async registerSlashCommands(): Promise<void> {
    const commands = [
      new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show comprehensive Architect help and capabilities'),
      
      new SlashCommandBuilder()
        .setName('status')
        .setDescription('Check system health and performance'),
      
      new SlashCommandBuilder()
        .setName('analyze')
        .setDescription('Analyze code or system components')
        .addStringOption(option =>
          option.setName('target')
            .setDescription('What to analyze (e.g., "performance", "code health", "configuration")')
            .setRequired(false)),
      
      new SlashCommandBuilder()
        .setName('build')
        .setDescription('Build agents, components, or features')
        .addStringOption(option =>
          option.setName('description')
            .setDescription('What to build (e.g., "agent named TestBot for ping responses")')
            .setRequired(true)),
      
      new SlashCommandBuilder()
        .setName('fix')
        .setDescription('Fix system issues or bugs')
        .addStringOption(option =>
          option.setName('issue')
            .setDescription('What to fix (e.g., "buildCompleteAgent method", "JSON parsing")')
            .setRequired(true)),
      
      new SlashCommandBuilder()
        .setName('modify')
        .setDescription('Modify system configuration or code')
        .addStringOption(option =>
          option.setName('change')
            .setDescription('What to modify (e.g., "increase timeout to 30 seconds")')
            .setRequired(true)),
      
      new SlashCommandBuilder()
        .setName('examples')
        .setDescription('Show copy-paste examples for common tasks'),
      
      new SlashCommandBuilder()
        .setName('pending')
        .setDescription('View pending approvals'),
      
      new SlashCommandBuilder()
        .setName('approve')
        .setDescription('Approve pending high-risk modifications'),
      
      new SlashCommandBuilder()
        .setName('undo')
        .setDescription('Undo the last modification'),
      
      new SlashCommandBuilder()
        .setName('deploy')
        .setDescription('Deploy changes to production')
        .addStringOption(option =>
          option.setName('environment')
            .setDescription('Target environment')
            .setRequired(false)
            .addChoices(
              { name: 'staging', value: 'staging' },
              { name: 'production', value: 'production' }
            ))
    ];

    const rest = new REST().setToken(this.config.architectToken);

    try {
      console.log('[ArchitectDiscord] Registering slash commands...');

      await rest.put(
        Routes.applicationCommands(this.client.user!.id),
        { body: commands }
      );

      console.log('[ArchitectDiscord] ✅ Slash commands registered successfully');
    } catch (error) {
      console.error('[ArchitectDiscord] Failed to register slash commands:', error);
    }
  }

  onMessage(handler: (message: Message) => Promise<void>): void {
    this.messageHandlers.push(handler);
  }

  onSlashCommand(handler: (interaction: CommandInteraction) => Promise<void>): void {
    this.slashCommandHandlers.push(handler);
  }

  async sendMessage(content: string): Promise<Message | null> {
    if (!this.architectChannel) return null;
    
    try {
      // Split long messages if needed
      if (content.length > 2000) {
        const chunks = this.splitMessage(content);
        let lastMessage: Message | null = null;
        
        for (const chunk of chunks) {
          lastMessage = await this.architectChannel.send(chunk);
        }
        
        return lastMessage;
      }
      
      return await this.architectChannel.send(content);
    } catch (error) {
      console.error('[ArchitectDiscord] Failed to send message:', error);
      return null;
    }
  }

  async replyToInteraction(interaction: CommandInteraction, content: string): Promise<void> {
    try {
      if (content.length > 2000) {
        // For long responses, reply with first chunk and follow up with rest
        const chunks = this.splitMessage(content);
        await interaction.reply(chunks[0]);
        
        for (let i = 1; i < chunks.length; i++) {
          await interaction.followUp(chunks[i]);
        }
      } else {
        await interaction.reply(content);
      }
    } catch (error) {
      console.error('[ArchitectDiscord] Failed to reply to interaction:', error);
      try {
        await interaction.reply('❌ Error processing command. Please try again.');
      } catch (fallbackError) {
        console.error('[ArchitectDiscord] Failed to send fallback reply:', fallbackError);
      }
    }
  }

  private splitMessage(content: string): string[] {
    const chunks: string[] = [];
    const maxLength = 1900; // Leave room for formatting
    
    let currentChunk = '';
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        
        // If single line is too long, split it
        if (line.length > maxLength) {
          for (let i = 0; i < line.length; i += maxLength) {
            chunks.push(line.substring(i, i + maxLength));
          }
        } else {
          currentChunk = line;
        }
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
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

  async start(): Promise<void> {
    await this.client.login(this.config.architectToken);
  }

  get isReady(): boolean {
    return this.client.isReady();
  }
}
