import fs from 'fs/promises';
import Anthropic from '@anthropic-ai/sdk';
import { AnalysisResult } from '../types/index.js';

export class CodeAnalyzer {
  private claude: Anthropic;

  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
  }

  async analyzeCodebase(request: string): Promise<AnalysisResult> {
    const targetFiles = await this.identifyTargetFiles(request);
    const codeContent = await this.readCodeFiles(targetFiles);
    
    const analysis = await this.performAIAnalysis(codeContent, request);
    
    return {
      files: targetFiles,
      summary: analysis.summary,
      issues: analysis.issues,
      suggestions: analysis.suggestions,
      complexity: analysis.complexity,
      healthScore: analysis.healthScore
    };
  }

  async getSystemHealth(): Promise<AnalysisResult> {
    const coreFiles = [
      'src/agents/commander/Commander.ts',
      'src/agents/commander/core/UniversalRouter.ts',
      'src/agents/commander/communication/VoiceSystem.ts',
      'src/agents/watcher/comwatch/ComWatch.ts'
    ];

    const healthChecks = await Promise.all(
      coreFiles.map(async (file) => {
        try {
          const content = await fs.readFile(file, 'utf8');
          const lineCount = content.split('\n').length;
          const hasErrors = content.includes('TODO') || content.includes('FIXME');
          
          return {
            file,
            status: hasErrors ? 'needs-attention' : 'healthy',
            lines: lineCount,
            lastModified: (await fs.stat(file)).mtime
          };
        } catch (error) {
          return {
            file,
            status: 'missing',
            error: error.message
          };
        }
      })
    );

    const healthyCount = healthChecks.filter(check => check.status === 'healthy').length;
    const totalCount = healthChecks.length;
    const healthScore = (healthyCount / totalCount) * 100;
    
    return {
      files: coreFiles,
      summary: `${healthyCount}/${totalCount} core systems healthy`,
      issues: healthChecks.filter(c => c.status !== 'healthy').map(c => `${c.file}: ${c.status}`),
      suggestions: healthScore < 80 ? ['Review TODO items', 'Address missing files'] : ['System running well'],
      complexity: healthScore > 90 ? 'low' : healthScore > 70 ? 'medium' : 'high',
      healthScore
    };
  }

  private async identifyTargetFiles(request: string): Promise<string[]> {
    const requestLower = request.toLowerCase();
    const files: string[] = [];

    if (requestLower.includes('commander') || requestLower.includes('voice')) {
      files.push('src/agents/commander/Commander.ts');
      files.push('src/agents/commander/communication/VoiceSystem.ts');
    }
    
    if (requestLower.includes('router') || requestLower.includes('routing')) {
      files.push('src/agents/commander/core/UniversalRouter.ts');
    }
    
    if (requestLower.includes('feedback') || requestLower.includes('learning')) {
      files.push('src/agents/commander/intelligence/FeedbackLearningSystem.ts');
    }
    
    if (requestLower.includes('comwatch') || requestLower.includes('watcher')) {
      files.push('src/agents/watcher/comwatch/ComWatch.ts');
    }

    if (files.length === 0) {
      files.push(
        'src/agents/commander/core/UniversalRouter.ts',
        'src/agents/commander/communication/VoiceSystem.ts'
      );
    }

    return files;
  }

  private async readCodeFiles(filePaths: string[]): Promise<Record<string, string>> {
    const codeContent: Record<string, string> = {};
    
    for (const filePath of filePaths) {
      try {
        codeContent[filePath] = await fs.readFile(filePath, 'utf8');
      } catch (error) {
        console.error(`[CodeAnalyzer] Failed to read ${filePath}:`, error);
        codeContent[filePath] = `// File not found: ${error.message}`;
      }
    }
    
    return codeContent;
  }

  private async performAIAnalysis(codeContent: Record<string, string>, request: string): Promise<any> {
    const codeText = Object.entries(codeContent)
      .map(([file, content]) => `// ${file}\n${content.slice(0, 2000)}`)
      .join('\n\n');

    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Analyze this TypeScript code for: ${request}

Code to analyze:
${codeText}

Provide analysis in this format:
SUMMARY: Brief overview
ISSUES: Any problems found
SUGGESTIONS: Improvement recommendations
COMPLEXITY: low|medium|high
HEALTH_SCORE: 0-100`
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        return this.parseAnalysisResponse(content.text);
      }
    } catch (error) {
      console.error('[CodeAnalyzer] AI analysis failed:', error);
    }

    return {
      summary: 'Code analysis completed',
      issues: ['Analysis service unavailable'],
      suggestions: ['Manual review recommended'],
      complexity: 'medium',
      healthScore: 75
    };
  }

  private parseAnalysisResponse(response: string): any {
    const sections = {
      summary: 'Analysis completed',
      issues: [],
      suggestions: [],
      complexity: 'medium',
      healthScore: 75
    };

    const summaryMatch = response.match(/SUMMARY:\s*(.+?)(?=\n[A-Z_]+:|$)/s);
    if (summaryMatch) sections.summary = summaryMatch[1].trim();

    const issuesMatch = response.match(/ISSUES:\s*(.+?)(?=\n[A-Z_]+:|$)/s);
    if (issuesMatch) {
      sections.issues = issuesMatch[1].split('\n').filter(line => line.trim()).map(line => line.trim());
    }

    const suggestionsMatch = response.match(/SUGGESTIONS:\s*(.+?)(?=\n[A-Z_]+:|$)/s);
    if (suggestionsMatch) {
      sections.suggestions = suggestionsMatch[1].split('\n').filter(line => line.trim()).map(line => line.trim());
    }

    const complexityMatch = response.match(/COMPLEXITY:\s*(.+?)(?=\n[A-Z_]+:|$)/s);
    if (complexityMatch) sections.complexity = complexityMatch[1].trim();

    const healthMatch = response.match(/HEALTH_SCORE:\s*(\d+)/);
    if (healthMatch) sections.healthScore = parseInt(healthMatch[1]);

    return sections;
  }
}
