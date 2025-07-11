import fs from 'fs/promises';
import { ArchitecturalDecision, DecisionResult, ArchitecturalInsight, SystemEvolution } from './types/index.js';

export class ArchWatch {
  private decisions: ArchitecturalDecision[] = [];
  private decisionsFile = 'data/architectural-decisions.json';

  constructor() {
    this.loadDecisions();
    console.log('[ArchWatch] Architectural watcher initialized');
  }

  async logArchitecturalDecision(
    type: ArchitecturalDecision['type'],
    request: string,
    result: any,
    riskLevel: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<void> {
    const startTime = Date.now();
    
    const decision: ArchitecturalDecision = {
      id: `arch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type,
      request: request.slice(0, 200),
      result: {
        summary: result.summary || 'Completed',
        status: result.status || 'success',
        details: result,
        error: result.error
      },
      impact: riskLevel,
      success: !result.error,
      duration: Date.now() - startTime,
      changedFiles: result.files || []
    };

    this.decisions.push(decision);
    
    if (this.decisions.length > 500) {
      this.decisions = this.decisions.slice(-500);
    }

    await this.saveDecisions();
    
    console.log(`[ArchWatch] Logged ${type}: ${decision.impact} impact, ${decision.success ? 'success' : 'failed'}`);
  }

  async getArchitecturalInsights(): Promise<ArchitecturalInsight[]> {
    const insights: ArchitecturalInsight[] = [];
    
    const recentDecisions = this.decisions.filter(d => 
      new Date(d.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    if (recentDecisions.length > 0) {
      const successRate = recentDecisions.filter(d => d.success).length / recentDecisions.length;
      insights.push({
        type: successRate > 0.8 ? 'opportunity' : 'warning',
        message: `Recent success rate: ${(successRate * 100).toFixed(1)}%`,
        confidence: 0.9,
        relatedDecisions: recentDecisions.map(d => d.id)
      });
    }

    const highImpactChanges = this.decisions.filter(d => d.impact === 'high').length;
    if (highImpactChanges > 5) {
      insights.push({
        type: 'pattern',
        message: `${highImpactChanges} high-impact architectural changes made`,
        confidence: 0.8,
        relatedDecisions: this.decisions.filter(d => d.impact === 'high').map(d => d.id)
      });
    }

    const types = this.decisions.reduce((acc, d) => {
      acc[d.type] = (acc[d.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostCommon = Object.entries(types).sort(([,a], [,b]) => b - a)[0];
    if (mostCommon) {
      insights.push({
        type: 'pattern',
        message: `Most common operation: ${mostCommon[0]} (${mostCommon[1]} times)`,
        confidence: 0.7,
        relatedDecisions: this.decisions.filter(d => d.type === mostCommon[0]).map(d => d.id)
      });
    }

    return insights;
  }

  async getSystemEvolution(timeframeDays: number = 7): Promise<SystemEvolution> {
    const cutoff = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000);
    const recentDecisions = this.decisions.filter(d => new Date(d.timestamp) > cutoff);
    
    const successRate = recentDecisions.length > 0 
      ? recentDecisions.filter(d => d.success).length / recentDecisions.length 
      : 0;

    const riskDistribution = recentDecisions.reduce((acc, d) => {
      acc[d.impact] = (acc[d.impact] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const fileActivity = recentDecisions
      .flatMap(d => d.changedFiles)
      .reduce((acc, file) => {
        acc[file] = (acc[file] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const mostActiveAreas = Object.entries(fileActivity)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([file]) => file);

    return {
      timeframe: `${timeframeDays} days`,
      totalChanges: recentDecisions.length,
      successRate,
      riskDistribution,
      mostActiveAreas,
      emergingPatterns: await this.detectEmergingPatterns(recentDecisions)
    };
  }

  private async detectEmergingPatterns(decisions: ArchitecturalDecision[]): Promise<string[]> {
    const patterns: string[] = [];
    
    // Detect frequent modification patterns
    const modificationTypes = decisions
      .filter(d => d.type === 'system-modification')
      .map(d => d.request.toLowerCase());
    
    if (modificationTypes.filter(req => req.includes('voice')).length > 2) {
      patterns.push('Frequent voice system modifications');
    }
    
    if (modificationTypes.filter(req => req.includes('feedback')).length > 2) {
      patterns.push('Active feedback system refinement');
    }

    // Detect creation patterns
    const creationRequests = decisions
      .filter(d => d.type === 'agent-creation')
      .length;
    
    if (creationRequests > 3) {
      patterns.push('High agent creation activity');
    }

    return patterns;
  }

  private async loadDecisions(): Promise<void> {
    try {
      const data = await fs.readFile(this.decisionsFile, 'utf8');
      this.decisions = JSON.parse(data);
      console.log(`[ArchWatch] Loaded ${this.decisions.length} architectural decisions`);
    } catch (error) {
      this.decisions = [];
      console.log('[ArchWatch] No previous decisions found, starting fresh');
    }
  }

  private async saveDecisions(): Promise<void> {
    try {
      await fs.mkdir('data', { recursive: true });
      await fs.writeFile(this.decisionsFile, JSON.stringify(this.decisions, null, 2));
    } catch (error) {
      console.error('[ArchWatch] Failed to save decisions:', error);
    }
  }
}
