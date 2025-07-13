import { UniversalAnalyzer } from './UniversalAnalyzer.js';
import { ArchitectOrchestrator } from './ArchitectOrchestrator.js';
import { ArchitecturalRequest, ArchitectConfig } from '../types/index.js';

export class ArchitectCommandRouter {
  private analyzer: UniversalAnalyzer;
  private orchestrator: ArchitectOrchestrator;
  private pendingApprovals: Map<string, ArchitecturalRequest> = new Map();

  constructor(config: ArchitectConfig) {
    this.analyzer = new UniversalAnalyzer(config.claudeApiKey);
    this.orchestrator = new ArchitectOrchestrator(config);
  }

  async routeCommand(input: string, userId: string): Promise<string> {
    try {
      // Handle approval commands first
      if (this.isApprovalCommand(input)) {
        return await this.handleApproval(userId);
      }

      // Handle explicit commands
      if (input.startsWith('/')) {
        return await this.handleSlashCommand(input, userId);
      }

      // Route natural language requests
      return await this.handleNaturalLanguage(input, userId);

    } catch (error) {
      console.error('[ArchitectCommandRouter] Routing failed:', error);
      return `Command routing failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`;
    }
  }

  private isApprovalCommand(input: string): boolean {
    const approvalKeywords = [
      'approve', 'approved', 'yes', 'confirm', 'execute', 
      'proceed', 'go ahead', 'do it', 'continue'
    ];
    
    const lowerInput = input.toLowerCase().trim();
    return approvalKeywords.some(keyword => lowerInput === keyword || lowerInput.includes(keyword));
  }

  private async handleApproval(userId: string): Promise<string> {
    const pendingRequest = this.pendingApprovals.get(userId);
    
    if (!pendingRequest) {
      return "No pending modifications to approve. Use a modification command first.";
    }

    try {
      // Execute the pending request
      const result = await this.orchestrator.executeArchitecturalWork(pendingRequest);
      
      // Clear the pending approval
      this.pendingApprovals.delete(userId);
      
      return result;
      
    } catch (error) {
      console.error('[ArchitectCommandRouter] Approval execution failed:', error);
      this.pendingApprovals.delete(userId);
      return `Approved modification failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async handleSlashCommand(input: string, userId: string): Promise<string> {
    const command = input.toLowerCase().trim();
    
    switch (command) {
      case '/help':
        return this.getHelpMessage();
      
      case '/status':
        return await this.getSystemStatus();
      
      case '/pending':
        return this.getPendingApprovals(userId);
      
      case '/clear':
        this.pendingApprovals.delete(userId);
        return "Cleared any pending approvals.";
      
      default:
        // Try to parse as a natural language command
        const cleanInput = input.substring(1); // Remove the /
        return await this.handleNaturalLanguage(cleanInput, userId);
    }
  }

  private async handleNaturalLanguage(input: string, userId: string): Promise<string> {
    try {
      // Analyze the architectural request
      const request = await this.analyzer.analyzeArchitecturalRequest(input, userId);
      
      // Check if this request requires approval
      if (request.riskLevel === 'high' || this.requiresApproval(input)) {
        // Store for pending approval
        this.pendingApprovals.set(userId, request);
        
        return `**Modification Plan Review Required**

**Request:** ${request.description}
**Risk Level:** ${request.riskLevel}
**Type:** ${request.type}

This modification requires approval due to its risk level. Reply with "approve" to execute, or provide more details to refine the plan.`;
      }
      
      // Execute immediately for low-risk requests
      return await this.orchestrator.executeArchitecturalWork(request);
      
    } catch (error) {
      console.error('[ArchitectCommandRouter] Natural language processing failed:', error);
      return `Request processing failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try rephrasing your request.`;
    }
  }

  private requiresApproval(input: string): boolean {
    const highRiskKeywords = [
      'delete', 'remove', 'destroy', 'drop', 'purge',
      'main branch', 'production', 'master', 'critical'
    ];
    
    const lowerInput = input.toLowerCase();
    return highRiskKeywords.some(keyword => lowerInput.includes(keyword));
  }

  private getHelpMessage(): string {
    return `**🏗️ Architect Online - System Architecture Agent**

**Quick Start**
- Type /help for commands
- Use natural language or slash commands

**🔧 Examples**
- /status - System health
- /analyze - Code analysis  
- /build agent Monitor - Create agent

**💬 Natural Language**
- "Can you fix for me?"
- "Build an agent named TestBot for simple ping responses"
- "Give me a game plan to fix the buildcompleteagent method"
- "Analyze system performance"
- "Create a Discord bot for monitoring"

**⚡ Quick Commands**
- "approve" - Execute pending modifications
- "undo last" - Reverse last change
- "show status" - System overview

**🎯 Capabilities**
- **Analysis:** Code health, performance, architecture review
- **Building:** Agents, integrations, system components  
- **Modification:** Code changes, configuration updates
- **Configuration:** System settings, environment setup

**🚨 High-Risk Operations**
Some operations require approval for safety:
- File deletions or major structural changes
- Production/main branch modifications
- Critical system component changes

Organized, well-documented, and ready to accelerate development.`;
  }

  private async getSystemStatus(): Promise<string> {
    try {
      const statusRequest: ArchitecturalRequest = {
        type: 'system-status',
        description: 'System health check',
        userId: 'system',
        priority: 'medium',
        riskLevel: 'low'
      };
      
      return await this.orchestrator.executeArchitecturalWork(statusRequest);
    } catch (error) {
      return `System status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private getPendingApprovals(userId: string): string {
    const pending = this.pendingApprovals.get(userId);
    
    if (!pending) {
      return "No pending approvals.";
    }
    
    return `**Pending Approval:**
**Request:** ${pending.description}
**Type:** ${pending.type}
**Risk Level:** ${pending.riskLevel}

Reply with "approve" to execute or provide more details to refine.`;
  }
}
