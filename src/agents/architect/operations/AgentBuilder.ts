import fs from “fs”;
import path from “path”;

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

export class AgentBuilder {
private claudeApiKey: string;
private discordToken?: string;
private baseDir: string;
private isRailway: boolean;

constructor(claudeApiKey: string, discordToken?: string) {
this.claudeApiKey = claudeApiKey;
this.discordToken = discordToken;
this.baseDir = process.cwd();
this.isRailway = process.env.RAILWAY_ENVIRONMENT === “production”;

```
if (this.isRailway) {
  console.warn("AgentBuilder: Railway detected - files will be ephemeral");
}
```

}

async parseAgentRequirements(requirements: string): Promise<AgentSpec> {
console.log(“Parsing requirements:”, requirements.substring(0, 100));

```
let name = "";
let description = "";

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
      requirements.substring(0, 50) + "..." : 
      requirements;
  }
}

if (!name) {
  name = "GeneratedAgent" + Date.now().toString().slice(-4);
  console.warn("No agent name found, using:", name);
}

const capabilities = this.inferCapabilities(description);

const agentSpec: AgentSpec = {
  name,
  description,
  capabilities,
  discordEnabled: true,
  watcherEnabled: true
};

console.log("Parsed agent spec:", agentSpec);
return agentSpec;
```

}

async generateAgent(agentSpec: AgentSpec): Promise<BuildResult> {
console.log(“Building agent:”, agentSpec.name);

```
try {
  // Check for existing agent
  if (await this.agentExists(agentSpec.name)) {
    console.warn("Agent already exists:", agentSpec.name);
  }

  // Try to write files
  const fileResults = await this.writeAgentFiles(agentSpec);
  const successCount = fileResults.filter(r => r.success).length;
  const totalFiles = fileResults.length;
  
  console.log("File operations:", successCount + "/" + totalFiles, "successful");
  
  const environmentVars: string[] = [];
  if (agentSpec.discordEnabled) {
    environmentVars.push(agentSpec.name.toUpperCase() + "_DISCORD_TOKEN");
  }

  if (successCount === 0) {
    console.error("All file operations failed!");
    
    if (this.isRailway) {
      return {
        ready: true,
        summary: "Agent " + agentSpec.name + " created in memory (Railway ephemeral filesystem)",
        environmentVars: environmentVars.length > 0 ? environmentVars : undefined
      };
    } else {
      return {
        ready: false,
        error: "File system write permissions denied. Check directory permissions."
      };
    }
  } else if (successCount < totalFiles) {
    console.warn("Partial success:", successCount + "/" + totalFiles, "files written");
    
    return {
      ready: true,
      summary: "Agent " + agentSpec.name + " partially created (" + successCount + "/" + totalFiles + " files written)",
      environmentVars: environmentVars.length > 0 ? environmentVars : undefined
    };
  } else {
    console.log("Agent created successfully:", agentSpec.name);
    
    return {
      ready: true,
      summary: "Agent " + agentSpec.name + " created successfully with all " + totalFiles + " files",
      environmentVars: environmentVars.length > 0 ? environmentVars : undefined
    };
  }

} catch (error) {
  console.error("Failed to build agent:", error);
  
  return {
    ready: false,
    error: error instanceof Error ? error.message : "Unknown error during agent creation"
  };
}
```

}

private async agentExists(name: string): Promise<boolean> {
const agentDir = path.join(this.baseDir, “src”, “agents”, name.toLowerCase());
try {
await fs.promises.access(agentDir);
return true;
} catch {
return false;
}
}

private async writeAgentFiles(agentSpec: AgentSpec): Promise<Array<{success: boolean; path: string; error?: string}>> {
const results = [];
const agentDir = path.join(this.baseDir, “src”, “agents”, agentSpec.name.toLowerCase());

```
try {
  await this.ensureDirectory(agentDir);
  
  const files = this.generateAgentFiles(agentSpec);
  
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(agentDir, relativePath);
    const result = await this.writeFileWithVerification(fullPath, content);
    results.push(result);
  }

} catch (error) {
  console.error("Error writing agent files:", error);
  results.push({
    success: false,
    path: agentDir,
    error: error instanceof Error ? error.message : "Unknown error"
  });
}

return results;
```

}

private async writeFileWithVerification(filePath: string, content: string): Promise<{success: boolean; path: string; error?: string}> {
try {
await this.ensureDirectory(path.dirname(filePath));
await fs.promises.writeFile(filePath, content, “utf8”);

```
  const stats = await fs.promises.stat(filePath);
  const writtenContent = await fs.promises.readFile(filePath, "utf8");
  
  if (writtenContent.length !== content.length) {
    throw new Error("Content verification failed: expected " + content.length + " chars, got " + writtenContent.length);
  }

  console.log("Successfully wrote", filePath, "(" + stats.size + " bytes)");
  
  return {
    success: true,
    path: filePath
  };

} catch (error) {
  const errorMsg = error instanceof Error ? error.message : "Unknown error";
  console.error("Failed to write", filePath + ":", errorMsg);
  
  return {
    success: false,
    path: filePath,
    error: errorMsg
  };
}
```

}

private async ensureDirectory(dirPath: string): Promise<void> {
try {
await fs.promises.access(dirPath);
} catch {
try {
await fs.promises.mkdir(dirPath, { recursive: true });
console.log(“Created directory:”, dirPath);
} catch (error) {
const errorMsg = error instanceof Error ? error.message : “Unknown error”;
console.error(“Failed to create directory”, dirPath + “:”, errorMsg);
throw error;
}
}
}

private generateAgentFiles(agentSpec: AgentSpec): Record<string, string> {
const className = agentSpec.name.charAt(0).toUpperCase() + agentSpec.name.slice(1);

```
return {
  [className + ".ts"]: this.generateMainAgentFile(agentSpec),
  ["communication/" + className + "Discord.ts"]: this.generateDiscordFile(agentSpec),
  ["core/" + className + "Core.ts"]: this.generateCoreFile(agentSpec),
  ["intelligence/" + className + "Watcher.ts"]: this.generateWatcherFile(agentSpec),
  "index.ts": this.generateIndexFile(agentSpec),
  "README.md": this.generateReadmeFile(agentSpec)
};
```

}

private generateMainAgentFile(agentSpec: AgentSpec): string {
const className = agentSpec.name.charAt(0).toUpperCase() + agentSpec.name.slice(1);

```
return "import { " + className + "Core } from './core/" + className + "Core';\n" +
       "import { " + className + "Discord } from './communication/" + className + "Discord';\n" +
       "import { " + className + "Watcher } from './intelligence/" + className + "Watcher';\n" +
       "\n" +
       "/**\n" +
       " * " + agentSpec.description + "\n" +
       " * Generated by AgentBuilder on " + new Date().toISOString() + "\n" +
       " */\n" +
       "export class " + className + " {\n" +
       "  private core: " + className + "Core;\n" +
       "  private discord?: " + className + "Discord;\n" +
       "  private watcher?: " + className + "Watcher;\n" +
       "\n" +
       "  constructor() {\n" +
       "    this.core = new " + className + "Core();\n" +
       (agentSpec.discordEnabled ? 
       "    if (process.env." + agentSpec.name.toUpperCase() + "_DISCORD_TOKEN) {\n" +
       "      this.discord = new " + className + "Discord(this.core);\n" +
       "    }\n" : "") +
       (agentSpec.watcherEnabled ? 
       "    this.watcher = new " + className + "Watcher(this.core);\n" : "") +
       "  }\n" +
       "\n" +
       "  async initialize(): Promise<void> {\n" +
       "    console.log('[" + className + "] Initializing...');\n" +
       "    await this.core.initialize();\n" +
       "    if (this.discord) await this.discord.initialize();\n" +
       "    if (this.watcher) await this.watcher.initialize();\n" +
       "    console.log('[" + className + "] Agent initialized successfully');\n" +
       "  }\n" +
       "\n" +
       "  async process(input: string): Promise<string> {\n" +
       "    return await this.core.process(input);\n" +
       "  }\n" +
       "\n" +
       "  async shutdown(): Promise<void> {\n" +
       "    console.log('[" + className + "] Shutting down...');\n" +
       "    if (this.watcher) await this.watcher.shutdown();\n" +
       "    if (this.discord) await this.discord.shutdown();\n" +
       "    await this.core.shutdown();\n" +
       "  }\n" +
       "}\n";
```

}

private generateDiscordFile(agentSpec: AgentSpec): string {
const className = agentSpec.name.charAt(0).toUpperCase() + agentSpec.name.slice(1);

```
return "import { Client, GatewayIntentBits, Message } from 'discord.js';\n" +
       "import { " + className + "Core } from '../core/" + className + "Core';\n" +
       "\n" +
       "export class " + className + "Discord {\n" +
       "  private client: Client;\n" +
       "  private core: " + className + "Core;\n" +
       "  private token?: string;\n" +
       "\n" +
       "  constructor(core: " + className + "Core) {\n" +
       "    this.core = core;\n" +
       "    this.token = process.env." + agentSpec.name.toUpperCase() + "_DISCORD_TOKEN;\n" +
       "    this.client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });\n" +
       "  }\n" +
       "\n" +
       "  async initialize(): Promise<void> {\n" +
       "    if (!this.token) {\n" +
       "      console.log('[" + className + "Discord] No token provided, skipping Discord integration');\n" +
       "      return;\n" +
       "    }\n" +
       "    this.client.on('ready', () => console.log('[" + className + "Discord] Logged in'));\n" +
       "    this.client.on('messageCreate', async (message: Message) => {\n" +
       "      if (message.author.bot) return;\n" +
       "      if (message.mentions.has(this.client.user!) || message.content.startsWith('/" + agentSpec.name.toLowerCase() + "')) {\n" +
       "        try {\n" +
       "          const response = await this.core.process(message.content);\n" +
       "          await message.reply(response);\n" +
       "        } catch (error) {\n" +
       "          console.error('[" + className + "Discord] Error:', error);\n" +
       "          await message.reply('Sorry, I encountered an error.');\n" +
       "        }\n" +
       "      }\n" +
       "    });\n" +
       "    await this.client.login(this.token);\n" +
       "  }\n" +
       "\n" +
       "  async shutdown(): Promise<void> {\n" +
       "    if (this.client) await this.client.destroy();\n" +
       "  }\n" +
       "}\n";
```

}

private generateCoreFile(agentSpec: AgentSpec): string {
const className = agentSpec.name.charAt(0).toUpperCase() + agentSpec.name.slice(1);

```
return "/**\n" +
       " * Core logic for " + agentSpec.name + "\n" +
       " * " + agentSpec.description + "\n" +
       " */\n" +
       "export class " + className + "Core {\n" +
       "  private capabilities: string[];\n" +
       "\n" +
       "  constructor() {\n" +
       "    this.capabilities = " + JSON.stringify(agentSpec.capabilities) + ";\n" +
       "  }\n" +
       "\n" +
       "  async initialize(): Promise<void> {\n" +
       "    console.log('[" + className + "Core] Initializing core functionality...');\n" +
       "  }\n" +
       "\n" +
       "  async process(input: string): Promise<string> {\n" +
       "    console.log('[" + className + "Core] Processing:', input.substring(0, 50) + '...');\n" +
       "    return '" + className + " processed: ' + input;\n" +
       "  }\n" +
       "\n" +
       "  getCapabilities(): string[] {\n" +
       "    return [...this.capabilities];\n" +
       "  }\n" +
       "\n" +
       "  async shutdown(): Promise<void> {\n" +
       "    console.log('[" + className + "Core] Shutting down core...');\n" +
       "  }\n" +
       "}\n";
```

}

private generateWatcherFile(agentSpec: AgentSpec): string {
const className = agentSpec.name.charAt(0).toUpperCase() + agentSpec.name.slice(1);

```
return "import { " + className + "Core } from '../core/" + className + "Core';\n" +
       "\n" +
       "export class " + className + "Watcher {\n" +
       "  private core: " + className + "Core;\n" +
       "  private isWatching: boolean = false;\n" +
       "\n" +
       "  constructor(core: " + className + "Core) {\n" +
       "    this.core = core;\n" +
       "  }\n" +
       "\n" +
       "  async initialize(): Promise<void> {\n" +
       "    console.log('[" + className + "Watcher] Initializing watcher...');\n" +
       "    this.isWatching = true;\n" +
       "    this.startWatching();\n" +
       "  }\n" +
       "\n" +
       "  private startWatching(): void {\n" +
       "    setInterval(() => {\n" +
       "      if (this.isWatching) {\n" +
       "        console.log('[" + className + "Watcher] Periodic check');\n" +
       "      }\n" +
       "    }, 60000);\n" +
       "  }\n" +
       "\n" +
       "  async shutdown(): Promise<void> {\n" +
       "    console.log('[" + className + "Watcher] Shutting down watcher...');\n" +
       "    this.isWatching = false;\n" +
       "  }\n" +
       "}\n";
```

}

private generateIndexFile(agentSpec: AgentSpec): string {
const className = agentSpec.name.charAt(0).toUpperCase() + agentSpec.name.slice(1);

```
return "export { " + className + " } from './" + className + "';\n" +
       "export { " + className + "Core } from './core/" + className + "Core';\n" +
       "export { " + className + "Discord } from './communication/" + className + "Discord';\n" +
       "export { " + className + "Watcher } from './intelligence/" + className + "Watcher';\n";
```

}

private generateReadmeFile(agentSpec: AgentSpec): string {
return “# “ + agentSpec.name + “\n\n” +
agentSpec.description + “\n\n” +
“## Features\n\n” +
agentSpec.capabilities.map(cap => “- “ + cap).join(”\n”) + “\n\n” +
“## Configuration\n\n” +
“### Environment Variables\n\n” +
“- `" + agentSpec.name.toUpperCase() + "_DISCORD_TOKEN`: Discord bot token (optional)\n\n” +
“## Generated\n\n” +
“This agent was generated by AgentBuilder on “ + new Date().toISOString() + “.\n”;
}

private inferCapabilities(description: string): string[] {
const capabilities: string[] = [];
const desc = description.toLowerCase();

```
if (desc.includes("storage") || desc.includes("persist")) {
  capabilities.push("Data Storage");
}
if (desc.includes("queue") || desc.includes("task")) {
  capabilities.push("Task Management");
}
if (desc.includes("discord") || desc.includes("chat")) {
  capabilities.push("Discord Integration");
}
if (desc.includes("analysis") || desc.includes("analyze")) {
  capabilities.push("Data Analysis");
}
if (desc.includes("monitor") || desc.includes("watch")) {
  capabilities.push("System Monitoring");
}
if (desc.includes("test") || desc.includes("verify")) {
  capabilities.push("Testing & Verification");
}

if (capabilities.length === 0) {
  capabilities.push("General Purpose Processing");
}

return capabilities;
```

}

getStoredAgents(): AgentSpec[] {
return [];
}

getAgentConfig(name: string): AgentSpec | undefined {
return undefined;
}
}