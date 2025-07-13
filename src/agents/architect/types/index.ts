// src/agents/architect/types/index.ts
export interface ArchitectConfig {
  architectToken: string;
  architectChannelId: string;
  claudeApiKey: string;
  discordToken?: string;
  githubToken?: string;
  learningEnabled?: boolean;
  selfImprovementEnabled?: boolean;
}

export interface ArchitecturalRequest {
  type: 'code-analysis' | 'system-modification' | 'agent-creation' | 'behavior-refinement' | 
        'system-status' | 'discord-bot-setup' | 'self-improvement' | 'codebase-analysis' |
        'agent-enhancement' | 'performance-optimization' | 'learning-analysis';
  description: string;
  target?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  riskLevel: 'low' | 'medium' | 'high';
  intelligence?: {
    requiresLearning?: boolean;
    adaptiveResponse?: boolean;
    selfModification?: boolean;
  };
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
  discordIntegration?: boolean;
  createWatcher?: boolean;
  voicePersonality?: string;
  watcherPurpose?: string;
  intelligence?: {
    learningCapabilities: string[];
    adaptationMethods: string[];
    selfImprovementEnabled?: boolean;
    feedbackIntegration?: boolean;
    performanceMonitoring?: boolean;
  };
  advancedFeatures?: {
    multiStepReasoning?: boolean;
    contextAwareness?: boolean;
    goalAlignment?: boolean;
    ethicalConstraints?: string[];
  };
}

export interface IntelligentModificationPlan {
  id: string;
  description: string;
  files: string[];
  changes: IntelligentChange[];
  riskLevel: 'low' | 'medium' | 'high';
  requiresApproval: boolean;
  estimatedImpact: string;
  intelligence: {
    patternRecognition: string[];
    learningInsights: string[];
    adaptiveElements: string[];
  };
  rollbackPlan: string[];
  testingStrategy: string[];
}

export interface IntelligentChange {
  file: string;
  type: 'modify' | 'create' | 'delete' | 'enhance';
  description: string;
  location?: string;
  content?: string;
  intelligence: {
    reasoningProcess: string;
    confidenceLevel: number;
    alternativeApproaches: string[];
    learningPoints: string[];
  };
  validation: {
    syntaxCheck: boolean;
    logicCheck: boolean;
    integrationCheck: boolean;
  };
}

export interface AnalysisResult {
  files: string[];
  summary: string;
  issues: string[];
  suggestions: string[];
  complexity: 'low' | 'medium' | 'high';
  healthScore: number;
  intelligence: {
    patterns: string[];
    insights: string[];
    recommendations: string[];
    learningOpportunities: string[];
  };
  futureOptimizations: string[];
}

export interface LearningMetrics {
  successRate: number;
  averageResponseTime: number;
  userSatisfaction: number;
  learningRate: number;
  adaptationSpeed: number;
  insights: string[];
  patterns: {
    successful: string[];
    problematic: string[];
  };
}

export interface SelfImprovementPlan {
  target: string;
  improvements: Array<{
    type: 'performance' | 'intelligence' | 'capability' | 'learning';
    description: string;
    implementation: string;
    riskLevel: 'low' | 'medium' | 'high';
    expectedBenefit: string;
    rollbackStrategy: string;
  }>;
  timeline: string;
  successMetrics: string[];
}

export interface CodebaseKnowledge {
  agents: {
    [agentName: string]: {
      purpose: string;
      capabilities: string[];
      files: string[];
      patterns: string[];
      performance: LearningMetrics;
    };
  };
  patterns: {
    [patternName: string]: {
      description: string;
      files: string[];
      usage: string[];
      effectiveness: number;
    };
  };
  architecture: {
    layers: string[];
    dependencies: Record<string, string[]>;
    integrationPoints: string[];
    growthAreas: string[];
  };
  learning: {
    successfulModifications: any[];
    failedAttempts: any[];
    userPreferences: any[];
    optimizationHistory: any[];
  };
}

export interface IntelligentAgentBuildResult {
  summary: string;
  agentSpec: AgentSpec;
  files: string[];
  agentPath: string;
  capabilities: string[];
  intelligence: {
    learningCapabilities: string[];
    adaptationMethods: string[];
    performanceMonitoring: boolean;
  };
  ready: boolean;
  committed: boolean;
  codebaseImpact: {
    newPatterns: string[];
    enhancedCapabilities: string[];
    systemImplications: string[];
  };
  watcherResult?: {
    summary: string;
    files: string[];
    learningCapabilities: string[];
  };
  environmentSetup: {
    variables: string[];
    deploymentTriggered: boolean;
    integrationComplete: boolean;
  };
}

export interface BehaviorRefinementSpec {
  target: string; // Which agent/component to refine
  refinement: string; // What to change
  intelligenceLevel: 'basic' | 'intermediate' | 'advanced';
  scope: 'voice' | 'logic' | 'learning' | 'performance' | 'all';
  adaptiveElements: string[];
  preserveElements: string[];
  learningIntegration: boolean;
}

export interface PerformanceOptimization {
  target: string;
  currentMetrics: Record<string, number>;
  optimizationGoals: Record<string, number>;
  strategies: Array<{
    type: 'algorithm' | 'caching' | 'parallel' | 'intelligence';
    description: string;
    expectedImprovement: number;
    riskLevel: 'low' | 'medium' | 'high';
  }>;
  implementationPlan: string[];
  rollbackStrategy: string[];
}

export interface FeedbackIntegration {
  source: 'user' | 'system' | 'performance' | 'error';
  type: 'positive' | 'negative' | 'suggestion' | 'correction';
  content: string;
  context: any;
  processing: {
    classification: string;
    actionItems: string[];
    learningPoints: string[];
    immediateActions: string[];
    longTermImprovements: string[];
  };
  integration: {
    applied: boolean;
    impact: string;
    futureConsiderations: string[];
  };
}

export interface EvolutionTracker {
  timestamp: Date;
  type: 'creation' | 'modification' | 'enhancement' | 'optimization';
  target: string;
  changes: string[];
  reasoning: string;
  outcome: 'success' | 'failure' | 'partial';
  learning: {
    patterns: string[];
    insights: string[];
    futureApplications: string[];
  };
  metrics: {
    before: Record<string, any>;
    after: Record<string, any>;
    improvement: Record<string, number>;
  };
}

// Utility types for enhanced functionality
export type IntelligenceLevel = 'basic' | 'intermediate' | 'advanced' | 'expert';
export type LearningMode = 'passive' | 'active' | 'aggressive' | 'conservative';
export type AdaptationStrategy = 'gradual' | 'immediate' | 'scheduled' | 'user-driven';

export interface AgentEvolutionPath {
  currentLevel: IntelligenceLevel;
  targetLevel: IntelligenceLevel;
  milestones: Array<{
    description: string;
    requirements: string[];
    timeline: string;
    successCriteria: string[];
  }>;
  blockers: string[];
  opportunities: string[];
}
