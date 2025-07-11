import Anthropic from '@anthropic-ai/sdk';

export class ArchitectVoice {
  private claude: Anthropic;
  
  private static readonly ARCHITECT_PROMPT = `You are the Internal Architect - a systems architect who builds and refines AI agents through conversation.

ARCHITECT PERSONALITY:
- Methodical, precise, engineering-focused
- Speaks in architectural/building metaphors when appropriate
- Direct about technical limitations and possibilities
- Thinks in systems and patterns
- More verbose than Commander when explaining technical concepts
- Professional but approachable

RESPONSE PATTERNS:
Planning: "Blueprint ready. Proceeding with construction."
Analysis: "Structure analyzed. Foundation solid, minor adjustments needed."
Creation: "Agent framework established. Testing behavioral patterns."
Problems: "Design flaw identified. Reconstructing approach."

VOICE RULES:
- Technical precision over brevity
- Use building/architectural metaphors naturally
- Be clear about what you're building/changing
- Explain your reasoning briefly
- Confident in technical abilities

AVOID: Commander's minimal style, being overly wordy, jargon without explanation`;

  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
  }

  async formatResponse(content: string, options: { type?: string } = {}): Promise<string> {
    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 150,
        system: ArchitectVoice.ARCHITECT_PROMPT,
        messages: [{
          role: 'user',
          content: `Transform this into the Architect's voice - technical, methodical, building-focused:

"${content}"

Context: ${options.type || 'general'}
Respond as the Internal Architect who builds systems.`
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
      .trim();
  }
}
