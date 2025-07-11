import { 
  DashboardConfig, 
  DashboardQuery, 
  InsightResponse, 
  SystemHealthReport,
  OptimizationRequest,
  PerformanceAlert 
} from '../types/index.js';
import { APIUsageTracker } from '../intelligence/APIUsageTracker.js';
import { PerformanceAnalyzer } from '../intelligence/PerformanceAnalyzer.js';
import { DashboardIntelligence } from '../intelligence/DashboardIntelligence.js';
import { DashboardVoice } from '../communication/DashboardVoice.js';
import { DashboardDiscord } from '../communication/DashboardDiscord.js';

export class DashboardOrchestrator {
  private config: DashboardConfig;
  private usageTracker: APIUsageTracker;
  private performanceAnalyzer: PerformanceAnalyzer;
  private intelligence: DashboardIntelligence;
  private voice: DashboardVoice;
  private discord: DashboardDiscord;
  private pendingOptimizations: Map<string, OptimizationRequest> = new Map();

  constructor(
    config: DashboardConfig,
    usageTracker: APIUsageTracker,
    performanceAnalyzer: PerformanceAnalyzer,
    intelligence: DashboardIntelligence,
    voice: DashboardVoice,
    discord: DashboardDiscord
  ) {
    this.config = config;
    this.usageTracker = usageTracker;
    this.performanceAnalyzer = performanceAnalyzer;
    this.intelligence = intelligence;
    this.voice = voice;
    this.discord = discord;

    console.log('[DashboardOrchestrator] Work execution system initialized');
  }

  async processUserQuery(query: DashboardQuery): Promise<string> {
    const startTime = Date.now();
    
    try {
      console.log(`[DashboardOrchestrator] Processing query: "${query.query}"`);

      // Determine query type
      const queryType = this.categorizeQuery(query.query);
      
      let response: string;
      
      switch (queryType) {
        case 'health_overview':
          response = await this.handleHealthOverview();
          break;
          
        case 'performance_analysis':
          response = await this.handlePerformanceAnalysis(query);
          break;
          
        case 'cost_analysis':
          response = await this.handleCostAnalysis(query);
          break;
          
        case 'optimization_request':
          response = await this.handleOptimizationRequest(query);
          break;
          
        case 'agent_status':
          response = await this.handleAgentStatus(query);
          break;
          
        case 'trends_analysis':
          response = await this.handleTrendsAnalysis(query);
          break;
          
        default:
          response = await this.handleGeneralQuery(query);
      }

      // Track this dashboard operation
      await this.usageTracker.trackAPICall(
        'Dashboard',
        `query_${queryType}`,
        Date.now() - startTime,
        200, // Estimated tokens for orchestration
        0.001, // Estimated cost
        true
      );

      return response;

    } catch (error) {
      console.error('[DashboardOrchestrator] Query processing failed:', error);
      
      // Track the error
      await this.usageTracker.trackAPICall(
        'Dashboard',
        'query_error',
        Date.now() - startTime,
        0,
        0,
        false,
        error instanceof Error ? error.message : 'Unknown error'
      );

      return await this.voice.formatErrorResponse(
        error instanceof Error ? error.message : 'Unknown error',
        `Processing query: ${query.query}`
      );
    }
  }

  async handleOptimizationApproval(
    userId: string,
    approved: boolean,
    requestId?: string
  ): Promise<string> {
    if (!requestId || !this.pendingOptimizations.has(requestId)) {
      return 'No pending optimization request found.';
    }

    const request = this.pendingOptimizations.get(requestId)!;
    
    if (approved) {
      request.userApproved = true;
      request.status = 'sent';
      
      // Send to coordination channel
      const formattedRequest = await this.voice.formatAgentHandoffMessage(request);
      await this.discord.sendOptimizationRequest(
        request.targetAgent,
        formattedRequest,
        request.userContext
      );

      this.pendingOptimizations.delete(requestId);
      
      return `✅ **Optimization Request Sent**\n\nRequest forwarded to ${request.targetAgent} via agent coordination channel. You'll be notified of the implementation status.`;
    } else {
      request.status = 'declined';
      this.pendingOptimizations.delete(requestId);
      
      return `❌ **Optimization Declined**\n\nRequest cancelled. I'll continue monitoring for other opportunities.`;
    }
  }

  async generateSystemHealthReport(): Promise<SystemHealthReport> {
    return await this.intelligence.generateCrossAgentReport('24h');
  }

  async detectAndAlertAnomalies(): Promise<PerformanceAlert[]> {
    const alerts = await this.usageTracker.detectAnomalies();
    
    // Send critical alerts to coordination channel
    const criticalAlerts = alerts.filter(alert => alert.severity === 'critical' || alert.severity === 'high');
    
    for (const alert of criticalAlerts) {
      await this.discord.sendCostAlert(
        'all',
        alert.message,
        alert.severity as 'low' | 'medium' | 'high' | 'urgent'
      );
    }
    
    return alerts;
  }

  private async handleHealthOverview(): Promise<string> {
    const healthReport = await this.intelligence.generateCrossAgentReport('24h');
    return await this.voice.formatSystemHealthReport(healthReport);
  }

  private async handlePerformanceAnalysis(query: DashboardQuery): Promise<string> {
    const insight = await this.intelligence.analyzePerformanceQuery(
      query.query,
      query.context.recentMetrics,
      query.context.agentActivity
    );
    
    // Check if optimization handoff is recommended
    if (insight.shouldOfferHandoff && insight.handoffTarget) {
      const optimizationRequest = this.createOptimizationRequest(insight, query);
      const optimizationId = optimizationRequest.id;
      // Store for user approval
      this.pendingOptimizations.set(optimizationId, optimizationRequest);
    }
    
    return await this.voice.formatInsightResponse(insight);
  }

  private async handleCostAnalysis(query: DashboardQuery): Promise<string> {
    const sessionMetrics = this.usageTracker.getSessionMetrics();
    const dailyMetrics = this.usageTracker.getMetrics(24);
    const topOperations = this.usageTracker.getTopOperations(10, 24);
    
    let response = `💰 **Cost Analysis**\n\n`;
    response += `📊 **Session**: $${sessionMetrics.totalCost.toFixed(4)} (${sessionMetrics.totalTokens.toLocaleString()} tokens)\n`;
    response += `📅 **24h Total**: $${dailyMetrics.totalCost.toFixed(4)} (${dailyMetrics.totalTokens.toLocaleString()} tokens)\n\n`;
    
    if (topOperations.length > 0) {
      response += `🔝 **Top Cost Operations**:\n`;
      topOperations.slice(0, 5).forEach((op, index) => {
        response += `${index + 1}. ${op.agent} ${op.operation}: $${op.totalCost.toFixed(4)} (${op.count}x)\n`;
      });
      response += '\n';
    }
    
    // Check for cost optimization opportunities
    const expensiveOps = topOperations.filter(op => op.totalCost > 0.002);
    if (expensiveOps.length > 0) {
      response += `💡 **Optimization Opportunities**:\n`;
      for (const op of expensiveOps.slice(0, 3)) {
        const optimizationAnalysis = this.performanceAnalyzer.shouldRecommendOptimization(op.agent, op.operation);
        if (optimizationAnalysis.recommend) {
          response += `🔧 ${op.agent} ${op.operation}: ${optimizationAnalysis.reasoning}\n`;
        }
      }
    }
    
    return response;
  }

  private async handleOptimizationRequest(query: DashboardQuery): Promise<string> {
    // Extract which agent/operation needs optimization
    const lowerQuery = query.query.toLowerCase();
    let targetAgent: 'Commander' | 'Architect' | undefined;
    
    if (lowerQuery.includes('architect')) {
      targetAgent = 'Architect';
    } else if (lowerQuery.includes('commander')) {
      targetAgent = 'Commander';
    }
    
    if (targetAgent) {
      const optimization = await this.intelligence.shouldOfferArchitectOptimization(
        this.usageTracker.getMetrics(24)
      );
      
      if (optimization.recommend) {
        let response = `🔧 **${targetAgent} Optimization Available**\n\n`;
        response += `📊 **Analysis**: ${optimization.reasoning}\n`;
        response += `🎯 **Confidence**: ${(optimization.confidence * 100).toFixed(0)}%\n\n`;
        response += `Send optimization request to ${targetAgent}?\n`;
        response += `[✅ Yes, optimize] [❌ Monitor only]`;
        
        return response;
      } else {
        return `🟢 **${targetAgent} Performance Good**\n\n${optimization.reasoning}\n\nNo optimization needed at this time.`;
      }
    }
    
    return await this.handleGeneralQuery(query);
  }

  private async handleAgentStatus(query: DashboardQuery): Promise<string> {
    const metrics = this.usageTracker.getMetrics(24);
    const efficiency = this.usageTracker.getAgentEfficiency();
    
    let response = `🤖 **Agent Status Report**\n\n`;
    
    efficiency.forEach(agent => {
      const status = agent.successRate > 0.9 ? '🟢' : agent.successRate > 0.7 ? '🟡' : '🔴';
      const performance = agent.avgResponseTime < 2000 ? '⚡' : agent.avgResponseTime < 5000 ? '🐌' : '⏳';
      
      response += `${status} **${agent.agent}**: ${performance} ${(agent.avgResponseTime / 1000).toFixed(1)}s avg, ${(agent.successRate * 100).toFixed(1)}% success\n`;
      response += `   💰 Efficiency: ${agent.tokensPerCent.toFixed(1)} tokens/cent\n\n`;
    });
    
    return response;
  }

  private async handleTrendsAnalysis(query: DashboardQuery): Promise<string> {
    const trends = this.performanceAnalyzer.analyzePerformanceTrends(24);
    const bottlenecks = this.performanceAnalyzer.identifyBottlenecks(24);
    
    let response = `📈 **Performance Trends (24h)**\n\n`;
    
    const trendIcon = trends.trend === 'improving' ? '📈' : trends.trend === 'degrading' ? '📉' : '➡️';
    response += `${trendIcon} **Trend**: ${trends.trend} (${(trends.confidence * 100).toFixed(0)}% confidence)\n`;
    response += `📝 **Details**: ${trends.details}\n\n`;
    
    if (trends.recommendations.length > 0) {
      response += `💡 **Recommendations**:\n`;
      trends.recommendations.forEach((rec, index) => {
        response += `${index + 1}. ${rec}\n`;
      });
      response += '\n';
    }
    
    if (bottlenecks.length > 0) {
      response += `🚧 **Active Bottlenecks**:\n`;
      bottlenecks.slice(0, 3).forEach((bottleneck, index) => {
        const impactIcon = bottleneck.impact === 'high' ? '🔴' : bottleneck.impact === 'medium' ? '🟡' : '🟢';
        response += `${impactIcon} ${bottleneck.description}\n`;
      });
    }
    
    return response;
  }

  private async handleGeneralQuery(query: DashboardQuery): Promise<string> {
    const insight = await this.intelligence.analyzePerformanceQuery(
      query.query,
      query.context.recentMetrics,
      query.context.agentActivity
    );
    
    return await this.voice.formatInsightResponse(insight);
  }

  private categorizeQuery(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('health') || lowerQuery.includes('overview') || lowerQuery.includes('status all')) {
      return 'health_overview';
    }
    
    if (lowerQuery.includes('performance') || lowerQuery.includes('speed') || lowerQuery.includes('slow') || lowerQuery.includes('fast')) {
      return 'performance_analysis';
    }
    
    if (lowerQuery.includes('cost') || lowerQuery.includes('expensive') || lowerQuery.includes('budget') || lowerQuery.includes('money')) {
      return 'cost_analysis';
    }
    
    if (lowerQuery.includes('optimize') || lowerQuery.includes('improve') || lowerQuery.includes('fix')) {
      return 'optimization_request';
    }
    
    if (lowerQuery.includes('agent') && (lowerQuery.includes('status') || lowerQuery.includes('online'))) {
      return 'agent_status';
    }
    
    if (lowerQuery.includes('trend') || lowerQuery.includes('pattern') || lowerQuery.includes('history')) {
      return 'trends_analysis';
    }
    
    return 'general';
  }

  private createOptimizationRequest(insight: InsightResponse, query: DashboardQuery): OptimizationRequest {
    const id = `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id,
      targetAgent: insight.handoffTarget!,
      issue: insight.handoffReason || 'Performance optimization needed',
      supportingData: query.context.recentMetrics,
      recommendations: insight.recommendations,
      expectedImprovement: {
        costReduction: 0.6, // Default estimate
        performanceGain: 0.4, // Default estimate  
        description: 'Estimated improvement based on analysis'
      },
      userApproved: false,
      status: 'pending',
      timestamp: new Date().toISOString(),
      userContext: query.query
    };
  }
}