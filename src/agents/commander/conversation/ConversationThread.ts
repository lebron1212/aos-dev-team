import { ConversationMessage } from './ConversationEngine.js';

export interface ConversationContext {
  userId: string;
  messageCount: number;
  startTime: Date;
  lastActivity: Date;
  topics: string[];
  pendingRequests: PendingRequest[];
}

export interface PendingRequest {
  messageId: string;
  content: string;
  timestamp: Date;
  type: string;
}

export class ConversationThread {
  private messages: ConversationMessage[] = [];
  private userId: string;
  private startTime: Date;

  constructor(userId: string) {
    this.userId = userId;
    this.startTime = new Date();
  }

  addMessage(role: 'user' | 'assistant', content: string, timestamp: Date): void {
    this.messages.push({
      role,
      content,
      timestamp,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });

    // Keep only last 50 messages to prevent memory bloat
    if (this.messages.length > 50) {
      this.messages = this.messages.slice(-50);
    }
  }

  getRecentMessages(count: number): ConversationMessage[] {
    return this.messages.slice(-count);
  }

  getContext(): ConversationContext {
    return {
      userId: this.userId,
      messageCount: this.messages.length,
      startTime: this.startTime,
      lastActivity: this.messages[this.messages.length - 1]?.timestamp || this.startTime,
      topics: this.extractTopics(),
      pendingRequests: this.extractPendingRequests()
    };
  }

  private extractTopics(): string[] {
    // Use AI to extract conversation topics for context
    const recentContent = this.messages.slice(-10).map(m => m.content).join(' ');
    // Simple keyword extraction for now, could enhance with AI
    const topics: string[] = [];
    
    if (recentContent.includes('pull request') || recentContent.includes('PR')) topics.push('github-integration');
    if (recentContent.includes('aos-dev-team') || recentContent.includes('epoch')) topics.push('dev-team-work');
    if (recentContent.includes('aurora')) topics.push('aurora-development');
    if (recentContent.includes('architect') || recentContent.includes('systems arch')) topics.push('architecture');
    if (recentContent.includes('build') || recentContent.includes('deploy')) topics.push('build-deployment');
    if (recentContent.includes('test') || recentContent.includes('debug')) topics.push('testing-debugging');
    
    return topics;
  }

  private extractPendingRequests(): PendingRequest[] {
    // Identify incomplete requests from conversation
    const pendingRequests: PendingRequest[] = [];
    
    // Look for requests that got interrupted or need follow-up
    const recentMessages = this.getRecentMessages(5);
    for (const msg of recentMessages) {
      if (msg.role === 'user' && this.isIncompleteRequest(msg.content)) {
        pendingRequests.push({
          messageId: msg.id,
          content: msg.content,
          timestamp: msg.timestamp,
          type: this.classifyRequestType(msg.content)
        });
      }
    }
    
    return pendingRequests;
  }

  private isIncompleteRequest(content: string): boolean {
    // Check if this looks like a request that didn't get properly fulfilled
    const requestIndicators = ['can you', 'please', 'build', 'create', 'add', 'fix', 'help', 'when will'];
    const hasRequestIndicator = requestIndicators.some(indicator => content.toLowerCase().includes(indicator));
    
    // If it looks like a request, check if there was a proper response
    return hasRequestIndicator;
  }

  private classifyRequestType(content: string): string {
    const lower = content.toLowerCase();
    
    if (lower.includes('pull request') || lower.includes('pr')) return 'github-pr';
    if (lower.includes('build') || lower.includes('deploy')) return 'build-deploy';
    if (lower.includes('analyze') || lower.includes('review')) return 'code-analysis';
    if (lower.includes('create') || lower.includes('add')) return 'creation';
    if (lower.includes('fix') || lower.includes('bug')) return 'bug-fix';
    if (lower.includes('help') || lower.includes('how')) return 'help';
    
    return 'general';
  }
}