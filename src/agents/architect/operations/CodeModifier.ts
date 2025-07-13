import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import Anthropic from '@anthropic-ai/sdk';
import { ModificationPlan, Change } from '../types/index.js';
import { FileMapper } from '../intelligence/FileMapper.js';
import { ConfigurationExtractor, ConfigValue } from '../intelligence/ConfigurationExtractor.js';

interface ModificationHistory {
  id: string;
  timestamp: string;
  description: string;
  files: string[];
  gitCommit: string;
  canUndo: boolean;
}

interface TargetedModification {
  file: string;
  property: string;
  currentValue: any;
  newValue: any;
  lineNumber: number;
  context: string;
}

export class CodeModifier {
  private claude: Anthropic;
  private history: ModificationHistory[] = [];
  private historyFile = 'data/modification-history.json';
  private configExtractor: ConfigurationExtractor;

  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
    this.configExtractor = new ConfigurationExtractor();
    this.loadHistory();
  }

  async planModification(request: string): Promise<ModificationPlan> {
    console.log(`[CodeModifier] Planning: ${request}`);
    
    // Check if this is a targeted modification that can use intelligent planning
    const targetedPlan = await this.planTargetedModification(request);
    if (targetedPlan) {
      return targetedPlan;
    }
    
    // Fall back to Claude-based planning for complex modifications
    const plan = await this.generateIntelligentPlan(request);
    
    return {
      id: `mod_${Date.now()}`,
      description: plan.description,
      files: plan.files,
      changes: plan.changes,
      riskLevel: plan.riskLevel,
      requiresApproval: plan.riskLevel === 'high',
      estimatedDuration: '5-15 minutes'
    };
  }

  async executeModification(plan: ModificationPlan): Promise<any> {
    console.log(`[CodeModifier] Executing: ${plan.description}`);
    
    let checkpoint: string | null = null;
    
    try {
      // Create checkpoint before making changes
      checkpoint = await this.createCheckpoint(plan.description);
      
      const results: string[] = [];
      
      for (const change of plan.changes) {
        const result = await this.applyIntelligentChange(change);
        results.push(result);
      }
      
      // Try to commit and sync changes
      try {
        await this.commitAndSync(plan.description);
        
        // Log successful modification
        await this.logModification({
          id: plan.id,
          timestamp: new Date().toISOString(),
          description: plan.description,
          files: plan.files,
          gitCommit: checkpoint || 'file-based',
          canUndo: true
        });
        
        return {
          success: true,
          summary: `${plan.description}. Modified ${plan.files.length} files.`,
          results,
          committed: true,
          gitCommit: checkpoint
        };
        
      } catch (commitError) {
        console.error('[CodeModifier] Commit/sync failed:', commitError);
        
        return {
          success: true,
          summary: `${plan.description}. Modified files but sync failed: ${commitError.message}`,
          results,
          committed: false
        };
      }
      
    } catch (error) {
      // Rollback if we have a checkpoint and execution failed
      if (checkpoint) {
        try {
          await this.rollbackToCheckpoint(checkpoint);
          console.log(`[CodeModifier] Rolled back to checkpoint due to error`);
        } catch (rollbackError) {
          console.error('[CodeModifier] Rollback also failed:', rollbackError);
        }
      }
      
      throw error;
    }
  }

  async planTargetedModification(request: string): Promise<ModificationPlan | null> {
    console.log(`[CodeModifier] Analyzing for targeted modification: ${request}`);
    
    // Look for specific patterns that indicate targeted modifications
    const patterns = {
      configValue: /(?:change|set|update|modify)\s+(.+?)\s+(?:to|=)\s+(.+)/i,
      toneDown: /tone down (.+?) by (\d+)%/i,
      increase: /increase (.+?) (?:from|to) (\d+)/i,
      disable: /disable (.+)/i,
      enable: /enable (.+)/i
    };
    
    for (const [type, pattern] of Object.entries(patterns)) {
      const match = request.match(pattern);
      if (match) {
        console.log(`[CodeModifier] Detected ${type} pattern`);
        return await this.createTargetedPlan(type, match, request);
      }
    }
    
    return null;
  }

  private async createTargetedPlan(type: string, match: RegExpMatchArray, request: string): Promise<ModificationPlan> {
    const files = await this.identifyRelevantFiles(request);
    
    return {
      id: `targeted_${Date.now()}`,
      description: `Targeted ${type}: ${request}`,
      files,
      changes: [{
        file: files[0] || 'src/',
        type: 'modify',
        description: request,
        location: 'Configuration section',
        reasoning: 'Targeted configuration change',
        content: match[2] || undefined
      }],
      riskLevel: 'medium',
      requiresApproval: false,
      estimatedDuration: '2-5 minutes'
    };
  }

  private async generateIntelligentPlan(request: string): Promise<any> {
    try {
      const currentFiles = await this.identifyRelevantFiles(request);
      const fileContents = await this.readCurrentFiles(currentFiles);
      
      const codeContext = Object.entries(fileContents)
        .map(([file, content]) => `=== ${file} ===\n${content.slice(0, 1500)}`)
        .join('\n\n');

      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307', // Fixed: Use correct model name
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `You are a senior software architect. Create a modification plan in valid JSON format.

REQUEST: ${request}

CURRENT CODE CONTEXT:
${codeContext}

CRITICAL: Respond with ONLY valid JSON. No explanatory text before or after.

{
  "description": "Clear description of what will be changed",
  "files": ["file1.ts", "file2.ts"],
  "changes": [
    {
      "file": "path/to/file.ts",
      "type": "modify",
      "description": "What specific change to make",
      "location": "class/method name or line area",
      "reasoning": "Why this change is needed"
    }
  ],
  "riskLevel": "low",
  "impact": "Description of expected impact"
}`
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        let jsonText = content.text.trim();
        
        // Extract JSON from response
        const jsonStart = jsonText.indexOf('{');
        const jsonEnd = jsonText.lastIndexOf('}') + 1;
        
        if (jsonStart !== -1 && jsonEnd > jsonStart) {
          jsonText = jsonText.substring(jsonStart, jsonEnd);
        }
        
        try {
          const parsed = JSON.parse(jsonText);
          console.log('[CodeModifier] ✅ Successfully parsed plan JSON');
          return parsed;
        } catch (parseError) {
          console.error('[CodeModifier] JSON parsing failed, using fallback');
          console.error('Raw response:', jsonText.substring(0, 200) + '...');
          return this.createFallbackPlan(request, currentFiles);
        }
      }
    } catch (error) {
      console.error('[CodeModifier] Plan generation failed:', error);
    }

    return this.createFallbackPlan(request, []);
  }

  private createFallbackPlan(request: string, files: string[]): any {
    const riskLevel = this.assessRiskLevel(request);
    
    return {
      description: `Manual implementation required for: ${request}`,
      files: files.length > 0 ? files : ['src/'],
      changes: [{
        file: files[0] || 'src/',
        type: 'modify',
        description: request,
        location: 'To be determined during execution',
        reasoning: 'Complex request requiring manual analysis'
      }],
      riskLevel,
      impact: `${riskLevel} risk modification requiring approval`,
      requiresApproval: riskLevel === 'high'
    };
  }

  private assessRiskLevel(request: string): 'low' | 'medium' | 'high' {
    const lowerRequest = request.toLowerCase();
    
    if (lowerRequest.includes('delete') || lowerRequest.includes('remove') || 
        lowerRequest.includes('main branch') || lowerRequest.includes('production')) {
      return 'high';
    }
    
    if (lowerRequest.includes('modify') || lowerRequest.includes('change') || 
        lowerRequest.includes('update') || lowerRequest.includes('fix')) {
      return 'medium';
    }
    
    return 'low';
  }

  private async applyIntelligentChange(change: Change): Promise<string> {
    console.log(`[CodeModifier] Applying: ${change.description} to ${change.file}`);
    
    switch (change.type) {
      case 'modify':
        return await this.modifyFileIntelligently(change);
      case 'create':
        return await this.createFileIntelligently(change);
      case 'delete':
        return await this.deleteFile(change);
      default:
        throw new Error(`Unknown change type: ${change.type}`);
    }
  }

  private async modifyFileIntelligently(change: Change): Promise<string> {
    try {
      // Check if file exists
      const currentContent = await fs.readFile(change.file, 'utf8');
      
      // Use Claude to generate the modified version
      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307', // Fixed: Use correct model name
        max_tokens: 3000,
        messages: [{
          role: 'user',
          content: `Modify this TypeScript file according to the change request:

CHANGE REQUEST: ${change.description}
LOCATION: ${change.location || 'anywhere appropriate'}

CURRENT FILE CONTENT:
${currentContent}

Return the complete modified file content. Maintain all existing functionality while making the requested change. Keep the same code style and patterns.`
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        // Write the modified content
        await fs.writeFile(change.file, content.text);
        return `Modified ${change.file}`;
      }
      
      throw new Error('Failed to generate modified content');
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, treat as create
        return await this.createFileIntelligently(change);
      }
      throw new Error(`Failed to modify ${change.file}: ${error.message}`);
    }
  }

  private async createFileIntelligently(change: Change): Promise<string> {
    try {
      // Use Claude to generate appropriate file content
      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307', // Fixed: Use correct model name
        max_tokens: 3000,
        messages: [{
          role: 'user',
          content: `Create a new TypeScript file with this specification:

FILE: ${change.file}
DESCRIPTION: ${change.description}
REQUIREMENTS: ${change.content || 'Standard TypeScript patterns'}

Generate clean, well-structured TypeScript code that follows the existing project patterns. Include proper imports, exports, and TypeScript types.`
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        // Ensure directory exists
        const dir = path.dirname(change.file);
        await fs.mkdir(dir, { recursive: true });
        
        // Write the new file
        await fs.writeFile(change.file, content.text);
        return `Created ${change.file}`;
      }
      
      throw new Error('Failed to generate file content');
    } catch (error) {
      throw new Error(`Failed to create ${change.file}: ${error.message}`);
    }
  }

  private async deleteFile(change: Change): Promise<string> {
    try {
      await fs.unlink(change.file);
      return `Deleted ${change.file}`;
    } catch (error) {
      throw new Error(`Failed to delete ${change.file}: ${error.message}`);
    }
  }

  private async createCheckpoint(description: string): Promise<string> {
    try {
      // Check if we're in a git repository
      execSync('git rev-parse --is-inside-work-tree', { stdio: 'pipe' });
      
      // We're in a git repo, proceed normally
      execSync('git add .', { stdio: 'pipe' });
      const commitId = `mod_${Date.now()}`;
      execSync(`git commit -m "Checkpoint: ${description} [${commitId}]"`, { stdio: 'pipe' });
      
      console.log(`[CodeModifier] ✅ Git checkpoint created: ${commitId}`);
      return commitId;
      
    } catch (error) {
      // Not in git repo, use file-based backup
      console.log('[CodeModifier] Git unavailable, using file-based checkpoint');
      return await this.createFileBasedCheckpoint(description);
    }
  }

  private async createFileBasedCheckpoint(description: string): Promise<string> {
    const checkpointId = `checkpoint_${Date.now()}`;
    const backupDir = `data/backups/${checkpointId}`;
    
    try {
      await fs.mkdir(backupDir, { recursive: true });
      
      // Copy current src directory
      await this.copyDirectory('src', `${backupDir}/src`);
      
      // Save metadata
      const metadata = {
        id: checkpointId,
        description,
        timestamp: new Date().toISOString(),
        type: 'file-based-backup'
      };
      
      await fs.writeFile(`${backupDir}/metadata.json`, JSON.stringify(metadata, null, 2));
      console.log(`[CodeModifier] File-based checkpoint created: ${checkpointId}`);
      
      return checkpointId;
    } catch (error) {
      console.error('[CodeModifier] Checkpoint creation failed:', error);
      return `fallback_${Date.now()}`;
    }
  }

  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  private async rollbackToCheckpoint(commit: string): Promise<void> {
    try {
      if (commit.startsWith('checkpoint_')) {
        // File-based checkpoint rollback
        const backupDir = `data/backups/${commit}`;
        await this.copyDirectory(`${backupDir}/src`, 'src');
        console.log(`[CodeModifier] Rolled back to file-based checkpoint: ${commit}`);
      } else {
        // Git-based rollback
        execSync(`git reset --hard ${commit}`, { stdio: 'pipe' });
        console.log(`[CodeModifier] Rolled back to git checkpoint: ${commit}`);
      }
    } catch (error) {
      console.error('[CodeModifier] Rollback failed:', error);
      throw error;
    }
  }

  private async commitAndSync(description: string): Promise<void> {
    try {
      // Check if we're in a git repository
      execSync('git rev-parse --is-inside-work-tree', { stdio: 'pipe' });
      
      // Git operations
      execSync('git add .', { stdio: 'pipe' });
      execSync(`git commit -m "${description}"`, { stdio: 'pipe' });
      
      // Try to push, but don't fail if remote doesn't exist
      try {
        execSync('git push origin main', { stdio: 'pipe' });
        console.log('[CodeModifier] Changes synced to remote repository');
      } catch (pushError) {
        console.log('[CodeModifier] Remote push skipped (no remote configured)');
      }
      
    } catch (error) {
      console.log('[CodeModifier] Git operations skipped (not in repository)');
      // Continue without git - modifications are still saved to filesystem
    }
  }

  private async identifyRelevantFiles(request: string): Promise<string[]> {
    const requestLower = request.toLowerCase();
    const files: string[] = [];

    // Smart file identification based on request content
    if (requestLower.includes('voice') || requestLower.includes('personality')) {
      files.push('src/agents/commander/communication/VoiceSystem.ts');
    }
    
    if (requestLower.includes('feedback') || requestLower.includes('learning')) {
      files.push('src/agents/commander/intelligence/FeedbackLearningSystem.ts');
    }
    
    if (requestLower.includes('agent') || requestLower.includes('new agent')) {
      files.push('src/agents/commander/Commander.ts');
      files.push('src/index.ts');
    }

    if (requestLower.includes('architect') || requestLower.includes('build')) {
      files.push('src/agents/architect/Architect.ts');
      files.push('src/agents/architect/operations/AgentBuilder.ts');
    }

    // Default to some core files if nothing specific identified
    if (files.length === 0) {
      files.push('src/index.ts');
    }

    return files;
  }

  private async readCurrentFiles(filePaths: string[]): Promise<Record<string, string>> {
    const contents: Record<string, string> = {};
    
    for (const file of filePaths) {
      try {
        contents[file] = await fs.readFile(file, 'utf8');
      } catch (error) {
        contents[file] = `// File not found: ${error.message}`;
      }
    }
    
    return contents;
  }

  async undoLastModification(): Promise<any> {
    const lastMod = this.history.filter(h => h.canUndo).pop();
    
    if (!lastMod) {
      return { success: false, message: 'No modifications to undo' };
    }
    
    try {
      await this.rollbackToCheckpoint(lastMod.gitCommit);
      
      // Mark as undone
      lastMod.canUndo = false;
      await this.saveHistory();
      
      console.log(`[CodeModifier] Undid modification: ${lastMod.description}`);
      
      return {
        success: true,
        message: `Undid: ${lastMod.description}`,
        restoredFiles: lastMod.files,
        gitCommit: lastMod.gitCommit
      };
    } catch (error) {
      console.error('[CodeModifier] Undo failed:', error);
      return { success: false, message: `Undo failed: ${error.message}` };
    }
  }

  private async logModification(mod: ModificationHistory): Promise<void> {
    this.history.push(mod);
    await this.saveHistory();
  }

  private async loadHistory(): Promise<void> {
    try {
      const data = await fs.readFile(this.historyFile, 'utf8');
      this.history = JSON.parse(data);
    } catch (error) {
      this.history = [];
    }
  }

  private async saveHistory(): Promise<void> {
    try {
      await fs.mkdir('data', { recursive: true });
      await fs.writeFile(this.historyFile, JSON.stringify(this.history, null, 2));
    } catch (error) {
      console.error('[CodeModifier] Failed to save history:', error);
    }
  }
}
