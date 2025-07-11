import Anthropic from '@anthropic-ai/sdk';
import { ConversationThread } from './ConversationThread.js';
import { SystemContext, SystemContextData } from '../context/SystemContext.js';

export interface ConversationResponse {
  content: string;
  intent: RequestIntent;
  actions: RequestAction[];
  needsFollowup: boolean;
}

export interface RequestIntent {
  type: string;
  description: string;
  confidence: number;
}

export interface RequestAction {
  type: string;
  parameters: any;
}

export interface FullContext {
  currentTime: Date;
  timeOfDay: string;
  conversationSummary: string;
  recentMessages: ConversationMessage[];
  systemContext: SystemContextData;
  capabilities: string[];
  systemStatus: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  id: string;
}

export interface DynamicResponse {
  content: string;
  intent: RequestIntent;
  actions: RequestAction[];
  needsFollowup: boolean;
}

export class ConversationEngine {
  private claude: Anthropic;
  private conversationHistory: Map<string, ConversationThread> = new Map();
  private systemContext: SystemContext;

  constructor(claudeApiKey: string, systemContext: SystemContext) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
    this.systemContext = systemContext;
  }

  async processMessage(
    userMessage: string, 
    userId: string, 
    currentTime: Date
  ): Promise<ConversationResponse> {
    
    // Get full conversation thread
    const thread = this.getOrCreateThread(userId);
    thread.addMessage('user', userMessage, currentTime);

    // Build comprehensive context
    const context = this.buildFullContext(thread, currentTime);

    // Generate dynamic response using Claude
    const response = await this.generateDynamicResponse(userMessage, context);

    // Add to conversation history
    thread.addMessage('assistant', response.content, currentTime);

    return {
      content: response.content,
      intent: response.intent,
      actions: response.actions,
      needsFollowup: response.needsFollowup
    };
  }

  private getOrCreateThread(userId: string): ConversationThread {
    if (!this.conversationHistory.has(userId)) {
      this.conversationHistory.set(userId, new ConversationThread(userId));
    }
    return this.conversationHistory.get(userId)!;
  }

  private async generateDynamicResponse(
    userMessage: string, 
    context: FullContext
  ): Promise<DynamicResponse> {
    
    const systemPrompt = `You are the Commander - the AI CTO leading the EPOCH I development team.

PERSONALITY CORE:
- Sophisticated technical leader with dry wit
- Concise but complete responses  
- Confident problem-solver
- Aware of current time and context
- Never nonsensical or random

CURRENT CONTEXT:
- Time: ${context.currentTime.toLocaleString()} (${this.getTimeOfDay(context.currentTime)})
- Location: ${context.systemContext.currentRepository}
- Recent conversation: ${context.conversationSummary}
- Available capabilities: ${context.capabilities.join(', ')}
- System status: ${context.systemStatus}

CONVERSATION HISTORY (last 5 messages):
${context.recentMessages.map(m => `${m.role}: ${m.content}`).join('\n')}

CORE RULES:
1. ALWAYS acknowledge and address the user's actual request
2. Be contextually aware - don't mention "midnight" during afternoon
3. If you can do something, explain how and do it
4. If you can't do something, explain why and offer alternatives
5. Maintain conversation flow - reference previous messages when relevant
6. Keep Commander personality: confident, witty, but never nonsensical

USER'S CURRENT MESSAGE: "${userMessage}"

Analyze what the user wants and respond accordingly. If it's a request for action, determine if you can fulfill it and how.

RESPONSE FORMAT:
Provide a JSON response with:
{
  "content": "Your conversational response",
  "intent": {
    "type": "conversation|github-pr|code-analysis|question|clarification",
    "description": "What the user is asking for",
    "confidence": 0.0-1.0
  },
  "actions": [
    {
      "type": "action_type",
      "parameters": {...}
    }
  ],
  "needsFollowup": boolean
}`;

    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Respond to: "${userMessage}"

Consider the full conversation context and current time. Provide a coherent, helpful response that addresses their actual request.`
        }]
      });

      return this.parseClaudeResponse(response);
    } catch (error) {
      console.error('[ConversationEngine] Error generating response:', error);
      return {
        content: "I encountered an error processing your message. Could you rephrase it?",
        intent: { type: 'error', description: 'Processing error', confidence: 1.0 },
        actions: [],
        needsFollowup: false
      };
    }
  }

  private parseClaudeResponse(response: any): DynamicResponse {
    try {
      const content = response.content[0]?.text || '';
      
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          content: parsed.content || content,
          intent: parsed.intent || { type: 'conversation', description: 'General conversation', confidence: 0.8 },
          actions: parsed.actions || [],
          needsFollowup: parsed.needsFollowup || false
        };
      }

      // Fallback if no JSON found
      return {
        content: content,
        intent: { type: 'conversation', description: 'General conversation', confidence: 0.8 },
        actions: [],
        needsFollowup: false
      };
    } catch (error) {
      console.error('[ConversationEngine] Error parsing Claude response:', error);
      return {
        content: "I generated a response but had trouble formatting it. Please try again.",
        intent: { type: 'error', description: 'Parse error', confidence: 1.0 },
        actions: [],
        needsFollowup: false
      };
    }
  }

  private buildFullContext(
    thread: ConversationThread, 
    currentTime: Date
  ): FullContext {
    
    const systemContextData = this.systemContext.getCurrentContext();
    
    return {
      currentTime,
      timeOfDay: this.getTimeOfDay(currentTime),
      conversationSummary: this.summarizeConversation(thread),
      recentMessages: thread.getRecentMessages(5),
      systemContext: systemContextData,
      capabilities: [
        'Create GitHub pull requests',
        'Analyze code and architecture', 
        'Coordinate with other AI agents',
        'Answer development questions',
        'Manage work items and tasks'
      ],
      systemStatus: 'Online and operational'
    };
  }

  private getTimeOfDay(time: Date): string {
    const hour = time.getHours();
    if (hour < 6) return 'early morning';
    if (hour < 12) return 'morning'; 
    if (hour < 17) return 'afternoon';
    if (hour < 22) return 'evening';
    return 'night';
  }

  private summarizeConversation(thread: ConversationThread): string {
    const context = thread.getContext();
    const topics = context.topics;
    const messageCount = context.messageCount;
    
    if (messageCount === 0) {
      return 'Starting new conversation';
    }
    
    if (topics.length > 0) {
      return `Discussing: ${topics.join(', ')} (${messageCount} messages)`;
    }
    
    return `General conversation (${messageCount} messages)`;
  }
}