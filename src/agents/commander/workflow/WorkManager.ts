import * as fs from 'fs/promises';
import * as path from 'path';
import { WorkItem, UniversalIntent } from '../types/index.js';

export class WorkManager {
  private workItems: Map<string, WorkItem> = new Map();
  private dataDir: string;
  private workItemsFile: string;
  
  constructor(dataDir: string = './data') {
    this.dataDir = dataDir;
    this.workItemsFile = path.join(dataDir, 'work-items.json');
    this.loadWorkItems();
  }

  async createWorkItem(params: {
    title: string;
    description: string;
    originalRequest: string;
    assignedAgents: string[];
    primaryAgent: string;
    estimatedComplexity?: 'simple' | 'medium' | 'complex' | 'enterprise';
    userId: string;
    messageId: string;
    parentWorkItem?: string;
  }): Promise<WorkItem> {
    
    const workItem: WorkItem = {
      id: this.generateWorkItemId(),
      title: params.title,
      description: params.description,
      originalRequest: params.originalRequest,
      status: 'analyzing',
      priority: this.determinePriority(params.estimatedComplexity || 'simple'),
      assignedAgents: params.assignedAgents,
      primaryAgent: params.primaryAgent,
      progress: 0,
      startTime: new Date(),
      clarifiedRequirements: [],
      userPreferences: {},
      retryCount: 0,
      errors: []
    };
    
    this.workItems.set(workItem.id, workItem);
    await this.saveWorkItems();
    
    console.log(`[WorkManager] Created work item ${workItem.id}: ${workItem.title}`);
    return workItem;
  }

  async getWorkItem(id: string): Promise<WorkItem | null> {
    return this.workItems.get(id) || null;
  }

  async updateWorkItem(id: string, updates: Partial<WorkItem>): Promise<WorkItem | null> {
    const workItem = this.workItems.get(id);
    if (!workItem) return null;
    
    Object.assign(workItem, updates);
    this.workItems.set(id, workItem);
    await this.saveWorkItems();
    
    return workItem;
  }

  async handleWorkManagement(intent: UniversalIntent, userId: string): Promise<string> {
    const action = intent.specific;
    const target = intent.parameters.target;
    
    console.log(`[WorkManager] Handling ${action} for target: ${target}`);
    
    switch (action) {
      case 'manage-cancel':
      case 'manage-work-cancel':
        return await this.cancelWork(target, userId, intent.parameters.description);
        
      case 'manage-pause':
      case 'manage-work-pause':
        return await this.pauseWork(target, userId);
        
      case 'manage-resume':
      case 'manage-work-resume':
        return await this.resumeWork(target, userId);
        
      case 'manage-status':
      case 'manage-work-status':
        return await this.getWorkStatus(userId);
        
      default:
        return `🤔 I understand you want to manage work, but I'm not sure what specific action to take. Could you be more specific?`;
    }
  }

  private async cancelWork(target: string | undefined, userId: string, reason?: string): Promise<string> {
    const workItem = await this.findTargetWorkItem(target, userId);
    
    if (!workItem) {
      return `× No work to cancel. Could you be more specific about what to cancel?`;
    }
    
    if (workItem.status === 'completed') {
      return `× ${workItem.id} (${workItem.title}) is already completed and can't be cancelled.`;
    }
    
    if (workItem.status === 'cancelled') {
      return `× ${workItem.id} (${workItem.title}) is already cancelled.`;
    }
    
    workItem.status = 'cancelled';
    workItem.actualCompletion = new Date();
    if (reason) {
      workItem.errors = [...(workItem.errors || []), `Cancelled: ${reason}`];
    }
    
    await this.updateWorkItem(workItem.id, workItem);
    
    const reasonText = reason ? ` (Reason: ${reason})` : '';
    return `× Cancelled ${workItem.id} - ${workItem.title}${reasonText}`;
  }

  private async pauseWork(target: string | undefined, userId: string): Promise<string> {
    const workItem = await this.findTargetWorkItem(target, userId);
    
    if (!workItem) {
      return `× No active work to pause.`;
    }
    
    if (!['analyzing', 'building', 'deploying'].includes(workItem.status)) {
      return `× ${workItem.id} (${workItem.title}) is ${workItem.status} and can't be paused.`;
    }
    
    // TODO: Implement actual work pausing (signal to agents)
    workItem.status = 'cancelled'; // For now, cancelling instead of pausing
    await this.updateWorkItem(workItem.id, workItem);
    
    return `■ Paused ${workItem.id} - ${workItem.title}\n(Note: Pause/resume TODO - cancelled for now)`;
  }

  private async resumeWork(target: string | undefined, userId: string): Promise<string> {
    // TODO: Implement work resumption
    return `▶ Resume functionality TODO - will restore paused work items`;
  }

  private async getWorkStatus(userId: string): Promise<string> {
    const userWorkItems = Array.from(this.workItems.values())
      .filter(item => !['completed', 'cancelled', 'failed'].includes(item.status))
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    
    if (userWorkItems.length === 0) {
      return `✓ No active work - ready for new requests`;
    }
    
    let status = `■ Active Work Items:\n\n`;
    
    userWorkItems.forEach(item => {
      const elapsed = Math.round((Date.now() - item.startTime.getTime()) / 1000 / 60); // minutes
      status += `${item.id} - ${item.title}\n`;
      status += `→ Status: ${item.status.toUpperCase()} | Progress: ${item.progress}% | ${elapsed}m ago\n\n`;
    });
    
    return status;
  }

  private async findTargetWorkItem(target: string | undefined, userId: string): Promise<WorkItem | null> {
    if (!target) {
      // Find most recent work item
      const recent = Array.from(this.workItems.values())
        .filter(item => !['completed', 'cancelled', 'failed'].includes(item.status))
        .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0];
      
      return recent || null;
    }
    
    // Try exact ID match first
    const exactMatch = this.workItems.get(target);
    if (exactMatch) return exactMatch;
    
    // Try partial title match
    const titleMatch = Array.from(this.workItems.values())
      .find(item => item.title.toLowerCase().includes(target.toLowerCase()));
    
    return titleMatch || null;
  }

  // File persistence methods
  private async loadWorkItems(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      
      const data = await fs.readFile(this.workItemsFile, 'utf-8');
      const workItemsArray = JSON.parse(data);
      
      // Restore dates from JSON
      workItemsArray.forEach((item: any) => {
        item.startTime = new Date(item.startTime);
        if (item.estimatedCompletion) item.estimatedCompletion = new Date(item.estimatedCompletion);
        if (item.actualCompletion) item.actualCompletion = new Date(item.actualCompletion);
      });
      
      this.workItems = new Map(workItemsArray.map((item: WorkItem) => [item.id, item]));
      console.log(`[WorkManager] Loaded ${this.workItems.size} work items from storage`);
      
    } catch (error) {
      console.log('[WorkManager] No existing work items found, starting fresh');
      this.workItems = new Map();
    }
  }

  private async saveWorkItems(): Promise<void> {
    try {
      const workItemsArray = Array.from(this.workItems.values());
      await fs.writeFile(this.workItemsFile, JSON.stringify(workItemsArray, null, 2));
    } catch (error) {
      console.error('[WorkManager] Failed to save work items:', error);
    }
  }

  private generateWorkItemId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `work_${timestamp}_${random}`;
  }

  private determinePriority(complexity: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (complexity) {
      case 'simple': return 'low';
      case 'medium': return 'medium';
      case 'complex': return 'high';
      case 'enterprise': return 'critical';
      default: return 'medium';
    }
  }

  // Public utility methods
  public getAllWorkItems(): WorkItem[] {
    return Array.from(this.workItems.values());
  }

  public getRecentWorkItems(count: number = 5): WorkItem[] {
    return Array.from(this.workItems.values())
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, count);
  }

  public getActiveWorkItems(): WorkItem[] {
    return Array.from(this.workItems.values())
      .filter(item => !['completed', 'cancelled', 'failed'].includes(item.status));
  }
}