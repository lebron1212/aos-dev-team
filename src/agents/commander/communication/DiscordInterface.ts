import { Client, GatewayIntentBits, TextChannel, ThreadChannel, EmbedBuilder, Message } from 'discord.js';
import { WorkItem, AgentMessage, DiscordEmbed, CommanderConfig } from '../types/index.js';
import { FeedbackLearningSystem } from '../intelligence/FeedbackLearningSystem.js';

export class DiscordInterface {
  private client: Client;
  private userChannel: TextChannel | null = null;
  private agentChannel: TextChannel | null = null;
  private config: CommanderConfig;
  private workItemEmbeds: Map<string, Message> = new Map();
  private workItemThreads: Map<string, ThreadChannel> = new Map();
  private feedbackSystem: FeedbackLearningSystem;
  private messageContext: Map<string, {input: string, response: string}> = new Map();

  constructor(config: CommanderConfig) {
    this.config = config;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates
      ]
    });
    this.setupEventHandlers();
    this.setupFeedbackReactions();
    this.feedbackSystem = new FeedbackLearningSystem();
  }

  private setupEventHandlers(): void {
    this.client.once('ready', async () => {
      console.log(`[DiscordInterface] Connected as ${this.client.user?.tag}`);
      this.userChannel = this.client.channels.cache.get(this.config.userChannelId) as TextChannel;
      this.agentChannel = this.client.channels.cache.get(this.config.agentChannelId) as TextChannel;
      this.client.user?.setPresence({
        activities: [{ name: 'Building with AI', type: 3 }],
        status: 'online'
      });
    });
    this.client.on('error', (error) => {
      console.error('[DiscordInterface] Client error:', error);
    });
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
        await this.handleFeedbackReaction(reaction.message.id, feedbackType, user.id);
      }
    });
  }

  async handleFeedbackReaction(messageId: string, feedbackType: string, userId: string): Promise<void> {
    const context = this.messageContext.get(messageId);
    if (!context) return;
    
    if (feedbackType === 'suggestion') {
      setTimeout(async () => {
        await this.sendMessage('What should I have said instead? Reply with your suggestion.');
      }, 1000);
    } else {
      await this.feedbackSystem.logFeedback(context.input, context.response, feedbackType, 'Discord reaction');
    }
  }

  async trackMessage(input: string, response: string, messageId: string): Promise<void> {
    this.messageContext.set(messageId, { input, response });
  }

  async setupVMTIntegration(): Promise<void> {
    console.log('[DiscordInterface] VMT integration setup TODO');
  }

  async sendMessage(content: string): Promise<Message | null> {
    if (!this.userChannel) return null;
    try {
      return await this.userChannel.send(content);
    } catch (error) {
      console.error('[DiscordInterface] Failed to send message:', error);
      return null;
    }
  }

  async start(): Promise<void> {
    await this.client.login(this.config.discordToken);
  }

  get isReady(): boolean {
    return this.client.isReady();
  }

  get userChannelReady(): boolean {
    return !!this.userChannel;
  }
}
