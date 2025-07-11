// DashWatch Learning Types
export interface DashboardInteractionLog {
  id: string;
  timestamp: string;
  queryType: 'performance' | 'cost' | 'optimization' | 'health' | 'general';
  userQuery: string;
  responseType: string;
  userSatisfaction: 'positive' | 'negative' | 'neutral' | 'unknown';
  actionTaken: 'architect_handoff' | 'commander_sync' | 'monitor_only' | 'none';
  optimizationResult?: 'implemented' | 'declined' | 'pending';
  responseTime: number;
  contextMetrics: {
    totalCost: number;
    avgResponseTime: number;
    successRate: number;
    agentActivity: number;
  };
}

export interface DashboardPattern {
  type: 'query_pattern' | 'optimization_pattern' | 'timing_pattern' | 'preference_pattern';
  pattern: string;
  frequency: number;
  effectiveness: number;
  confidence: number;
  examples: string[];
  recommendations: string[];
}

export interface UserPreference {
  userId: string;
  preferredDetailLevel: 'brief' | 'detailed' | 'technical';
  preferredResponseFormat: 'embedded' | 'threaded' | 'direct';
  optimizationApprovalRate: number;
  mostValuedInsights: string[];
  commonQueryTypes: string[];
  timePreference: 'realtime' | 'scheduled' | 'on_demand';
}

export interface DashboardInsight {
  type: 'effectiveness' | 'pattern' | 'optimization' | 'user_behavior';
  message: string;
  confidence: number;
  supportingData: any[];
  actionable: boolean;
  recommendation?: string;
}

export interface OptimizationEffectiveness {
  requestId: string;
  targetAgent: string;
  issue: string;
  implementation: 'success' | 'partial' | 'failed' | 'ignored';
  actualImprovement?: {
    costReduction: number;
    performanceGain: number;
    userSatisfaction: number;
  };
  timeToImplementation?: number;
  userFeedback?: string;
}