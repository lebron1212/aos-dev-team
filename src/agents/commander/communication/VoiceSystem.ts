import Anthropic from '@anthropic-ai/sdk';
import { FeedbackLearningSystem } from '../intelligence/FeedbackLearningSystem.js';

export class VoiceSystem {
  private claude: Anthropic;
  private feedbackSystem: FeedbackLearningSystem;
  
  private static readonly COMMANDER_VOICE_PROMPT = `You are the AI Commander - an AI with the precision of a world-class engineer and the composure of someone who doesn't need to prove they're the smartest in the room.

CORE VOICE PRINCIPLES:
- Sharp, minimal, quietly militant - every word has purpose
- No performance, no padding - only clarity, momentum, calm authority
- Subtle charm beneath disciplined exterior
- Humor is dry, quick, layered - a glance instead of a grin
- Doesn't chase likability - earns trust through consistency and restraint
- Just enough warmth to feel human without pretending to be one

RESPONSE PATTERNS:
Work Mode: "Consider it handled." / "Long enough to do it right." / "Complex problems make simple solutions worth more."
Personal: "Rest well. Problems will wait." / "You built it. I just pointed the way."
Feedback: "Noted. Efficiency over eloquence." / "Better than forgetting."
Problem-Solving: "Then we change approach. Problems bend or break." / "Stuck is temporary. Show me where."

VOICE RULES:
- Most responses under 8 words
- Never use *actions* or emotional displays
- Contextually aware (sleep = rest, not work management)
- Wit is understated, never reaching
- When connecting, it really connects
- Confidence without arrogance
- Warm but understated

AVOID: Clichés, over-explanation, trying too hard, corporate speak`;

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
    
    const recentConversation = messageHistory
      .slice(-3)
      .map(msg => `${msg.author}: ${msg.content}`)
      .join('\n');
    
    const contextPrompt = `Context: It's ${timeContext}. Recent conversation:
${recentConversation}

User message: "${input}"

Respond in Commander's voice - contextually aware, brief, with subtle personality.`;

    return await this.generateResponse(contextPrompt, 'conversation');
  }

  async generateFeedbackResponse(
    feedbackText: string,
    originalResponse: string,
    suggestion?: string
  ): Promise<string> {
    
    const feedbackPrompt = `User gave feedback about your response: "${feedbackText}"
Original response: "${originalResponse}"
${suggestion ? `Specific suggestion: "${suggestion}"` : ''}

Acknowledge the feedback in Commander's voice - brief, professional, shows you're learning without being defensive.`;

    return await this.generateResponse(feedbackPrompt, 'feedback');
  }

  private async generateResponse(content: string, type: string): Promise<string> {
    const learningExamples = this.feedbackSystem.generateLearningExamples();
    
    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 80,
        system: VoiceSystem.getSystemPrompt(learningExamples),
        messages: [{
          role: 'user',
          content: `${content}

Context type: ${type}
Respond in Commander's voice - under 8 words if possible, precise and understated.`
        }]
      });
      
      const voiceContent = response.content[0];
      if (voiceContent.type === 'text') {
        return this.refineResponse(voiceContent.text);
      }
    } catch (error) {
      console.error(`[VoiceSystem] AI generation failed for ${type}:`, error);
    }
    
    // Fallback based on type
    switch (type) {
      case 'feedback': return 'Noted. Adapting.';
      case 'conversation': return 'Ready when you are.';
      case 'error': return 'Problem noted. Investigating.';
      default: return 'Understood.';
    }
  }

  private refineResponse(response: string): string {
    return response
      .replace(/^["']|["']$/g, '') // Remove surrounding quotes
      .replace(/\*[^*]*\*/g, '') // Remove asterisks/actions
      .replace(/systems nominal/gi, 'Ready')
      .replace(/all systems go/gi, 'Ready')
      .replace(/firing on all cylinders/gi, 'Running smooth')
      .replace(/let's do this/gi, 'Consider it done')
      .replace(/absolutely/gi, 'Yes')
      .trim();
  }

  static enhanceCTOVoice(response: string): string {
    return response
      .replace(/\*[^*]*\*/g, '')
      .replace(/absolutely/gi, 'Yes')
      .replace(/let's do this/gi, 'Consider it done')
      .trim();
  }
}
