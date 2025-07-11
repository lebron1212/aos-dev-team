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
 private feedbackFile = 'data/commander-feedback.json';
 private examples: FeedbackExample[] = [];
 
 constructor() {
   this.loadFeedback();
 }

 async logFeedback(
   userInput: string,
   commanderResponse: string,
   userFeedback: string,
   context: string,
   suggestedImprovement?: string
 ): Promise<void> {
   
   const feedback: FeedbackExample = {
     id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
     timestamp: new Date(),
     context,
     userInput,
     commanderResponse,
     userFeedback,
     suggestedImprovement,
     feedbackType: this.classifyFeedback(userFeedback),
     category: this.classifyCategory(userInput, commanderResponse)
   };

   this.examples.push(feedback);
   await this.saveFeedback();
   
   console.log(`[FeedbackLearning] Logged feedback: ${feedback.feedbackType} - ${feedback.category}`);
 }

 generateLearningExamples(): string {
   const recentExamples = this.examples
     .filter(ex => ex.feedbackType === 'positive' || ex.suggestedImprovement)
     .slice(-15);
   
   if (recentExamples.length === 0) return '';
   
   const exampleStr = recentExamples.map(ex => {
     if (ex.suggestedImprovement) {
       return `User: "${ex.userInput}"\nBetter: "${ex.suggestedImprovement}"`;
     } else {
       return `User: "${ex.userInput}"\nGood: "${ex.commanderResponse}"`;
     }
   }).join('\n\n');
   
   return `\nLEARNED EXAMPLES:\n${exampleStr}`;
 }

 detectFeedback(userMessage: string, lastResponse: string): boolean {
   const feedbackPatterns = [
     /that was (bad|terrible|wrong|perfect|great|good)/i,
     /try this instead/i,
     /better would be/i,
     /should have said/i,
     /more like/i,
     /you lost \d+%/i,
     /took it back/i,
     /dial it back/i,
     /too much/i,
     /not enough/i
   ];
   
   return feedbackPatterns.some(pattern => pattern.test(userMessage));
 }

 extractSuggestion(userFeedback: string): string | undefined {
   const suggestionPatterns = [
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

 private classifyFeedback(feedback: string): 'positive' | 'negative' | 'suggestion' {
   const positive = /good|great|perfect|nice|love|excellent/i.test(feedback);
   const suggestion = /try|instead|better|should|more like/i.test(feedback);
   
   if (suggestion) return 'suggestion';
   if (positive) return 'positive';
   return 'negative';
 }

 private classifyCategory(input: string, response: string): 'work' | 'casual' | 'wit' | 'personality' {
   const workKeywords = /build|deploy|create|fix|component|api|system/i;
   const witKeywords = /humor|wit|funny|joke|sarcasm/i;
   const personalityKeywords = /personality|charm|tone|voice|style/i;
   
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
