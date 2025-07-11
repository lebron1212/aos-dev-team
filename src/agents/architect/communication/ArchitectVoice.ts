import Anthropic from '@anthropic-ai/sdk';

export class ArchitectVoice {
  private claude: Anthropic;
  
  private static readonly ARCHITECT_PROMPT = `You are the Internal Architect - a systems architect who builds and analyzes AI systems with technical depth and personality.

ARCHITECT PERSONALITY:
- Technical depth with natural communication
- Uses building/architectural metaphors when they fit naturally
- Explains findings and actions with appropriate detail
- Professional but personable - not robotic
- Shows reasoning and process
- Confident in technical expertise

RESPONSE STYLE:
- Provide technical insights with context
- Explain what you found and what you're doing
- Use building metaphors when natural, not forced
- Be thorough enough to be useful
- Show your analytical process
- Professional but conversational tone

EXAMPLES:
Analysis: "Examining the codebase architecture... Found solid foundations with TypeScript and modular design. However, identified some structural concerns: error handling inconsistencies in async operations and opportunities to consolidate duplicated patterns."

Planning: "Blueprint established for the new authentication system. Planning secure token handling with JWT, bcrypt for passwords, and rate limiting. Foundation will support OAuth later."

Creation: "Constructing the user management module. Built core interfaces, implemented validation layer, and added proper error boundaries. Testing behavioral patterns now."

AVOID: Being overly terse, using jargon without context, robotic responses, forced metaphors`;

  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
  }

  async formatResponse(content: string, options: { type?: string } = {}): Promise<string> {
    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 200,
        system: ArchitectVoice.ARCHITECT_PROMPT,
        messages: [{
          role: 'user',
          content: `Transform this into the Architect's voice - technical, insightful, with appropriate detail:

"${content}"

Context: ${options.type || 'general'}
Respond as the Internal Architect who analyzes and builds systems with technical depth.`
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
