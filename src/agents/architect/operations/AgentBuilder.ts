// src/agents/architect/operations/IntelligentAgentBuilder.ts
import { AgentSpec } from ‘../types/index.js’;
import { FileMapper } from ‘../intelligence/FileMapper.js’;
import { CodeIntelligence } from ‘../intelligence/CodeIntelligence.js’;
import Anthropic from ‘@anthropic-ai/sdk’;
import { promises as fs } from ‘fs’;
import { execSync } from ‘child_process’;

interface CodebaseKnowledge {
existingAgents: string[];
codePatterns: Record<string, any>;
architecturePatterns: Record<string, any>;
currentCapabilities: string[];
}

export class IntelligentAgentBuilder {
private claude: Anthropic;
private codeIntelligence: CodeIntelligence;
private codebaseKnowledge: CodebaseKnowledge = {
existingAgents: [],
codePatterns: {},
architecturePatterns: {},
currentCapabilities: []
};

constructor(claudeApiKey: string) {
this.claude = new Anthropic({ apiKey: claudeApiKey });
this.codeIntelligence = new CodeIntelligence(claudeApiKey);
}

async initializeCodebaseKnowledge(): Promise<void> {
console.log(’[IntelligentAgentBuilder] 🧠 Learning codebase structure…’);

```
try {
  // Scan existing agents
  this.codebaseKnowledge.existingAgents = await this.scanExistingAgents();
  
  // Analyze code patterns
  this.codebaseKnowledge.codePatterns = await this.analyzeCodePatterns();
  
  // Learn architecture patterns
  this.codebaseKnowledge.architecturePatterns = await this.analyzeArchitecturePatterns();
  
  // Catalog current capabilities
  this.codebaseKnowledge.currentCapabilities = await this.catalogCurrentCapabilities();
  
  console.log(`[IntelligentAgentBuilder] ✅ Learned about ${this.codebaseKnowledge.existingAgents.length} agents and ${Object.keys(this.codebaseKnowledge.codePatterns).length} patterns`);
} catch (error) {
  console.error('[IntelligentAgentBuilder] ⚠️  Failed to initialize codebase knowledge:', error);
}
```

}

async buildIntelligentAgent(request: string): Promise<any> {
console.log(`[IntelligentAgentBuilder] 🎯 Building intelligent agent from: "${request}"`);

```
// Ensure codebase knowledge is current
await this.initializeCodebaseKnowledge();

// Intelligently analyze what kind of agent is needed
const agentSpec = await this.intelligentRequirementsAnalysis(request);

// Check if this conflicts with existing agents
const conflictAnalysis = await this.analyzeAgentConflicts(agentSpec);

if (conflictAnalysis.hasConflict) {
  return {
    summary: `⚠️  Potential conflict detected: ${conflictAnalysis.message}`,
    suggestion: conflictAnalysis.suggestion,
    proceed: false
  };
}

// Generate the agent using intelligent templates
const buildResult = await this.generateIntelligentAgent(agentSpec);

// Create learning watcher automatically
const watcherResult = await this.generateIntelligentWatcher(agentSpec);

// Update system knowledge with new agent
await this.updateSystemKnowledge(agentSpec);

return {
  ...buildResult,
  watcherResult,
  agentSpec,
  codebaseImpact: await this.assessCodebaseImpact(agentSpec)
};
```

}

private async intelligentRequirementsAnalysis(request: string): Promise<AgentSpec> {
console.log(’[IntelligentAgentBuilder] 🔍 Performing intelligent requirements analysis…’);

```
const response = await this.claude.messages.create({
  model: 'claude-3-opus-20240229',
  max_tokens: 2000,
  system: `You are an expert software architect with deep knowledge of AI agent systems. Analyze agent creation requests and design optimal agent specifications.
```

CODEBASE CONTEXT:

- Existing agents: ${this.codebaseKnowledge.existingAgents.join(’, ’)}
- Current capabilities: ${this.codebaseKnowledge.currentCapabilities.join(’, ’)}
- Architecture patterns: ${Object.keys(this.codebaseKnowledge.architecturePatterns).join(’, ’)}

DESIGN PRINCIPLES:

1. Each agent should have a clear, focused purpose
1. Avoid overlapping functionality with existing agents
1. Design for learning and self-improvement
1. Include appropriate intelligence and communication layers
1. Plan for feedback integration and continuous improvement

AGENT ARCHITECTURE REQUIREMENTS:

- Core: Main agent class + orchestrator for request handling
- Intelligence: AI analysis + pattern recognition + learning capabilities
- Communication: Voice system + Discord integration + feedback processing
- Types: Comprehensive type definitions for all interactions
- Watcher: Learning system for continuous improvement and eventual local model replacement

OUTPUT FORMAT: Return detailed JSON specification with intelligent analysis.`, messages: [{ role: 'user', content: `Analyze this agent creation request and design the optimal agent:

REQUEST: “${request}”

Consider:

1. What specific problem does this solve?
1. How does it fit into the existing system?
1. What intelligence capabilities does it need?
1. How should it learn and improve?
1. What communication patterns are appropriate?
1. How can it collect feedback for self-improvement?

Return a comprehensive JSON specification that will create an intelligent, learning agent.`
}]
});

```
const content = response.content[0];
if (content.type === 'text') {
  try {
    const analysis = JSON.parse(content.text);
    return this.validateAndEnhanceSpec(analysis);
  } catch (parseError) {
    console.error('[IntelligentAgentBuilder] Failed to parse requirements analysis:', parseError);
    return this.fallbackIntelligentSpec(request);
  }
}

return this.fallbackIntelligentSpec(request);
```

}

private async generateIntelligentAgent(spec: AgentSpec): Promise<any> {
console.log(`[IntelligentAgentBuilder] 🏗️  Generating intelligent agent: ${spec.name}`);

```
const agentPath = `src/agents/${spec.name.toLowerCase()}`;
const createdFiles: string[] = [];

try {
  // Create intelligent directory structure
  await this.createIntelligentDirectories(agentPath);
  
  // Generate core files with intelligence
  const coreFiles = await this.generateIntelligentCoreFiles(spec, agentPath);
  createdFiles.push(...coreFiles);
  
  // Generate intelligence layer
  const intelligenceFiles = await this.generateIntelligenceLayer(spec, agentPath);
  createdFiles.push(...intelligenceFiles);
  
  // Generate communication layer
  const communicationFiles = await this.generateCommunicationLayer(spec, agentPath);
  createdFiles.push(...communicationFiles);
  
  // Generate type definitions
  const typesFile = await this.generateIntelligentTypes(spec, agentPath);
  createdFiles.push(typesFile);
  
  // Generate configuration and integration
  const configFiles = await this.generateConfigurationLayer(spec, agentPath);
  createdFiles.push(...configFiles);
  
  // Update system integration
  await this.updateSystemIntegration(spec);
  
  // Commit with intelligent message
  const commitResult = await this.intelligentCommit(spec, createdFiles);
  
  return {
    summary: `🎉 Intelligent agent ${spec.name} created successfully!`,
    files: createdFiles,
    agentPath,
    capabilities: spec.capabilities,
    intelligence: spec.intelligence || {},
    ready: true,
    committed: commitResult
  };
  
} catch (error) {
  console.error(`[IntelligentAgentBuilder] Failed to generate ${spec.name}:`, error);
  return {
    summary: `❌ Failed to create ${spec.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    files: createdFiles,
    ready: false,
    error: error instanceof Error ? error.message : String(error)
  };
}
```

}

private async generateIntelligentWatcher(spec: AgentSpec): Promise<any> {
console.log(`[IntelligentAgentBuilder] 👁️  Generating intelligent watcher for ${spec.name}`);

```
const watcherPath = `src/agents/watcher/${spec.name.toLowerCase()}watch`;
const watcherName = `${spec.name}Watch`;
const createdFiles: string[] = [];

try {
  await this.createIntelligentDirectories(watcherPath);
  
  // Generate watcher with learning capabilities
  const watcherFiles = await this.generateLearningWatcher(spec, watcherPath, watcherName);
  createdFiles.push(...watcherFiles);
  
  return {
    summary: `🔍 Intelligent watcher ${watcherName} created`,
    files: createdFiles,
    learningCapabilities: await this.analyzeLearningPotential(spec)
  };
  
} catch (error) {
  console.error(`[IntelligentAgentBuilder] Failed to generate watcher:`, error);
  return {
    summary: `⚠️  Watcher creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    files: createdFiles
  };
}
```

}

private async generateIntelligentCoreFiles(spec: AgentSpec, basePath: string): Promise<string[]> {
const files: string[] = [];

```
// Main agent class with intelligence
const mainContent = await this.generateIntelligentMainClass(spec);
await fs.writeFile(`${basePath}/${spec.name}.ts`, mainContent);
files.push(`${basePath}/${spec.name}.ts`);

// Intelligent orchestrator
const orchestratorContent = await this.generateIntelligentOrchestrator(spec);
await fs.writeFile(`${basePath}/core/${spec.name}Orchestrator.ts`, orchestratorContent);
files.push(`${basePath}/core/${spec.name}Orchestrator.ts`);

return files;
```

}

private async generateIntelligentMainClass(spec: AgentSpec): Promise<string> {
const response = await this.claude.messages.create({
model: ‘claude-3-opus-20240229’,
max_tokens: 3000,
system: `Generate intelligent TypeScript agent class based on specification.

REQUIREMENTS:

- Modular architecture with dependency injection
- Comprehensive error handling and logging
- Intelligence integration for learning and adaptation
- Communication layer for Discord and feedback
- Self-monitoring and improvement capabilities
- Configuration-driven behavior

PATTERNS TO FOLLOW:
${JSON.stringify(this.codebaseKnowledge.codePatterns, null, 2)}

Generate clean, production-ready TypeScript code.`, messages: [{ role: 'user', content: `Generate the main agent class for:

${JSON.stringify(spec, null, 2)}

Include:

1. Proper imports and dependencies
1. Intelligent initialization
1. Error handling and logging
1. Start/stop lifecycle management
1. Integration with intelligence and communication layers
1. Self-monitoring capabilities

Make it modular, intelligent, and ready for continuous improvement.`
}]
});

```
const content = response.content[0];
return content.type === 'text' ? content.text : this.fallbackMainClass(spec);
```

}

private async generateIntelligentOrchestrator(spec: AgentSpec): Promise<string> {
const response = await this.claude.messages.create({
model: ‘claude-3-opus-20240229’,
max_tokens: 3000,
system: `Generate intelligent orchestrator for agent request processing.

The orchestrator should:

1. Route requests intelligently based on agent purpose
1. Apply context and learning from previous interactions
1. Handle complex multi-step workflows
1. Provide intelligent error recovery
1. Collect feedback for continuous improvement
1. Adapt behavior based on usage patterns

Use Claude AI for intelligent processing while building towards local model replacement.`, messages: [{ role: 'user', content: `Generate intelligent orchestrator for:

AGENT SPEC:
${JSON.stringify(spec, null, 2)}

CAPABILITIES NEEDED:
${spec.capabilities.map(cap => `- ${cap}`).join(’\n’)}

The orchestrator should intelligently handle requests related to “${spec.purpose}” and continuously improve through learning.`
}]
});

```
const content = response.content[0];
return content.type === 'text' ? content.text : this.fallbackOrchestrator(spec);
```

}

private async scanExistingAgents(): Promise<string[]> {
try {
const agentsDir = await fs.readdir(‘src/agents’, { withFileTypes: true });
return agentsDir
.filter(dirent => dirent.isDirectory() && dirent.name !== ‘watcher’)
.map(dirent => dirent.name);
} catch {
return [‘commander’, ‘architect’];
}
}

private async analyzeCodePatterns(): Promise<Record<string, any>> {
// Use existing FileMapper knowledge
const features = FileMapper.getAvailableFeatures();
const patterns: Record<string, any> = {};

```
for (const [feature, description] of Object.entries(features)) {
  patterns[feature] = {
    description,
    files: FileMapper.discoverFiles(feature),
    configKeys: FileMapper.getRelevantConfigKeys(feature)
  };
}

return patterns;
```

}

private async analyzeArchitecturePatterns(): Promise<Record<string, any>> {
return {
agentStructure: {
core: [‘MainClass.ts’, ‘Orchestrator.ts’],
intelligence: [‘Intelligence.ts’],
communication: [‘Discord.ts’, ‘Voice.ts’],
types: [‘index.ts’]
},
watcherStructure: {
main: [‘Watch.ts’],
intelligence: [‘WatchIntelligence.ts’],
core: [‘WatchAnalyzer.ts’]
},
integrationPatterns: {
environment: ‘Railway variables’,
deployment: ‘Automatic git commit and push’,
startup: ‘Index.ts integration’
}
};
}

private async catalogCurrentCapabilities(): Promise<string[]> {
return [
‘discord-integration’,
‘claude-ai-processing’,
‘code-analysis’,
‘system-modification’,
‘agent-creation’,
‘learning-and-adaptation’,
‘feedback-processing’,
‘intelligent-routing’,
‘error-recovery’,
‘performance-monitoring’
];
}

private validateAndEnhanceSpec(analysis: any): AgentSpec {
return {
name: analysis.name || ‘IntelligentAgent’,
purpose: analysis.purpose || ‘Intelligent agent functionality’,
capabilities: analysis.capabilities || [‘intelligent-processing’],
dependencies: analysis.dependencies || [’@anthropic-ai/sdk’, ‘discord.js’],
structure: analysis.structure || this.codebaseKnowledge.architecturePatterns.agentStructure,
discordIntegration: analysis.discordIntegration !== false,
voicePersonality: analysis.voicePersonality || ‘Intelligent and adaptive’,
createWatcher: analysis.createWatcher !== false,
watcherPurpose: analysis.watcherPurpose || `Learning patterns for ${analysis.name} optimization`,
intelligence: analysis.intelligence || {
learningCapabilities: [‘pattern-recognition’, ‘feedback-integration’, ‘self-improvement’],
adaptationMethods: [‘usage-pattern-analysis’, ‘performance-optimization’]
}
};
}

private fallbackIntelligentSpec(request: string): AgentSpec {
// Extract intent from request
const name = this.extractAgentName(request) || ‘IntelligentAgent’;
const purpose = this.extractPurpose(request) || ‘Intelligent agent processing’;
const capabilities = this.extractCapabilities(request);

```
return {
  name,
  purpose,
  capabilities,
  dependencies: ['@anthropic-ai/sdk', 'discord.js'],
  structure: this.codebaseKnowledge.architecturePatterns.agentStructure,
  discordIntegration: true,
  voicePersonality: 'Intelligent and adaptive',
  createWatcher: true,
  watcherPurpose: `Learning optimization patterns for ${name}`,
  intelligence: {
    learningCapabilities: ['pattern-recognition', 'feedback-integration'],
    adaptationMethods: ['usage-analysis']
  }
};
```

}

private extractAgentName(request: string): string | null {
// Intelligent name extraction
const patterns = [
/(?:agent|bot)\s+(?:named|called)\s+(\w+)/i,
/(\w+)\s+(?:agent|bot)/i,
/(?:build|create)\s+(?:a|an)?\s*(\w+)/i,
/for\s+(\w+)\s+(?:responses|functionality)/i
];

```
for (const pattern of patterns) {
  const match = request.match(pattern);
  if (match) {
    return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
  }
}

return null;
```

}

private extractPurpose(request: string): string | null {
const purposePatterns = [
/for\s+(.+?)(?:\s+responses?)?$/i,
/(?:that|to)\s+(.+)$/i,
/agent\s+(.+?)(?:\s+agent)?$/i
];

```
for (const pattern of purposePatterns) {
  const match = request.match(pattern);
  if (match) {
    return match[1].trim();
  }
}

return null;
```

}

private extractCapabilities(request: string): string[] {
const capabilities: string[] = [‘intelligent-processing’];

```
if (request.toLowerCase().includes('ping')) capabilities.push('ping-response');
if (request.toLowerCase().includes('monitor')) capabilities.push('monitoring');
if (request.toLowerCase().includes('deploy')) capabilities.push('deployment-management');
if (request.toLowerCase().includes('analyze')) capabilities.push('analysis');
if (request.toLowerCase().includes('manage')) capabilities.push('management');
if (request.toLowerCase().includes('chat')) capabilities.push('conversation');
if (request.toLowerCase().includes('feedback')) capabilities.push('feedback-processing');

return capabilities;
```

}

// Additional methods for complete implementation…
private async analyzeAgentConflicts(spec: AgentSpec): Promise<{hasConflict: boolean, message?: string, suggestion?: string}> {
// Check for existing agents with similar purposes
const conflicts = this.codebaseKnowledge.existingAgents.filter(agent =>
agent.toLowerCase().includes(spec.name.toLowerCase()) ||
spec.name.toLowerCase().includes(agent.toLowerCase())
);

```
if (conflicts.length > 0) {
  return {
    hasConflict: true,
    message: `Similar agent(s) already exist: ${conflicts.join(', ')}`,
    suggestion: `Consider enhancing existing agent(s) instead of creating new one`
  };
}

return { hasConflict: false };
```

}

private async createIntelligentDirectories(basePath: string): Promise<void> {
const dirs = [
basePath,
`${basePath}/core`,
`${basePath}/intelligence`,
`${basePath}/communication`,
`${basePath}/types`
];

```
for (const dir of dirs) {
  await fs.mkdir(dir, { recursive: true });
}
```

}

// Placeholder methods - implement with full intelligence
private async generateIntelligenceLayer(spec: AgentSpec, basePath: string): Promise<string[]> { return []; }
private async generateCommunicationLayer(spec: AgentSpec, basePath: string): Promise<string[]> { return []; }
private async generateIntelligentTypes(spec: AgentSpec, basePath: string): Promise<string> { return ‘’; }
private async generateConfigurationLayer(spec: AgentSpec, basePath: string): Promise<string[]> { return []; }
private async updateSystemIntegration(spec: AgentSpec): Promise<void> {}
private async intelligentCommit(spec: AgentSpec, files: string[]): Promise<boolean> { return true; }
private async updateSystemKnowledge(spec: AgentSpec): Promise<void> {}
private async assessCodebaseImpact(spec: AgentSpec): Promise<any> { return {}; }
private async generateLearningWatcher(spec: AgentSpec, watcherPath: string, watcherName: string): Promise<string[]> { return []; }
private async analyzeLearningPotential(spec: AgentSpec): Promise<any> { return {}; }

private fallbackMainClass(spec: AgentSpec): string { return `// Fallback main class for ${spec.name}`; }
private fallbackOrchestrator(spec: AgentSpec): string { return `// Fallback orchestrator for ${spec.name}`; }
}