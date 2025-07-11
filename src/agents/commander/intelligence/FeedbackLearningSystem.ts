import fs from 'fs/promises';
import path from 'path';

interface FeedbackExample {
 id: string;
 timestamp: Date;
 context: string;
 userInput: string;
 commanderResponse: string;
 userFeedback: string;
 suggestedImprovement?: string;
 feedbackType: 'positive' | 'negative' | 'suggestion';
 category: 'work' | 'casual' | 'wit' | 'personality';
}

export class FeedbackLearningSystem {
 private claude: any;
 private feedbackFile = 'data/commander-feedback.json';
 private examples: FeedbackExample[] = [];
 
 constructor(claudeApiKey?: string) {
   if (claudeApiKey) {
     this.claude = new (require('@anthropic-ai/sdk')).default({ apiKey: claudeApiKey });
   }   this.loadFeedback();
 }

 // NEW: Handle both old and new method signatures
 async logFeedback(
   userInputOrParam1: string,
   commanderResponseOrParam2: string,
   feedbackTypeOrParam3: string,
   contextOrParam4?: string,
   suggestedImprovementOrParam5?: string
 ): Promise<void> {
   
   // Handle the Discord interface call: (input, response, type, context, suggestion)
   const userInput = userInputOrParam1;
   const commanderResponse = commanderResponseOrParam2;
   const feedbackType = feedbackTypeOrParam3;
   const context = contextOrParam4 || 'Discord interaction';
   const suggestedImprovement = suggestedImprovementOrParam5;
   
   const feedback: FeedbackExample = {
     id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
     timestamp: new Date(),
     context,
     userInput,
     commanderResponse,
     userFeedback: feedbackType,
     suggestedImprovement,
     feedbackType: await this.classifyFeedback(feedbackType, context),
     category: this.classifyCategory(userInput, commanderResponse)
   };

   this.examples.push(feedback);
   await this.saveFeedback();
   
   console.log(`[FeedbackLearning] Logged feedback: ${feedback.feedbackType} - ${feedback.category}`);
 }

 generateLearningExamples(): string {
   const recentExamples = this.examples
     .filter(ex => ex.feedbackType === 'negative' || ex.suggestedImprovement)
     .slice(-10);
   
   if (recentExamples.length === 0) return '';
   
   const corrections = recentExamples.map(ex => {
     if (ex.suggestedImprovement) {
       return `AVOID: "${ex.commanderResponse}"\nUSE: "${ex.suggestedImprovement}"`;
     } else if (ex.userFeedback.includes('DO NOT')) {
       const avoidPattern = ex.userFeedback.match(/DO NOT ([^.]+)/i)?.[1] || ex.userFeedback;
       return `NEVER: ${avoidPattern}\nGOOD: "${ex.userInput}" → direct professional response`;
     }
     return `IMPROVE: Avoid patterns in "${ex.commanderResponse}"`;
   }).join('\n\n');
   
   return `\nLEARNED CORRECTIONS:\n${corrections}\n\nAPPLY THESE LESSONS TO AVOID REPEATING MISTAKES.`;
 }

 async detectFeedback(userMessage: string, lastResponse: string): Promise<boolean> {
   // Use AI to detect if this is feedback about the previous response
   try {
     const claude = new (await import('@anthropic-ai/sdk')).default({ 
       apiKey: process.env.CLAUDE_API_KEY 
     });
     
     const response = await claude.messages.create({
       model: 'claude-3-haiku-20240307',
       max_tokens: 50,
       messages: [{
         role: 'user',
         content: `Previous AI response: "${lastResponse}"
User's next message: "${userMessage}"

Is the user giving feedback/correction about the previous response? Answer only: YES or NO`
       }]
     });
     
     const content = response.content[0];
     return content.type === 'text' && content.text.trim().toUpperCase().includes('YES');
   } catch (error) {
     console.error('[FeedbackLearning] AI feedback detection failed, using fallback');
     // Fallback to simple patterns only if AI fails
     return /feedback|correction|better|instead|don't|avoid/i.test(userMessage);
   }
 }

 async extractSuggestion(userFeedback: string, previousResponse: string): Promise<string | undefined> {
   try {
     const claude = new (await import('@anthropic-ai/sdk')).default({ 
       apiKey: process.env.CLAUDE_API_KEY 
     });
     
     const response = await claude.messages.create({
       model: 'claude-3-haiku-20240307',
       max_tokens: 200,
       messages: [{
         role: 'user',
         content: `Previous AI response: "${previousResponse}"
User feedback: "${userFeedback}"

Extract what the user wants the AI to say instead. If they're giving a specific alternative or correction, return just that text. If no specific alternative is provided, return "GENERAL_FEEDBACK".

Examples:
- "could just leave it at 'Morning. Ready to build...'" → "Morning. Ready to build..."  
- "don't smirk" → "GENERAL_FEEDBACK"
- "say 'On it' instead" → "On it"
- "be more direct" → "GENERAL_FEEDBACK"`
       }]
     });
     
     const content = response.content[0];
     if (content.type === 'text') {
       const extracted = content.text.trim();
       return extracted === 'GENERAL_FEEDBACK' ? undefined : extracted;
     }
   } catch (error) {
     console.error('[FeedbackLearning] AI suggestion extraction failed');
   }
   
   // Fallback to simple regex only if AI fails
   const suggestionPatterns = [
     /could just leave it at ['"]([^'"]+)['"]/i,
     /try this instead:?\s*["']?([^"']+)["']?/i,
     /better would be:?\s*["']?([^"']+)["']?/i,
     /should have said:?\s*["']?([^"']+)["']?/i,
     /more like:?\s*["']?([^"']+)["']?/i
   ];
   
   for (const pattern of suggestionPatterns) {
     const match = userFeedback.match(pattern);
     if (match) return match[1].trim();
   }
   
   return undefined;
 }

 private async classifyFeedback(feedback: string, context?: string): Promise<'positive' | 'negative' | 'suggestion'> {
   try {
     const claude = new (await import('@anthropic-ai/sdk')).default({ 
       apiKey: process.env.CLAUDE_API_KEY 
     });
     
     const response = await claude.messages.create({
       model: 'claude-3-haiku-20240307',
       max_tokens: 50,
       messages: [{
         role: 'user',
         content: `User feedback: "${feedback}"
${context ? `Context: ${context}` : ''}

Classify this feedback as one of:
- POSITIVE: User likes/approves of the response
- NEGATIVE: User dislikes/disapproves of the response  
- SUGGESTION: User is offering specific improvement/correction

Answer only: POSITIVE, NEGATIVE, or SUGGESTION`
       }]
     });
     
     const content = response.content[0];
     if (content.type === 'text') {
       const classification = content.text.trim().toUpperCase();
       if (classification.includes('POSITIVE')) return 'positive';
       if (classification.includes('SUGGESTION')) return 'suggestion';
       return 'negative';
     }
   } catch (error) {
     console.error('[FeedbackLearning] AI classification failed, using fallback');
   }
   
   // Simple fallback if AI fails
   const positive = /good|great|perfect|nice|love|excellent/i.test(feedback);
   const negative = /DO NOT|don't|bad|wrong|terrible/i.test(feedback);
   const suggestion = /try|instead|better|should|more like|could just/i.test(feedback);
   
   if (negative) return 'negative';
   if (suggestion) return 'suggestion';
   if (positive) return 'positive';
   return 'negative';
 }

 private classifyCategory(input: string, response: string): 'work' | 'casual' | 'wit' | 'personality' {
   const workKeywords = /build|deploy|create|fix|component|api|system/i;
   const witKeywords = /humor|wit|funny|joke|sarcasm|smirk/i;
   const personalityKeywords = /personality|charm|tone|voice|style|smirk|nominal/i;
   
   if (workKeywords.test(input + response)) return 'work';
   if (witKeywords.test(input + response)) return 'wit';
   if (personalityKeywords.test(input + response)) return 'personality';
   return 'casual';
 }

 private async loadFeedback(): Promise<void> {
   try {
     const data = await fs.readFile(this.feedbackFile, 'utf8');
     this.examples = JSON.parse(data);
   } catch (error) {
     this.examples = [];
   }
 }

 private async saveFeedback(): Promise<void> {
   try {
     await fs.mkdir(path.dirname(this.feedbackFile), { recursive: true });
     await fs.writeFile(this.feedbackFile, JSON.stringify(this.examples, null, 2));
   } catch (error) {
     console.error('[FeedbackLearning] Failed to save feedback:', error);
   }
 }
}
