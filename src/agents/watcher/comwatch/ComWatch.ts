import { OllamaInterface } from './communication/OllamaInterface.js';
import { TrainingCollector } from './intelligence/TrainingCollector.js';
import { ModelTrainer } from './core/ModelTrainer.js';

export class ComWatch {
 private collector: TrainingCollector;
 private trainer: ModelTrainer;
 private ollama: OllamaInterface;

 constructor() {
   this.collector = new TrainingCollector();
   this.trainer = new ModelTrainer();
   this.ollama = new OllamaInterface();
   console.log('[ComWatch] Silent learning system initialized');
 }

 async logCommanderInteraction(input: string, response: string, context: string[]): Promise<void> {
   await this.collector.logInteraction(input, response, context);
 }

 async getTrainingStats(): Promise<any> {
   return this.collector.getStats();
 }
}
