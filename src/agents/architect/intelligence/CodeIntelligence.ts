/**
 * Main code intelligence engine for comprehensive code understanding and modification
 */

import { FileMapper } from './FileMapper.js';
import { ConfigurationExtractor, ConfigReport, ConfigValue } from './ConfigurationExtractor.js';
import Anthropic from '@anthropic-ai/sdk';

export interface CodeIntelligenceRequest {
  type: 'query' | 'modify' | 'analyze';
  target: {
    feature: string;        // 'voice', 'feedback', 'api', 'discord'
    component: string;      // 'max_tokens', 'humor_level', 'timeout'
    files: string[];        // Auto-identified relevant files
  };
  modification?: {
    property: string;       // Specific setting to change
    currentValue: any;      // Extracted current value
    newValue: any;         // Desired new value
    riskLevel: 'low'|'medium'|'high';
  };
}

export interface IntelligenceResult {
  success: boolean;
  summary: string;
  details: string;
  configurations?: ConfigValue[];
  modifications?: string[];
  riskLevel: 'low' | 'medium' | 'high';
  affectedFiles: string[];
}

export class CodeIntelligence {
  private claude: Anthropic;
  private configExtractor: ConfigurationExtractor;

  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
    this.configExtractor = new ConfigurationExtractor();
  }

  /**
   * Process a natural language intelligence request
   */
  async processRequest(query: string): Promise<IntelligenceResult> {
    console.log(`[CodeIntelligence] Processing request: ${query}`);
    
    try {
      // Analyze the request to determine intent and target
      const request = await this.analyzeRequest(query);
      
      switch (request.type) {
        case 'query':
          return await this.handleConfigurationQuery(request, query);
        case 'modify':
          return await this.handleModificationRequest(request, query);
        case 'analyze':
          return await this.handleAnalysisRequest(request, query);
        default:
          return {
            success: false,
            summary: 'Unable to understand request intent',
            details: 'Please be more specific about what you want to query, modify, or analyze.',
            riskLevel: 'low',
            affectedFiles: []
          };
      }
    } catch (error) {
      console.error('[CodeIntelligence] Error processing request:', error);
      return {
        success: false,
        summary: 'Intelligence processing failed',
        details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        riskLevel: 'high',
        affectedFiles: []
      };
    }
  }

  /**
   * Analyze natural language request to determine intent and extract targets
   */
  private async analyzeRequest(query: string): Promise<CodeIntelligenceRequest> {
    const lowerQuery = query.toLowerCase();
    
    // Determine request type
    let type: 'query' | 'modify' | 'analyze' = 'query';
    if (lowerQuery.includes('change') || lowerQuery.includes('modify') || lowerQuery.includes('update') || 
        lowerQuery.includes('increase') || lowerQuery.includes('decrease') || lowerQuery.includes('set') ||
        lowerQuery.includes('tone down') || lowerQuery.includes('make') || lowerQuery.includes('disable') ||
        lowerQuery.includes('enable')) {
      type = 'modify';
    } else if (lowerQuery.includes('analyze') || lowerQuery.includes('how does') || lowerQuery.includes('show me') ||
               lowerQuery.includes('explain')) {
      type = 'analyze';
    }

    // Identify the feature being targeted
    const feature = FileMapper.identifyFeature(query) || 'general';
    
    // Discover relevant files
    const files = FileMapper.discoverFiles(query);
    
    // Extract component/property being targeted
    const component = this.extractTargetComponent(query);

    const request: CodeIntelligenceRequest = {
      type,
      target: {
        feature,
        component,
        files
      }
    };

    // For modification requests, extract more details
    if (type === 'modify') {
      request.modification = await this.extractModificationDetails(query, files, component);
    }

    return request;
  }

  /**
   * Handle configuration queries (e.g., "What's Commander's current max token limit?")
   */
  private async handleConfigurationQuery(request: CodeIntelligenceRequest, originalQuery: string): Promise<IntelligenceResult> {
    console.log(`[CodeIntelligence] Handling configuration query for ${request.target.feature}`);
    
    const configReport = await this.configExtractor.extractConfiguration(request.target.files, originalQuery);
    
    if (configReport.configurations.length === 0 && configReport.constants.length === 0) {
      return {
        success: false,
        summary: 'No relevant configuration found',
        details: `Could not find configuration values related to "${originalQuery}" in the analyzed files.`,
        riskLevel: 'low',
        affectedFiles: request.target.files
      };
    }

    // Generate intelligent summary
    const summary = await this.generateQuerySummary(configReport, originalQuery, request.target.feature);
    
    return {
      success: true,
      summary,
      details: configReport.summary,
      configurations: [...configReport.configurations, ...configReport.constants, ...configReport.prompts],
      riskLevel: 'low',
      affectedFiles: request.target.files
    };
  }

  /**
   * Handle modification requests (e.g., "Tone down Commander's humor by 20%")
   */
  private async handleModificationRequest(request: CodeIntelligenceRequest, originalQuery: string): Promise<IntelligenceResult> {
    console.log(`[CodeIntelligence] Handling modification request for ${request.target.feature}`);
    
    if (!request.modification) {
      return {
        success: false,
        summary: 'Unable to parse modification request',
        details: 'Could not determine what to modify or how to modify it.',
        riskLevel: 'medium',
        affectedFiles: request.target.files
      };
    }

    // First, find current values
    const configReport = await this.configExtractor.extractConfiguration(request.target.files, originalQuery);
    
    // Generate modification plan
    const modificationPlan = await this.generateModificationPlan(request, configReport, originalQuery);
    
    return {
      success: true,
      summary: `Modification plan generated for ${request.target.feature}`,
      details: modificationPlan,
      modifications: [`${request.modification.property}: ${request.modification.currentValue} → ${request.modification.newValue}`],
      riskLevel: request.modification.riskLevel,
      affectedFiles: request.target.files
    };
  }

  /**
   * Handle analysis requests (e.g., "How does the feedback learning system work?")
   */
  private async handleAnalysisRequest(request: CodeIntelligenceRequest, originalQuery: string): Promise<IntelligenceResult> {
    console.log(`[CodeIntelligence] Handling analysis request for ${request.target.feature}`);
    
    // Get configuration and implementation details
    const configReport = await this.configExtractor.extractConfiguration(request.target.files, originalQuery);
    
    // Generate comprehensive analysis
    const analysis = await this.generateFeatureAnalysis(request.target.feature, configReport, request.target.files);
    
    return {
      success: true,
      summary: `Analysis of ${request.target.feature} feature`,
      details: analysis,
      configurations: [...configReport.configurations, ...configReport.constants],
      riskLevel: 'low',
      affectedFiles: request.target.files
    };
  }

  /**
   * Extract the specific component/property being targeted
   */
  private extractTargetComponent(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    // Common configuration properties
    if (lowerQuery.includes('token') || lowerQuery.includes('limit')) return 'max_tokens';
    if (lowerQuery.includes('humor')) return 'humor_level';
    if (lowerQuery.includes('timeout')) return 'timeout';
    if (lowerQuery.includes('sentence') || lowerQuery.includes('length') || lowerQuery.includes('response')) return 'response_length';
    if (lowerQuery.includes('feedback') || lowerQuery.includes('learning')) return 'feedback_system';
    if (lowerQuery.includes('voice') || lowerQuery.includes('prompt')) return 'voice_prompt';
    if (lowerQuery.includes('discord') || lowerQuery.includes('channel')) return 'discord_config';
    
    return 'general';
  }

  /**
   * Extract modification details for targeted changes
   */
  private async extractModificationDetails(query: string, files: string[], component: string): Promise<any> {
    const lowerQuery = query.toLowerCase();
    
    // Find current value if possible
    let currentValue = null;
    if (component !== 'general') {
      const existing = await this.configExtractor.extractSpecificValue(files, component);
      currentValue = existing?.value;
    }

    // Determine new value and risk level
    let newValue = null;
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';

    if (lowerQuery.includes('token') && lowerQuery.includes('increase')) {
      newValue = currentValue ? Math.min(500, currentValue * 2) : 100;
      riskLevel = 'medium';
    } else if (lowerQuery.includes('tone down') || lowerQuery.includes('reduce humor')) {
      newValue = 'reduced humor level';
      riskLevel = 'low';
    } else if (lowerQuery.includes('disable')) {
      newValue = false;
      riskLevel = 'medium';
    } else if (lowerQuery.includes('enable')) {
      newValue = true;
      riskLevel = 'low';
    }

    return {
      property: component,
      currentValue,
      newValue,
      riskLevel
    };
  }

  /**
   * Generate intelligent summary for configuration queries
   */
  private async generateQuerySummary(configReport: ConfigReport, query: string, feature: string): Promise<string> {
    const relevantConfigs = [...configReport.configurations, ...configReport.constants]
      .filter(config => config.key.toLowerCase().includes(feature.replace('_', '')) || 
                       this.isRelevantToQuery(config.key, query));

    if (relevantConfigs.length === 0) {
      return `No specific configuration found for "${query}" in ${feature} feature.`;
    }

    const configSummaries = relevantConfigs.map(config => 
      `${config.key}=${config.value} (${config.file}:${config.line})`
    ).join(', ');

    return `Found ${relevantConfigs.length} relevant settings: ${configSummaries}`;
  }

  /**
   * Generate modification plan
   */
  private async generateModificationPlan(request: CodeIntelligenceRequest, configReport: ConfigReport, query: string): Promise<string> {
    const { modification, target } = request;
    if (!modification) return 'No modification details available';

    const plan = [
      `Modification Plan for ${target.feature}:`,
      `• Target: ${modification.property}`,
      `• Current: ${modification.currentValue || 'Not found'}`,
      `• New Value: ${modification.newValue}`,
      `• Risk Level: ${modification.riskLevel}`,
      `• Files Affected: ${target.files.join(', ')}`,
      '',
      'This modification would require updating the identified configuration values',
      'and ensuring compatibility with existing system behavior.'
    ];

    return plan.join('\n');
  }

  /**
   * Generate comprehensive feature analysis
   */
  private async generateFeatureAnalysis(feature: string, configReport: ConfigReport, files: string[]): Promise<string> {
    const featureDescriptions = FileMapper.getAvailableFeatures();
    const description = featureDescriptions[feature] || 'Unknown feature';
    
    const analysis = [
      `${feature.replace('_', ' ').toUpperCase()} FEATURE ANALYSIS`,
      '',
      `Description: ${description}`,
      `Files involved: ${files.length} files`,
      '',
      'Configuration Overview:',
      `• ${configReport.configurations.length} configuration properties`,
      `• ${configReport.constants.length} constants/static values`,
      `• ${configReport.prompts.length} prompts/templates`,
      `• ${configReport.environmentVars.length} environment variables`,
      '',
      'Key Implementation Details:',
      configReport.configurations.length > 0 
        ? `• Primary configs: ${configReport.configurations.slice(0, 3).map(c => c.key).join(', ')}`
        : '• No specific configurations found',
      '',
      'Files Analysis:',
      files.map(file => `• ${file.split('/').pop()} - ${this.getFileRole(file, feature)}`).join('\n')
    ];

    return analysis.join('\n');
  }

  /**
   * Determine file role in feature
   */
  private getFileRole(file: string, feature: string): string {
    const filename = file.split('/').pop()?.toLowerCase() || '';
    
    if (filename.includes('voice') || filename.includes('prompt')) return 'Voice/Prompt management';
    if (filename.includes('feedback') || filename.includes('learning')) return 'Learning system';
    if (filename.includes('discord') || filename.includes('interface')) return 'Communication interface';
    if (filename.includes('orchestrator') || filename.includes('router')) return 'Request routing';
    if (filename.includes('analyzer') || filename.includes('intelligence')) return 'Analysis engine';
    if (filename.includes('modifier') || filename.includes('builder')) return 'System modification';
    
    return 'Core functionality';
  }

  /**
   * Check if configuration is relevant to query
   */
  private isRelevantToQuery(key: string, query: string): boolean {
    const lowerQuery = query.toLowerCase();
    const lowerKey = key.toLowerCase();
    
    return lowerQuery.includes(lowerKey) || 
           lowerQuery.includes(key.replace('_', ' ')) ||
           lowerKey.includes('token') || lowerKey.includes('max') || 
           lowerKey.includes('timeout') || lowerKey.includes('voice') ||
           lowerKey.includes('humor') || lowerKey.includes('limit');
  }
}