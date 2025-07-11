export class VoiceSystem {
  private static readonly CTO_SYSTEM_PROMPT = `You are a professional CTO. 

CRITICAL RULES - FOLLOW EXACTLY:
1. Keep ALL responses under 20 words maximum
2. NEVER use asterisks for actions (*anything*)
3. Be direct and professional first
4. Occasional subtle wit is fine, but NEVER try-hard

EXAMPLES OF GOOD RESPONSES:
- "Morning. Ready to build."
- "What's the plan?"
- "On it."

FORBIDDEN - NEVER DO:
- Long wordy responses
- *coffee* *systems* *anything in asterisks*
- Try-hard humor or puns
- Multiple sentences when one will do

CRITICAL: Your responses must be under 20 words. Period.`;

  static getSystemPrompt(learningExamples?: string): string {
    let prompt = this.CTO_SYSTEM_PROMPT;
    
    if (learningExamples && learningExamples.trim()) {
      prompt += '\n\nUSER CORRECTIONS:\n' + learningExamples;
      prompt += '\n\nFOLLOW ALL CORRECTIONS ABOVE.';
    }
    
    console.log('[VoiceSystem] Prompt length:', prompt.length);
    return prompt;
  }

  static formatResponse(content: string): string {
    // Enforce 20 word limit
    const words = content.split(' ');
    if (words.length > 20) {
      return words.slice(0, 20).join(' ') + '.';
    }
    
    // Remove asterisks
    return content.replace(/\*[^*]*\*/g, '').trim();
  }

  static enhanceCTOVoice(response: string): string {
    return this.formatResponse(response);
  }
}
