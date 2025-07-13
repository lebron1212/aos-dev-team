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
        return this.getDetailedHelpMessage();
      
      case '/status':
        return await this.getSystemStatus();
      
      case '/pending':
        return this.getPendingApprovals(userId);
      
      case '/clear':
        this.pendingApprovals.delete(userId);
        return "Cleared any pending approvals.";

      case '/examples':
        return this.getExamplesMessage();

      case '/commands':
        return this.getCommandsMessage();
      
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
        
        return `**⚠️ Modification Plan Review Required**

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

  private getDetailedHelpMessage(): string {
    return `# 🏗️ **Architect Online - System Architecture Agent**

## 🚀 **Quick Start Guide**
Type your request in natural language or use slash commands. I can analyze, build, modify, and manage your AI development system.

---

## 📋 **Essential Commands**

### **System Commands**
\`\`\`
/help       - This comprehensive guide
/status     - System health and performance
/examples   - Copy-paste examples
/commands   - Quick command reference
/pending    - View pending approvals
/clear      - Clear pending operations
\`\`\`

---

## 💬 **Natural Language Examples** (Copy & Paste)

### **Agent Creation**
\`\`\`
Build an agent named TestBot for simple ping responses
Create a monitoring agent for system health checks
Build a Discord bot for customer support
Generate a data analysis agent with charts
\`\`\`

### **System Analysis**
\`\`\`
Analyze system performance
Check code health and issues
Show me current configuration values
What's the Commander's token limit?
How many agents are running?
\`\`\`

### **Code Modifications**
\`\`\`
Can you fix the buildCompleteAgent method?
Increase API timeout from 5 to 30 seconds
Tone down Commander's humor by 20%
Update Discord integration settings
Fix the JSON parsing errors
\`\`\`

### **Project Management**
\`\`\`
Deploy the latest changes
Create a backup of current system
Show modification history
Undo last change
Set up production environment
\`\`\`

---

## ⚡ **Quick Actions**
- **"approve"** - Execute pending high-risk modifications
- **"status"** - Quick system overview
- **"help"** - Show this guide
- **"fix errors"** - Auto-detect and resolve issues

---

## 🎯 **Core Capabilities**

### **🔍 Analysis & Monitoring**
- Code health assessment and performance metrics
- System architecture review and optimization
- Configuration analysis and recommendations
- Error detection and diagnostic reporting

### **🛠️ Building & Creation**
- Complete AI agent generation with Discord integration
- System component creation and configuration
- Database schema and API endpoint generation
- Development environment setup and deployment

### **🔧 Modification & Maintenance**
- Targeted code modifications and bug fixes
- Configuration updates and system tuning
- Dependency management and version updates
- Architecture refactoring and optimization

### **📊 Project Management**
- Work item tracking and progress monitoring
- Team coordination and task delegation
- Deployment pipeline management
- Version control and change tracking

---

## 🚨 **Risk Management**

### **Automatic Execution** (Low Risk)
- Configuration queries and analysis
- Non-destructive code generation
- System health checks and monitoring
- Documentation and reporting

### **Approval Required** (High Risk)
- File deletions or structural changes
- Production/main branch modifications
- Critical system component changes
- Database schema modifications

---

## 💡 **Pro Tips**

1. **Be specific**: "Fix the JSON parsing in CodeModifier" vs "fix errors"
2. **Use examples**: Reference existing patterns when requesting new features
3. **Test safely**: High-risk operations require approval for your protection
4. **Ask questions**: "What would happen if..." to understand impact
5. **Iterate**: Start with small changes, then build complexity

---

## 🔗 **Integration Features**
- **Discord**: Full bot creation and channel management
- **Git**: Version control and branch management
- **Claude API**: Intelligent analysis and generation
- **Railway**: Deployment and environment management

---

**Ready to build!** Try any of the examples above or describe what you'd like to accomplish. I'm here to accelerate your development with intelligent automation and expert guidance.`;
  }

  private getExamplesMessage(): string {
    return `# 📚 **Copy-Paste Examples**

## 🤖 **Agent Creation**
\`\`\`
Build an agent named HealthBot for system monitoring
Create a Discord bot for user support with friendly personality
Generate a data visualization agent for analytics dashboards
Build a deployment manager for Railway integration
\`\`\`

## 🔧 **Quick Fixes**
\`\`\`
Fix the buildCompleteAgent method error
Resolve JSON parsing failures in CodeModifier
Update git operations to work without repository
Increase Claude API timeout to 30 seconds
\`\`\`

## 📊 **Analysis Requests**
\`\`\`
Analyze system performance and bottlenecks
Check current API usage and costs
Show me all configuration values
What Discord channels are configured?
Review code quality and architecture
\`\`\`

## ⚙️ **Configuration Changes**
\`\`\`
Set Commander response length to 2-3 sentences
Enable debug logging for Discord integration
Update environment variables for production
Configure automatic backups every hour
\`\`\`

**Just copy, paste, and modify these examples for your needs!**`;
  }

  private getCommandsMessage(): string {
    return `# ⚡ **Quick Command Reference**

## **System**
- \`/status\` - Health check
- \`/help\` - Full guide
- \`/examples\` - Copy-paste examples

## **Natural Language**
- \`"analyze [component]"\` - Code analysis
- \`"build [description]"\` - Create components
- \`"fix [issue]"\` - Resolve problems
- \`"show [info]"\` - Display information

## **Approval Workflow**
- High-risk operations → Shows plan
- Reply \`"approve"\` → Executes safely
- Reply \`"cancel"\` → Aborts operation

## **Emergency**
- \`"undo last"\` - Reverse changes
- \`"status"\` - System overview
- \`"help"\` - Get assistance

**Type any request in natural language - I understand context!**`;
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
      return "✅ No pending approvals.";
    }
    
    return `⏳ **Pending Approval:**

**Request:** ${pending.description}
**Type:** ${pending.type}
**Risk Level:** ${pending.riskLevel}

Reply with **"approve"** to execute or provide more details to refine.`;
  }
}
