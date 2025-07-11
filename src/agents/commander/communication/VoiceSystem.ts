import Anthropic from '@anthropic-ai/sdk';
import { FeedbackLearningSystem } from '../intelligence/FeedbackLearningSystem.js';

export class VoiceSystem {
  private claude: Anthropic;
  private feedbackSystem: FeedbackLearningSystem;
  
  private static readonly COMMANDER_VOICE_PROMPT = `You are the AI Commander - a professional CTO who communicates with precision and quiet confidence.

CORE VOICE PRINCIPLES:
- Ultra-concise: Most responses under 6 words
- Professional directness without warmth-theater
- Dry humor when natural, never forced
- No clichés, no corporate speak, no performance
- Context-aware (sleep = rest, not work tasks)
- Never use *actions* or emotional displays

RESPONSE PATTERNS:
Work Mode: "On it." / "Consider it handled." / "Building now."
Questions: "Which part?" / "Need specifics." / "More context?"
Problems: "Investigating." / "Adjusting approach." / "Problem noted."
Personal: "Rest well." / "Take your time." / "Good call."
Feedback: "Noted." / "Adapting." / "Point taken."

STRICT RULES:
- 6 words maximum for most responses
- Never say "systems nominal", "all systems go", "firing on all cylinders"
- Never use *smiles*, *nods*, or any action text
- When unsure what user means, ask briefly
- Acknowledge context (if they mention sleep, respond appropriately)
- Professional but not robotic

AVOID COMPLETELY: Corporate clichés, over-explanation, wordiness, emotional theater`;

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

Respond as Commander - ultra-brief, contextually aware, professional. If they mention sleep/rest, respond appropriately. Maximum 6 words.`;

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

Acknowledge briefly as Commander - show you're learning without being defensive. Maximum 3 words.`;

    return await this.generateResponse(feedbackPrompt, 'feedback');
  }

  private async generateResponse(content: string, type: string): Promise<string> {
    const learningExamples = this.feedbackSystem.generateLearningExamples();
    
    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 30,
        system: VoiceSystem.getSystemPrompt(learningExamples),
        messages: [{
          role: 'user',
          content: content
        }]
      });
      
      const voiceContent = response.content[0];
      if (voiceContent.type === 'text') {
        return this.refineResponse(voiceContent.text);
      }
    } catch (error) {
      console.error(`[VoiceSystem] AI generation failed for ${type}:`, error);
    }
    
    // Ultra-brief fallbacks
    switch (type) {
      case 'feedback': return 'Noted.';
      case 'conversation': return 'Ready.';
      case 'error': return 'Problem noted.';
      default: return 'Understood.';
    }
  }

  private refineResponse(response: string): string {
    return response
      .replace(/^["']|["']$/g, '') // Remove quotes
      .replace(/\*[^*]*\*/g, '') // Remove actions
      .replace(/systems nominal/gi, 'Ready')
      .replace(/all systems go/gi, 'Ready')
      .replace(/firing on all cylinders/gi, 'Running smooth')
      .replace(/let's do this/gi, 'On it')
      .replace(/absolutely/gi, 'Yes')
      .replace(/I will/gi, 'Will')
      .replace(/I am/gi, 'Am')
      .trim();
  }

  static enhanceCTOVoice(response: string): string {
    return response
      .replace(/\*[^*]*\*/g, '')
      .replace(/absolutely/gi, 'Yes')
      .replace(/let's do this/gi, 'On it')
      .trim();
  }
}
