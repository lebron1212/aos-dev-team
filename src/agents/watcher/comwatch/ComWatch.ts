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
  apiUsed: 'claude' | 'local' | 'hybrid';
  confidence: number;
}

export class ComWatch {
  private collector: TrainingCollector;
  private trainer: ModelTrainer;
  private ollama: OllamaInterface;
  private interactionsFile = 'data/interactions.json';
  private interactions: InteractionLog[] = [];
  private isWatching = true;
  private localModelReady = false;
  private trainingThreshold = 100; // Switch to local after 100 good interactions

  constructor() {
    this.collector = new TrainingCollector();
    this.trainer = new ModelTrainer();
    this.ollama = new OllamaInterface();
    this.loadInteractions();
    this.checkLocalModelReadiness();
    console.log('[ComWatch] Enhanced learning system initialized - tracking for local replacement');
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
      wordCount: response.split(/\s+/).length,
      isGood: this.evaluateResponseQuality(response, feedback),
      category: this.categorizeInteraction(input, response, feedback),
      apiUsed: 'claude', // Currently using Claude
      confidence: this.calculateConfidence(response, feedback)
    };
    
    this.interactions.push(interaction);
    
    if (this.interactions.length > 1000) {
      this.interactions = this.interactions.slice(-1000);
    }
    
    await this.saveInteractions();
    await this.collector.logInteraction(input, response, context, feedback);
    
    // Check if we can start using local model
    await this.assessLocalModelReadiness();
    
    console.log(`[ComWatch] Logged ${interaction.category} interaction: ${interaction.wordCount} words, quality: ${interaction.isGood ? 'good' : 'needs improvement'}, API: ${interaction.apiUsed}`);
    
    if (feedback) {
      await this.processImmediateFeedback(interaction);
    }
  }

  async shouldUseLocalModel(inputType: string): Promise<boolean> {
    if (!this.localModelReady) return false;
    
    const goodInteractions = this.interactions.filter(i => i.isGood && i.category === this.categorizeByInput(inputType)).length;
    const localSuccessRate = await this.getLocalModelSuccessRate(inputType);
    
    // Use local model if we have enough training data and good success rate
    return goodInteractions >= this.trainingThreshold && localSuccessRate > 0.8;
  }

  async generateLocalResponse(input: string, context: string[]): Promise<string | null> {
    if (!this.localModelReady) return null;
    
    try {
      // Use Ollama to generate response based on learned patterns
      const response = await this.ollama.generateResponse(input, context, this.getTrainingPatterns());
      
      if (response && response.length > 0) {
        console.log('[ComWatch] Generated response using local model');
        return response;
      }
    } catch (error) {
      console.error('[ComWatch] Local model generation failed:', error);
    }
    
    return null;
  }

  async getTrainingStats(): Promise<any> {
    const stats = await this.collector.getStats();
    const recentGood = this.interactions.filter(i => i.isGood && this.isRecent(i.timestamp)).length;
    const recentBad = this.interactions.filter(i => !i.isGood && this.isRecent(i.timestamp)).length;
    const localReadyCategories = await this.getLocalReadyCategories();
    
    return {
      ...stats,
      totalInteractions: this.interactions.length,
      recentQualityRatio: recentBad > 0 ? recentGood / recentBad : recentGood,
      averageWordCount: this.interactions.reduce((sum, i) => sum + i.wordCount, 0) / this.interactions.length,
      categories: this.getCategoryBreakdown(),
      localModelReady: this.localModelReady,
      localReadyCategories,
      trainingProgress: `${Math.min(recentGood, this.trainingThreshold)}/${this.trainingThreshold}`,
      persistedToDisk: true,
      watchingStatus: this.isWatching ? 'active' : 'paused'
    };
  }

  private async checkLocalModelReadiness(): Promise<void> {
    try {
      this.localModelReady = await this.ollama.isModelReady();
      if (this.localModelReady) {
        console.log('[ComWatch] Local model detected and ready for inference');
      } else {
        console.log('[ComWatch] Local model not ready - continuing with Claude API');
      }
    } catch (error) {
      console.log('[ComWatch] Local model not available - using Claude API');
      this.localModelReady = false;
    }
  }

  private async assessLocalModelReadiness(): Promise<void> {
    const goodInteractions = this.interactions.filter(i => i.isGood).length;
    
    if (goodInteractions >= this.trainingThreshold && !this.localModelReady) {
      console.log(`[ComWatch] Reached training threshold (${goodInteractions}/${this.trainingThreshold}) - checking local model`);
      await this.trainer.trainLocalModel(this.interactions.filter(i => i.isGood));
      await this.checkLocalModelReadiness();
    }
  }

  private async getLocalModelSuccessRate(inputType: string): Promise<number> {
    // This would track how well the local model performs compared to Claude
    const category = this.categorizeByInput(inputType);
    const categoryInteractions = this.interactions.filter(i => i.category === category);
    const localSuccessful = categoryInteractions.filter(i => i.apiUsed === 'local' && i.isGood).length;
    const totalLocal = categoryInteractions.filter(i => i.apiUsed === 'local').length;
    
    return totalLocal > 0 ? localSuccessful / totalLocal : 0;
  }

  private async getLocalReadyCategories(): Promise<string[]> {
    const categories = ['work', 'casual', 'feedback', 'correction'];
    const readyCategories: string[] = [];
    
    for (const category of categories) {
      const goodCount = this.interactions.filter(i => i.isGood && i.category === category).length;
      if (goodCount >= 20) { // Threshold per category
        readyCategories.push(category);
      }
    }
    
    return readyCategories;
  }

  private getTrainingPatterns(): any[] {
    return this.interactions
      .filter(i => i.isGood)
      .slice(-50) // Use recent good interactions as patterns
      .map(i => ({
        input: i.input,
        response: i.response,
        context: i.context,
        category: i.category,
        confidence: i.confidence
      }));
  }

  private calculateConfidence(response: string, feedback?: string): number {
    let confidence = 0.7; // Base confidence
    
    if (feedback) {
      if (/good|great|perfect|excellent/.test(feedback.toLowerCase())) confidence = 0.9;
      if (/bad|wrong|terrible/.test(feedback.toLowerCase())) confidence = 0.3;
    }
    
    // Adjust based on response characteristics
    const wordCount = response.split(/\s+/).length;
    if (wordCount <= 10) confidence += 0.1; // Prefer concise responses
    if (response.includes('*')) confidence -= 0.2; // Avoid actions
    
    return Math.max(0.1, Math.min(0.9, confidence));
  }

  private categorizeByInput(input: string): 'work' | 'casual' | 'feedback' | 'correction' {
    const workKeywords = /build|deploy|create|fix|component|api|system|code/i;
    const casualKeywords = /hello|hi|morning|sleep|tired|how.*doing|what.*up/i;
    const feedbackKeywords = /feedback|correction|better|worse|don't|avoid/i;
    
    if (feedbackKeywords.test(input)) return 'feedback';
    if (workKeywords.test(input)) return 'work';
    if (casualKeywords.test(input)) return 'casual';
    return 'casual';
  }

  // ... (keep all existing methods for compatibility)
  private evaluateResponseQuality(response: string, feedback?: string): boolean {
    if (feedback) {
      const negativeFeedback = /DO NOT|don't|bad|wrong|terrible|too try-hard|way too|dial.*down|cliché/i;
      if (negativeFeedback.test(feedback)) return false;
      
      const positiveFeedback = /good|great|perfect|nice|love|excellent|better/i;
      if (positiveFeedback.test(feedback)) return true;
    }
    
    const wordCount = response.split(/\s+/).length;
    const hasAsterisks = response.includes('*');
    const hasClichés = /systems nominal|all systems go|firing on all cylinders/i.test(response);
    
    return wordCount <= 15 && !hasAsterisks && !hasClichés;
  }

  private categorizeInteraction(input: string, response: string, feedback?: string): 'work' | 'casual' | 'feedback' | 'correction' {
    if (feedback) return 'feedback';
    return this.categorizeByInput(input);
  }

  private getCategoryBreakdown(): Record<string, number> {
    const breakdown: Record<string, number> = {};
    this.interactions.forEach(i => {
      breakdown[i.category] = (breakdown[i.category] || 0) + 1;
    });
    return breakdown;
  }

  private isRecent(timestamp: string): boolean {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return new Date(timestamp) > hourAgo;
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

  private async loadInteractions(): Promise<void> {
    try {
      const data = await fs.readFile(this.interactionsFile, 'utf8');
      this.interactions = JSON.parse(data);
      console.log(`[ComWatch] Loaded ${this.interactions.length} previous interactions`);
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

  pauseWatching(): void {
    this.isWatching = false;
    console.log('[ComWatch] Paused watching');
  }

  resumeWatching(): void {
    this.isWatching = true;
    console.log('[ComWatch] Resumed watching');
  }

  async generateLearningInsights(): Promise<string[]> {
    const insights: string[] = [];
    
    const avgWords = this.interactions.reduce((sum, i) => sum + i.wordCount, 0) / this.interactions.length;
    if (avgWords > 15) {
      insights.push(`Responses averaging ${avgWords.toFixed(1)} words - consider being more concise`);
    }
    
    const negativeFeedback = this.interactions.filter(i => i.feedback && !i.isGood);
    if (negativeFeedback.length > 0) {
      const commonIssues = this.extractCommonIssues(negativeFeedback);
      insights.push(...commonIssues);
    }
    
    const recentInteractions = this.interactions.filter(i => this.isRecent(i.timestamp));
    const recentQuality = recentInteractions.filter(i => i.isGood).length / recentInteractions.length;
    if (recentQuality < 0.8) {
      insights.push(`Recent quality score: ${(recentQuality * 100).toFixed(1)}% - needs improvement`);
    }

    // Local model readiness insights
    const goodInteractions = this.interactions.filter(i => i.isGood).length;
    if (goodInteractions >= this.trainingThreshold) {
      insights.push(`Local model ready - ${goodInteractions} good interactions collected`);
    } else {
      insights.push(`Local model progress: ${goodInteractions}/${this.trainingThreshold} interactions`);
    }
    
    return insights;
  }

  private extractCommonIssues(negativeFeedback: InteractionLog[]): string[] {
    const issues: string[] = [];
    
    const tooLongCount = negativeFeedback.filter(i => i.feedback?.includes('long') || i.feedback?.includes('wordy')).length;
    if (tooLongCount > 0) {
      issues.push(`${tooLongCount} instances of responses being too long`);
    }
    
    const tryHardCount = negativeFeedback.filter(i => i.feedback?.includes('try-hard')).length;
    if (tryHardCount > 0) {
      issues.push(`${tryHardCount} instances of forced/try-hard responses`);
    }
    
    return issues;
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
      contextLength: i.context.length,
      confidence: i.confidence,
      apiUsed: i.apiUsed
    }));
  }
}
