import fs from 'fs/promises';

export class TrainingCollector {
 private dataFile = 'data/comwatch-training.jsonl';
 private examples: any[] = [];

 async logInteraction(input: string, response: string, context: string[], feedback?: string): Promise<void> {
   const example = {
     timeOfDay: new Date().getHours(),
     dayOfWeek: new Date().getDay(),
     timestamp: new Date().toISOString(),
     input,
     response,
     context: context.slice(-3),
      feedback,
      isGood: !feedback || feedback === 'positive',
     tokens: input.length + response.length
   };
   
   await this.appendToFile(example);
   console.log(`[ComWatch] Logged interaction: ${example.tokens} chars`);
 }

 async getStats(): Promise<any> {
   try {
     const data = await fs.readFile(this.dataFile, 'utf8');
     const lines = data.trim().split('\n').length;
     return { totalExamples: lines, readyForTraining: lines >= 100 };
   } catch {
     return { totalExamples: 0, readyForTraining: false };
   }
 }

 private async appendToFile(example: any): Promise<void> {
   try {
     await fs.mkdir('data', { recursive: true });
     await fs.appendFile(this.dataFile, JSON.stringify(example) + '\n');
   } catch (error) {
     console.error('[ComWatch] Failed to save training data:', error);
   }
 }
}
