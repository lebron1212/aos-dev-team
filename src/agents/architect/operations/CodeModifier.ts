import fs from 'fs/promises';
import { execSync } from 'child_process';
import Anthropic from '@anthropic-ai/sdk';
import { ModificationPlan, Change } from '../types/index.js';

export class CodeModifier {
  private claude: Anthropic;

  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
  }

  async planModification(request: string): Promise<ModificationPlan> {
    const plan = await this.generateModificationPlan(request);
    
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
    const results = [];
    
    for (const change of plan.changes) {
      try {
        const result = await this.applyChange(change);
        results.push({ change: change.description, status: 'success', result });
      } catch (error) {
        results.push({ change: change.description, status: 'failed', error: error.message });
      }
    }

    if (results.every(r => r.status === 'success')) {
      await this.commitChanges(plan.description);
    }

    return {
      summary: `${results.filter(r => r.status === 'success').length}/${results.length} changes applied`,
      results,
      committed: results.every(r => r.status === 'success')
    };
  }

  private async generateModificationPlan(request: string): Promise<any> {
    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: `Generate a modification plan for this request: "${request}"

Respond in this JSON format:
{
  "description": "Brief description of changes",
  "files": ["file1.ts", "file2.ts"],
  "changes": [
    {
      "file": "filename.ts",
      "type": "modify|create|delete",
      "description": "What change to make",
      "location": "method/class name or line number"
    }
  ],
  "riskLevel": "low|medium|high",
  "impact": "Description of expected impact"
}`
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        try {
          return JSON.parse(content.text);
        } catch (parseError) {
          console.error('[CodeModifier] Failed to parse plan JSON:', parseError);
        }
      }
    } catch (error) {
      console.error('[CodeModifier] Plan generation failed:', error);
    }

    return {
      description: 'Manual modification required',
      files: [],
      changes: [],
      riskLevel: 'high',
      impact: 'Unknown impact - manual review needed'
    };
  }

  private async applyChange(change: Change): Promise<string> {
    switch (change.type) {
      case 'modify':
        return await this.modifyFile(change);
      case 'create':
        return await this.createFile(change);
      case 'delete':
        return await this.deleteFile(change);
      default:
        throw new Error(`Unknown change type: ${change.type}`);
    }
  }

  private async modifyFile(change: Change): Promise<string> {
    return `Would modify ${change.file}: ${change.description}`;
  }

  private async createFile(change: Change): Promise<string> {
    const content = await this.generateFileContent(change);
    await fs.writeFile(change.file, content);
    return `Created ${change.file}`;
  }

  private async deleteFile(change: Change): Promise<string> {
    await fs.unlink(change.file);
    return `Deleted ${change.file}`;
  }

  private async generateFileContent(change: Change): Promise<string> {
    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Generate TypeScript code for: ${change.description}

File: ${change.file}
Generate clean, well-structured TypeScript code.`
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        return content.text;
      }
    } catch (error) {
      console.error('[CodeModifier] Content generation failed:', error);
    }

    return `// Generated file: ${change.file}\n// TODO: Implement ${change.description}\n`;
  }

  private async commitChanges(description: string): Promise<void> {
    try {
      execSync('git add .', { stdio: 'ignore' });
      execSync(`git commit -m "🏗️ ${description}"`, { stdio: 'ignore' });
      execSync('git push origin main', { stdio: 'ignore' });
      console.log('[CodeModifier] Changes committed and pushed');
    } catch (error) {
      console.error('[CodeModifier] Git operations failed:', error);
    }
  }
}
