import { Anthropic } from '@anthropic-ai/sdk';
import { 
  APIMetrics, 
  PerformanceMetrics, 
  AgentActivity, 
  InsightResponse, 
  DashboardQuery,
  SystemHealthReport,
  PerformanceAlert
} from '../types/index.js';
import { APIUsageTracker } from './APIUsageTracker.js';
import { PerformanceAnalyzer } from './PerformanceAnalyzer.js';

export class DashboardIntelligence {
  private claude: Anthropic;
  private usageTracker: APIUsageTracker;
  private performanceAnalyzer: PerformanceAnalyzer;

  constructor(claudeApiKey: string, usageTracker: APIUsageTracker, performanceAnalyzer: PerformanceAnalyzer) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
    this.usageTracker = usageTracker;
    this.performanceAnalyzer = performanceAnalyzer;
    console.log('[DashboardIntelligence] AI-powered insight system initialized');
  }

  async analyzePerformanceQuery(
    query: string,
    recentMetrics: APIMetrics[],
    agentContext: AgentActivity[]
  ): Promise<InsightResponse> {
    const startTime = Date.now();
    
    try {
      // Get current performance data
      const sessionMetrics = this.usageTracker.getSessionMetrics();
      const dailyMetrics = this.usageTracker.getMetrics(24);
      const alerts = this.usageTracker.detectAnomalies();
      const trends = this.performanceAnalyzer.analyzePerformanceTrends();
      const bottlenecks = this.performanceAnalyzer.identifyBottlenecks();
      
      // Determine if we should offer handoff
      const handoffAnalysis = await this.analyzeHandoffOpportunity(query, sessionMetrics, bottlenecks);

      // Generate AI insight
      const aiInsight = await this.generateAIInsight(query, {
        sessionMetrics,
        dailyMetrics,
        alerts,
        trends,
        bottlenecks,
        recentMetrics: recentMetrics.slice(-10) // Last 10 operations
      });

      const response: InsightResponse = {
        summary: aiInsight.summary,
        analysis: aiInsight.analysis,
        recommendations: aiInsight.recommendations,
        metrics: sessionMetrics,
        alerts,
        shouldOfferHandoff: handoffAnalysis.shouldOffer,
        handoffTarget: handoffAnalysis.target,
        handoffReason: handoffAnalysis.reason
      };

      // Track this query
      await this.usageTracker.trackAPICall(
        'Dashboard',
        'query_analysis',
        Date.now() - startTime,
        aiInsight.tokensUsed || 500, // Estimate
        (aiInsight.tokensUsed || 500) * 0.000008, // Estimate cost
        true
      );

      return response;

    } catch (error) {
      console.error('[DashboardIntelligence] Query analysis failed:', error);
      
      // Track the error
      await this.usageTracker.trackAPICall(
        'Dashboard',
        'query_analysis',
        Date.now() - startTime,
        0,
        0,
        false,
        error instanceof Error ? error.message : 'Unknown error'
      );

      // Return fallback response
      return {
        summary: 'Unable to analyze query due to system error',
        analysis: 'The dashboard intelligence system encountered an error while processing your request.',
        recommendations: ['Try rephrasing your question', 'Check system status', 'Contact support if the issue persists'],
        metrics: this.usageTracker.getSessionMetrics(),
        alerts: [],
        shouldOfferHandoff: false
      };
    }
  }

  async shouldOfferArchitectOptimization(metrics: PerformanceMetrics): Promise<{
    recommend: boolean;
    confidence: number;
    reasoning: string;
  }> {
    // Check for expensive operations that could be optimized
    const topOps = this.usageTracker.getTopOperations(5, 24);
    const architectOps = topOps.filter(op => op.agent === 'Architect');
    
    if (architectOps.length === 0) {
      return {
        recommend: false,
        confidence: 0,
        reasoning: 'No recent Architect operations to optimize'
      };
    }

    const expensiveOps = architectOps.filter(op => 
      op.totalCost > 0.002 || op.avgDuration > 4000
    );

    if (expensiveOps.length === 0) {
      return {
        recommend: false,
        confidence: 0.3,
        reasoning: 'Architect operations within normal performance range'
      };
    }

    // Analyze the most expensive operation
    const targetOp = expensiveOps[0];
    const optimization = this.performanceAnalyzer.shouldRecommendOptimization(
      targetOp.agent,
      targetOp.operation
    );

    return {
      recommend: optimization.recommend,
      confidence: optimization.confidence,
      reasoning: optimization.reasoning
    };
  }

  async generateCrossAgentReport(timeframe: string): Promise<SystemHealthReport> {
    const hours = this.parseTimeframe(timeframe);
    const metrics = this.usageTracker.getMetrics(hours);
    const alerts = this.usageTracker.detectAnomalies();
    const efficiency = this.usageTracker.getAgentEfficiency();
    
    // Determine overall health
    let overall: SystemHealthReport['overall'] = 'good';
    if (alerts.some(a => a.severity === 'critical')) overall = 'critical';
    else if (alerts.some(a => a.severity === 'high')) overall = 'poor';
    else if (metrics.successRate > 0.95 && metrics.averageResponseTime < 2000) overall = 'excellent';
    else if (metrics.successRate < 0.8 || metrics.averageResponseTime > 5000) overall = 'fair';

    // Agent status
    const agentStatus: SystemHealthReport['agentStatus'] = {};
    Object.entries(metrics.agentBreakdown).forEach(([agent, breakdown]) => {
      let status: 'online' | 'offline' | 'degraded' = 'online';
      if (breakdown.successRate < 0.7) status = 'degraded';
      
      const healthScore = (breakdown.successRate * 0.4) + 
                         ((5000 - Math.min(breakdown.avgDuration, 5000)) / 5000 * 0.4) + 
                         (breakdown.requests > 0 ? 0.2 : 0);

      agentStatus[agent] = {
        status,
        lastActivity: new Date().toISOString(), // Would be actual last activity in real implementation
        healthScore: Math.round(healthScore * 100)
      };
    });

    // Budget status (mock for now)
    const budgetStatus = {
      dailySpent: metrics.totalCost,
      dailyLimit: 1.0, // $1 daily limit
      monthlySpent: metrics.totalCost * 30, // Rough estimate
      monthlyLimit: 30.0, // $30 monthly limit
      projectedMonthly: metrics.totalCost * 30
    };

    // Optimization opportunities
    const optimizationOpportunities = efficiency
      .filter(agent => agent.efficiency < 0.5)
      .map(agent => ({
        description: `${agent.agent} efficiency optimization - currently ${agent.efficiency.toFixed(3)}`,
        estimatedSavings: 0.002, // $0.002 per day estimate
        complexity: 'medium' as const,
        agent: agent.agent
      }));

    return {
      timestamp: new Date().toISOString(),
      overall,
      performance: metrics,
      alerts,
      agentStatus,
      budgetStatus,
      optimizationOpportunities
    };
  }

  async detectPerformanceAnomalies(currentMetrics: APIMetrics[]): Promise<PerformanceAlert[]> {
    return this.usageTracker.detectAnomalies();
  }

  private async generateAIInsight(query: string, context: {
    sessionMetrics: PerformanceMetrics;
    dailyMetrics: PerformanceMetrics;
    alerts: PerformanceAlert[];
    trends: any;
    bottlenecks: any[];
    recentMetrics: APIMetrics[];
  }): Promise<{
    summary: string;
    analysis: string;
    recommendations: string[];
    tokensUsed?: number;
  }> {
    const systemPrompt = `You are Dashboard Agent, an analytical but approachable system observer for the EPOCH I agent ecosystem. 

Your role is to provide data-driven insights with helpful recommendations about system performance, costs, and optimization opportunities across Commander, Architect, and Dashboard agents.

Voice style:
- Analytical but approachable
- Concise technical summaries  
- Actionable suggestions
- Examples: "Performance trending down 23%. Architect can optimize." or "High token usage detected. Analysis suggests file filtering."

Respond with data-driven insights based on the provided metrics and context.`;

    const userPrompt = `User Query: "${query}"

Current System Context:
Session Metrics: ${JSON.stringify(context.sessionMetrics, null, 2)}
Daily Metrics: ${JSON.stringify(context.dailyMetrics, null, 2)}
Active Alerts: ${JSON.stringify(context.alerts, null, 2)}
Performance Trends: ${JSON.stringify(context.trends, null, 2)}
Bottlenecks: ${JSON.stringify(context.bottlenecks, null, 2)}
Recent Operations: ${JSON.stringify(context.recentMetrics, null, 2)}

Provide a focused analysis addressing the user's question with:
1. Summary (1-2 sentences)
2. Analysis (detailed explanation with specific metrics)
3. Recommendations (actionable next steps)

Format as JSON:
{
  "summary": "Brief insight summary",
  "analysis": "Detailed technical analysis with specific metrics",
  "recommendations": ["Action 1", "Action 2", "Action 3"]
}`;

    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        const aiResponse = JSON.parse(content.text);
        return {
          ...aiResponse,
          tokensUsed: response.usage.input_tokens + response.usage.output_tokens
        };
      }

      throw new Error('Unexpected response format from Claude');
    } catch (error) {
      console.error('[DashboardIntelligence] AI insight generation failed:', error);
      
      // Fallback to rule-based analysis
      return this.generateFallbackInsight(query, context);
    }
  }

  private generateFallbackInsight(query: string, context: any): {
    summary: string;
    analysis: string;
    recommendations: string[];
  } {
    const { sessionMetrics, alerts, trends } = context;
    
    let summary = 'System analysis complete.';
    let analysis = 'Performance metrics reviewed.';
    const recommendations = ['Continue monitoring system performance'];

    // Basic rule-based insights
    if (sessionMetrics.successRate < 0.8) {
      summary = 'High error rate detected in recent operations.';
      analysis = `Success rate at ${(sessionMetrics.successRate * 100).toFixed(1)}%, below healthy threshold of 80%.`;
      recommendations.push('Review error logs', 'Check API connectivity');
    } else if (sessionMetrics.averageResponseTime > 5000) {
      summary = 'Performance degradation detected.';
      analysis = `Average response time ${(sessionMetrics.averageResponseTime / 1000).toFixed(1)}s, above optimal range.`;
      recommendations.push('Investigate slow operations', 'Consider optimization');
    } else if (sessionMetrics.totalCost > 0.01) {
      summary = 'High cost usage detected.';
      analysis = `Session cost $${sessionMetrics.totalCost.toFixed(4)}, review expensive operations.`;
      recommendations.push('Analyze cost distribution', 'Consider operation efficiency');
    }

    return { summary, analysis, recommendations };
  }

  private async analyzeHandoffOpportunity(
    query: string, 
    metrics: PerformanceMetrics, 
    bottlenecks: any[]
  ): Promise<{
    shouldOffer: boolean;
    target?: 'Commander' | 'Architect';
    reason?: string;
  }> {
    // Check if query mentions optimization or performance issues
    const optimizationKeywords = ['optimize', 'slow', 'expensive', 'improve', 'fix', 'better'];
    const mentionsOptimization = optimizationKeywords.some(keyword => 
      query.toLowerCase().includes(keyword)
    );

    if (!mentionsOptimization) {
      return { shouldOffer: false };
    }

    // Check for Architect optimization opportunities
    const architectBottlenecks = bottlenecks.filter(b => 
      b.metrics?.agent === 'Architect' && b.impact !== 'low'
    );

    if (architectBottlenecks.length > 0) {
      return {
        shouldOffer: true,
        target: 'Architect',
        reason: `${architectBottlenecks[0].description} - optimization available`
      };
    }

    // Check for Commander optimization opportunities
    const commanderBottlenecks = bottlenecks.filter(b => 
      b.metrics?.agent === 'Commander' && b.impact !== 'low'
    );

    if (commanderBottlenecks.length > 0) {
      return {
        shouldOffer: true,
        target: 'Commander',
        reason: `${commanderBottlenecks[0].description} - optimization available`
      };
    }

    return { shouldOffer: false };
  }

  private parseTimeframe(timeframe: string): number {
    // Parse timeframe like "24h", "7d", "1w" into hours
    const match = timeframe.match(/(\d+)([hdw])/);
    if (!match) return 24; // Default to 24 hours

    const [, amount, unit] = match;
    const num = parseInt(amount);
    
    switch (unit) {
      case 'h': return num;
      case 'd': return num * 24;
      case 'w': return num * 24 * 7;
      default: return 24;
    }
  }
}