import { COM_L1_IntentAnalyzer } from '../intelligence/COM-L1-IntentAnalyzer.js';
import { RequirementGatherer } from '../intelligence/RequirementGatherer.js';
import { AgentOrchestrator } from './AgentOrchestrator.js';
import { WorkManager } from '../workflow/WorkManager.js';
import { DiscordInterface } from '../communication/DiscordInterface.js';
import { VoiceSystem } from '../communication/VoiceSystem.js';
import { UniversalIntent, WorkItem, CommanderConfig } from '../types/index.js';

export class UniversalRouter {
  private intentAnalyzer: COM_L1_IntentAnalyzer;
  private requirementGatherer: RequirementGatherer;
  private agentOrchestrator: AgentOrchestrator;
  private workManager: WorkManager;
  private discordInterface: DiscordInterface;
  
  // Context storage
  private conversationContext: Map<string, any> = new Map();
  
  constructor(config: CommanderConfig) {
    this.intentAnalyzer = new COM_L1_IntentAnalyzer(config.claudeApiKey);
    this.requirementGatherer = new RequirementGatherer(config.claudeApiKey);
    this.agentOrchestrator = new AgentOrchestrator(config);
    this.workManager = new WorkManager();
    this.discordInterface = new DiscordInterface(config);
  }

  async routeUniversalInput(
    input: string, 
    userId: string,
    messageId: string
  ): Promise<string> {
    
    console.log(`[UniversalRouter] Processing: "${input}" from user ${userId}`);
    
    try {
      // Step 1: Analyze intent with context
      const context = this.getConversationContext(userId);
      const intent = await this.intentAnalyzer.analyzeUniversalIntent(input, context);
      
      console.log(`[UniversalRouter] Routed to: ${intent.category}/${intent.subcategory}`);
      
      // Step 2: Route to appropriate handler
      switch (intent.category) {
        case 'build':
          return await this.handleBuildRequest(intent, userId, messageId);
          
        case 'modify':
          return await this.handleModifyRequest(intent, userId, messageId);
          
        case 'analyze':
          return await this.handleAnalyzeRequest(intent, userId, messageId);
          
        case 'manage':
          return await this.handleManageRequest(intent, userId, messageId);
          
        case 'question':
          return await this.handleQuestionRequest(intent, userId, messageId);
          
        case 'conversation':
          return await this.handleConversationRequest(intent, userId, messageId);
          
        default:
          return `Not sure how to handle that request. Could you rephrase it?`;
      }
      
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
    messageId: string
  ): Promise<string> {
    
    switch (intent.subcategory) {
      case 'conversation-status':
      case 'conversation-casual':
        // Get current work status for context
        const activeWork = Array.from(this.workManager.getActiveWorkItems()).length;
        const recentWork = this.getConversationContext(userId).recentWorkItems?.length || 0;
        
        if (activeWork > 0) {
          return `We're crushing it. ${activeWork} active work items in progress. What's next on the roadmap?`;
        } else if (recentWork > 0) {
          return `Ready to build. Just shipped ${recentWork} components recently → deployment pipeline is dialed in. What should we tackle next?`;
        } else {
          return `Systems online and ready. No active builds right now → perfect time to start something new. What do you want to create?`;
        }
        
      case 'conversation-positive':
        // Save positive feedback to memory service
        return `Appreciate it. Always optimizing for that enterprise-grade quality → what's the next challenge?`;
        
      case 'conversation-negative':
        return `Noted. I'll adjust the approach → let's iterate and get it right.`;
        
      default:
        return `Ready to build. What's the vision?`;
    }
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