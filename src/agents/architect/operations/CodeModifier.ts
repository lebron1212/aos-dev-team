import fs from 'fs/promises';
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
      estimatedImpact: plan.impact
    };
  }

  /**
   * Plan targeted modifications using the intelligence system
   */
  async planTargetedModification(request: string): Promise<ModificationPlan | null> {
    const lowerRequest = request.toLowerCase();
    
    // Identify if this is a targeted modification
    const isTargeted = lowerRequest.includes('change') || lowerRequest.includes('increase') || 
                      lowerRequest.includes('decrease') || lowerRequest.includes('set') ||
                      lowerRequest.includes('tone down') || lowerRequest.includes('make');
    
    if (!isTargeted) return null;

    console.log(`[CodeModifier] Planning targeted modification: ${request}`);
    
    // Discover relevant files
    const files = FileMapper.discoverFiles(request);
    if (files.length === 0) return null;
    
    // Extract current configurations
    const configReport = await this.configExtractor.extractConfiguration(files, request);
    
    // Generate targeted modifications
    const modifications = await this.generateTargetedModifications(request, configReport, files);
    
    if (modifications.length === 0) return null;
    
    // Convert to change objects
    const changes: Change[] = modifications.map(mod => ({
      file: mod.file,
      type: 'modify' as const,
      description: `Change ${mod.property} from ${mod.currentValue} to ${mod.newValue}`,
      location: `line ${mod.lineNumber}`,
      content: this.generateModificationContent(mod)
    }));
    
    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (modifications.some(m => m.property.includes('token') && typeof m.newValue === 'number' && m.newValue > 200)) {
      riskLevel = 'medium';
    }
    if (modifications.some(m => m.property.includes('PROMPT') || m.file.includes('Voice'))) {
      riskLevel = 'medium';
    }
    
    return {
      id: `targeted_${Date.now()}`,
      description: `Targeted modification: ${request}`,
      files: modifications.map(m => m.file),
      changes,
      riskLevel,
      requiresApproval: riskLevel === 'high',
      estimatedImpact: `Will modify ${modifications.length} configuration value(s) in ${files.length} file(s)`
    };
  }

  /**
   * Generate specific targeted modifications
   */
  async generateTargetedModifications(request: string, configReport: any, files: string[]): Promise<TargetedModification[]> {
    const lowerRequest = request.toLowerCase();
    const modifications: TargetedModification[] = [];
    
    // Combine all configuration values
    const allConfigs = [
      ...configReport.configurations,
      ...configReport.constants,
      ...configReport.prompts
    ];
    
    for (const config of allConfigs) {
      const targetedMod = this.analyzeConfigForModification(config, request, lowerRequest);
      if (targetedMod) {
        modifications.push(targetedMod);
      }
    }
    
    return modifications;
  }

  /**
   * Analyze if a config should be modified based on the request
   */
  private analyzeConfigForModification(config: ConfigValue, request: string, lowerRequest: string): TargetedModification | null {
    const { key, value, file, line } = config;
    const lowerKey = key.toLowerCase();
    
    // Token limit modifications
    if (lowerKey.includes('max_tokens') || lowerKey.includes('token')) {
      if (lowerRequest.includes('increase') && lowerRequest.includes('token')) {
        const currentValue = typeof value === 'number' ? value : parseInt(value) || 35;
        let newValue = currentValue;
        
        if (lowerRequest.includes('sentence') || lowerRequest.includes('2-3 sentence')) {
          newValue = 150; // Enough for 2-3 sentences
        } else if (lowerRequest.includes('20 words')) {
          newValue = 30; // Approximately 20 words
        } else {
          newValue = Math.min(500, currentValue * 3); // Safe increase
        }
        
        return {
          file,
          property: key,
          currentValue,
          newValue,
          lineNumber: line,
          context: `Increasing token limit from ${currentValue} to ${newValue}`
        };
      }
    }
    
    // Humor modifications
    if (lowerKey.includes('humor') || (key.includes('PROMPT') && lowerRequest.includes('humor'))) {
      if (lowerRequest.includes('tone down') || lowerRequest.includes('reduce')) {
        return {
          file,
          property: key,
          currentValue: value,
          newValue: this.generateReducedHumorPrompt(value),
          lineNumber: line,
          context: 'Reducing humor level in voice prompt'
        };
      }
    }
    
    // Timeout modifications
    if (lowerKey.includes('timeout')) {
      if (lowerRequest.includes('increase') || lowerRequest.includes('30 seconds') || lowerRequest.includes('60 seconds')) {
        const targetSeconds = lowerRequest.includes('30') ? 30000 : 
                             lowerRequest.includes('60') ? 60000 : 30000;
        return {
          file,
          property: key,
          currentValue: value,
          newValue: targetSeconds,
          lineNumber: line,
          context: `Updating timeout to ${targetSeconds}ms`
        };
      }
    }
    
    return null;
  }

  /**
   * Generate content for a targeted modification
   */
  private generateModificationContent(mod: TargetedModification): string {
    if (mod.property.includes('PROMPT')) {
      // For prompts, return the new prompt content
      return mod.newValue;
    } else {
      // For simple values, return the assignment
      return `${mod.property}: ${typeof mod.newValue === 'string' ? `'${mod.newValue}'` : mod.newValue}`;
    }
  }

  /**
   * Generate a reduced humor version of a voice prompt
   */
  private generateReducedHumorPrompt(originalPrompt: string): string {
    if (typeof originalPrompt !== 'string') return originalPrompt;
    
    return originalPrompt
      .replace(/- Dry humor that lands naturally - never forced or trying too hard/g, '- Professional tone with subtle wit when appropriate')
      .replace(/- Witty one-liners that feel effortless and classy/g, '- Clear, concise responses')
      .replace(/- Charming and endearing beneath professional composure/g, '- Professional and helpful')
      .replace(/HUMOR STYLE:[\s\S]*?RESPONSE PATTERNS/g, 'RESPONSE PATTERNS')
      .replace(/Sophisticated enough for a boardroom, warm enough for late-night coding/g, 'Professional and appropriate for business context');
  }

  async executeModification(plan: ModificationPlan): Promise<any> {
    console.log(`[CodeModifier] Executing: ${plan.description}`);
    
    // Create a git checkpoint before making changes
    const checkpoint = await this.createCheckpoint(plan.description);
    
    const results = [];
    const modifiedFiles: string[] = [];
    
    for (const change of plan.changes) {
      try {
        let result;
        // Check if this is a targeted modification
        if (plan.id.startsWith('targeted_') && change.location?.includes('line')) {
          result = await this.applyTargetedChange(change);
        } else {
          result = await this.applyIntelligentChange(change);
        }
        
        results.push({ change: change.description, status: 'success', result });
        modifiedFiles.push(change.file);
      } catch (error) {
        results.push({ change: change.description, status: 'failed', error: (error as Error).message });
        
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

  /**
   * Apply targeted changes using precise line modifications
   */
  async applyTargetedChange(change: Change): Promise<string> {
    console.log(`[CodeModifier] Applying targeted change to ${change.file}: ${change.description}`);
    
    const filePath = change.file;
    
    // Read the current file content
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    // Extract line number from location
    const lineMatch = change.location?.match(/line (\d+)/);
    if (!lineMatch) {
      throw new Error(`No line number found in location: ${change.location}`);
    }
    
    const lineNumber = parseInt(lineMatch[1]) - 1; // Convert to 0-based index
    
    if (lineNumber < 0 || lineNumber >= lines.length) {
      throw new Error(`Line number ${lineNumber + 1} is out of range for ${filePath}`);
    }
    
    const originalLine = lines[lineNumber];
    let newLine = '';
    
    // Apply different modification strategies based on the change
    if (change.description.includes('max_tokens')) {
      // Modify token limits
      newLine = this.modifyTokenLimit(originalLine, change);
    } else if (change.description.includes('timeout')) {
      // Modify timeout values  
      newLine = this.modifyTimeout(originalLine, change);
    } else if (change.description.includes('humor') || change.description.includes('PROMPT')) {
      // Modify prompts - this is more complex and might span multiple lines
      return await this.modifyPromptContent(filePath, lineNumber, change);
    } else {
      // Generic property modification
      newLine = this.modifyGenericProperty(originalLine, change);
    }
    
    if (newLine === originalLine) {
      throw new Error(`No change detected for line: ${originalLine}`);
    }
    
    // Replace the line
    lines[lineNumber] = newLine;
    
    // Write back to file
    await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
    
    console.log(`[CodeModifier] Modified ${filePath} line ${lineNumber + 1}: ${originalLine.trim()} → ${newLine.trim()}`);
    
    return `Modified line ${lineNumber + 1}: ${newLine.trim()}`;
  }

  /**
   * Modify token limit in a line
   */
  private modifyTokenLimit(line: string, change: Change): string {
    // Extract new value from change content
    const newValueMatch = change.content?.match(/(\d+)/);
    if (!newValueMatch) {
      throw new Error('No new token value found in change content');
    }
    
    const newTokens = newValueMatch[1];
    
    // Replace max_tokens: oldValue with max_tokens: newValue
    return line.replace(/max_tokens:\s*\d+/, `max_tokens: ${newTokens}`);
  }

  /**
   * Modify timeout value in a line  
   */
  private modifyTimeout(line: string, change: Change): string {
    const newValueMatch = change.content?.match(/(\d+)/);
    if (!newValueMatch) {
      throw new Error('No new timeout value found in change content');
    }
    
    const newTimeout = newValueMatch[1];
    
    // Handle various timeout patterns
    return line
      .replace(/timeout:\s*\d+/, `timeout: ${newTimeout}`)
      .replace(/TimeOut:\s*\d+/, `TimeOut: ${newTimeout}`)
      .replace(/\d+\s*seconds?/, `${newTimeout} seconds`);
  }

  /**
   * Modify generic property in a line
   */
  private modifyGenericProperty(line: string, change: Change): string {
    if (!change.content) {
      throw new Error('No new content provided for generic modification');
    }
    
    // Try to extract property name and value from change content
    const propertyMatch = change.content.match(/(\w+):\s*(.+)/);
    if (propertyMatch) {
      const [, property, value] = propertyMatch;
      const regex = new RegExp(`${property}:\\s*[^,}]+`, 'g');
      return line.replace(regex, `${property}: ${value}`);
    }
    
    return change.content;
  }

  /**
   * Modify prompt content (handles multi-line prompts)
   */
  async modifyPromptContent(filePath: string, startLine: number, change: Change): Promise<string> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    // Find the start and end of the prompt (look for template literal backticks)
    let promptStart = startLine;
    let promptEnd = startLine;
    
    // Find the start of the template literal
    while (promptStart > 0 && !lines[promptStart].includes('`')) {
      promptStart--;
    }
    
    // Find the end of the template literal
    while (promptEnd < lines.length - 1 && !lines[promptEnd + 1].includes('`;')) {
      promptEnd++;
    }
    
    if (change.content && typeof change.content === 'string') {
      // Replace the entire prompt content
      const newPromptLines = change.content.split('\n');
      const beforePrompt = lines.slice(0, promptStart + 1);
      const afterPrompt = lines.slice(promptEnd + 1);
      
      // Reconstruct with new prompt
      beforePrompt[beforePrompt.length - 1] = beforePrompt[beforePrompt.length - 1].replace(/`.*/, '`' + newPromptLines[0]);
      const newLines = [...beforePrompt, ...newPromptLines.slice(1), ...afterPrompt];
      
      await fs.writeFile(filePath, newLines.join('\n'), 'utf-8');
      return `Modified prompt content (${promptEnd - promptStart + 1} lines)`;
    }
    
    throw new Error('No new prompt content provided');
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
