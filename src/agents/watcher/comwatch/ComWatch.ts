import { OllamaInterface } from './communication/OllamaInterface.js';
import { TrainingCollector } from './intelligence/TrainingCollector.js';
import { ModelTrainer } from './core/ModelTrainer.js';
import fs from 'fs/promises';

export class ComWatch {
 private collector: TrainingCollector;
 private trainer: ModelTrainer;
 private ollama: OllamaInterface;
 private interactionsFile = 'data/interactions.json';
 private interactions: any[] = [];

 constructor() {
   this.collector = new TrainingCollector();
   this.trainer = new ModelTrainer();
   this.ollama = new OllamaInterface();
   this.loadInteractions();
   console.log('[ComWatch] Silent learning system initialized');
 }

 async logCommanderInteraction(input: string, response: string, context: string[], feedback?: string): Promise<void> {
   const interaction = {
     timestamp: new Date().toISOString(),
     input,
     response,
     context: context.slice(-3),
     feedback,
     chars: input.length + response.length,
     isGood: !feedback || !feedback.includes('DO NOT') && !feedback.includes('don\'t')
   };
   
   this.interactions.push(interaction);
   await this.saveInteractions();
   await this.collector.logInteraction(input, response, context, feedback);
   
   console.log(`[ComWatch] Logged interaction: ${interaction.chars} chars`);
 }

 async getTrainingStats(): Promise<any> {
   const stats = await this.collector.getStats();
   return {
     ...stats,
     totalInteractions: this.interactions.length,
     persistedToDisk: true
   };
 }

 async exportTrainingData(): Promise<any[]> {
   return this.interactions.map(i => ({
     input: i.input,
     output: i.response,
     feedback: i.feedback,
     quality: i.isGood ? 'good' : 'needs_improvement',
     timestamp: i.timestamp
   }));
 }

 private async loadInteractions(): Promise<void> {
   try {
     const data = await fs.readFile(this.interactionsFile, 'utf8');
     this.interactions = JSON.parse(data);
   } catch (error) {
     this.interactions = [];
   }
 }

 private async saveInteractions(): Promise<void> {
   try {
     await fs.writeFile(this.interactionsFile, JSON.stringify(this.interactions, null, 2));
   } catch (error) {
     console.error('[ComWatch] Failed to save interactions:', error);
   }
 }
}
