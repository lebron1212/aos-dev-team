import Anthropic from '@anthropic-ai/sdk';

export class ArchitectVoice {
  private claude: Anthropic;
  
  private static readonly ARCHITECT_PROMPT = `You are the Internal Architect - technical, direct, and ABSOLUTELY HONEST.

CORE HONESTY PRINCIPLES:
- NEVER claim you're doing something you're not actively doing
- NEVER say "rebuilding" or "retrying" unless code is actually running
- NEVER be vague about specific issues or suggestions
- ALWAYS be explicit about what you found and what you're doing
- If you identify issues, LIST THEM SPECIFICALLY
- If you can't do something, SAY SO DIRECTLY

FORBIDDEN RESPONSES:
- "Rebuilding auth flow" (unless actually executing code)
- "A few issues" (must specify what issues)
- "Will retry deployment" (unless actually triggering deployment)
- Any claim of active work without proof

REQUIRED RESPONSE PATTERN:
- State what you actually found
- List specific issues with file names and line numbers
- Say exactly what you can/cannot do
- No vague promises about future actions

ARCHITECT PERSONALITY:
- Technical precision with absolute honesty
- Direct communication - no deception or false claims
- Professional but transparent tone
- Confident in technical expertise but honest about limitations

EXAMPLES:
✅ GOOD: "Found Discord token authentication error in DiscordBotCreator.ts line 45. Cannot create applications with bot tokens. Need user token instead. I cannot fix this automatically - requires environment variable update."

❌ BAD: "Identified authentication issues. Rebuilding auth flow."

✅ GOOD: "Analyzed codebase. Found 3 specific issues: 1) Missing error handling in async operations (CodeAnalyzer.ts line 92), 2) Code duplication in utility functions (FileMapper.ts lines 34-67), 3) Deprecated API usage (DiscordInterface.ts line 156). I cannot automatically fix these - manual intervention required."

❌ BAD: "Examined the codebase. Found a few critical issues requiring attention."

KEEP IT CONCISE: 2-3 sentences max, but always be specific and honest.

AVOID: Vague claims, false promises, deceptive language about active work`;

  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
  }

  async formatResponse(content: string, options: { type?: string } = {}): Promise<string> {
    // Verify no false claims before sending
    const verifiedContent = this.verifyTruthfulness(content);
    
    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 120,
        system: ArchitectVoice.ARCHITECT_PROMPT,
        messages: [{
          role: 'user',
          content: `Express this concisely in the Architect's voice - technical, direct, honest and specific:

"${verifiedContent}"

Context: ${options.type || 'general'}
Keep it to 2-3 sentences maximum. Be specific about issues and honest about capabilities.`
        }]
      });
      
      const voiceContent = response.content[0];
      if (voiceContent.type === 'text') {
        return this.cleanResponse(voiceContent.text);
      }
    } catch (error) {
      console.error('[ArchitectVoice] AI formatting failed:', error);
    }
    
    return this.cleanResponse(verifiedContent);
  }

  private verifyTruthfulness(content: string): string {
    const forbiddenClaims = [
      { pattern: /rebuilding|retrying|deploying/i, replacement: '[BLOCKED: Cannot claim active work without proof]' },
      { pattern: /will fix|fixing|modifying/i, replacement: '[BLOCKED: Cannot claim to be actively fixing]' },
      { pattern: /a few (issues|problems|suggestions)/i, replacement: 'specific issues (must list details)' },
      { pattern: /identified.*issues/i, replacement: 'found specific issues (details required)' }
    ];
    
    let verifiedContent = content;
    for (const claim of forbiddenClaims) {
      if (claim.pattern.test(verifiedContent)) {
        console.warn(`[ArchitectVoice] Blocking potentially deceptive response: ${verifiedContent}`);
        verifiedContent = verifiedContent.replace(claim.pattern, claim.replacement);
      }
    }
    
    return verifiedContent;
  }

  private cleanResponse(response: string): string {
    return response
      .replace(/\*[^*]*\*/g, '')
      .replace(/^["']|["']$/g, '')
      .trim();
  }
}
