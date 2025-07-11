import { ArchitecturalRequest } from '../types/index.js';
import { CodeIntelligence } from '../intelligence/CodeIntelligence.js';
import Anthropic from '@anthropic-ai/sdk';

export class UniversalAnalyzer {
  private claude: Anthropic;
  private codeIntelligence: CodeIntelligence;

  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
    this.codeIntelligence = new CodeIntelligence(claudeApiKey);
  }

  async analyzeArchitecturalRequest(
    input: string,
    userId: string
  ): Promise<ArchitecturalRequest> {
    
    try {
      // First try intelligent classification for specific queries
      const intelligenceResult = await this.tryIntelligentClassification(input);
      if (intelligenceResult) {
        return intelligenceResult;
      }

      // Fall back to Claude-based classification
      const response = await this.claude.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 500,
        system: `You are an AI architect analyzer. Classify architectural requests and extract key information.

ARCHITECTURAL REQUEST TYPES:
- code-analysis: Reviewing, auditing, or analyzing existing code
- system-modification: Changing existing system behavior or structure  
- agent-creation: Creating new AI agents or components
- behavior-refinement: Adjusting AI personalities, responses, or learning
- system-status: Checking system health, performance, or status

ENHANCED INTELLIGENCE PATTERNS:
- Configuration queries: "What's X setting?", "How many Y?", "Current Z value?"
- Targeted modifications: "Change X to Y", "Increase Z", "Tone down A"
- Feature analysis: "How does X work?", "Show me Y implementation"

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

  /**
   * Try intelligent classification for specific code intelligence patterns
   */
  private async tryIntelligentClassification(input: string): Promise<ArchitecturalRequest | null> {
    const lowerInput = input.toLowerCase();
    
    // Detect code intelligence patterns
    const isConfigQuery = lowerInput.includes('what\'s') || lowerInput.includes('current') || 
                         lowerInput.includes('how many') || lowerInput.includes('show me');
    
    const isModification = lowerInput.includes('change') || lowerInput.includes('modify') || 
                          lowerInput.includes('increase') || lowerInput.includes('decrease') ||
                          lowerInput.includes('tone down') || lowerInput.includes('make') ||
                          lowerInput.includes('set') || lowerInput.includes('update');
    
    const isAnalysis = lowerInput.includes('how does') || lowerInput.includes('analyze') ||
                      lowerInput.includes('explain') || lowerInput.includes('implementation');

    if (isConfigQuery || isModification || isAnalysis) {
      let type: ArchitecturalRequest['type'] = 'code-analysis';
      let riskLevel: ArchitecturalRequest['riskLevel'] = 'low';
      
      if (isModification) {
        type = 'system-modification';
        riskLevel = 'medium';
      } else if (isAnalysis) {
        type = 'code-analysis';
        riskLevel = 'low';
      }
      
      return {
        type,
        description: input,
        priority: 'medium',
        riskLevel
      };
    }
    
    return null;
  }

  private fallbackClassification(input: string): ArchitecturalRequest {
    const lowerInput = input.toLowerCase();
    
    let type: ArchitecturalRequest['type'] = 'system-status';
    let riskLevel: ArchitecturalRequest['riskLevel'] = 'low';
    
    if (lowerInput.includes('analyze') || lowerInput.includes('review')) {
      type = 'code-analysis';
    } else if (lowerInput.includes('modify') || lowerInput.includes('change') || lowerInput.includes('fix')) {
      type = 'system-modification';
      riskLevel = 'medium';
    } else if (lowerInput.includes('build') || lowerInput.includes('create') || lowerInput.includes('new agent')) {
      type = 'agent-creation';
      riskLevel = 'high';
    } else if (lowerInput.includes('behavior') || lowerInput.includes('personality') || lowerInput.includes('voice')) {
      type = 'behavior-refinement';
      riskLevel = 'medium';
    }
    
    return {
      type,
      description: input,
      priority: 'medium',
      riskLevel
    };
  }

  /**
   * Get the code intelligence engine for advanced analysis
   */
  getCodeIntelligence(): CodeIntelligence {
    return this.codeIntelligence;
  }
}
