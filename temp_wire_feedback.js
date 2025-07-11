const fs = require('fs');

// Update DiscordInterface to include FeedbackLearningSystem
let discordContent = fs.readFileSync('src/agents/commander/communication/DiscordInterface.ts', 'utf8');

discordContent = discordContent
 .replace(
   /import { WorkItem, AgentMessage, DiscordEmbed, CommanderConfig } from '\.\.\/types\/index\.js';/,
   `import { WorkItem, AgentMessage, DiscordEmbed, CommanderConfig } from '../types/index.js';
import { FeedbackLearningSystem } from '../intelligence/FeedbackLearningSystem.js';`
 )
 .replace(
   /private config: CommanderConfig;/,
   `private config: CommanderConfig;
 private feedbackSystem: FeedbackLearningSystem;
 private messageContext: Map<string, {input: string, response: string}> = new Map();`
 )
 .replace(
   /this\.setupEventHandlers\(\);/,
   `this.setupEventHandlers();
   this.feedbackSystem = new FeedbackLearningSystem();`
 )
 .replace(
   /console\.log\(`\[Discord\] Feedback: \${emoji} \(\${feedbackType\}\)`\);/,
   `await this.handleFeedbackReaction(reaction.message.id, feedbackType, user.id);`
 );

// Add feedback handler method
discordContent += `

 async handleFeedbackReaction(messageId: string, feedbackType: string, userId: string): Promise<void> {
   const context = this.messageContext.get(messageId);
   if (!context) return;
   
   await this.feedbackSystem.logFeedback(
     context.input,
     context.response,
     feedbackType,
     'Discord reaction feedback'
   );
   
   console.log(\`[DiscordInterface] Logged \${feedbackType} feedback for message \${messageId}\`);
 }

 async trackMessage(input: string, response: string, messageId: string): Promise<void> {
   this.messageContext.set(messageId, { input, response });
 }`;

fs.writeFileSync('src/agents/commander/communication/DiscordInterface.ts', discordContent);

// Update UniversalRouter to track messages
let routerContent = fs.readFileSync('src/agents/commander/core/UniversalRouter.ts', 'utf8');

routerContent = routerContent
 .replace(
   /this\.lastResponse\.set\(userId, response\);\s*return response;/g,
   `this.lastResponse.set(userId, response);
       // Track message for feedback
       if (messageId) {
         await this.discordInterface.trackMessage(input, response, messageId);
       }
       return response;`
 );

fs.writeFileSync('src/agents/commander/core/UniversalRouter.ts', routerContent);
