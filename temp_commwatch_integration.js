const fs = require('fs');
let content = fs.readFileSync('src/agents/commander/core/UniversalRouter.ts', 'utf8');

content = content
 .replace(/import { FeedbackLearningSystem } from '\.\.\/intelligence\/FeedbackLearningSystem\.js';/, 
   `import { FeedbackLearningSystem } from '../intelligence/FeedbackLearningSystem.js';
import { CommanderWatcher } from '../intelligence/CommanderWatcher.js';`)
 .replace(/private feedbackSystem: FeedbackLearningSystem;/, 
   `private feedbackSystem: FeedbackLearningSystem;
 private commWatch: CommanderWatcher;`)
 .replace(/this\.feedbackSystem = new FeedbackLearningSystem\(\);/, 
   `this.feedbackSystem = new FeedbackLearningSystem();
   this.commWatch = new CommanderWatcher();`)
 .replace(/this\.lastResponse\.set\(userId, response\);[\s\S]*?return response;/g, 
   `this.lastResponse.set(userId, response);
       // Track message for feedback and training
       if (messageId) {
         await this.discordInterface.trackMessage(input, response, messageId);
         const startTime = Date.now();
         await this.commWatch.logCommInteraction(
           messageHistory.map(m => \`\${m.author}: \${m.content}\`),
           input,
           response,
           Date.now() - startTime,
           input.length / 4, // Rough token estimate
           response.length / 4
         );
       }
       return response;`);

fs.writeFileSync('src/agents/commander/core/UniversalRouter.ts', content);
