import * as fs from 'fs/promises';
import { 
  DashboardInteractionLog, 
  DashboardPattern, 
  UserPreference, 
  DashboardInsight,
  OptimizationEffectiveness 
} from './types/index.js';
import { DashWatchIntelligence } from './intelligence/DashWatchIntelligence.js';

export class DashWatch {
  private interactions: DashboardInteractionLog[] = [];
  private patterns: DashboardPattern[] = [];
  private userPreferences: Map<string, UserPreference> = new Map();
  private optimizationTracking: Map<string, OptimizationEffectiveness> = new Map();
  private intelligence: DashWatchIntelligence;
  private dataFile = 'data/dashboard-interactions.json';
  private patternsFile = 'data/dashboard-patterns.json';
  private preferencesFile = 'data/user-preferences.json';

  constructor(claudeApiKey: string) {
    this.intelligence = new DashWatchIntelligence(claudeApiKey);
    this.loadData();
    console.log('[DashWatch] Dashboard learning watcher initialized');
  }

  async logDashboardInteraction(
    queryType: DashboardInteractionLog['queryType'],
    userQuery: string,
    responseType: string,
    userId: string,
    responseTime: number,
    contextMetrics: DashboardInteractionLog['contextMetrics'],
    actionTaken: DashboardInteractionLog['actionTaken'] = 'none'
  ): Promise<void> {
    const interaction: DashboardInteractionLog = {
      id: `dash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      queryType,
      userQuery: userQuery.slice(0, 200), // Truncate for storage
      responseType,
      userSatisfaction: 'unknown', // Will be updated if feedback is provided
      actionTaken,
      responseTime,
      contextMetrics
    };

    this.interactions.push(interaction);
    
    // Maintain reasonable history size
    if (this.interactions.length > 1000) {
      this.interactions = this.interactions.slice(-1000);
    }

    // Update user preferences
    await this.updateUserPreferences(userId, interaction);

    // Analyze patterns periodically
    if (this.interactions.length % 10 === 0) {
      await this.analyzePatterns();
    }

    await this.saveData();
    
    console.log(`[DashWatch] Logged ${queryType} interaction: ${responseTime}ms, action: ${actionTaken}`);
  }

  async updateUserSatisfaction(
    interactionId: string,
    satisfaction: DashboardInteractionLog['userSatisfaction']
  ): Promise<void> {
    const interaction = this.interactions.find(i => i.id === interactionId);
    if (interaction) {
      interaction.userSatisfaction = satisfaction;
      await this.saveData();
      console.log(`[DashWatch] Updated satisfaction for ${interactionId}: ${satisfaction}`);
    }
  }

  async trackOptimizationResult(
    requestId: string,
    targetAgent: string,
    issue: string,
    implementation: OptimizationEffectiveness['implementation'],
    actualImprovement?: OptimizationEffectiveness['actualImprovement'],
    userFeedback?: string
  ): Promise<void> {
    const effectiveness: OptimizationEffectiveness = {
      requestId,
      targetAgent,
      issue,
      implementation,
      actualImprovement,
      timeToImplementation: Date.now(), // Would calculate actual time in real implementation
      userFeedback
    };

    this.optimizationTracking.set(requestId, effectiveness);
    
    // Update related interactions
    const relatedInteractions = this.interactions.filter(i => 
      i.actionTaken === 'architect_handoff' || i.actionTaken === 'commander_sync'
    );

    // Find the most recent optimization request (simplified)
    if (relatedInteractions.length > 0) {
      const latest = relatedInteractions[relatedInteractions.length - 1];
      latest.optimizationResult = implementation === 'success' ? 'implemented' : 
                                  implementation === 'failed' ? 'declined' : 'pending';
    }

    await this.saveData();
    console.log(`[DashWatch] Tracked optimization result: ${requestId} -> ${implementation}`);
  }

  async getDashboardInsights(): Promise<DashboardInsight[]> {
    const insights: DashboardInsight[] = [];
    
    if (this.interactions.length < 5) {
      return [{
        type: 'effectiveness',
        message: 'Building interaction history - need more data for meaningful insights',
        confidence: 0.9,
        supportingData: [`${this.interactions.length} interactions logged`],
        actionable: false
      }];
    }

    // Get pattern-based insights
    const recentInteractions = this.interactions.slice(-50);
    const patterns = await this.intelligence.analyzeInteractionPatterns(recentInteractions);
    
    // Convert patterns to insights
    patterns.forEach(pattern => {
      if (pattern.confidence > 0.6) {
        insights.push({
          type: 'pattern',
          message: `Pattern detected: ${pattern.pattern}`,
          confidence: pattern.confidence,
          supportingData: [`Frequency: ${pattern.frequency}`, `Effectiveness: ${(pattern.effectiveness * 100).toFixed(0)}%`],
          actionable: pattern.recommendations.length > 0,
          recommendation: pattern.recommendations[0]
        });
      }
    });

    // Optimization effectiveness insights
    const optimizationResults = Array.from(this.optimizationTracking.values());
    if (optimizationResults.length >= 3) {
      const successRate = optimizationResults.filter(r => r.implementation === 'success').length / optimizationResults.length;
      
      insights.push({
        type: 'optimization',
        message: `Optimization success rate: ${(successRate * 100).toFixed(0)}%`,
        confidence: 0.8,
        supportingData: [`${optimizationResults.length} optimization requests tracked`],
        actionable: successRate < 0.5,
        recommendation: successRate < 0.5 ? 'Improve optimization request quality and justification' : undefined
      });
    }

    // User engagement insights
    const positiveInteractions = this.interactions.filter(i => i.userSatisfaction === 'positive').length;
    const totalRatedInteractions = this.interactions.filter(i => i.userSatisfaction !== 'unknown').length;
    
    if (totalRatedInteractions >= 5) {
      const satisfactionRate = positiveInteractions / totalRatedInteractions;
      insights.push({
        type: 'user_behavior',
        message: `User satisfaction rate: ${(satisfactionRate * 100).toFixed(0)}%`,
        confidence: 0.7,
        supportingData: [`${totalRatedInteractions} rated interactions`],
        actionable: satisfactionRate < 0.7,
        recommendation: satisfactionRate < 0.7 ? 'Focus on improving response quality and relevance' : undefined
      });
    }

    return insights.sort((a, b) => b.confidence - a.confidence);
  }

  async getOptimizationPrediction(
    targetAgent: string,
    optimizationType: string
  ): Promise<{
    successProbability: number;
    reasoning: string;
    recommendedApproach: string;
  }> {
    return await this.intelligence.predictOptimizationSuccess(
      targetAgent,
      optimizationType,
      this.interactions
    );
  }

  async getOptimalQueryTiming(): Promise<{
    optimalTimes: string[];
    reasoning: string;
    confidence: number;
  }> {
    return await this.intelligence.identifyOptimalQueryTiming(this.interactions);
  }

  async getUserPreferences(userId: string): Promise<UserPreference | null> {
    return this.userPreferences.get(userId) || null;
  }

  async getPatternSummary(): Promise<{
    totalInteractions: number;
    mostCommonQueryType: string;
    averageResponseTime: number;
    optimizationApprovalRate: number;
    topPatterns: DashboardPattern[];
  }> {
    if (this.interactions.length === 0) {
      return {
        totalInteractions: 0,
        mostCommonQueryType: 'none',
        averageResponseTime: 0,
        optimizationApprovalRate: 0,
        topPatterns: []
      };
    }

    // Most common query type
    const queryTypeCounts = this.interactions.reduce((acc, interaction) => {
      acc[interaction.queryType] = (acc[interaction.queryType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostCommonQueryType = Object.entries(queryTypeCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none';

    // Average response time
    const averageResponseTime = this.interactions.reduce((sum, i) => sum + i.responseTime, 0) / this.interactions.length;

    // Optimization approval rate
    const optimizationInteractions = this.interactions.filter(i => 
      i.actionTaken === 'architect_handoff' || i.actionTaken === 'commander_sync'
    );
    const approvedOptimizations = optimizationInteractions.filter(i => 
      i.optimizationResult === 'implemented'
    );
    const optimizationApprovalRate = optimizationInteractions.length > 0 ? 
      approvedOptimizations.length / optimizationInteractions.length : 0;

    return {
      totalInteractions: this.interactions.length,
      mostCommonQueryType,
      averageResponseTime,
      optimizationApprovalRate,
      topPatterns: this.patterns.slice(0, 5)
    };
  }

  private async updateUserPreferences(userId: string, interaction: DashboardInteractionLog): Promise<void> {
    let preferences = this.userPreferences.get(userId);
    
    if (!preferences) {
      preferences = {
        userId,
        preferredDetailLevel: 'detailed',
        preferredResponseFormat: 'embedded',
        optimizationApprovalRate: 0,
        mostValuedInsights: [],
        commonQueryTypes: [],
        timePreference: 'realtime'
      };
      this.userPreferences.set(userId, preferences);
    }

    // Update common query types
    if (!preferences.commonQueryTypes.includes(interaction.queryType)) {
      preferences.commonQueryTypes.push(interaction.queryType);
      
      // Keep only top 5
      if (preferences.commonQueryTypes.length > 5) {
        preferences.commonQueryTypes = preferences.commonQueryTypes.slice(-5);
      }
    }

    // Update optimization approval rate if applicable
    if (interaction.actionTaken !== 'none' && interaction.optimizationResult) {
      const userOptimizations = this.interactions.filter(i => 
        i.actionTaken !== 'none' && i.optimizationResult
      );
      const approvedOptimizations = userOptimizations.filter(i => 
        i.optimizationResult === 'implemented'
      );
      
      preferences.optimizationApprovalRate = userOptimizations.length > 0 ? 
        approvedOptimizations.length / userOptimizations.length : 0;
    }
  }

  private async analyzePatterns(): Promise<void> {
    try {
      const recentInteractions = this.interactions.slice(-100); // Analyze last 100 interactions
      this.patterns = await this.intelligence.analyzeInteractionPatterns(recentInteractions);
      
      console.log(`[DashWatch] Analyzed patterns: ${this.patterns.length} patterns identified`);
    } catch (error) {
      console.error('[DashWatch] Pattern analysis failed:', error);
    }
  }

  private async loadData(): Promise<void> {
    try {
      // Load interactions
      try {
        const interactionsData = await fs.readFile(this.dataFile, 'utf8');
        this.interactions = JSON.parse(interactionsData);
      } catch {
        this.interactions = [];
      }

      // Load patterns
      try {
        const patternsData = await fs.readFile(this.patternsFile, 'utf8');
        this.patterns = JSON.parse(patternsData);
      } catch {
        this.patterns = [];
      }

      // Load user preferences
      try {
        const preferencesData = await fs.readFile(this.preferencesFile, 'utf8');
        const preferencesArray = JSON.parse(preferencesData);
        this.userPreferences = new Map(preferencesArray.map((p: UserPreference) => [p.userId, p]));
      } catch {
        this.userPreferences = new Map();
      }

      console.log(`[DashWatch] Loaded ${this.interactions.length} interactions, ${this.patterns.length} patterns, ${this.userPreferences.size} user preferences`);
    } catch (error) {
      console.error('[DashWatch] Failed to load data:', error);
    }
  }

  private async saveData(): Promise<void> {
    try {
      await fs.mkdir('data', { recursive: true });
      
      // Save interactions
      await fs.writeFile(this.dataFile, JSON.stringify(this.interactions, null, 2));
      
      // Save patterns
      await fs.writeFile(this.patternsFile, JSON.stringify(this.patterns, null, 2));
      
      // Save user preferences
      const preferencesArray = Array.from(this.userPreferences.values());
      await fs.writeFile(this.preferencesFile, JSON.stringify(preferencesArray, null, 2));
      
    } catch (error) {
      console.error('[DashWatch] Failed to save data:', error);
    }
  }
}