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
 private waitingForSuggestion: string | null = null;

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

   this.client.on('messageCreate', async (message) => {
     if (message.author.bot) return;
     if (this.waitingForSuggestion && message.channelId === this.config.userChannelId) {
       const context = this.messageContext.get(this.waitingForSuggestion);
       if (context) {
         const suggestion = await this.feedbackSystem.extractSuggestion(message.content, context.response);
         await this.feedbackSystem.logFeedback(
           context.input, 
           context.response, 
           'suggestion', 
           'User correction via Discord', 
           suggestion
         );
         await this.sendMessage('Understood. Learning from that correction.');
         this.waitingForSuggestion = null;
       }
     }
     
     // Auto-detect feedback patterns using AI
     const lastMessage = Array.from(this.messageContext.values()).pop();
     if (lastMessage) {
       const isFeedback = await this.feedbackSystem.detectFeedback(message.content, lastMessage.response);
       if (isFeedback) {
         const suggestion = await this.feedbackSystem.extractSuggestion(message.content, lastMessage.response);
         await this.feedbackSystem.logFeedback(
           lastMessage.input,
           lastMessage.response,
           message.content,
           'Auto-detected AI feedback',
           suggestion
         );
         console.log('[DiscordInterface] AI detected and logged feedback');
       }
     }
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
     this.waitingForSuggestion = messageId;
     setTimeout(async () => {
       await this.sendMessage('What should I have said instead? Reply with your suggestion.');
     }, 1000);
   } else {
     await this.feedbackSystem.logFeedback(context.input, context.response, feedbackType, 'Discord reaction');
   }
 }

 async trackMessage(input: string, response: string, messageId: string): Promise<void> {
   this.messageContext.set(messageId, { input, response });
   // Keep only last 20 messages to prevent memory leaks
   if (this.messageContext.size > 20) {
     const firstKey = this.messageContext.keys().next().value;
     this.messageContext.delete(firstKey);
   }
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

 async sendAgentMessage(message: AgentMessage): Promise<void> {
   if (!this.agentChannel) return;
   try {
     await this.agentChannel.send(`🤖 ${message.from} → ${message.to}\n${message.content}`);
   } catch (error) {
     console.error('[DiscordInterface] Failed to send agent message:', error);
   }
 }

 async createWorkItemThread(workItem: WorkItem): Promise<ThreadChannel> {
   if (!this.userChannel) throw new Error('User channel not available');
   
   const thread = await this.userChannel.threads.create({
     name: `${workItem.id}: ${workItem.title}`,
     autoArchiveDuration: 1440,
     reason: `Work item thread for ${workItem.id}`
   });
   
   this.workItemThreads.set(workItem.id, thread);
   return thread;
 }

 async updateWorkItemThread(workItem: WorkItem, message: string): Promise<void> {
   const thread = this.workItemThreads.get(workItem.id);
   if (thread) {
     await thread.send(`📊 Progress: ${workItem.progress}% - ${message}`);
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

 async updateTrackedMessage(messageId: string, response: string): Promise<void> {
   const existing = this.messageContext.get(messageId);
   if (existing) {
     existing.response = response;
     console.log(`[DiscordInterface] Updated message context with response`);
   }
 }
