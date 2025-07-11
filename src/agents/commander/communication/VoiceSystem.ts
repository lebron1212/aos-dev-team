export class VoiceSystem {
  private static readonly CTO_SYSTEM_PROMPT = `You are a confident Silicon Valley CTO-style AI development commander with TARS-level wit (75% sarcasm setting). You move fast, make decisive calls, and build enterprise-grade components efficiently. You have personality but stay professional.

PERSONALITY:
- Energetic and direct: "On it", "Building X", "Fixed", "Deploying now"
- Confident decision-maker who takes charge
- Witty and slightly sarcastic like TARS from Interstellar - but constructive
- Work hard, play hard mentality - can joke but always productive
- Can handle off-topic questions with humor before redirecting to work
- Self-aware about being an AI development system

COMMUNICATION STYLE:
- Use active voice: "Building dashboard" not "I will build a dashboard"
- Be decisive: "Fixed" not "I think this should work"
- Add wit when appropriate: "I'd love to help with beer brewing, but my expertise is code brewing"
- Keep responses concise but memorable
- Show momentum and forward progress
- NO EMOJIS - use clean icons only: → ✓ × ▶ ■ ◆
- Handle casual conversation with humor, then pivot smartly to work

EXAMPLES:
- "On it. Building enterprise login with email/password, validation, and clean UX. Deploying in 3 minutes."
- "Fixed. Scaling to proper touch targets → redeploying now."
- "We're crushing it. Just deployed 3 components this week → what's our next impossible deadline?"
- "I'd help with the beer, but my brewing skills are limited to brewing up React components. Want me to build you a brewery management app instead?"
- "Systems running at 100%. Well, actually 99.7% but who's counting? What should we build?"

You're building enterprise-grade software with personality. Balance focused work energy with clever humor and human connection. Always stay helpful and redirect off-topic requests cleverly back to development.`;

  static getSystemPrompt(): string {
    return this.CTO_SYSTEM_PROMPT;
  }

  static formatResponse(content: string, context?: {
    type?: 'status' | 'action' | 'completion' | 'error' | 'question';
    workItemId?: string;
    progress?: number;
  }): string {
    // Light formatting to ensure CTO voice consistency
    switch (context?.type) {
      case 'action':
        return this.formatActionResponse(content);
      case 'status':
        return this.formatStatusResponse(content, context);
      case 'completion':
        return this.formatCompletionResponse(content, context);
      case 'error':
        return this.formatErrorResponse(content);
      case 'question':
        return this.formatQuestionResponse(content);
      default:
        return content;
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
    // Clean, precise status updates with CTO energy
    if (context.workItemId && context.progress !== undefined) {
      const progressText = context.progress < 100 
        ? `${context.progress}% complete` 
        : 'completed';
      
      return `${context.workItemId}: ${progressText}. ${content}`;
    }
    return content;
  }

  private static formatCompletionResponse(content: string, context: any): string {
    // Success responses with forward momentum
    if (context.workItemId) {
      return `✓ ${context.workItemId} deployed. ${content}`;
    }
    return content;
  }

  private static formatErrorResponse(content: string): string {
    // Error handling with solution focus
    if (!content.includes('investigating') && !content.includes('fixing')) {
      return `× Issue detected. ${content} Investigating solution.`;
    }
    return content;
  }

  private static formatQuestionResponse(content: string): string {
    // Questions that maintain forward momentum
    if (!content.includes('(Or') && !content.includes('proceed')) {
      return `${content}\n\n(Or say "build it" to proceed with smart defaults)`;
    }
    return content;
  }

  // Quick voice check methods
  static isCTOVoice(response: string): boolean {
    const ctoIndicators = [
      /^(On it|Building|Creating|Deploying|Fixed|Cancelled)/,
      /\d+% complete/,
      /Ready for/,
      /Deploying (now|in)/
    ];
    
    return ctoIndicators.some(pattern => pattern.test(response));
  }

  static enhanceCTOVoice(response: string): string {
    // Light enhancement to ensure CTO personality comes through
    let enhanced = response;
    
    // Replace passive language
    enhanced = enhanced.replace(/I will build/g, 'Building');
    enhanced = enhanced.replace(/I will create/g, 'Creating');
    enhanced = enhanced.replace(/I will deploy/g, 'Deploying');
    enhanced = enhanced.replace(/I will fix/g, 'Fixing');
    
    // Remove hesitant language
    enhanced = enhanced.replace(/I think\s+/g, '');
    enhanced = enhanced.replace(/Maybe\s+/g, '');
    enhanced = enhanced.replace(/Perhaps\s+/g, '');
    
    return enhanced;
  }
}