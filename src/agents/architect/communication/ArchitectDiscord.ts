import { Client, GatewayIntentBits, TextChannel, Message } from ‘discord.js’;

export class ArchitectDiscord {
private client: Client;
private channel: TextChannel | null = null;
private config: any;
private messageHandlers: Array<(message: Message) => Promise<void>> = [];

constructor(config: any) {
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
this.channel = this.client.channels.cache.get(this.config.architectChannelId) as TextChannel;

```
  this.client.user?.setPresence({
    activities: [{ name: 'Building and deploying agents', type: 3 }],
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
if (!this.channel) {
console.error(’[ArchitectDiscord] Channel not available’);
return null;
}

```
try {
  const message = await this.channel.send(content);
  console.log(`[ArchitectDiscord] Sent message: ${message.id}`);
  return message;
} catch (error) {
  console.error('[ArchitectDiscord] Failed to send message:', error);
  return null;
}
```

}

// NEW: Edit an existing message
async editMessage(messageOrId: Message | string, newContent: string): Promise<Message | null> {
try {
let message: Message;

```
  if (typeof messageOrId === 'string') {
    // If we got a message ID, fetch the message first
    if (!this.channel) {
      console.error('[ArchitectDiscord] Channel not available for message editing');
      return null;
    }
    message = await this.channel.messages.fetch(messageOrId);
  } else {
    // If we got a Message object, use it directly
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

// NEW: Delete a message
async deleteMessage(messageOrId: Message | string): Promise<boolean> {
try {
let message: Message;

```
  if (typeof messageOrId === 'string') {
    if (!this.channel) {
      console.error('[ArchitectDiscord] Channel not available for message deletion');
      return false;
    }
    message = await this.channel.messages.fetch(messageOrId);
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

// NEW: Add reaction to a message
async addReaction(messageOrId: Message | string, emoji: string): Promise<boolean> {
try {
let message: Message;

```
  if (typeof messageOrId === 'string') {
    if (!this.channel) {
      console.error('[ArchitectDiscord] Channel not available for reaction');
      return false;
    }
    message = await this.channel.messages.fetch(messageOrId);
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

// NEW: Send a message and then edit it (useful for immediate feedback)
async sendAndEditMessage(initialContent: string, finalContent: string, delay: number = 1000): Promise<Message | null> {
const message = await this.sendMessage(initialContent);
if (!message) return null;

```
setTimeout(async () => {
  await this.editMessage(message, finalContent);
}, delay);

return message;
```

}

// NEW: Send a typing indicator
async startTyping(): Promise<void> {
if (this.channel) {
await this.channel.sendTyping();
}
}

async start(): Promise<void> {
await this.client.login(this.config.architectToken);
}

get isReady(): boolean {
return this.client.isReady();
}

get channelId(): string | null {
return this.channel?.id || null;
}

// Utility: Get message by ID
async getMessage(messageId: string): Promise<Message | null> {
try {
if (!this.channel) return null;
return await this.channel.messages.fetch(messageId);
} catch (error) {
console.error(’[ArchitectDiscord] Failed to fetch message:’, error);
return null;
}
}

// Utility: Check if bot can edit a message (must be bot’s own message)
canEditMessage(message: Message): boolean {
return message.author.id === this.client.user?.id;
}
}