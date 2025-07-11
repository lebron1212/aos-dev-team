import { APIMetrics, PerformanceMetrics, PerformanceAlert, AgentActivity } from '../types/index.js';
import { APIUsageTracker } from './APIUsageTracker.js';

export class PerformanceAnalyzer {
  private usageTracker: APIUsageTracker;

  constructor(usageTracker: APIUsageTracker) {
    this.usageTracker = usageTracker;
    console.log('[PerformanceAnalyzer] Performance analysis system initialized');
  }

  analyzePerformanceTrends(timeframeHours: number = 24): {
    trend: 'improving' | 'degrading' | 'stable';
    confidence: number;
    details: string;
    recommendations: string[];
  } {
    // Compare recent performance to earlier periods
    const recent = this.usageTracker.getMetrics(timeframeHours / 4); // Last quarter period
    const baseline = this.usageTracker.getMetrics(timeframeHours); // Full period
    
    if (recent.totalRequests === 0 || baseline.totalRequests === 0) {
      return {
        trend: 'stable',
        confidence: 0.1,
        details: 'Insufficient data for trend analysis',
        recommendations: ['Continue monitoring as usage increases']
      };
    }

    const responseTimeChange = (recent.averageResponseTime - baseline.averageResponseTime) / baseline.averageResponseTime;
    const successRateChange = recent.successRate - baseline.successRate;
    
    let trend: 'improving' | 'degrading' | 'stable';
    let confidence = 0.7;
    let details = '';
    const recommendations: string[] = [];

    // Determine trend
    if (responseTimeChange < -0.1 || successRateChange > 0.05) {
      trend = 'improving';
      details = `Performance improving: ${responseTimeChange < -0.1 ? `${Math.abs(responseTimeChange * 100).toFixed(1)}% faster` : ''} ${successRateChange > 0.05 ? `${(successRateChange * 100).toFixed(1)}% higher success rate` : ''}`.trim();
      recommendations.push('Maintain current optimization practices');
    } else if (responseTimeChange > 0.2 || successRateChange < -0.1) {
      trend = 'degrading';
      details = `Performance degrading: ${responseTimeChange > 0.2 ? `${(responseTimeChange * 100).toFixed(1)}% slower` : ''} ${successRateChange < -0.1 ? `${Math.abs(successRateChange * 100).toFixed(1)}% lower success rate` : ''}`.trim();
      recommendations.push('Investigate recent changes', 'Review high-duration operations');
      if (successRateChange < -0.1) {
        recommendations.push('Check error logs for failure patterns');
      }
    } else {
      trend = 'stable';
      details = 'Performance metrics within normal variance';
      recommendations.push('Monitor for optimization opportunities');
    }

    // Adjust confidence based on sample size
    if (recent.totalRequests < 10) confidence *= 0.5;
    if (baseline.totalRequests < 50) confidence *= 0.7;

    return { trend, confidence, details, recommendations };
  }

  identifyBottlenecks(timeframeHours: number = 24): Array<{
    type: 'operation' | 'agent' | 'time_pattern';
    description: string;
    impact: 'low' | 'medium' | 'high';
    metrics: any;
    recommendations: string[];
  }> {
    const bottlenecks: Array<{
      type: 'operation' | 'agent' | 'time_pattern';
      description: string;
      impact: 'low' | 'medium' | 'high';
      metrics: any;
      recommendations: string[];
    }> = [];

    // Operation bottlenecks
    const topOperations = this.usageTracker.getTopOperations(10, timeframeHours);
    const slowOperations = topOperations.filter(op => op.avgDuration > 5000); // > 5 seconds

    slowOperations.forEach(op => {
      const impact = op.avgDuration > 10000 ? 'high' : op.avgDuration > 7500 ? 'medium' : 'low';
      bottlenecks.push({
        type: 'operation',
        description: `${op.agent} ${op.operation} averaging ${(op.avgDuration / 1000).toFixed(1)}s`,
        impact,
        metrics: op,
        recommendations: [
          'Analyze operation complexity',
          'Consider caching if applicable',
          'Review input size and processing logic'
        ]
      });
    });

    // Agent efficiency bottlenecks
    const agentEfficiency = this.usageTracker.getAgentEfficiency();
    const inefficientAgents = agentEfficiency.filter(agent => agent.efficiency < 0.1);

    inefficientAgents.forEach(agent => {
      bottlenecks.push({
        type: 'agent',
        description: `${agent.agent} showing low efficiency (${agent.efficiency.toFixed(3)})`,
        impact: agent.avgResponseTime > 5000 ? 'high' : 'medium',
        metrics: agent,
        recommendations: [
          'Review agent operation patterns',
          'Optimize high-frequency operations',
          'Check for unnecessary API calls'
        ]
      });
    });

    return bottlenecks.sort((a, b) => {
      const impactOrder = { high: 3, medium: 2, low: 1 };
      return impactOrder[b.impact] - impactOrder[a.impact];
    });
  }

  generatePerformanceDistribution(): {
    fast: number; // < 500ms
    normal: number; // 500ms - 2s
    slow: number; // 2s - 5s
    verySlow: number; // > 5s
    totalRequests: number;
  } {
    const recentMetrics = this.usageTracker.getRecentMetrics(1000);
    
    if (recentMetrics.length === 0) {
      return { fast: 0, normal: 0, slow: 0, verySlow: 0, totalRequests: 0 };
    }

    const distribution = recentMetrics.reduce((dist, metric) => {
      if (metric.duration < 500) dist.fast++;
      else if (metric.duration < 2000) dist.normal++;
      else if (metric.duration < 5000) dist.slow++;
      else dist.verySlow++;
      return dist;
    }, { fast: 0, normal: 0, slow: 0, verySlow: 0 });

    return {
      ...distribution,
      totalRequests: recentMetrics.length
    };
  }

  calculateOptimizationImpact(operation: string, agent: string): {
    currentMetrics: { avgDuration: number; totalCost: number; frequency: number };
    optimizationPotential: { timeReduction: number; costReduction: number; confidence: number };
    recommendations: string[];
  } {
    const topOperations = this.usageTracker.getTopOperations(50, 168); // Last week
    const targetOp = topOperations.find(op => op.operation === operation && op.agent === agent);
    
    if (!targetOp) {
      return {
        currentMetrics: { avgDuration: 0, totalCost: 0, frequency: 0 },
        optimizationPotential: { timeReduction: 0, costReduction: 0, confidence: 0 },
        recommendations: ['Operation not found in recent metrics']
      };
    }

    // Estimate optimization potential based on operation characteristics
    let timeReduction = 0;
    let costReduction = 0;
    let confidence = 0.5;
    const recommendations: string[] = [];

    // Duration-based optimizations
    if (targetOp.avgDuration > 5000) {
      timeReduction = 0.4; // 40% improvement potential
      confidence = 0.7;
      recommendations.push('Implement caching for repeated operations');
      recommendations.push('Optimize processing algorithms');
    } else if (targetOp.avgDuration > 2000) {
      timeReduction = 0.25; // 25% improvement potential
      confidence = 0.6;
      recommendations.push('Review operation efficiency');
    }

    // Cost-based optimizations
    if (targetOp.totalCost > 0.01) { // High-cost operations
      if (operation.includes('analysis') || operation.includes('health')) {
        costReduction = 0.6; // File filtering can reduce cost significantly
        recommendations.push('Implement selective file scanning');
        recommendations.push('Cache analysis results');
      } else {
        costReduction = 0.3; // General optimization
        recommendations.push('Optimize request size');
      }
      confidence = Math.max(confidence, 0.8);
    }

    // Frequency-based recommendations
    if (targetOp.count > 10) {
      recommendations.push('High-frequency operation - prioritize optimization');
      confidence = Math.max(confidence, 0.7);
    }

    return {
      currentMetrics: {
        avgDuration: targetOp.avgDuration,
        totalCost: targetOp.totalCost,
        frequency: targetOp.count
      },
      optimizationPotential: {
        timeReduction,
        costReduction,
        confidence
      },
      recommendations
    };
  }

  shouldRecommendOptimization(agent: string, operation: string): {
    recommend: boolean;
    confidence: number;
    reasoning: string;
    priority: 'low' | 'medium' | 'high';
  } {
    const impact = this.calculateOptimizationImpact(operation, agent);
    
    if (impact.currentMetrics.frequency === 0) {
      return {
        recommend: false,
        confidence: 0,
        reasoning: 'Operation not found in recent activity',
        priority: 'low'
      };
    }

    const { timeReduction, costReduction, confidence } = impact.optimizationPotential;
    const { avgDuration, totalCost, frequency } = impact.currentMetrics;

    // Calculate recommendation score
    let score = 0;
    let reasoning = '';
    
    // High cost impact
    if (totalCost > 0.005 && costReduction > 0.3) {
      score += 0.4;
      reasoning += `High cost operation ($${totalCost.toFixed(4)}) with ${(costReduction * 100).toFixed(0)}% reduction potential. `;
    }

    // High duration impact
    if (avgDuration > 3000 && timeReduction > 0.2) {
      score += 0.3;
      reasoning += `Slow operation (${(avgDuration / 1000).toFixed(1)}s) with ${(timeReduction * 100).toFixed(0)}% improvement potential. `;
    }

    // High frequency impact
    if (frequency > 5 && (timeReduction > 0.15 || costReduction > 0.2)) {
      score += 0.3;
      reasoning += `Frequent operation (${frequency} calls) with optimization opportunity. `;
    }

    const recommend = score > 0.4 && confidence > 0.5;
    const priority = score > 0.8 ? 'high' : score > 0.6 ? 'medium' : 'low';

    return {
      recommend,
      confidence,
      reasoning: reasoning.trim(),
      priority
    };
  }

  generateEfficiencyReport(): {
    fastestOperations: Array<{ operation: string; agent: string; avgDuration: number }>;
    slowestOperations: Array<{ operation: string; agent: string; avgDuration: number }>;
    mostEfficientAgents: Array<{ agent: string; efficiency: number; reasoning: string }>;
    costEfficiencyLeaders: Array<{ operation: string; agent: string; tokensPerCent: number }>;
  } {
    const topOperations = this.usageTracker.getTopOperations(20, 24);
    const agentEfficiency = this.usageTracker.getAgentEfficiency();

    const fastestOperations = topOperations
      .filter(op => op.count > 2) // Only operations with meaningful sample size
      .sort((a, b) => a.avgDuration - b.avgDuration)
      .slice(0, 5)
      .map(op => ({
        operation: op.operation,
        agent: op.agent,
        avgDuration: op.avgDuration
      }));

    const slowestOperations = topOperations
      .filter(op => op.count > 2)
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 5)
      .map(op => ({
        operation: op.operation,
        agent: op.agent,
        avgDuration: op.avgDuration
      }));

    const mostEfficientAgents = agentEfficiency.map(agent => ({
      agent: agent.agent,
      efficiency: agent.efficiency,
      reasoning: `${agent.tokensPerCent.toFixed(1)} tokens/cent, ${(agent.avgResponseTime / 1000).toFixed(1)}s avg, ${(agent.successRate * 100).toFixed(1)}% success`
    }));

    const costEfficiencyLeaders = topOperations
      .filter(op => op.totalCost > 0.001) // Only meaningful cost operations
      .map(op => ({
        operation: op.operation,
        agent: op.agent,
        tokensPerCent: op.totalCost > 0 ? (op.count * 1000) / (op.totalCost * 100) : 0 // Estimate tokens per cent
      }))
      .sort((a, b) => b.tokensPerCent - a.tokensPerCent)
      .slice(0, 5);

    return {
      fastestOperations,
      slowestOperations,
      mostEfficientAgents,
      costEfficiencyLeaders
    };
  }
}