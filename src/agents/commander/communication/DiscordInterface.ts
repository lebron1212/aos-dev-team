import { Client, GatewayIntentBits, TextChannel, ThreadChannel, EmbedBuilder, Message } from 'discord.js';
import { WorkItem, AgentMessage, DiscordEmbed, CommanderConfig } from '../types/index.js';

export class DiscordInterface {
  private client: Client;
  private userChannel: TextChannel | null = null;
  private agentChannel: TextChannel | null = null;
  private config: CommanderConfig;
  
  // Track active work item embeds for live updates
  private workItemEmbeds: Map<string, Message> = new Map();
  private workItemThreads: Map<string, ThreadChannel> = new Map();

  constructor(config: CommanderConfig) {
    this.config = config;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates // For voice message support
      ]
    });
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.once('ready', async () => {
      console.log(`[DiscordInterface] Connected as ${this.client.user?.tag}`);
      
      // Get channels
      this.userChannel = this.client.channels.cache.get(this.config.userChannelId) as TextChannel;
      this.agentChannel = this.client.channels.cache.get(this.config.agentChannelId) as TextChannel;
      
      if (!this.userChannel) {
        console.error('[DiscordInterface] User channel not found');
      }
      
      if (!this.agentChannel) {
        console.error('[DiscordInterface] Agent channel not found');
      }
      
      // Set presence
      this.client.user?.setPresence({
        activities: [{ name: 'Building with AI', type: 3 }],
        status: 'online'
      });
    });

    this.client.on('error', (error) => {
      console.error('[DiscordInterface] Client error:', error);
    });
  }

  async createWorkItemThread(workItem: WorkItem): Promise<ThreadChannel> {
    if (!this.userChannel) {
      throw new Error('User channel not available');
    }

    try {
      // Create rich embed for the work item
      const embed = this.createWorkItemEmbed(workItem);
      
      // Send embed message
      const embedMessage = await this.userChannel.send({ embeds: [embed] });
      
      // Create thread from the embed message
      const thread = await embedMessage.startThread({
        name: `${workItem.id} - ${workItem.title}`,
        autoArchiveDuration: 1440, // 24 hours
        reason: `Work item thread for ${workItem.id}`
      });
      
      // Store references
      this.workItemEmbeds.set(workItem.id, embedMessage);
      this.workItemThreads.set(workItem.id, thread);
      
      console.log(`[DiscordInterface] Created thread for work item ${workItem.id}`);
      
      return thread;
      
    } catch (error) {
      console.error('[DiscordInterface] Failed to create work item thread:', error);
      throw error;
    }
  }

  async updateWorkItemThread(workItem: WorkItem, message: string): Promise<void> {
    const thread = this.workItemThreads.get(workItem.id);
    const embedMessage = this.workItemEmbeds.get(workItem.id);
    
    if (thread) {
      // Send progress update to thread
      await thread.send(message);
    }
    
    if (embedMessage) {
      // Update the main embed with current status
      const updatedEmbed = this.createWorkItemEmbed(workItem);
      await embedMessage.edit({ embeds: [updatedEmbed] });
    }
  }

  async sendAgentMessage(agentMessage: AgentMessage): Promise<void> {
    if (!this.agentChannel) {
      console.warn('[DiscordInterface] Agent channel not available');
      return;
    }

    try {
      await this.agentChannel.send(agentMessage.content);
      console.log(`[DiscordInterface] Sent agent message from ${agentMessage.from} to ${agentMessage.to}`);
    } catch (error) {
      console.error('[DiscordInterface] Failed to send agent message:', error);
    }
  }

  private createWorkItemEmbed(workItem: WorkItem): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`${workItem.id} - ${workItem.title}`)
      .setDescription(workItem.description)
      .setColor(this.getStatusColor(workItem.status))
      .setTimestamp(workItem.startTime)
      .setFooter({ text: `Commander • ${workItem.primaryAgent}` });

    // Add status field
    embed.addFields({
      name: 'Status',
      value: `${this.getStatusEmoji(workItem.status)} ${workItem.status.toUpperCase()}`,
      inline: true
    });

    // Add progress field
    embed.addFields({
      name: 'Progress',
      value: this.getProgressBar(workItem.progress),
      inline: true
    });

    // Add assigned agents
    embed.addFields({
      name: 'Agents',
      value: workItem.assignedAgents.join(', '),
      inline: true
    });

    // Add estimated completion if available
    if (workItem.estimatedCompletion) {
      embed.addFields({
        name: 'ETA',
        value: `<t:${Math.floor(workItem.estimatedCompletion.getTime() / 1000)}:R>`,
        inline: true
      });
    }

    // Add outputs if completed
    if (workItem.status === 'completed' && workItem.outputs) {
      if (workItem.outputs.previewUrl) {
        embed.addFields({
          name: '→ Preview',
          value: `[View Preview](${workItem.outputs.previewUrl})`,
          inline: true
        });
      }
      
      if (workItem.outputs.prUrl) {
        embed.addFields({
          name: '→ Pull Request',
          value: `[View PR](${workItem.outputs.prUrl})`,
          inline: true
        });
      }
    }

    // Add errors if any
    if (workItem.errors && workItem.errors.length > 0) {
      embed.addFields({
        name: '× Issues',
        value: workItem.errors.slice(-3).join('\n'), // Show last 3 errors
        inline: false
      });
    }

    return embed;
  }

  private getStatusColor(status: string): number {
    switch (status) {
      case 'analyzing': return 0x3498db; // Blue
      case 'building': return 0xf39c12; // Orange
      case 'deploying': return 0x9b59b6; // Purple
      case 'completed': return 0x2ecc71; // Green
      case 'failed': return 0xe74c3c; // Red
      case 'cancelled': return 0x95a5a6; // Gray
      default: return 0x34495e; // Dark gray
    }
  }

  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'analyzing': return '■';
      case 'building': return '▶';
      case 'deploying': return '◆';
      case 'completed': return '✓';
      case 'failed': return '×';
      case 'cancelled': return '■';
      default: return '→';
    }
  }

  private getProgressBar(progress: number): string {
    const totalBars = 10;
    const filledBars = Math.round((progress / 100) * totalBars);
    const emptyBars = totalBars - filledBars;
    
    const filled = '█'.repeat(filledBars);
    const empty = '░'.repeat(emptyBars);
    
    return `\`[${filled}${empty}]\` ${progress}%`;
  }

  // VMT Integration Setup (for voice messages)
  async setupVMTIntegration(): Promise<void> {
    // TODO: Set up webhook or API integration with VMT bot
    // For now, we'll assume VMT will transcribe voice messages and send them as regular messages
    console.log('[DiscordInterface] VMT integration setup TODO');
    
    // When VMT is set up, it should:
    // 1. Detect voice messages in the user channel
    // 2. Transcribe them using OpenAI Whisper or similar
    // 3. Send transcribed text back to the channel
    // 4. Commander picks up the transcribed text as normal input
  }

  // Public utility methods
  async sendMessage(content: string): Promise<Message | null> {
    if (!this.userChannel) return null;
    
    try {
      return await this.userChannel.send(content);
    } catch (error) {
      console.error('[DiscordInterface] Failed to send message:', error);
      return null;
    }
  }

  async sendEmbed(embed: DiscordEmbed): Promise<Message | null> {
    if (!this.userChannel) return null;
    
    try {
      const discordEmbed = new EmbedBuilder()
        .setTitle(embed.title)
        .setDescription(embed.description || null)
        .setColor(embed.color)
        .setTimestamp(embed.timestamp ? new Date(embed.timestamp) : null);
      
      if (embed.fields) {
        discordEmbed.addFields(embed.fields);
      }
      
      if (embed.thumbnail) {
        discordEmbed.setThumbnail(embed.thumbnail.url);
      }
      
      if (embed.footer) {
        discordEmbed.setFooter({ text: embed.footer.text });
      }
      
      return await this.userChannel.send({ embeds: [discordEmbed] });
    } catch (error) {
      console.error('[DiscordInterface] Failed to send embed:', error);
      return null;
    }
  }

  async start(): Promise<void> {
    await this.client.login(this.config.discordToken);
  }

  async stop(): Promise<void> {
    await this.client.destroy();
  }

  // Getters
  get isReady(): boolean {
    return this.client.isReady();
  }

  get userChannelReady(): boolean {
    return !!this.userChannel;
  }

  get agentChannelReady(): boolean {
    return !!this.agentChannel;
  }
}
  setupFeedbackReactions(): void {
    this.client.on('messageReactionAdd', async (reaction, user) => {
      if (user.bot) return;
      if (reaction.message.author?.id !== this.client.user?.id) return;
      
      const emoji = reaction.emoji.name;
      let feedbackType = null;
      
      if (['👍', '✅', '💯'].includes(emoji)) feedbackType = 'positive';
      if (['👎', '❌'].includes(emoji)) feedbackType = 'negative'; 
      if (['🔄', '⚡'].includes(emoji)) feedbackType = 'suggestion';
      
      if (feedbackType) {
        console.log(`[Discord] Feedback: ${emoji} (${feedbackType})`);
      }
    });
  }
