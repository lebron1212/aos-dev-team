import { COM_L1_IntentAnalyzer } from '../intelligence/COM-L1-IntentAnalyzer.js';
import { RequirementGatherer } from '../intelligence/RequirementGatherer.js';
import { PRRefinementSystem } from '../intelligence/PRRefinementSystem.js';
import { AgentOrchestrator } from './AgentOrchestrator.js';
import { BotOrchestrator } from './BotOrchestrator.js';
import { WorkManager } from '../workflow/WorkManager.js';
import { DiscordInterface } from '../communication/DiscordInterface.js';
import { VoiceSystem } from '../communication/VoiceSystem.js';
import { GitHubService } from '../integrations/GitHubService.js';
import { UniversalIntent, WorkItem, CommanderConfig } from '../types/index.js';
import Anthropic from '@anthropic-ai/sdk';
import { ComWatch } from '../../watcher/comwatch/ComWatch.js';
import { FeedbackLearningSystem } from '../intelligence/FeedbackLearningSystem.js';
import { ContextProvider } from '../intelligence/ContextProvider.js';

export class UniversalRouter {
  private intentAnalyzer: COM_L1_IntentAnalyzer;
  private requirementGatherer: RequirementGatherer;
  private prRefinementSystem: PRRefinementSystem;
  private githubService: GitHubService;
  private agentOrchestrator: AgentOrchestrator;
  private botOrchestrator: BotOrchestrator;
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
    this.prRefinementSystem = new PRRefinementSystem(config.claudeApiKey);
    this.githubService = new GitHubService(config.githubToken);
    this.agentOrchestrator = new AgentOrchestrator(config);
    this.workManager = new WorkManager();
    this.discordInterface = new DiscordInterface(config);
    this.claude = new Anthropic({ apiKey: config.claudeApiKey });
    this.comWatch = new ComWatch();
    this.feedbackSystem = new FeedbackLearningSystem(config.claudeApiKey);
    this.voiceSystem = new VoiceSystem(config.claudeApiKey, this.feedbackSystem);
    this.botOrchestrator = new BotOrchestrator(config.claudeApiKey, this.discordInterface);
  }

  async routeUniversalInput(
    input: string, 
    userId: string,
    messageId: string
  ): Promise<string> {
    
    console.log(`[UniversalRouter] Processing: "${input}" from user ${userId}`);

    await this.discordInterface.trackMessage(input, "", messageId);
    
    try {
      const messageHistory: Array<{content: string, author: string, timestamp: Date}> = [];
      
      // Check for debug commands first
      const debugResponse = await this.handleDebugRequest(input);
      if (debugResponse) {
        await this.discordInterface.updateTrackedMessage(messageId, debugResponse);
        return debugResponse;
      }

      // Check for bot management commands
      const botManagementResponse = await this.handleBotManagement(input);
      if (botManagementResponse) {
        await this.discordInterface.updateTrackedMessage(messageId, botManagementResponse);
        return botManagementResponse;
      }
      
      // DELEGATION LOGIC - Check if request should be delegated to specialist bot
      const delegationDecision = await this.botOrchestrator.shouldDelegate(input, userId);
      
      if (delegationDecision.delegate && delegationDecision.botName) {
        console.log(`[UniversalRouter] Delegating to ${delegationDecision.botName}: ${delegationDecision.reason}`);
        const delegationResponse = await this.botOrchestrator.delegateToBot(delegationDecision.botName, input, userId);
        await this.discordInterface.updateTrackedMessage(messageId, delegationResponse);
        return delegationResponse;
      }
      
      console.log(`[UniversalRouter] Handling with Commander: ${delegationDecision.reason || 'No suitable specialist bot'}`);
      
      const context = this.getConversationContext(userId);
      context.conversationHistory = messageHistory;
      
      const intent = await this.intentAnalyzer.analyzeUniversalIntent(input, context);
      
      console.log(`[UniversalRouter] Routed to: ${intent.category}/${intent.subcategory}`);
      
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
          response = await this.voiceSystem.formatResponse("Not sure how to handle that request. Could you rephrase it?", { type: 'error' });
      }
      
      await this.discordInterface.updateTrackedMessage(messageId, response);
      await this.comWatch.logCommanderInteraction(input, response, messageHistory.map(m => `${m.author}: ${m.content}`));
      
      return response;
      
    } catch (error) {
      console.error('[UniversalRouter] Error:', error);
      return await this.voiceSystem.formatResponse("System error processing request. Please try again or rephrase.", { type: 'error' });
    }
  }

  private async handleBotManagement(input: string): Promise<string | null> {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('bot status') || lowerInput.includes('available bots')) {
      return await this.botOrchestrator.getBotStatus();
    }
    
    if (lowerInput.includes('register bot') || lowerInput.includes('add bot')) {
      return await this.voiceSystem.formatResponse("Bots register automatically when created by the Architect.", { type: 'info' });
    }
    
    if (lowerInput.includes('remove bot') && lowerInput.includes(' ')) {
      const botName = lowerInput.split('remove bot ')[1]?.trim();
      if (botName) {
        const removed = await this.botOrchestrator.removeBotFromSystem(botName);
        if (removed) {
          return await this.voiceSystem.formatResponse(`Removed ${botName} from the system.`, { type: 'completion' });
        } else {
          return await this.voiceSystem.formatResponse(`Bot ${botName} not found.`, { type: 'error' });
        }
      }
    }
    
    return null;
  }

  async registerNewBot(name: string, purpose: string, capabilities: string[], channelId: string): Promise<void> {
    await this.botOrchestrator.registerBot(name, purpose, capabilities, channelId);
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
    
    const target = intent.parameters.target || this.getConversationContext(userId).lastWorkItem;
    
    if (!target) {
      return await this.voiceSystem.formatResponse("What would you like me to modify? I don't see any recent work to change.", { type: 'question' });
    }
    
    const workItem = await this.workManager.getWorkItem(target);
    if (!workItem) {
      return await this.voiceSystem.formatResponse("Can't find the work item to modify. Could you be more specific?", { type: 'error' });
    }
    
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
    
    const result = await this.agentOrchestrator.executeWork(modificationItem);
    
    const modifyResponse = await this.voiceSystem.formatResponse(
      `Modifying ${workItem.id} - ${result.message}`,
      { type: 'action' }
    );
    
    return `◆ ${modifyResponse}`;
  }

  private async handleAnalyzeRequest(
    intent: UniversalIntent, 
    userId: string, 
    messageId: string
  ): Promise<string> {
    
    switch (intent.subcategory) {
      case 'analyze-health':
        return await this.voiceSystem.formatResponse("Project Health Analysis - Analyzing codebase health (CodeAnalyzer agent TODO)", { type: 'action' });
      case 'analyze-performance':
        return await this.voiceSystem.formatResponse("Performance Analysis - Analyzing performance metrics (PerformanceAnalyzer agent TODO)", { type: 'action' });
      case 'analyze-code':
        return await this.voiceSystem.formatResponse("Code Analysis - Reviewing code quality (CodeAnalyzer agent TODO)", { type: 'action' });
      default:
        return await this.voiceSystem.formatResponse(`Analysis Request - ${intent.parameters.description} (Analysis agents TODO)`, { type: 'action' });
    }
  }

  private async handleManageRequest(
    intent: UniversalIntent, 
    userId: string, 
    messageId: string
  ): Promise<string> {
    
    switch (intent.subcategory) {
      case 'manage-work':
        const workResult = await this.workManager.handleWorkManagement(intent, userId);
        return await this.voiceSystem.formatResponse(workResult, { type: 'management' });
      case 'manage-deployment':
        return await this.voiceSystem.formatResponse(`Deployment Management - ${intent.parameters.description} (Deployment features TODO)`, { type: 'action' });
      case 'manage-pr':
        return await this.handlePRRequest(intent, userId, messageId);
      default:
        return await this.voiceSystem.formatResponse(`Management Request - ${intent.parameters.description}`, { type: 'action' });
    }
  }

  private async handleQuestionRequest(
    intent: UniversalIntent, 
    userId: string, 
    messageId: string
  ): Promise<string> {
    
    return await this.voiceSystem.formatResponse(`Question: ${intent.parameters.description} - I can help with development questions (Educational agent TODO)`, { type: 'question' });
  }

  private async handleConversationRequest(
    intent: UniversalIntent, 
    userId: string, 
    messageId: string,
    messageHistory: Array<{content: string, author: string, timestamp: Date}>
  ): Promise<string> {
    
    // Check if user has an active PR refinement session - if so, route to PR handler
    const activeSession = this.prRefinementSystem.getActiveSession(userId);
    if (activeSession) {
      console.log('[UniversalRouter] Active PR session found, routing conversation to PR handler');
      const refinementResult = await this.prRefinementSystem.refineWithInput(userId, intent.parameters.description);
      
      if (refinementResult.cancelled) {
        return await this.voiceSystem.formatResponse(refinementResult.response, { type: 'info' });
      }
      
      if (refinementResult.isComplete) {
        // Check if user wants to proceed with creation
        const input = intent.parameters.description.toLowerCase();
        if (input.includes('yes') || input.includes('create') || input.includes('proceed')) {
          return await this.createPRFromSession(activeSession, userId);
        } else {
          return await this.voiceSystem.formatResponse(refinementResult.response, { type: 'question' });
        }
      } else {
        return await this.voiceSystem.formatResponse(refinementResult.response, { type: 'question' });
      }
    }
    
    // FIXED: Safely access messageContext from DiscordInterface
    const messageContext = (this.discordInterface as any).messageContext;
    
    if (intent.subcategory === "conversation-feedback" || intent.subcategory?.includes("feedback")) {
      // FIXED: Safe access with null check
      const lastMessage = messageContext && messageContext.size > 0 ? 
        Array.from(messageContext.values()).pop() : null;
        
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
        
        return await this.voiceSystem.generateFeedbackResponse(
          intent.parameters.description,
          lastMessage.response,
          suggestion
        );
      }
    }
   
    return await this.voiceSystem.generateConversationResponse(
      intent.parameters.description,
      messageHistory,
      ContextProvider.getTimeContext()
    );
  }

  private async handlePRRequest(
    intent: UniversalIntent, 
    userId: string, 
    messageId: string
  ): Promise<string> {
    
    // Check if this is part of an ongoing PR refinement session
    const activeSession = this.prRefinementSystem.getActiveSession(userId);
    
    if (activeSession) {
      // This is a continuation of an existing session
      const refinementResult = await this.prRefinementSystem.refineWithInput(userId, intent.parameters.description);
      
      if (refinementResult.cancelled) {
        return await this.voiceSystem.formatResponse(refinementResult.response, { type: 'info' });
      }
      
      if (refinementResult.isComplete) {
        // Check if user wants to proceed with creation
        const input = intent.parameters.description.toLowerCase();
        if (input.includes('yes') || input.includes('create') || input.includes('proceed')) {
          return await this.createPRFromSession(activeSession, userId);
        } else if (input.includes('edit') || input.includes('modify') || input.includes('change')) {
          // Reset the session to allow editing
          this.prRefinementSystem.cancelSession(userId);
          const newRefinement = await this.prRefinementSystem.startRefinement(userId, intent.parameters.description);
          return await this.voiceSystem.formatResponse(newRefinement.response, { type: 'question' });
        } else {
          return await this.voiceSystem.formatResponse(refinementResult.response, { type: 'question' });
        }
      } else {
        return await this.voiceSystem.formatResponse(refinementResult.response, { type: 'question' });
      }
    } else {
      // Start a new PR refinement session
      const refinementResult = await this.prRefinementSystem.startRefinement(userId, intent.parameters.description);
      
      if (refinementResult.isComplete) {
        // Unlikely but handle the case where the initial request has all needed info
        const session = this.prRefinementSystem.getActiveSession(userId);
        if (session) {
          return await this.voiceSystem.formatResponse(refinementResult.response, { type: 'question' });
        }
      }
      
      return await this.voiceSystem.formatResponse(refinementResult.response, { type: 'question' });
    }
  }

  private async createPRFromSession(session: any, userId: string): Promise<string> {
    try {
      // Ensure branch exists
      if (session.branchName && session.repository) {
        const branchExists = await this.githubService.validateBranchExists(session.repository, session.branchName);
        if (!branchExists) {
          await this.githubService.createBranch(session.repository, session.branchName);
        }
      }

      // Create the PR
      const prResult = await this.githubService.createPullRequest({
        repository: session.repository,
        title: session.title,
        description: session.description,
        head: session.branchName,
        base: session.baseBranch,
        labels: session.labels,
        draft: session.isDraft
      });

      // Clean up the session
      this.prRefinementSystem.cancelSession(userId);

      const successMessage = `✅ Created PR #${prResult.prNumber} in ${session.repository}: ${prResult.prUrl}\n🤖 Auto-assigned to @copilot for AI-assisted review`;
      return await this.voiceSystem.formatResponse(successMessage, { type: 'completion' });

    } catch (error) {
      console.error('[UniversalRouter] Failed to create PR:', error);
      
      const errorMessage = `❌ Failed to create PR: ${error instanceof Error ? error.message : 'Unknown error'}`;
      return await this.voiceSystem.formatResponse(errorMessage, { type: 'error' });
    }
  }

  private async handleDebugRequest(input: string): Promise<string | null> {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('what have you learned') || lowerInput.includes('show feedback')) {
      return await this.showLearnedFeedback();
    }
    
    if (lowerInput.includes('comwatch stats') || lowerInput.includes('learning stats')) {
      return await this.showComWatchStats();
    }
    
    if (lowerInput.includes('recent interactions')) {
      return await this.showRecentInteractions();
    }
    
    return null;
  }

  private async showLearnedFeedback(): Promise<string> {
    const learningExamples = this.feedbackSystem.generateLearningExamples();
    const feedbackCount = await this.getFeedbackCount();
    
    if (!learningExamples || learningExamples.trim() === '') {
      return await this.voiceSystem.formatResponse("No corrections logged yet. Clean slate.", { type: 'info' });
    }
    
    const summary = `Feedback logged: ${feedbackCount} entries\n\nRecent corrections:\n${learningExamples.substring(0, 300)}${learningExamples.length > 300 ? '...' : ''}`;
    
    return await this.voiceSystem.formatResponse(summary, { type: 'info' });
  }

  private async showComWatchStats(): Promise<string> {
    try {
      const stats = await this.comWatch.getTrainingStats();
      const insights = await this.comWatch.generateLearningInsights();
      
      const summary = `ComWatch Status: ${stats.watchingStatus}
Total interactions: ${stats.totalInteractions}
Average words per response: ${stats.averageWordCount?.toFixed(1) || 'N/A'}
Recent quality ratio: ${stats.recentQualityRatio?.toFixed(2) || 'N/A'}

Categories: ${Object.entries(stats.categories || {}).map(([k,v]) => `${k}:${v}`).join(', ')}

${insights.length > 0 ? 'Insights:\n' + insights.join('\n') : 'No insights yet.'}`;

      return await this.voiceSystem.formatResponse(summary, { type: 'info' });
    } catch (error) {
      return await this.voiceSystem.formatResponse("ComWatch data unavailable. Still learning.", { type: 'error' });
    }
  }

  private async showRecentInteractions(): Promise<string> {
    try {
      const trainingData = await this.comWatch.exportTrainingData();
      const recent = trainingData.slice(-5);
      
      if (recent.length === 0) {
        return await this.voiceSystem.formatResponse("No interactions logged yet.", { type: 'info' });
      }
      
      const summary = recent.map((interaction, i) => 
        `${i+1}. ${interaction.category} (${interaction.wordCount}w) - Quality: ${interaction.quality}${interaction.feedback ? ' [FEEDBACK]' : ''}`
      ).join('\n');
      
      return await this.voiceSystem.formatResponse(`Recent interactions:\n${summary}`, { type: 'info' });
    } catch (error) {
      return await this.voiceSystem.formatResponse("Interaction data unavailable.", { type: 'error' });
    }
  }

  private async getFeedbackCount(): Promise<number> {
    try {
      return (this.feedbackSystem as any).examples?.length || 0;
    } catch (error) {
      return 0;
    }
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
