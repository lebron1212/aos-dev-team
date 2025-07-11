const fs = require('fs');
const content = fs.readFileSync('src/agents/commander/core/UniversalRouter.ts', 'utf8');

const updatedContent = content
 .replace(
   /import { UniversalIntent, WorkItem, CommanderConfig } from '\.\.\/types\/index\.js';/,
   `import { UniversalIntent, WorkItem, CommanderConfig } from '../types/index.js';
import { FeedbackLearningSystem } from '../intelligence/FeedbackLearningSystem.js';`
 )
 .replace(
   /private claude: Anthropic;/,
   `private claude: Anthropic;
 private feedbackSystem: FeedbackLearningSystem;
 private lastResponse: Map<string, string> = new Map();`
 )
 .replace(
   /this\.claude = new Anthropic\({ apiKey: config\.claudeApiKey }\);/,
   `this.claude = new Anthropic({ apiKey: config.claudeApiKey });
   this.feedbackSystem = new FeedbackLearningSystem();`
 )
 .replace(
   /try {[\s\S]*?const context = this\.getConversationContext\(userId\);/,
   `try {
     // Check if this is feedback about the last response
     const lastResp = this.lastResponse.get(userId);
     if (lastResp && this.feedbackSystem.detectFeedback(input, lastResp)) {
       return await this.handleFeedback(input, lastResp, userId);
     }

     // Step 1: Get conversation history for context (temporary fallback)
     const messageHistory: Array<{content: string, author: string, timestamp: Date}> = [];
     try {
       // @ts-ignore - will be available after next deploy
       if (this.discordInterface.getRecentMessages) {
         messageHistory = await this.discordInterface.getRecentMessages(5);
       }
     } catch (error) {
       console.log('[UniversalRouter] Message history not available yet');
     }
     
     // Step 2: Analyze intent with conversation context
     const context = this.getConversationContext(userId);`
 )
 .replace(
   /return `Not sure how to handle that request\. Could you rephrase it\?`;/,
   `const response = \`Not sure how to handle that request. Could you rephrase it?\`;
       this.lastResponse.set(userId, response);
       return response;`
 )
 .replace(
   /const conversationPrompt = `Recent conversation:/,
   `// Get learned examples from feedback
   const learningExamples = this.feedbackSystem.generateLearningExamples();
   
   const conversationPrompt = \`Recent conversation:`
 )
 .replace(
   /Respond appropriately to the conversation context and user's message\.`;/,
   `Respond appropriately to the conversation context and user's message.

\${learningExamples}\`;`
 )
 .replace(
   /return VoiceSystem\.enhanceCTOVoice\(content\.text\);/,
   `const response = VoiceSystem.enhanceCTOVoice(content.text);
       this.lastResponse.set(userId, response);
       return response;`
 )
 .replace(
   /return `Ready to build\. What's the vision\?`;/,
   `const response = \`Ready to build. What's the vision?\`;
   this.lastResponse.set(userId, response);
   return response;`
 ) + `

 private async handleFeedback(
   feedback: string, 
   lastResponse: string, 
   userId: string
 ): Promise<string> {
   
   // Extract suggested improvement if provided
   const suggestion = this.feedbackSystem.extractSuggestion(feedback);
   
   // Log the feedback
   await this.feedbackSystem.logFeedback(
     'Previous interaction',
     lastResponse,
     feedback,
     'User feedback on response',
     suggestion
   );
   
   // Acknowledge feedback
   if (suggestion) {
     const response = \`Understood. I'll remember that approach.\`;
     this.lastResponse.set(userId, response);
     return response;
   } else {
     const response = \`Noted. Adjusting response style.\`;
     this.lastResponse.set(userId, response);
     return response;
   }
 }`;

fs.writeFileSync('src/agents/commander/core/UniversalRouter.ts', updatedContent);
