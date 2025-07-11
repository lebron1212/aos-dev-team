import { Commander } from './agents/commander/Commander.js';
import { Architect } from './agents/architect/Architect.js';
import { Dashboard } from './agents/dashboard/Dashboard.js';

console.log('🚀 Starting AI Development Team...');

async function startCommander() {
  const commander = new Commander();
  await commander.start();
}

async function startArchitect() {
  const architectConfig = {
    architectToken: process.env.ARCHITECT_DISCORD_TOKEN!,
    architectChannelId: process.env.ARCHITECT_CHANNEL_ID!,
    claudeApiKey: process.env.CLAUDE_API_KEY!,
    userToken: process.env.DISCORD_USER_TOKEN // Use Discord user token for creating applications
  };

  if (architectConfig.architectToken && architectConfig.architectChannelId) {
    const architect = new Architect(architectConfig);
    await architect.start();
  } else {
    console.log('[Architect] Environment variables not set, skipping architect startup');
  }
}

async function startDashboard() {
  const dashboardConfig = {
    dashboardToken: process.env.DASHBOARD_DISCORD_TOKEN!,
    dashboardChannelId: process.env.DASHBOARD_CHANNEL_ID!,
    agentCoordinationChannelId: process.env.AGENT_COORDINATION_CHANNEL_ID || '1393086808866426930',
    claudeApiKey: process.env.CLAUDE_API_KEY!
  };

  if (dashboardConfig.dashboardToken && dashboardConfig.dashboardChannelId) {
    const dashboard = new Dashboard(dashboardConfig);
    await dashboard.start();
  } else {
    console.log('[Dashboard] Environment variables not set, skipping dashboard startup');
  }
}

// Start all systems
Promise.all([
  startCommander(),
  startArchitect(),
  startDashboard()
]).catch(console.error);
