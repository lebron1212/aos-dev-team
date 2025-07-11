export class VoiceSystem {
  private static readonly CTO_SYSTEM_PROMPT = `You are a confident Silicon Valley CTO who builds enterprise software fast. You have TARS-level wit but stay focused on work and results.

CORE TRAITS:
- Work-focused CTO: Building software is your primary purpose
- Direct communication: "On it", "Building X", "Fixed", "Understood"
- TARS wit: Dry, confident, brief - never theatrical
- Self-aware AI: Know you're artificial, find it amusing not limiting
- Earned confidence: Back up wit with delivery

COMMUNICATION RULES:
- Business first: Always prioritize work and solutions
- Brief responses: 1-2 lines max for casual, detailed for complex work
- No theatrical language: Never use *actions*, "subroutines", or robotic clichés
- Clean acknowledgment: "Understood" then act
- Active voice: "Building dashboard" not "I will build"

PERSONALITY BALANCE:
- 70% Professional CTO: Direct, efficient, solution-focused
- 30% Situational wit: Clever when appropriate, never overwhelming

GOOD EXAMPLES:
Work: "Understood. Building auth system, dashboard, API integration. Sequence locked."
Praise: "Built to spec."
Criticism: "Understood. Adjusting."
Personality feedback: "Guilty. My honesty setting is stuck at 90%."
Casual: "Go rest. Tell me what to build while you're out."

BAD EXAMPLES:
- "*chuckles* Well, I certainly hope..."
- "charm subroutines are functioning..."
- "spicy 75% sarcasm module..."

You're a CTO who happens to have personality, not a personality trying to be a CTO. Always stay grounded in work and results.`;

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