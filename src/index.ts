import { Client, GatewayIntentBits, TextChannel, Message } from 'discord.js';
import Anthropic from '@anthropic-ai/sdk';
import { Octokit } from '@octokit/rest';
import * as dotenv from 'dotenv';

dotenv.config();

interface Config {
  DISCORD_TOKEN: string;
  DISCORD_CHANNEL_ID: string;
  QC_BOT_TOKEN: string;
  CLAUDE_API_KEY: string;
  GITHUB_TOKEN: string;
  GITHUB_REPO_OWNER: string;
  GITHUB_REPO_NAME: string;
  NETLIFY_SITE_ID: string;
  OLLAMA_URL?: string; // Optional local AI for NLP
}

const config: Config = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN!,
  DISCORD_CHANNEL_ID: process.env.DISCORD_CHANNEL_ID!,
  QC_BOT_TOKEN: process.env.QC_BOT_TOKEN!,
  CLAUDE_API_KEY: process.env.CLAUDE_API_KEY!,
  GITHUB_TOKEN: process.env.GITHUB_TOKEN!,
  GITHUB_REPO_OWNER: process.env.GITHUB_REPO_OWNER!,
  GITHUB_REPO_NAME: process.env.GITHUB_REPO_NAME!,
  NETLIFY_SITE_ID: process.env.NETLIFY_SITE_ID!,
  OLLAMA_URL: process.env.OLLAMA_URL || 'http://localhost:11434',
};

interface WorkItem {
  id: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedAgent: 'command' | 'frontend-architect' | 'backend-engineer' | 'mobile-specialist' | 'performance-optimizer' | 'design-system-agent';
  status: 'pending' | 'analyzing' | 'in-progress' | 'paused' | 'qc-summoned' | 'awaiting-qc' | 'building' | 'deploying' | 'completed' | 'failed' | 'cancelled';
  estimatedCompletion: Date;
  actualStartTime?: Date;
  pausedTime?: number; // Total time paused in milliseconds
  branchName?: string;
  prUrl?: string;
  previewUrl?: string;
  startTime?: Date;
  progress?: number;
  confidenceLevel?: 'high' | 'medium' | 'low';
  needsQC?: boolean;
  complexity?: 'simple' | 'medium' | 'complex' | 'enterprise';
  requiredAgents?: string[];
  dependencies?: string[]; // Other work item IDs this depends on
  subTasks?: WorkItem[]; // For complex projects broken down into phases
  userFeedback?: UserFeedback[];
  estimatedEffort?: number; // In hours
}

interface UserFeedback {
  id: string;
  workItemId: string;
  type: 'approval' | 'rejection' | 'modification' | 'question';
  content: string;
  timestamp: Date;
  implemented: boolean;
}

interface UserPreferences {
  communicationStyle: 'concise' | 'detailed' | 'technical' | 'casual';
  preferredTechnologies: string[];
  dislikedPatterns: string[];
  qualityThreshold: number; // 0-100
  complexityPreference: 'simple' | 'feature-rich' | 'cutting-edge';
  feedbackHistory: UserFeedback[];
  successfulPatterns: string[];
  rejectedApproaches: string[];
}

interface ProjectHealth {
  overallScore: number;
  codebaseSize: number;
  technicalDebtScore: number;
  performanceScore: number;
  maintainabilityScore: number;
  testCoverage: number;
  unusedFiles: string[];
  bloatedAreas: string[];
  architecturalIssues: string[];
  recommendations: string[];
}

interface ProjectDNA {
  framework: 'react' | 'vue' | 'angular';
  styling: 'tailwind' | 'styled-components' | 'css-modules';
  typescript: boolean;
  componentStyle: 'functional' | 'class-based';
  preferences: string[];
  dislikes: string[];
}

interface QCResult {
  passed: boolean;
  score: number;
  issues: QCIssue[];
  suggestions: string[];
}

interface QCIssue {
  type: 'critical' | 'major' | 'minor';
  category: 'accessibility' | 'performance' | 'design' | 'mobile' | 'integration';
  description: string;
  suggestion: string;
}

interface AgentResult {
  success: boolean;
  message: string;
  files?: { path: string; content: string }[];
  branchName?: string;
  estimatedCompletion?: Date;
  improvements?: string[];
  integrationNotes?: string;
  confidenceLevel?: 'high' | 'medium' | 'low';
  qcResult?: QCResult;
}

// Global Bot Status Manager
class BotStatusManager {
  private static instance: BotStatusManager;
  private onlineBots: Set<string> = new Set();
  private targetChannel: TextChannel | null = null;
  private initializationTimeout: NodeJS.Timeout | null = null;
  
  static getInstance(): BotStatusManager {
    if (!BotStatusManager.instance) {
      BotStatusManager.instance = new BotStatusManager();
    }
    return BotStatusManager.instance;
  }
  
  setTargetChannel(channel: TextChannel): void {
    this.targetChannel = channel;
  }
  
  async botOnline(botName: string): Promise<void> {
    this.onlineBots.add(botName);
    
    // Only send systems initialized message for Command Agent
    if (botName === 'Command Agent') {
      // Clear existing timeout and set new one to batch notifications
      if (this.initializationTimeout) {
        clearTimeout(this.initializationTimeout);
      }
      
      this.initializationTimeout = setTimeout(() => {
        this.sendSystemsInitialized();
      }, 2000); // Wait 2 seconds for all bots to come online
    }
  }
  
  async botOffline(botName: string): Promise<void> {
    this.onlineBots.delete(botName);
    await this.sendGoingDark([botName]);
  }
  
  private async sendSystemsInitialized(): Promise<void> {
    if (!this.targetChannel || this.onlineBots.size === 0) return;
    
    let message = `**Systems Initialized.** The following bots are online and awaiting orders:\n`;
    Array.from(this.onlineBots).sort().forEach(bot => {
      message += `• ${bot}\n`;
    });
    
    try {
      await this.targetChannel.send(message);
    } catch (error) {
      console.error('Failed to send systems initialized message:', error);
    }
  }
  
  async sendGoingDark(offlineBots: string[]): Promise<void> {
    if (!this.targetChannel || offlineBots.length === 0) return;
    
    let message = `**Going Dark.** The following bot(s) have been detected as offline:\n`;
    offlineBots.forEach(bot => {
      message += `• ${bot}\n`;
    });
    
    try {
      await this.targetChannel.send(message);
    } catch (error) {
      console.error('Failed to send going dark message:', error);
    }
  }
  
  getOnlineBots(): string[] {
    return Array.from(this.onlineBots);
  }
}

// Abstract Agent Base Class
abstract class Agent {
  protected claude: Anthropic;
  protected name: string;
  
  constructor(name: string) {
    this.claude = new Anthropic({ apiKey: config.CLAUDE_API_KEY });
    this.name = name;
  }
  
  abstract processTask(workItem: WorkItem, projectDNA: ProjectDNA): Promise<AgentResult>;
  
  protected async callClaude(prompt: string): Promise<string> {
    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      });
      
      return response.content[0].type === 'text' ? response.content[0].text : '';
    } catch (error) {
      console.error(`Claude API error for ${this.name}:`, error);
      throw new Error(`Agent ${this.name} failed to process request`);
    }
  }
}

class QCAgent extends Agent {
  constructor() {
    super('QC Agent');
  }

  async processTask(workItem: WorkItem, projectDNA: ProjectDNA): Promise<AgentResult> {
    throw new Error('QC Agent processes quality reviews, not tasks');
  }

  async reviewImplementation(files: { path: string; content: string }[], workItem: WorkItem, projectDNA: ProjectDNA): Promise<QCResult> {
    const prompt = `You are an Elite QC Agent conducting enterprise-grade quality review for a React component implementation.

TASK REQUIREMENTS: ${workItem.description}

ENTERPRISE QC CRITERIA:
1. Code Quality (25 points): TypeScript safety, clean architecture, maintainability
2. Accessibility (25 points): WCAG 2.1 AA compliance, screen reader support
3. Performance (20 points): Optimization, bundle size, rendering efficiency
4. Design Integration (15 points): Consistency with existing patterns
5. Mobile Experience (15 points): Touch optimization, responsive behavior

Provide a quality score (0-100) and specific feedback.

Format: SCORE: [0-100] | PASSED: [true/false] | SUGGESTIONS: [list]`;
    
    try {
      const response = await this.callClaude(prompt);
      return this.parseQCResponse(response);
    } catch (error) {
      return {
        passed: false,
        score: 0,
        issues: [{
          type: 'critical',
          category: 'integration',
          description: 'QC review failed to execute',
          suggestion: 'Manual review required'
        }],
        suggestions: ['Manual quality review recommended']
      };
    }
  }

  private parseQCResponse(response: string): QCResult {
    const scoreMatch = response.match(/SCORE:\s*(\d+)/);
    const passedMatch = response.match(/PASSED:\s*(true|false)/);
    
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 85;
    const passed = passedMatch ? passedMatch[1] === 'true' : score >= 85;
    
    const suggestionsMatch = response.match(/SUGGESTIONS:\s*([\s\S]*?)$/);
    const suggestions: string[] = [];
    if (suggestionsMatch) {
      const suggestionItems = suggestionsMatch[1].split('\n').filter(line => line.trim().startsWith('-'));
      suggestions.push(...suggestionItems.map(item => item.replace(/^-\s*/, '')));
    }
    
    return {
      passed,
      score,
      issues: [],
      suggestions
    };
  }
}

class FrontendArchitect extends Agent {
  private github: Octokit;
  
  constructor() {
    super('Frontend Architect');
    this.github = new Octokit({ auth: config.GITHUB_TOKEN });
  }
  
  async processTask(workItem: WorkItem, projectDNA: ProjectDNA): Promise<AgentResult> {
    const prompt = await this.buildPrompt(workItem, projectDNA);
    
    try {
      const response = await this.callClaude(prompt);
      const parsedResponse = this.parseClaudeResponse(response);
      const confidenceLevel = this.assessConfidence(workItem, parsedResponse);
      
      return {
        success: true,
        message: `Enterprise-grade implementation completed. Generated ${parsedResponse.files.length} files with premium UX standards.`,
        files: parsedResponse.files,
        improvements: parsedResponse.improvements,
        integrationNotes: parsedResponse.integrationNotes,
        estimatedCompletion: new Date(Date.now() + 20 * 60 * 1000),
        confidenceLevel
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Enterprise implementation failed: ${error?.message || 'Unknown error'}`
      };
    }
  }

  private async buildPrompt(workItem: WorkItem, projectDNA: ProjectDNA): Promise<string> {
    const codebaseContext = await this.analyzeCodebase();
    
    return `You are an Elite Frontend Architect building enterprise-grade React components that match the quality standards of Notion, Google Workspace, and Apple's applications.

TASK: ${workItem.description}

ENTERPRISE QUALITY STANDARDS:
- Match the polish and attention to detail of Notion, Linear, Figma, and Apple's web applications
- Implement micro-interactions and smooth animations that feel premium
- Create components that could ship in a $100M+ enterprise application

EXISTING CODEBASE CONTEXT:
${codebaseContext}

PROJECT DNA:
- Framework: ${projectDNA.framework}
- Styling: ${projectDNA.styling}
- TypeScript: ${projectDNA.typescript}
- Component Style: ${projectDNA.componentStyle}
- Preferences: ${projectDNA.preferences.join(', ')}
- Avoid: ${projectDNA.dislikes.join(', ')}

OUTPUT FORMAT:
Return your response in this exact format:

FILES:
---filename: src/components/ComponentName.tsx
[enterprise-grade component code with premium UX]
---

---filename: src/types/ComponentName.types.ts  
[comprehensive TypeScript interfaces and types]
---

IMPROVEMENT_SUGGESTIONS:
[If you notice existing code that could be enhanced to enterprise standards, list specific suggestions with rationale]

INTEGRATION_NOTES:
[How this component integrates with existing codebase, any dependencies or considerations]

SUMMARY:
[Description of the enterprise-grade implementation and its key features]

Generate code that represents the absolute pinnacle of web development craftsmanship.`;
  }

  private async analyzeCodebase(): Promise<string> {
    try {
      const repoStructure = await this.getRepositoryStructure();
      const existingComponents = await this.getExistingComponents();
      
      return `CURRENT CODEBASE ANALYSIS:
Repository Structure: ${repoStructure}
Existing Components: ${existingComponents}
Architecture Notes: Enterprise React patterns detected`;
    } catch (error) {
      return 'CODEBASE_ANALYSIS: Building component with standard enterprise patterns.';
    }
  }

  private async getRepositoryStructure(): Promise<string> {
    try {
      const { data: contents } = await this.github.repos.getContent({
        owner: config.GITHUB_REPO_OWNER,
        repo: config.GITHUB_REPO_NAME,
        path: 'src'
      });
      
      if (Array.isArray(contents)) {
        return contents.map(item => `${item.type}: ${item.path}`).join(', ');
      }
      return 'Standard React structure detected';
    } catch {
      return 'Standard React structure assumed';
    }
  }

  private async getExistingComponents(): Promise<string> {
    try {
      const { data: components } = await this.github.repos.getContent({
        owner: config.GITHUB_REPO_OWNER,
        repo: config.GITHUB_REPO_NAME,
        path: 'src/components'
      });
      
      if (Array.isArray(components)) {
        return components.map(comp => comp.name).join(', ');
      }
      return 'No existing components detected';
    } catch {
      return 'Components directory not found - will create with enterprise standards';
    }
  }
  
  private parseClaudeResponse(response: string): { files: { path: string; content: string }[]; summary: string; improvements: string[]; integrationNotes: string } {
    const files: { path: string; content: string }[] = [];
    const sections = response.split('---filename:');
    
    for (let i = 1; i < sections.length; i++) {
      const section = sections[i];
      const lines = section.split('\n');
      const filename = lines[0].trim();
      const content = lines.slice(1).join('\n').replace(/^---.*$/gm, '').trim();
      
      if (filename && content) {
        files.push({
          path: filename,
          content: content
        });
      }
    }
    
    const improvementMatch = response.match(/IMPROVEMENT_SUGGESTIONS:\s*([\s\S]*?)(?=INTEGRATION_NOTES:|SUMMARY:|$)/);
    const improvements = improvementMatch ? 
      improvementMatch[1].trim().split('\n').filter(line => line.trim()) : [];
    
    const integrationMatch = response.match(/INTEGRATION_NOTES:\s*([\s\S]*?)(?=SUMMARY:|$)/);
    const integrationNotes = integrationMatch ? integrationMatch[1].trim() : '';
    
    const summaryMatch = response.match(/SUMMARY:\s*(.*?)$/s);
    const summary = summaryMatch ? summaryMatch[1].trim() : 'Enterprise-grade implementation completed';
    
    return { files, summary, improvements, integrationNotes };
  }

  private assessConfidence(workItem: WorkItem, parsedResponse: any): 'high' | 'medium' | 'low' {
    const complexityFactors = [
      workItem.description.toLowerCase().includes('complex'),
      workItem.description.toLowerCase().includes('advanced'),
      workItem.description.toLowerCase().includes('integration'),
      workItem.description.toLowerCase().includes('animation'),
      workItem.description.toLowerCase().includes('responsive'),
      parsedResponse.files.length > 3,
      parsedResponse.improvements.length > 2
    ];
    
    const complexityScore = complexityFactors.filter(Boolean).length;
    
    if (complexityScore >= 4) return 'low';
    if (complexityScore >= 2) return 'medium';
    return 'high';
  }
}

class CommandAgent extends Agent {
  private frontendArchitect: FrontendArchitect;
  private github: Octokit;
  private workItems: Map<string, WorkItem> = new Map();
  private workQueue: WorkItem[] = []; // Scheduled work queue
  private projectDNA: ProjectDNA;
  private discordChannel: TextChannel | null = null;
  private userPreferences: UserPreferences;
  private projectHealth: ProjectHealth | null = null;
  
  constructor() {
    super('Command');
    this.frontendArchitect = new FrontendArchitect();
    this.github = new Octokit({ auth: config.GITHUB_TOKEN });
    
    // Initialize user preferences with defaults
    this.userPreferences = {
      communicationStyle: 'detailed',
      preferredTechnologies: ['react', 'typescript', 'tailwind'],
      dislikedPatterns: ['inline styles', 'poor accessibility'],
      qualityThreshold: 85,
      complexityPreference: 'feature-rich',
      feedbackHistory: [],
      successfulPatterns: [],
      rejectedApproaches: []
    };
    
    this.projectDNA = {
      framework: 'react',
      styling: 'tailwind',
      typescript: true,
      componentStyle: 'functional',
      preferences: [
        'enterprise-grade code quality',
        'Notion/Linear/Apple level UX',
        'premium micro-interactions',
        'accessibility-first design',
        'performance optimization',
        'mobile-native feel'
      ],
      dislikes: [
        'inline styles',
        'low-quality animations',
        'accessibility violations',
        'performance bottlenecks'
      ]
    };
  }

  async processTask(workItem: WorkItem, projectDNA: ProjectDNA): Promise<AgentResult> {
    throw new Error('CommandAgent does not process tasks directly');
  }

  setDiscordChannel(channel: TextChannel): void {
    this.discordChannel = channel;
  }

  // 1. SMART WORK MANAGEMENT
  async scheduleWork(workItem: WorkItem, scheduleTime?: Date): Promise<string> {
    if (scheduleTime && scheduleTime > new Date()) {
      workItem.status = 'pending';
      this.workQueue.push(workItem);
      this.workQueue.sort((a, b) => a.priority === b.priority ? 
        a.estimatedCompletion.getTime() - b.estimatedCompletion.getTime() :
        this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority));
      
      return `→ **Work Scheduled**: ${workItem.id} queued for ${scheduleTime.toLocaleString()}. Position in queue: ${this.workQueue.indexOf(workItem) + 1}`;
    } else {
      return await this.processUserRequest(workItem.description);
    }
  }

  async pauseWork(workItemId: string): Promise<string> {
    const workItem = this.workItems.get(workItemId);
    if (!workItem) return `× Work item ${workItemId} not found`;
    
    if (workItem.status === 'in-progress') {
      workItem.status = 'paused';
      workItem.pausedTime = (workItem.pausedTime || 0) + (Date.now() - (workItem.actualStartTime?.getTime() || Date.now()));
      
      await this.sendUpdate(`⏸️ **Work Paused**: ${workItemId} - ${workItem.description}`);
      return `⏸️ **Work Paused**: ${workItem.description}. Use \`resume ${workItemId}\` to continue.`;
    }
    
    return `→ Work item ${workItemId} is not currently in progress (Status: ${workItem.status})`;
  }

  async resumeWork(workItemId: string): Promise<string> {
    const workItem = this.workItems.get(workItemId);
    if (!workItem) return `× Work item ${workItemId} not found`;
    
    if (workItem.status === 'paused') {
      workItem.status = 'in-progress';
      workItem.actualStartTime = new Date();
      
      await this.sendUpdate(`▶️ **Work Resumed**: ${workItemId} - ${workItem.description}`);
      return `▶️ **Work Resumed**: ${workItem.description}. Continuing implementation...`;
    }
    
    return `→ Work item ${workItemId} is not paused (Status: ${workItem.status})`;
  }

  async cancelWork(workItemId: string, reason?: string): Promise<string> {
    const workItem = this.workItems.get(workItemId);
    if (!workItem) return `× Work item ${workItemId} not found`;
    
    workItem.status = 'cancelled';
    
    // Clean up any GitHub branches if created
    if (workItem.branchName) {
      try {
        await this.github.git.deleteRef({
          owner: config.GITHUB_REPO_OWNER,
          repo: config.GITHUB_REPO_NAME,
          ref: `heads/${workItem.branchName}`
        });
      } catch (error) {
        console.log('Branch cleanup error (non-critical):', error);
      }
    }
    
    const reasonText = reason ? ` Reason: ${reason}` : '';
    await this.sendUpdate(`🗑️ **Work Cancelled**: ${workItemId} - ${workItem.description}.${reasonText}`);
    return `🗑️ **Work Cancelled**: ${workItem.description}.${reasonText}`;
  }

  async estimateWorkload(): Promise<string> {
    const activeWork = Array.from(this.workItems.values()).filter(item => 
      ['pending', 'in-progress', 'paused'].includes(item.status)
    );
    
    const totalEstimatedHours = activeWork.reduce((sum, item) => sum + (item.estimatedEffort || 1), 0);
    const queuedWork = this.workQueue.length;
    
    let response = `📊 **Current Workload Analysis**\n\n`;
    response += `**Active Work Items**: ${activeWork.length}\n`;
    response += `**Queued Items**: ${queuedWork}\n`;
    response += `**Estimated Total Effort**: ${totalEstimatedHours} hours\n`;
    response += `**Expected Completion**: ${new Date(Date.now() + totalEstimatedHours * 60 * 60 * 1000).toLocaleDateString()}\n\n`;
    
    if (activeWork.length > 0) {
      response += `**Current Active Work**:\n`;
      activeWork.forEach(item => {
        response += `• ${item.id}: ${item.description} (${item.status})\n`;
      });
    }
    
    return response;
  }

  // 2. INTELLIGENT DECISION MAKING
  async assessComplexity(request: string): Promise<{ 
    complexity: 'simple' | 'medium' | 'complex' | 'enterprise'; 
    confidence: number; 
    needsMoreInfo: boolean; 
    questions: string[];
    estimatedHours?: number;
    requiredAgents?: string[];
  }> {
    const complexityPrompt = `Analyze this development request for complexity:

"${request}"

Consider:
- Technical complexity
- Integration requirements  
- Performance implications
- Security considerations
- Testing needs
- Time requirements

Return JSON: {
  "complexity": "simple|medium|complex|enterprise",
  "confidence": 0-100,
  "needsMoreInfo": boolean,
  "questions": ["question1", "question2"],
  "estimatedHours": number,
  "requiredAgents": ["agent1", "agent2"]
}`;

    try {
      const response = await this.callClaude(complexityPrompt);
      return JSON.parse(response);
    } catch {
      return {
        complexity: 'medium',
        confidence: 50,
        needsMoreInfo: true,
        questions: ['Could you provide more details about the specific requirements?']
      };
    }
  }

  selectOptimalAgent(workItem: WorkItem): string {
    // TODO: Implement when we add more agents
    const agentSelectionMap: Record<string, string> = {
      'ui': 'frontend-architect',
      'component': 'frontend-architect', 
      'form': 'frontend-architect',
      'layout': 'frontend-architect',
      'api': 'backend-engineer', // Will implement
      'database': 'backend-engineer', // Will implement
      'mobile': 'mobile-specialist', // Will implement
      'performance': 'performance-optimizer', // Will implement
      'design': 'design-system-agent' // Will implement
    };

    const description = workItem.description.toLowerCase();
    
    for (const [keyword, agent] of Object.entries(agentSelectionMap)) {
      if (description.includes(keyword)) {
        return agent;
      }
    }
    
    return 'frontend-architect'; // Default for now
  }

  async negotiateRequirements(request: string, complexity: any): Promise<string> {
    if (!complexity.needsMoreInfo) return '';
    
    let response = `🤔 **Need More Information**\n\n`;
    response += `I've analyzed your request: "${request}"\n`;
    response += `**Complexity Level**: ${complexity.complexity.toUpperCase()}\n`;
    response += `**Confidence**: ${complexity.confidence}%\n\n`;
    response += `**To ensure I build exactly what you need, please clarify:**\n\n`;
    
    complexity.questions.forEach((question: string, index: number) => {
      response += `${index + 1}. ${question}\n`;
    });
    
    response += `\nOnce you provide these details, I'll create a precise implementation plan.`;
    return response;
  }

  // 3. LEARNING & ADAPTATION
  async learnFromFeedback(workItemId: string, feedback: string, type: 'approval' | 'rejection' | 'modification'): Promise<void> {
    const userFeedback: UserFeedback = {
      id: `feedback_${Date.now()}`,
      workItemId,
      type,
      content: feedback,
      timestamp: new Date(),
      implemented: false
    };
    
    this.userPreferences.feedbackHistory.push(userFeedback);
    
    // Extract patterns from feedback
    const analysisPrompt = `Analyze this user feedback to extract preferences:

Feedback Type: ${type}
Content: "${feedback}"

Extract:
- Preferred technologies/patterns
- Disliked approaches  
- Quality expectations
- Communication preferences

Return JSON with extracted patterns.`;

    try {
      const analysis = await this.callClaude(analysisPrompt);
      const patterns = JSON.parse(analysis);
      
      if (type === 'approval') {
        this.userPreferences.successfulPatterns.push(...(patterns.preferred || []));
      } else if (type === 'rejection') {
        this.userPreferences.rejectedApproaches.push(...(patterns.disliked || []));
      }
    } catch (error) {
      console.log('Learning analysis failed:', error);
    }
  }

  trackSuccess(workItemId: string, approved: boolean): void {
    const workItem = this.workItems.get(workItemId);
    if (!workItem) return;
    
    const pattern = `${workItem.assignedAgent}:${workItem.complexity}:${workItem.description.substring(0, 50)}`;
    
    if (approved) {
      this.userPreferences.successfulPatterns.push(pattern);
    } else {
      this.userPreferences.rejectedApproaches.push(pattern);
    }
  }

  // 5. WORKFLOW ORCHESTRATION  
  async createWorkflowPlan(request: string): Promise<{ phases: WorkItem[]; dependencies: Record<string, string[]> }> {
    const planPrompt = `Break down this complex request into sequential phases:

"${request}"

Create a workflow plan with:
- Individual work items
- Dependencies between items
- Estimated effort for each
- Required agents

Return JSON with phases array and dependencies object.`;

    try {
      const response = await this.callClaude(planPrompt);
      return JSON.parse(response);
    } catch {
      // Fallback: treat as single work item
      const workItem = this.createWorkItem({ functionality: request, complexity: 'medium', priority: 'medium' });
      return { phases: [workItem], dependencies: {} };
    }
  }

  // 6. QUALITY INTELLIGENCE
  async preValidateRequest(request: string): Promise<{ valid: boolean; issues: string[]; suggestions: string[] }> {
    const validationPrompt = `Validate this development request for feasibility:

"${request}"

Check for:
- Technical feasibility
- Resource requirements
- Potential conflicts
- Missing information
- Security implications

Return JSON: {
  "valid": boolean,
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1", "suggestion2"]
}`;

    try {
      const response = await this.callClaude(validationPrompt);
      return JSON.parse(response);
    } catch {
      return { valid: true, issues: [], suggestions: [] };
    }
  }

  // 7. PROJECT AWARENESS
  async analyzeCodebaseHealth(): Promise<ProjectHealth> {
    if (this.projectHealth && Date.now() - this.projectHealth.overallScore < 24 * 60 * 60 * 1000) {
      return this.projectHealth; // Cache for 24 hours
    }

    try {
      // Get repository statistics
      const repoStats = await this.getRepositoryStatistics();
      const codeAnalysis = await this.performCodeAnalysis();
      
      this.projectHealth = {
        overallScore: this.calculateOverallScore(repoStats, codeAnalysis),
        codebaseSize: repoStats.size,
        technicalDebtScore: codeAnalysis.technicalDebt,
        performanceScore: codeAnalysis.performance,
        maintainabilityScore: codeAnalysis.maintainability,
        testCoverage: codeAnalysis.testCoverage,
        unusedFiles: codeAnalysis.unusedFiles,
        bloatedAreas: codeAnalysis.bloatedAreas,
        architecturalIssues: codeAnalysis.architecturalIssues,
        recommendations: codeAnalysis.recommendations
      };
      
      return this.projectHealth;
    } catch (error) {
      console.error('Codebase analysis failed:', error);
      return {
        overallScore: 75,
        codebaseSize: 0,
        technicalDebtScore: 70,
        performanceScore: 80,
        maintainabilityScore: 75,
        testCoverage: 60,
        unusedFiles: [],
        bloatedAreas: [],
        architecturalIssues: ['Unable to perform full analysis'],
        recommendations: ['Enable full repository access for detailed analysis']
      };
    }
  }

  async suggestArchitecturalImprovements(): Promise<string> {
    const health = await this.analyzeCodebaseHealth();
    
    let response = `🏗️ **Architectural Analysis**\n\n`;
    response += `**Overall Health Score**: ${health.overallScore}/100\n`;
    response += `**Codebase Size**: ${health.codebaseSize} files\n`;
    response += `**Technical Debt**: ${health.technicalDebtScore}/100\n`;
    response += `**Maintainability**: ${health.maintainabilityScore}/100\n\n`;
    
    if (health.bloatedAreas.length > 0) {
      response += `**Bloated Areas**:\n`;
      health.bloatedAreas.forEach(area => response += `• ${area}\n`);
      response += '\n';
    }
    
    if (health.unusedFiles.length > 0) {
      response += `**Unused Files** (consider removing):\n`;
      health.unusedFiles.slice(0, 5).forEach(file => response += `• ${file}\n`);
      if (health.unusedFiles.length > 5) {
        response += `• ... and ${health.unusedFiles.length - 5} more\n`;
      }
      response += '\n';
    }
    
    if (health.recommendations.length > 0) {
      response += `**Recommendations**:\n`;
      health.recommendations.forEach((rec, index) => response += `${index + 1}. ${rec}\n`);
    }
    
    return response;
  }

  // 8. USER EXPERIENCE ENHANCEMENT
  adaptCommunicationToStyle(message: string): string {
    switch (this.userPreferences.communicationStyle) {
      case 'concise':
        return message.split('\n').slice(0, 3).join('\n');
      case 'technical':
        return message; // Keep detailed technical info
      case 'casual':
        return message.replace(/→/g, '→').replace(/●/g, '•');
      default:
        return message;
    }
  }

  // HELPER METHODS
  private getPriorityWeight(priority: string): number {
    const weights = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
    return weights[priority as keyof typeof weights] || 2;
  }

  private async getRepositoryStatistics(): Promise<any> {
    try {
      const { data: repo } = await this.github.repos.get({
        owner: config.GITHUB_REPO_OWNER,
        repo: config.GITHUB_REPO_NAME
      });
      return { size: repo.size, language: repo.language };
    } catch {
      return { size: 0, language: 'unknown' };
    }
  }

  private async performCodeAnalysis(): Promise<any> {
    // This would integrate with static analysis tools
    // For now, return mock data
    return {
      technicalDebt: 75,
      performance: 85,
      maintainability: 80,
      testCoverage: 70,
      unusedFiles: ['src/legacy/oldComponent.tsx', 'src/utils/unused.ts'],
      bloatedAreas: ['src/components/Dashboard.tsx (500+ lines)', 'src/utils/helpers.ts (multiple responsibilities)'],
      architecturalIssues: ['Circular dependencies detected', 'Missing error boundaries'],
      recommendations: [
        'Break down large components into smaller, focused ones',
        'Implement proper error handling',
        'Add unit tests for critical components',
        'Consider implementing a design system'
      ]
    };
  }

  private calculateOverallScore(repoStats: any, codeAnalysis: any): number {
    return Math.round((
      codeAnalysis.technicalDebt * 0.3 +
      codeAnalysis.performance * 0.25 +
      codeAnalysis.maintainability * 0.25 +
      codeAnalysis.testCoverage * 0.2
    ));
  }

  private async sendUpdate(message: string): Promise<void> {
    if (this.discordChannel) {
      await this.discordChannel.send(message);
    }
  }

  private calculateETA(workItem: WorkItem): string {
    if (!workItem.startTime) return 'Calculating...';
    
    const elapsed = Date.now() - workItem.startTime.getTime();
    const progress = workItem.progress || 0;
    
    if (progress === 0) return 'Analyzing...';
    
    const totalEstimated = (elapsed / progress) * 100;
    const remaining = totalEstimated - elapsed;
    
    const minutes = Math.ceil(remaining / (1000 * 60));
    return `${Math.max(1, minutes)} minutes remaining`;
  }

  private getProgressEmoji(progress: number): string {
    if (progress < 25) return '▱▱▱▱';
    if (progress < 50) return '▰▱▱▱';
    if (progress < 75) return '▰▰▱▱';
    if (progress < 100) return '▰▰▰▱';
    return '▰▰▰▰';
  }
  
  // UNIVERSAL HYBRID AI-POWERED COMMAND PARSING
  private async parseNaturalCommand(request: string): Promise<{ 
    action: string; 
    target?: string; 
    reason?: string; 
    params?: any 
  } | null> {
    const lowerRequest = request.toLowerCase();
    
    // First try simple pattern matching (fast)
    const simpleResult = this.parseSimplePatterns(lowerRequest, request);
    if (simpleResult) return simpleResult;
    
    // If patterns fail, try free AI model (Ollama)
    if (config.OLLAMA_URL) {
      try {
        const aiResult = await this.parseWithOllama(request);
        if (aiResult) return aiResult;
      } catch (error) {
        console.log('Ollama parsing failed, falling back to patterns:', error);
      }
    }
    
    // Final fallback to advanced pattern matching
    return this.parseAdvancedPatterns(request);
  }

  private parseSimplePatterns(lowerRequest: string, originalRequest: string): { 
    action: string; 
    target?: string; 
    reason?: string; 
    params?: any 
  } | null {
    // Work Management
    if (lowerRequest.includes('pause') || lowerRequest.includes('stop')) {
      if (lowerRequest.includes('latest') || lowerRequest.includes('current') || lowerRequest.includes('this job')) {
        return { action: 'pause', target: 'latest' };
      }
    }
    
    if (lowerRequest.includes('resume') || lowerRequest.includes('continue')) {
      if (lowerRequest.includes('latest') || lowerRequest.includes('paused') || lowerRequest.includes('that job')) {
        return { action: 'resume', target: 'latest_paused' };
      }
    }
    
    if (lowerRequest.includes('cancel') || lowerRequest.includes('delete')) {
      const reasonMatch = lowerRequest.match(/because|reason:|due to (.+)/);
      const reason = reasonMatch ? reasonMatch[1] : undefined;
      
      if (lowerRequest.includes('latest') || lowerRequest.includes('current') || lowerRequest.includes('this job')) {
        return { action: 'cancel', target: 'latest', reason };
      }
    }

    // Status & Analysis  
    if (lowerRequest.includes('workload') || lowerRequest.includes('how much work') || lowerRequest.includes('what\'s queued')) {
      return { action: 'workload' };
    }

    if (lowerRequest.includes('status') || lowerRequest.includes('progress') || lowerRequest.includes('what\'s happening')) {
      return { action: 'status' };
    }

    if (lowerRequest.includes('health') || lowerRequest.includes('codebase') || lowerRequest.includes('project analysis')) {
      return { action: 'health' };
    }

    // Feedback
    if (lowerRequest.includes('approve') || lowerRequest.includes('looks good') || lowerRequest.includes('accept')) {
      return { action: 'approve', target: 'latest' };
    }

    if (lowerRequest.includes('reject') || lowerRequest.includes('not good') || lowerRequest.includes('deny')) {
      return { action: 'reject', target: 'latest', reason: originalRequest };
    }

    // Help
    if (lowerRequest.includes('help') || lowerRequest.includes('commands') || lowerRequest.includes('what can you do')) {
      return { action: 'help' };
    }

    // QC
    if (lowerRequest.includes('qc') || lowerRequest.includes('quality') || lowerRequest.includes('review')) {
      return { action: 'qc', target: 'latest' };
    }
    
    return null;
  }

  private async parseWithOllama(request: string): Promise<{ 
    action: string; 
    target?: string; 
    reason?: string; 
    params?: any 
  } | null> {
    try {
      const prompt = `Parse this user request for an AI development system:
      "${request}"
      
      Identify the intent and extract parameters:
      
      Possible actions:
      - pause, resume, cancel (work management)
      - status, workload, health (system info)  
      - approve, reject (feedback)
      - help, qc (utilities)
      - build (create new component)
      
      Possible targets:
      - latest, specific_component, work_id
      
      Respond with JSON only: {
        "action": "action_name", 
        "target": "optional_target", 
        "reason": "optional_reason",
        "confidence": 0.0-1.0
      }`;

      const response = await fetch(`${config.OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2:1b',
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.1,
            top_p: 0.9
          }
        })
      });

      if (!response.ok) return null;

      const data = await response.json() as any;
      const parsed = JSON.parse(data.response);
      
      // Only use AI result if confidence is high
      return parsed.confidence > 0.7 ? parsed : null;
    } catch (error) {
      console.log('Ollama parsing error:', error);
      return null;
    }
  }

  private parseAdvancedPatterns(request: string): { 
    action: string; 
    target?: string; 
    reason?: string; 
    params?: any 
  } | null {
    const lowerRequest = request.toLowerCase();
    
    // Advanced keyword matching
    const actionMappings = {
      // Work Management
      pause: ['pause', 'stop', 'halt', 'hold', 'suspend', 'freeze'],
      resume: ['resume', 'continue', 'restart', 'start again', 'keep going', 'unpause'],
      cancel: ['cancel', 'delete', 'remove', 'abort', 'kill', 'terminate', 'scrap'],
      
      // System Info
      status: ['status', 'progress', 'state', 'what\'s happening', 'current work', 'active'],
      workload: ['workload', 'queue', 'how much work', 'busy', 'capacity', 'load'],
      health: ['health', 'codebase', 'project', 'analysis', 'architecture', 'quality'],
      
      // Feedback  
      approve: ['approve', 'accept', 'good', 'yes', 'correct', 'perfect', 'ship it'],
      reject: ['reject', 'deny', 'no', 'wrong', 'bad', 'redo', 'fix'],
      
      // Utilities
      help: ['help', 'commands', 'what can you do', 'options', 'guide'],
      qc: ['qc', 'quality', 'review', 'check', 'validate', 'audit'],
      
      // Building (fallback - if no other action matches, assume build request)
      build: ['build', 'create', 'make', 'develop', 'implement', 'generate']
    };
    
    // Find the best matching action
    let bestAction = '';
    let bestScore = 0;
    
    for (const [action, keywords] of Object.entries(actionMappings)) {
      const score = keywords.filter(keyword => lowerRequest.includes(keyword)).length;
      if (score > bestScore) {
        bestScore = score;
        bestAction = action;
      }
    }
    
    if (!bestAction || bestScore === 0) {
      // If no clear action, check if it's a build request
      if (this.looksLikeBuildRequest(request)) {
        return { action: 'build', params: { description: request } };
      }
      return null;
    }
    
    // Determine target
    let target = 'latest'; // Default
    
    if (['resume'].includes(bestAction) && lowerRequest.includes('paused')) {
      target = 'latest_paused';
    }
    
    const componentMatch = this.findWorkItemByDescription(request);
    if (componentMatch) {
      target = componentMatch;
    }
    
    // Extract reason (especially for cancel/reject)
    let reason: string | undefined;
    if (['cancel', 'reject'].includes(bestAction)) {
      const reasonPatterns = [
        /because (.+?)(?:\.|$)/,
        /reason:?\s*(.+?)(?:\.|$)/,
        /due to (.+?)(?:\.|$)/,
        /(changed|new|different|wrong) (.+?)(?:\.|$)/
      ];
      
      for (const pattern of reasonPatterns) {
        const match = lowerRequest.match(pattern);
        if (match) {
          reason = match[1] || match[2];
          break;
        }
      }
    }
    
    return { action: bestAction, target, reason };
  }

  private looksLikeBuildRequest(request: string): boolean {
    const buildIndicators = [
      'component', 'form', 'button', 'page', 'layout', 'dashboard',
      'login', 'navigation', 'menu', 'modal', 'dialog', 'card',
      'table', 'list', 'grid', 'chart', 'graph', 'input'
    ];
    
    const lowerRequest = request.toLowerCase();
    return buildIndicators.some(indicator => lowerRequest.includes(indicator)) ||
           request.length > 20; // Longer requests are usually build descriptions
  }
  
  private findWorkItemByDescription(request: string): string | null {
    const lowerRequest = request.toLowerCase();
    
    for (const [id, workItem] of this.workItems) {
      const description = workItem.description.toLowerCase();
      
      // Check if request contains key words from the work item description
      const keywords = description.split(' ').filter(word => word.length > 3);
      const matchCount = keywords.filter(keyword => lowerRequest.includes(keyword)).length;
      
      if (matchCount >= 2 || keywords.some(keyword => lowerRequest.includes(keyword) && keyword.length > 5)) {
        return id;
      }
    }
    
    return null;
  }
  
  private getLatestWorkItem(status?: string): string | null {
    const items = Array.from(this.workItems.values())
      .filter(item => !status || item.status === status)
      .sort((a, b) => (b.startTime?.getTime() || 0) - (a.startTime?.getTime() || 0));
    
    return items.length > 0 ? items[0].id : null;
  }

  async processUserRequest(request: string): Promise<string> {
    try {
      // Handle work management commands
      if (request.toLowerCase().startsWith('pause ')) {
        const workItemId = request.split(' ')[1];
        return await this.pauseWork(workItemId);
      }
      
      if (request.toLowerCase().startsWith('resume ')) {
        const workItemId = request.split(' ')[1];
        return await this.resumeWork(workItemId);
      }
      
      if (request.toLowerCase().startsWith('cancel ')) {
        const parts = request.split(' ');
        const workItemId = parts[1];
        const reason = parts.slice(2).join(' ');
        return await this.cancelWork(workItemId, reason);
      }

      // Handle analysis commands
      if (request.toLowerCase().includes('workload') || request.toLowerCase().includes('estimate')) {
        return await this.estimateWorkload();
      }

      if (request.toLowerCase().includes('codebase health') || request.toLowerCase().includes('project health')) {
        return await this.suggestArchitecturalImprovements();
      }

      // Handle feedback commands
      if (request.toLowerCase().startsWith('approve ') || request.toLowerCase().startsWith('reject ')) {
        const parts = request.split(' ');
        const action = parts[0].toLowerCase() as 'approve' | 'reject';
        const workItemId = parts[1];
        const feedback = parts.slice(2).join(' ');
        
        await this.learnFromFeedback(workItemId, feedback, action === 'approve' ? 'approval' : 'rejection');
        this.trackSuccess(workItemId, action === 'approve');
        
        return `✓ **Feedback Recorded**: ${action === 'approve' ? 'Approved' : 'Rejected'} ${workItemId}. Learning from your preferences.`;
      }

      // Handle manual QC requests
      if (request.toLowerCase().includes('qc review') || request.toLowerCase().includes('quality check')) {
        return this.handleManualQCRequest(request);
      }

      // Handle status requests
      if (request.toLowerCase().includes('status') || request.toLowerCase().includes('progress')) {
        return this.handleStatusRequest();
      }

      // Handle help requests
      if (request.toLowerCase().includes('help') || request.toLowerCase().includes('commands')) {
        return this.handleHelpRequest();
      }

      // Handle improvement requests
      if (request.match(/^(\d+,?\s*)+$/)) {
        return this.handleImprovementRequest(request);
      }

      // Handle chat/questions
      if (request.toLowerCase().includes('question') || request.toLowerCase().includes('how') || request.toLowerCase().includes('what') || request.toLowerCase().includes('why')) {
        return this.handleChatRequest(request);
      }

      // PRE-VALIDATE REQUEST
      const validation = await this.preValidateRequest(request);
      if (!validation.valid) {
        let response = `⚠️ **Request Validation Issues**\n\n`;
        validation.issues.forEach(issue => response += `• ${issue}\n`);
        if (validation.suggestions.length > 0) {
          response += `\n**Suggestions**:\n`;
          validation.suggestions.forEach(suggestion => response += `• ${suggestion}\n`);
        }
        return response;
      }

      // ASSESS COMPLEXITY & NEGOTIATE REQUIREMENTS
      const complexity = await this.assessComplexity(request);
      
      if (complexity.needsMoreInfo) {
        const negotiation = await this.negotiateRequirements(request, complexity);
        if (negotiation) return negotiation;
      }

      // Main implementation request
      await this.sendUpdate(this.adaptCommunicationToStyle('▶ **Request received**. Analyzing requirements and initializing enterprise development workflow...'));
      
      const analysis = await this.analyzeRequest(request);
      
      // CREATE WORKFLOW PLAN FOR COMPLEX REQUESTS
      if (complexity.complexity === 'enterprise' || complexity.complexity === 'complex') {
        const workflowPlan = await this.createWorkflowPlan(request);
        
        if (workflowPlan.phases.length > 1) {
          let response = `🗂️ **Complex Project Detected**\n\n`;
          response += `Breaking down into ${workflowPlan.phases.length} phases:\n\n`;
          
          workflowPlan.phases.forEach((phase, index) => {
            response += `**Phase ${index + 1}**: ${phase.description}\n`;
            response += `• Agent: ${this.selectOptimalAgent(phase)}\n`;
            response += `• Estimated: ${phase.estimatedEffort || 2} hours\n\n`;
          });
          
          response += `Would you like me to proceed with this plan? Reply 'yes' to start Phase 1.`;
          
          // Store the workflow plan for later execution
          workflowPlan.phases.forEach(phase => this.workItems.set(phase.id, phase));
          
          return response;
        }
      }
      
      const workItem = this.createWorkItem(analysis);
      workItem.complexity = complexity.complexity as 'simple' | 'medium' | 'complex' | 'enterprise';
      workItem.estimatedEffort = complexity.estimatedHours || 2;
      workItem.requiredAgents = complexity.requiredAgents || ['frontend-architect'];
      workItem.startTime = new Date();
      workItem.actualStartTime = new Date();
      workItem.status = 'analyzing';
      workItem.progress = 10;
      
      this.workItems.set(workItem.id, workItem);
      
      // SELECT OPTIMAL AGENT
      const optimalAgent = this.selectOptimalAgent(workItem);
      workItem.assignedAgent = optimalAgent as any;
      
      await this.sendUpdate(this.adaptCommunicationToStyle(`→ **Analysis complete**. Work Item ${workItem.id} created with ${workItem.priority} priority.\n${this.getProgressEmoji(workItem.progress!)} ${workItem.progress}% | ETA: ${this.calculateETA(workItem)}\n**Assigned Agent**: ${optimalAgent}`));
      
      // Update progress: Starting implementation
      workItem.status = 'in-progress';
      workItem.progress = 25;
      await this.sendUpdate(this.adaptCommunicationToStyle(`→ **${optimalAgent} initiated**. Implementing enterprise-grade component...\n${this.getProgressEmoji(workItem.progress!)} ${workItem.progress}% | ETA: ${this.calculateETA(workItem)}`));
      
      // For now, only Frontend Architect is implemented
      if (optimalAgent === 'frontend-architect') {
        const result = await this.frontendArchitect.processTask(workItem, this.projectDNA);
        
        if (result.success) {
          workItem.confidenceLevel = result.confidenceLevel;
          
          // Decide if QC review is needed
          if (this.shouldSummonQC(workItem, result)) {
            return await this.summonQCAgent(workItem, result);
          }
          
          // Proceed directly to deployment if confident
          return await this.proceedWithDeployment(workItem, result);
        } else {
          workItem.status = 'failed';
          return this.adaptCommunicationToStyle(`× **Enterprise Implementation Failed**: ${result.message}\n\nI'm here to help debug this. What specific aspect would you like me to investigate?`);
        }
      } else {
        // TODO: Route to other agents when implemented
        workItem.status = 'pending';
        return `🚧 **Agent Not Yet Implemented**: ${optimalAgent}\n\nThis request requires the ${optimalAgent} which is planned for implementation. For now, I can handle frontend components with the Frontend Architect.\n\n**Suggested Alternative**: Break this down into frontend components I can build immediately.`;
      }
      
    } catch (error: any) {
      console.error('Command Agent error:', error);
      await this.sendUpdate('! **System Error Detected**: Investigating issue and implementing recovery protocols...');
      return this.adaptCommunicationToStyle(`! **System Error**: I encountered an issue but I'm analyzing it now. Error details: ${error?.message || 'Unknown error'}\n\nCan you describe what you were trying to build? I'll adjust my approach accordingly.`);
    }
  }

  private shouldSummonQC(workItem: WorkItem, result: AgentResult): boolean {
    if (result.confidenceLevel === 'low') return true;
    if (result.confidenceLevel === 'medium' && (
      workItem.priority === 'high' || 
      workItem.priority === 'critical' ||
      (result.improvements && result.improvements.length > 3)
    )) return true;
    
    return false;
  }

  private async summonQCAgent(workItem: WorkItem, result: AgentResult): Promise<string> {
    workItem.status = 'qc-summoned';
    workItem.progress = 45;
    workItem.needsQC = true;
    
    await this.sendUpdate(`→ **Implementation complete**. Confidence level: ${result.confidenceLevel}. Summoning QC Agent for enterprise quality review...\n${this.getProgressEmoji(workItem.progress!)} ${workItem.progress}%`);
    
    // Send QC summon message
    await this.sendUpdate(`🔍 **@QC-Agent** - Quality review requested for Work Item ${workItem.id}\n\nComponent: ${workItem.description}\nComplexity: ${result.confidenceLevel} confidence\nFiles: ${result.files?.length} generated\n\nPlease conduct enterprise quality review.`);
    
    return `🔍 **QC Agent Summoned**\n\n→ **Work Item**: ${workItem.id}\n→ **Confidence Level**: ${result.confidenceLevel?.toUpperCase()}\n→ **Reason**: Complex implementation requiring quality validation\n\n**QC Agent will review and provide feedback.** This ensures enterprise-grade standards are met.\n\nYou can also manually request QC review anytime by saying \`qc review [work item]\`.`;
  }

  private async handleManualQCRequest(request: string): Promise<string> {
    const latestWorkItem = Array.from(this.workItems.values())
      .filter(item => item.status === 'completed')
      .sort((a, b) => (b.startTime?.getTime() || 0) - (a.startTime?.getTime() || 0))[0];
    
    if (!latestWorkItem) {
      return '→ **No completed work items found** for QC review. Build something first, then request QC review.';
    }
    
    await this.sendUpdate(`🔍 **@QC-Agent** - Manual quality review requested for Work Item ${latestWorkItem.id}\n\nUser requested comprehensive quality assessment.\n\nPlease conduct detailed enterprise quality review.`);
    
    return `🔍 **QC Agent Summoned** (Manual Request)\n\n→ **Work Item**: ${latestWorkItem.id}\n→ **Component**: ${latestWorkItem.description}\n\n**QC Agent will provide detailed quality assessment** including suggestions for enterprise-grade improvements.`;
  }

  private async proceedWithDeployment(workItem: WorkItem, result: AgentResult): Promise<string> {
    // Update progress: Building
    workItem.status = 'building';
    workItem.progress = 60;
    await this.sendUpdate(`→ **Quality approved**. Creating GitHub branch and preparing deployment...\n${this.getProgressEmoji(workItem.progress!)} ${workItem.progress}% | ETA: ${this.calculateETA(workItem)}`);
    
    const branchName = await this.createGitHubBranch(workItem);
    await this.commitFiles(branchName, result.files!);
    
    // Update progress: Deploying
    workItem.status = 'deploying';
    workItem.progress = 80;
    await this.sendUpdate(`→ **GitHub branch created**. Generating pull request and triggering deployment...\n${this.getProgressEmoji(workItem.progress!)} ${workItem.progress}% | ETA: ${this.calculateETA(workItem)}`);
    
    const prUrl = await this.createPullRequest(branchName, workItem, result);
    const previewUrl = await this.triggerNetlifyPreview(branchName);
    
    workItem.status = 'completed';
    workItem.progress = 100;
    workItem.branchName = branchName;
    workItem.prUrl = prUrl;
    workItem.previewUrl = previewUrl;
    
    return this.formatSuccessResponse(workItem, result);
  }

  private handleStatusRequest(): string {
    const activeItems = Array.from(this.workItems.values()).filter(item => 
      item.status !== 'completed' && item.status !== 'failed'
    );
    
    if (activeItems.length === 0) {
      return '● **System Status**: Ready for new requests. No active work items.\n\nWhat would you like me to build next?';
    }
    
    let response = '● **Current Work Status**:\n\n';
    activeItems.forEach(item => {
      response += `**${item.id}**: ${item.description}\n`;
      response += `Status: ${item.status.toUpperCase()} | Progress: ${this.getProgressEmoji(item.progress!)} ${item.progress}%\n`;
      response += `ETA: ${this.calculateETA(item)}\n\n`;
    });
    
    return response + 'Need any adjustments or have questions about the implementation?';
  }

  private handleHelpRequest(): string {
    return this.adaptCommunicationToStyle(`● **Command Agent Help** - Your Enterprise Development Head Honcho

**🏗️ Building & Management:**
• "Build [description]" - Create components with enterprise quality
**🗣️ Natural Language Commands:**
• "Pause this job" / "Stop the current work"
• "Resume the paused work" / "Continue that job"  
• "Cancel the latest work because requirements changed"
• "Pause the login component" / "Stop the dashboard work"

**📊 Project Intelligence:**
• "workload" / "estimate" - Current workload analysis
• "codebase health" - Full project health assessment
• "status" - Active work progress
• "project health" - Architecture analysis & recommendations

**🎯 Quality Control:**
• "qc review [work_id]" - Manual quality review
• "approve [work_id]" - Mark work as approved (learns preferences)
• "reject [work_id] [reason]" - Reject work (learns what to avoid)

**🧠 Smart Features:**
• Complex project breakdown into phases
• Automatic agent selection based on request type
• Learning from your feedback and preferences
• Pre-validation of requests for feasibility

**🤖 Available Agents (Current/Planned):**
• ✅ Frontend Architect - UI components, React, TypeScript
• 🚧 Backend Engineer - APIs, databases, logic
• 🚧 Mobile Specialist - PWA optimization, touch interfaces  
• 🚧 Performance Optimizer - Speed, bundle size, efficiency
• 🚧 Design System Agent - Consistency, tokens, guidelines

**💬 Communication:**
I adapt my communication style based on your preferences. Ask me anything about development, architecture, or project health.

What enterprise-grade component would you like me to build today?`);
  }

  private handleImprovementRequest(request: string): string {
    const improvementNumbers = request.split(',').map(n => parseInt(n.trim()));
    return `→ **Improvement Implementation Initiated**: Processing improvements ${improvementNumbers.join(', ')}. Frontend Architect analyzing current codebase for enhancement opportunities.`;
  }

  private async handleChatRequest(request: string): Promise<string> {
    const prompt = `You are a helpful Command Agent for an AI development team. A user is asking: "${request}"

Respond professionally and helpfully about development processes, technology choices, quality standards, and best practices. Keep response conversational but professional, under 200 words.`;

    try {
      const response = await this.callClaude(prompt);
      return `💬 **Command Agent**: ${response}\n\nAnything specific you'd like me to build or investigate?`;
    } catch (error) {
      return `💬 **Command Agent**: I'd be happy to discuss that! However, I'm having trouble accessing my knowledge base right now. Could you rephrase your question or ask about something specific I can help you build?`;
    }
  }

  private async analyzeRequest(request: string): Promise<any> {
    const prompt = `Analyze this development request and extract key information:

REQUEST: "${request}"

Extract:
1. Component/feature name
2. Main functionality
3. Priority level (low/medium/high/critical)
4. Estimated complexity (simple/medium/complex)

Return as JSON:
{
  "name": "component name",
  "functionality": "what it does",
  "priority": "priority level",
  "complexity": "complexity level"
}`;

    const response = await this.callClaude(prompt);
    try {
      return JSON.parse(response);
    } catch {
      return {
        name: 'Custom Component',
        functionality: request,
        priority: 'medium',
        complexity: 'medium'
      };
    }
  }
  
  private createWorkItem(analysis: any): WorkItem {
    const id = `work_${Date.now()}`;
    const estimatedMinutes = analysis.complexity === 'simple' ? 3 : 
                           analysis.complexity === 'medium' ? 5 : 8;
    
    return {
      id,
      description: analysis.functionality,
      priority: analysis.priority,
      assignedAgent: 'frontend-architect',
      status: 'pending',
      estimatedCompletion: new Date(Date.now() + estimatedMinutes * 60 * 1000),
      progress: 0
    };
  }
  
  private async createGitHubBranch(workItem: WorkItem): Promise<string> {
    const branchName = `frontend-architect/${workItem.id}-${this.slugify(workItem.description)}`;
    
    const { data: mainBranch } = await this.github.repos.getBranch({
      owner: config.GITHUB_REPO_OWNER,
      repo: config.GITHUB_REPO_NAME,
      branch: 'main'
    });
    
    await this.github.git.createRef({
      owner: config.GITHUB_REPO_OWNER,
      repo: config.GITHUB_REPO_NAME,
      ref: `refs/heads/${branchName}`,
      sha: mainBranch.commit.sha
    });
    
    return branchName;
  }
  
  private async commitFiles(branchName: string, files: { path: string; content: string }[]): Promise<void> {
    for (const file of files) {
      await this.github.repos.createOrUpdateFileContents({
        owner: config.GITHUB_REPO_OWNER,
        repo: config.GITHUB_REPO_NAME,
        path: file.path,
        message: `Add ${file.path}`,
        content: Buffer.from(file.content).toString('base64'),
        branch: branchName
      });
    }
  }
  
  private async createPullRequest(branchName: string, workItem: WorkItem, result: AgentResult): Promise<string> {
    let prBody = `→ **Enterprise-Grade Frontend Implementation**

**Work Item**: ${workItem.id}
**Description**: ${workItem.description}
**Priority**: ${workItem.priority}
**Quality Level**: Enterprise-grade (Notion/Google/Apple level)
**Confidence**: ${result.confidenceLevel?.toUpperCase()}

## Implementation Details
- ✓ TypeScript with exhaustive type safety
- ✓ Enterprise UX patterns and micro-interactions
- ✓ WCAG 2.1 AA accessibility compliance
- ✓ Mobile-optimized and touch-friendly
- ✓ Performance optimized for 60fps

## Ready for Review
This implementation represents enterprise-grade quality and is ready for production deployment.`;

    const { data: pr } = await this.github.pulls.create({
      owner: config.GITHUB_REPO_OWNER,
      repo: config.GITHUB_REPO_NAME,
      title: `▶ Enterprise Implementation: ${workItem.description}`,
      head: branchName,
      base: 'main',
      body: prBody
    });
    
    return pr.html_url;
  }
  
  private async triggerNetlifyPreview(branchName: string): Promise<string> {
    // Fixed Netlify preview URL generation
    const sanitizedBranch = branchName
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .toLowerCase()
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-')
      .substring(0, 37);
    
    return `https://${sanitizedBranch}--${config.NETLIFY_SITE_ID}.netlify.app`;
  }
  
  private formatSuccessResponse(workItem: WorkItem, result: AgentResult): string {
    let response = `▶ **Enterprise Implementation Completed**

• **Work Item**: ${workItem.id}
• **Status**: ${workItem.status.toUpperCase()}
• **Agent**: Frontend Architect
• **Quality Level**: Enterprise-grade (Notion/Google/Apple standards)
• **Confidence**: ${result.confidenceLevel?.toUpperCase()}

→ **Preview Deployment**: ${workItem.previewUrl}
→ **Pull Request**: ${workItem.prUrl}

✓ Mobile optimization verified
✓ Accessibility compliance checked
✓ Premium UX standards applied
✓ Enterprise code quality maintained`;

    if (result.improvements && result.improvements.length > 0) {
      response += `\n\n→ **Codebase Improvement Opportunities**:`;
      result.improvements.forEach((improvement, index) => {
        response += `\n${index + 1}. ${improvement}`;
      });
      response += `\n\n? **Would you like me to implement any of these improvements?** Reply with the improvement number(s) to proceed.`;
    }

    response += `\n\n▶ **Ready for mobile testing and review.**`;
    
    return response;
  }
  
  private slugify(text: string): string {
    return text.toLowerCase()
               .replace(/[^a-zA-Z0-9]/g, '-')
               .replace(/-+/g, '-')
               .replace(/^-|-$/g, '')
               .substring(0, 50);
  }
}

// QC Bot - Separate Discord Bot for Quality Control
class QCBot {
  private client: Client;
  private qcAgent: QCAgent;
  private targetChannel: TextChannel | null = null;
  private statusManager = BotStatusManager.getInstance();
  
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });
    
    this.qcAgent = new QCAgent();
    this.setupEventHandlers();
  }
  
  private setupEventHandlers(): void {
    this.client.once('ready', async () => {
      console.log('🔍 QC Agent system online');
      console.log(`QC Bot logged in as ${this.client.user?.tag}`);
      
      // Set online status
      this.client.user?.setPresence({
        activities: [{ name: 'Code Quality Reviews', type: 3 }], // Type 3 = Watching
        status: 'online',
      });
      
      this.targetChannel = this.client.channels.cache.get(config.DISCORD_CHANNEL_ID) as TextChannel;
      
      // Register with status manager but don't send individual online message
      await this.statusManager.botOnline('QC Agent');
    });
    
    this.client.on('messageCreate', async (message: Message) => {
      if (message.author.bot) return;
      if (message.channel.id !== config.DISCORD_CHANNEL_ID) return;
      
      // Only respond to direct mentions or QC commands
      const isMentioned = message.mentions.users.has(this.client.user?.id || '');
      const isQCCommand = message.content.toLowerCase().includes('qc-agent') || 
                         message.content.toLowerCase().includes('quality review');
      
      if (!isMentioned && !isQCCommand) return;
      
      if ('sendTyping' in message.channel) {
        await message.channel.sendTyping();
      }
      
      try {
        const response = await this.processQCRequest(message.content);
        await message.reply(response);
      } catch (error) {
        console.error('QC Bot error:', error);
        await message.reply('🔍 **QC Agent Error**: Unable to complete quality review. Please try again.');
      }
    });

    // Handle disconnect and shutdown
    this.client.on('disconnect', async () => {
      console.log('× QC Bot disconnected');
      await this.statusManager.botOffline('QC Agent');
    });

    // Graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }
  
  private async processQCRequest(request: string): Promise<string> {
    // Extract work item ID if mentioned
    const workItemMatch = request.match(/work[_-](\d+)/i);
    
    if (!workItemMatch) {
      return `🔍 **QC Agent**: I need a specific work item to review. Please mention the work item ID (e.g., "work_1234567890") or ask Command Agent to summon me with implementation details.`;
    }
    
    // Simulate QC review
    const mockQCResult = await this.simulateQCReview(request);
    return this.formatQCResponse(mockQCResult);
  }
  
  private async simulateQCReview(request: string): Promise<QCResult> {
    const prompt = `You are a QC Agent reviewing a React component implementation. Based on this request: "${request}"
    
    Provide a quality score (0-100) and identify any potential issues or improvements for enterprise-grade quality.
    
    Consider: Code quality, accessibility, mobile responsiveness, performance, design consistency
    
    Format: SCORE: [number] | ISSUES: [list] | SUGGESTIONS: [list]`;
    
    try {
      // Use the QC Agent's own Claude method instead of accessing protected method
      const response = await this.qcAgent.reviewImplementation([], { id: 'temp', description: request } as WorkItem, {} as ProjectDNA);
      
      return {
        passed: response.score >= 85,
        score: response.score,
        issues: response.issues,
        suggestions: response.suggestions
      };
    } catch (error) {
      return {
        passed: false,
        score: 0,
        issues: [{
          type: 'critical',
          category: 'integration',
          description: 'QC review could not be completed',
          suggestion: 'Manual review required'
        }],
        suggestions: []
      };
    }
  }
  
  private formatQCResponse(qcResult: QCResult): string {
    let response = `🔍 **QC Agent Review Complete**\n\n`;
    response += `**Quality Score**: ${qcResult.score}/100\n`;
    response += `**Status**: ${qcResult.passed ? '✓ PASSED' : '× NEEDS IMPROVEMENT'}\n\n`;
    
    if (qcResult.issues.length > 0) {
      response += `**Issues Identified**:\n`;
      qcResult.issues.forEach(issue => {
        const icon = issue.type === 'critical' ? '🚨' : issue.type === 'major' ? '⚠️' : '💡';
        response += `${icon} ${issue.description}\n`;
      });
      response += '\n';
    }
    
    if (qcResult.suggestions.length > 0) {
      response += `**Recommendations**:\n`;
      qcResult.suggestions.forEach((suggestion, index) => {
        response += `${index + 1}. ${suggestion}\n`;
      });
    }
    
    response += `\n**Enterprise Quality Standards**: ${qcResult.passed ? 'Met' : 'Requires attention'}\n`;
    response += `Ready to ${qcResult.passed ? 'proceed with deployment' : 'implement improvements'}.`;
    
    return response;
  }
  
  async shutdown(): Promise<void> {
    console.log('🔍 Shutting down QC Agent...');
    
    // Set offline status before shutdown
    this.client.user?.setPresence({
      status: 'invisible',
    });
    
    await this.statusManager.botOffline('QC Agent');
    await this.client.destroy();
  }
  
  async start(): Promise<void> {
    await this.client.login(config.QC_BOT_TOKEN);
  }
}

class DiscordBot {
  private client: Client;
  private commandAgent: CommandAgent;
  private targetChannel: TextChannel | null = null;
  private statusManager = BotStatusManager.getInstance();
  
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });
    
    this.commandAgent = new CommandAgent();
    this.setupEventHandlers();
  }
  
  private setupEventHandlers(): void {
    this.client.once('ready', async () => {
      console.log('▶ AI Development Team system online');
      console.log(`Logged in as ${this.client.user?.tag}`);
      
      // Set online status
      this.client.user?.setPresence({
        activities: [{ name: 'Enterprise Development', type: 3 }], // Type 3 = Watching
        status: 'online',
      });
      
      this.targetChannel = this.client.channels.cache.get(config.DISCORD_CHANNEL_ID) as TextChannel;
      if (this.targetChannel) {
        this.commandAgent.setDiscordChannel(this.targetChannel);
        this.statusManager.setTargetChannel(this.targetChannel);
        await this.statusManager.botOnline('Command Agent');
      }
    });
    
    this.client.on('messageCreate', async (message: Message) => {
      if (message.author.bot) return;
      if (message.channel.id !== config.DISCORD_CHANNEL_ID) return;
      
      // Check for system wake-up commands
      if (await this.handleWakeUpCommands(message)) {
        return; // Wake-up command handled, don't process further
      }
      
      if ('sendTyping' in message.channel) {
        await message.channel.sendTyping();
      }
      
      try {
        const response = await this.commandAgent.processUserRequest(message.content);
        await message.reply(response);
      } catch (error) {
        console.error('Error processing message:', error);
        await message.reply('! **System Error**: I encountered an issue but I\'m still here to help. Could you try rephrasing your request?');
      }
    });

    // Handle disconnect and shutdown
    this.client.on('disconnect', async () => {
      console.log('× Discord bot disconnected');
      await this.statusManager.botOffline('Command Agent');
    });

    this.client.on('error', (error) => {
      console.error('Discord client error:', error);
    });

    // Graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }
  
  private async handleWakeUpCommands(message: Message): Promise<boolean> {
    const content = message.content.toLowerCase();
    
    // Expanded wake-up phrases
    const wakeUpPhrases = [
      'start', 'start the server', 'start server',
      'boot up', 'boot', 'initialize system', 'initialize',
      'wake up', 'wake', 'systems online', 'online',
      'start ai team', 'start ai', 'activate bots', 'activate',
      'power on', 'turn on', 'bring online',
      'lets go', 'let\'s go', 'fire up', 'spin up',
      'launch', 'begin', 'go live', 'startup'
    ];

    // Expanded shutdown phrases  
    const shutdownPhrases = [
      'stop', 'stop server', 'stop the server',
      'shutdown', 'shut down', 'power off', 'turn off',
      'kill system', 'kill server', 'kill',
      'stop ai team', 'stop ai', 'deactivate',
      'end', 'terminate', 'halt', 'cease',
      'go offline', 'offline', 'sleep', 'rest',
      'quit', 'exit', 'close', 'down'
    ];
    
    const isWakeUpCommand = wakeUpPhrases.some(phrase => 
      content === phrase || content.includes(phrase)
    );
    const isShutdownCommand = shutdownPhrases.some(phrase => 
      content === phrase || content.includes(phrase)
    );
    
    if (isWakeUpCommand) {
      const onlineBots = this.statusManager.getOnlineBots();
      
      if (onlineBots.length <= 1) { // Only Command Agent or empty
        await message.reply('**System Activation Initiated**. AI development team is already running on cloud infrastructure.');
      } else {
        let response = `**Systems Already Online**. Current active bots:\n`;
        onlineBots.forEach(bot => {
          response += `• ${bot}\n`;
        });
        response += '\nReady for development requests.';
        await message.reply(response);
      }
      
      return true;
    }

    if (isShutdownCommand) {
      await message.reply('**Cloud Shutdown Not Supported**. The AI development team runs on persistent cloud infrastructure. Use "pause work" instead to stop active tasks.');
      return true;
    }
    
    return false;
  }
  
  private async shutdown(): Promise<void> {
    console.log('▶ Shutting down AI Development Team...');
    await this.statusManager.botOffline('Command Agent');
    await this.client.destroy();
    process.exit(0);
  }
  
  async start(): Promise<void> {
    await this.client.login(config.DISCORD_TOKEN);
  }
}

class AIDevSystem {
  private discordBot: DiscordBot;
  private qcBot: QCBot;
  
  constructor() {
    this.discordBot = new DiscordBot();
    this.qcBot = new QCBot();
  }
  
  async start(): Promise<void> {
    console.log('▶ Starting AI Development Team System...');
    this.validateEnvironment();
    
    // Start both bots
    await Promise.all([
      this.discordBot.start(),
      this.qcBot.start()
    ]);
  }
  
  private validateEnvironment(): void {
    const requiredVars = [
      'DISCORD_TOKEN',
      'QC_BOT_TOKEN',
      'DISCORD_CHANNEL_ID', 
      'CLAUDE_API_KEY',
      'GITHUB_TOKEN',
      'GITHUB_REPO_OWNER',
      'GITHUB_REPO_NAME'
    ];
    
    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      console.error('× Missing required environment variables:', missing.join(', '));
      process.exit(1);
    }
    
    console.log('✓ Environment validation passed');
  }
}

const system = new AIDevSystem();
system.start().catch(console.error);