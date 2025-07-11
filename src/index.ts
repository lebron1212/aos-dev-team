import { Commander } from './agents/commander/Commander.js';
import { Architect } from './agents/architect/Architect.js';

console.log('🚀 Starting AI Development Team...');

async function startCommander() {
  const commanderConfig = {
    discordToken: process.env.DISCORD_TOKEN!,
    userChannelId: process.env.USER_CHANNEL_ID!,
    agentChannelId: process.env.AGENT_CHANNEL_ID!,
    claudeApiKey: process.env.CLAUDE_API_KEY!
  };

  const commander = new Commander(commanderConfig);
  await commander.start();
}

async function startArchitect() {
  const architectConfig = {
    architectToken: process.env.ARCHITECT_DISCORD_TOKEN!,
    architectChannelId: process.env.ARCHITECT_CHANNEL_ID!,
    claudeApiKey: process.env.CLAUDE_API_KEY!
  };

  if (architectConfig.architectToken && architectConfig.architectChannelId) {
    const architect = new Architect(architectConfig);
    await architect.start();
  } else {
    console.log('[Architect] Environment variables not set, skipping architect startup');
  }
}

// Start both systems
Promise.all([
  startCommander(),
  startArchitect()
]).catch(console.error);
