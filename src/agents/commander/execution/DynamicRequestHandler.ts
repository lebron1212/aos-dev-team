import Anthropic from '@anthropic-ai/sdk';
import { RequestIntent, RequestAction } from '../conversation/ConversationEngine.js';
import { ConversationContext } from '../conversation/ConversationThread.js';

export interface RequestResult {
  success: boolean;
  message: string;
  actionTaken: string;
  data?: any;
  suggestedAlternatives?: string[];
}

export interface ActionResult {
  success: boolean;
  message: string;
  actionTaken: string;
  data?: any;
  suggestedAlternatives?: string[];
}

export interface PRSpecification {
  title: string;
  description: string;
  needsArchitect: boolean;
  repository: string;
  branch?: string;
  files?: string[];
}

export class DynamicRequestHandler {
  private claude: Anthropic;

  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
  }

  async handleRequest(
    intent: RequestIntent, 
    context: ConversationContext
  ): Promise<RequestResult> {
    
    console.log(`[DynamicRequestHandler] Processing: ${intent.type} - ${intent.description}`);

    switch (intent.type) {
      case 'github-pr':
      case 'github-pr-creation':
        return await this.handlePRCreation(intent, context);
      case 'code-analysis':
        return await this.handleCodeAnalysis(intent, context);
      case 'agent-coordination':
        return await this.handleAgentCoordination(intent, context);
      case 'clarification':
      case 'clarification-needed':
        return await this.handleClarification(intent, context);
      case 'conversation':
      case 'general-conversation':
        return await this.handleConversation(intent, context);
      case 'question':
        return await this.handleQuestion(intent, context);
      default:
        return this.handleUnknownRequest(intent, context);
    }
  }

  private async handlePRCreation(intent: RequestIntent, context: ConversationContext): Promise<RequestResult> {
    // Parse the complex request from conversation
    // Example: "when it detects user intent to build WITHIN the epoch I dev team codebase (not Aurora)- offer to use systems arch bot or a new pull request in GH"
    
    try {
      const prSpec = await this.parsePRRequest(intent.description, context);
      
      if (prSpec.needsArchitect) {
        // Delegate to Systems Architect
        return {
          success: true,
          message: `🏗️ This request needs architectural analysis. I'll delegate to the Systems Architect for proper planning.`,
          actionTaken: 'delegated-to-architect',
          suggestedAlternatives: ['Manual PR creation', 'Break down into smaller tasks']
        };
      }

      // For now, explain what would be created
      return {
        success: true,
        message: `✅ I would create PR: "${prSpec.title}" in ${prSpec.repository}. (GitHub integration TODO)`,
        actionTaken: 'pr-planned',
        data: prSpec,
        suggestedAlternatives: ['Use Systems Architect', 'Manual creation']
      };
    } catch (error) {
      return {
        success: false,
        message: `❌ Failed to parse PR request: ${(error as Error).message}. Would you like me to try a different approach?`,
        actionTaken: 'error',
        suggestedAlternatives: ['Manual PR creation', 'Break down into smaller tasks', 'Use Systems Architect']
      };
    }
  }

  private async handleCodeAnalysis(intent: RequestIntent, context: ConversationContext): Promise<RequestResult> {
    return {
      success: true,
      message: `🔍 Code analysis requested: ${intent.description}. I'll coordinate with the Systems Architect for comprehensive analysis.`,
      actionTaken: 'analysis-delegated'
    };
  }

  private async handleAgentCoordination(intent: RequestIntent, context: ConversationContext): Promise<RequestResult> {
    return {
      success: true,
      message: `🤝 Agent coordination: ${intent.description}. Coordinating with available agents.`,
      actionTaken: 'coordination-started'
    };
  }

  private async handleClarification(intent: RequestIntent, context: ConversationContext): Promise<RequestResult> {
    return {
      success: true,
      message: `❓ I need more details about: ${intent.description}. Could you provide more specifics?`,
      actionTaken: 'clarification-requested'
    };
  }

  private async handleConversation(intent: RequestIntent, context: ConversationContext): Promise<RequestResult> {
    return {
      success: true,
      message: `💬 Conversation continued: ${intent.description}`,
      actionTaken: 'conversation-handled'
    };
  }

  private async handleQuestion(intent: RequestIntent, context: ConversationContext): Promise<RequestResult> {
    return {
      success: true,
      message: `🤔 Question noted: ${intent.description}. I can help with development questions and provide guidance.`,
      actionTaken: 'question-addressed'
    };
  }

  private handleUnknownRequest(intent: RequestIntent, context: ConversationContext): RequestResult {
    return {
      success: false,
      message: `🤷 I'm not sure how to handle: ${intent.description}. Could you rephrase or be more specific?`,
      actionTaken: 'unknown-request',
      suggestedAlternatives: [
        'Try rephrasing your request',
        'Break it down into smaller tasks',
        'Ask for help with specific steps'
      ]
    };
  }

  private async parsePRRequest(description: string, context: ConversationContext): Promise<PRSpecification> {
    // Use AI to understand complex conditional requests
    try {
      const analysis = await this.claude.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 800,
        system: `Parse complex PR creation requests into actionable specifications.

REPOSITORIES:
- "aos-dev-team": EPOCH I AI development infrastructure  
- "aurora": Main Aurora OS application

EXAMPLE REQUEST: "when it detects user intent to build WITHIN the epoch I dev team codebase (not Aurora)- offer to use systems arch bot or a new pull request in GH"

This means: Create PR that adds logic to detect when users want to build in aos-dev-team (not Aurora) and offer two options: Systems Architect bot OR direct GitHub PR.

Return JSON with:
{
  "title": "Brief PR title",
  "description": "What the PR would accomplish", 
  "needsArchitect": boolean,
  "repository": "aos-dev-team|aurora",
  "files": ["list", "of", "files", "to", "modify"]
}`,
        messages: [{
          role: 'user', 
          content: `Parse this PR request: "${description}"`
        }]
      });

      const content = analysis.content[0]?.text || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          title: parsed.title || 'Generated PR',
          description: parsed.description || description,
          needsArchitect: parsed.needsArchitect || false,
          repository: parsed.repository || 'aos-dev-team',
          files: parsed.files || []
        };
      }

      // Fallback if parsing fails
      return {
        title: 'Generated PR Request',
        description: description,
        needsArchitect: true, // Default to architect for safety
        repository: 'aos-dev-team'
      };
    } catch (error) {
      console.error('[DynamicRequestHandler] Error parsing PR request:', error);
      throw new Error('Unable to parse PR request');
    }
  }
}