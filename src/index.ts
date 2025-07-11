import { Commander } from './agents/commander/Commander.js';

async function main() {
  console.log('🚀 Starting AI Commander System...');
  const commander = new Commander();
  await commander.start();
}

main().catch((error) => {
  console.error('❌ Commander failed to start:', error);
  process.exit(1);
});
