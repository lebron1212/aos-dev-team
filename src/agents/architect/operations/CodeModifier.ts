import fs from 'fs/promises';
import { execSync } from 'child_process';
import Anthropic from '@anthropic-ai/sdk';
import { ModificationPlan, Change } from '../types/index.js';

interface ModificationHistory {
  id: string;
  timestamp: string;
  description: string;
  files: string[];
  gitCommit: string;
  canUndo: boolean;
}

export class CodeModifier {
  private claude: Anthropic;
  private history: ModificationHistory[] = [];
  private historyFile = 'data/modification-history.json';

  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
    this.loadHistory();
  }

  async planModification(request: string): Promise<ModificationPlan> {
    console.log(`[CodeModifier] Planning: ${request}`);
    
    // Use Claude to analyze the request and create a smart plan
    const plan = await this.generateIntelligentPlan(request);
    
    return {
      id: `mod_${Date.now()}`,
      description: plan.description,
      files: plan.files,
      changes: plan.changes,
      riskLevel: plan.riskLevel,
      requiresApproval: plan.riskLevel === 'high',
      estimatedImpact: plan.impact
    };
  }

  async executeModification(plan: ModificationPlan): Promise<any> {
    console.log(`[CodeModifier] Executing: ${plan.description}`);
    
    // Create a git checkpoint before making changes
    const checkpoint = await this.createCheckpoint(plan.description);
    
    const results = [];
    const modifiedFiles: string[] = [];
    
    for (const change of plan.changes) {
      try {
        const result = await this.applyIntelligentChange(change);
        results.push({ change: change.description, status: 'success', result });
        modifiedFiles.push(change.file);
      } catch (error) {
        results.push({ change: change.description, status: 'failed', error: error.message });
        
        // If any change fails, rollback
        if (checkpoint) {
          await this.rollbackToCheckpoint(checkpoint);
          return {
            summary: `Modification failed, rolled back to checkpoint ${checkpoint}`,
            results,
            committed: false,
            rollback: checkpoint
          };
        }
      }
    }

    // If all changes successful, commit and sync
    if (results.every(r => r.status === 'success')) {
      const commit = await this.commitAndSync(plan.description, modifiedFiles);
      
      // Log to history
      await this.logModification({
        id: plan.id,
        timestamp: new Date().toISOString(),
        description: plan.description,
        files: modifiedFiles,
        gitCommit: commit,
        canUndo: true
      });
      
      return {
        summary: `${results.length} changes applied and synced to Railway`,
        results,
        committed: true,
        gitCommit: commit,
        canUndo: true
      };
    }

    return {
      summary: `${results.filter(r => r.status === 'success').length}/${results.length} changes applied`,
      results,
      committed: false
    };
  }

  async undoLastModification(): Promise<any> {
    const lastMod = this.history.filter(h => h.canUndo).pop();
    
    if (!lastMod) {
      return { success: false, message: 'No modifications to undo' };
    }
    
    try {
      // Git reset to before the change
      const prevCommit = execSync(`git log --format="%H" -n 1 ${lastMod.gitCommit}^`, { encoding: 'utf8' }).trim();
      execSync(`git reset --hard ${prevCommit}`, { stdio: 'pipe' });
      
      // Push the rollback
      execSync('git push origin main --force-with-lease', { stdio: 'pipe' });
      
      // Mark as undone
      lastMod.canUndo = false;
      await this.saveHistory();
      
      console.log(`[CodeModifier] Undid modification: ${lastMod.description}`);
      
      return {
        success: true,
        message: `Undid: ${lastMod.description}`,
        restoredFiles: lastMod.files,
        gitCommit: prevCommit
      };
    } catch (error) {
      console.error('[CodeModifier] Undo failed:', error);
      return { success: false, message: `Undo failed: ${error.message}` };
    }
  }

  async redoModification(modificationId: string): Promise<any> {
    // For redo, we'd need to store the forward changes too
    // For now, return info about what was undone
    const mod = this.history.find(h => h.id === modificationId);
    
    if (!mod) {
      return { success: false, message: 'Modification not found' };
    }
    
    return {
      success: false,
      message: 'Redo requires re-running the original modification',
      originalDescription: mod.description,
      files: mod.files
    };
  }

  private async generateIntelligentPlan(request: string): Promise<any> {
    try {
      // Read relevant files to understand current state
      const currentFiles = await this.identifyRelevantFiles(request);
      const fileContents = await this.readCurrentFiles(currentFiles);
      
      const codeContext = Object.entries(fileContents)
        .map(([file, content]) => `=== ${file} ===\n${content.slice(0, 1500)}`)
        .join('\n\n');

      const response = await this.claude.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `You are a senior software architect. Analyze this modification request and create a detailed plan.

REQUEST: ${request}

CURRENT CODE CONTEXT:
${codeContext}

Create a modification plan in this JSON format:
{
  "description": "Clear description of what will be changed",
  "files": ["file1.ts", "file2.ts"],
  "changes": [
    {
      "file": "path/to/file.ts",
      "type": "modify|create|delete",
      "description": "What specific change to make",
      "location": "class/method name or line area",
      "reasoning": "Why this change is needed"
    }
  ],
  "riskLevel": "low|medium|high",
  "impact": "Description of expected impact"
}

Be specific about exact changes needed. Consider the existing code structure and maintain consistency.`
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        try {
          return JSON.parse(content.text);
        } catch (parseError) {
          console.error('[CodeModifier] Failed to parse plan JSON:', parseError);
          return this.fallbackPlan(request);
        }
      }
    } catch (error) {
      console.error('[CodeModifier] Plan generation failed:', error);
    }

    return this.fallbackPlan(request);
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
      // Read current file
      const currentContent = await fs.readFile(change.file, 'utf8');
      
      // Use Claude to generate the modified version
      const response = await this.claude.messages.create({
        model: 'claude-3-opus-20240229',
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
      throw new Error(`Failed to modify ${change.file}: ${error.message}`);
    }
  }

  private async createFileIntelligently(change: Change): Promise<string> {
    try {
      // Use Claude to generate appropriate file content
      const response = await this.claude.messages.create({
        model: 'claude-3-opus-20240229',
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
        const dir = change.file.split('/').slice(0, -1).join('/');
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
    await fs.unlink(change.file);
    return `Deleted ${change.file}`;
  }

  private async createCheckpoint(description: string): Promise<string | null> {
    try {
      // Commit current state as checkpoint
      execSync('git add .', { stdio: 'pipe' });
      execSync(`git commit -m "📍 Checkpoint before: ${description}"`, { stdio: 'pipe' });
      const commit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
      console.log(`[CodeModifier] Created checkpoint: ${commit}`);
      return commit;
    } catch (error) {
      console.error('[CodeModifier] Failed to create checkpoint:', error);
      return null;
    }
  }

  private async rollbackToCheckpoint(commit: string): Promise<void> {
    try {
      execSync(`git reset --hard ${commit}`, { stdio: 'pipe' });
      console.log(`[CodeModifier] Rolled back to checkpoint: ${commit}`);
    } catch (error) {
      console.error('[CodeModifier] Rollback failed:', error);
    }
  }

  private async commitAndSync(description: string, files: string[]): Promise<string> {
    try {
      execSync('git add .', { stdio: 'pipe' });
      execSync(`git commit -m "🏗️ ${description}"`, { stdio: 'pipe' });
      execSync('git push origin main', { stdio: 'pipe' });
      
      const commit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
      console.log(`[CodeModifier] Committed and synced: ${commit}`);
      return commit;
    } catch (error) {
      console.error('[CodeModifier] Commit/sync failed:', error);
      throw error;
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

  private fallbackPlan(request: string): any {
    return {
      description: `Manual implementation required for: ${request}`,
      files: [],
      changes: [],
      riskLevel: 'high',
      impact: 'Unknown impact - requires manual analysis'
    };
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
