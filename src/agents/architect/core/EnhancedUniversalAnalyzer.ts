// src/agents/architect/core/EnhancedUniversalAnalyzer.ts
import { ArchitecturalRequest, IntelligenceLevel, LearningMode } from '../types/index.js';
import { CodeIntelligence } from '../intelligence/CodeIntelligence.js';
import { FileMapper } from '../intelligence/FileMapper.js';
import Anthropic from '@anthropic-ai/sdk';
import { promises as fs } from 'fs';

interface RequestAnalysis {
  confidence: number;
  reasoning: string[];
  alternatives: string[];
  intelligence: {
    complexity: IntelligenceLevel;
    learningRequired: boolean;
    adaptiveResponse: boolean;
    selfModificationNeeded: boolean;
  };
  context: {
    userIntent: string;
    technicalRequirements: string[];
    constraints: string[];
    dependencies: string[];
  };
}

export class EnhancedUniversalAnalyzer {
  private claude: Anthropic;
  private codeIntelligence: CodeIntelligence;
  private requestHistory: any[] = [];
  private learningMode: LearningMode = 'active';
  private patterns: Map<string, any> = new Map();

  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
    this.codeIntelligence = new CodeIntelligence(claudeApiKey);
    this.initializeIntelligence();
  }

  async analyzeArchitecturalRequest(
    input: string,
    userId: string,
    context?: any
  ): Promise<ArchitecturalRequest> {
    console.log(`[EnhancedUniversalAnalyzer] 🧠 Analyzing: "${input}"`);
    
    // Record request for learning
    await this.recordRequest(input, userId, context);
    
    // Multi-layer intelligent analysis
    const analysis = await this.performIntelligentAnalysis(input, userId, context);
    
    // Create architectural request with intelligence
    const request = await this.constructIntelligentRequest(input, analysis);
    
    // Learn from this analysis
    await this.updateLearningPatterns(input, request, analysis);
    
    return request;
  }

  private async performIntelligentAnalysis(
    input: string,
    userId: string,
    context?: any
  ): Promise<RequestAnalysis> {
    
    // Layer 1: Pattern Recognition (Fast)
    const patternAnalysis = await this.analyzePatterns(input);
    
    // Layer 2: Context Understanding (Medium)
    const contextAnalysis = await this.analyzeContext(input, context);
    
    // Layer 3: Intent Analysis (Deep)
    const intentAnalysis = await this.analyzeIntent(input, userId);
    
    // Layer 4: Codebase Integration (Comprehensive)
    const codebaseAnalysis = await this.analyzeCodebaseImpact(input);
    
    // Synthesize all layers
    return await this.synthesizeAnalysis([
      patternAnalysis,
      contextAnalysis, 
      intentAnalysis,
      codebaseAnalysis
    ]);
  }

  private async analyzePatterns(input: string): Promise<any> {
    const lowerInput = input.toLowerCase();
    
    // Intelligent pattern matching with learning
    const patterns = {
      agentCreation: this.matchAgentCreationPatterns(lowerInput),
      systemModification: this.matchModificationPatterns(lowerInput),
      behaviorRefinement: this.matchRefinementPatterns(lowerInput),
      selfImprovement: this.matchSelfImprovementPatterns(lowerInput),
      codebaseAnalysis: this.matchAnalysisPatterns(lowerInput),
      performance: this.matchPerformancePatterns(lowerInput)
    };
    
    // Find strongest pattern match
    const strongestPattern = Object.entries(patterns)
      .reduce((max, [key, value]) => value.confidence > max.confidence ? {type: key, ...value} : max, 
              {type: 'unknown', confidence: 0, indicators: []});
    
    return {
      primaryPattern: strongestPattern,
      allPatterns: patterns,
      confidence: strongestPattern.confidence
    };
  }

  private matchAgentCreationPatterns(input: string): any {
    const indicators = [
      'build', 'create', 'make', 'new agent', 'agent for', 'bot for',
      'need a', 'want a', 'develop', 'generate', 'agent named'
    ];
    
    const matches = indicators.filter(indicator => input.includes(indicator));
    const confidence = Math.min(matches.length * 0.3, 1.0);
    
    // Advanced analysis for agent type
    const agentTypes = this.detectAgentType(input);
    const complexity = this.assessComplexity(input);
    
    return {
      confidence,
      indicators: matches,
      agentTypes,
      complexity,
      requiresWatcher: this.shouldCreateWatcher(input),
      specialFeatures: this.detectSpecialFeatures(input)
    };
  }

  private matchModificationPatterns(input: string): any {
    const indicators = [
      'change', 'modify', 'update', 'fix', 'improve', 'enhance',
      'adjust', 'tweak', 'tune', 'optimize', 'refactor'
    ];
    
    const strengthIndicators = [
      'make it', 'set to', 'increase', 'decrease', 'remove', 'add'
    ];
    
    const matches = indicators.filter(indicator => input.includes(indicator));
    const strongMatches = strengthIndicators.filter(indicator => input.includes(indicator));
    
    const confidence = Math.min((matches.length * 0.2) + (strongMatches.length * 0.4), 1.0);
    
    return {
      confidence,
      indicators: matches.concat(strongMatches),
      targetComponent: this.identifyTargetComponent(input),
      modificationType: this.classifyModificationType(input),
      riskLevel: this.assessModificationRisk(input)
    };
  }

  private matchRefinementPatterns(input: string): any {
    const indicators = [
      'tone down', 'make more', 'make less', 'funnier', 'serious',
      'personality', 'behavior', 'response style', 'voice', 'humor'
    ];
    
    const percentagePattern = /(\d+)%/.test(input);
    const intensityWords = ['more', 'less', 'much', 'slightly', 'very'];
    
    const matches = indicators.filter(indicator => input.includes(indicator));
    const hasIntensity = intensityWords.some(word => input.includes(word));
    
    const confidence = Math.min(
      (matches.length * 0.4) + 
      (percentagePattern ? 0.3 : 0) + 
      (hasIntensity ? 0.2 : 0), 
      1.0
    );
    
    return {
      confidence,
      indicators: matches,
      hasPercentage: percentagePattern,
      intensityLevel: this.extractIntensityLevel(input),
      targetBehavior: this.identifyTargetBehavior(input)
    };
  }

  private matchSelfImprovementPatterns(input: string): any {
    const indicators = [
      'improve yourself', 'self improve', 'get better', 'optimize yourself',
      'analyze your', 'your performance', 'how are you doing', 'self assessment'
    ];
    
    const matches = indicators.filter(indicator => input.includes(indicator));
    const confidence = Math.min(matches.length * 0.5, 1.0);
    
    return {
      confidence,
      indicators: matches,
      improvementType: this.classifyImprovementType(input),
      scope: this.determineSelfImprovementScope(input)
    };
  }

  private matchAnalysisPatterns(input: string): any {
    const indicators = [
      'analyze', 'show me', 'how does', 'what is', 'explain',
      'status', 'health', 'performance', 'metrics'
    ];
    
    const matches = indicators.filter(indicator => input.includes(indicator));
    const confidence = Math.min(matches.length * 0.3, 1.0);
    
    return {
      confidence,
      indicators: matches,
      analysisType: this.classifyAnalysisType(input),
      depth: this.determineAnalysisDepth(input)
    };
  }

  private matchPerformancePatterns(input: string): any {
    const indicators = [
      'slow', 'fast', 'performance', 'optimize', 'speed up',
      'lag', 'delay', 'timeout', 'efficiency'
    ];
    
    const matches = indicators.filter(indicator => input.includes(indicator));
    const confidence = Math.min(matches.length * 0.4, 1.0);
    
    return {
      confidence,
      indicators: matches,
      performanceAspect: this.identifyPerformanceAspect(input),
      urgency: this.assessPerformanceUrgency(input)
    };
  }

  private async analyzeContext(input: string, context?: any): Promise<any> {
    // Analyze conversation context, user history, system state
    const contextFactors = {
      conversationHistory: context?.history || [],
      userExperience: await this.assessUserExperience(context?.userId),
      systemState: await this.getCurrentSystemState(),
      recentChanges: await this.getRecentChanges(),
      activeProjects: await this.getActiveProjects()
    };
    
    return {
      ...contextFactors,
      contextualRelevance: this.calculateContextualRelevance(input, contextFactors)
    };
  }

  private async analyzeIntent(input: string, userId: string): Promise<any> {
    // Deep intent analysis using Claude
    const response = await this.claude.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 1000,
      system: `You are an expert at understanding user intent for software development tasks. 

Analyze the user's request and determine:
1. Primary intent (what they actually want)
2. Secondary intents (related goals)
3. Technical complexity required
4. Learning/adaptation needs
5. Potential risks or concerns
6. Success criteria

Consider the user's technical level and communication style.`,
      messages: [{
        role: 'user',
        content: `Analyze this request for intent:

"${input}"

Return detailed JSON analysis of user intent, complexity, and requirements.`
      }]
    });

    const content = response.content[0];
    if (content.type === 'text') {
      try {
        return JSON.parse(content.text);
      } catch {
        return this.fallbackIntentAnalysis(input);
      }
    }
    
    return this.fallbackIntentAnalysis(input);
  }

  private async analyzeCodebaseImpact(input: string): Promise<any> {
    // Analyze how this request would impact the codebase
    const relevantFiles = FileMapper.discoverFiles(input);
    const existingCapabilities = await this.catalogExistingCapabilities();
    const architecturalImpact = await this.assessArchitecturalImpact(input);
    
    return {
      relevantFiles,
      existingCapabilities,
      architecturalImpact,
      conflictPotential: this.assessConflictPotential(input, existingCapabilities),
      enhancementOpportunity: this.identifyEnhancementOpportunities(input)
    };
  }

  private async synthesizeAnalysis(analyses: any[]): Promise<RequestAnalysis> {
    // Intelligent synthesis of all analysis layers
    const [patternAnalysis, contextAnalysis, intentAnalysis, codebaseAnalysis] = analyses;
    
    // Calculate overall confidence
    const confidence = this.calculateOverallConfidence(analyses);
    
    // Determine intelligence requirements
    const intelligence = {
      complexity: this.determineComplexity(analyses) as IntelligenceLevel,
      learningRequired: this.determineIfLearningRequired(analyses),
      adaptiveResponse: this.determineIfAdaptiveResponseNeeded(analyses),
      selfModificationNeeded: this.determineIfSelfModificationNeeded(analyses)
    };
    
    // Extract reasoning
    const reasoning = this.extractReasoning(analyses);
    const alternatives = this.generateAlternatives(analyses);
    
    // Build context
    const context = {
      userIntent: intentAnalysis.primaryIntent || 'Unknown intent',
      technicalRequirements: this.extractTechnicalRequirements(analyses),
      constraints: this.identifyConstraints(analyses),
      dependencies: this.identifyDependencies(analyses)
    };
    
    return {
      confidence,
      reasoning,
      alternatives,
      intelligence,
      context
    };
  }

  private async constructIntelligentRequest(
    input: string,
    analysis: RequestAnalysis
  ): Promise<ArchitecturalRequest> {
    
    // Determine request type based on analysis
    const type = this.determineRequestType(analysis);
    
    // Extract target from input and analysis
    const target = this.extractTarget(input, analysis);
    
    // Determine priority and risk
    const priority = this.determinePriority(analysis);
    const riskLevel = this.determineRiskLevel(analysis);
    
    return {
      type,
      description: input,
      target,
      priority,
      riskLevel,
      intelligence: {
        requiresLearning: analysis.intelligence.learningRequired,
        adaptiveResponse: analysis.intelligence.adaptiveResponse,
        selfModification: analysis.intelligence.selfModificationNeeded
      }
    };
  }

  private determineRequestType(analysis: RequestAnalysis): ArchitecturalRequest['type'] {
    // Intelligent type determination based on analysis
    const patternConfidences = analysis.context.technicalRequirements;
    
    if (patternConfidences.includes('agent-creation')) return 'agent-creation';
    if (patternConfidences.includes('self-improvement')) return 'self-improvement';
    if (patternConfidences.includes('behavior-refinement')) return 'behavior-refinement';
    if (patternConfidences.includes('system-modification')) return 'system-modification';
    if (patternConfidences.includes('codebase-analysis')) return 'codebase-analysis';
    if (patternConfidences.includes('performance-optimization')) return 'performance-optimization';
    
    // Default fallback
    return 'system-modification';
  }

  // Helper methods for pattern matching and analysis
  private detectAgentType(input: string): string[] {
    const types = [];
    if (input.includes('monitor')) types.push('monitor');
    if (input.includes('deploy')) types.push('deployer');
    if (input.includes('test')) types.push('tester');
    if (input.includes('ping')) types.push('ping-bot');
    if (input.includes('chat')) types.push('chat-bot');
    if (input.includes('analyze')) types.push('analyzer');
    return types;
  }

  private assessComplexity(input: string): IntelligenceLevel {
    if (input.includes('simple') || input.includes('basic')) return 'basic';
    if (input.includes('advanced') || input.includes('complex')) return 'advanced';
    if (input.includes('expert') || input.includes('sophisticated')) return 'expert';
    return 'intermediate';
  }

  private shouldCreateWatcher(input: string): boolean {
    return !input.includes('no watcher') && !input.includes('simple');
  }

  private detectSpecialFeatures(input: string): string[] {
    const features = [];
    if (input.includes('learning')) features.push('learning');
    if (input.includes('feedback')) features.push('feedback');
    if (input.includes('adaptive')) features.push('adaptive');
    if (input.includes('self-improve')) features.push('self-improvement');
    return features;
  }

  // Additional helper methods would be implemented here...
  private identifyTargetComponent(input: string): string { return 'unknown'; }
  private classifyModificationType(input: string): string { return 'general'; }
  private assessModificationRisk(input: string): 'low' | 'medium' | 'high' { return 'medium'; }
  private extractIntensityLevel(input: string): number { return 5; }
  private identifyTargetBehavior(input: string): string { return 'general'; }
  private classifyImprovementType(input: string): string { return 'general'; }
  private determineSelfImprovementScope(input: string): string { return 'all'; }
  private classifyAnalysisType(input: string): string { return 'general'; }
  private determineAnalysisDepth(input: string): string { return 'medium'; }
  private identifyPerformanceAspect(input: string): string { return 'general'; }
  private assessPerformanceUrgency(input: string): string { return 'medium'; }
  
  private async initializeIntelligence(): Promise<void> {
    // Load learning patterns and initialize intelligence
    try {
      const patterns = await fs.readFile('data/analyzer-patterns.json', 'utf8');
      this.patterns = new Map(JSON.parse(patterns));
    } catch {
      // Initialize with defaults
    }
  }

  private async recordRequest(input: string, userId: string, context?: any): Promise<void> {
    this.requestHistory.push({
      timestamp: new Date(),
      input,
      userId,
      context
    });
  }

  private async updateLearningPatterns(input: string, request: ArchitecturalRequest, analysis: RequestAnalysis): Promise<void> {
    // Update learning patterns based on analysis
    const patternKey = `${request.type}_${analysis.intelligence.complexity}`;
    const existing = this.patterns.get(patternKey) || { count: 0, examples: [] };
    
    existing.count++;
    existing.examples.push({
      input,
      confidence: analysis.confidence,
      reasoning: analysis.reasoning
    });
    
    this.patterns.set(patternKey, existing);
    
    // Save patterns
    try {
      await fs.mkdir('data', { recursive: true });
      await fs.writeFile('data/analyzer-patterns.json', 
        JSON.stringify(Array.from(this.patterns.entries())));
    } catch (error) {
      console.error('[EnhancedUniversalAnalyzer] Failed to save patterns:', error);
    }
  }

  // Placeholder implementations for complex analysis methods
  private calculateContextualRelevance(input: string, factors: any): number { return 0.5; }
  private async assessUserExperience(userId?: string): Promise<string> { return 'intermediate'; }
  private async getCurrentSystemState(): Promise<any> { return {}; }
  private async getRecentChanges(): Promise<any[]> { return []; }
  private async getActiveProjects(): Promise<any[]> { return []; }
  private fallbackIntentAnalysis(input: string): any { return { primaryIntent: 'Unknown' }; }
  private async catalogExistingCapabilities(): Promise<string[]> { return []; }
  private async assessArchitecturalImpact(input: string): Promise<any> { return {}; }
  private assessConflictPotential(input: string, capabilities: string[]): string { return 'low'; }
  private identifyEnhancementOpportunities(input: string): string[] { return []; }
  private calculateOverallConfidence(analyses: any[]): number { return 0.8; }
  private determineComplexity(analyses: any[]): string { return 'intermediate'; }
  private determineIfLearningRequired(analyses: any[]): boolean { return true; }
  private determineIfAdaptiveResponseNeeded(analyses: any[]): boolean { return true; }
  private determineIfSelfModificationNeeded(analyses: any[]): boolean { return false; }
  private extractReasoning(analyses: any[]): string[] { return []; }
  private generateAlternatives(analyses: any[]): string[] { return []; }
  private extractTechnicalRequirements(analyses: any[]): string[] { return []; }
  private identifyConstraints(analyses: any[]): string[] { return []; }
  private identifyDependencies(analyses: any[]): string[] { return []; }
  private extractTarget(input: string, analysis: RequestAnalysis): string | undefined { return undefined; }
  private determinePriority(analysis: RequestAnalysis): 'low' | 'medium' | 'high' | 'critical' { return 'medium'; }
  private determineRiskLevel(analysis: RequestAnalysis): 'low' | 'medium' | 'high' { return 'medium'; }
}
