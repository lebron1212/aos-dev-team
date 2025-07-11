import { Client, GatewayIntentBits, TextChannel, EmbedBuilder, Message } from 'discord.js';
import { ArchitectConfig } from '../types/index.js';

export class ArchitectDiscord {
  private client: Client;
  private architectChannel: TextChannel | null = null;
  private config: ArchitectConfig;
  private messageHandlers: Array<(message: Message) => Promise<void>> = [];
  private messageHistory: Array<{content: string, author: string, timestamp: Date}> = [];

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
        activities: [{ name: 'Building Systems', type: 3 }],
        status: 'online'
      });
    });

    this.client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      if (message.channelId !== this.config.architectChannelId) return;
      
      // Track all messages for context
      this.messageHistory.push({
        content: message.content,
        author: message.author.username,
        timestamp: new Date()
      });
      
      // Keep only recent messages (last 50)
      if (this.messageHistory.length > 50) {
        this.messageHistory = this.messageHistory.slice(-50);
      }
      
      for (const handler of this.messageHandlers) {
        await handler(message);
      }
    });
  }

  async getRecentMessages(count: number = 10): Promise<Array<{content: string, author: string, timestamp: Date}>> {
    return this.messageHistory.slice(-count);
  }

  onMessage(handler: (message: Message) => Promise<void>): void {
    this.messageHandlers.push(handler);
  }

  async sendMessage(content: string): Promise<Message | null> {
    if (!this.architectChannel) return null;
    
    try {
      return await this.architectChannel.send(content);
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

  async start(): Promise<void> {
    await this.client.login(this.config.architectToken);
  }

  get isReady(): boolean {
    return this.client.isReady();
  }
}
