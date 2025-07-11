import Anthropic from '@anthropic-ai/sdk';
import { execSync } from 'child_process';

interface DiscordBotConfig {
  name: string;
  description: string;
  permissions: string[];
  token: string;
  clientId: string;
  inviteUrl: string;
}

export class DiscordBotCreator {
  private claude: Anthropic;
  private userToken: string; // User token for creating applications

  constructor(claudeApiKey: string, userToken: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
    this.userToken = userToken;
  }

  async createDiscordBot(agentName: string, purpose: string): Promise<DiscordBotConfig | null> {
    console.log(`[DiscordBotCreator] Creating Discord bot for ${agentName}`);
    
    try {
      // Create Discord application via API
      const appData = await this.createDiscordApplication(agentName, purpose);
      
      if (appData) {
        // Create bot user
        const botData = await this.createBotUser(appData.id);
        
        if (botData) {
          // Generate invite URL
          const inviteUrl = this.generateInviteUrl(appData.id, this.calculatePermissions(purpose));
          
          const config: DiscordBotConfig = {
            name: agentName,
            description: purpose,
            permissions: this.calculatePermissions(purpose),
            token: botData.token,
            clientId: appData.id,
            inviteUrl
          };
          
          // Automatically set Railway environment variables
          await this.setRailwayEnvironmentVars(agentName, config);
          
          console.log(`[DiscordBotCreator] Created Discord bot: ${agentName}`);
          return config;
        }
      }
    } catch (error) {
      console.error(`[DiscordBotCreator] Failed to create Discord bot:`, error);
    }
    
    return null;
  }

  private async createDiscordApplication(name: string, description: string): Promise<any> {
    try {
      const response = await fetch('https://discord.com/api/v10/applications', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `${name} Agent`,
          description: `AI Agent: ${description}`
        })
      });
      
      if (response.ok) {
        const data = await response.json() as { id: string };
        console.log(`[DiscordBotCreator] Created Discord application: ${data.id}`);
        return data;
      } else {
        console.error('[DiscordBotCreator] Failed to create Discord application:', await response.text());
      }
    } catch (error) {
      console.error('[DiscordBotCreator] Discord API error:', error);
    }
    
    return null;
  }

  private async createBotUser(applicationId: string): Promise<any> {
    try {
      const response = await fetch(`https://discord.com/api/v10/applications/${applicationId}/bot`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.userToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`[DiscordBotCreator] Created bot user for application ${applicationId}`);
        return data;
      } else {
        console.error('[DiscordBotCreator] Failed to create bot user:', await response.text());
      }
    } catch (error) {
      console.error('[DiscordBotCreator] Bot creation error:', error);
    }
    
    return null;
  }

  private calculatePermissions(purpose: string): string[] {
    const basePermissions = ['Send Messages', 'Read Message History', 'Use Slash Commands'];
    
    // Add specific permissions based on agent purpose
    if (purpose.toLowerCase().includes('monitor')) {
      basePermissions.push('View Channels', 'Read Messages');
    }
    
    if (purpose.toLowerCase().includes('manage') || purpose.toLowerCase().includes('deploy')) {
      basePermissions.push('Manage Messages', 'Create Threads');
    }
    
    return basePermissions;
  }

  private generateInviteUrl(clientId: string, permissions: string[]): string {
    // Calculate permission integer (simplified - would need full permission mapping)
    const permissionInt = '8'; // Basic bot permissions
    
    return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissionInt}&scope=bot`;
  }

  private async setRailwayEnvironmentVars(agentName: string, config: DiscordBotConfig): Promise<void> {
    try {
      const tokenVar = `${agentName.toUpperCase()}_DISCORD_TOKEN`;
      const clientVar = `${agentName.toUpperCase()}_CLIENT_ID`;
      
      // Set Railway environment variables automatically
      try {
        execSync(`railway variables --set ${tokenVar}=${config.token}`, { stdio: 'pipe' });
        execSync(`railway variables --set ${clientVar}=${config.clientId}`, { stdio: 'pipe' });
        
        console.log(`[DiscordBotCreator] Set Railway environment variables for ${agentName}`);
        
        // Trigger Railway redeploy to pick up new variables
        execSync('railway redeploy', { stdio: 'pipe' });
      } catch (railwayError) {
        console.warn('[DiscordBotCreator] Railway CLI not available or failed, environment variables need manual setup');
        console.log(`[DiscordBotCreator] Please set these environment variables manually:`);
        console.log(`  ${tokenVar}=${config.token}`);
        console.log(`  ${clientVar}=${config.clientId}`);
      }
      
    } catch (error) {
      console.error('[DiscordBotCreator] Failed to set Railway variables:', error);
    }
  }

  async createChannelForAgent(guildId: string, agentName: string): Promise<string | null> {
    try {
      const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: agentName.toLowerCase(),
          type: 0, // Text channel
          topic: `AI Agent channel for ${agentName}`
        })
      });
      
      if (response.ok) {
        const data = await response.json() as { id: string };
        console.log(`[DiscordBotCreator] Created channel for ${agentName}: ${data.id}`);
        
        // Set channel ID in Railway
        const channelVar = `${agentName.toUpperCase()}_CHANNEL_ID`;
        try {
          execSync(`railway variables --set ${channelVar}=${data.id}`, { stdio: 'pipe' });
        } catch (railwayError) {
          console.warn(`[DiscordBotCreator] Railway CLI not available, please set ${channelVar}=${data.id} manually`);
        }
        
        return data.id;
      }
    } catch (error) {
      console.error('[DiscordBotCreator] Failed to create channel:', error);
    }
    
    return null;
  }
}
