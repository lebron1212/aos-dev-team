
 async updateTrackedMessage(messageId: string, response: string): Promise<void> {
   const existing = this.messageContext.get(messageId);
   if (existing) {
     existing.response = response;
     console.log(`[DiscordInterface] Updated message context with response`);
   }
 }
}
