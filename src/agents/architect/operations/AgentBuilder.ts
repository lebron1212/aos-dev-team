import { AgentSpec } from '../types/index.js';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import { execSync } from 'child_process';

export class AgentBuilder {
  private claude: Anthropic;

  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
  }

  async parseAgentRequirements(request: string): Promise<AgentSpec> {
    console.log(`[AgentBuilder] Parsing requirements: ${request}`);
    
    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Parse this agent creation request and extract specifications:

REQUEST: ${request}

Analyze what kind of agent is needed and respond in JSON format:
{
  "name": "AgentClassName",
  "purpose": "What this agent does",
  "capabilities": ["capability1", "capability2"],
  "dependencies": ["@anthropic-ai/sdk", "discord.js"],
  "structure": {
    "core": ["AgentName.ts", "AgentOrchestrator.ts"],
    "intelligence": ["AgentIntelligence.ts"],
    "communication": ["AgentVoice.ts", "AgentDiscord.ts"]
  },
  "discordIntegration": true,
  "voicePersonality": "Brief description of agent personality",
  "createWatcher": true,
  "watcherPurpose": "What patterns this watcher should learn"
}

Examples:
- "performance monitoring agent" → PerformanceMonitor + PerformanceWatch
- "deployment manager" → DeploymentManager + DeploymentWatch
- "code quality checker" → QualityChecker + QualityWatch

Always include a watcher for learning and eventual local model replacement.`
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        try {
          const parsed = JSON.parse(content.text);
          return {
            name: parsed.name || 'CustomAgent',
            purpose: parsed.purpose || 'Custom functionality',
            capabilities: parsed.capabilities || ['basic-processing'],
            dependencies: parsed.dependencies || ['@anthropic-ai/sdk'],
            structure: parsed.structure || {
              core: [`${parsed.name || 'CustomAgent'}.ts`],
              intelligence: [`${parsed.name || 'CustomAgent'}Intelligence.ts`],
              communication: [`${parsed.name || 'CustomAgent'}Voice.ts`]
            },
            discordIntegration: parsed.discordIntegration !== false,
            voicePersonality: parsed.voicePersonality || 'Professional and helpful',
            createWatcher: parsed.createWatcher !== false,
            watcherPurpose: parsed.watcherPurpose || `Learning patterns for ${parsed.name || 'agent'} optimization`
          };
        } catch (parseError) {
          console.error('[AgentBuilder] Failed to parse agent spec:', parseError);
        }
      }
    } catch (error) {
      console.error('[AgentBuilder] Agent spec parsing failed:', error);
    }

    return this.fallbackAgentSpec(request);
  }

  async generateAgent(spec: AgentSpec): Promise<any> {
    console.log(`[AgentBuilder] Building complete agent: ${spec.name} with watcher`);
    
    const agentPath = `src/agents/${spec.name.toLowerCase()}`;
    const watcherPath = `src/agents/watcher/${spec.name.toLowerCase()}watch`;
    const createdFiles: string[] = [];
    
    try {
      // 1. Create directory structures
      await this.createAgentDirectories(agentPath);
      if (spec.createWatcher) {
        await this.createWatcherDirectories(watcherPath);
      }
      
      // 2. Generate core agent files
      const coreFiles = await this.generateCoreFiles(spec, agentPath);
      createdFiles.push(...coreFiles);
      
      // 3. Generate intelligence files
      const intelligenceFiles = await this.generateIntelligenceFiles(spec, agentPath);
      createdFiles.push(...intelligenceFiles);
      
      // 4. Generate communication files
      const commFiles = await this.generateCommunicationFiles(spec, agentPath);
      createdFiles.push(...commFiles);
      
      // 5. Generate types
      const typesFile = await this.generateTypesFile(spec, agentPath);
      createdFiles.push(typesFile);
      
      // 6. Generate index file
      const indexFile = await this.generateIndexFile(spec, agentPath);
      createdFiles.push(indexFile);
      
      // 7. Generate watcher if requested
      if (spec.createWatcher) {
        const watcherFiles = await this.generateWatcherFiles(spec, watcherPath);
        createdFiles.push(...watcherFiles);
      }
      
      // 8. Update main index.ts to include new agent
      await this.updateMainIndex(spec);
      
      // 9. Commit the new agent
      await this.commitNewAgent(spec, createdFiles);
      
      return {
        summary: `Agent ${spec.name} created with full Discord integration${spec.createWatcher ? ' and learning watcher' : ''}`,
        files: createdFiles,
        capabilities: spec.capabilities,
        ready: true,
        discordSetupNeeded: spec.discordIntegration,
        watcherCreated: spec.createWatcher,
        environmentVars: spec.discordIntegration ? [
          `${spec.name.toUpperCase()}_DISCORD_TOKEN`,
          `${spec.name.toUpperCase()}_CHANNEL_ID`
        ] : []
      };
      
    } catch (error) {
      console.error(`[AgentBuilder] Failed to build agent ${spec.name}:`, error);
      return {
        summary: `Failed to create agent ${spec.name}: ${error.message}`,
        files: createdFiles,
        ready: false,
        error: error.message
      };
    }
  }

  private async createWatcherDirectories(basePath: string): Promise<void> {
    const dirs = [
      basePath,
      `${basePath}/core`,
      `${basePath}/intelligence`, 
      `${basePath}/communication`,
      `${basePath}/types`
    ];
    
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private async generateWatcherFiles(spec: AgentSpec, watcherPath: string): Promise<string[]> {
    const files: string[] = [];
    const watcherName = `${spec.name}Watch`;
    
    // Main watcher file
    const mainFile = `${watcherPath}/${watcherName}.ts`;
    const mainContent = await this.generateWatcherMainFile(spec, watcherName);
    await fs.writeFile(mainFile, mainContent);
    files.push(mainFile);
    
    // Watcher intelligence
    const intelligenceFile = `${watcherPath}/intelligence/${watcherName}Intelligence.ts`;
    const intelligenceContent = await this.generateWatcherIntelligenceFile(spec, watcherName);
    await fs.writeFile(intelligenceFile, intelligenceContent);
    files.push(intelligenceFile);
    
    // Watcher core analyzer
    const coreFile = `${watcherPath}/core/${watcherName}Analyzer.ts`;
    const coreContent = await this.generateWatcherCoreFile(spec, watcherName);
    await fs.writeFile(coreFile, coreContent);
    files.push(coreFile);
    
    // Watcher types
    const typesFile = `${watcherPath}/types/index.ts`;
    const typesContent = await this.generateWatcherTypesFile(spec, watcherName);
    await fs.writeFile(typesFile, typesContent);
    files.push(typesFile);
    
    // Watcher index
    const indexFile = `${watcherPath}/index.ts`;
    const indexContent = `export { ${watcherName} } from './${watcherName}.js';\nexport * from './types/index.js';`;
    await fs.writeFile(indexFile, indexContent);
    files.push(indexFile);
    
    return files;
  }

  private async generateWatcherMainFile(spec: AgentSpec, watcherName: string): Promise<string> {
    return `import fs from 'fs/promises';
import { ${watcherName}Intelligence } from './intelligence/${watcherName}Intelligence.js';
import { ${watcherName}Analyzer } from './core/${watcherName}Analyzer.js';

interface ${spec.name}Interaction {
  timestamp: string;
  input: string;
  response: string;
  context: string[];
  feedback?: string;
  quality: 'good' | 'needs_improvement';
  category: string;
  confidence: number;
  apiUsed: 'claude' | 'local' | 'hybrid';
}

export class ${watcherName} {
  private intelligence: ${watcherName}Intelligence;
  private analyzer: ${watcherName}Analyzer;
  private interactions: ${spec.name}Interaction[] = [];
  private interactionsFile = 'data/${spec.name.toLowerCase()}-interactions.json';
  private isWatching = true;
  private localModelReady = false;

  constructor() {
    this.intelligence = new ${watcherName}Intelligence();
    this.analyzer = new ${watcherName}Analyzer();
    this.loadInteractions();
    console.log('[${watcherName}] Learning system initialized - ${spec.watcherPurpose}');
  }

  async log${spec.name}Interaction(
    input: string,
    response: string,
    context: string[],
    feedback?: string
  ): Promise<void> {
    if (!this.isWatching) return;

    const interaction: ${spec.name}Interaction = {
      timestamp: new Date().toISOString(),
      input: input.trim(),
      response: response.trim(),
      context: context.slice(-3),
      feedback,
      quality: this.evaluateQuality(response, feedback),
      category: this.categorizeInteraction(input, response),
      confidence: this.calculateConfidence(response, feedback),
      apiUsed: 'claude'
    };

    this.interactions.push(interaction);

    if (this.interactions.length > 1000) {
      this.interactions = this.interactions.slice(-1000);
    }

    await this.saveInteractions();

    console.log(\`[${watcherName}] Logged \${interaction.category} interaction: quality \${interaction.quality}, confidence \${interaction.confidence.toFixed(2)}\`);

    if (feedback) {
      await this.processFeedback(interaction);
    }
  }

  async getTrainingStats(): Promise<any> {
    const goodInteractions = this.interactions.filter(i => i.quality === 'good').length;
    const totalInteractions = this.interactions.length;
    const categories = this.getCategoryBreakdown();

    return {
      purpose: '${spec.watcherPurpose}',
      totalInteractions,
      goodInteractions,
      qualityRatio: totalInteractions > 0 ? goodInteractions / totalInteractions : 0,
      categories,
      localModelReady: this.localModelReady,
      watchingStatus: this.isWatching ? 'active' : 'paused'
    };
  }

  async shouldUseLocalModel(inputType: string): Promise<boolean> {
    const goodCount = this.interactions.filter(i => 
      i.quality === 'good' && 
      i.category === this.categorizeByInput(inputType)
    ).length;

    return this.localModelReady && goodCount >= 50; // Threshold for local usage
  }

  private evaluateQuality(response: string, feedback?: string): 'good' | 'needs_improvement' {
    if (feedback) {
      const negative = /bad|wrong|terrible|don't|avoid/i.test(feedback);
      const positive = /good|great|perfect|excellent/i.test(feedback);
      if (negative) return 'needs_improvement';
      if (positive) return 'good';
    }

    // Default quality assessment based on response characteristics
    const wordCount = response.split(/\\s+/).length;
    const hasErrors = response.includes('error') || response.includes('failed');
    
    return wordCount > 5 && !hasErrors ? 'good' : 'needs_improvement';
  }

  private categorizeInteraction(input: string, response: string): string {
    // Categorize based on ${spec.name} specific patterns
    ${spec.capabilities.map(cap => `if (input.toLowerCase().includes('${cap.toLowerCase()}')) return '${cap}';`).join('\n    ')}
    return 'general';
  }

  private categorizeByInput(input: string): string {
    return this.categorizeInteraction(input, '');
  }

  private calculateConfidence(response: string, feedback?: string): number {
    let confidence = 0.7;
    
    if (feedback) {
      if (/excellent|perfect|great/i.test(feedback)) confidence = 0.9;
      if (/bad|wrong|terrible/i.test(feedback)) confidence = 0.3;
    }

    const wordCount = response.split(/\\s+/).length;
    if (wordCount >= 5 && wordCount <= 50) confidence += 0.1;

    return Math.max(0.1, Math.min(0.9, confidence));
  }

  private getCategoryBreakdown(): Record<string, number> {
    const breakdown: Record<string, number> = {};
    this.interactions.forEach(i => {
      breakdown[i.category] = (breakdown[i.category] || 0) + 1;
    });
    return breakdown;
  }

  private async processFeedback(interaction: ${spec.name}Interaction): Promise<void> {
    if (interaction.feedback) {
      console.log(\`[${watcherName}] Processing feedback: \${interaction.feedback}\`);
      // Learn from feedback patterns
    }
  }

  private async loadInteractions(): Promise<void> {
    try {
      const data = await fs.readFile(this.interactionsFile, 'utf8');
      this.interactions = JSON.parse(data);
      console.log(\`[${watcherName}] Loaded \${this.interactions.length} previous interactions\`);
    } catch (error) {
      this.interactions = [];
      console.log(\`[${watcherName}] No previous interactions found, starting fresh\`);
    }
  }

  private async saveInteractions(): Promise<void> {
    try {
      await fs.mkdir('data', { recursive: true });
      await fs.writeFile(this.interactionsFile, JSON.stringify(this.interactions, null, 2));
    } catch (error) {
      console.error(\`[${watcherName}] Failed to save interactions:\`, error);
    }
  }

  pauseWatching(): void {
    this.isWatching = false;
    console.log(\`[${watcherName}] Paused watching\`);
  }

  resumeWatching(): void {
    this.isWatching = true;
    console.log(\`[${watcherName}] Resumed watching\`);
  }
}`;
  }

  private async generateWatcherIntelligenceFile(spec: AgentSpec, watcherName: string): Promise<string> {
    return `export class ${watcherName}Intelligence {
  
  constructor() {
    console.log('[${watcherName}Intelligence] Learning intelligence initialized');
  }

  analyzePatterns(interactions: any[]): any {
    // Analyze interaction patterns for ${spec.name}
    const patterns = {
      commonInputs: this.extractCommonInputs(interactions),
      responsePatterns: this.extractResponsePatterns(interactions),
      successFactors: this.identifySuccessFactors(interactions)
    };

    return patterns;
  }

  private extractCommonInputs(interactions: any[]): string[] {
    // Extract frequently seen input patterns
    const inputs = interactions.map(i => i.input.toLowerCase());
    const frequency: Record<string, number> = {};
    
    inputs.forEach(input => {
      const words = input.split(' ');
      words.forEach(word => {
        if (word.length > 3) {
          frequency[word] = (frequency[word] || 0) + 1;
        }
      });
    });

    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  private extractResponsePatterns(interactions: any[]): any[] {
    // Identify successful response patterns
    return interactions
      .filter(i => i.quality === 'good')
      .map(i => ({
        length: i.response.split(' ').length,
        tone: this.analyzeTone(i.response),
        category: i.category
      }));
  }

  private identifySuccessFactors(interactions: any[]): string[] {
    const goodInteractions = interactions.filter(i => i.quality === 'good');
    const factors: string[] = [];

    const avgLength = goodInteractions.reduce((sum, i) => sum + i.response.split(' ').length, 0) / goodInteractions.length;
    if (avgLength < 20) factors.push('Concise responses');
    if (avgLength > 50) factors.push('Detailed responses');

    return factors;
  }

  private analyzeTone(response: string): string {
    if (response.includes('!')) return 'enthusiastic';
    if (response.includes('?')) return 'questioning';
    return 'neutral';
  }
}`;
  }

  private async generateWatcherCoreFile(spec: AgentSpec, watcherName: string): Promise<string> {
    return `export class ${watcherName}Analyzer {
  
  constructor() {
    console.log('[${watcherName}Analyzer] Pattern analyzer initialized');
  }

  analyzePerformance(interactions: any[]): any {
    const recentInteractions = interactions.filter(i => 
      new Date(i.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    return {
      totalInteractions: interactions.length,
      recentInteractions: recentInteractions.length,
      qualityTrend: this.calculateQualityTrend(recentInteractions),
      categoryDistribution: this.getCategoryDistribution(interactions),
      improvementAreas: this.identifyImprovementAreas(interactions)
    };
  }

  private calculateQualityTrend(interactions: any[]): string {
    const windows = this.createTimeWindows(interactions, 3); // 3-hour windows
    
    if (windows.length < 2) return 'stable';
    
    const recent = windows.slice(-2);
    const change = recent[1].qualityRatio - recent[0].qualityRatio;
    
    if (Math.abs(change) < 0.1) return 'stable';
    return change > 0 ? 'improving' : 'declining';
  }

  private createTimeWindows(interactions: any[], hours: number): any[] {
    const now = Date.now();
    const windows = [];
    
    for (let i = 0; i < 8; i++) { // Last 8 windows
      const start = now - (i + 1) * hours * 60 * 60 * 1000;
      const end = now - i * hours * 60 * 60 * 1000;
      
      const windowInteractions = interactions.filter(int => {
        const timestamp = new Date(int.timestamp).getTime();
        return timestamp >= start && timestamp < end;
      });
      
      const goodCount = windowInteractions.filter(i => i.quality === 'good').length;
      
      windows.unshift({
        period: i,
        interactions: windowInteractions,
        count: windowInteractions.length,
        qualityRatio: windowInteractions.length > 0 ? goodCount / windowInteractions.length : 0
      });
    }
    
    return windows;
  }

  private getCategoryDistribution(interactions: any[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    interactions.forEach(i => {
      distribution[i.category] = (distribution[i.category] || 0) + 1;
    });
    return distribution;
  }

  private identifyImprovementAreas(interactions: any[]): string[] {
    const areas: string[] = [];
    const poorQuality = interactions.filter(i => i.quality === 'needs_improvement');
    
    if (poorQuality.length > interactions.length * 0.3) {
      areas.push('Overall response quality needs improvement');
    }

    const categories = this.getCategoryDistribution(poorQuality);
    Object.entries(categories).forEach(([category, count]) => {
      if (count > 5) {
        areas.push(\`Improve \${category} responses\`);
      }
    });

    return areas;
  }
}`;
  }

  private async generateWatcherTypesFile(spec: AgentSpec, watcherName: string): Promise<string> {
    return `export interface ${spec.name}Interaction {
  timestamp: string;
  input: string;
  response: string;
  context: string[];
  feedback?: string;
  quality: 'good' | 'needs_improvement';
  category: string;
  confidence: number;
  apiUsed: 'claude' | 'local' | 'hybrid';
}

export interface ${spec.name}Pattern {
  type: 'input' | 'response' | 'feedback';
  pattern: string;
  frequency: number;
  success_rate: number;
}

export interface ${spec.name}Analytics {
  totalInteractions: number;
  qualityRatio: number;
  categoryDistribution: Record<string, number>;
  patterns: ${spec.name}Pattern[];
  localModelReadiness: number;
}`;
  }

  // Update existing method to include watcher in main index
  private async updateMainIndex(spec: AgentSpec): Promise<void> {
    try {
      const indexPath = 'src/index.ts';
      const currentContent = await fs.readFile(indexPath, 'utf8');
      
      const importLine = `import { ${spec.name} } from './agents/${spec.name.toLowerCase()}/${spec.name}.js';`;
      const watcherImportLine = spec.createWatcher ? 
        `import { ${spec.name}Watch } from './agents/watcher/${spec.name.toLowerCase()}watch/${spec.name}Watch.js';` : '';
      
      if (currentContent.includes(importLine)) {
        console.log(`[AgentBuilder] ${spec.name} already integrated in index.ts`);
        return;
      }
      
      const lines = currentContent.split('\n');
      const lastImportIndex = lines.findLastIndex(line => line.startsWith('import'));
      
      lines.splice(lastImportIndex + 1, 0, importLine);
      if (watcherImportLine) {
        lines.splice(lastImportIndex + 2, 0, watcherImportLine);
      }
      
      const startFunctionName = `start${spec.name}`;
      const startFunction = `
async function ${startFunctionName}() {
  const ${spec.name.toLowerCase()}Config = {
    ${spec.discordIntegration ? `${spec.name.toLowerCase()}Token: process.env.${spec.name.toUpperCase()}_DISCORD_TOKEN!,\n    ${spec.name.toLowerCase()}ChannelId: process.env.${spec.name.toUpperCase()}_CHANNEL_ID!,\n    ` : ''}claudeApiKey: process.env.CLAUDE_API_KEY!
  };

  if (${spec.discordIntegration ? `${spec.name.toLowerCase()}Config.${spec.name.toLowerCase()}Token && ${spec.name.toLowerCase()}Config.${spec.name.toLowerCase()}ChannelId` : 'true'}) {
    const ${spec.name.toLowerCase()} = new ${spec.name}(${spec.name.toLowerCase()}Config);${spec.createWatcher ? `\n    const ${spec.name.toLowerCase()}Watch = new ${spec.name}Watch();` : ''}
    await ${spec.name.toLowerCase()}.start();
  } else {
    console.log('[${spec.name}] Environment variables not set, skipping startup');
  }
}`;
      
      const promiseAllIndex = lines.findIndex(line => line.includes('Promise.all'));
      if (promiseAllIndex !== -1) {
        lines.splice(promiseAllIndex, 0, startFunction);
        
        const promiseAllLine = lines[promiseAllIndex + startFunction.split('\n').length];
        if (promiseAllLine.includes('startCommander()')) {
          lines[promiseAllIndex + startFunction.split('\n').length] = promiseAllLine.replace(
            '])',
            `,\n  ${startFunctionName}()\n])`
          );
        }
      } else {
        lines.push(startFunction);
        lines.push(`\n${startFunctionName}().catch(console.error);`);
      }
      
      await fs.writeFile(indexPath, lines.join('\n'));
      console.log(`[AgentBuilder] Updated index.ts to include ${spec.name}${spec.createWatcher ? ' and watcher' : ''}`);
      
    } catch (error) {
      console.error(`[AgentBuilder] Failed to update index.ts:`, error);
    }
  }

  // Keep all existing methods...
  private async createAgentDirectories(basePath: string): Promise<void> {
    const dirs = [
      basePath,
      `${basePath}/core`,
      `${basePath}/intelligence`, 
      `${basePath}/communication`,
      `${basePath}/types`
    ];
    
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private fallbackAgentSpec(request: string): AgentSpec {
    const name = request.includes('monitor') ? 'Monitor' : 
                request.includes('deploy') ? 'Deployer' :
                request.includes('quality') ? 'QualityChecker' : 'CustomAgent';
    
    return {
      name,
      purpose: `Agent for ${request}`,
      capabilities: ['basic-processing'],
      dependencies: ['@anthropic-ai/sdk'],
      structure: {
        core: [`${name}.ts`],
        intelligence: [`${name}Intelligence.ts`],
        communication: [`${name}Voice.ts`]
      },
      discordIntegration: true,
      voicePersonality: 'Professional and helpful',
      createWatcher: true,
      watcherPurpose: `Learning optimization patterns for ${name}`
    };
  }

  // Include all the existing generation methods from previous version
  private async generateCoreFiles(spec: AgentSpec, basePath: string): Promise<string[]> {
    const files: string[] = [];
    
    const mainFile = `${basePath}/${spec.name}.ts`;
    const mainContent = await this.generateMainAgentFile(spec);
    await fs.writeFile(mainFile, mainContent);
    files.push(mainFile);
    
    return files;
  }

  private async generateIntelligenceFiles(spec: AgentSpec, basePath: string): Promise<string[]> {
    const files: string[] = [];
    
    const intelligenceFile = `${basePath}/intelligence/${spec.name}Intelligence.ts`;
    const intelligenceContent = await this.generateIntelligenceFile(spec);
    await fs.writeFile(intelligenceFile, intelligenceContent);
    files.push(intelligenceFile);
    
    return files;
  }

  private async generateCommunicationFiles(spec: AgentSpec, basePath: string): Promise<string[]> {
    const files: string[] = [];
    
    if (spec.discordIntegration) {
      const discordFile = `${basePath}/communication/${spec.name}Discord.ts`;
      const discordContent = await this.generateDiscordFile(spec);
      await fs.writeFile(discordFile, discordContent);
      files.push(discordFile);
      
      const voiceFile = `${basePath}/communication/${spec.name}Voice.ts`;
      const voiceContent = await this.generateVoiceFile(spec);
      await fs.writeFile(voiceFile, voiceContent);
      files.push(voiceFile);
    }
    
    return files;
  }

  private async generateMainAgentFile(spec: AgentSpec): Promise<string> {
    const discordImport = spec.discordIntegration ? 
      `import { ${spec.name}Discord } from './communication/${spec.name}Discord.js';\nimport { ${spec.name}Voice } from './communication/${spec.name}Voice.js';` : '';
    
    const watcherImport = spec.createWatcher ?
      `import { ${spec.name}Watch } from '../watcher/${spec.name.toLowerCase()}watch/${spec.name}Watch.js';` : '';
    
    const discordProperties = spec.discordIntegration ? 
      `  private discord: ${spec.name}Discord;\n  private voice: ${spec.name}Voice;` : '';
    
    const watcherProperty = spec.createWatcher ?
      `  private watcher: ${spec.name}Watch;` : '';
    
    const discordInit = spec.discordIntegration ? 
      `    this.discord = new ${spec.name}Discord(config);\n    this.voice = new ${spec.name}Voice(config.claudeApiKey);` : '';
      
    const watcherInit = spec.createWatcher ?
      `    this.watcher = new ${spec.name}Watch();` : '';
    
    const discordStart = spec.discordIntegration ? 
      `    this.discord.onMessage(async (message) => {\n      const response = await this.processRequest(message.content, message.author.id, message.id);\n      await this.discord.sendMessage(response);\n    });\n\n    await this.discord.start();` : '';

    const watcherLogging = spec.createWatcher ?
      `      // Log interaction to watcher for learning\n      await this.watcher.log${spec.name}Interaction(input, result, []);` : '';

    return `import { ${spec.name}Intelligence } from './intelligence/${spec.name}Intelligence.js';
${discordImport}
${watcherImport}

export interface ${spec.name}Config {
  ${spec.discordIntegration ? `${spec.name.toLowerCase()}Token: string;\n  ${spec.name.toLowerCase()}ChannelId: string;\n  ` : ''}claudeApiKey: string;
}

export class ${spec.name} {
  private intelligence: ${spec.name}Intelligence;
${discordProperties}
${watcherProperty}

  constructor(config: ${spec.name}Config) {
    this.intelligence = new ${spec.name}Intelligence(config.claudeApiKey);
${discordInit}
${watcherInit}
    
    console.log('[${spec.name}] ${spec.purpose} initialized${spec.createWatcher ? ' with learning watcher' : ''}');
  }

  async start(): Promise<void> {
${discordStart}
    console.log('[${spec.name}] 🚀 ${spec.name} is online and ready!');
  }

  private async processRequest(input: string, userId: string, messageId: string): Promise<string> {
    console.log(\`[${spec.name}] Processing: "\${input}"\`);
    
    try {
      const result = await this.intelligence.process(input, userId);
      
${watcherLogging}
      
      ${spec.discordIntegration ? `return await this.voice.formatResponse(result, { type: 'response' });` : `return result;`}
    } catch (error) {
      console.error('[${spec.name}] Error:', error);
      ${spec.discordIntegration ? `return await this.voice.formatResponse('Error processing request. Please try again.', { type: 'error' });` : `return 'Error processing request.';`}
    }
  }
}`;
  }

  private async generateIntelligenceFile(spec: AgentSpec): Promise<string> {
    return `import Anthropic from '@anthropic-ai/sdk';

export class ${spec.name}Intelligence {
  private claude: Anthropic;

  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
  }

  async process(input: string, userId: string): Promise<string> {
    console.log(\`[${spec.name}Intelligence] Processing: \${input}\`);
    
    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        system: \`You are the ${spec.name} agent. Purpose: ${spec.purpose}
        
Capabilities: ${spec.capabilities.join(', ')}

Respond helpfully and professionally to user requests related to your purpose.\`,
        messages: [{
          role: 'user',
          content: input
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        return content.text;
      }
    } catch (error) {
      console.error(\`[${spec.name}Intelligence] Claude API failed:\`, error);
    }

    return \`I'm the ${spec.name} agent. I can help with: \${spec.capabilities.join(', ')}\`;
  }
}`;
  }

  private async generateDiscordFile(spec: AgentSpec): Promise<string> {
    return `import { Client, GatewayIntentBits, TextChannel, Message } from 'discord.js';

export class ${spec.name}Discord {
  private client: Client;
  private channel: TextChannel | null = null;
  private config: any;
  private messageHandlers: Array<(message: Message) => Promise<void>> = [];

  constructor(config: any) {
    this.config = config;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.once('ready', async () => {
      console.log(\`[${spec.name}Discord] Connected as \${this.client.user?.tag}\`);
      this.channel = this.client.channels.cache.get(this.config.${spec.name.toLowerCase()}ChannelId) as TextChannel;
      
      this.client.user?.setPresence({
        activities: [{ name: '${spec.purpose}', type: 3 }],
        status: 'online'
      });
    });

    this.client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      if (message.channelId !== this.config.${spec.name.toLowerCase()}ChannelId) return;
      
      for (const handler of this.messageHandlers) {
        await handler(message);
      }
    });

    this.client.on('error', (error) => {
      console.error('[${spec.name}Discord] Client error:', error);
    });
  }

  onMessage(handler: (message: Message) => Promise<void>): void {
    this.messageHandlers.push(handler);
  }

  async sendMessage(content: string): Promise<Message | null> {
    if (!this.channel) return null;
    
    try {
      return await this.channel.send(content);
    } catch (error) {
      console.error('[${spec.name}Discord] Failed to send message:', error);
      return null;
    }
  }

  async start(): Promise<void> {
    await this.client.login(this.config.${spec.name.toLowerCase()}Token);
  }

  get isReady(): boolean {
    return this.client.isReady();
  }
}`;
  }

  private async generateVoiceFile(spec: AgentSpec): Promise<string> {
    return `import Anthropic from '@anthropic-ai/sdk';

export class ${spec.name}Voice {
  private claude: Anthropic;
  
  private static readonly VOICE_PROMPT = \`You are the ${spec.name} agent.

PERSONALITY: ${spec.voicePersonality || 'Professional and helpful'}
PURPOSE: ${spec.purpose}
CAPABILITIES: ${spec.capabilities.join(', ')}

VOICE RULES:
- Be helpful and professional
- Stay focused on your purpose
- Provide clear, actionable responses
- Be concise but thorough when needed

AVOID: Being overly verbose, going outside your domain\`;

  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
  }

  async formatResponse(content: string, options: { type?: string } = {}): Promise<string> {
    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 200,
        system: ${spec.name}Voice.VOICE_PROMPT,
        messages: [{
          role: 'user',
          content: \`Format this response in the ${spec.name} voice:

"\${content}"

Context: \${options.type || 'general'}\`
        }]
      });
      
      const voiceContent = response.content[0];
      if (voiceContent.type === 'text') {
        return this.cleanResponse(voiceContent.text);
      }
    } catch (error) {
      console.error('[${spec.name}Voice] AI formatting failed:', error);
    }
    
    return this.cleanResponse(content);
  }

  private cleanResponse(response: string): string {
    return response
      .replace(/\\*[^*]*\\*/g, '')
      .trim();
  }
}`;
  }

  private async generateTypesFile(spec: AgentSpec, basePath: string): Promise<string> {
    const typesFile = `${basePath}/types/index.ts`;
    const content = `export interface ${spec.name}Config {
  ${spec.discordIntegration ? `${spec.name.toLowerCase()}Token: string;\n  ${spec.name.toLowerCase()}ChannelId: string;\n  ` : ''}claudeApiKey: string;
}

export interface ${spec.name}Request {
  type: string;
  description: string;
  userId: string;
  priority: 'low' | 'medium' | 'high';
}

export interface ${spec.name}Response {
  success: boolean;
  message: string;
  data?: any;
}`;

    await fs.writeFile(typesFile, content);
    return typesFile;
  }

  private async generateIndexFile(spec: AgentSpec, basePath: string): Promise<string> {
    const indexFile = `${basePath}/index.ts`;
    const content = `export { ${spec.name} } from './${spec.name}.js';
export * from './types/index.js';`;

    await fs.writeFile(indexFile, content);
    return indexFile;
  }

  private async commitNewAgent(spec: AgentSpec, files: string[]): Promise<void> {
    try {
      execSync('git add .', { stdio: 'pipe' });
      execSync(`git commit -m "🤖 Add ${spec.name} agent with full Discord integration and watcher\\n\\nFiles created:\\n${files.map(f => `- ${f}`).join('\\n')}"`, { stdio: 'pipe' });
      execSync('git push origin main', { stdio: 'pipe' });
      console.log(`[AgentBuilder] Committed and deployed ${spec.name} agent with watcher`);
    } catch (error) {
      console.error(`[AgentBuilder] Failed to commit ${spec.name}:`, error);
    }
  }
}
