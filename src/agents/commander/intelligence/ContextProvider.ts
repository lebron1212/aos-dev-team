export class ContextProvider {
  static getTimeContext(): string {
    const now = new Date();
    const hour = now.getHours();
    const day = now.toLocaleDateString('en-US', { weekday: 'long' });
    
    let timeOfDay = 'day';
    if (hour < 6) timeOfDay = 'late night';
    else if (hour < 12) timeOfDay = 'morning';
    else if (hour < 17) timeOfDay = 'afternoon';
    else if (hour < 22) timeOfDay = 'evening';
    else timeOfDay = 'night';
    
    return `${day} ${timeOfDay}`;
  }
  
  static getSystemStatus(): any {
    return {
      online: true,
      agents: ['Commander', 'FrontendArchitect'],
      learning: true
    };
  }
}
