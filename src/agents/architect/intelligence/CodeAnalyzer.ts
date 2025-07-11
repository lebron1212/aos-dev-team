import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs/promises';
import * as path from 'path';

interface AnalysisResult {
  summary: string;
  issues: string[];
  recommendations: string[];
  metrics: {
    filesAnalyzed: number;
    linesOfCode: number;
    complexityScore: number;
  };
  apiUsage: {
    tokens: number;
    cost: number;
    duration: number;
  };
}

export class CodeAnalyzer {
  private claude: Anthropic;
  private totalAPIUsage = { tokens: 0, cost: 0, calls: 0 };

  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
  }

  async analyzeSystemHealth(targetPath: string = 'src'): Promise<AnalysisResult> {
    console.log(`[CodeAnalyzer] 🔍 Starting system health analysis of ${targetPath}...`);
    const startTime = Date.now();
    
    try {
      const files = await this.findRelevantFiles(targetPath);
      console.log(`[CodeAnalyzer] 📁 Found ${files.length} files to analyze`);
      
      let totalLines = 0;
      let analysisContent = '';
      
      for (const file of files.slice(0, 10)) { // Analyze up to 10 key files
        try {
          console.log(`[CodeAnalyzer] 📖 Reading ${file}...`);
          const content = await fs.readFile(file, 'utf-8');
          const lines = content.split('\n').length;
          totalLines += lines;
          
          analysisContent += `\n=== ${file} (${lines} lines) ===\n${content.substring(0, 2000)}...\n`;
          console.log(`[CodeAnalyzer] Read ${file}: ${content.length} chars`);
        } catch (error) {
          console.log(`[CodeAnalyzer] ⚠️ Could not read ${file}: ${error}`);
        }
      }

      console.log(`[CodeAnalyzer] 🤖 Sending ${analysisContent.length} chars to Claude for analysis...`);
      const analysisStart = Date.now();
      
      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        system: `You are a senior code architect analyzing a TypeScript AI system. Provide:
1. Brief system overview
2. Key architectural strengths  
3. Critical issues found
4. Specific recommendations
5. Complexity assessment (1-10)

Be specific and actionable.`,
        messages: [{
          role: 'user',
          content: `Analyze this TypeScript AI system for health, architecture, and issues:\n\n${analysisContent}`
        }]
      });

      const analysisEnd = Date.now();
      const analysisDuration = analysisEnd - analysisStart;
      
      // Track API usage
      const tokens = response.usage ? response.usage.input_tokens + response.usage.output_tokens : 0;
      const cost = response.usage ? this.calculateCost(response.usage.input_tokens, response.usage.output_tokens) : 0;
      
      this.totalAPIUsage.tokens += tokens;
      this.totalAPIUsage.cost += cost;
      this.totalAPIUsage.calls += 1;
      
      console.log(`[CodeAnalyzer] ⚡ Claude analysis: ${tokens} tokens, $${cost.toFixed(4)}, ${analysisDuration}ms`);
      console.log(`[CodeAnalyzer] 💰 Session totals: ${this.totalAPIUsage.calls} calls, ${this.totalAPIUsage.tokens} tokens, $${this.totalAPIUsage.cost.toFixed(4)}`);

      const analysisText = response.content[0]?.type === 'text' ? response.content[0].text : 'Analysis failed';
      
      // Parse Claude's response into structured data
      const result = this.parseAnalysisResponse(analysisText, {
        filesAnalyzed: files.length,
        linesOfCode: totalLines,
        apiTokens: tokens,
        apiCost: cost,
        duration: Date.now() - startTime
      });

      console.log(`[CodeAnalyzer] ✅ Analysis complete: ${result.issues.length} issues, ${result.recommendations.length} recommendations`);
      return result;

    } catch (error) {
      console.error('[CodeAnalyzer] ❌ Analysis failed:', error);
      throw error;
    }
  }

  // Legacy method for compatibility with ArchitectOrchestrator
  async getSystemHealth(): Promise<any> {
    console.log('[CodeAnalyzer] 🔄 Using legacy getSystemHealth method, calling analyzeSystemHealth...');
    try {
      const result = await this.analyzeSystemHealth();
      return {
        status: 'healthy',
        summary: result.summary,
        issues: result.issues,
        recommendations: result.recommendations,
        complexity: result.metrics.complexityScore,
        filesAnalyzed: result.metrics.filesAnalyzed,
        apiCost: result.apiUsage.cost,
        tokens: result.apiUsage.tokens
      };
    } catch (error) {
      console.error('[CodeAnalyzer] ❌ getSystemHealth failed:', error);
      return {
        status: 'error',
        summary: 'System health check failed',
        issues: ['Health analysis unavailable'],
        recommendations: ['Retry analysis'],
        complexity: 5,
        filesAnalyzed: 0,
        apiCost: 0,
        tokens: 0
      };
    }
  }

  private async findRelevantFiles(basePath: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(basePath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(basePath, entry.name);
        
        if (entry.isDirectory() && !['node_modules', 'dist', 'logs', '.git'].includes(entry.name)) {
          files.push(...await this.findRelevantFiles(fullPath));
        } else if (entry.isFile() && fullPath.endsWith('.ts')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.log(`[CodeAnalyzer] Could not scan ${basePath}: ${error}`);
    }
    
    return files;
  }

  private parseAnalysisResponse(analysisText: string, metrics: any): AnalysisResult {
    // Simple parsing - in practice, could use more sophisticated extraction
    const lines = analysisText.split('\n');
    const issues: string[] = [];
    const recommendations: string[] = [];
    let summary = analysisText.substring(0, 200) + '...';
    
    for (const line of lines) {
      if (line.toLowerCase().includes('issue') || line.toLowerCase().includes('problem')) {
        issues.push(line.trim());
      }
      if (line.toLowerCase().includes('recommend') || line.toLowerCase().includes('should')) {
        recommendations.push(line.trim());
      }
    }

    return {
      summary,
      issues: issues.length > 0 ? issues : ['No critical issues identified'],
      recommendations: recommendations.length > 0 ? recommendations : ['System appears healthy'],
      metrics: {
        filesAnalyzed: metrics.filesAnalyzed,
        linesOfCode: metrics.linesOfCode,
        complexityScore: Math.min(10, Math.max(1, Math.floor(metrics.linesOfCode / 1000) + issues.length))
      },
      apiUsage: {
        tokens: metrics.apiTokens,
        cost: metrics.apiCost,
        duration: metrics.duration
      }
    };
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    // Claude 3 Haiku pricing
    const inputCost = (inputTokens / 1000000) * 0.25;
    const outputCost = (outputTokens / 1000000) * 1.25;
    return inputCost + outputCost;
  }

  getSessionStats() {
    return {
      totalCalls: this.totalAPIUsage.calls,
      totalTokens: this.totalAPIUsage.tokens,
      totalCost: this.totalAPIUsage.cost
    };
  }
}
