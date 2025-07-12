import { ArchitecturalRequest, ArchitectConfig } from '../types/index.js';
import { LiveDeploymentTracker } from '../operations/LiveDeploymentTracker.js';
import { ArchitectVoice } from '../communication/ArchitectVoice.js';
import { ArchitectDiscord } from '../communication/ArchitectDiscord.js';
import { Message } from 'discord.js';

export class ArchitectOrchestrator {
private liveDeployer: LiveDeploymentTracker;
private voice: ArchitectVoice;
private discord: ArchitectDiscord;
private progressMessages: Map<string, Message> = new Map(); // deploymentId -> Discord Message object

constructor(config: ArchitectConfig) {
this.liveDeployer = new LiveDeploymentTracker(config.claudeApiKey, config.discordToken);
this.voice = new ArchitectVoice(config.claudeApiKey);
this.discord = new ArchitectDiscord(config);
}

private async handleAgentCreation(request: ArchitecturalRequest): Promise<string> {
console.log(`[ArchitectOrchestrator] Starting live tracked deployment: ${request.description}`);

```
try {
  // Send ONE initial progress message that we'll keep updating
  const initialProgressMessage = `🚀 **Starting Agent Deployment**
```

⏳ Initializing deployment pipeline…

📊 **Progress**
░░░░░░░░░░░░░░░░░░░░ 0%

**Current Step:** Parsing Requirements
**Status:** ⏳ Starting
**Elapsed:** 0s
**ETA:** Calculating…

-----

*This message updates live - no need to refresh*`;

```
  const progressMessage = await this.discord.sendMessage(initialProgressMessage);
  let deploymentId: string;
  
  // Start deployment with live progress updates to the SAME message
  const deploymentResult = await this.liveDeployer.createAndDeployAgent(
    request.description,
    async (progress) => {
      deploymentId = progress.deploymentId;
      
      // Store the message reference for this deployment
      if (progressMessage && !this.progressMessages.has(deploymentId)) {
        this.progressMessages.set(deploymentId, progressMessage);
      }
      
      // Update the SAME message with new progress
      await this.updateSingleProgressMessage(progress);
    }
  );
  
  // Final completion - send as NEW message (so it stays visible)
  if (deploymentResult.success) {
    // Edit the progress message one final time to show completion
    await this.finalizeProgressMessage(deploymentId!, deploymentResult);
    
    // Send a separate completion summary message
    return await this.voice.formatResponse(
      `🎉 **Agent Deployment Complete!**
```

✅ **${deploymentResult.summary}**

🚀 **Quick Access:**

- **Agent URL:** ${deploymentResult.agentUrl}
- **Discord Bot:** ${deploymentResult.discordSetup?.inviteUrl || 'N/A'}
- **Total Time:** ${deploymentResult.actualDeploymentTime}

Your agent is live and ready to use!`,
{ type: 'creation' }
);

```
  } else {
    // Edit progress message to show failure
    await this.finalizeProgressMessage(deploymentId!, deploymentResult);
    
    return await this.voice.formatResponse(
      `❌ **Deployment Failed**
```

**Error:** ${deploymentResult.error}
**Failed At:** ${deploymentResult.failedAt}

You can retry the deployment - all progress has been cleaned up.`,
{ type: 'error' }
);
}

```
} catch (error) {
  console.error('[ArchitectOrchestrator] Agent creation failed:', error);
  return await this.voice.formatResponse(
    `Agent creation failed: ${error instanceof Error ? error.message : String(error)}`, 
    { type: 'error' }
  );
}
```

}

private async updateSingleProgressMessage(progress: any): Promise<void> {
try {
const message = this.progressMessages.get(progress.deploymentId);
if (!message) return;

```
  const elapsed = Date.now() - progress.startTime;
  const eta = progress.estimatedCompletion ? 
    this.formatDuration(Math.max(0, progress.estimatedCompletion - Date.now())) : 'Calculating...';
  
  const currentStep = progress.steps[progress.currentStep];
  const progressBar = this.generateProgressBar(progress.overallProgress, 20);
  
  const updatedContent = `🚀 **Deploying ${progress.agentName}**
```

📊 **Progress**
${progressBar} ${progress.overallProgress.toFixed(1)}%

**Current Step:** ${currentStep?.name || 'Unknown'}
**Status:** ${this.getStatusEmoji(currentStep?.status)} ${currentStep?.status || 'Unknown'}
**Elapsed:** ${this.formatDuration(elapsed)}
**ETA:** ${eta}

**Recent Steps:**
${this.generateStepList(progress)}

-----

*Live updates • Deployment ID: ${progress.deploymentId}*`;

```
  // Edit the existing message with new content
  await message.edit(updatedContent);
  
} catch (error) {
  console.error('[ArchitectOrchestrator] Failed to update progress message:', error);
}
```

}

private async finalizeProgressMessage(deploymentId: string, result: any): Promise<void> {
try {
const message = this.progressMessages.get(deploymentId);
if (!message) return;

```
  let finalContent: string;
  
  if (result.success) {
    finalContent = `✅ **Agent Deployment Complete!**
```

🎉 **${result.summary}**

📊 **Final Results**
████████████████████ 100%

**Total Time:** ${result.actualDeploymentTime}
**Status:** ✅ Successfully Deployed
**PR:** #${result.prNumber} (merged)
**Agent URL:** ${result.agentUrl}

**Performance Breakdown:**
${result.timingBreakdown?.slice(0, 5).map((t: any) => `${this.getStatusEmoji(t.status)} ${t.step}: ${t.duration}`).join('\n')}

-----

✅ **Deployment Complete** • ID: ${deploymentId}`; } else { finalContent = `❌ **Deployment Failed**

💥 **Error:** ${result.error}

📊 **Progress Before Failure**
${this.generateProgressBar(result.progress || 0, 20)} ${(result.progress || 0).toFixed(1)}%

**Failed At:** ${result.failedAt}
**Status:** ❌ Deployment Failed

**Steps Completed:**
${result.timingBreakdown?.filter((t: any) => t.status === 'completed').map((t: any) => `✅ ${t.step}: ${t.duration}`).join('\n') || 'None'}

-----

❌ **Deployment Failed** • ID: ${deploymentId}`;
}

```
  await message.edit(finalContent);
  
  // Clean up the reference
  this.progressMessages.delete(deploymentId);
  
} catch (error) {
  console.error('[ArchitectOrchestrator] Failed to finalize progress message:', error);
}
```

}

private generateProgressBar(progress: number, length: number = 20): string {
const filled = Math.round((progress / 100) * length);
const empty = length - filled;
return '█'.repeat(filled) + '░'.repeat(empty);
}

private generateStepList(progress: any): string {
const steps = progress.steps;
const current = progress.currentStep;

```
// Show 2 completed steps before current, current step, and 2 upcoming steps
const start = Math.max(0, current - 2);
const end = Math.min(steps.length, current + 3);

let stepList = '';
for (let i = start; i < end; i++) {
  const step = steps[i];
  const emoji = this.getStatusEmoji(step.status);
  const isCurrent = i === current;
  const arrow = isCurrent ? ' ← **Current**' : '';
  
  stepList += `${emoji} ${step.name}${arrow}\n`;
}

return stepList.trim();
```

}

private getStatusEmoji(status?: string): string {
switch (status) {
case 'completed': return '✅';
case 'running': return '⏳';
case 'failed': return '❌';
case 'pending': return '⏸️';
default: return '❓';
}
}

private formatDuration(ms: number): string {
if (ms < 1000) return `${Math.round(ms)}ms`;
if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

// Enhanced Discord class to support message editing
private async editProgressMessage(messageId: string, content: string): Promise<void> {
try {
await this.discord.editMessage(messageId, content);
} catch (error) {
console.error('[ArchitectOrchestrator] Failed to edit message:', error);
}
}
}