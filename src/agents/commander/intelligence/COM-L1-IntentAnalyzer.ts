import Anthropic from '@anthropic-ai/sdk';
import { UniversalIntent } from '../types/index.js';
import { VoiceSystem } from '../communication/VoiceSystem.js';

export class COM_L1_IntentAnalyzer {
  private claude: Anthropic;
  
  constructor(apiKey: string) {
    this.claude = new Anthropic({ apiKey });
  }

  async analyzeUniversalIntent(input: string, context?: {
    recentWorkItems?: string[];
    userPreferences?: Record<string, any>;
    conversationHistory?: string[];
  }): Promise<UniversalIntent> {
    
    const analysisPrompt = `You are COM-L1, the master intent analyzer for an AI development system. Your job is to understand ANY user input and classify it perfectly.

USER INPUT: "${input}"

CONTEXT:
${context?.recentWorkItems ? `Recent Work: ${context.recentWorkItems.join(', ')}` : ''}
${context?.userPreferences ? `User Preferences: ${JSON.stringify(context.userPreferences)}` : ''}

CLASSIFICATION SYSTEM:

LEVEL 1 CATEGORIES:
- build: Create something new (UI, API, feature, component, app, etc.)
- modify: Change existing work (fix, update, enhance, style, etc.)  
- analyze: Examine/inspect (code review, performance, health, debug)
- manage: Control workflow (pause, cancel, status, deploy, etc.)
- question: Ask for information (how to, what is, explain, etc.)
- conversation: General chat, feedback, thanks, etc.

LEVEL 2 SUBCATEGORIES (examples):
- build: build-ui, build-api, build-integration, build-full-app
- modify: modify-existing, modify-style, modify-behavior, modify-content
- analyze: analyze-code, analyze-performance, analyze-health  
- manage: manage-work, manage-deployment, manage-project

LEVEL 3 SPECIFIC (examples):
- build-ui: build-ui-component, build-ui-form, build-ui-page, build-ui-layout
- modify-existing: modify-component-style, modify-component-behavior

AGENT ROUTING:
- UI/Frontend: FrontendArchitect
- Backend/API: BackendEngineer (TODO)
- Performance: PerformanceOptimizer (TODO)  
- Quality: QCAgent
- Analysis: CodeAnalyzer (TODO)
- Memory: MemoryService (TODO)

COMPLEXITY ASSESSMENT:
- simple: Basic components, single features (90% of requests)
- medium: Multi-component systems, integrations (8%)
- complex: Full applications, real-time features (1.5%)
- enterprise: Multi-system integration, advanced architecture (0.5%)

EXAMPLES:
"Build a button" → build/build-ui/build-ui-component, [FrontendArchitect], simple
"Make that red" → modify/modify-style/modify-component-style, [FrontendArchitect], simple  
"How's the project?" → analyze/analyze-health/analyze-project-health, [CodeAnalyzer], simple
"Cancel the login work" → manage/manage-work/manage-cancel, [Commander], simple
"What is React?" → question/question-concept/question-tech-concept, [Commander], simple
"Thanks, looks great!" → conversation/conversation-positive/conversation-feedback, [MemoryService], simple

Be intelligent about context. If user says "make it bigger" and recent work was a button, it's modify-component-style targeting that button.

Return JSON:
{
  "category": "build|modify|analyze|manage|question|conversation",
  "subcategory": "specific subcategory",
  "specific": "most specific classification",
  "confidence": 0.85-0.98,
  "reasoning": "why you classified it this way",
  "requiredAgents": ["AgentName"],
  "estimatedComplexity": "simple|medium|complex|enterprise",
  "parameters": {
    "description": "enhanced description",
    "target": "what to modify (if modify)",
    "context": "relevant context",
    "requirements": ["extracted requirements"]
  }
}`;

    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 1000,
        system: VoiceSystem.getSystemPrompt(),
        messages: [{ role: 'user', content: analysisPrompt }]
      });
      
      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Invalid response type from Claude');
      }
      
      // Extract JSON from response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response');
      }
      
      const result = JSON.parse(jsonMatch[0]);
      
      console.log(`[COM-L1] Intent: ${result.category}/${result.subcategory} (${result.confidence}) - ${result.reasoning}`);
      
      return {
        category: result.category,
        subcategory: result.subcategory,
        specific: result.specific,
        confidence: result.confidence,
        reasoning: result.reasoning,
        requiredAgents: result.requiredAgents || ['FrontendArchitect'],
        estimatedComplexity: result.estimatedComplexity || 'simple',
        parameters: {
          description: result.parameters?.description || input,
          target: result.parameters?.target,
          context: result.parameters?.context,
          requirements: result.parameters?.requirements || []
        }
      };
      
    } catch (error) {
      console.error('[COM-L1] Intent analysis failed:', error);
      
      // Fallback classification
      return this.fallbackClassification(input);
    }
  }

  private fallbackClassification(input: string): UniversalIntent {
    const lowerInput = input.toLowerCase();
    
    // Simple keyword fallback
    if (lowerInput.includes('build') || lowerInput.includes('create') || lowerInput.includes('make')) {
      return {
        category: 'build',
        subcategory: 'build-ui',
        specific: 'build-ui-component',
        confidence: 0.7,
        reasoning: 'Fallback: Detected build keywords',
        requiredAgents: ['FrontendArchitect'],
        estimatedComplexity: 'simple',
        parameters: {
          description: input,
          requirements: []
        }
      };
    }
    
    // Default to conversation for unclear inputs
    return {
      category: 'conversation',
      subcategory: 'conversation-unclear',
      specific: 'conversation-needs-clarification',
      confidence: 0.6,
      reasoning: 'Fallback: Input unclear, needs clarification',
      requiredAgents: ['Commander'],
      estimatedComplexity: 'simple',
      parameters: {
        description: input,
        requirements: []
      }
    };
  }
}