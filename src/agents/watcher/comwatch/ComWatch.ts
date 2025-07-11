import { OllamaInterface } from './communication/OllamaInterface.js';
import { TrainingCollector } from './intelligence/TrainingCollector.js';
import { ModelTrainer } from './core/ModelTrainer.js';
import fs from 'fs/promises';

interface InteractionLog {
  timestamp: string;
  input: string;
  response: string;
  context: string[];
  feedback?: string;
  chars: number;
  isGood: boolean;
  wordCount: number;
  responseTime?: number;
  category: 'work' | 'casual' | 'feedback' | 'correction';
}

export class ComWatch {
  private collector: TrainingCollector;
  private trainer: ModelTrainer;
  private ollama: OllamaInterface;
  private interactionsFile = 'data/interactions.json';
  private interactions: InteractionLog[] = [];
  private isWatching = true;

  constructor() {
    this.collector = new TrainingCollector();
    this.trainer = new ModelTrainer();
    this.ollama = new OllamaInterface();
    this.loadInteractions();
    console.log('[ComWatch] Silent learning system initialized and watching');
  }

  async logCommanderInteraction(
    input: string, 
    response: string, 
    context: string[], 
    feedback?: string
  ): Promise<void> {
    if (!this.isWatching) return;
    
    const interaction: InteractionLog = {
      timestamp: new Date().toISOString(),
      input: input.trim(),
      response: response.trim(),
      context: context.slice(-3),
      feedback,
      chars: input.length + response.length,
      wordCount: response.split(/\\s+/).length,
      isGood: this.evaluateResponseQuality(response, feedback),
      category: this.categorizeInteraction(input, response, feedback)
    };
    
    this.interactions.push(interaction);
    
    if (this.interactions.length > 1000) {
      this.interactions = this.interactions.slice(-1000);
    }
    
    await this.saveInteractions();
    await this.collector.logInteraction(input, response, context, feedback);
    
    console.log(\`[ComWatch] Logged \${interaction.category} interaction: \${interaction.wordCount} words, quality: \${interaction.isGood ? 'good' : 'needs improvement'}\`);
    
    if (feedback) {
      await this.processImmediateFeedback(interaction);
    }
  }

  async getTrainingStats(): Promise<any> {
    const stats = await this.collector.getStats();
    const recentGood = this.interactions.filter(i => i.isGood && this.isRecent(i.timestamp)).length;
    const recentBad = this.interactions.filter(i => !i.isGood && this.isRecent(i.timestamp)).length;
    
    return {
      ...stats,
      totalInteractions: this.interactions.length,
      recentQualityRatio: recentBad > 0 ? recentGood / recentBad : recentGood,
      averageWordCount: this.interactions.reduce((sum, i) => sum + i.wordCount, 0) / this.interactions.length,
      categories: this.getCategoryBreakdown(),
      persistedToDisk: true,
      watchingStatus: this.isWatching ? 'active' : 'paused'
    };
  }

  async exportTrainingData(): Promise<any[]> {
    return this.interactions.map(i => ({
      input: i.input,
      output: i.response,
      feedback: i.feedback,
      quality: i.isGood ? 'good' : 'needs_improvement',
      timestamp: i.timestamp,
      category: i.category,
      wordCount: i.wordCount,
      contextLength: i.context.length
    }));
  }

  async generateLearningInsights(): Promise<string[]> {
    const insights: string[] = [];
    
    const avgWords = this.interactions.reduce((sum, i) => sum + i.wordCount, 0) / this.interactions.length;
    if (avgWords > 15) {
      insights.push(\`Responses averaging \${avgWords.toFixed(1)} words - consider being more concise\`);
    }
    
    const negativeFeedback = this.interactions.filter(i => i.feedback && !i.isGood);
    if (negativeFeedback.length > 0) {
      const commonIssues = this.extractCommonIssues(negativeFeedback);
      insights.push(...commonIssues);
    }
    
    const recentInteractions = this.interactions.filter(i => this.isRecent(i.timestamp));
    const recentQuality = recentInteractions.filter(i => i.isGood).length / recentInteractions.length;
    if (recentQuality < 0.8) {
      insights.push(\`Recent quality score: \${(recentQuality * 100).toFixed(1)}% - needs improvement\`);
    }
    
    return insights;
  }

  pauseWatching(): void {
    this.isWatching = false;
    console.log('[ComWatch] Paused watching');
  }

  resumeWatching(): void {
    this.isWatching = true;
    console.log('[ComWatch] Resumed watching');
  }

  private async processImmediateFeedback(interaction: InteractionLog): Promise<void> {
    if (!interaction.feedback) return;
    
    const feedbackLower = interaction.feedback.toLowerCase();
    
    if (feedbackLower.includes('too long') || feedbackLower.includes('wordy')) {
      console.log('[ComWatch] Learning: User wants shorter responses');
    }
    
    if (feedbackLower.includes('try-hard') || feedbackLower.includes('forced')) {
      console.log('[ComWatch] Learning: User wants more natural tone');
    }
    
    if (feedbackLower.includes('cliché') || feedbackLower.includes('systems nominal')) {
      console.log('[ComWatch] Learning: User dislikes specific phrases');
    }
  }

  private evaluateResponseQuality(response: string, feedback?: string): boolean {
    if (feedback) {
      const negativeFeedback = /DO NOT|don't|bad|wrong|terrible|too try-hard|way too|dial.*down|cliché/i;
      if (negativeFeedback.test(feedback)) return false;
      
      const positiveFeedback = /good|great|perfect|nice|love|excellent|better/i;
      if (positiveFeedback.test(feedback)) return true;
    }
    
    const wordCount = response.split(/\\s+/).length;
    const hasAsterisks = response.includes('*');
    const hasClichés = /systems nominal|all systems go|firing on all cylinders/i.test(response);
    
    return wordCount <= 15 && !hasAsterisks && !hasClichés;
  }

  private categorizeInteraction(input: string, response: string, feedback?: string): 'work' | 'casual' | 'feedback' | 'correction' {
    if (feedback) return 'feedback';
    
    const workKeywords = /build|deploy|create|fix|component|api|system|code/i;
    if (workKeywords.test(input)) return 'work';
    
    const casualKeywords = /hello|hi|morning|sleep|tired|how.*doing|what.*up/i;
    if (casualKeywords.test(input)) return 'casual';
    
    return 'casual';
  }

  private getCategoryBreakdown(): Record<string, number> {
    const breakdown: Record<string, number> = {};
    this.interactions.forEach(i => {
      breakdown[i.category] = (breakdown[i.category] || 0) + 1;
    });
    return breakdown;
  }

  private extractCommonIssues(negativeFeedback: InteractionLog[]): string[] {
    const issues: string[] = [];
    
    const tooLongCount = negativeFeedback.filter(i => i.feedback?.includes('long') || i.feedback?.includes('wordy')).length;
    if (tooLongCount > 0) {
      issues.push(\`\${tooLongCount} instances of responses being too long\`);
    }
    
    const tryHardCount = negativeFeedback.filter(i => i.feedback?.includes('try-hard')).length;
    if (tryHardCount > 0) {
      issues.push(\`\${tryHardCount} instances of forced/try-hard responses\`);
    }
    
    return issues;
  }

  private isRecent(timestamp: string): boolean {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return new Date(timestamp) > hourAgo;
  }

  private async loadInteractions(): Promise<void> {
    try {
      const data = await fs.readFile(this.interactionsFile, 'utf8');
      this.interactions = JSON.parse(data);
      console.log(\`[ComWatch] Loaded \${this.interactions.length} previous interactions\`);
    } catch (error) {
      this.interactions = [];
      console.log('[ComWatch] No previous interactions found, starting fresh');
    }
  }

  private async saveInteractions(): Promise<void> {
    try {
      await fs.mkdir('data', { recursive: true });
      await fs.writeFile(this.interactionsFile, JSON.stringify(this.interactions, null, 2));
    } catch (error) {
      console.error('[ComWatch] Failed to save interactions:', error);
    }
  }
}
