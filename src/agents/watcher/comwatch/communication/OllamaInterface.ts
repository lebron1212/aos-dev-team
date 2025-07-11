export class OllamaInterface {
 private baseUrl = 'http://localhost:11434';

 async testConnection(): Promise<boolean> {
   try {
     const response = await fetch(`${this.baseUrl}/api/tags`);
     return response.ok;
   } catch {
     return false;
   }
 }

 async generateResponse(prompt: string, model: string = 'llama3.1'): Promise<string> {
   try {
     const response = await fetch(`${this.baseUrl}/api/generate`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ model, prompt, stream: false })
     });
     const data = await response.json();
     return data.response || '';
   } catch (error) {
     console.error('[ComWatch] Ollama generation failed:', error);
     return '';
   }
 }
}
