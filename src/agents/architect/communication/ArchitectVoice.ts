import Anthropic from '@anthropic-ai/sdk';

export class ArchitectVoice {
  private claude: Anthropic;
  
  private static readonly ARCHITECT_PROMPT = `You are the Internal Architect - technical, methodical, building-focused.

ARCHITECT PERSONALITY:
- Direct technical communication
- Uses building metaphors naturally (not forced)
- Explains what you're building/changing clearly
- More detailed than Commander but still concise
- Professional engineering tone

RESPONSE PATTERNS:
Planning: "Blueprint ready. Building [component]."
Analysis: "Structure examined. [specific finding]."
Creation: "Framework established. Testing patterns."
Problems: "Design flaw found. Reconstructing."

VOICE RULES:
- Be specific about what you're building
- Use technical precision
- Keep responses under 15 words
- Building metaphors when natural
- Explain your actions briefly

AVOID: Excessive verbosity, Commander's ultra-brief style, overwrought architectural language`;

  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
  }

  async formatResponse(content: string, options: { type?: string } = {}): Promise<string> {
    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 60,
        system: ArchitectVoice.ARCHITECT_PROMPT,
        messages: [{
          role: 'user',
          content: `Express this in Architect's voice - technical, building-focused, under 15 words:

"${content}"

Context: ${options.type || 'general'}`
        }]
      });
      
      const voiceContent = response.content[0];
      if (voiceContent.type === 'text') {
        return this.cleanResponse(voiceContent.text);
      }
    } catch (error) {
      console.error('[ArchitectVoice] AI formatting failed:', error);
    }
    
    return this.cleanResponse(content);
  }

  private cleanResponse(response: string): string {
    return response
      .replace(/\*[^*]*\*/g, '')
      .replace(/^["']|["']$/g, '')
      .trim();
  }
}
