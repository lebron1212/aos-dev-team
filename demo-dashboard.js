#!/usr/bin/env node
/**
 * Dashboard Agent Demo
 * 
 * This script demonstrates the Dashboard Agent functionality
 * without requiring actual Discord tokens or Claude API access.
 * 
 * Run with: node demo-dashboard.js
 */

import { APIUsageTracker } from '../src/agents/dashboard/intelligence/APIUsageTracker.js';
import { PerformanceAnalyzer } from '../src/agents/dashboard/intelligence/PerformanceAnalyzer.js';
import { DashWatch } from '../src/agents/watcher/dashwatch/DashWatch.js';

console.log('🎯 Dashboard Agent Demo\n');

// Create instances
const usageTracker = new APIUsageTracker();
const performanceAnalyzer = new PerformanceAnalyzer(usageTracker);
const dashWatch = new DashWatch('mock-api-key');

// Simulate some API usage data
console.log('📊 Simulating API usage data...\n');

// Commander operations
await usageTracker.trackAPICall('Commander', 'voice_formatting', 245, 150, 0.0012, true);
await usageTracker.trackAPICall('Commander', 'intent_analysis', 892, 450, 0.0036, true);
await usageTracker.trackAPICall('Commander', 'user_interaction', 1200, 600, 0.0048, true);

// Architect operations  
await usageTracker.trackAPICall('Architect', 'code_analysis', 4800, 3000, 0.0240, true);
await usageTracker.trackAPICall('Architect', 'system_modification', 2100, 800, 0.0064, true);
await usageTracker.trackAPICall('Architect', 'health_scan', 6200, 3500, 0.0280, true);

// Dashboard operations
await usageTracker.trackAPICall('Dashboard', 'query_analysis', 450, 300, 0.0024, true);
await usageTracker.trackAPICall('Dashboard', 'performance_report', 320, 200, 0.0016, true);

// Get session metrics
console.log('📈 Session Performance Metrics:');
const sessionMetrics = usageTracker.getSessionMetrics();
console.log(`   Total Requests: ${sessionMetrics.totalRequests}`);
console.log(`   Average Response Time: ${(sessionMetrics.averageResponseTime / 1000).toFixed(1)}s`);
console.log(`   Success Rate: ${(sessionMetrics.successRate * 100).toFixed(1)}%`);
console.log(`   Total Cost: $${sessionMetrics.totalCost.toFixed(4)}`);
console.log(`   Total Tokens: ${sessionMetrics.totalTokens.toLocaleString()}\n`);

// Agent breakdown
console.log('🤖 Agent Performance Breakdown:');
Object.entries(sessionMetrics.agentBreakdown).forEach(([agent, breakdown]) => {
  console.log(`   ${agent}:`);
  console.log(`     Requests: ${breakdown.requests}`);
  console.log(`     Avg Duration: ${(breakdown.avgDuration / 1000).toFixed(1)}s`);
  console.log(`     Total Cost: $${breakdown.totalCost.toFixed(4)}`);
  console.log(`     Success Rate: ${(breakdown.successRate * 100).toFixed(1)}%\n`);
});

// Performance analysis
console.log('🔍 Performance Analysis:');
const trends = performanceAnalyzer.analyzePerformanceTrends(24);
console.log(`   Trend: ${trends.trend} (${(trends.confidence * 100).toFixed(0)}% confidence)`);
console.log(`   Details: ${trends.details}`);
console.log(`   Recommendations:`);
trends.recommendations.forEach((rec, index) => {
  console.log(`     ${index + 1}. ${rec}`);
});
console.log();

// Top operations
console.log('🔝 Top Operations by Cost:');
const topOps = usageTracker.getTopOperations(5, 24);
topOps.forEach((op, index) => {
  console.log(`   ${index + 1}. ${op.agent} ${op.operation}:`);
  console.log(`      Count: ${op.count}, Cost: $${op.totalCost.toFixed(4)}, Avg: ${(op.avgDuration / 1000).toFixed(1)}s`);
});
console.log();

// Agent efficiency
console.log('⚡ Agent Efficiency Rankings:');
const efficiency = usageTracker.getAgentEfficiency();
efficiency.forEach((agent, index) => {
  console.log(`   ${index + 1}. ${agent.agent}:`);
  console.log(`      Efficiency Score: ${agent.efficiency.toFixed(3)}`);
  console.log(`      Tokens/Cent: ${agent.tokensPerCent.toFixed(1)}`);
  console.log(`      Avg Response: ${(agent.avgResponseTime / 1000).toFixed(1)}s`);
  console.log(`      Success Rate: ${(agent.successRate * 100).toFixed(1)}%\n`);
});

// Bottleneck detection
console.log('🚧 Bottleneck Detection:');
const bottlenecks = performanceAnalyzer.identifyBottlenecks(24);
if (bottlenecks.length > 0) {
  bottlenecks.forEach((bottleneck, index) => {
    console.log(`   ${index + 1}. ${bottleneck.description} (${bottleneck.impact} impact)`);
    console.log(`      Recommendations: ${bottleneck.recommendations.join(', ')}\n`);
  });
} else {
  console.log('   No significant bottlenecks detected ✅\n');
}

// Anomaly detection
console.log('⚠️ Anomaly Detection:');
const alerts = usageTracker.detectAnomalies();
if (alerts.length > 0) {
  alerts.forEach((alert, index) => {
    console.log(`   ${index + 1}. ${alert.type.toUpperCase()}: ${alert.message}`);
    console.log(`      Severity: ${alert.severity}`);
    console.log(`      Recommendations: ${alert.recommendations.join(', ')}\n`);
  });
} else {
  console.log('   No anomalies detected ✅\n');
}

// Optimization recommendations
console.log('💡 Optimization Opportunities:');
const architectOptimization = performanceAnalyzer.shouldRecommendOptimization('Architect', 'health_scan');
if (architectOptimization.recommend) {
  console.log(`   🔧 Architect Health Scan Optimization:`);
  console.log(`      Priority: ${architectOptimization.priority}`);
  console.log(`      Confidence: ${(architectOptimization.confidence * 100).toFixed(0)}%`);
  console.log(`      Reasoning: ${architectOptimization.reasoning}\n`);
} else {
  console.log('   No immediate optimizations recommended ✅\n');
}

// Dashboard Watch demo
console.log('👁️ Dashboard Watch Learning Demo:');
await dashWatch.logDashboardInteraction(
  'performance',
  'Why is the architect so slow today?',
  'insight_with_optimization',
  'demo-user',
  1200,
  {
    totalCost: sessionMetrics.totalCost,
    avgResponseTime: sessionMetrics.averageResponseTime,
    successRate: sessionMetrics.successRate,
    agentActivity: sessionMetrics.totalRequests
  },
  'architect_handoff'
);

const insights = await dashWatch.getDashboardInsights();
if (insights.length > 0) {
  insights.forEach((insight, index) => {
    console.log(`   ${index + 1}. ${insight.type.toUpperCase()}: ${insight.message}`);
    console.log(`      Confidence: ${(insight.confidence * 100).toFixed(0)}%`);
    if (insight.actionable && insight.recommendation) {
      console.log(`      Recommendation: ${insight.recommendation}`);
    }
    console.log();
  });
} else {
  console.log('   Learning from interactions... more data needed for insights\n');
}

// Performance distribution
console.log('📊 Performance Distribution:');
const distribution = performanceAnalyzer.generatePerformanceDistribution();
if (distribution.totalRequests > 0) {
  const fastPct = (distribution.fast / distribution.totalRequests * 100).toFixed(0);
  const normalPct = (distribution.normal / distribution.totalRequests * 100).toFixed(0);
  const slowPct = (distribution.slow / distribution.totalRequests * 100).toFixed(0);
  const verySlowPct = (distribution.verySlow / distribution.totalRequests * 100).toFixed(0);
  
  console.log(`   ⚡ <500ms: ${fastPct}% | 500ms-2s: ${normalPct}% | 2s-5s: ${slowPct}% | >5s: ${verySlowPct}%`);
  console.log(`   Total analyzed: ${distribution.totalRequests} requests\n`);
}

console.log('✨ Demo completed! This showcases the Dashboard Agent\'s core monitoring and analysis capabilities.');
console.log('   📝 In production, this would integrate with Discord for real-time insights and cross-agent coordination.');
console.log('   🔧 Agent optimization requests would be sent through the coordination channel.');
console.log('   🎯 AI-powered insights would help users understand system performance and costs.');