
export class ContextProvider {
 static getTimeContext(): string {
   const now = new Date();
   const hour = now.getHours();
   const day = now.toLocaleDateString('en-US', { weekday: 'long' });
   
   let timeOfDay = 'night';
   if (hour >= 5 && hour < 12) timeOfDay = 'morning';
   else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
   else if (hour >= 17 && hour < 21) timeOfDay = 'evening';
   
   return `${timeOfDay} on ${day}`;
 }
 
 static getSystemStatus(): string {
   return `System uptime: ${Math.floor(process.uptime() / 60)}m`;
 }
}
