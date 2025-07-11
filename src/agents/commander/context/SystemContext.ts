import { CommanderConfig } from '../types/index.js';

export interface SystemContextData {
  currentRepository: string;
  availableAgents: AgentInfo[];
  systemCapabilities: string[];
  environmentInfo: EnvironmentInfo;
  recentActivity: string[];
}

export interface AgentInfo {
  name: string;
  status: 'online' | 'offline' | 'pending';
  capabilities: string[];
}

export interface EnvironmentInfo {
  nodeVersion: string;
  environment: string;
  uptime: string;
}

export class SystemContext {
  private config: CommanderConfig;

  constructor(config: CommanderConfig) {
    this.config = config;
  }

  getCurrentContext(): SystemContextData {
    return {
      currentRepository: this.determineCurrentRepo(),
      availableAgents: this.getAvailableAgents(),
      systemCapabilities: this.getSystemCapabilities(),
      environmentInfo: this.getEnvironmentInfo(),
      recentActivity: this.getRecentSystemActivity()
    };
  }

  private determineCurrentRepo(): string {
    // Logic to determine if we're working in aos-dev-team or aurora context
    return 'aos-dev-team'; // Default context for EPOCH I development
  }

  private getAvailableAgents(): AgentInfo[] {
    return [
      { 
        name: 'Systems Architect', 
        status: 'online', 
        capabilities: ['architecture', 'code-analysis', 'discord-setup'] 
      },
      { 
        name: 'Dashboard', 
        status: 'pending', 
        capabilities: ['metrics', 'monitoring'] 
      }
    ];
  }

  private getSystemCapabilities(): string[] {
    return [
      'GitHub PR creation',
      'Code analysis and review', 
      'Agent coordination',
      'Discord bot management',
      'Architecture planning',
      'Work item management',
      'Intelligent conversation',
      'Context-aware responses'
    ];
  }

  private getEnvironmentInfo(): EnvironmentInfo {
    return {
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
      uptime: this.formatUptime(process.uptime())
    };
  }

  private getRecentSystemActivity(): string[] {
    // This would normally pull from logs or activity tracking
    return [
      'Commander started successfully',
      'Discord connection established',
      'Agent orchestration ready'
    ];
  }

  private formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }
}