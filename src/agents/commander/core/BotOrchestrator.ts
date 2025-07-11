import { DiscordInterface } from '../communication/DiscordInterface.js';
import Anthropic from '@anthropic-ai/sdk';

interface RegisteredBot {
  name: string;
  purpose: string;
  capabilities: string[];
  channelId: string;
  isOnline: boolean;
  specialties: string[];
  lastSeen: Date;
}

export class BotOrchestrator {
  private registeredBots: Map<string, RegisteredBot> = new Map();
  private claude: Anthropic;
  private discordInterface: DiscordInterface;

  constructor(claudeApiKey: string, discordInterface: DiscordInterface) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
    this.discordInterface = discordInterface;
    this.loadRegisteredBots();
    console.log('[BotOrchestrator] Bot delegation system initialized');
  }

  async registerBot(name: string, purpose: string, capabilities: string[], channelId: string): Promise<void> {
    const bot: RegisteredBot = {
      name,
      purpose,
      capabilities,
      channelId,
      isOnline: true,
      specialties: await this.extractSpecialties(purpose, capabilities),
      lastSeen: new Date()
    };

    this.registeredBots.set(name.toLowerCase(), bot);
    await this.saveRegisteredBots();
    
    console.log(`[BotOrchestrator] Registered bot: ${name} with capabilities: ${capabilities.join(', ')}`);
  }

  async shouldDelegate(input: string, userId: string): Promise<{ delegate: boolean, botName?: string, reason?: string }> {
    if (this.registeredBots.size === 0) {
      return { delegate: false };
    }

    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 300,
        system: `You are Commander's delegation system. Analyze requests and determine if they should be delegated to specialist bots.

AVAILABLE BOTS:
${Array.from(this.registeredBots.values()).map(bot => 
  `- ${bot.name}: ${bot.purpose} (Specialties: ${bot.specialties.join(', ')})`
).join('\n')}

DELEGATION RULES:
- Delegate if request clearly matches a bot's specialty
- Keep general conversation and work management with Commander
- Consider user intent and request complexity
- Commander handles: work management, feedback, general conversation, system coordination
- Specialists handle: their domain expertise

Respond in JSON:
{
  "delegate": true/false,
  "botName": "bot_name" or null,
  "reason": "why delegate or not",
  "confidence": 0.1-0.9
}`,
        messages: [{
          role: 'user',
          content: `Should this request be delegated to a specialist bot?

User request: "${input}"

Analyze if this matches any specialist bot's expertise or if Commander should handle it.`
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        try {
          const analysis = JSON.parse(content.text);
          
          if (analysis.delegate && analysis.botName) {
            const bot = this.registeredBots.get(analysis.botName.toLowerCase());
            if (bot && bot.isOnline) {
              return {
                delegate: true,
                botName: analysis.botName,
                reason: analysis.reason
              };
            }
          }
          
          return {
            delegate: false,
            reason: analysis.reason || 'Keeping with Commander'
          };
        } catch (parseError) {
          console.error('[BotOrchestrator] Failed to parse delegation analysis');
        }
      }
    } catch (error) {
      console.error('[BotOrchestrator] Delegation analysis failed:', error);
    }

    return { delegate: false, reason: 'Analysis failed - keeping with Commander' };
  }

  async delegateToBot(botName: string, input: string, userId: string): Promise<string> {
    const bot = this.registeredBots.get(botName.toLowerCase());
    
    if (!bot || !bot.isOnline) {
      return `${botName} is not available. I'll handle this request.`;
    }

    try {
      // Send message to the bot's channel with delegation context
      const delegationMessage = `🤖 **Delegated from Commander**\n**User:** <@${userId}>\n**Request:** ${input}`;
      
      await this.discordInterface.sendMessageToChannel(bot.channelId, delegationMessage);
      
      // Update bot last seen
      bot.lastSeen = new Date();
      await this.saveRegisteredBots();
      
      console.log(`[BotOrchestrator] Delegated to ${botName}: "${input}"`);
      
      return `Delegated to ${botName} - they'll handle your ${bot.specialties[0] || 'specialized'} request. Check #${botName.toLowerCase()} for the response.`;
      
    } catch (error) {
      console.error(`[BotOrchestrator] Failed to delegate to ${botName}:`, error);
      return `Failed to reach ${botName}. I'll handle this request instead.`;
    }
  }

  async getAvailableBots(): Promise<RegisteredBot[]> {
    return Array.from(this.registeredBots.values()).filter(bot => bot.isOnline);
  }

  async removeBotFromSystem(botName: string): Promise<boolean> {
    const removed = this.registeredBots.delete(botName.toLowerCase());
    if (removed) {
      await this.saveRegisteredBots();
      console.log(`[BotOrchestrator] Removed bot: ${botName}`);
    }
    return removed;
  }

  async getBotStatus(): Promise<string> {
    const bots = Array.from(this.registeredBots.values());
    
    if (bots.length === 0) {
      return "No specialist bots registered. I'm handling all requests.";
    }

    const online = bots.filter(b => b.isOnline);
    const offline = bots.filter(b => !b.isOnline);

    let status = `**Bot Status** (${online.length} online, ${offline.length} offline)\n\n`;
    
    if (online.length > 0) {
      status += "**Online:**\n";
      online.forEach(bot => {
        status += `• ${bot.name}: ${bot.specialties.join(', ')}\n`;
      });
    }

    if (offline.length > 0) {
      status += "\n**Offline:**\n";
      offline.forEach(bot => {
        status += `• ${bot.name}: Last seen ${bot.lastSeen.toLocaleDateString()}\n`;
      });
    }

    return status;
  }

  private async extractSpecialties(purpose: string, capabilities: string[]): Promise<string[]> {
    // Extract key specialties from purpose and capabilities
    const specialties: string[] = [];
    
    // Add capabilities as specialties
    specialties.push(...capabilities);
    
    // Extract specialties from purpose
    const purposeLower = purpose.toLowerCase();
    if (purposeLower.includes('ui') || purposeLower.includes('design')) specialties.push('UI/Design');
    if (purposeLower.includes('deploy') || purposeLower.includes('deployment')) specialties.push('Deployment');
    if (purposeLower.includes('monitor') || purposeLower.includes('performance')) specialties.push('Monitoring');
    if (purposeLower.includes('quality') || purposeLower.includes('testing')) specialties.push('Quality Assurance');
    if (purposeLower.includes('security')) specialties.push('Security');
    
    return [...new Set(specialties)]; // Remove duplicates
  }

  private async loadRegisteredBots(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const data = await fs.readFile('data/registered-bots.json', 'utf8');
      const bots = JSON.parse(data);
      
      this.registeredBots = new Map();
      bots.forEach((bot: RegisteredBot) => {
        bot.lastSeen = new Date(bot.lastSeen);
        this.registeredBots.set(bot.name.toLowerCase(), bot);
      });
      
      console.log(`[BotOrchestrator] Loaded ${this.registeredBots.size} registered bots`);
    } catch (error) {
      console.log('[BotOrchestrator] No existing bot registry found, starting fresh');
      this.registeredBots = new Map();
    }
  }

  private async saveRegisteredBots(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      await fs.mkdir('data', { recursive: true });
      
      const bots = Array.from(this.registeredBots.values());
      await fs.writeFile('data/registered-bots.json', JSON.stringify(bots, null, 2));
    } catch (error) {
      console.error('[BotOrchestrator] Failed to save bot registry:', error);
    }
  }
}
