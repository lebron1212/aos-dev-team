export interface ArchitectConfig {
  architectToken: string;
  architectChannelId: string;
  claudeApiKey: string;
}

export interface ArchitecturalRequest {
  type: 'analyze-code' | 'modify-system' | 'build-agent' | 'refine-behavior' | 'system-status';
  description: string;
  target?: string;
  priority: 'low' | 'medium' | 'high';
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ModificationPlan {
  id: string;
  description: string;
  files: string[];
  changes: Change[];
  riskLevel: 'low' | 'medium' | 'high';
  requiresApproval: boolean;
  estimatedImpact: string;
}

export interface Change {
  file: string;
  type: 'modify' | 'create' | 'delete';
  description: string;
  location?: string;
  content?: string;
}

export interface AgentSpec {
  name: string;
  purpose: string;
  capabilities: string[];
  dependencies: string[];
  structure: {
    core: string[];
    intelligence: string[];
    communication: string[];
  };
}

export interface AnalysisResult {
  files: string[];
  summary: string;
  issues: string[];
  suggestions: string[];
  complexity: 'low' | 'medium' | 'high';
  healthScore: number;
}
