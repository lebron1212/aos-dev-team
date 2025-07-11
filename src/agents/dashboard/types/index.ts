// Dashboard Agent Types
export interface DashboardConfig {
  dashboardToken: string;
  dashboardChannelId: string;
  agentCoordinationChannelId: string;
  claudeApiKey: string;
}

export interface APIMetrics {
  id: string;
  timestamp: string;
  agent: 'Commander' | 'Architect' | 'Dashboard';
  operation: string;
  duration: number; // milliseconds
  tokens: number;
  cost: number; // USD
  success: boolean;
  error?: string;
  requestSize?: number;
  responseSize?: number;
}

export interface PerformanceMetrics {
  averageResponseTime: number;
  totalRequests: number;
  successRate: number;
  totalCost: number;
  totalTokens: number;
  timeframe: string;
  agentBreakdown: {
    [agent: string]: {
      requests: number;
      avgDuration: number;
      totalCost: number;
      totalTokens: number;
      successRate: number;
    };
  };
}

export interface PerformanceAlert {
  type: 'cost' | 'performance' | 'error_rate' | 'anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metrics: Partial<PerformanceMetrics>;
  recommendations: string[];
  timestamp: string;
}

export interface AgentActivity {
  agent: string;
  operation: string;
  timestamp: string;
  duration: number;
  success: boolean;
  context?: string;
}

export interface InsightResponse {
  summary: string;
  analysis: string;
  recommendations: string[];
  metrics: PerformanceMetrics;
  alerts: PerformanceAlert[];
  shouldOfferHandoff: boolean;
  handoffTarget?: 'Commander' | 'Architect';
  handoffReason?: string;
}

export interface SystemHealthReport {
  timestamp: string;
  overall: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  performance: PerformanceMetrics;
  alerts: PerformanceAlert[];
  agentStatus: {
    [agent: string]: {
      status: 'online' | 'offline' | 'degraded';
      lastActivity: string;
      healthScore: number;
    };
  };
  budgetStatus: {
    dailySpent: number;
    dailyLimit: number;
    monthlySpent: number;
    monthlyLimit: number;
    projectedMonthly: number;
  };
  optimizationOpportunities: {
    description: string;
    estimatedSavings: number;
    complexity: 'low' | 'medium' | 'high';
    agent: string;
  }[];
}

export interface AgentMessage {
  from: 'Dashboard' | 'Commander' | 'Architect';
  to: 'Dashboard' | 'Commander' | 'Architect' | 'all';
  type: 'optimization_request' | 'performance_report' | 'cost_alert' | 'health_check';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  data: {
    operation: string;
    metrics: PerformanceMetrics;
    recommendations: string[];
    userContext: string;
    threadId?: string;
  };
  timestamp: string;
  requiresResponse: boolean;
}

export interface DashboardInteraction {
  timestamp: string;
  queryType: 'performance' | 'cost' | 'optimization' | 'health';
  userQuery: string;
  insightGenerated: string;
  actionTaken: 'architect_handoff' | 'commander_sync' | 'monitor_only';
  userSatisfaction: 'positive' | 'negative' | 'neutral';
  optimizationResult?: 'implemented' | 'declined' | 'pending';
}

export interface OptimizationRequest {
  id: string;
  targetAgent: 'Commander' | 'Architect';
  issue: string;
  supportingData: APIMetrics[];
  recommendations: string[];
  expectedImprovement: {
    costReduction: number; // percentage
    performanceGain: number; // percentage
    description: string;
  };
  userApproved: boolean;
  status: 'pending' | 'sent' | 'implemented' | 'declined';
  timestamp: string;
  userContext: string;
}

export interface DashboardQuery {
  query: string;
  context: {
    recentMetrics: APIMetrics[];
    agentActivity: AgentActivity[];
    timeframe: string;
  };
  userId: string;
  messageId: string;
}