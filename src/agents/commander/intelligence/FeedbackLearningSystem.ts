import Anthropic from '@anthropic-ai/sdk';
import { createClient } from 'redis';

interface FeedbackExample {
  id: string;
  timestamp: Date;
  context: string;
  userInput: string;
  commanderResponse: string;
  userFeedback: string;
  suggestedImprovement?: string;
  feedbackType: 'positive' | 'negative' | 'suggestion';
  category: 'work' | 'casual' | 'wit' | 'personality';
}

export class FeedbackLearningSystem {
  private examples: FeedbackExample[] = [];
  private claude?: Anthropic;
  private redis?: any;
  private redisKey = 'commander:feedback';
  
  constructor(claudeApiKey?: string) {
    if (claudeApiKey) {
      this.claude = new Anthropic({ apiKey: claudeApiKey });
    }
    this.initRedis();
    this.loadFeedback();
  }

  private async initRedis() {
    try {
      if (process.env.REDIS_URL) {
        this.redis = createClient({ url: process.env.REDIS_URL });
        await this.redis.connect();
        console.log('[FeedbackLearning] Connected to Redis');
      } else {
        console.log('[FeedbackLearning] No Redis URL, using memory storage');
      }
    } catch (error) {
      console.error('[FeedbackLearning] Redis connection failed:', error);
    }
  }

  async logFeedback(
    userInputOrParam1: string,
    commanderResponseOrParam2: string,
    feedbackTypeOrParam3: string,
    contextOrParam4?: string,
    suggestedImprovementOrParam5?: string
  ): Promise<void> {
    
    const userInput = userInputOrParam1;
    const commanderResponse = commanderResponseOrParam2;
    const feedbackType = feedbackTypeOrParam3;
    const context = contextOrParam4 || 'Discord interaction';
    const suggestedImprovement = suggestedImprovementOrParam5;
    
    const feedback: FeedbackExample = {
      id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      context,
      userInput,
      commanderResponse,
      userFeedback: feedbackType,
      suggestedImprovement,
      feedbackType: await this.classifyFeedback(feedbackType, context),
      category: this.classifyCategory(userInput, commanderResponse)
    };

    this.examples.push(feedback);
    await this.saveFeedback();
    
    console.log(`[FeedbackLearning] Logged feedback: ${feedback.feedbackType} - ${feedback.category}`);
  }

  generateLearningExamples(): string {
    const recentExamples = this.examples
      .filter(ex => ex.feedbackType === 'negative' || ex.suggestedImprovement)
      .slice(-10);
    
    if (recentExamples.length === 0) return '';
    
    const corrections = recentExamples.map(ex => {
      if (ex.suggestedImprovement) {
        return `AVOID: "${ex.commanderResponse}"\nUSE: "${ex.suggestedImprovement}"`;
      } else if (ex.userFeedback.includes('DO NOT') || ex.userFeedback.includes('too try-hard')) {
        return `NEVER: Use overly wordy or try-hard responses like "${ex.commanderResponse}"\nBETTER: Keep wit brief, smooth, and natural`;
      }
      return `IMPROVE: User said "${ex.userFeedback}" about response "${ex.commanderResponse}"`;
    }).join('\n\n');
    
    return `\nLEARNED CORRECTIONS:\n${corrections}\n\nSTRICTLY APPLY THESE LESSONS. Keep responses brief and natural.`;
  }

  async detectFeedback(userMessage: string, lastResponse: string): Promise<boolean> {
    if (!this.claude) {
      console.log('[FeedbackLearning] No Claude API key, using fallback detection');
      return /feedback|correction|better|instead|don't|avoid|DO NOT|too try-hard|way too|dial.*down/i.test(userMessage);
    }

    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 50,
        messages: [{
          role: 'user',
          content: `Previous AI response: "${lastResponse}"
User's next message: "${userMessage}"

Is the user giving feedback/correction about the previous response? Answer only: YES or NO`
        }]
      });
      
      const content = response.content[0];
      return content.type === 'text' && content.text.trim().toUpperCase().includes('YES');
    } catch (error) {
      console.error('[FeedbackLearning] AI feedback detection failed, using fallback');
      return /feedback|correction|better|instead|don't|avoid|DO NOT|too try-hard|way too|dial.*down/i.test(userMessage);
    }
  }

  async extractSuggestion(userFeedback: string, previousResponse: string): Promise<string | undefined> {
    if (!this.claude) {
      console.log('[FeedbackLearning] No Claude API key, using fallback extraction');
      const match = userFeedback.match(/should.*be.*['"]([^'"]+)['"]/i);
      return match ? match[1].trim() : undefined;
    }

    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Previous AI response: "${previousResponse}"
User feedback: "${userFeedback}"

Extract what the user wants the AI to say instead. If they're giving a specific alternative, return just that text. If no specific alternative is provided, return "GENERAL_FEEDBACK".

Examples:
- "should be a one or two liner" → "GENERAL_FEEDBACK"
- "just say 'Morning. Ready to build.'" → "Morning. Ready to build."
- "too try-hard" → "GENERAL_FEEDBACK"`
        }]
      });
      
      const content = response.content[0];
      if (content.type === 'text') {
        const extracted = content.text.trim();
        return extracted === 'GENERAL_FEEDBACK' ? undefined : extracted;
      }
    } catch (error) {
      console.error('[FeedbackLearning] AI suggestion extraction failed');
    }
    
    const match = userFeedback.match(/should.*be.*['"]([^'"]+)['"]/i);
    return match ? match[1].trim() : undefined;
  }

  private async classifyFeedback(feedback: string, context?: string): Promise<'positive' | 'negative' | 'suggestion'> {
    if (!this.claude) {
      if (/DO NOT|don't|bad|wrong|terrible|too try-hard|way too|dial.*down/i.test(feedback)) return 'negative';
      if (/try|instead|better|should|more like|one or two liner/i.test(feedback)) return 'suggestion';
      if (/good|great|perfect|nice|love|excellent/i.test(feedback)) return 'positive';
      return 'negative';
    }

    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 50,
        messages: [{
          role: 'user',
          content: `User feedback: "${feedback}"
${context ? `Context: ${context}` : ''}

Classify this feedback as one of:
- POSITIVE: User likes/approves of the response
- NEGATIVE: User dislikes/disapproves of the response  
- SUGGESTION: User is offering specific improvement/correction

Answer only: POSITIVE, NEGATIVE, or SUGGESTION`
        }]
      });
      
      const content = response.content[0];
      if (content.type === 'text') {
        const classification = content.text.trim().toUpperCase();
        if (classification.includes('POSITIVE')) return 'positive';
        if (classification.includes('SUGGESTION')) return 'suggestion';
        return 'negative';
      }
    } catch (error) {
      console.error('[FeedbackLearning] AI classification failed, using fallback');
    }
    
    if (/DO NOT|don't|bad|wrong|terrible|too try-hard|way too|dial.*down/i.test(feedback)) return 'negative';
    if (/try|instead|better|should|more like|one or two liner/i.test(feedback)) return 'suggestion';
    if (/good|great|perfect|nice|love|excellent/i.test(feedback)) return 'positive';
    return 'negative';
  }

  private classifyCategory(input: string, response: string): 'work' | 'casual' | 'wit' | 'personality' {
    const workKeywords = /build|deploy|create|fix|component|api|system/i;
    const witKeywords = /humor|wit|funny|joke|sarcasm|try-hard|witty/i;
    const personalityKeywords = /personality|charm|tone|voice|style|communication/i;
    
    if (workKeywords.test(input + response)) return 'work';
    if (witKeywords.test(input + response)) return 'wit';
    if (personalityKeywords.test(input + response)) return 'personality';
    return 'casual';
  }

  private async loadFeedback(): Promise<void> {
    try {
      if (this.redis) {
        const data = await this.redis.get(this.redisKey);
        if (data) {
          this.examples = JSON.parse(data);
          console.log(`[FeedbackLearning] Loaded ${this.examples.length} feedback examples from Redis`);
        }
      }
    } catch (error) {
      console.error('[FeedbackLearning] Failed to load from Redis:', error);
      this.examples = [];
    }
  }

  private async saveFeedback(): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.set(this.redisKey, JSON.stringify(this.examples));
        console.log(`[FeedbackLearning] Saved ${this.examples.length} feedback examples to Redis`);
      }
    } catch (error) {
      console.error('[FeedbackLearning] Failed to save to Redis:', error);
    }
  }

  getFeedbackCount(): number {
    return this.examples.length;
  }

  getRecentFeedback(count: number = 5): FeedbackExample[] {
    return this.examples.slice(-count);
  }

  getFeedbackByCategory(category: string): FeedbackExample[] {
    return this.examples.filter(ex => ex.category === category);
  }
}
