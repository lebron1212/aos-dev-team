import { ArchitecturalDecision, ArchitecturalInsight } from '../types/index.js';

export class PatternAnalyzer {
  
  analyzeDecisionPatterns(decisions: ArchitecturalDecision[]): ArchitecturalInsight[] {
    const insights: ArchitecturalInsight[] = [];
    
    // Analyze success patterns
    const successByType = decisions.reduce((acc, d) => {
      if (!acc[d.type]) acc[d.type] = { success: 0, total: 0 };
      acc[d.type].total++;
      if (d.success) acc[d.type].success++;
      return acc;
    }, {} as Record<string, { success: number, total: number }>);

    Object.entries(successByType).forEach(([type, stats]) => {
      const rate = stats.success / stats.total;
      if (rate < 0.7 && stats.total >= 3) {
        insights.push({
          type: 'warning',
          message: `Low success rate for ${type}: ${(rate * 100).toFixed(1)}%`,
          confidence: 0.8,
          relatedDecisions: decisions.filter(d => d.type === type).map(d => d.id)
        });
      }
    });

    return insights;
  }

  detectRiskPatterns(decisions: ArchitecturalDecision[]): ArchitecturalInsight[] {
    const insights: ArchitecturalInsight[] = [];
    
    const recentHighRisk = decisions
      .filter(d => d.impact === 'high')
      .filter(d => new Date(d.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000));

    if (recentHighRisk.length > 2) {
      insights.push({
        type: 'risk',
        message: `${recentHighRisk.length} high-risk changes in 24 hours`,
        confidence: 0.9,
        relatedDecisions: recentHighRisk.map(d => d.id)
      });
    }

    return insights;
  }
}
