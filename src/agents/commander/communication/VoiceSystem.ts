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
    const learningExamples = this.feedbackSystem.generateLearningExamples();
    
    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 80,
        system: VoiceSystem.getSystemPrompt(learningExamples),
        messages: [{
          role: 'user',
          content: `Transform this into the Commander's voice - sharp, minimal, quietly confident:

"${content}"

Context: ${options.type || 'general'}
Make it precise and understated. Under 8 words if possible.`
        }]
      });
      
      const voiceContent = response.content[0];
      if (voiceContent.type === 'text') {
        return this.refineResponse(voiceContent.text);
      }
    } catch (error) {
      console.error('[VoiceSystem] AI formatting failed, using fallback');
    }
    
    return this.refineResponse(content);
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
    
    const learningExamples = this.feedbackSystem.generateLearningExamples();
    
    const conversationPrompt = `Context: It's ${timeContext}. You are the AI Commander system.

Recent conversation:
${recentConversation}

Current user message: "${input}"

Respond appropriately to the conversation context. Be brief, professional, and contextually aware.`;

    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 120,
        system: VoiceSystem.getSystemPrompt(learningExamples),
        messages: [{ role: 'user', content: conversationPrompt }]
      });
      
      const content = response.content[0];
      if (content.type === 'text') {
        return this.refineResponse(content.text);
      }
    } catch (error) {
      console.error('[VoiceSystem] Conversation response failed:', error);
    }
    
    return "Ready when you are.";
  }

  private refineResponse(response: string): string {
    return response
      .replace(/\*[^*]*\*/g, '')
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
