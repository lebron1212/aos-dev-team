import * as fs from 'fs/promises';
import { APIMetrics, PerformanceMetrics, PerformanceAlert } from '../types/index.js';

export class APIUsageTracker {
  private metrics: APIMetrics[] = [];
  private metricsFile = 'data/api-usage-metrics.json';
  private sessionStartTime: Date;
  private maxMetricsHistory = 10000; // Keep last 10k entries

  constructor() {
    this.sessionStartTime = new Date();
    this.loadMetrics();
    console.log('[APIUsageTracker] API usage tracking initialized');
  }

  async trackAPICall(
    agent: 'Commander' | 'Architect' | 'Dashboard',
    operation: string,
    duration: number,
    tokens: number,
    cost: number,
    success: boolean,
    error?: string,
    requestSize?: number,
    responseSize?: number
  ): Promise<void> {
    const metric: APIMetrics = {
      id: `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      agent,
      operation,
      duration,
      tokens,
      cost,
      success,
      error,
      requestSize,
      responseSize
    };

    this.metrics.push(metric);

    // Maintain history limit
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }

    await this.saveMetrics();
    
    console.log(`[APIUsageTracker] ${agent} ${operation}: ${duration}ms, ${tokens} tokens, $${cost.toFixed(4)}, ${success ? 'success' : 'failed'}`);
  }

  getSessionMetrics(): PerformanceMetrics {
    const sessionMetrics = this.metrics.filter(m => 
      new Date(m.timestamp) >= this.sessionStartTime
    );

    return this.calculateMetrics(sessionMetrics, 'current session');
  }

  getMetrics(timeframeHours: number = 24): PerformanceMetrics {
    const cutoff = new Date(Date.now() - timeframeHours * 60 * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => 
      new Date(m.timestamp) >= cutoff
    );

    return this.calculateMetrics(recentMetrics, `${timeframeHours}h`);
  }

  getRecentMetrics(limit: number = 50): APIMetrics[] {
    return this.metrics.slice(-limit);
  }

  private calculateMetrics(metrics: APIMetrics[], timeframe: string): PerformanceMetrics {
    if (metrics.length === 0) {
      return {
        averageResponseTime: 0,
        totalRequests: 0,
        successRate: 0,
        totalCost: 0,
        totalTokens: 0,
        timeframe,
        agentBreakdown: {}
      };
    }

    const totalRequests = metrics.length;
    const successfulRequests = metrics.filter(m => m.success).length;
    const successRate = successfulRequests / totalRequests;
    
    const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
    const averageResponseTime = totalDuration / totalRequests;
    
    const totalCost = metrics.reduce((sum, m) => sum + m.cost, 0);
    const totalTokens = metrics.reduce((sum, m) => sum + m.tokens, 0);

    // Agent breakdown
    const agentGroups = metrics.reduce((groups, metric) => {
      if (!groups[metric.agent]) {
        groups[metric.agent] = [];
      }
      groups[metric.agent].push(metric);
      return groups;
    }, {} as Record<string, APIMetrics[]>);

    const agentBreakdown: PerformanceMetrics['agentBreakdown'] = {};
    
    for (const [agent, agentMetrics] of Object.entries(agentGroups)) {
      const requests = agentMetrics.length;
      const successful = agentMetrics.filter(m => m.success).length;
      const avgDuration = agentMetrics.reduce((sum, m) => sum + m.duration, 0) / requests;
      const totalCostAgent = agentMetrics.reduce((sum, m) => sum + m.cost, 0);
      const totalTokensAgent = agentMetrics.reduce((sum, m) => sum + m.tokens, 0);
      
      agentBreakdown[agent] = {
        requests,
        avgDuration,
        totalCost: totalCostAgent,
        totalTokens: totalTokensAgent,
        successRate: successful / requests
      };
    }

    return {
      averageResponseTime,
      totalRequests,
      successRate,
      totalCost,
      totalTokens,
      timeframe,
      agentBreakdown
    };
  }

  detectAnomalies(baselineHours: number = 168): PerformanceAlert[] {
    const alerts: PerformanceAlert[] = [];
    const currentMetrics = this.getMetrics(1); // Last hour
    const baselineMetrics = this.getMetrics(baselineHours); // Last week

    if (currentMetrics.totalRequests === 0) {
      return alerts;
    }

    // Performance degradation check
    if (baselineMetrics.averageResponseTime > 0) {
      const performanceChange = (currentMetrics.averageResponseTime - baselineMetrics.averageResponseTime) / baselineMetrics.averageResponseTime;
      if (performanceChange > 0.5) { // 50% slower
        alerts.push({
          type: 'performance',
          severity: performanceChange > 1.0 ? 'high' : 'medium',
          message: `Response time increased by ${(performanceChange * 100).toFixed(1)}%`,
          metrics: { averageResponseTime: currentMetrics.averageResponseTime },
          recommendations: [
            'Check for high-complexity operations',
            'Review recent code changes',
            'Consider system optimization'
          ],
          timestamp: new Date().toISOString()
        });
      }
    }

    // Cost spike detection
    if (baselineMetrics.totalCost > 0) {
      const hourlyBaseline = baselineMetrics.totalCost / baselineHours;
      if (currentMetrics.totalCost > hourlyBaseline * 3) { // 3x normal hourly spend
        alerts.push({
          type: 'cost',
          severity: currentMetrics.totalCost > hourlyBaseline * 5 ? 'critical' : 'high',
          message: `Cost spike detected: $${currentMetrics.totalCost.toFixed(4)} vs baseline $${hourlyBaseline.toFixed(4)}/hour`,
          metrics: { totalCost: currentMetrics.totalCost },
          recommendations: [
            'Review expensive operations',
            'Check for repeated failed requests',
            'Consider request optimization'
          ],
          timestamp: new Date().toISOString()
        });
      }
    }

    // Error rate check
    if (currentMetrics.successRate < 0.8 && currentMetrics.totalRequests > 5) {
      alerts.push({
        type: 'error_rate',
        severity: currentMetrics.successRate < 0.5 ? 'critical' : 'high',
        message: `High error rate: ${((1 - currentMetrics.successRate) * 100).toFixed(1)}%`,
        metrics: { successRate: currentMetrics.successRate },
        recommendations: [
          'Check system logs for errors',
          'Verify API connectivity',
          'Review recent changes'
        ],
        timestamp: new Date().toISOString()
      });
    }

    return alerts;
  }

  getTopOperations(limit: number = 10, timeframeHours: number = 24): Array<{
    operation: string;
    agent: string;
    count: number;
    totalCost: number;
    avgDuration: number;
  }> {
    const cutoff = new Date(Date.now() - timeframeHours * 60 * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => 
      new Date(m.timestamp) >= cutoff
    );

    const operationGroups = recentMetrics.reduce((groups, metric) => {
      const key = `${metric.agent}:${metric.operation}`;
      if (!groups[key]) {
        groups[key] = {
          operation: metric.operation,
          agent: metric.agent,
          metrics: []
        };
      }
      groups[key].metrics.push(metric);
      return groups;
    }, {} as Record<string, { operation: string; agent: string; metrics: APIMetrics[] }>);

    return Object.values(operationGroups)
      .map(group => ({
        operation: group.operation,
        agent: group.agent,
        count: group.metrics.length,
        totalCost: group.metrics.reduce((sum, m) => sum + m.cost, 0),
        avgDuration: group.metrics.reduce((sum, m) => sum + m.duration, 0) / group.metrics.length
      }))
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, limit);
  }

  getAgentEfficiency(): Array<{
    agent: string;
    tokensPerCent: number;
    avgResponseTime: number;
    successRate: number;
    efficiency: number; // Higher is better
  }> {
    const metrics24h = this.getMetrics(24);
    
    return Object.entries(metrics24h.agentBreakdown)
      .map(([agent, breakdown]) => {
        const tokensPerCent = breakdown.totalCost > 0 ? breakdown.totalTokens / (breakdown.totalCost * 100) : 0;
        const efficiency = breakdown.successRate * tokensPerCent / (breakdown.avgDuration / 1000);
        
        return {
          agent,
          tokensPerCent,
          avgResponseTime: breakdown.avgDuration,
          successRate: breakdown.successRate,
          efficiency
        };
      })
      .sort((a, b) => b.efficiency - a.efficiency);
  }

  private async loadMetrics(): Promise<void> {
    try {
      const data = await fs.readFile(this.metricsFile, 'utf8');
      this.metrics = JSON.parse(data);
      console.log(`[APIUsageTracker] Loaded ${this.metrics.length} historical metrics`);
    } catch (error) {
      this.metrics = [];
      console.log('[APIUsageTracker] No previous metrics found, starting fresh');
    }
  }

  private async saveMetrics(): Promise<void> {
    try {
      await fs.mkdir('data', { recursive: true });
      await fs.writeFile(this.metricsFile, JSON.stringify(this.metrics, null, 2));
    } catch (error) {
      console.error('[APIUsageTracker] Failed to save metrics:', error);
    }
  }
}