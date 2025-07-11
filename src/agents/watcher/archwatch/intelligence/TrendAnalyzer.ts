import { ArchitecturalDecision } from '../types/index.js';

export class TrendAnalyzer {
  
  analyzeTrends(decisions: ArchitecturalDecision[], windowDays: number = 7): any {
    const windows = this.createTimeWindows(decisions, windowDays);
    
    return {
      activityTrend: this.calculateActivityTrend(windows),
      successTrend: this.calculateSuccessTrend(windows),
      riskTrend: this.calculateRiskTrend(windows),
      typeDistribution: this.calculateTypeDistribution(decisions)
    };
  }

  private createTimeWindows(decisions: ArchitecturalDecision[], windowDays: number): any[] {
    const now = Date.now();
    const windows = [];
    
    for (let i = 0; i < 4; i++) {
      const start = now - (i + 1) * windowDays * 24 * 60 * 60 * 1000;
      const end = now - i * windowDays * 24 * 60 * 60 * 1000;
      
      const windowDecisions = decisions.filter(d => {
        const timestamp = new Date(d.timestamp).getTime();
        return timestamp >= start && timestamp < end;
      });
      
      windows.unshift({
        period: i,
        decisions: windowDecisions,
        count: windowDecisions.length,
        successRate: windowDecisions.length > 0 
          ? windowDecisions.filter(d => d.success).length / windowDecisions.length 
          : 0
      });
    }
    
    return windows;
  }

  private calculateActivityTrend(windows: any[]): 'increasing' | 'decreasing' | 'stable' {
    if (windows.length < 2) return 'stable';
    
    const recent = windows.slice(-2);
    const change = recent[1].count - recent[0].count;
    
    if (Math.abs(change) <= 1) return 'stable';
    return change > 0 ? 'increasing' : 'decreasing';
  }

  private calculateSuccessTrend(windows: any[]): 'improving' | 'declining' | 'stable' {
    if (windows.length < 2) return 'stable';
    
    const recent = windows.slice(-2);
    const change = recent[1].successRate - recent[0].successRate;
    
    if (Math.abs(change) < 0.1) return 'stable';
    return change > 0 ? 'improving' : 'declining';
  }

  private calculateRiskTrend(windows: any[]): any {
    return windows.map(w => ({
      period: w.period,
      highRiskCount: w.decisions.filter(d => d.impact === 'high').length,
      mediumRiskCount: w.decisions.filter(d => d.impact === 'medium').length,
      lowRiskCount: w.decisions.filter(d => d.impact === 'low').length
    }));
  }

  private calculateTypeDistribution(decisions: ArchitecturalDecision[]): Record<string, number> {
    return decisions.reduce((acc, d) => {
      acc[d.type] = (acc[d.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}
