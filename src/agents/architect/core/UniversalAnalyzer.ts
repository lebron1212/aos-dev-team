import { ArchitecturalRequest } from '../types/index.js';
import Anthropic from '@anthropic-ai/sdk';

export class UniversalAnalyzer {
  private claude: Anthropic;

  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
  }

  async analyzeArchitecturalRequest(
    input: string,
    userId: string
  ): Promise<ArchitecturalRequest> {
    
    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 500,
        system: `You are an AI architect analyzer. Classify architectural requests and extract key information.

ARCHITECTURAL REQUEST TYPES:
- analyze-code: Reviewing, auditing, or analyzing existing code
- modify-system: Changing existing system behavior or structure  
- build-agent: Creating new AI agents or components
- refine-behavior: Adjusting AI personalities, responses, or learning
- system-status: Checking system health, performance, or status

Respond in JSON format:
{
  "type": "request_type",
  "description": "clear description of what needs to be done",
  "target": "specific component/file if mentioned",
  "priority": "low|medium|high", 
  "riskLevel": "low|medium|high"
}`,
        messages: [{
          role: 'user',
          content: `Analyze this architectural request: "${input}"`
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        try {
          const parsed = JSON.parse(content.text);
          return {
            type: parsed.type || 'system-status',
            description: parsed.description || input,
            target: parsed.target,
            priority: parsed.priority || 'medium',
            riskLevel: parsed.riskLevel || 'medium'
          };
        } catch (parseError) {
          console.error('[UniversalAnalyzer] JSON parse failed:', parseError);
        }
      }
    } catch (error) {
      console.error('[UniversalAnalyzer] AI analysis failed:', error);
    }

    // Fallback classification
    return this.fallbackClassification(input);
  }

  private fallbackClassification(input: string): ArchitecturalRequest {
    const lowerInput = input.toLowerCase();
    
    let type: ArchitecturalRequest['type'] = 'system-status';
    let riskLevel: ArchitecturalRequest['riskLevel'] = 'low';
    
    if (lowerInput.includes('analyze') || lowerInput.includes('review')) {
      type = 'analyze-code';
    } else if (lowerInput.includes('modify') || lowerInput.includes('change') || lowerInput.includes('fix')) {
      type = 'modify-system';
      riskLevel = 'medium';
    } else if (lowerInput.includes('build') || lowerInput.includes('create') || lowerInput.includes('new agent')) {
      type = 'build-agent';
      riskLevel = 'high';
    } else if (lowerInput.includes('behavior') || lowerInput.includes('personality') || lowerInput.includes('voice')) {
      type = 'refine-behavior';
      riskLevel = 'medium';
    }
    
    return {
      type,
      description: input,
      priority: 'medium',
      riskLevel
    };
  }
}
