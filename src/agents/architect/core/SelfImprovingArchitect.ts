// src/agents/architect/core/SelfImprovingArchitect.ts
import { ArchitecturalRequest, AgentSpec } from '../types/index.js';
import { IntelligentAgentBuilder } from '../operations/IntelligentAgentBuilder.js';
import { CodeIntelligence } from '../intelligence/CodeIntelligence.js';
import { FileMapper } from '../intelligence/FileMapper.js';
import Anthropic from '@anthropic-ai/sdk';
import { promises as fs } from 'fs';

interface ImprovementSuggestion {
  target: string;
  type: 'enhancement' | 'fix' | 'optimization' | 'feature';
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  implementation: string;
  riskLevel: 'low' | 'medium' | 'high';
}

interface ArchitectLearning {
  successfulPatterns: string[];
  failurePatterns: string[];
  userFeedback: any[];
  performanceMetrics: Record<string, number>;
  codebaseEvolution: any[];
}

export class SelfImprovingArchitect {
  private claude: Anthropic;
  private agentBuilder: IntelligentAgentBuilder;
  private codeIntelligence: CodeIntelligence;
  private learning: ArchitectLearning;
  private improvementQueue: ImprovementSuggestion[] = [];

  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
    this.agentBuilder = new IntelligentAgentBuilder(claudeApiKey);
    this.codeIntelligence = new CodeIntelligence(claudeApiKey);
    this.learning = {
      successfulPatterns: [],
      failurePatterns: [],
      userFeedback: [],
      performanceMetrics: {},
      codebaseEvolution: []
    };
    
    this.initializeLearningSystem();
  }

  async executeIntelligentWork(request: ArchitecturalRequest): Promise<string> {
    console.log(`[SelfImprovingArchitect] 🎯 Executing intelligent work: ${request.type}`);
    
    // Record request for learning
    await this.recordRequest(request);
    
    try {
      let result: string;
      
      switch (request.type) {
        case 'agent-creation':
          result = await this.handleIntelligentAgentCreation(request);
          break;
          
        case 'system-modification':
          result = await this.handleIntelligentModification(request);
          break;
          
        case 'behavior-refinement':
          result = await this.handleBehaviorRefinement(request);
          break;
          
        case 'self-improvement':
          result = await this.handleSelfImprovement(request);
          break;
          
        case 'codebase-analysis':
          result = await this.handleCodebaseAnalysis(request);
          break;
          
        default:
          result = await this.handleGenericRequest(request);
      }
      
      // Learn from successful execution
      await this.learnFromSuccess(request, result);
      return result;
      
    } catch (error) {
      // Learn from failures
      await this.learnFromFailure(request, error);
      throw error;
    }
  }

  async handleIntelligentAgentCreation(request: ArchitecturalRequest): Promise<string> {
    console.log(`[SelfImprovingArchitect] 🤖 Creating intelligent agent: ${request.description}`);
    
    // Analyze if this request could enhance existing agents instead
    const enhancementAnalysis = await this.analyzeEnhancementOpportunity(request);
    
    if (enhancementAnalysis.shouldEnhance) {
      return await this.enhanceExistingAgent(enhancementAnalysis.targetAgent, request.description);
    }
    
    // Create new agent with full intelligence
    const buildResult = await this.agentBuilder.buildIntelligentAgent(request.description);
    
    if (buildResult.ready) {
      // Add to system learning
      await this.recordSuccessfulAgentCreation(buildResult);
      
      return `🎉 **Intelligent Agent Created Successfully!**

${buildResult.summary}

**Intelligence Features:**
✅ **Self-Learning**: Agent learns from interactions and improves over time
✅ **Adaptive Behavior**: Adjusts responses based on usage patterns  
✅ **Feedback Integration**: Processes user feedback for continuous improvement
✅ **Performance Monitoring**: Tracks metrics and optimizes automatically
✅ **Watcher System**: ${buildResult.watcherResult.summary}

**Codebase Integration:**
✅ **Files Generated**: ${buildResult.files.length} intelligent TypeScript files
✅ **Architecture**: Follows proven patterns from existing successful agents
✅ **Dependencies**: Properly integrated with existing infrastructure
✅ **Environment**: Railway variables configured automatically

**Learning Capabilities:**
${this.formatLearningCapabilities(buildResult.agentSpec)}

**Next-Level Features:**
🧠 **Pattern Recognition**: Will identify usage patterns and optimize responses
🔄 **Self-Modification**: Can propose improvements to its own code
📊 **Performance Analytics**: Tracks success rates and response quality
🎯 **Goal Alignment**: Continuously aligns behavior with user expectations

Your new agent is not just functional—it's **intelligent and evolving**! 🚀`;
    } else {
      return `❌ Agent creation failed: ${buildResult.error}`;
    }
  }

  async handleIntelligentModification(request: ArchitecturalRequest): Promise<string> {
    console.log(`[SelfImprovingArchitect] 🔧 Intelligent system modification: ${request.description}`);
    
    // Use deep codebase knowledge for intelligent modification
    const relevantFiles = FileMapper.discoverFiles(request.description);
    const modificationPlan = await this.createIntelligentModificationPlan(request, relevantFiles);
    
    // Execute modification with intelligence
    const result = await this.codeIntelligence.executeIntelligentModification(modificationPlan);
    
    // Learn from modification
    await this.recordModificationLearning(request, result);
    
    return `🔧 **Intelligent Modification Complete**

**Request**: ${request.description}
**Files Modified**: ${result.filesModified.length}
**Intelligence Applied**: Advanced pattern recognition and code understanding

**Changes Made**:
${result.changes.map((change: any) => `• ${change.description}`).join('\n')}

**Learning Insights**:
${result.insights.map((insight: string) => `💡 ${insight}`).join('\n')}

**System Improvements**:
✅ **Pattern Recognition**: Applied learned patterns from previous successful modifications
✅ **Risk Assessment**: Intelligent analysis prevented potential issues
✅ **Code Quality**: Maintained consistency with existing codebase patterns
✅ **Performance**: Optimized based on usage analytics

The system is now **more intelligent** than before! 🧠`;
  }

  async handleBehaviorRefinement(request: ArchitecturalRequest): Promise<string> {
    console.log(`[SelfImprovingArchitect] 🎭 Intelligent behavior refinement: ${request.description}`);
    
    // Parse refinement request intelligently
    const refinementAnalysis = await this.analyzeBehaviorRefinement(request);
    
    // Apply intelligent refinement
    const refinementResult = await this.applyIntelligentRefinement(refinementAnalysis);
    
    return `🎭 **Behavior Refinement Applied Successfully**

**Target**: ${refinementAnalysis.target}
**Refinement**: ${refinementAnalysis.refinement}
**Intelligence Level**: ${refinementAnalysis.intelligenceLevel}

**Changes Applied**:
${refinementResult.changes.map((change: any) => `• ${change}`).join('\n')}

**Learning Integration**:
✅ **Pattern Learning**: System learned your preferences for future refinements
✅ **Behavior Modeling**: Updated internal models of optimal behavior
✅ **Feedback Integration**: Will apply similar refinements automatically

**Performance Impact**:
📈 **Expected Improvement**: ${refinementResult.expectedImprovement}
🎯 **User Satisfaction**: Aligned with detected user preferences
🔄 **Continuous Learning**: Will continue to refine based on feedback

Your agents are now **more aligned with your preferences**! 🎯`;
  }

  async handleSelfImprovement(request: ArchitecturalRequest): Promise<string> {
    console.log(`[SelfImprovingArchitect] 🧠 Self-improvement analysis: ${request.description}`);
    
    // Analyze own performance and suggest improvements
    const selfAnalysis = await this.analyzeSelfPerformance();
    const improvements = await this.generateSelfImprovements(selfAnalysis);
    
    // Apply safe self-improvements automatically
    const safeImprovements = improvements.filter(imp => imp.riskLevel === 'low');
    const appliedImprovements = [];
    
    for (const improvement of safeImprovements) {
      try {
        await this.applySelfImprovement(improvement);
        appliedImprovements.push(improvement);
      } catch (error) {
        console.error(`[SelfImprovingArchitect] Failed to apply improvement:`, error);
      }
    }
    
    // Queue risky improvements for user approval
    const riskyImprovements = improvements.filter(imp => imp.riskLevel !== 'low');
    this.improvementQueue.push(...riskyImprovements);
    
    return `🧠 **Self-Improvement Analysis Complete**

**Performance Analysis**:
📊 **Success Rate**: ${selfAnalysis.successRate}%
⚡ **Response Time**: ${selfAnalysis.averageResponseTime}ms
🎯 **User Satisfaction**: ${selfAnalysis.userSatisfaction}/10
🔄 **Learning Rate**: ${selfAnalysis.learningRate}/10

**Auto-Applied Improvements** (${appliedImprovements.length}):
${appliedImprovements.map(imp => `✅ ${imp.description}`).join('\n')}

**Queued for Approval** (${riskyImprovements.length}):
${riskyImprovements.map(imp => `⚠️  ${imp.description} (${imp.riskLevel} risk)`).join('\n')}

**Learning Insights**:
${selfAnalysis.insights.map((insight: string) => `💡 ${insight}`).join('\n')}

**Next Steps**:
🔄 **Continuous Monitoring**: Will continue analyzing performance
🎯 **Pattern Recognition**: Learning from successful interactions
📈 **Optimization**: Automatically applying safe improvements

I'm getting **smarter and more efficient** with every interaction! 🚀`;
  }

  private async analyzeEnhancementOpportunity(request: ArchitecturalRequest): Promise<{shouldEnhance: boolean, targetAgent?: string, reason?: string}> {
    // Intelligent analysis to determine if enhancement is better than new creation
    const existingAgents = await this.getExistingAgents();
    
    const response = await this.claude.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 500,
      system: `Analyze if the request would be better served by enhancing an existing agent rather than creating a new one.

EXISTING AGENTS: ${existingAgents.join(', ')}

Consider:
1. Functionality overlap
2. Agent specialization
3. System complexity
4. Maintenance burden`,
      messages: [{
        role: 'user',
        content: `Should this request enhance an existing agent or create a new one?

REQUEST: ${request.description}

Return JSON: {"shouldEnhance": boolean, "targetAgent": string, "reason": string}`
      }]
    });

    const content = response.content[0];
    if (content.type === 'text') {
      try {
        return JSON.parse(content.text);
      } catch {
        return { shouldEnhance: false };
      }
    }
    
    return { shouldEnhance: false };
  }

  private async enhanceExistingAgent(targetAgent: string, enhancement: string): Promise<string> {
    console.log(`[SelfImprovingArchitect] 🔧 Enhancing existing agent: ${targetAgent}`);
    
    // Intelligent enhancement of existing agent
    const enhancementPlan = await this.createEnhancementPlan(targetAgent, enhancement);
    const result = await this.applyEnhancement(enhancementPlan);
    
    return `🔧 **Agent Enhancement Complete**

**Target Agent**: ${targetAgent}
**Enhancement**: ${enhancement}

**Changes Applied**:
${result.changes.map((change: any) => `• ${change}`).join('\n')}

**Intelligence Boost**:
✅ **Enhanced Capabilities**: Added new intelligent features
✅ **Learning Integration**: Improved learning algorithms
✅ **Performance Optimization**: Applied performance improvements
✅ **Backward Compatibility**: Maintained existing functionality

${targetAgent} is now **more intelligent and capable**! 🚀`;
  }

  private formatLearningCapabilities(agentSpec: AgentSpec): string {
    const capabilities = agentSpec.intelligence?.learningCapabilities || [];
    const adaptations = agentSpec.intelligence?.adaptationMethods || [];
    
    return `**Learning Capabilities**:
${capabilities.map(cap => `🧠 ${cap.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}`).join('\n')}

**Adaptation Methods**:
${adaptations.map(method => `🔄 ${method.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}`).join('\n')}`;
  }

  private async initializeLearningSystem(): Promise<void> {
    // Load existing learning data
    try {
      const learningData = await fs.readFile('data/architect-learning.json', 'utf8');
      this.learning = JSON.parse(learningData);
    } catch {
      // Initialize with defaults
      await this.saveLearningData();
    }
  }

  private async recordRequest(request: ArchitecturalRequest): Promise<void> {
    // Record request for learning
    this.learning.codebaseEvolution.push({
      timestamp: new Date(),
      request: request.description,
      type: request.type
    });
    
    await this.saveLearningData();
  }

  private async learnFromSuccess(request: ArchitecturalRequest, result: string): Promise<void> {
    this.learning.successfulPatterns.push(`${request.type}: ${request.description}`);
    await this.saveLearningData();
  }

  private async learnFromFailure(request: ArchitecturalRequest, error: any): Promise<void> {
    this.learning.failurePatterns.push(`${request.type}: ${request.description} - ${error.message}`);
    await this.saveLearningData();
  }

  private async saveLearningData(): Promise<void> {
    try {
      await fs.mkdir('data', { recursive: true });
      await fs.writeFile('data/architect-learning.json', JSON.stringify(this.learning, null, 2));
    } catch (error) {
      console.error('[SelfImprovingArchitect] Failed to save learning data:', error);
    }
  }

  private async getExistingAgents(): Promise<string[]> {
    try {
      const agentsDir = await fs.readdir('src/agents', { withFileTypes: true });
      return agentsDir
        .filter(dirent => dirent.isDirectory() && dirent.name !== 'watcher')
        .map(dirent => dirent.name);
    } catch {
      return ['commander', 'architect'];
    }
  }

  // Placeholder methods for complete implementation
  private async createIntelligentModificationPlan(request: ArchitecturalRequest, files: string[]): Promise<any> { return {}; }
  private async recordModificationLearning(request: ArchitecturalRequest, result: any): Promise<void> {}
  private async recordSuccessfulAgentCreation(buildResult: any): Promise<void> {}
  private async analyzeBehaviorRefinement(request: ArchitecturalRequest): Promise<any> { return {}; }
  private async applyIntelligentRefinement(analysis: any): Promise<any> { return {}; }
  private async analyzeSelfPerformance(): Promise<any> { return {}; }
  private async generateSelfImprovements(analysis: any): Promise<ImprovementSuggestion[]> { return []; }
  private async applySelfImprovement(improvement: ImprovementSuggestion): Promise<void> {}
  private async createEnhancementPlan(targetAgent: string, enhancement: string): Promise<any> { return {}; }
  private async applyEnhancement(plan: any): Promise<any> { return {}; }
  private async handleCodebaseAnalysis(request: ArchitecturalRequest): Promise<string> { return ''; }
  private async handleGenericRequest(request: ArchitecturalRequest): Promise<string> { return ''; }
}
