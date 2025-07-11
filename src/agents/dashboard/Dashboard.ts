import { Message } from 'discord.js';
import { DashboardConfig, DashboardQuery, AgentActivity } from './types/index.js';
import { DashboardDiscord } from './communication/DashboardDiscord.js';
import { DashboardVoice } from './communication/DashboardVoice.js';
import { DashboardOrchestrator } from './core/DashboardOrchestrator.js';
import { APIUsageTracker } from './intelligence/APIUsageTracker.js';
import { PerformanceAnalyzer } from './intelligence/PerformanceAnalyzer.js';
import { DashboardIntelligence } from './intelligence/DashboardIntelligence.js';

export class Dashboard {
  private discord: DashboardDiscord;
  private voice: DashboardVoice;
  private orchestrator: DashboardOrchestrator;
  private usageTracker: APIUsageTracker;
  private performanceAnalyzer: PerformanceAnalyzer;
  private intelligence: DashboardIntelligence;
  private config: DashboardConfig;
  private anomalyCheckInterval: NodeJS.Timeout | null = null;
  private healthReportInterval: NodeJS.Timeout | null = null;

  constructor(config: DashboardConfig) {
    this.config = config;
    
    // Initialize core systems
    this.usageTracker = new APIUsageTracker();
    this.performanceAnalyzer = new PerformanceAnalyzer(this.usageTracker);
    this.intelligence = new DashboardIntelligence(
      config.claudeApiKey,
      this.usageTracker,
      this.performanceAnalyzer
    );
    
    // Initialize communication systems
    this.discord = new DashboardDiscord(config);
    this.voice = new DashboardVoice(config.claudeApiKey);
    
    // Initialize orchestrator
    this.orchestrator = new DashboardOrchestrator(
      config,
      this.usageTracker,
      this.performanceAnalyzer,
      this.intelligence,
      this.voice,
      this.discord
    );
    
    this.setupMessageHandling();
    console.log('[Dashboard] Dashboard Agent initialized');
  }

  async start(): Promise<void> {
    console.log('[Dashboard] Starting Dashboard Agent...');
    
    // Start Discord interface
    await this.discord.start();
    
    // Wait for Discord to be ready
    await this.waitForDiscordReady();
    
    // Start monitoring systems
    this.startPerformanceMonitoring();
    
    console.log('[Dashboard] 🎯 Dashboard Agent is online and monitoring!');
    console.log(`[Dashboard] Dashboard Channel: ${this.config.dashboardChannelId}`);
    console.log(`[Dashboard] Coordination Channel: ${this.config.agentCoordinationChannelId}`);
  }

  async stop(): Promise<void> {
    console.log('[Dashboard] Shutting down Dashboard Agent...');
    
    // Stop monitoring intervals
    if (this.anomalyCheckInterval) {
      clearInterval(this.anomalyCheckInterval);
    }
    if (this.healthReportInterval) {
      clearInterval(this.healthReportInterval);
    }
    
    // Stop Discord interface
    await this.discord.stop();
    
    console.log('[Dashboard] Dashboard Agent shutdown complete.');
  }

  // Public method for other agents to track their API usage
  async trackAPIUsage(
    agent: 'Commander' | 'Architect' | 'Dashboard',
    operation: string,
    duration: number,
    tokens: number,
    cost: number,
    success: boolean,
    error?: string
  ): Promise<void> {
    await this.usageTracker.trackAPICall(
      agent,
      operation,
      duration,
      tokens,
      cost,
      success,
      error
    );
  }

  // Public method to get current system health
  async getSystemHealth(): Promise<any> {
    return await this.orchestrator.generateSystemHealthReport();
  }

  private setupMessageHandling(): void {
    this.discord.onMessage(async (message: Message) => {
      await this.handleUserMessage(message);
    });
  }

  private async handleUserMessage(message: Message): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`[Dashboard] Processing message from ${message.author.tag}: "${message.content}"`);
      
      // Show typing indicator
      if ('sendTyping' in message.channel) {
        await message.channel.sendTyping();
      }
      
      // Check for optimization approval responses
      if (this.isOptimizationResponse(message.content)) {
        const response = await this.handleOptimizationResponse(message);
        await this.discord.replyToMessage(message, response);
        return;
      }
      
      // Create query object
      const query: DashboardQuery = {
        query: message.content,
        context: {
          recentMetrics: this.usageTracker.getRecentMetrics(50),
          agentActivity: this.getRecentAgentActivity(),
          timeframe: '24h'
        },
        userId: message.author.id,
        messageId: message.id
      };
      
      // Process the query
      const response = await this.orchestrator.processUserQuery(query);
      
      // Send response
      await this.discord.replyToMessage(message, response);
      
      // Track this dashboard interaction
      await this.usageTracker.trackAPICall(
        'Dashboard',
        'user_interaction',
        Date.now() - startTime,
        300, // Estimated tokens
        0.002, // Estimated cost
        true
      );
      
    } catch (error) {
      console.error('[Dashboard] Error handling user message:', error);
      
      // Track the error
      await this.usageTracker.trackAPICall(
        'Dashboard',
        'user_interaction',
        Date.now() - startTime,
        0,
        0,
        false,
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      // Send error response
      try {
        const errorResponse = await this.voice.formatErrorResponse(
          'System error processing request',
          'Please try again or rephrase your question'
        );
        await this.discord.replyToMessage(message, errorResponse);
      } catch (replyError) {
        console.error('[Dashboard] Failed to send error response:', replyError);
      }
    }
  }

  private isOptimizationResponse(content: string): boolean {
    const lowerContent = content.toLowerCase();
    return lowerContent.includes('yes, optimize') || 
           lowerContent.includes('monitor only') ||
           lowerContent.includes('✅') ||
           lowerContent.includes('❌');
  }

  private async handleOptimizationResponse(message: Message): Promise<string> {
    const content = message.content.toLowerCase();
    const approved = content.includes('yes') || content.includes('✅');
    
    // In a full implementation, we'd track the specific optimization request
    // For now, we'll provide a general response
    return await this.orchestrator.handleOptimizationApproval(
      message.author.id,
      approved,
      'latest' // Would be actual request ID
    );
  }

  private startPerformanceMonitoring(): void {
    // Check for anomalies every 5 minutes
    this.anomalyCheckInterval = setInterval(async () => {
      try {
        await this.orchestrator.detectAndAlertAnomalies();
      } catch (error) {
        console.error('[Dashboard] Error in anomaly detection:', error);
      }
    }, 5 * 60 * 1000);
    
    // Generate health reports every hour
    this.healthReportInterval = setInterval(async () => {
      try {
        const healthReport = await this.orchestrator.generateSystemHealthReport();
        
        // Only send if there are significant issues or improvements
        if (healthReport.alerts.length > 0 || healthReport.overall === 'excellent') {
          const formattedReport = await this.voice.formatSystemHealthReport(healthReport);
          await this.discord.sendMessage(
            `🕐 **Hourly Health Check**\n\n${formattedReport}`
          );
        }
      } catch (error) {
        console.error('[Dashboard] Error in health reporting:', error);
      }
    }, 60 * 60 * 1000);
    
    console.log('[Dashboard] Performance monitoring started - checking every 5min, reports every hour');
  }

  private getRecentAgentActivity(): AgentActivity[] {
    // In a full implementation, this would track actual agent activity
    // For now, we'll return based on recent metrics
    const recentMetrics = this.usageTracker.getRecentMetrics(20);
    
    return recentMetrics.map(metric => ({
      agent: metric.agent,
      operation: metric.operation,
      timestamp: metric.timestamp,
      duration: metric.duration,
      success: metric.success,
      context: `${metric.tokens} tokens, $${metric.cost.toFixed(4)}`
    }));
  }

  private async waitForDiscordReady(): Promise<void> {
    return new Promise((resolve) => {
      if (this.discord.isReady) {
        resolve();
        return;
      }
      
      const checkReady = () => {
        if (this.discord.isReady) {
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };
      
      checkReady();
    });
  }

  // Health check method
  getStatus(): {
    ready: boolean;
    dashboardChannel: boolean;
    coordinationChannel: boolean;
    monitoring: boolean;
  } {
    return {
      ready: this.discord.isReady,
      dashboardChannel: this.discord.dashboardChannelReady,
      coordinationChannel: this.discord.coordinationChannelReady,
      monitoring: this.anomalyCheckInterval !== null
    };
  }

  // Public API for external monitoring integration
  async addExternalMetric(
    source: string,
    operation: string,
    duration: number,
    cost: number,
    success: boolean
  ): Promise<void> {
    await this.usageTracker.trackAPICall(
      'Dashboard', // Will be categorized as external
      `${source}:${operation}`,
      duration,
      0, // External metrics may not have token counts
      cost,
      success
    );
  }

  // Get current performance snapshot
  getPerformanceSnapshot(): any {
    return {
      session: this.usageTracker.getSessionMetrics(),
      daily: this.usageTracker.getMetrics(24),
      efficiency: this.usageTracker.getAgentEfficiency(),
      topOperations: this.usageTracker.getTopOperations(10, 24)
    };
  }
}