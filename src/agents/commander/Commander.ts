import { Message } from 'discord.js';
import { UniversalRouter } from './core/UniversalRouter.js';
import { DiscordInterface } from './communication/DiscordInterface.js';
import { CommanderConfig } from './types/index.js';
import * as dotenv from 'dotenv';

dotenv.config();

export class Commander {
  private universalRouter: UniversalRouter;
  private discordInterface: DiscordInterface;
  private config: CommanderConfig;

  constructor() {
    this.config = this.loadConfig();
    this.universalRouter = new UniversalRouter(this.config);
    this.discordInterface = new DiscordInterface(this.config);
    
    this.setupMessageHandling();
  }

  private loadConfig(): CommanderConfig {
    const requiredEnvVars = [
      'DISCORD_TOKEN',
      'CLAUDE_API_KEY',
      'GITHUB_TOKEN',
      'GITHUB_REPO_OWNER',
      'GITHUB_REPO_NAME'
    ];

    const missing = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    return {
      discordToken: process.env.DISCORD_TOKEN!,
      userChannelId: process.env.DISCORD_CHANNEL_ID!, // Your existing channel
      agentChannelId: process.env.AGENT_CHANNEL_ID || '1393086808866426930', // Agent coordination
      claudeApiKey: process.env.CLAUDE_API_KEY!,
      githubToken: process.env.GITHUB_TOKEN!,
      githubOwner: process.env.GITHUB_REPO_OWNER!,
      githubRepo: process.env.GITHUB_REPO_NAME!,
      netlifyTokens: process.env.NETLIFY_SITE_ID
    };
  }

  private setupMessageHandling(): void {
    // Set up Discord message handling
    this.discordInterface.client?.on('messageCreate', async (message: Message) => {
      // Ignore bot messages
      if (message.author.bot) return;
      
      // Only respond to messages in the user channel
      if (message.channel.id !== this.config.userChannelId) return;
      
      // Handle the message
      await this.handleUserMessage(message);
    });
  }

  private async handleUserMessage(message: Message): Promise<void> {
    try {
      console.log(`[Commander] Processing message from ${message.author.tag}: "${message.content}"`);
      
      // Show typing indicator
      await message.channel.sendTyping();
      
      // Route the message through the universal router
      const response = await this.universalRouter.routeUniversalInput(
        message.content,
        message.author.id,
        message.id
      );
      
      // Send response
      await message.reply(response);
      
    } catch (error) {
      console.error('[Commander] Error handling user message:', error);
      
      // Send error response
      try {
        await message.reply('× System error processing request. Please try again or rephrase.');
      } catch (replyError) {
        console.error('[Commander] Failed to send error response:', replyError);
      }
    }
  }

  // Voice message handling (when VMT integration is ready)
  private async handleVoiceMessage(message: Message): Promise<void> {
    // TODO: Handle voice messages when VMT integration is complete
    // VMT should transcribe voice → text, then we process as normal
    console.log('[Commander] Voice message handling TODO - waiting for VMT integration');
  }

  // File upload handling (for future image-to-code service)
  private async handleFileUpload(message: Message): Promise<void> {
    // TODO: Handle file uploads (images, mockups, etc.)
    // This will integrate with your planned image-to-code service
    console.log('[Commander] File upload handling TODO - waiting for image-to-code service');
  }

  // Public methods
  async start(): Promise<void> {
    console.log('[Commander] Starting up...');
    
    // Start Discord interface
    await this.discordInterface.start();
    
    // Wait for Discord to be ready
    await this.waitForDiscordReady();
    
    // Set up VMT integration (if available)
    await this.discordInterface.setupVMTIntegration();
    
    console.log('[Commander] 🚀 Commander is online and ready!');
    console.log(`[Commander] User Channel: ${this.config.userChannelId}`);
    console.log(`[Commander] Agent Channel: ${this.config.agentChannelId}`);
  }

  async stop(): Promise<void> {
    console.log('[Commander] Shutting down...');
    await this.discordInterface.stop();
    console.log('[Commander] Shutdown complete.');
  }

  private async waitForDiscordReady(): Promise<void> {
    return new Promise((resolve) => {
      if (this.discordInterface.isReady) {
        resolve();
        return;
      }
      
      const checkReady = () => {
        if (this.discordInterface.isReady) {
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };
      
      checkReady();
    });
  }

  // Health check methods
  getStatus(): { ready: boolean; userChannel: boolean; agentChannel: boolean } {
    return {
      ready: this.discordInterface.isReady,
      userChannel: this.discordInterface.userChannelReady,
      agentChannel: this.discordInterface.agentChannelReady
    };
  }
}

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the commander if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const commander = new Commander();
  commander.start().catch(console.error);
}