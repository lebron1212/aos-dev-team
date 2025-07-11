const fs = require('fs');
let content = fs.readFileSync('src/agents/commander/communication/DiscordInterface.ts', 'utf8');

// Remove the orphaned method at the end
content = content.replace(/\n  setupFeedbackReactions\(\): void \{[\s\S]*?\n  \}$/, '');

// Add it properly inside the class before the closing brace
content = content.replace(
  /  get agentChannelReady\(\): boolean \{\n    return !!this\.agentChannel;\n  \}\n\}/,
  `  get agentChannelReady(): boolean {
    return !!this.agentChannel;
  }

  setupFeedbackReactions(): void {
    this.client.on('messageReactionAdd', async (reaction, user) => {
      if (user.bot) return;
      if (reaction.message.author?.id !== this.client.user?.id) return;
      
      const emoji = reaction.emoji.name;
      let feedbackType = null;
      
      if (['👍', '✅', '💯'].includes(emoji)) feedbackType = 'positive';
      if (['👎', '❌'].includes(emoji)) feedbackType = 'negative'; 
      if (['🔄', '⚡'].includes(emoji)) feedbackType = 'suggestion';
      
      if (feedbackType) {
        console.log(\`[Discord] Feedback: \${emoji} (\${feedbackType})\`);
      }
    });
  }
}`
);

fs.writeFileSync('src/agents/commander/communication/DiscordInterface.ts', content);
