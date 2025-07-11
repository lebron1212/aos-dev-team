import { Client, GatewayIntentBits, Message, TextChannel } from 'discord.js';
import { DashboardConfig, AgentMessage } from '../types/index.js';

export class DashboardDiscord {
  private client: Client;
  private config: DashboardConfig;
  private dashboardChannel: TextChannel | null = null;
  private coordinationChannel: TextChannel | null = null;
  private messageHandler: ((message: Message) => Promise<void>) | null = null;
  private ready = false;

  constructor(config: DashboardConfig) {
    this.config = config;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });

    this.setupEventHandlers();
    console.log('[DashboardDiscord] Discord interface initialized');
  }

  private setupEventHandlers(): void {
    this.client.on('ready', async () => {
      console.log(`[DashboardDiscord] Bot logged in as ${this.client.user?.tag}`);
      
      try {
        // Get dashboard channel
        this.dashboardChannel = await this.client.channels.fetch(this.config.dashboardChannelId) as TextChannel;
        console.log(`[DashboardDiscord] Connected to dashboard channel: ${this.dashboardChannel?.name}`);

        // Get coordination channel
        this.coordinationChannel = await this.client.channels.fetch(this.config.agentCoordinationChannelId) as TextChannel;
        console.log(`[DashboardDiscord] Connected to coordination channel: ${this.coordinationChannel?.name}`);

        this.ready = true;
        
        // Send startup message
        await this.sendMessage('🎯 **Dashboard Agent Online**\n\nSystem monitoring and AI insights ready. Ask me about performance, costs, or system health!');
        
      } catch (error) {
        console.error('[DashboardDiscord] Error setting up channels:', error);
      }
    });

    this.client.on('messageCreate', async (message: Message) => {
      // Ignore bot messages
      if (message.author.bot) return;
      
      // Only handle messages in dashboard channel
      if (message.channel.id !== this.config.dashboardChannelId) return;
      
      // Handle the message
      if (this.messageHandler) {
        try {
          await this.messageHandler(message);
        } catch (error) {
          console.error('[DashboardDiscord] Error handling message:', error);
          await message.reply('❌ Error processing your request. Please try again.');
        }
      }
    });

    this.client.on('error', (error) => {
      console.error('[DashboardDiscord] Discord client error:', error);
    });

    this.client.on('disconnect', () => {
      console.log('[DashboardDiscord] Disconnected from Discord');
      this.ready = false;
    });
  }

  async start(): Promise<void> {
    try {
      await this.client.login(this.config.dashboardToken);
      console.log('[DashboardDiscord] Successfully connected to Discord');
    } catch (error) {
      console.error('[DashboardDiscord] Failed to connect to Discord:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.dashboardChannel) {
      await this.sendMessage('🔄 **Dashboard Agent Offline**\n\nSystem monitoring paused. Agent will restart automatically.');
    }
    
    this.client.destroy();
    this.ready = false;
    console.log('[DashboardDiscord] Discord connection closed');
  }

  onMessage(handler: (message: Message) => Promise<void>): void {
    this.messageHandler = handler;
  }

  async sendMessage(content: string): Promise<void> {
    if (!this.ready || !this.dashboardChannel) {
      console.warn('[DashboardDiscord] Cannot send message - not ready or no channel');
      return;
    }

    try {
      // Split long messages to avoid Discord limits
      const chunks = this.splitMessage(content);
      
      for (const chunk of chunks) {
        await this.dashboardChannel.send(chunk);
      }
    } catch (error) {
      console.error('[DashboardDiscord] Failed to send message:', error);
    }
  }

  async replyToMessage(message: Message, content: string): Promise<void> {
    try {
      const chunks = this.splitMessage(content);
      
      // Reply to first chunk, send rest as regular messages
      await message.reply(chunks[0]);
      
      for (let i = 1; i < chunks.length; i++) {
        await (message.channel as any).send(chunks[i]);
      }
    } catch (error) {
      console.error('[DashboardDiscord] Failed to reply to message:', error);
    }
  }

  async sendToCoordinationChannel(agentMessage: AgentMessage): Promise<void> {
    if (!this.ready || !this.coordinationChannel) {
      console.warn('[DashboardDiscord] Cannot send to coordination channel - not ready');
      return;
    }

    try {
      const formattedMessage = this.formatAgentMessage(agentMessage);
      await this.coordinationChannel.send(formattedMessage);
      console.log(`[DashboardDiscord] Sent ${agentMessage.type} to coordination channel`);
    } catch (error) {
      console.error('[DashboardDiscord] Failed to send to coordination channel:', error);
    }
  }

  async sendOptimizationRequest(
    targetAgent: 'Commander' | 'Architect',
    request: string,
    userContext: string,
    threadId?: string
  ): Promise<void> {
    const agentMessage: AgentMessage = {
      from: 'Dashboard',
      to: targetAgent,
      type: 'optimization_request',
      priority: 'medium',
      data: {
        operation: 'optimization_request',
        metrics: {} as any, // Would include actual metrics
        recommendations: [request],
        userContext,
        threadId
      },
      timestamp: new Date().toISOString(),
      requiresResponse: true
    };

    await this.sendToCoordinationChannel(agentMessage);
  }

  async sendPerformanceReport(
    targetAgent: 'Commander' | 'Architect' | 'all',
    report: string
  ): Promise<void> {
    const agentMessage: AgentMessage = {
      from: 'Dashboard',
      to: targetAgent,
      type: 'performance_report',
      priority: 'low',
      data: {
        operation: 'performance_report',
        metrics: {} as any,
        recommendations: [report],
        userContext: 'System performance analysis'
      },
      timestamp: new Date().toISOString(),
      requiresResponse: false
    };

    await this.sendToCoordinationChannel(agentMessage);
  }

  async sendCostAlert(
    targetAgent: 'Commander' | 'Architect' | 'all',
    alert: string,
    severity: 'low' | 'medium' | 'high' | 'urgent'
  ): Promise<void> {
    const agentMessage: AgentMessage = {
      from: 'Dashboard',
      to: targetAgent,
      type: 'cost_alert',
      priority: severity,
      data: {
        operation: 'cost_alert',
        metrics: {} as any,
        recommendations: [alert],
        userContext: 'Cost monitoring alert'
      },
      timestamp: new Date().toISOString(),
      requiresResponse: severity === 'high' || severity === 'urgent'
    };

    await this.sendToCoordinationChannel(agentMessage);
  }

  private formatAgentMessage(agentMessage: AgentMessage): string {
    const priorityIcon = {
      low: '🟢',
      medium: '🟡', 
      high: '🔴',
      urgent: '🚨'
    }[agentMessage.priority];

    const typeIcon = {
      optimization_request: '🔧',
      performance_report: '📊',
      cost_alert: '💰',
      health_check: '🩺'
    }[agentMessage.type];

    let message = `${typeIcon} **${agentMessage.type.toUpperCase()}** ${priorityIcon}\n`;
    message += `**From**: ${agentMessage.from} **To**: ${agentMessage.to}\n`;
    message += `**Time**: ${new Date(agentMessage.timestamp).toLocaleString()}\n\n`;
    
    message += `**Request**: ${agentMessage.data.recommendations.join(', ')}\n`;
    message += `**Context**: ${agentMessage.data.userContext}\n`;
    
    if (agentMessage.requiresResponse) {
      message += `\n⚠️ **Response Required**`;
    }
    
    if (agentMessage.data.threadId) {
      message += `\n🧵 **Thread**: <#${agentMessage.data.threadId}>`;
    }

    return message;
  }

  private splitMessage(content: string): string[] {
    const maxLength = 2000; // Discord message limit
    const chunks: string[] = [];
    
    if (content.length <= maxLength) {
      return [content];
    }

    // Split on newlines first, then on words if needed
    const lines = content.split('\n');
    let currentChunk = '';
    
    for (const line of lines) {
      if ((currentChunk + line + '\n').length > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        
        // If single line is too long, split on words
        if (line.length > maxLength) {
          const words = line.split(' ');
          let wordChunk = '';
          
          for (const word of words) {
            if ((wordChunk + word + ' ').length > maxLength) {
              if (wordChunk) {
                chunks.push(wordChunk.trim());
                wordChunk = '';
              }
              // If single word is too long, truncate
              chunks.push(word.substring(0, maxLength - 3) + '...');
            } else {
              wordChunk += word + ' ';
            }
          }
          
          if (wordChunk) {
            currentChunk = wordChunk;
          }
        } else {
          currentChunk = line + '\n';
        }
      } else {
        currentChunk += line + '\n';
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  // Getters for status checks
  get isReady(): boolean {
    return this.ready;
  }

  get dashboardChannelReady(): boolean {
    return this.dashboardChannel !== null;
  }

  get coordinationChannelReady(): boolean {
    return this.coordinationChannel !== null;
  }

  get user() {
    return this.client.user;
  }
}