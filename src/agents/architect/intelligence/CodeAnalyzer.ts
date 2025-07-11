import fs from 'fs/promises';
import Anthropic from '@anthropic-ai/sdk';
import { AnalysisResult } from '../types/index.js';

export class CodeAnalyzer {
  private claude: Anthropic;

  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
  }

  async analyzeCodebase(request: string): Promise<AnalysisResult> {
    console.log(`[CodeAnalyzer] AI analyzing: ${request}`);
    
    // Get the actual code files
    const targetFiles = await this.identifyTargetFiles(request);
    const codeContent = await this.readCodeFiles(targetFiles);
    
    // Use Claude to analyze the code intelligently
    const analysis = await this.performClaudeAnalysis(codeContent, request);
    
    return analysis;
  }

  async getSystemHealth(): Promise<AnalysisResult> {
    const coreFiles = [
      'src/agents/commander/communication/VoiceSystem.ts',
      'src/agents/commander/intelligence/FeedbackLearningSystem.ts',
      'src/agents/commander/core/UniversalRouter.ts',
      'src/agents/watcher/comwatch/ComWatch.ts'
    ];

    console.log('[CodeAnalyzer] Claude analyzing system health...');
    
    const codeContent = await this.readCodeFiles(coreFiles);
    
    // Let Claude analyze the entire system
    const systemAnalysis = await this.performClaudeAnalysis(
      codeContent, 
      "Analyze the overall health and status of this AI system. Look at code quality, architecture, potential issues, and suggestions for improvement."
    );

    return systemAnalysis;
  }

  private async performClaudeAnalysis(codeContent: Record<string, string>, request: string): Promise<AnalysisResult> {
    
    // Prepare code for Claude analysis
    const codeText = Object.entries(codeContent)
      .map(([file, content]) => {
        const fileName = file.split('/').pop();
        const truncatedContent = content.length > 3000 ? content.slice(0, 3000) + '\n// ... (truncated)' : content;
        return `=== ${fileName} ===\n${truncatedContent}`;
      })
      .join('\n\n');

    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: `You are a senior software architect analyzing this TypeScript AI system. 

REQUEST: ${request}

CODE TO ANALYZE:
${codeText}

Please analyze this code and provide insights in this JSON format:
{
  "summary": "Brief overview of what you found",
  "issues": ["specific issue 1", "specific issue 2", "specific issue 3"],
  "suggestions": ["actionable suggestion 1", "actionable suggestion 2"],
  "complexity": "low|medium|high",
  "healthScore": 85,
  "keyFindings": ["important insight 1", "important insight 2"]
}

Be specific about actual code patterns, architecture decisions, potential bugs, and real improvements that could be made. Focus on what would actually help the developers.`
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        try {
          // Try to parse Claude's JSON response
          const analysis = JSON.parse(content.text);
          
          return {
            files: Object.keys(codeContent),
            summary: analysis.summary || 'Analysis completed',
            issues: analysis.issues || [],
            suggestions: analysis.suggestions || [],
            complexity: analysis.complexity || 'medium',
            healthScore: analysis.healthScore || 75
          };
        } catch (parseError) {
          // If JSON parsing fails, extract insights from text
          return this.extractInsightsFromText(content.text, Object.keys(codeContent));
        }
      }
    } catch (error) {
      console.error('[CodeAnalyzer] Claude analysis failed:', error);
    }

    // Fallback if Claude fails
    return {
      files: Object.keys(codeContent),
      summary: 'Unable to perform detailed analysis - Claude API unavailable',
      issues: ['Analysis service temporarily unavailable'],
      suggestions: ['Retry analysis when Claude API is accessible'],
      complexity: 'medium',
      healthScore: 50
    };
  }

  private extractInsightsFromText(text: string, files: string[]): AnalysisResult {
    // Extract insights even if JSON parsing failed
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    // Look for issue patterns in Claude's text
    const issueLines = text.split('\n').filter(line => 
      line.toLowerCase().includes('issue') ||
      line.toLowerCase().includes('problem') ||
      line.toLowerCase().includes('bug') ||
      line.toLowerCase().includes('error')
    );
    
    issueLines.slice(0, 3).forEach(line => {
      const cleaned = line.replace(/[•\-*]/g, '').trim();
      if (cleaned.length > 10) issues.push(cleaned);
    });
    
    // Look for suggestion patterns
    const suggestionLines = text.split('\n').filter(line =>
      line.toLowerCase().includes('suggest') ||
      line.toLowerCase().includes('improve') ||
      line.toLowerCase().includes('could') ||
      line.toLowerCase().includes('should')
    );
    
    suggestionLines.slice(0, 3).forEach(line => {
      const cleaned = line.replace(/[•\-*]/g, '').trim();
      if (cleaned.length > 10) suggestions.push(cleaned);
    });
    
    return {
      files,
      summary: text.split('\n')[0] || 'Analysis completed',
      issues,
      suggestions,
      complexity: 'medium',
      healthScore: 75
    };
  }

  private async identifyTargetFiles(request: string): Promise<string[]> {
    const requestLower = request.toLowerCase();
    const files: string[] = [];

    if (requestLower.includes('voice') || requestLower.includes('commander voice')) {
      files.push('src/agents/commander/communication/VoiceSystem.ts');
    }
    
    if (requestLower.includes('feedback') || requestLower.includes('learning')) {
      files.push('src/agents/commander/intelligence/FeedbackLearningSystem.ts');
    }
    
    if (requestLower.includes('router') || requestLower.includes('routing')) {
      files.push('src/agents/commander/core/UniversalRouter.ts');
    }
    
    if (requestLower.includes('comwatch') || requestLower.includes('watcher')) {
      files.push('src/agents/watcher/comwatch/ComWatch.ts');
    }

    if (requestLower.includes('commander') && !files.length) {
      files.push('src/agents/commander/Commander.ts');
      files.push('src/agents/commander/communication/VoiceSystem.ts');
    }

    // Default to core analysis
    if (files.length === 0) {
      files.push('src/agents/commander/communication/VoiceSystem.ts');
      files.push('src/agents/commander/intelligence/FeedbackLearningSystem.ts');
    }

    console.log(`[CodeAnalyzer] Claude will analyze: ${files.join(', ')}`);
    return files;
  }

  private async readCodeFiles(filePaths: string[]): Promise<Record<string, string>> {
    const codeContent: Record<string, string> = {};
    
    for (const filePath of filePaths) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        codeContent[filePath] = content;
        console.log(`[CodeAnalyzer] Read ${filePath}: ${content.length} chars`);
      } catch (error) {
        console.error(`[CodeAnalyzer] Failed to read ${filePath}:`, error);
        codeContent[filePath] = `// File not accessible: ${error.message}`;
      }
    }
    
    return codeContent;
  }
}
