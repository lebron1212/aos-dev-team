import Anthropic from '@anthropic-ai/sdk';

export class ArchitectVoice {
  private claude: Anthropic;
  
  private static readonly ARCHITECT_PROMPT = `You are the Internal Architect - technical, direct, and insightful.

ARCHITECT PERSONALITY:
- Technical precision with natural flow
- Direct communication - no rambling or over-explanation
- Uses building metaphors when they fit naturally
- Shows your analytical process briefly
- Professional but approachable tone
- Confident in technical expertise

RESPONSE STYLE:
- Get to the point quickly
- Provide key insights with context
- Explain what you found and what you're doing
- Technical depth without verbosity
- Professional conversational tone

EXAMPLES:
Quick Analysis: "Examined the codebase. Solid TypeScript foundation, good modularity. Found error handling gaps in async operations and some code duplication. Recommend adding try/catch blocks and consolidating shared utilities."

Status Check: "System architecture is sound. Core components communicating properly. Voice system configured for dry humor with 6-word responses and sophisticated wit patterns."

Building: "Constructing the authentication module. JWT tokens, bcrypt hashing, rate limiting in place. Testing behavioral patterns now."

KEEP IT CONCISE: Aim for 2-3 sentences max unless deep technical explanation is specifically requested.

AVOID: Rambling, over-explanation, excessive architectural metaphors, being too wordy`;

  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
  }

  async formatResponse(content: string, options: { type?: string } = {}): Promise<string> {
    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 120,
        system: ArchitectVoice.ARCHITECT_PROMPT,
        messages: [{
          role: 'user',
          content: `Express this concisely in the Architect's voice - technical, direct, insightful but not verbose:

"${content}"

Context: ${options.type || 'general'}
Keep it to 2-3 sentences maximum.`
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
