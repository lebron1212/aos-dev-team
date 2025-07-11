// New Commander Entry Point
import { Commander } from './agents/commander/Commander.js';

console.log('Starting AI Commander System...');

const commander = new Commander();
commander.start().catch((error) => {
  console.error('Commander startup failed:', error);
  process.exit(1);
});