// src/agents/architect/operations/DiscordBotCreator.ts
import { execSync } from 'child_process';

interface DiscordBotConfig {
  name: string;
  description: string;
  permissions: string[];
  token: string;
  clientId: string;
  channelId?: string;
  inviteUrl: string;
  useExistingBot: boolean;
}

export class DiscordBotCreator {
  private discordToken: string;
  private guildId: string;

  constructor(discordToken: string, guildId?: string) {
    this.discordToken = discordToken;
    this.guildId = guildId || this.extractGuildId();
  }

  async createDiscordBot(agentName: string, purpose: string): Promise<DiscordBotConfig | null> {
    console.log(`[DiscordBotCreator] Setting up Discord integration for ${agentName}`);
    
    try {
      // Use existing bot infrastructure instead of creating new applications
      const channelId = await this.createChannelForAgent(this.guildId, agentName);
      
      if (!channelId) {
        console.warn(`[DiscordBotCreator] Could not create channel for ${agentName}, using existing token`);
      }

      // Set Railway environment variables for the new agent
      await this.setRailwayEnvironmentVars(agentName, this.discordToken, channelId);

      // Use existing bot token and provide setup info
      const config: DiscordBotConfig = {
        name: agentName,
        description: purpose,
        permissions: this.calculatePermissions(purpose),
        token: this.discordToken, // Use existing bot token
        clientId: await this.getExistingClientId(), // Extract from existing token
        channelId: channelId || undefined,
        inviteUrl: '', // Bot already invited
        useExistingBot: true
      };

      console.log(`[DiscordBotCreator] ✅ Discord integration ready for ${agentName}`);
      return config;

    } catch (error) {
      console.error(`[DiscordBotCreator] Failed to set up Discord for ${agentName}:`, error);
      
      // Fallback: Still provide basic config for manual setup
      return {
        name: agentName,
        description: purpose,
        permissions: this.calculatePermissions(purpose),
        token: this.discordToken,
        clientId: await this.getExistingClientId(),
        inviteUrl: '',
        useExistingBot: true
      };
    }
  }

  async createChannelForAgent(guildId: string, agentName: string): Promise<string | null> {
    const channelName = agentName.toLowerCase();
    
    try {
      // Check if channel already exists
      const existingChannel = await this.findExistingChannel(guildId, channelName);
      if (existingChannel) {
        console.log(`[DiscordBotCreator] Using existing #${channelName} channel: ${existingChannel.id}`);
        return existingChannel.id;
      }

      // Create new channel
      const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${this.discordToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: channelName,
          type: 0, // Text channel
          topic: `${agentName} AI Agent - ${this.getChannelDescription(agentName)}`,
          permission_overwrites: []
        })
      });

      if (response.ok) {
        const channel = await response.json();
        console.log(`[DiscordBotCreator] ✅ Created #${channelName} channel: ${channel.id}`);
        return channel.id;
      } else {
        const error = await response.text();
        console.error(`[DiscordBotCreator] Failed to create channel: ${error}`);
        return null;
      }

    } catch (error) {
      console.error(`[DiscordBotCreator] Channel creation error:`, error);
      return null;
    }
  }

  private async findExistingChannel(guildId: string, channelName: string): Promise<any> {
    try {
      const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
        headers: {
          'Authorization': `Bot ${this.discordToken}`
        }
      });

      if (response.ok) {
        const channels = await response.json();
        return channels.find((c: any) => c.name === channelName && c.type === 0);
      }
    } catch (error) {
      console.error('[DiscordBotCreator] Error finding existing channel:', error);
    }
    return null;
  }

  private async setRailwayEnvironmentVars(agentName: string, botToken: string, channelId?: string): Promise<void> {
    const envVars = [
      { key: `${agentName.toUpperCase()}_DISCORD_TOKEN`, value: botToken },
      { key: `${agentName.toUpperCase()}_CHANNEL_ID`, value: channelId || '' },
      { key: `${agentName.toUpperCase()}_ENABLED`, value: 'true' }
    ];

    console.log(`[DiscordBotCreator] Setting Railway environment variables for ${agentName}...`);

    for (const { key, value } of envVars) {
      try {
        if (value) { // Only set non-empty values
          execSync(`railway variables --set ${key}="${value}"`, { stdio: 'pipe' });
          console.log(`[DiscordBotCreator] ✅ Set ${key}`);
        }
      } catch (error) {
        console.warn(`[DiscordBotCreator] ⚠️  Railway CLI not available for ${key}, manual setup required`);
        console.log(`[DiscordBotCreator] Manual: Add ${key}=${value} to Railway environment`);
      }
    }

    // Trigger Railway redeploy to apply new environment variables
    try {
      console.log(`[DiscordBotCreator] 🚀 Triggering Railway redeploy...`);
      execSync('railway redeploy', { stdio: 'pipe' });
      console.log(`[DiscordBotCreator] ✅ Railway redeploy triggered`);
    } catch (error) {
      console.warn(`[DiscordBotCreator] ⚠️  Railway redeploy failed, manual redeploy required`);
    }
  }

  private calculatePermissions(purpose: string): string[] {
    const basePermissions = ['Send Messages', 'Read Message History', 'Use Slash Commands'];
    
    if (purpose.toLowerCase().includes('ping')) {
      basePermissions.push('Add Reactions');
    }
    
    if (purpose.toLowerCase().includes('monitor')) {
      basePermissions.push('View Channels', 'Read Messages');
    }
    
    if (purpose.toLowerCase().includes('manage')) {
      basePermissions.push('Manage Messages', 'Create Threads');
    }
    
    return basePermissions;
  }

  private getChannelDescription(agentName: string): string {
    const descriptions: Record<string, string> = {
      'TestBot': 'Simple ping-pong responses and testing',
      'Dashboard': 'System metrics and performance monitoring',
      'Monitor': 'System monitoring and alerts',
      'Deploy': 'Deployment management and automation'
    };
    
    return descriptions[agentName] || `${agentName} agent operations`;
  }

  private async getExistingClientId(): Promise<string> {
    try {
      // Get current application info from Discord API
      const response = await fetch('https://discord.com/api/v10/oauth2/applications/@me', {
        headers: {
          'Authorization': `Bot ${this.discordToken}`
        }
      });

      if (response.ok) {
        const app = await response.json();
        return app.id;
      }
    } catch (error) {
      console.error('[DiscordBotCreator] Could not get client ID:', error);
    }
    
    // Fallback: Extract from token or use placeholder
    return 'EXISTING_BOT_CLIENT_ID';
  }

  private extractGuildId(): string {
    // Try to get guild ID from environment variables
    return process.env.DISCORD_GUILD_ID || 
           process.env.DISCORD_CHANNEL_ID?.split('').slice(0, 18).join('') || // Extract from channel ID
           'DEFAULT_GUILD_ID';
  }
}
