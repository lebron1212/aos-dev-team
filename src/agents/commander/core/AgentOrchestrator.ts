import { WorkItem, AgentMessage, CommanderConfig } from '../types/index.js';
import { DiscordInterface } from '../communication/DiscordInterface.js';
import { VoiceSystem } from '../communication/VoiceSystem.js';

export class AgentOrchestrator {
  private discordInterface: DiscordInterface;
  private agentChannelId: string;
  
  // Registry of available agents
  private availableAgents: Map<string, any> = new Map();
  
  constructor(config: CommanderConfig) {
    this.discordInterface = new DiscordInterface(config);
    this.agentChannelId = config.agentChannelId;
    
    // Register available agents
    this.registerAvailableAgents();
  }

  async executeWork(workItem: WorkItem): Promise<{ success: boolean; message: string }> {
    console.log(`[AgentOrchestrator] Executing work item ${workItem.id} with agents: ${workItem.assignedAgents.join(', ')}`);
    
    try {
      // Step 1: Validate agents are available
      const unavailableAgents = workItem.assignedAgents.filter(agent => !this.isAgentAvailable(agent));
      
      if (unavailableAgents.length > 0) {
        return {
          success: false,
          message: `Agents not available: ${unavailableAgents.join(', ')} (TODO: implement these agents)`
        };
      }
      
      // Step 2: Send coordination message to agent channel
      await this.sendAgentCoordination(workItem);
      
      // Step 3: Execute with primary agent
      const result = await this.executeWithPrimaryAgent(workItem);
      
      // Step 4: Update work item thread with progress
      await this.updateWorkItemProgress(workItem, result);
      
      return result;
      
    } catch (error) {
      console.error(`[AgentOrchestrator] Error executing work item ${workItem.id}:`, error);
      
      return {
        success: false,
        message: `Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async executeWithPrimaryAgent(workItem: WorkItem): Promise<{ success: boolean; message: string }> {
    const primaryAgent = workItem.primaryAgent;
    
    switch (primaryAgent) {
      case 'FrontendArchitect':
        return await this.executeFrontendWork(workItem);
        
      case 'BackendEngineer':
        return {
          success: false,
          message: 'BackendEngineer agent TODO - will build API/database functionality'
        };
        
      case 'QCAgent':
        return {
          success: false,
          message: 'QCAgent moved to separate service - quality review TODO'
        };
        
      case 'PerformanceOptimizer':
        return {
          success: false,
          message: 'PerformanceOptimizer agent TODO - will optimize speed/efficiency'
        };
        
      case 'MobileSpecialist':
        return {
          success: false,
          message: 'MobileSpecialist agent TODO - will optimize for mobile/PWA'
        };
        
      default:
        return {
          success: false,
          message: `Unknown agent: ${primaryAgent}`
        };
    }
  }

  private async executeFrontendWork(workItem: WorkItem): Promise<{ success: boolean; message: string }> {
    // TODO: Integrate with actual FrontendArchitect agent
    // For now, simulate the work
    
    console.log(`[AgentOrchestrator] Starting FrontendArchitect work for ${workItem.id}`);
    
    // Update progress
    workItem.status = 'building';
    workItem.progress = 25;
    const progressMsg = VoiceSystem.formatResponse(
      'Frontend architect analyzing requirements...',
      { type: 'status', workItemId: workItem.id, progress: workItem.progress }
    );
    await this.updateWorkItemProgress(workItem, { success: true, message: progressMsg });
    
    // Simulate work phases
    await this.delay(2000);
    workItem.progress = 50;
    const buildingMsg = VoiceSystem.formatResponse(
      'Generating enterprise-grade components...',
      { type: 'status', workItemId: workItem.id, progress: workItem.progress }
    );
    await this.updateWorkItemProgress(workItem, { success: true, message: buildingMsg });
    
    await this.delay(3000);
    workItem.progress = 75;
    const deployMsg = VoiceSystem.formatResponse(
      'Creating deployment artifacts...',
      { type: 'status', workItemId: workItem.id, progress: workItem.progress }
    );
    await this.updateWorkItemProgress(workItem, { success: true, message: deployMsg });
    
    await this.delay(2000);
    workItem.progress = 90;
    const previewMsg = VoiceSystem.formatResponse(
      'Deploying to preview environment...',
      { type: 'status', workItemId: workItem.id, progress: workItem.progress }
    );
    await this.updateWorkItemProgress(workItem, { success: true, message: previewMsg });
    
    await this.delay(1000);
    workItem.progress = 100;
    workItem.status = 'completed';
    
    // Mock results
    workItem.outputs = {
      files: [
        { path: 'src/components/GeneratedComponent.tsx', content: '// Enterprise-grade component code' }
      ],
      deploymentUrl: 'https://deploy-url.netlify.app',
      prUrl: 'https://github.com/user/repo/pull/123',
      previewUrl: 'https://preview-url.netlify.app'
    };
    
    const completionMsg = VoiceSystem.formatResponse(
      'Frontend component deployed successfully!',
      { type: 'completion', workItemId: workItem.id }
    );
    await this.updateWorkItemProgress(workItem, { 
      success: true, 
      message: completionMsg
    });
    
    return {
      success: true,
      message: VoiceSystem.enhanceCTOVoice(`Frontend work completed - preview available at ${workItem.outputs.previewUrl}`)
    };
  }

  private async sendAgentCoordination(workItem: WorkItem): Promise<void> {
    const message: AgentMessage = {
      from: 'Commander',
      to: workItem.primaryAgent,
      type: 'task',
      workItemId: workItem.id,
      content: `🤖 [COM-L1] → [${workItem.primaryAgent.toUpperCase()}] Task: ${workItem.title}

Requirements: ${workItem.description}
Complexity: ${workItem.status}
Thread: <#${workItem.threadId}>

User Context: ${JSON.stringify(workItem.userPreferences || {})}`,
      timestamp: new Date()
    };
    
    // Send to agent coordination channel
    try {
      await this.discordInterface.sendAgentMessage(message);
      console.log(`[AgentOrchestrator] Sent coordination message to ${workItem.primaryAgent}`);
    } catch (error) {
      console.error('[AgentOrchestrator] Failed to send agent coordination:', error);
    }
  }

  private async updateWorkItemProgress(
    workItem: WorkItem, 
    result: { success: boolean; message: string }
  ): Promise<void> {
    
    if (workItem.threadId) {
      await this.discordInterface.updateWorkItemThread(workItem, result.message);
    }
  }

  private registerAvailableAgents(): void {
    // Register agents that are currently implemented
    this.availableAgents.set('FrontendArchitect', {
      name: 'FrontendArchitect',
      description: 'Builds enterprise-grade UI components and interfaces',
      categories: ['build-ui', 'modify-ui'],
      status: 'available'
    });
    
    // Register planned agents as TODO
    const plannedAgents = [
      'BackendEngineer',
      'QCAgent', 
      'PerformanceOptimizer',
      'MobileSpecialist',
      'CodeAnalyzer',
      'MemoryService'
    ];
    
    plannedAgents.forEach(agent => {
      this.availableAgents.set(agent, {
        name: agent,
        description: `${agent} functionality`,
        status: 'todo'
      });
    });
  }

  private isAgentAvailable(agentName: string): boolean {
    const agent = this.availableAgents.get(agentName);
    return agent && agent.status === 'available';
  }

  // Utility methods
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public methods for agent management
  public getAvailableAgents(): string[] {
    return Array.from(this.availableAgents.keys()).filter(name => 
      this.availableAgents.get(name)?.status === 'available'
    );
  }

  public getPlannedAgents(): string[] {
    return Array.from(this.availableAgents.keys()).filter(name => 
      this.availableAgents.get(name)?.status === 'todo'
    );
  }
}