import { Client, GatewayIntentBits, TextChannel, EmbedBuilder, Message } from 'discord.js';
import { ArchitectConfig } from '../types/index.js';

export class ArchitectDiscord {
  private client: Client;
  private architectChannel: TextChannel | null = null;
  private config: ArchitectConfig;
  private messageHandlers: Array<(message: Message) => Promise<void>> = [];

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
      
      // Debug logging for channel setup
      console.log(`[ArchitectDiscord] Looking for channel ID: ${this.config.architectChannelId}`);
      
      this.architectChannel = this.client.channels.cache.get(this.config.architectChannelId) as TextChannel;
      
      if (this.architectChannel) {
        console.log(`[ArchitectDiscord] Channel found: #${this.architectChannel.name}`);
      } else {
        console.error(`[ArchitectDiscord] Channel not found! ID: ${this.config.architectChannelId}`);
        console.log(`[ArchitectDiscord] Available channels:`, this.client.channels.cache.map(c => `${c.id} (#${(c as TextChannel).name})`));
        
        // Try to fetch the channel directly from the API
        try {
          const channel = await this.client.channels.fetch(this.config.architectChannelId);
          if (channel && channel.isTextBased()) {
            this.architectChannel = channel as TextChannel;
            console.log(`[ArchitectDiscord] Channel fetched from API: #${this.architectChannel.name}`);
          }
        } catch (fetchError) {
          console.error(`[ArchitectDiscord] Failed to fetch channel from API:`, fetchError);
          console.log(`[ArchitectDiscord] Bot may not have access to channel ${this.config.architectChannelId}`);
        }
      }
      
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

    this.client.on('error', (error) => {
      console.error('[ArchitectDiscord] Client error:', error);
    });
  }

  onMessage(handler: (message: Message) => Promise<void>): void {
    this.messageHandlers.push(handler);
  }

  async sendMessage(content: string): Promise<Message | null> {
    if (!this.architectChannel) {
      console.log(`[ArchitectDiscord] Cannot send message - channel not available (ID: ${this.config.architectChannelId})`);
      return null;
    }
    
    try {
      return await this.architectChannel.send(content);
    } catch (error) {
      console.error('[ArchitectDiscord] Failed to send message:', error);
      return null;
    }
  }

  async sendEmbed(title: string, description: string, color: number = 0x3498db): Promise<Message | null> {
    if (!this.architectChannel) {
      console.log(`[ArchitectDiscord] Cannot send embed - channel not available (ID: ${this.config.architectChannelId})`);
      return null;
    }
    
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
    return this.client.isReady() && this.architectChannel !== null;
  }
}
