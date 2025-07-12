import { Client, GatewayIntentBits, TextChannel, EmbedBuilder, Message } from ‘discord.js’;
import { ArchitectConfig } from ‘../types/index.js’;

export class ArchitectDiscord {
private client: Client;
private architectChannel: TextChannel | null = null;
private config: ArchitectConfig;
private messageHandlers: Array<(message: Message) => Promise<void>> = [];

constructor(config: ArchitectConfig) {
this.config = config;
this.client = new Client({
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent
]
});

```
this.setupEventHandlers();
```

}

private setupEventHandlers(): void {
this.client.once(‘ready’, async () => {
console.log(`[ArchitectDiscord] Connected as ${this.client.user?.tag}`);
this.architectChannel = this.client.channels.cache.get(this.config.architectChannelId) as TextChannel;

```
  this.client.user?.setPresence({
    activities: [{ name: 'Building Systems', type: 3 }],
    status: 'online'
  });
});

this.client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.channelId !== this.config.architectChannelId) return;
  
  for (const handler of this.messageHandlers) {
    await handler(message);
  }
});

this.client.on('error', (error) => {
  console.error('[ArchitectDiscord] Client error:', error);
});
```

}

onMessage(handler: (message: Message) => Promise<void>): void {
this.messageHandlers.push(handler);
}

async sendMessage(content: string): Promise<Message | null> {
if (!this.architectChannel) {
console.error(’[ArchitectDiscord] Channel not available’);
return null;
}

```
try {
  const message = await this.architectChannel.send(content);
  console.log(`[ArchitectDiscord] Sent message: ${message.id}`);
  return message;
} catch (error) {
  console.error('[ArchitectDiscord] Failed to send message:', error);
  return null;
}
```

}

async editMessage(messageOrId: Message | string, newContent: string): Promise<Message | null> {
try {
let message: Message;

```
  if (typeof messageOrId === 'string') {
    if (!this.architectChannel) {
      console.error('[ArchitectDiscord] Channel not available for message editing');
      return null;
    }
    message = await this.architectChannel.messages.fetch(messageOrId);
  } else {
    message = messageOrId;
  }
  
  const editedMessage = await message.edit(newContent);
  console.log(`[ArchitectDiscord] Edited message: ${editedMessage.id}`);
  return editedMessage;
  
} catch (error) {
  console.error('[ArchitectDiscord] Failed to edit message:', error);
  return null;
}
```

}

async deleteMessage(messageOrId: Message | string): Promise<boolean> {
try {
let message: Message;

```
  if (typeof messageOrId === 'string') {
    if (!this.architectChannel) {
      console.error('[ArchitectDiscord] Channel not available for message deletion');
      return false;
    }
    message = await this.architectChannel.messages.fetch(messageOrId);
  } else {
    message = messageOrId;
  }
  
  await message.delete();
  console.log(`[ArchitectDiscord] Deleted message: ${message.id}`);
  return true;
  
} catch (error) {
  console.error('[ArchitectDiscord] Failed to delete message:', error);
  return false;
}
```

}

async addReaction(messageOrId: Message | string, emoji: string): Promise<boolean> {
try {
let message: Message;

```
  if (typeof messageOrId === 'string') {
    if (!this.architectChannel) {
      console.error('[ArchitectDiscord] Channel not available for reaction');
      return false;
    }
    message = await this.architectChannel.messages.fetch(messageOrId);
  } else {
    message = messageOrId;
  }
  
  await message.react(emoji);
  console.log(`[ArchitectDiscord] Added reaction ${emoji} to message: ${message.id}`);
  return true;
  
} catch (error) {
  console.error('[ArchitectDiscord] Failed to add reaction:', error);
  return false;
}
```

}

async sendEmbed(title: string, description: string, color: number = 0x3498db): Promise<Message | null> {
if (!this.architectChannel) return null;

```
const embed = new EmbedBuilder()
  .setTitle(title)
  .setDescription(description)
  .setColor(color)
  .setTimestamp();

try {
  return await this.architectChannel.send({ embeds: [embed] });
} catch (error) {
  console.error('[ArchitectDiscord] Failed to send embed:', error);
  return null;
}
```

}

async startTyping(): Promise<void> {
if (this.architectChannel) {
await this.architectChannel.sendTyping();
}
}

async start(): Promise<void> {
await this.client.login(this.config.architectToken);
}

get isReady(): boolean {
return this.client.isReady();
}

get channelId(): string | null {
return this.architectChannel?.id || null;
}

async getMessage(messageId: string): Promise<Message | null> {
try {
if (!this.architectChannel) return null;
return await this.architectChannel.messages.fetch(messageId);
} catch (error) {
console.error(’[ArchitectDiscord] Failed to fetch message:’, error);
return null;
}
}

canEditMessage(message: Message): boolean {
return message.author.id === this.client.user?.id;
}
}