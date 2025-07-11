interface CommTrainingExample {
 id: string;
 timestamp: Date;
 conversationContext: string[];
 userInput: string;
 commanderResponse: string;
 responseTime: number;
 userReaction?: 'positive' | 'negative' | 'neutral';
 category: 'work' | 'casual' | 'wit' | 'personality';
 tokens: { input: number; output: number; cost: number; };
}

export class CommanderWatcher {
 private trainingFile = 'data/commwatch-training.json';
 private examples: CommTrainingExample[] = [];
 private costTracker = { totalTokens: 0, totalCost: 0 };

 constructor() { this.loadExamples(); }

 async logCommInteraction(context: string[], input: string, response: string, responseTime: number, inputTokens: number, outputTokens: number): Promise<void> {
   const cost = this.calculateCost(inputTokens, outputTokens);
   const example: CommTrainingExample = {
     id: `comm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
     timestamp: new Date(),
     conversationContext: context.slice(-5),
     userInput: input,
     commanderResponse: response,
     responseTime,
     category: this.classifyInteraction(input, response),
     tokens: { input: inputTokens, output: outputTokens, cost }
   };
   this.examples.push(example);
   this.updateCostTracker(cost, inputTokens + outputTokens);
   await this.saveExamples();
   console.log(`[CommanderWatcher] Logged: ${example.category} (${inputTokens + outputTokens} tokens, $${cost.toFixed(4)})`);
 }

 async addCommReaction(messageId: string, reaction: 'positive' | 'negative'): Promise<void> {
   const example = this.examples.find(ex => ex.id.includes(messageId.slice(-8)));
   if (example) {
     example.userReaction = reaction;
     await this.saveExamples();
   }
 }

 exportCommTraining() {
   const qualityExamples = this.examples.filter(ex => ex.userReaction === 'positive' || (ex.userReaction === undefined && ex.responseTime < 3000));
   return {
     examples: qualityExamples.map(ex => ({
       messages: [
         { role: 'system', content: 'You are a confident Silicon Valley CTO with TARS-level wit.' },
         { role: 'user', content: `Context: ${ex.conversationContext.join(' ')}\n\nUser: ${ex.userInput}` },
         { role: 'assistant', content: ex.commanderResponse }
       ]
     })),
     stats: { totalExamples: this.examples.length, qualityExamples: qualityExamples.length, readyForTraining: qualityExamples.length >= 100 },
     readyForTraining: qualityExamples.length >= 100
   };
 }

 getCommStats() {
   return { totalCost: this.costTracker.totalCost, totalTokens: this.costTracker.totalTokens, examples: this.examples.length };
 }

 private classifyInteraction(input: string, response: string): 'work' | 'casual' | 'wit' | 'personality' {
   if (/build|deploy|create|fix|component|api|system/i.test(input + response)) return 'work';
   if (/humor|wit|funny|joke|sarcasm/i.test(input + response)) return 'wit';
   if (/personality|charm|tone|voice|style/i.test(input + response)) return 'personality';
   return 'casual';
 }

 private calculateCost(inputTokens: number, outputTokens: number): number {
   return (inputTokens / 1000000) * 15 + (outputTokens / 1000000) * 75;
 }

 private updateCostTracker(cost: number, tokens: number): void {
   this.costTracker.totalCost += cost;
   this.costTracker.totalTokens += tokens;
 }

 private async loadExamples(): Promise<void> {
   try {
     const fs = await import('fs/promises');
     const data = await fs.readFile(this.trainingFile, 'utf8');
     this.examples = JSON.parse(data);
     this.costTracker = this.examples.reduce((tracker, ex) => {
       tracker.totalCost += ex.tokens.cost;
       tracker.totalTokens += ex.tokens.input + ex.tokens.output;
       return tracker;
     }, { totalCost: 0, totalTokens: 0 });
   } catch (error) {
     console.log('[CommanderWatcher] Starting fresh training data');
   }
 }

 private async saveExamples(): Promise<void> {
   try {
     const fs = await import('fs/promises');
     const path = await import('path');
     await fs.mkdir(path.dirname(this.trainingFile), { recursive: true });
     await fs.writeFile(this.trainingFile, JSON.stringify(this.examples, null, 2));
   } catch (error) {
     console.error('[CommanderWatcher] Save failed:', error);
   }
 }
}
