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
  private conversationContext: Map<string, any> = new Map();
  private comWatch: ComWatch;
  private feedbackSystem: FeedbackLearningSystem;
  private voiceSystem: VoiceSystem;
  
  constructor(config: CommanderConfig) {
    this.intentAnalyzer = new COM_L1_IntentAnalyzer(config.claudeApiKey);
    this.requirementGatherer = new RequirementGatherer(config.claudeApiKey);
    this.agentOrchestrator = new AgentOrchestrator(config);
    this.workManager = new WorkManager();
    this.discordInterface = new DiscordInterface(config);
    this.claude = new Anthropic({ apiKey: config.claudeApiKey });
    this.comWatch = new ComWatch();
    this.feedbackSystem = new FeedbackLearningSystem(config.claudeApiKey);
    this.voiceSystem = new VoiceSystem(config.claudeApiKey, this.feedbackSystem);
  }

  async routeUniversalInput(
    input: string, 
    userId: string,
    messageId: string
  ): Promise<string> {
    
    console.log(\`[UniversalRouter] Processing: "\${input}" from user \${userId}\`);

    await this.discordInterface.trackMessage(input, "", messageId);
    
    try {
      const messageHistory: Array<{content: string, author: string, timestamp: Date}> = [];
      
      const context = this.getConversationContext(userId);
      context.conversationHistory = messageHistory;
      
      const intent = await this.intentAnalyzer.analyzeUniversalIntent(input, context);
      
      console.log(\`[UniversalRouter] Routed to: \${intent.category}/\${intent.subcategory}\`);
      
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
          response = \`Not sure how to handle that request. Could you rephrase it?\`;
      }
      
      await this.discordInterface.updateTrackedMessage(messageId, response);
      await this.comWatch.logCommanderInteraction(input, response, messageHistory.map(m => \`\${m.author}: \${m.content}\`));
      
      return response;
      
    } catch (error) {
      console.error('[UniversalRouter] Error:', error);
      return \`× System error processing request. Please try again or rephrase.\`;
    }
  }

  private async handleBuildRequest(
    intent: UniversalIntent, 
    userId: string, 
    messageId: string
  ): Promise<string> {
    
    const gatheringResult = await this.requirementGatherer.analyzeRequirements(
      intent.parameters.description,
      intent.estimatedComplexity
    );
    
    if (!gatheringResult.shouldProceed && gatheringResult.nextQuestion) {
      this.storeConversationContext(userId, {
        pendingIntent: intent,
        gatheringInProgress: true,
        clarifiedRequest: gatheringResult.clarifiedRequest
      });
      
      return await this.voiceSystem.formatResponse(gatheringResult.nextQuestion, { type: 'question' });
    }
    
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
    
    const thread = await this.discordInterface.createWorkItemThread(workItem);
    workItem.threadId = thread.id;
    
    const orchestrationResult = await this.agentOrchestrator.executeWork(workItem);
    
    this.updateConversationContext(userId, {
      lastWorkItem: workItem.id,
      recentWorkItems: [workItem.id, ...(this.getConversationContext(userId).recentWorkItems || [])].slice(0, 5)
    });
    
    const actionResponse = await this.voiceSystem.formatResponse(
      \`\${workItem.id} started in thread\`,
      { type: 'action', workItemId: workItem.id }
    );
    
    return \`▶ \${actionResponse}\\n→ \${orchestrationResult.message}\`;
  }

  private async handleModifyRequest(
    intent: UniversalIntent, 
    userId: string, 
    messageId: string
  ): Promise<string> {
    
    const target = intent.parameters.target || this.getConversationContext(userId).lastWorkItem;
    
    if (!target) {
      return await this.voiceSystem.formatResponse("What would you like me to modify? I don't see any recent work to change.", { type: 'question' });
    }
    
    const workItem = await this.workManager.getWorkItem(target);
    if (!workItem) {
      return await this.voiceSystem.formatResponse("Can't find the work item to modify. Could you be more specific?", { type: 'error' });
    }
    
    const modificationItem = await this.workManager.createWorkItem({
      title: \`Modify: \${workItem.title}\`,
      description: intent.parameters.description,
      originalRequest: intent.parameters.description,
      assignedAgents: intent.requiredAgents,
      primaryAgent: intent.requiredAgents[0],
      estimatedComplexity: intent.estimatedComplexity,
      userId,
      messageId,
      parentWorkItem: workItem.id
    });
    
    const result = await this.agentOrchestrator.executeWork(modificationItem);
    
    return \`◆ Modifying \${workItem.id}\\n→ \${result.message}\`;
  }

  private async handleAnalyzeRequest(
    intent: UniversalIntent, 
    userId: string, 
    messageId: string
  ): Promise<string> {
    
    switch (intent.subcategory) {
      case 'analyze-health':
        return await this.voiceSystem.formatResponse("Project Health Analysis\\n→ Analyzing codebase health...\\n(CodeAnalyzer agent TODO)", { type: 'action' });
      case 'analyze-performance':
        return await this.voiceSystem.formatResponse("Performance Analysis\\n→ Analyzing performance metrics...\\n(PerformanceAnalyzer agent TODO)", { type: 'action' });
      case 'analyze-code':
        return await this.voiceSystem.formatResponse("Code Analysis\\n→ Reviewing code quality...\\n(CodeAnalyzer agent TODO)", { type: 'action' });
      default:
        return await this.voiceSystem.formatResponse(\`Analysis Request\\n→ \${intent.parameters.description}\\n(Analysis agents TODO)\`, { type: 'action' });
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
        return await this.voiceSystem.formatResponse(\`Deployment Management\\n→ \${intent.parameters.description}\\n(Deployment features TODO)\`, { type: 'action' });
      default:
        return await this.voiceSystem.formatResponse(\`Management Request\\n→ \${intent.parameters.description}\`, { type: 'action' });
    }
  }

  private async handleQuestionRequest(
    intent: UniversalIntent, 
    userId: string, 
    messageId: string
  ): Promise<string> {
    
    return await this.voiceSystem.formatResponse(\`Question: \${intent.parameters.description}\\nI can help with development questions!\\n(Educational agent TODO)\`, { type: 'question' });
  }

  private async handleConversationRequest(
    intent: UniversalIntent, 
    userId: string, 
    messageId: string,
    messageHistory: Array<{content: string, author: string, timestamp: Date}>
  ): Promise<string> {
    
    const messageContext = (this.discordInterface as any).messageContext;
    
    if (intent.subcategory === "conversation-feedback" || intent.subcategory?.includes("feedback")) {
      const lastMessage = messageContext ? Array.from(messageContext.values()).pop() : null;
      if (lastMessage) {
        const suggestion = await this.feedbackSystem.extractSuggestion(intent.parameters.description, lastMessage.response);
        await this.feedbackSystem.logFeedback(
          lastMessage.input,
          lastMessage.response,
          intent.parameters.description,
          "Classified as feedback",
          suggestion
        );
        console.log("[UniversalRouter] Logged feedback from conversation handler");
        
        await this.comWatch.logCommanderInteraction(lastMessage.input, lastMessage.response, [], intent.parameters.description);
        
        return await this.voiceSystem.formatResponse("Got it. Learning from that.", { type: 'acknowledgment' });
      }
    }
   
    return await this.voiceSystem.generateConversationResponse(
      intent.parameters.description,
      messageHistory,
      ContextProvider.getTimeContext()
    );
  }

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
    if (description.length <= 50) return description;
    return description.substring(0, 47) + '...';
  }
}
