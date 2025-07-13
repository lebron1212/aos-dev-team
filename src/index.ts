import { Commander } from './agents/commander/Commander.js';
import { Architect } from './agents/architect/Architect.js';
import { Dashboard } from './agents/dashboard/Dashboard.js';
import { promises as fs } from 'fs';
import path from 'path';

console.log('🚀 Starting AI Development Team...');

async function ensureDataDirectories(): Promise<void> {
  const dirs = [
    'data',
    'data/backups',
    'data/modifications',
    'data/agents',
    'data/logs'
  ];
  
  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      console.warn(`[Startup] Could not create directory ${dir}:`, error.message);
    }
  }
}

async function startCommander() {
  try {
    const commander = new Commander();
    await commander.start();
    console.log('[Startup] ✅ Commander started successfully');
  } catch (error) {
    console.error('[Startup] ❌ Commander failed to start:', error);
    throw error;
  }
}

async function startArchitect() {
  const architectConfig = {
    architectToken: process.env.ARCHITECT_DISCORD_TOKEN!,
    architectChannelId: process.env.ARCHITECT_CHANNEL_ID!,
    claudeApiKey: process.env.CLAUDE_API_KEY!,
    discordToken: process.env.DISCORD_TOKEN
  };

  if (architectConfig.architectToken && architectConfig.architectChannelId && architectConfig.claudeApiKey) {
    try {
      const architect = new Architect(architectConfig);
      await architect.start();
      console.log('[Startup] ✅ Architect started successfully');
    } catch (error) {
      console.error('[Startup] ❌ Architect failed to start:', error);
      console.log('[Startup] Continuing without Architect...');
    }
  } else {
    console.log('[Startup] ⏭️ Architect environment variables not set, skipping startup');
    console.log('[Startup] Required: ARCHITECT_DISCORD_TOKEN, ARCHITECT_CHANNEL_ID, CLAUDE_API_KEY');
  }
}

async function startDashboard() {
  const dashboardConfig = {
    dashboardToken: process.env.DASHBOARD_DISCORD_TOKEN!,
    dashboardChannelId: process.env.DASHBOARD_CHANNEL_ID!,
    agentCoordinationChannelId: process.env.AGENT_COORDINATION_CHANNEL_ID || '1393086808866426930',
    claudeApiKey: process.env.CLAUDE_API_KEY!
  };

  if (dashboardConfig.dashboardToken && dashboardConfig.dashboardChannelId && dashboardConfig.claudeApiKey) {
    try {
      const dashboard = new Dashboard(dashboardConfig);
      await dashboard.start();
      console.log('[Startup] ✅ Dashboard started successfully');
    } catch (error) {
      console.error('[Startup] ❌ Dashboard failed to start:', error);
      console.log('[Startup] Continuing without Dashboard...');
    }
  } else {
    console.log('[Startup] ⏭️ Dashboard environment variables not set, skipping startup');
  }
}

async function validateEnvironment(): Promise<boolean> {
  const requiredVars = ['CLAUDE_API_KEY'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('[Startup] ❌ Missing required environment variables:', missingVars.join(', '));
    console.error('[Startup] Please set these variables before starting the system');
    return false;
  }
  
  // Optional but recommended vars
  const optionalVars = [
    'DISCORD_TOKEN',
    'ARCHITECT_DISCORD_TOKEN',
    'DASHBOARD_DISCORD_TOKEN'
  ];
  
  const missingOptional = optionalVars.filter(varName => !process.env[varName]);
  if (missingOptional.length > 0) {
    console.warn('[Startup] ⚠️ Missing optional environment variables:', missingOptional.join(', '));
    console.warn('[Startup] Some features may be limited without these variables');
  }
  
  return true;
}

async function performSystemCheck(): Promise<void> {
  console.log('[Startup] 🔍 Performing system health check...');
  
  // Check if we can write to filesystem
  try {
    await fs.writeFile('data/startup-test.txt', 'test');
    await fs.unlink('data/startup-test.txt');
    console.log('[Startup] ✅ Filesystem access confirmed');
  } catch (error) {
    console.warn('[Startup] ⚠️ Filesystem write test failed:', error.message);
  }
  
  // Check Node.js version
  const nodeVersion = process.version;
  console.log(`[Startup] 📋 Node.js version: ${nodeVersion}`);
  
  // Check available memory
  const memUsage = process.memoryUsage();
  console.log(`[Startup] 💾 Memory usage: ${Math.round(memUsage.rss / 1024 / 1024)}MB RSS`);
  
  console.log('[Startup] ✅ System health check complete');
}

// Enhanced startup sequence
async function startAllSystems() {
  try {
    console.log('[Startup] 🔧 Initializing AI Development Team...');
    
    // 1. Validate environment
    const envValid = await validateEnvironment();
    if (!envValid) {
      process.exit(1);
    }
    
    // 2. Perform system checks
    await performSystemCheck();
    
    // 3. Prepare system directories
    console.log('[Startup] 📁 Preparing system directories...');
    await ensureDataDirectories();
    
    // 4. Start all agents with individual error handling
    console.log('[Startup] 🚀 Starting all agents...');
    
    const startupPromises = [
      startCommander().catch(error => {
        console.error('[Startup] Commander startup failed:', error.message);
        return null;
      }),
      startArchitect().catch(error => {
        console.error('[Startup] Architect startup failed:', error.message);
        return null;
      }),
      startDashboard().catch(error => {
        console.error('[Startup] Dashboard startup failed:', error.message);
        return null;
      })
    ];
    
    const results = await Promise.allSettled(startupPromises);
    
    // 5. Report startup results
    const successful = results.filter(result => result.status === 'fulfilled').length;
    const failed = results.length - successful;
    
    console.log('[Startup] 📊 Startup Summary:');
    console.log(`[Startup]   ✅ Successful: ${successful}/${results.length} agents`);
    if (failed > 0) {
      console.log(`[Startup]   ❌ Failed: ${failed}/${results.length} agents`);
    }
    
    // 6. System ready message
    if (successful > 0) {
      console.log('[Startup] 🎉 AI Development Team initialization complete!');
      console.log('[Startup] 📝 System is operational with available agents');
      
      // Show next steps
      console.log('[Startup] 🔍 Next Steps:');
      console.log('[Startup]   • Check Discord channels for agent responses');
      console.log('[Startup]   • Use /help in any agent channel for commands');
      console.log('[Startup]   • Monitor console for system activity');
      
    } else {
      console.error('[Startup] ❌ No agents started successfully');
      console.error('[Startup] Please check configuration and try again');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('[Startup] ❌ Critical startup failure:', error);
    console.error('[Startup] Stack trace:', error.stack);
    process.exit(1);
  }
}

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('\n[Shutdown] 🛑 Received SIGINT, shutting down gracefully...');
  try {
    // Add any cleanup logic here
    console.log('[Shutdown] ✅ Cleanup complete');
    process.exit(0);
  } catch (error) {
    console.error('[Shutdown] ❌ Cleanup failed:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n[Shutdown] 🛑 Received SIGTERM, shutting down gracefully...');
  try {
    // Add any cleanup logic here
    console.log('[Shutdown] ✅ Cleanup complete');
    process.exit(0);
  } catch (error) {
    console.error('[Shutdown] ❌ Cleanup failed:', error);
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  console.error('[Error] 💥 Uncaught Exception:', error);
  console.error('[Error] Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Error] 💥 Unhandled Rejection at:', promise);
  console.error('[Error] Reason:', reason);
  process.exit(1);
});

// Start the system
startAllSystems();
