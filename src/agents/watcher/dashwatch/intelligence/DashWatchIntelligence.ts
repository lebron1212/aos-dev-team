import { Anthropic } from '@anthropic-ai/sdk';
import { 
  DashboardInteractionLog, 
  DashboardPattern, 
  UserPreference, 
  DashboardInsight 
} from '../types/index.js';

export class DashWatchIntelligence {
  private claude: Anthropic;
  
  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
    console.log('[DashWatchIntelligence] Pattern learning system initialized');
  }

  async analyzeInteractionPatterns(interactions: DashboardInteractionLog[]): Promise<DashboardPattern[]> {
    if (interactions.length < 5) {
      return []; // Need sufficient data for pattern analysis
    }

    const patterns: DashboardPattern[] = [];

    // Query pattern analysis
    const queryPatterns = this.analyzeQueryPatterns(interactions);
    patterns.push(...queryPatterns);

    // Optimization pattern analysis
    const optimizationPatterns = this.analyzeOptimizationPatterns(interactions);
    patterns.push(...optimizationPatterns);

    // Timing pattern analysis
    const timingPatterns = this.analyzeTimingPatterns(interactions);
    patterns.push(...timingPatterns);

    // User preference patterns
    const preferencePatterns = this.analyzePreferencePatterns(interactions);
    patterns.push(...preferencePatterns);

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  async generatePersonalizedInsights(
    userId: string,
    userPreferences: UserPreference,
    recentInteractions: DashboardInteractionLog[]
  ): Promise<DashboardInsight[]> {
    const insights: DashboardInsight[] = [];

    // Analyze user's optimization acceptance patterns
    const optimizationInsights = this.analyzeOptimizationBehavior(recentInteractions, userPreferences);
    insights.push(...optimizationInsights);

    // Analyze query effectiveness
    const queryInsights = this.analyzeQueryEffectiveness(recentInteractions);
    insights.push(...queryInsights);

    // Analyze timing preferences
    const timingInsights = this.analyzeTimingPreferences(recentInteractions);
    insights.push(...timingInsights);

    return insights.filter(insight => insight.confidence > 0.6);
  }

  async predictOptimizationSuccess(
    targetAgent: string,
    optimizationType: string,
    historicalData: DashboardInteractionLog[]
  ): Promise<{
    successProbability: number;
    reasoning: string;
    recommendedApproach: string;
    confidenceFactors: string[];
  }> {
    // Analyze historical optimization requests for this agent/type
    const relevantHistory = historicalData.filter(interaction => 
      interaction.actionTaken === 'architect_handoff' || 
      interaction.actionTaken === 'commander_sync'
    );

    if (relevantHistory.length < 3) {
      return {
        successProbability: 0.5,
        reasoning: 'Insufficient historical data for prediction',
        recommendedApproach: 'Standard optimization request with detailed metrics',
        confidenceFactors: ['Limited historical data']
      };
    }

    // Calculate success rate
    const successfulOptimizations = relevantHistory.filter(interaction => 
      interaction.optimizationResult === 'implemented'
    ).length;
    
    const baseSuccessRate = successfulOptimizations / relevantHistory.length;

    // Adjust based on agent-specific factors
    let adjustedProbability = baseSuccessRate;
    const confidenceFactors: string[] = [];

    if (targetAgent === 'Architect') {
      // Architect tends to implement technical optimizations more readily
      adjustedProbability *= 1.2;
      confidenceFactors.push('Architect has high technical optimization adoption rate');
    }

    if (optimizationType.includes('cost')) {
      // Cost optimizations tend to have higher success rates
      adjustedProbability *= 1.15;
      confidenceFactors.push('Cost optimizations typically well-received');
    }

    // Cap at reasonable bounds
    adjustedProbability = Math.min(0.95, Math.max(0.1, adjustedProbability));

    let recommendedApproach = 'Standard optimization request';
    if (adjustedProbability > 0.8) {
      recommendedApproach = 'Direct optimization request with confidence';
    } else if (adjustedProbability < 0.4) {
      recommendedApproach = 'Detailed justification with incremental approach';
    }

    return {
      successProbability: adjustedProbability,
      reasoning: `Based on ${relevantHistory.length} historical optimization requests with ${(baseSuccessRate * 100).toFixed(0)}% success rate`,
      recommendedApproach,
      confidenceFactors
    };
  }

  async identifyOptimalQueryTiming(interactions: DashboardInteractionLog[]): Promise<{
    optimalTimes: string[];
    reasoning: string;
    confidence: number;
  }> {
    if (interactions.length < 10) {
      return {
        optimalTimes: ['Any time'],
        reasoning: 'Insufficient data for timing analysis',
        confidence: 0.2
      };
    }

    // Group interactions by hour
    const hourlyActivity = interactions.reduce((acc, interaction) => {
      const hour = new Date(interaction.timestamp).getHours();
      if (!acc[hour]) acc[hour] = [];
      acc[hour].push(interaction);
      return acc;
    }, {} as Record<number, DashboardInteractionLog[]>);

    // Find hours with highest user satisfaction
    const hourlyEffectiveness = Object.entries(hourlyActivity).map(([hour, hourInteractions]) => {
      const positiveInteractions = hourInteractions.filter(i => i.userSatisfaction === 'positive').length;
      const effectiveness = positiveInteractions / hourInteractions.length;
      
      return {
        hour: parseInt(hour),
        effectiveness,
        count: hourInteractions.length
      };
    });

    // Filter for significant activity (at least 3 interactions)
    const significantHours = hourlyEffectiveness.filter(h => h.count >= 3);
    
    if (significantHours.length === 0) {
      return {
        optimalTimes: ['Any time'],
        reasoning: 'No significant patterns found in timing data',
        confidence: 0.3
      };
    }

    // Sort by effectiveness
    significantHours.sort((a, b) => b.effectiveness - a.effectiveness);
    
    const topHours = significantHours.slice(0, 3).map(h => `${h.hour}:00-${h.hour + 1}:00`);
    const avgEffectiveness = significantHours.slice(0, 3).reduce((sum, h) => sum + h.effectiveness, 0) / 3;

    return {
      optimalTimes: topHours,
      reasoning: `Analysis of ${interactions.length} interactions shows highest user satisfaction during these hours`,
      confidence: Math.min(0.9, avgEffectiveness + 0.2)
    };
  }

  private analyzeQueryPatterns(interactions: DashboardInteractionLog[]): DashboardPattern[] {
    const patterns: DashboardPattern[] = [];

    // Group by query type
    const queryTypeGroups = interactions.reduce((acc, interaction) => {
      if (!acc[interaction.queryType]) acc[interaction.queryType] = [];
      acc[interaction.queryType].push(interaction);
      return acc;
    }, {} as Record<string, DashboardInteractionLog[]>);

    Object.entries(queryTypeGroups).forEach(([queryType, typeInteractions]) => {
      if (typeInteractions.length >= 3) {
        const successRate = typeInteractions.filter(i => i.userSatisfaction === 'positive').length / typeInteractions.length;
        const avgResponseTime = typeInteractions.reduce((sum, i) => sum + i.responseTime, 0) / typeInteractions.length;

        patterns.push({
          type: 'query_pattern',
          pattern: `${queryType} queries`,
          frequency: typeInteractions.length,
          effectiveness: successRate,
          confidence: Math.min(0.9, typeInteractions.length / 10),
          examples: typeInteractions.slice(0, 3).map(i => i.userQuery),
          recommendations: [
            successRate > 0.8 ? 'Continue current approach' : 'Improve response quality',
            avgResponseTime > 3000 ? 'Optimize response time' : 'Response time acceptable'
          ].filter(r => r !== 'Response time acceptable')
        });
      }
    });

    return patterns;
  }

  private analyzeOptimizationPatterns(interactions: DashboardInteractionLog[]): DashboardPattern[] {
    const patterns: DashboardPattern[] = [];
    
    const optimizationInteractions = interactions.filter(i => 
      i.actionTaken === 'architect_handoff' || i.actionTaken === 'commander_sync'
    );

    if (optimizationInteractions.length >= 3) {
      const implementationRate = optimizationInteractions.filter(i => 
        i.optimizationResult === 'implemented'
      ).length / optimizationInteractions.length;

      patterns.push({
        type: 'optimization_pattern',
        pattern: 'optimization_requests',
        frequency: optimizationInteractions.length,
        effectiveness: implementationRate,
        confidence: Math.min(0.8, optimizationInteractions.length / 5),
        examples: optimizationInteractions.slice(0, 2).map(i => i.userQuery),
        recommendations: [
          implementationRate > 0.7 ? 'Optimization requests well-received' : 'Improve optimization justification',
          'Track implementation results for better predictions'
        ]
      });
    }

    return patterns;
  }

  private analyzeTimingPatterns(interactions: DashboardInteractionLog[]): DashboardPattern[] {
    const patterns: DashboardPattern[] = [];

    // Analyze day-of-week patterns
    const dayGroups = interactions.reduce((acc, interaction) => {
      const day = new Date(interaction.timestamp).getDay();
      if (!acc[day]) acc[day] = [];
      acc[day].push(interaction);
      return acc;
    }, {} as Record<number, DashboardInteractionLog[]>);

    const activeDays = Object.entries(dayGroups).filter(([_, dayInteractions]) => dayInteractions.length >= 2);

    if (activeDays.length >= 3) {
      const mostActiveDay = activeDays.reduce((max, [day, dayInteractions]) => 
        dayInteractions.length > max.count ? { day: parseInt(day), count: dayInteractions.length } : max,
        { day: 0, count: 0 }
      );

      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      patterns.push({
        type: 'timing_pattern',
        pattern: `${dayNames[mostActiveDay.day]} activity peak`,
        frequency: mostActiveDay.count,
        effectiveness: 0.7, // Default for timing patterns
        confidence: 0.6,
        examples: [`Most active on ${dayNames[mostActiveDay.day]}`],
        recommendations: [
          'Consider scheduled health reports on active days',
          'Optimize monitoring for peak usage times'
        ]
      });
    }

    return patterns;
  }

  private analyzePreferencePatterns(interactions: DashboardInteractionLog[]): DashboardPattern[] {
    const patterns: DashboardPattern[] = [];

    // Analyze response satisfaction patterns
    const positiveInteractions = interactions.filter(i => i.userSatisfaction === 'positive');
    
    if (positiveInteractions.length >= 3) {
      const commonFeatures = this.findCommonFeatures(positiveInteractions);
      
      if (commonFeatures.length > 0) {
        patterns.push({
          type: 'preference_pattern',
          pattern: 'high_satisfaction_features',
          frequency: positiveInteractions.length,
          effectiveness: 1.0,
          confidence: Math.min(0.8, positiveInteractions.length / 10),
          examples: commonFeatures,
          recommendations: [
            'Emphasize features that lead to high satisfaction',
            'Apply successful patterns to other response types'
          ]
        });
      }
    }

    return patterns;
  }

  private analyzeOptimizationBehavior(
    interactions: DashboardInteractionLog[],
    preferences: UserPreference
  ): DashboardInsight[] {
    const insights: DashboardInsight[] = [];

    if (preferences.optimizationApprovalRate > 0.8) {
      insights.push({
        type: 'user_behavior',
        message: 'User highly receptive to optimization suggestions',
        confidence: 0.9,
        supportingData: [`${(preferences.optimizationApprovalRate * 100).toFixed(0)}% approval rate`],
        actionable: true,
        recommendation: 'Offer optimization suggestions proactively'
      });
    } else if (preferences.optimizationApprovalRate < 0.3) {
      insights.push({
        type: 'user_behavior',
        message: 'User cautious about optimization implementations',
        confidence: 0.8,
        supportingData: [`${(preferences.optimizationApprovalRate * 100).toFixed(0)}% approval rate`],
        actionable: true,
        recommendation: 'Provide more detailed justification for optimizations'
      });
    }

    return insights;
  }

  private analyzeQueryEffectiveness(interactions: DashboardInteractionLog[]): DashboardInsight[] {
    const insights: DashboardInsight[] = [];

    const responseTimeGroups = {
      fast: interactions.filter(i => i.responseTime < 2000),
      normal: interactions.filter(i => i.responseTime >= 2000 && i.responseTime < 5000),
      slow: interactions.filter(i => i.responseTime >= 5000)
    };

    if (responseTimeGroups.slow.length > responseTimeGroups.fast.length) {
      insights.push({
        type: 'effectiveness',
        message: 'Dashboard response times trending slower',
        confidence: 0.7,
        supportingData: [`${responseTimeGroups.slow.length} slow vs ${responseTimeGroups.fast.length} fast responses`],
        actionable: true,
        recommendation: 'Optimize dashboard query processing'
      });
    }

    return insights;
  }

  private analyzeTimingPreferences(interactions: DashboardInteractionLog[]): DashboardInsight[] {
    const insights: DashboardInsight[] = [];

    // Simple timing analysis
    const hourCounts = interactions.reduce((acc, interaction) => {
      const hour = new Date(interaction.timestamp).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const peakHour = Object.entries(hourCounts).reduce((max, [hour, count]) => 
      count > max.count ? { hour: parseInt(hour), count } : max,
      { hour: 0, count: 0 }
    );

    if (peakHour.count >= 3) {
      insights.push({
        type: 'pattern',
        message: `Peak usage around ${peakHour.hour}:00`,
        confidence: 0.6,
        supportingData: [`${peakHour.count} interactions at this time`],
        actionable: false
      });
    }

    return insights;
  }

  private findCommonFeatures(interactions: DashboardInteractionLog[]): string[] {
    // Simple feature extraction - in reality this would be more sophisticated
    const features: string[] = [];

    const avgResponseTime = interactions.reduce((sum, i) => sum + i.responseTime, 0) / interactions.length;
    if (avgResponseTime < 2000) features.push('Fast response times');

    const queryTypes = Array.from(new Set(interactions.map(i => i.queryType)));
    if (queryTypes.length === 1) features.push(`Consistent ${queryTypes[0]} queries`);

    return features;
  }
}