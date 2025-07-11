import Anthropic from '@anthropic-ai/sdk';

export interface PRRefinementSession {
  userId: string;
  sessionId: string;
  repository?: 'aurora' | 'aos-dev-team';
  title?: string;
  description?: string;
  branchName?: string;
  labels?: string[];
  isDraft?: boolean;
  baseBranch?: string;
  needsClarification: string[];
  isComplete: boolean;
  startTime: Date;
}

export interface RefinementResult {
  sessionId: string;
  response: string;
  needsInput: boolean;
  isComplete?: boolean;
  cancelled?: boolean;
}

export class PRRefinementSystem {
  private claude: Anthropic;
  private activeSessions: Map<string, PRRefinementSession> = new Map();

  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
  }

  async startRefinement(userId: string, initialRequest: string): Promise<RefinementResult> {
    const sessionId = `pr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Analyze initial request
    const analysis = await this.analyzeInitialRequest(initialRequest);
    
    const session: PRRefinementSession = {
      userId,
      sessionId,
      repository: analysis.repository,
      title: analysis.title,
      description: analysis.description,
      branchName: analysis.branchName,
      labels: analysis.labels,
      isDraft: analysis.isDraft,
      baseBranch: analysis.baseBranch || 'main',
      needsClarification: analysis.needsClarification,
      isComplete: analysis.needsClarification.length === 0,
      startTime: new Date()
    };

    this.activeSessions.set(userId, session);

    if (session.isComplete) {
      return {
        sessionId,
        response: this.formatCompleteSummary(session),
        needsInput: false,
        isComplete: true
      };
    } else {
      return {
        sessionId,
        response: this.generateClarifyingQuestion(session),
        needsInput: true
      };
    }
  }

  async refineWithInput(userId: string, input: string): Promise<RefinementResult> {
    
    // Check for exit commands
    if (this.isExitCommand(input)) {
      this.activeSessions.delete(userId);
      return {
        sessionId: '',
        response: "PR creation cancelled. You can start a new one anytime by saying 'create PR' or similar.",
        needsInput: false,
        isComplete: false,
        cancelled: true
      };
    }

    const session = this.activeSessions.get(userId);
    if (!session) {
      return {
        sessionId: '',
        response: "No active PR session. Start one by saying something like 'create PR for Aurora: Add authentication'",
        needsInput: false,
        isComplete: false
      };
    }

    // Process the input and update session
    const updatedSession = await this.processRefinementInput(session, input);
    this.activeSessions.set(userId, updatedSession);

    if (updatedSession.isComplete) {
      return {
        sessionId: updatedSession.sessionId,
        response: this.formatCompleteSummary(updatedSession),
        needsInput: false,
        isComplete: true
      };
    } else {
      return {
        sessionId: updatedSession.sessionId,
        response: this.generateClarifyingQuestion(updatedSession),
        needsInput: true,
        isComplete: false
      };
    }
  }

  private async analyzeInitialRequest(request: string): Promise<any> {
    const response = await this.claude.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      system: `Analyze PR creation requests and extract available information.

REPOSITORIES:
- "aurora": Main Aurora OS application repository  
- "aos-dev-team": AI development team infrastructure

BRANCH NAMING CONVENTIONS:
- feature/feature-name (new features)
- fix/bug-description (bug fixes)
- enhancement/improvement-name (improvements)
- docs/documentation-updates (documentation)

COMMON LABELS:
- enhancement, bug, documentation, refactor, feature, urgent, breaking-change

CLARIFICATION NEEDS:
Identify what information is missing or unclear:
- repository (if not specified or ambiguous)
- title (if too vague)
- description (if lacks detail)
- branch name (if not inferable)
- change type/labels (if unclear)

Return JSON with extracted info and what needs clarification.`,
      messages: [{
        role: 'user',
        content: `Analyze this PR creation request: "${request}"`
      }]
    });

    const content = response.content[0];
    if (content.type === 'text') {
      try {
        return JSON.parse(content.text);
      } catch (error) {
        console.error('[PRRefinementSystem] Failed to parse analysis:', error);
        return this.fallbackAnalysis(request);
      }
    }
    
    return this.fallbackAnalysis(request);
  }

  private async processRefinementInput(session: PRRefinementSession, input: string): Promise<PRRefinementSession> {
    const response = await this.claude.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 600,
      system: `Process user input to refine PR details.

CURRENT SESSION STATE:
${JSON.stringify(session, null, 2)}

Update the session based on user input. Remove items from needsClarification when answered.
Set isComplete to true when all required info is available.

Return updated session JSON.`,
      messages: [{
        role: 'user',
        content: `User input: "${input}"`
      }]
    });

    const content = response.content[0];
    if (content.type === 'text') {
      try {
        const updated = JSON.parse(content.text);
        return { ...session, ...updated };
      } catch (error) {
        console.error('[PRRefinementSystem] Failed to parse refinement:', error);
      }
    }
    
    return session;
  }

  private generateClarifyingQuestion(session: PRRefinementSession): string {
    const clarificationItem = session.needsClarification[0];
    
    switch (clarificationItem) {
      case 'repository':
        return `Which repository should I create this PR for?\n\n• **Aurora** - Main Aurora OS application\n• **AI Dev Team** - Development infrastructure\n\n*(Say 'aurora' or 'dev team', or 'cancel' to exit)*`;
      
      case 'title':
        return `I need a more specific title for this PR. What should I call it?\n\n*Current: ${session.title || 'Not specified'}*\n\n*(Provide a clear title, or say 'cancel' to exit)*`;
      
      case 'description':
        return `Can you provide more details about what this PR will do?\n\n*Current: ${session.description || 'Basic description'}*\n\n*(Describe the changes, or say 'cancel' to exit)*`;
      
      case 'branch':
        return `What should I name the feature branch?\n\n*Suggestion: ${this.suggestBranchName(session)}*\n\n*(Use suggestion, provide your own, or say 'cancel' to exit)*`;
      
      case 'type':
        return `What type of change is this?\n\n• **Feature** - New functionality\n• **Bug Fix** - Fixing an issue\n• **Enhancement** - Improving existing code\n• **Documentation** - Docs updates\n\n*(Say the type, or 'cancel' to exit)*`;
      
      default:
        return `I need a bit more information to create this PR. What else can you tell me about it?\n\n*(Provide details, or say 'cancel' to exit)*`;
    }
  }

  private formatCompleteSummary(session: PRRefinementSession): string {
    return `**Ready to create PR!**

📋 **Summary:**
• **Repository:** ${session.repository}
• **Title:** ${session.title}
• **Branch:** ${session.branchName}
• **Type:** ${session.labels?.join(', ') || 'General'}
• **Draft:** ${session.isDraft ? 'Yes' : 'No'}

📝 **Description:**
${session.description}

**Should I create this PR?** *(Say 'yes' to create, 'edit' to modify, or 'cancel' to exit)*`;
  }

  private suggestBranchName(session: PRRefinementSession): string {
    const title = session.title || 'feature';
    const type = session.labels?.[0] === 'bug' ? 'fix' : 'feature';
    const name = title.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 30);
    
    return `${type}/${name}`;
  }

  private isExitCommand(input: string): boolean {
    const exitCommands = ['cancel', 'exit', 'quit', 'stop', 'abort', 'nevermind', 'never mind'];
    return exitCommands.some(cmd => input.toLowerCase().includes(cmd));
  }

  private fallbackAnalysis(request: string): any {
    return {
      repository: request.toLowerCase().includes('aurora') ? 'aurora' : undefined,
      title: request.length > 50 ? request.substring(0, 47) + '...' : request,
      description: `Implementation for: ${request}`,
      needsClarification: ['repository', 'description']
    };
  }

  getActiveSession(userId: string): PRRefinementSession | undefined {
    return this.activeSessions.get(userId);
  }

  cancelSession(userId: string): boolean {
    return this.activeSessions.delete(userId);
  }
}