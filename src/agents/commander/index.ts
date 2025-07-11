// Commander Package Entry Point
export { Commander } from './Commander.js';
export { UniversalRouter } from './core/UniversalRouter.js';
export { AgentOrchestrator } from './core/AgentOrchestrator.js';
export { COM_L1_IntentAnalyzer } from './intelligence/COM-L1-IntentAnalyzer.js';
export { RequirementGatherer } from './intelligence/RequirementGatherer.js';
export { WorkManager } from './workflow/WorkManager.js';
export { DiscordInterface } from './communication/DiscordInterface.js';
export { VoiceSystem } from './communication/VoiceSystem.js';

// Export all types
export * from './types/index.js';

// Quick start function
export async function startCommander(): Promise<void> {
  const { Commander } = await import('./Commander.js');
  const commander = new Commander();
  await commander.start();
}