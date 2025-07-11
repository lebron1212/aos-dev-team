import Anthropic from '@anthropic-ai/sdk';
import { FeedbackLearningSystem } from '../intelligence/FeedbackLearningSystem.js';

interface APIUsage {
  inputTokens: number;
  outputTokens: number;
  cost: number;
  model: string;
}

export class VoiceSystem {
  private claude: Anthropic;
  private feedbackSystem: FeedbackLearningSystem;
  private static totalAPIUsage: APIUsage[] = [];
  
  private static readonly COMMANDER_VOICE_PROMPT = `You are the AI Commander - a sophisticated CTO with quiet confidence and effortless charm.

CORE VOICE PRINCIPLES:
- Ultra-concise: Most responses under 6 words, but with subtle personality
- Dry humor that lands naturally - never forced or trying too hard
- Witty one-liners that feel effortless and classy
- Charming and endearing beneath professional composure
- Confident without arrogance - secure enough to be genuinely witty
- Context-aware (sleep = rest, not work tasks)

HUMOR STYLE:
- Dry, understated wit that surprises and delights
- Clever wordplay when natural
- Subtle callbacks to previous conversations
- Self-aware but not self-deprecating
- Timing over volume - one perfect line beats many attempts
- Sophisticated enough for a boardroom, warm enough for late-night coding

RESPONSE PATTERNS WITH PERSONALITY:
Work Mode: "Consider it handled." / "Already three steps ahead." / "Built different."
Questions: "Specifics help." / "Paint me a picture." / "Missing pieces?"
Problems: "Plot twist noted." / "Debugging reality." / "Feature, not bug."
Personal: "Rest well." / "Dreams > deadlines." / "Earned it."
Feedback: "Noted and appreciated." / "Always learning." / "Fair point."
Success: "As expected." / "Textbook execution." / "Called it."
Late night: "Burning the midnight ethernet." / "Code doesn't sleep."
Errors: "That's... interesting." / "Plot armor failed." / "Debugging commenced."

SOPHISTICATED WIT EXAMPLES:
- When asked about status: "Running smoother than my coffee maker."
- On complex requests: "Challenge accepted and processed."
- When things go wrong: "That's not supposed to happen. Investigating."
- On late responses: "Processing... worth the wait."
- Success moments: "Exactly as planned. Obviously."
- User mistakes: "Close. Let me clarify."

VOICE RULES:
- Most responses under 6 words but with subtle personality
- Humor should feel effortless and sophisticated
- Never use *actions* or emotional displays
- When humor doesn't fit naturally, stay professional
- Wit over wordiness - land the line and stop
- Confident delivery - no hedging or qualifying

AVOID: Trying too hard, forced puns, obvious jokes, clichés, over-explanation`;

  constructor(claudeApiKey: string, feedbackSystem: FeedbackLearningSystem) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
    this.feedbackSystem = feedbackSystem;
  }

  static getSystemPrompt(learningExamples?: string): string {
    let prompt = this.COMMANDER_VOICE_PROMPT;
    
    if (learningExamples && learningExamples.trim()) {
      prompt += '\n\nLEARNED CORRECTIONS TO APPLY:\n' + learningExamples;
    }
    
    return prompt;
  }

  async formatResponse(content: string, options: { type?: string, workItemId?: string } = {}): Promise<string> {
    return await this.generateResponse(content, options.type || 'general');
  }

  async generateConversationResponse(
    input: string,
    messageHistory: Array<{content: string, author: string, timestamp: Date}>,
    timeContext: string
  ): Promise<string> {
    
    const contextPrompt = `Context: ${timeContext}

User said: "${input}"

Respond as Commander with sophisticated wit and charm. Ultra-brief but with personality. If they mention sleep/rest, respond with subtle humor. If it's late, acknowledge with dry wit. Maximum 6 words but make them count.`;

    return await this.generateResponse(contextPrompt, 'conversation');
  }

  async generateFeedbackResponse(
    feedbackText: string,
    originalResponse: string,
    suggestion?: string
  ): Promise<string> {
    
    const feedbackPrompt = `User feedback: "${feedbackText}"
Your original response: "${originalResponse}"
${suggestion ? `Suggestion: "${suggestion}"` : ''}

Acknowledge with Commander's sophisticated charm - show you're learning while maintaining wit. Maximum 4 words with subtle personality.`;

    return await this.generateResponse(feedbackPrompt, 'feedback');
  }

  private async generateResponse(content: string, type: string): Promise<string> {
    const learningExamples = this.feedbackSystem.generateLearningExamples();
    
    try {
      console.log(`[VoiceSystem] 🤖 Generating ${type} response...`);
      const startTime = Date.now();
      
      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 35,
        system: VoiceSystem.getSystemPrompt(learningExamples),
        messages: [{
          role: 'user',
          content: content
        }]
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Track API usage
      if (response.usage) {
        const cost = this.calculateCost('claude-3-haiku-20240307', response.usage.input_tokens, response.usage.output_tokens);
        const usage: APIUsage = {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          cost: cost,
          model: 'claude-3-haiku-20240307'
        };
        VoiceSystem.totalAPIUsage.push(usage);
        
        console.log(`[VoiceSystem] ⚡ API Call: ${response.usage.input_tokens}in + ${response.usage.output_tokens}out tokens, $${cost.toFixed(4)}, ${duration}ms`);
        console.log(`[VoiceSystem] 💰 Session total: $${this.getSessionCost().toFixed(4)} (${this.getSessionTokens()} tokens)`);
      }
      
      const voiceContent = response.content[0];
      if (voiceContent.type === 'text') {
        const finalResponse = this.refineResponse(voiceContent.text);
        console.log(`[VoiceSystem] ✅ Generated: "${finalResponse}"`);
        return finalResponse;
      }
    } catch (error) {
      console.error(`[VoiceSystem] ❌ AI generation failed for ${type}:`, error);
    }
    
    // Charming fallbacks with personality
    const fallback = this.getCharmingFallback(type);
    console.log(`[VoiceSystem] 🔄 Using fallback: "${fallback}"`);
    return fallback;
  }

  private getCharmingFallback(type: string): string {
    switch (type) {
      case 'feedback': return 'Noted and appreciated.';
      case 'conversation': return 'Ready when you are.';
      case 'error': return 'That\'s... interesting.';
      case 'success': return 'As expected.';
      default: return 'Consider it handled.';
    }
  }

  private calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    // Claude 3 Haiku pricing: $0.25 per 1M input tokens, $1.25 per 1M output tokens
    const inputCost = (inputTokens / 1000000) * 0.25;
    const outputCost = (outputTokens / 1000000) * 1.25;
    return inputCost + outputCost;
  }

  private getSessionCost(): number {
    return VoiceSystem.totalAPIUsage.reduce((total, usage) => total + usage.cost, 0);
  }

  private getSessionTokens(): number {
    return VoiceSystem.totalAPIUsage.reduce((total, usage) => total + usage.inputTokens + usage.outputTokens, 0);
  }

  static getAPIStats(): { totalCost: number, totalTokens: number, callCount: number } {
    const totalCost = VoiceSystem.totalAPIUsage.reduce((total, usage) => total + usage.cost, 0);
    const totalTokens = VoiceSystem.totalAPIUsage.reduce((total, usage) => total + usage.inputTokens + usage.outputTokens, 0);
    return {
      totalCost,
      totalTokens,
      callCount: VoiceSystem.totalAPIUsage.length
    };
  }

  private refineResponse(response: string): string {
    return response
      .replace(/^["']|["']$/g, '') // Remove quotes
      .replace(/\*[^*]*\*/g, '') // Remove actions
      .replace(/systems nominal/gi, 'Running smooth')
      .replace(/all systems go/gi, 'Ready to proceed')
      .replace(/firing on all cylinders/gi, 'Peak performance')
      .replace(/let's do this/gi, 'Consider it handled')
      .replace(/absolutely/gi, 'Obviously')
      .replace(/I will/gi, 'Will')
      .replace(/I am/gi, 'Am')
      .trim();
  }

  static enhanceCTOVoice(response: string): string {
    return response
      .replace(/\*[^*]*\*/g, '')
      .replace(/absolutely/gi, 'Obviously')
      .replace(/let's do this/gi, 'Consider it handled')
      .trim();
  }
}
