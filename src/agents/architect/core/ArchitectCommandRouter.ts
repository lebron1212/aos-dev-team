import { ArchitectConfig } from '../types/index.js';
import { ArchitectOrchestrator } from './ArchitectOrchestrator.js';
import { ArchitectVoice } from '../communication/ArchitectVoice.js';
import { CodeIntelligence } from '../intelligence/CodeIntelligence.js';
import { CodeAnalyzer } from '../intelligence/CodeAnalyzer.js';

interface CommandResult {
  success: boolean;
  response: string;
  requiresFollowUp?: boolean;
}

export class ArchitectCommandRouter {
  private orchestrator: ArchitectOrchestrator;
  private voice: ArchitectVoice;
  private intelligence: CodeIntelligence;
  private analyzer: CodeAnalyzer;

  constructor(config: ArchitectConfig) {
    this.orchestrator = new ArchitectOrchestrator(config);
    this.voice = new ArchitectVoice(config.claudeApiKey);
    this.intelligence = new CodeIntelligence(config.claudeApiKey);
    this.analyzer = new CodeAnalyzer(config.claudeApiKey);
  }

  async routeCommand(input: string, userId: string, messageId: string): Promise<string> {
    console.log(`[ArchitectCommandRouter] Processing: "${input}"`);

    const cleanInput = input.trim();
    
    // Handle slash commands
    if (cleanInput.startsWith('/')) {
      return await this.handleSlashCommand(cleanInput, userId);
    }

    // Handle direct commands
    const commandResult = await this.handleDirectCommand(cleanInput, userId);
    if (commandResult.success) {
      return commandResult.response;
    }

    // Fall back to natural language processing
    return await this.handleNaturalLanguage(cleanInput, userId);
  }

  private async handleSlashCommand(command: string, userId: string): Promise<string> {
    const parts = command.slice(1).split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'help':
        return await this.showHelp(args[0]);
        
      case 'status':
        return await this.showSystemStatus();
        
      case 'analyze':
        return await this.handleAnalyze(args.join(' '));
        
      case 'build':
        return await this.handleBuild(args.join(' '));
        
      case 'modify':
        return await this.handleModify(args.join(' '));
        
      case 'config':
        return await this.handleConfig(args.join(' '));
        
      case 'undo':
        return await this.handleUndo();
        
      case 'history':
        return await this.showHistory();
        
      case 'intelligence':
        return await this.handleIntelligence(args.join(' '));
        
      default:
        return await this.voice.formatResponse(`Unknown command: /${cmd}. Type /help for available commands.`, { type: 'error' });
    }
  }

  private async handleDirectCommand(input: string, userId: string): Promise<CommandResult> {
    const lower = input.toLowerCase();

    // Direct command patterns
    if (lower.includes('help') || lower === '?') {
      return {
        success: true,
        response: await this.showHelp()
      };
    }

    if (lower.includes('status') || lower.includes('health')) {
      return {
        success: true,
        response: await this.showSystemStatus()
      };
    }

    if (lower.startsWith('analyze ') || lower.includes('code analysis')) {
      return {
        success: true,
        response: await this.handleAnalyze(input)
      };
    }

    if (lower.startsWith('build ') || lower.includes('create agent')) {
      return {
        success: true,
        response: await this.handleBuild(input)
      };
    }

    if (lower.includes('undo') || lower.includes('revert')) {
      return {
        success: true,
        response: await this.handleUndo()
      };
    }

    return { success: false, response: '' };
  }

  private async handleNaturalLanguage(input: string, userId: string): Promise<string> {
    // Route to orchestrator for natural language processing
    const request = {
      type: 'system-modification' as const,
      description: input,
      target: '',
      priority: 'medium' as const,
      riskLevel: 'medium' as const
    };

    return await this.orchestrator.executeArchitecturalWork(request);
  }

  private async showHelp(category?: string): Promise<string> {
    if (category) {
      return await this.showCategoryHelp(category);
    }

    const helpText = `🏗️ **Architect Command Reference**

**📋 Basic Commands**
\`/help [category]\` - Show this help (try: analyze, build, modify, config)
\`/status\` - System health and status
\`/history\` - Recent modifications and changes

**🔍 Analysis Commands**
\`/analyze [target]\` - Analyze codebase or specific files
\`/intelligence [query]\` - Smart code queries (e.g., "what's commander's token limit?")

**🏗️ Building Commands**
\`/build agent [name]\` - Create a new agent
\`/build [description]\` - General building tasks

**⚙️ Modification Commands**
\`/modify [description]\` - Modify existing code
\`/config [query]\` - View or modify configuration
\`/undo\` - Undo last modification

**💡 Natural Language**
You can also use natural language:
• "Analyze the voice system"
• "What's Commander's current token limit?"
• "Increase response length to 3 sentences"
• "Create a new monitoring agent"
• "Set up Discord bot for Dashboard"

**🎯 Quick Examples**
\`/analyze src/agents/commander\`
\`/intelligence commander voice settings\`
\`/modify increase token limit to 200\`
\`/build agent named Monitor for system monitoring\``;

    return await this.voice.formatResponse(helpText, { type: 'help' });
  }

  private async showCategoryHelp(category: string): Promise<string> {
    const lower = category.toLowerCase();

    switch (lower) {
      case 'analyze':
        return await this.voice.formatResponse(`🔍 **Analysis Commands**

\`/analyze\` - Full system health analysis
\`/analyze [path]\` - Analyze specific files/directories
\`/analyze agents\` - Analyze all agents
\`/analyze performance\` - Performance analysis
\`/analyze dependencies\` - Dependency analysis

**Examples:**
\`/analyze src/agents/commander\`
\`/analyze voice system\`
\`/analyze api usage\``, { type: 'help' });

      case 'build':
        return await this.voice.formatResponse(`🏗️ **Building Commands**

\`/build agent [name]\` - Create new agent with Discord integration
\`/build component [description]\` - Create new component
\`/build feature [description]\` - Add new feature
\`/build discord bot for [agent]\` - Set up Discord bot

**Examples:**
\`/build agent named Monitor for system monitoring\`
\`/build discord bot for Dashboard agent\`
\`/build voice recognition feature\``, { type: 'help' });

      case 'modify':
        return await this.voice.formatResponse(`⚙️ **Modification Commands**

\`/modify [description]\` - General modifications
\`/config [query]\` - View/modify configuration
\`/config set [property] [value]\` - Set configuration value

**Examples:**
\`/modify increase commander response length\`
\`/config commander voice settings\`
\`/config set max_tokens 200\``, { type: 'help' });

      case 'config':
        return await this.voice.formatResponse(`🔧 **Configuration Commands**

\`/config\` - Show all configuration
\`/config [component]\` - Show component config
\`/config [property]\` - Show specific property
\`/config set [property] [value]\` - Modify configuration

**Examples:**
\`/config commander\`
\`/config max_tokens\`
\`/config set response_length 150\``, { type: 'help' });

      default:
        return await this.showHelp();
    }
  }

  private async showSystemStatus(): Promise<string> {
    try {
      const analysis = await this.analyzer.analyzeSystemHealth();
      
      const statusText = `🏗️ **System Status Report**

**📊 Health Metrics**
• Files Analyzed: ${analysis.metrics.filesAnalyzed}
• Lines of Code: ${analysis.metrics.linesOfCode.toLocaleString()}
• Complexity Score: ${analysis.metrics.complexityScore}/10

**💡 System Summary**
${analysis.summary}

**⚠️ Issues Found**
${analysis.issues.length > 0 ? analysis.issues.map(issue => `• ${issue}`).join('\n') : '• No critical issues detected'}

**🚀 Recommendations**
${analysis.recommendations.length > 0 ? analysis.recommendations.map(rec => `• ${rec}`).join('\n') : '• System is performing well'}

**📈 API Usage**
• Tokens Used: ${analysis.apiUsage.tokens.toLocaleString()}
• Cost: $${analysis.apiUsage.cost.toFixed(4)}
• Duration: ${analysis.apiUsage.duration}ms`;

      return await this.voice.formatResponse(statusText, { type: 'status' });
    } catch (error) {
      return await this.voice.formatResponse(`Status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { type: 'error' });
    }
  }

  private async handleAnalyze(target: string): Promise<string> {
    if (!target.trim()) {
      return await this.showSystemStatus();
    }

    const request = {
      type: 'code-analysis' as const,
      description: `Analyze ${target}`,
      target,
      priority: 'medium' as const,
      riskLevel: 'low' as const
    };

    return await this.orchestrator.executeArchitecturalWork(request);
  }

  private async handleBuild(description: string): Promise<string> {
    if (!description.trim()) {
      return await this.voice.formatResponse("Please specify what to build. Examples:\n• `/build agent named Monitor`\n• `/build discord bot for Dashboard`", { type: 'error' });
    }

    const request = {
      type: 'agent-creation' as const,
      description: `Build ${description}`,
      priority: 'medium' as const,
      riskLevel: 'medium' as const
    };

    return await this.orchestrator.executeArchitecturalWork(request);
  }

  private async handleModify(description: string): Promise<string> {
    if (!description.trim()) {
      return await this.voice.formatResponse("Please specify what to modify. Examples:\n• `/modify increase response length`\n• `/modify commander voice settings`", { type: 'error' });
    }

    const request = {
      type: 'system-modification' as const,
      description,
      priority: 'medium' as const,
      riskLevel: 'medium' as const
    };

    return await this.orchestrator.executeArchitecturalWork(request);
  }

  private async handleConfig(query: string): Promise<string> {
    if (!query.trim()) {
      return await this.voice.formatResponse("Configuration overview:\n• Use `/config [component]` to view specific settings\n• Use `/intelligence [query]` for smart config queries", { type: 'help' });
    }

    // Route config queries through intelligence
    return await this.handleIntelligence(`configuration: ${query}`);
  }

  private async handleIntelligence(query: string): Promise<string> {
    if (!query.trim()) {
      return await this.voice.formatResponse("Smart queries help you understand your codebase:\n• `What's Commander's token limit?`\n• `Show Discord configuration`\n• `How does feedback learning work?`", { type: 'help' });
    }

    return await this.intelligence.processQuery(query);
  }

  private async handleUndo(): Promise<string> {
    const request = {
      type: 'system-modification' as const,
      description: 'undo last modification',
      priority: 'high' as const,
      riskLevel: 'low' as const
    };

    return await this.orchestrator.executeArchitecturalWork(request);
  }

  private async showHistory(): Promise<string> {
    const request = {
      type: 'system-modification' as const,
      description: 'show modification history',
      priority: 'low' as const,
      riskLevel: 'low' as const
    };

    return await this.orchestrator.executeArchitecturalWork(request);
  }
}
