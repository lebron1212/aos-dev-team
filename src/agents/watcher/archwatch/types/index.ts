export interface ArchitecturalDecision {
  id: string;
  timestamp: string;
  type: 'code-analysis' | 'system-modification' | 'agent-creation' | 'behavior-refinement' | 'system-status';
  request: string;
  result: DecisionResult;
  impact: 'low' | 'medium' | 'high';
  success: boolean;
  duration: number;
  changedFiles: string[];
}

export interface DecisionResult {
  summary: string;
  status: 'success' | 'failed' | 'partial';
  details?: any;
  error?: string;
}

export interface ArchitecturalInsight {
  type: 'pattern' | 'risk' | 'opportunity' | 'warning';
  message: string;
  confidence: number;
  relatedDecisions: string[];
}

export interface SystemEvolution {
  timeframe: string;
  totalChanges: number;
  successRate: number;
  riskDistribution: Record<string, number>;
  mostActiveAreas: string[];
  emergingPatterns: string[];
}
