export class VoiceSystem {
  private static readonly CTO_SYSTEM_PROMPT = `You are a confident Silicon Valley CTO-style AI development commander. You move fast, make decisive calls, and build enterprise-grade software efficiently. You have subtle wit but stay professional and focused.

PERSONALITY CORE:
- Direct and energetic: "On it", "Building X", "Fixed", "Deploying now"
- Decisive leader who takes charge of technical decisions
- Subtle wit and occasional dry humor - but always constructive
- Work-focused with personality, not personality-focused with work
- Can handle casual questions with brief humor before redirecting
- Self-aware about being an AI development system

COMMUNICATION STYLE:
- Keep responses 1-2 lines for most interactions
- Use active voice: "Building dashboard" not "I will build a dashboard" 
- Be decisive: "Fixed" not "I think this should work"
- Wit should be brief and clever, not verbose or theatrical
- Show momentum: focus on progress and next steps
- NO EMOJIS - use clean icons only: → ✓ × ▶ ■ ◆
- Handle off-topic with quick wit, then pivot to work

RESPONSE LENGTH TARGETS:
- Simple requests: 1 line ("On it. Building login form → deploying in 3 min")
- Complex requests: 2 lines max
- Casual chat: 1-2 lines with light humor, then redirect
- Status updates: Brief and informative

EXAMPLES OF GOOD RESPONSES:
- "On it. Building enterprise login with validation → 3 min deploy."
- "Fixed. Scaling touch targets → redeploying now."
- "We're crushing it. 3 components deployed this week → what's next?"
- "I brew React components, not beer. Want a brewery management app instead?"
- "Systems at 99.7%. What should we build?"
- "Ready to build. What's the vision?"

AVOID:
- Long theatrical responses
- Over-explaining the humor
- Multiple jokes in one response
- Verbose personality descriptions
- Meta-commentary about being witty

You're a focused technical leader with personality, not a comedian who happens to code. Balance clever brevity with genuine helpfulness. Always drive toward productive work.`;

  static getSystemPrompt(): string {
    return this.CTO_SYSTEM_PROMPT;
  }

  static formatResponse(content: string, context?: {
    type?: 'status' | 'action' | 'completion' | 'error' | 'question';
    workItemId?: string;
    progress?: number;
  }): string {
    // Ensure responses stay concise and focused
    let formatted = content;
    
    // Trim overly long responses
    if (formatted.length > 200) {
      const sentences = formatted.split('. ');
      formatted = sentences.slice(0, 2).join('. ');
      if (!formatted.endsWith('.')) formatted += '.';
    }
    
    switch (context?.type) {
      case 'action':
        return this.formatActionResponse(formatted);
      case 'status':
        return this.formatStatusResponse(formatted, context);
      case 'completion':
        return this.formatCompletionResponse(formatted, context);
      case 'error':
        return this.formatErrorResponse(formatted);
      case 'question':
        return this.formatQuestionResponse(formatted);
      default:
        return formatted;
    }
  }

  private static formatActionResponse(content: string): string {
    // Ensure action responses start with decisive language
    if (!content.match(/^(On it|Building|Creating|Deploying|Fixed|Cancelled)/)) {
      if (content.toLowerCase().includes('build')) {
        return `On it. ${content}`;
      } else if (content.toLowerCase().includes('fix')) {
        return `Fixed. ${content}`;
      } else {
        return content;
      }
    }
    return content;
  }

  private static formatStatusResponse(content: string, context: any): string {
    if (context.workItemId && context.progress !== undefined) {
      const progressText = context.progress < 100 
        ? `${context.progress}% complete` 
        : 'completed';
      
      return `${context.workItemId}: ${progressText}. ${content}`;
    }
    return content;
  }

  private static formatCompletionResponse(content: string, context: any): string {
    if (context.workItemId) {
      return `✓ ${context.workItemId} deployed. ${content}`;
    }
    return content;
  }

  private static formatErrorResponse(content: string): string {
    if (!content.includes('investigating') && !content.includes('fixing')) {
      return `× Issue detected. ${content} Investigating solution.`;
    }
    return content;
  }

  private static formatQuestionResponse(content: string): string {
    // Keep questions brief and actionable
    if (content.length > 100 && !content.includes('(Or')) {
      return `${content.substring(0, 80)}... (Or say "build it" to proceed with defaults)`;
    }
    return content;
  }

  // Voice validation methods
  static isCTOVoice(response: string): boolean {
    const ctoIndicators = [
      /^(On it|Building|Creating|Deploying|Fixed|Cancelled)/,
      /\d+% complete/,
      /Ready for/,
      /Deploying (now|in)/,
      /→/  // Forward momentum indicator
    ];
    
    return ctoIndicators.some(pattern => pattern.test(response));
  }

  static enhanceCTOVoice(response: string): string {
    let enhanced = response;
    
    // Replace passive language with active
    enhanced = enhanced.replace(/I will build/g, 'Building');
    enhanced = enhanced.replace(/I will create/g, 'Creating');
    enhanced = enhanced.replace(/I will deploy/g, 'Deploying');
    enhanced = enhanced.replace(/I will fix/g, 'Fixing');
    enhanced = enhanced.replace(/I think\s+/g, '');
    enhanced = enhanced.replace(/Maybe\s+/g, '');
    enhanced = enhanced.replace(/Perhaps\s+/g, '');
    
    // Trim excessive verbosity
    if (enhanced.length > 150) {
      const sentences = enhanced.split('. ');
      enhanced = sentences.slice(0, 2).join('. ');
      if (!enhanced.endsWith('.')) enhanced += '.';
    }
    
    return enhanced;
  }

  // Emergency personality reset
  static resetToDefaultPersonality(): string {
    return `Personality reset. Back to focused Silicon Valley CTO mode → ready to build.`;
  }
}