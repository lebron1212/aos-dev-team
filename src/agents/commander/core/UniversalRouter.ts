import { COM_L1_IntentAnalyzer } from '../intelligence/COM-L1-IntentAnalyzer.js';
import { RequirementGatherer } from '../intelligence/RequirementGatherer.js';
import { AgentOrchestrator } from './AgentOrchestrator.js';
import { WorkManager } from '../workflow/WorkManager.js';
import { DiscordInterface } from '../communication/DiscordInterface.js';
import { VoiceSystem } from '../communication/VoiceSystem.js';
import { UniversalIntent, WorkItem, CommanderConfig } from '../types/index.js';
import Anthropic from '@anthropic-ai/sdk';
import { ComWatch } from '../../watcher/comwatch/ComWatch.js';
import { FeedbackLearningSystem } from '../intelligence/FeedbackLearningSystem.js';
import { ContextProvider } from '../intelligence/ContextProvider.js';

export class UniversalRouter {
  private intentAnalyzer: COM_L1_IntentAnalyzer;
  private requirementGatherer: RequirementGatherer;
  private agentOrchestrator: AgentOrchestrator;
  private workManager: WorkManager;
  private discordInterface: DiscordInterface;
  private claude: Anthropic;
  
  // Context storage
  private conversationContext: Map<string, any> = new Map();
 private comWatch: ComWatch;
 private feedbackSystem: FeedbackLearningSystem;
  
  constructor(config: CommanderConfig) {
    this.intentAnalyzer = new COM_L1_IntentAnalyzer(config.claudeApiKey);
    this.requirementGatherer = new RequirementGatherer(config.claudeApiKey);
    this.agentOrchestrator = new AgentOrchestrator(config);
    this.workManager = new WorkManager();
    this.discordInterface = new DiscordInterface(config);
    this.claude = new Anthropic({ apiKey: config.claudeApiKey });
   this.comWatch = new ComWatch();
   this.feedbackSystem = new FeedbackLearningSystem();
  }

  async routeUniversalInput(
    input: string, 
    userId: string,
    messageId: string
  ): Promise<string> {
    
    console.log(`[UniversalRouter] Processing: "${input}" from user ${userId}`);

      // CRITICAL: Track input immediately so feedback detection works
      await this.discordInterface.trackMessage(input, "", messageId);
    
    try {
      // Step 1: Get conversation history for context (temporary fallback)
      const messageHistory: Array<{content: string, author: string, timestamp: Date}> = [];
      try {
        // @ts-ignore - will be available after next deploy
        if (this.discordInterface.getRecentMessages) {
          messageHistory = await this.discordInterface.getRecentMessages(5);
        }
      } catch (error) {
        console.log('[UniversalRouter] Message history not available yet');
      }
      
      // Step 2: Analyze intent with conversation context
      const context = this.getConversationContext(userId);
      context.conversationHistory = messageHistory;
      
      const intent = await this.intentAnalyzer.analyzeUniversalIntent(input, context);
      
      console.log(`[UniversalRouter] Routed to: ${intent.category}/${intent.subcategory}`);
      
      // Step 3: Route to appropriate handler
      let response: string;
      switch (intent.category) {
        case 'build':
          response = await this.handleBuildRequest(intent, userId, messageId);
          break;
          
        case 'modify':
          response = await this.handleModifyRequest(intent, userId, messageId);
          break;
          
        case 'analyze':
          response = await this.handleAnalyzeRequest(intent, userId, messageId);
          break;
          
        case 'manage':
          response = await this.handleManageRequest(intent, userId, messageId);
          break;
          
        case 'question':
          response = await this.handleQuestionRequest(intent, userId, messageId);
          break;
          
        case 'conversation':
          response = await this.handleConversationRequest(intent, userId, messageId, messageHistory);
          break;
          
        default:
          response = `Not sure how to handle that request. Could you rephrase it?`;
      }
      
      // Step 4: Track message for ComWatch and feedback system
      await this.discordInterface.updateTrackedMessage(messageId, response);
      
      return response;
      
    } catch (error) {
      console.error('[UniversalRouter] Error:', error);
      return `× System error processing request. Please try again or rephrase.`;
    }
  }

  private async handleBuildRequest(
    intent: UniversalIntent, 
    userId: string, 
    messageId: string
  ): Promise<string> {
    
    // Step 1: Check if we need more requirements
    const gatheringResult = await this.requirementGatherer.analyzeRequirements(
      intent.parameters.description,
      intent.estimatedComplexity
    );
    
    if (!gatheringResult.shouldProceed && gatheringResult.nextQuestion) {
      // Store context for next interaction
      this.storeConversationContext(userId, {
        pendingIntent: intent,
        gatheringInProgress: true,
        clarifiedRequest: gatheringResult.clarifiedRequest
      });
      
      const questionResponse = VoiceSystem.formatResponse(
        `${gatheringResult.nextQuestion}`,
        { type: 'question' }
      );
      
      return questionResponse;
    }
    
    // Step 2: Create work item and thread
    const workItem = await this.workManager.createWorkItem({
      title: this.generateWorkItemTitle(intent),
      description: gatheringResult.clarifiedRequest || intent.parameters.description,
      originalRequest: intent.parameters.description,
      assignedAgents: intent.requiredAgents,
      primaryAgent: intent.requiredAgents[0],
      estimatedComplexity: intent.estimatedComplexity,
      userId,
      messageId
    });
    
    // Step 3: Create Discord thread for this work item
    const thread = await this.discordInterface.createWorkItemThread(workItem);
    workItem.threadId = thread.id;
    
    // Step 4: Start the work with orchestrator
    const orchestrationResult = await this.agentOrchestrator.executeWork(workItem);
    
    // Step 5: Update context
    this.updateConversationContext(userId, {
      lastWorkItem: workItem.id,
      recentWorkItems: [workItem.id, ...(this.getConversationContext(userId).recentWorkItems || [])].slice(0, 5)
    });
    
    const actionResponse = VoiceSystem.formatResponse(
      `${workItem.id} started in thread`,
      { type: 'action', workItemId: workItem.id }
    );
    
    return `▶ ${actionResponse}\n→ ${orchestrationResult.message}`;
  }

  private async handleModifyRequest(
    intent: UniversalIntent, 
    userId: string, 
    messageId: string
  ): Promise<string> {
    
    // Find target work item
    const target = intent.parameters.target || this.getConversationContext(userId).lastWorkItem;
    
    if (!target) {
      return `What would you like me to modify? I don't see any recent work to change.`;
    }
    
    const workItem = await this.workManager.getWorkItem(target);
    if (!workItem) {
      return `× Can't find the work item to modify. Could you be more specific?`;
    }
    
    // Create modification work item
    const modificationItem = await this.workManager.createWorkItem({
      title: `Modify: ${workItem.title}`,
      description: intent.parameters.description,
      originalRequest: intent.parameters.description,
      assignedAgents: intent.requiredAgents,
      primaryAgent: intent.requiredAgents[0],
      estimatedComplexity: intent.estimatedComplexity,
      userId,
      messageId,
      parentWorkItem: workItem.id
    });
    
    // Execute modification
    const result = await this.agentOrchestrator.executeWork(modificationItem);
    
    return `◆ Modifying ${workItem.id}\n→ ${result.message}`;
  }

  private async handleAnalyzeRequest(
    intent: UniversalIntent, 
    userId: string, 
    messageId: string
  ): Promise<string> {
    
    // Route to appropriate analysis agent (TODO: implement analysis agents)
    switch (intent.subcategory) {
      case 'analyze-health':
        return `■ Project Health Analysis\n→ Analyzing codebase health...\n(CodeAnalyzer agent TODO)`;
        
      case 'analyze-performance':
        return `■ Performance Analysis\n→ Analyzing performance metrics...\n(PerformanceAnalyzer agent TODO)`;
        
      case 'analyze-code':
        return `■ Code Analysis\n→ Reviewing code quality...\n(CodeAnalyzer agent TODO)`;
        
      default:
        return `■ Analysis Request\n→ ${intent.parameters.description}\n(Analysis agents TODO)`;
    }
  }

  private async handleManageRequest(
    intent: UniversalIntent, 
    userId: string, 
    messageId: string
  ): Promise<string> {
    
    switch (intent.subcategory) {
      case 'manage-work':
        return await this.workManager.handleWorkManagement(intent, userId);
        
      case 'manage-deployment':
        return `▶ Deployment Management\n→ ${intent.parameters.description}\n(Deployment features TODO)`;
        
      default:
        return `■ Management Request\n→ ${intent.parameters.description}`;
    }
  }

  private async handleQuestionRequest(
    intent: UniversalIntent, 
    userId: string, 
    messageId: string
  ): Promise<string> {
    
    // Handle educational/informational questions
    return `→ Question: ${intent.parameters.description}\nI can help with development questions!\n(Educational agent TODO)`;
  }

  private async handleConversationRequest(
    intent: UniversalIntent, 
    userId: string, 
    messageId: string,
    messageHistory: Array<{content: string, author: string, timestamp: Date}>
  ): Promise<string> {
    
    // Build conversation context for Claude
    const recentConversation = messageHistory
      .slice(-5) // Last 5 messages
      .map(msg => `${msg.author}: ${msg.content}`)
      .join('\n');
    
    const timeContext = ContextProvider.getTimeContext();
    const systemStatus = ContextProvider.getSystemStatus();
   
    // Get learned examples from feedback - THIS IS THE KEY FIX
    const learningExamples = this.feedbackSystem.generateLearningExamples();
   
    const conversationPrompt = `Context: It's ${timeContext}. You are the AI Commander system.
Recent conversation:
${recentConversation}

Current user message: "${intent.parameters.description}"

${learningExamples}

Respond appropriately to the conversation context and user's message. Apply all learned corrections to avoid repeating past mistakes.`;

    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 300,
        system: VoiceSystem.getSystemPrompt() + learningExamples, // INJECT LEARNING HERE TOO
        messages: [{ role: 'user', content: conversationPrompt }]
      });
      
      const content = response.content[0];
      if (content.type === 'text') {
        const finalResponse = VoiceSystem.enhanceCTOVoice(content.text);
        await this.comWatch.logCommanderInteraction(intent.parameters.description, finalResponse, messageHistory.map(m => `${m.author}: ${m.content}`));
        return finalResponse;
      }
    } catch (error) {
      console.error('[UniversalRouter] Conversation handling failed:', error);
    }
    
    // Simple fallback if Claude fails
    return `Ready to build. What's the vision?`;
  }

  // Context management
  private getConversationContext(userId: string): any {
    return this.conversationContext.get(userId) || {};
  }
  
  private storeConversationContext(userId: string, context: any): void {
    this.conversationContext.set(userId, { ...this.getConversationContext(userId), ...context });
  }
  
  private updateConversationContext(userId: string, updates: any): void {
    this.storeConversationContext(userId, updates);
  }
  
  private generateWorkItemTitle(intent: UniversalIntent): string {
    const description = intent.parameters.description;
    
    // Extract key terms for a concise title
    if (description.length <= 50) return description;
    
    // Use AI to generate a concise title (for now, simple truncation)
    return description.substring(0, 47) + '...';
  }
}
