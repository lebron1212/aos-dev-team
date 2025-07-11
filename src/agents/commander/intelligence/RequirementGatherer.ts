import Anthropic from '@anthropic-ai/sdk';
import { RequirementGatheringResult } from '../types/index.js';

export class RequirementGatherer {
  private claude: Anthropic;
  
  constructor(apiKey: string) {
    this.claude = new Anthropic({ apiKey });
  }

  async analyzeRequirements(
    request: string,
    complexity: 'simple' | 'medium' | 'complex' | 'enterprise',
    previousContext?: {
      previousQuestions?: string[];
      previousAnswers?: string[];
      clarifiedSoFar?: string;
    }
  ): Promise<RequirementGatheringResult> {
    
    const analysisPrompt = `You are analyzing a user's request to determine if we have enough information to build something great, or if we need to ask ONE critical question.

REQUEST: "${request}"
COMPLEXITY: ${complexity}
${previousContext ? `PREVIOUS CONTEXT: ${JSON.stringify(previousContext)}` : ''}

PHILOSOPHY: 
- Only ask questions that SIGNIFICANTLY impact the final result
- Ask the MOST IMPORTANT question first
- Prefer building with smart defaults over asking unnecessary questions
- For simple requests, usually we have enough info

WHEN TO ASK QUESTIONS:
- Request is genuinely vague ("build a dashboard" - need to know what data)
- Critical functionality is unclear ("build a form" - what fields?)
- User preferences would dramatically change the approach

WHEN NOT TO ASK:
- Styling details (we can use great defaults)
- Technical implementation details (we'll choose the best approach)
- Minor features (we can build the core first)

EXAMPLES:
✅ GOOD QUESTIONS:
- "Build a dashboard" → "What data should the dashboard display?"
- "Create a form" → "What information should the form collect?"
- "Build a login system" → "Should users log in with email or username?"

❌ UNNECESSARY QUESTIONS:
- "Build a red button" → DON'T ASK (clear enough)
- "Make a contact form" → DON'T ASK (standard fields obvious)
- "Create a navigation menu" → DON'T ASK (standard nav pattern)

If the request is clear enough to build something good, return shouldProceed: true.
If you need ONE critical piece of info, ask the most important question.

Return JSON:
{
  "shouldProceed": true/false,
  "nextQuestion": "single most critical question or null",
  "gatheringComplete": true/false,
  "clarifiedRequest": "enhanced version of request with smart defaults",
  "extractedRequirements": ["list of clear requirements"]
}`;

    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 800,
        messages: [{ role: 'user', content: analysisPrompt }]
      });
      
      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Invalid response type from Claude');
      }
      
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response');
      }
      
      const result = JSON.parse(jsonMatch[0]);
      
      console.log(`[RequirementGatherer] Analysis: ${result.shouldProceed ? 'Ready to build' : 'Need clarification'}`);
      if (result.nextQuestion) {
        console.log(`[RequirementGatherer] Question: ${result.nextQuestion}`);
      }
      
      return {
        shouldProceed: result.shouldProceed,
        nextQuestion: result.nextQuestion,
        gatheringComplete: result.gatheringComplete,
        clarifiedRequest: result.clarifiedRequest || request,
        extractedRequirements: result.extractedRequirements || []
      };
      
    } catch (error) {
      console.error('[RequirementGatherer] Analysis failed:', error);
      
      // Fallback: proceed with original request for simple complexity
      return {
        shouldProceed: complexity === 'simple',
        nextQuestion: complexity !== 'simple' ? 'Could you provide more details about what you want to build?' : null,
        gatheringComplete: complexity === 'simple',
        clarifiedRequest: request,
        extractedRequirements: [request]
      };
    }
  }

  async processAnswerAndContinue(
    originalRequest: string,
    question: string,
    answer: string,
    previousContext: any
  ): Promise<RequirementGatheringResult> {
    
    const continuationPrompt = `User is building: "${originalRequest}"
We asked: "${question}"
They answered: "${answer}"

Previous context: ${JSON.stringify(previousContext)}

Now update the clarified request with this new information. Do we have enough to proceed, or need another question?

Return JSON with updated clarifiedRequest and whether to continue gathering.`;

    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 600,
        messages: [{ role: 'user', content: continuationPrompt }]
      });
      
      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Invalid response type from Claude');
      }
      
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response');
      }
      
      const result = JSON.parse(jsonMatch[0]);
      
      return {
        shouldProceed: result.shouldProceed,
        nextQuestion: result.nextQuestion,
        gatheringComplete: result.gatheringComplete,
        clarifiedRequest: result.clarifiedRequest,
        extractedRequirements: result.extractedRequirements || []
      };
      
    } catch (error) {
      console.error('[RequirementGatherer] Continuation failed:', error);
      
      // Fallback: proceed with what we have
      return {
        shouldProceed: true,
        nextQuestion: null,
        gatheringComplete: true,
        clarifiedRequest: `${originalRequest} - ${answer}`,
        extractedRequirements: [originalRequest, answer]
      };
    }
  }
}