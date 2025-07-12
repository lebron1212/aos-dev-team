import { promises as fs } from ‘fs’;
import path from ‘path’;
import { ArchWatch } from ‘../intelligence/ArchWatch’;

interface AgentSpec {
name: string;
description: string;
capabilities: string[];
discordEnabled: boolean;
watcherEnabled: boolean;
}

interface BuildResult {
ready: boolean;
summary: string;
error?: string;
environmentVars?: string[];
}

interface FileWriteResult {
success: boolean;
path: string;
error?: string;
size?: number;
}

export class AgentBuilder {
private claudeApiKey: string;
private discordToken?: string;
private baseDir: string;
private isRailway: boolean;
private agentStore: Map<string, AgentSpec> = new Map();

constructor(claudeApiKey: string, discordToken?: string) {
this.claudeApiKey = claudeApiKey;
this.discordToken = discordToken;
this.baseDir = process.cwd();
this.isRailway = process.env.RAILWAY_ENVIRONMENT === ‘production’ ||
process.env.NODE_ENV === ‘production’;

```
if (this.isRailway) {
  console.warn('[AgentBuilder] Railway detected - files will be ephemeral. Using hybrid storage strategy.');
}
```

}

/**

- Parse agent requirements - maintains existing API
  */
  async parseAgentRequirements(requirements: string): Promise<AgentSpec> {
  console.log(`[AgentBuilder] Parsing requirements: ${requirements.substring(0, 100)}...`);

```
const lines = requirements.split('\n').map(line => line.trim()).filter(Boolean);

// Extract name from various formats
let name = '';
let description = '';

// Handle "/build agent NAME DESCRIPTION" format
const buildMatch = requirements.match(/\/build\s+agent\s+(\w+)\s+"([^"]+)"/i);
if (buildMatch) {
  name = buildMatch[1];
  description = buildMatch[2];
} else {
  // Handle "Create a new AI agent named 'NAME'" format
  const createMatch = requirements.match(/named\s+['"]?(\w+)['"]?/i);
  if (createMatch) {
    name = createMatch[1];
  }
  
  // Extract description from context
  const descMatch = requirements.match(/"([^"]+)"/);
  if (descMatch) {
    description = descMatch[1];
  } else {
    description = requirements.length > 50 ? 
      requirements.substring(0, 50) + '...' : 
      requirements;
  }
}

if (!name) {
  // Generate a default name
  name = 'GeneratedAgent' + Date.now().toString().slice(-4);
  console.warn(`[AgentBuilder] No agent name found, using: ${name}`);
}

// Default capabilities based on description
const capabilities = this.inferCapabilities(description);

const agentSpec: AgentSpec = {
  name,
  description,
  capabilities,
  discordEnabled: true,
  watcherEnabled: true
};

console.log(`[AgentBuilder] Parsed agent spec:`, agentSpec);
return agentSpec;
```

}

/**

- Generate agent - maintains existing API
  */
  async generateAgent(agentSpec: AgentSpec): Promise<BuildResult> {
  console.log(`[AgentBuilder] Building agent: ${agentSpec.name}`);

```
try {
  // Store in memory (always works)
  this.agentStore.set(agentSpec.name, agentSpec);

  // Check for existing agent
  if (await this.agentExists(agentSpec.name)) {
    console.warn(`[AgentBuilder] Agent '${agentSpec.name}' already exists. Updating configuration.`);
  }

  // Try to write files (may fail on Railway)
  const fileResults = await this.writeAgentFiles(agentSpec);
  
  // Analyze results
  const successCount = fileResults.filter(r => r.success).length;
  const totalFiles = fileResults.length;
  
  console.log(`[AgentBuilder] File operations: ${successCount}/${totalFiles} successful`);
  
  // Determine environment variables needed
  const environmentVars: string[] = [];
  if (agentSpec.discordEnabled) {
    environmentVars.push(`${agentSpec.name.toUpperCase()}_DISCORD_TOKEN`);
  }

  if (successCount === 0) {
    console.error(`[AgentBuilder] All file operations failed! Agent stored in memory only.`);
    
    if (this.isRailway) {
      // On Railway, this is expected - return success with explanation
      return {
        ready: true,
        summary: `Agent ${agentSpec.name} created in memory (Railway ephemeral filesystem)`,
        environmentVars: environmentVars.length > 0 ? environmentVars : undefined
      };
    } else {
      // On other platforms, this is an error
      return {
        ready: false,
        error: 'File system write permissions denied. Check directory permissions.'
      };
    }
  } else if (successCount < totalFiles) {
    console.warn(`[AgentBuilder] Partial success: ${successCount}/${totalFiles} files written`);
    
    // Log failures
    fileResults.filter(r => !r.success).forEach(result => {
      console.error(`[AgentBuilder] Failed to write ${result.path}: ${result.error}`);
    });

    return {
      ready: true,
      summary: `Agent ${agentSpec.name} partially created (${successCount}/${totalFiles} files written)`,
      environmentVars: environmentVars.length > 0 ? environmentVars : undefined
    };
  } else {
    console.log(`[AgentBuilder] ✅ Agent '${agentSpec.name}' created successfully`);
    
    return {
      ready: true,
      summary: `Agent ${agentSpec.name} created successfully with all ${totalFiles} files`,
      environmentVars: environmentVars.length > 0 ? environmentVars : undefined
    };
  }

} catch (error) {
  console.error(`[AgentBuilder] Failed to build agent:`, error);
  ArchWatch.log('agent-creation', 'high', 'failure');
  
  return {
    ready: false,
    error: error instanceof Error ? error.message : 'Unknown error during agent creation'
  };
}
```

}

/**

- Check if agent already exists
  */
  private async agentExists(name: string): Promise<boolean> {
  const agentDir = path.join(this.baseDir, ‘src’, ‘agents’, name.toLowerCase());
  try {
  await fs.access(agentDir);
  return true;
  } catch {
  return false;
  }
  }

/**

- Write all agent files with verification
  */
  private async writeAgentFiles(agentSpec: AgentSpec): Promise<FileWriteResult[]> {
  const results: FileWriteResult[] = [];
  const agentDir = path.join(this.baseDir, ‘src’, ‘agents’, agentSpec.name.toLowerCase());

```
try {
  // Create agent directory
  await this.ensureDirectory(agentDir);
  
  // Generate file contents
  const files = this.generateAgentFiles(agentSpec);
  
  // Write each file
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(agentDir, relativePath);
    const result = await this.writeFileWithVerification(fullPath, content);
    results.push(result);
  }

} catch (error) {
  console.error(`[AgentBuilder] Error writing agent files:`, error);
  results.push({
    success: false,
    path: agentDir,
    error: error instanceof Error ? error.message : 'Unknown error'
  });
}

return results;
```

}

/**

- Write file with proper error handling and verification
  */
  private async writeFileWithVerification(filePath: string, content: string): Promise<FileWriteResult> {
  try {
  // Ensure directory exists
  await this.ensureDirectory(path.dirname(filePath));
  
  // Write file
  await fs.writeFile(filePath, content, ‘utf8’);
  
  // Verify file was written
  const stats = await fs.stat(filePath);
  
  // Read back and verify content (basic check)
  const writtenContent = await fs.readFile(filePath, ‘utf8’);
  if (writtenContent.length !== content.length) {
  throw new Error(`Content verification failed: expected ${content.length} chars, got ${writtenContent.length}`);
  }
  
  console.log(`[AgentBuilder] ✅ Successfully wrote ${filePath} (${stats.size} bytes)`);
  
  return {
  success: true,
  path: filePath,
  size: stats.size
  };

```
} catch (error) {
  const errorMsg = error instanceof Error ? error.message : 'Unknown error';
  console.error(`[AgentBuilder] ❌ Failed to write ${filePath}: ${errorMsg}`);
  
  return {
    success: false,
    path: filePath,
    error: errorMsg
  };
}
```

}

/**

- Ensure directory exists with proper error handling
  */
  private async ensureDirectory(dirPath: string): Promise<void> {
  try {
  await fs.access(dirPath);
  } catch {
  try {
  await fs.mkdir(dirPath, { recursive: true });
  console.log(`[AgentBuilder] Created directory: ${dirPath}`);
  } catch (error) {
  const errorMsg = error instanceof Error ? error.message : ‘Unknown error’;
  console.error(`[AgentBuilder] Failed to create directory ${dirPath}: ${errorMsg}`);
  throw error;
  }
  }
  }

/**

- Generate all agent files
  */
  private generateAgentFiles(agentSpec: AgentSpec): Record<string, string> {
  const className = agentSpec.name.charAt(0).toUpperCase() + agentSpec.name.slice(1);

```
return {
  [`${className}.ts`]: this.generateMainAgentFile(agentSpec),
  [`communication/${className}Discord.ts`]: this.generateDiscordFile(agentSpec),
  [`core/${className}Core.ts`]: this.generateCoreFile(agentSpec),
  [`intelligence/${className}Watcher.ts`]: this.generateWatcherFile(agentSpec),
  'index.ts': this.generateIndexFile(agentSpec),
  'README.md': this.generateReadmeFile(agentSpec)
};
```

}

private generateMainAgentFile(agentSpec: AgentSpec): string {
const className = agentSpec.name.charAt(0).toUpperCase() + agentSpec.name.slice(1);

```
return `import { ${className}Core } from './core/${className}Core';
```

import { ${className}Discord } from ‘./communication/${className}Discord’;
import { ${className}Watcher } from ‘./intelligence/${className}Watcher’;

/**

- ${agentSpec.description}
- Generated by AgentBuilder on ${new Date().toISOString()}
  */
  export class ${className} {
  private core: ${className}Core;
  private discord?: ${className}Discord;
  private watcher?: ${className}Watcher;

constructor() {
this.core = new ${className}Core();
${agentSpec.discordEnabled ? ` if (process.env.${agentSpec.name.toUpperCase()}_DISCORD_TOKEN) { this.discord = new ${className}Discord(this.core); }` : ‘’}
${agentSpec.watcherEnabled ? ` this.watcher = new ${className}Watcher(this.core);` : ‘’}
}

async initialize(): Promise<void> {
console.log(’[${className}] Initializing…’);

```
await this.core.initialize();

if (this.discord) {
  await this.discord.initialize();
}

if (this.watcher) {
  await this.watcher.initialize();
}

console.log('[${className}] ✅ Agent initialized successfully');
```

}

async process(input: string): Promise<string> {
return await this.core.process(input);
}

async shutdown(): Promise<void> {
console.log(’[${className}] Shutting down…’);

```
if (this.watcher) {
  await this.watcher.shutdown();
}

if (this.discord) {
  await this.discord.shutdown();
}

await this.core.shutdown();
```

}
}
`;
}

private generateDiscordFile(agentSpec: AgentSpec): string {
const className = agentSpec.name.charAt(0).toUpperCase() + agentSpec.name.slice(1);

```
return `import { Client, GatewayIntentBits, Message } from 'discord.js';
```

import { ${className}Core } from ‘../core/${className}Core’;

export class ${className}Discord {
private client: Client;
private core: ${className}Core;
private token?: string;

constructor(core: ${className}Core) {
this.core = core;
this.token = process.env.${agentSpec.name.toUpperCase()}_DISCORD_TOKEN;

```
this.client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});
```

}

async initialize(): Promise<void> {
if (!this.token) {
console.log(’[${className}Discord] No token provided, skipping Discord integration’);
return;
}

```
this.client.on('ready', () => {
  console.log(\`[${className}Discord] ✅ Logged in as \${this.client.user?.tag}\`);
});

this.client.on('messageCreate', async (message: Message) => {
  if (message.author.bot) return;
  
  // Check if message mentions the bot or starts with command prefix
  if (message.mentions.has(this.client.user!) || message.content.startsWith('/${agentSpec.name.toLowerCase()}')) {
    try {
      const response = await this.core.process(message.content);
      await message.reply(response);
    } catch (error) {
      console.error('[${className}Discord] Error processing message:', error);
      await message.reply('Sorry, I encountered an error processing your request.');
    }
  }
});

await this.client.login(this.token);
```

}

async shutdown(): Promise<void> {
if (this.client) {
await this.client.destroy();
}
}
}
`;
}

private generateCoreFile(agentSpec: AgentSpec): string {
const className = agentSpec.name.charAt(0).toUpperCase() + agentSpec.name.slice(1);

```
return `/**
```

- Core logic for ${agentSpec.name}
- ${agentSpec.description}
  */
  export class ${className}Core {
  private capabilities: string[];

constructor() {
this.capabilities = ${JSON.stringify(agentSpec.capabilities, null, 2)};
}

async initialize(): Promise<void> {
console.log(’[${className}Core] Initializing core functionality…’);
// Add initialization logic here
}

async process(input: string): Promise<string> {
console.log(`[${className}Core] Processing: ${input.substring(0, 50)}…`);

```
// Add your core processing logic here
// This is where the main agent functionality goes

return \`${className} processed: \${input}\`;
```

}

getCapabilities(): string[] {
return […this.capabilities];
}

async shutdown(): Promise<void> {
console.log(’[${className}Core] Shutting down core…’);
// Add cleanup logic here
}
}
`;
}

private generateWatcherFile(agentSpec: AgentSpec): string {
const className = agentSpec.name.charAt(0).toUpperCase() + agentSpec.name.slice(1);

```
return `import { ArchWatch } from '../../architect/intelligence/ArchWatch';
```

import { ${className}Core } from ‘../core/${className}Core’;

export class ${className}Watcher {
private core: ${className}Core;
private isWatching: boolean = false;

constructor(core: ${className}Core) {
this.core = core;
}

async initialize(): Promise<void> {
console.log(’[${className}Watcher] Initializing watcher…’);
this.isWatching = true;

```
// Start watching for relevant events
this.startWatching();
```

}

private startWatching(): void {
// Add your watching logic here
// Example: file system watching, event monitoring, etc.

```
setInterval(() => {
  if (this.isWatching) {
    // Periodic checks or maintenance
    ArchWatch.log('${agentSpec.name.toLowerCase()}-activity', 'low', 'active');
  }
}, 60000); // Check every minute
```

}

async shutdown(): Promise<void> {
console.log(’[${className}Watcher] Shutting down watcher…’);
this.isWatching = false;
}
}
`;
}

private generateIndexFile(agentSpec: AgentSpec): string {
const className = agentSpec.name.charAt(0).toUpperCase() + agentSpec.name.slice(1);

```
return `export { ${className} } from './${className}';
```

export { ${className}Core } from ‘./core/${className}Core’;
export { ${className}Discord } from ‘./communication/${className}Discord’;
export { ${className}Watcher } from ‘./intelligence/${className}Watcher’;
`;
}

private generateReadmeFile(agentSpec: AgentSpec): string {
return `# ${agentSpec.name}

${agentSpec.description}

## Features

${agentSpec.capabilities.map(cap => `- ${cap}`).join(’\n’)}

## Configuration

### Environment Variables

- `${agentSpec.name.toUpperCase()}_DISCORD_TOKEN`: Discord bot token (optional)

## Usage

```typescript
import { ${agentSpec.name.charAt(0).toUpperCase() + agentSpec.name.slice(1)} } from ‘./agents/${agentSpec.name.toLowerCase()}’;

const agent = new ${agentSpec.name.charAt(0).toUpperCase() + agentSpec.name.slice(1)}();
await agent.initialize();

const response = await agent.process(‘Your input here’);
console.log(response);
```

## Generated

This agent was generated by AgentBuilder on ${new Date().toISOString()}.
`;
}

/**

- Infer capabilities from description
  */
  private inferCapabilities(description: string): string[] {
  const capabilities: string[] = [];
  const desc = description.toLowerCase();

```
if (desc.includes('storage') || desc.includes('persist')) {
  capabilities.push('Data Storage');
}
if (desc.includes('queue') || desc.includes('task')) {
  capabilities.push('Task Management');
}
if (desc.includes('discord') || desc.includes('chat')) {
  capabilities.push('Discord Integration');
}
if (desc.includes('analysis') || desc.includes('analyze')) {
  capabilities.push('Data Analysis');
}
if (desc.includes('monitor') || desc.includes('watch')) {
  capabilities.push('System Monitoring');
}
if (desc.includes('test') || desc.includes('verify')) {
  capabilities.push('Testing & Verification');
}

// Default capability if none inferred
if (capabilities.length === 0) {
  capabilities.push('General Purpose Processing');
}

return capabilities;
```

}

/**

- Get stored agents (memory-based for Railway compatibility)
  */
  getStoredAgents(): AgentSpec[] {
  return Array.from(this.agentStore.values());
  }

/**

- Get specific agent config
  */
  getAgentConfig(name: string): AgentSpec | undefined {
  return this.agentStore.get(name);
  }
  }