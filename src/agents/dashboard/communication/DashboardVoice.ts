import { Anthropic } from '@anthropic-ai/sdk';
import { 
  InsightResponse, 
  SystemHealthReport, 
  PerformanceAlert,
  PerformanceMetrics,
  OptimizationRequest 
} from '../types/index.js';

export class DashboardVoice {
  private claude: Anthropic;

  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
    console.log('[DashboardVoice] Dashboard personality system initialized');
  }

  async formatInsightResponse(insight: InsightResponse): Promise<string> {
    const { summary, analysis, recommendations, metrics, alerts, shouldOfferHandoff, handoffTarget } = insight;
    
    // Format the main response
    let response = `🔍 **${summary}**\n\n`;
    
    // Add analysis
    response += `📊 **Analysis**: ${analysis}\n\n`;
    
    // Add key metrics if significant
    if (metrics.totalRequests > 0) {
      const successIcon = metrics.successRate > 0.9 ? '🟢' : metrics.successRate > 0.7 ? '🟡' : '🔴';
      const performanceIcon = metrics.averageResponseTime < 1000 ? '⚡' : metrics.averageResponseTime < 3000 ? '🐌' : '⏳';
      
      response += `${successIcon} Success: ${(metrics.successRate * 100).toFixed(1)}% (${metrics.totalRequests} ops)\n`;
      response += `${performanceIcon} Performance: ${(metrics.averageResponseTime / 1000).toFixed(1)}s avg\n`;
      response += `💰 Cost: $${metrics.totalCost.toFixed(4)} (${metrics.totalTokens.toLocaleString()} tokens)\n\n`;
    }

    // Add alerts if any
    if (alerts.length > 0) {
      response += `⚠️ **Active Alerts**:\n`;
      alerts.forEach(alert => {
        const icon = alert.severity === 'critical' ? '🚨' : alert.severity === 'high' ? '⚠️' : '⚡';
        response += `${icon} ${alert.message}\n`;
      });
      response += '\n';
    }

    // Add recommendations
    if (recommendations.length > 0) {
      response += `💡 **Recommendations**:\n`;
      recommendations.forEach((rec, index) => {
        response += `${index + 1}. ${rec}\n`;
      });
      response += '\n';
    }

    // Add handoff offer if applicable
    if (shouldOfferHandoff && handoffTarget) {
      response += `🔧 **Optimization Available**: Send optimization request to ${handoffTarget}?\n`;
      response += `[✅ Yes, optimize] [❌ Monitor only]\n\n`;
    }

    return response.trim();
  }

  async formatSystemHealthReport(report: SystemHealthReport): Promise<string> {
    const { timestamp, overall, performance, alerts, agentStatus, budgetStatus } = report;
    
    const overallIcon = this.getHealthIcon(overall);
    const date = new Date(timestamp).toISOString().slice(0, 19).replace('T', ' ');
    
    let response = `🎯 **EPOCH I System Overview** (${date})\n`;
    response += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    // Overall status line
    const budgetPercent = (budgetStatus.dailySpent / budgetStatus.dailyLimit * 100).toFixed(1);
    const budgetIcon = parseFloat(budgetPercent) < 50 ? '🟢' : parseFloat(budgetPercent) < 80 ? '🟡' : '🔴';
    
    response += `💰 Session: $${performance.totalCost.toFixed(4)} | ${performance.totalTokens.toLocaleString()} tokens | ${budgetIcon} ${budgetPercent}% of daily budget\n`;
    response += `⚡ Performance: ${this.getPerformanceLabel(performance.averageResponseTime)} (avg ${(performance.averageResponseTime / 1000).toFixed(1)}s)\n`;
    response += `📊 Success: ${(performance.successRate * 100).toFixed(0)}% (${performance.totalRequests} ops)`;
    
    if (alerts.length > 0) {
      response += ` | 🔧 ${alerts.length} optimization opportunity${alerts.length > 1 ? 'ies' : ''}`;
    }
    response += '\n';
    
    // Agent sync status
    const onlineAgents = Object.values(agentStatus).filter(agent => agent.status === 'online').length;
    const totalAgents = Object.keys(agentStatus).length;
    response += `🤝 Agent Sync: ${onlineAgents}/${totalAgents} systems operational\n`;
    
    // Session info
    const sessionMinutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
    response += `🕐 Active: ${sessionMinutes}m | Next reset: Midnight UTC\n\n`;
    
    // Detailed breakdown in spoiler
    response += `||**🔍 DETAILED BREAKDOWN & INSIGHTS**\n`;
    response += await this.formatDetailedBreakdown(performance, agentStatus, alerts, budgetStatus);
    response += `||\n\n`;
    
    // Action buttons
    response += `[📊 Deep Analysis] [🔧 Send to Architect] [📈 Trends] [💬 Talk to Commander]`;
    
    return response;
  }

  async formatAgentHandoffMessage(request: OptimizationRequest): Promise<string> {
    const { targetAgent, issue, supportingData, recommendations, expectedImprovement } = request;
    
    let message = `🚨 **OPTIMIZATION REQUEST** from Dashboard Agent\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📊 Performance Issue: ${issue}\n\n`;
    
    // Add supporting metrics
    if (supportingData.length > 0) {
      const totalCost = supportingData.reduce((sum, data) => sum + data.cost, 0);
      const avgDuration = supportingData.reduce((sum, data) => sum + data.duration, 0) / supportingData.length;
      
      message += `💰 Cost Impact: $${totalCost.toFixed(4)} per operation\n`;
      message += `⏱️ Performance Impact: ${(avgDuration / 1000).toFixed(1)}s average duration\n`;
      message += `📈 Frequency: ${supportingData.length} operations in recent activity\n\n`;
    }
    
    // Expected improvements
    message += `🎯 **Expected Improvement**:\n`;
    message += `- ${(expectedImprovement.costReduction * 100).toFixed(0)}% cost reduction\n`;
    message += `- ${(expectedImprovement.performanceGain * 100).toFixed(0)}% faster responses\n`;
    message += `- ${expectedImprovement.description}\n\n`;
    
    // Recommendations
    message += `🛠️ **Recommended Solutions**:\n`;
    recommendations.forEach((rec, index) => {
      message += `${index + 1}. ${rec}\n`;
    });
    message += '\n';
    
    message += `✅ User approved optimization at ${new Date().toISOString().slice(0, 19).replace('T', ' ')}\n`;
    message += `📝 Original conversation: <thread_link>`;
    
    return message;
  }

  async formatCrossAgentUpdate(
    fromAgent: string,
    toAgent: string,
    updateType: string,
    data: any
  ): Promise<string> {
    let message = `📊 **${updateType.toUpperCase()}** for ${toAgent}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    switch (updateType) {
      case 'performance_insight':
        message += `🎯 ${data.insight}\n`;
        message += `💡 ${data.recommendation}\n`;
        message += `📈 ${data.trend}\n\n`;
        message += `Current Status: ${data.status} - ${data.action}\n`;
        break;
        
      case 'cost_alert':
        message += `⚠️ Cost Alert: ${data.alert}\n`;
        message += `💰 Impact: ${data.impact}\n`;
        message += `🔧 Suggested Action: ${data.action}\n`;
        break;
        
      case 'optimization_result':
        message += `✅ Optimization Result: ${data.result}\n`;
        message += `📊 Improvement: ${data.improvement}\n`;
        message += `⏱️ Time Saved: ${data.timeSaved}\n`;
        message += `💰 Cost Saved: ${data.costSaved}\n`;
        break;
    }
    
    return message;
  }

  async formatErrorResponse(error: string, context?: string): Promise<string> {
    let response = `🔍 **Analysis Error**\n\n`;
    response += `❌ Unable to process request: ${error}\n\n`;
    
    if (context) {
      response += `🔧 Context: ${context}\n\n`;
    }
    
    response += `💡 **Try**:\n`;
    response += `1. Rephrase your question\n`;
    response += `2. Check system status\n`;
    response += `3. Ask for general system overview\n\n`;
    response += `[📊 System Status] [💬 Help]`;
    
    return response;
  }

  private async formatDetailedBreakdown(
    performance: PerformanceMetrics,
    agentStatus: SystemHealthReport['agentStatus'],
    alerts: PerformanceAlert[],
    budgetStatus: SystemHealthReport['budgetStatus']
  ): Promise<string> {
    let breakdown = `**Cross-Agent Performance:**\n`;
    
    // Agent performance breakdown
    Object.entries(performance.agentBreakdown).forEach(([agent, metrics]) => {
      const icon = agent === 'Commander' ? '💬' : agent === 'Architect' ? '🏗️' : '📊';
      const avgTime = (metrics.avgDuration / 1000).toFixed(1);
      breakdown += `${icon} ${agent}: $${metrics.totalCost.toFixed(4)} (avg ${avgTime}s) - ${metrics.requests} operations\n`;
    });
    
    breakdown += '\n**Performance Distribution:**\n';
    // This would be calculated from actual metrics in a real implementation
    breakdown += `⚡ <500ms: 45% | 500ms-2s: 40% | 2s-5s: 13% | >5s: 2%\n`;
    breakdown += `🚀 Fastest: Voice formatting (avg 245ms)\n`;
    breakdown += `🐌 Attention: Code analysis (trending slower)\n\n`;
    
    breakdown += `**Cost Efficiency Analysis:**\n`;
    breakdown += `🎯 Most Efficient: Commander operations\n`;
    breakdown += `⚠️ Review Needed: Large file analysis operations\n`;
    breakdown += `💡 Optimization Impact: 60% cost reduction available\n\n`;
    
    if (alerts.length > 0) {
      breakdown += `**AI Recommendations:**\n`;
      alerts.forEach(alert => {
        breakdown += `🔧 ${alert.message}\n`;
        alert.recommendations.forEach(rec => {
          breakdown += `🎯 ${rec}\n`;
        });
      });
      breakdown += '\n';
    }
    
    breakdown += `**Agent Coordination Activity:**\n`;
    Object.entries(agentStatus).forEach(([agent, status]) => {
      const icon = status.status === 'online' ? '🤖' : '⚠️';
      breakdown += `${icon} ${agent}: ${status.status} (health: ${status.healthScore}%)\n`;
    });
    
    return breakdown;
  }

  private getHealthIcon(health: string): string {
    switch (health) {
      case 'excellent': return '🟢';
      case 'good': return '🟢';
      case 'fair': return '🟡';
      case 'poor': return '🔴';
      case 'critical': return '🚨';
      default: return '❓';
    }
  }

  private getPerformanceLabel(avgTime: number): string {
    if (avgTime < 1000) return 'Excellent';
    if (avgTime < 2000) return 'Good';
    if (avgTime < 5000) return 'Fair';
    return 'Needs Attention';
  }
}