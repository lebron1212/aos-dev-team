// Commander Core Types
export interface UniversalIntent {
  // Level 1: Primary category
  category: 'build' | 'modify' | 'analyze' | 'manage' | 'question' | 'conversation';
  
  // Level 2: Sub-category
  subcategory?: string; // build-ui, build-api, modify-existing, etc.
  
  // Level 3: Specific intent
  specific?: string; // build-ui-form, build-ui-component, etc.
  
  // Confidence and context
  confidence: number;
  reasoning: string;
  
  // Required resources
  requiredAgents: string[];
  estimatedComplexity: 'simple' | 'medium' | 'complex' | 'enterprise';
  
  // Extracted parameters
  parameters: {
    description: string;
    target?: string; // For modify operations
    context?: string;
    requirements?: string[];
  };
}

export interface WorkItem {
  id: string;
  threadId?: string; // Discord thread ID
  title: string;
  description: string;
  status: 'analyzing' | 'planning' | 'building' | 'deploying' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  
  // Agent assignment
  assignedAgents: string[];
  primaryAgent: string;
  
  // Progress tracking
  progress: number;
  startTime: Date;
  estimatedCompletion?: Date;
  actualCompletion?: Date;
  
  // Context
  originalRequest: string;
  clarifiedRequirements: string[];
  userPreferences: Record<string, any>;
  
  // Results
  outputs?: {
    files?: { path: string; content: string }[];
    deploymentUrl?: string;
    prUrl?: string;
    previewUrl?: string;
  };
  
  // Error handling
  errors?: string[];
  retryCount: number;
  userErrorPreference?: 'ask' | 'auto-retry' | 'suggest-fix';
}

export interface AgentMessage {
  from: string;
  to: string | 'all';
  type: 'task' | 'status' | 'completion' | 'error' | 'coordination';
  workItemId?: string;
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface DiscordEmbed {
  title: string;
  description?: string;
  color: number; // 0x00ff00 for green, etc.
  fields: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  thumbnail?: {
    url: string;
  };
  footer?: {
    text: string;
  };
  timestamp?: string;
}

export interface CommanderConfig {
  discordToken: string;
  userChannelId: string;
  agentChannelId: string;
  claudeApiKey: string;
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
  netlifyTokens?: string;
}

export interface RequirementGatheringResult {
  shouldProceed: boolean;
  nextQuestion?: string;
  gatheringComplete: boolean;
  clarifiedRequest: string;
  extractedRequirements: string[];
}

export interface AgentCapability {
  name: string;
  description: string;
  categories: string[];
  complexity: string[];
  estimatedTime: (request: string) => number; // minutes
  isAvailable: () => boolean;
}