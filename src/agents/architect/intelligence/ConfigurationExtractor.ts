/**
 * Configuration extraction engine for parsing code configurations
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface ConfigReport {
  configurations: ConfigValue[];
  constants: ConfigValue[];
  prompts: ConfigValue[];
  environmentVars: ConfigValue[];
  summary: string;
}

export interface ConfigValue {
  key: string;
  value: any;
  type: 'number' | 'string' | 'boolean' | 'object' | 'array';
  file: string;
  line: number;
  context: string;
}

export class ConfigurationExtractor {
  
  /**
   * Extract configuration values from multiple files
   */
  async extractConfiguration(files: string[], query: string): Promise<ConfigReport> {
    const configurations: ConfigValue[] = [];
    const constants: ConfigValue[] = [];
    const prompts: ConfigValue[] = [];
    const environmentVars: ConfigValue[] = [];

    console.log(`[ConfigurationExtractor] Extracting config from ${files.length} files for: ${query}`);

    for (const file of files) {
      try {
        if (await this.fileExists(file)) {
          const content = await fs.readFile(file, 'utf-8');
          const extracted = this.parseFileConfigurations(content, file, query);
          
          configurations.push(...extracted.configurations);
          constants.push(...extracted.constants);
          prompts.push(...extracted.prompts);
          environmentVars.push(...extracted.environmentVars);
        } else {
          console.log(`[ConfigurationExtractor] File not found: ${file}`);
        }
      } catch (error) {
        console.error(`[ConfigurationExtractor] Error reading ${file}:`, error);
      }
    }

    const summary = this.generateSummary(configurations, constants, prompts, environmentVars, query);

    return {
      configurations,
      constants,
      prompts,
      environmentVars,
      summary
    };
  }

  /**
   * Parse configurations from a single file
   */
  private parseFileConfigurations(content: string, filePath: string, query: string): ConfigReport {
    const lines = content.split('\n');
    const configurations: ConfigValue[] = [];
    const constants: ConfigValue[] = [];
    const prompts: ConfigValue[] = [];
    const environmentVars: ConfigValue[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;
      
      // Extract constants and configuration values
      const configMatches = this.extractConfigValues(line, filePath, lineNumber, lines, i);
      configMatches.forEach(match => {
        if (this.isRelevantToQuery(match.key, match.value, query)) {
          if (match.key.includes('PROMPT') || match.key.includes('prompt') || 
              (typeof match.value === 'string' && match.value.length > 100)) {
            prompts.push(match);
          } else if (match.key.includes('TOKEN') || match.key.includes('KEY') || 
                     match.key.includes('API') || match.key.includes('SECRET')) {
            environmentVars.push(match);
          } else if (match.key.toUpperCase() === match.key && match.key.includes('_')) {
            constants.push(match);
          } else {
            configurations.push(match);
          }
        }
      });
    }

    return { configurations, constants, prompts, environmentVars, summary: '' };
  }

  /**
   * Extract configuration values from a line
   */
  private extractConfigValues(line: string, file: string, lineNumber: number, allLines: string[], currentIndex: number): ConfigValue[] {
    const matches: ConfigValue[] = [];
    
    // Pattern 1: max_tokens: 35
    const numberAssignmentRegex = /(\w+):\s*(\d+)/g;
    let match;
    while ((match = numberAssignmentRegex.exec(line)) !== null) {
      matches.push({
        key: match[1],
        value: parseInt(match[2]),
        type: 'number',
        file,
        line: lineNumber,
        context: this.getContext(allLines, currentIndex)
      });
    }

    // Pattern 2: const VARIABLE = 'value' or static readonly VARIABLE = 'value'
    const constantRegex = /(?:const|static\s+readonly)\s+([A-Z_]+)\s*=\s*['"`]([^'"`]*?)['"`]/g;
    while ((match = constantRegex.exec(line)) !== null) {
      matches.push({
        key: match[1],
        value: match[2],
        type: 'string',
        file,
        line: lineNumber,
        context: this.getContext(allLines, currentIndex)
      });
    }

    // Pattern 3: property: 'value'
    const stringPropertyRegex = /(\w+):\s*['"`]([^'"`]*?)['"`]/g;
    while ((match = stringPropertyRegex.exec(line)) !== null) {
      matches.push({
        key: match[1],
        value: match[2],
        type: 'string',
        file,
        line: lineNumber,
        context: this.getContext(allLines, currentIndex)
      });
    }

    // Pattern 4: boolean values
    const booleanRegex = /(\w+):\s*(true|false)/g;
    while ((match = booleanRegex.exec(line)) !== null) {
      matches.push({
        key: match[1],
        value: match[2] === 'true',
        type: 'boolean',
        file,
        line: lineNumber,
        context: this.getContext(allLines, currentIndex)
      });
    }

    // Pattern 5: Multi-line template literals (for prompts)
    if (line.includes('`') && !line.includes('```')) {
      const promptMatch = line.match(/(\w+)\s*=\s*`([^`]*)/);
      if (promptMatch) {
        // Look for the closing backtick
        let promptValue = promptMatch[2];
        let endIndex = currentIndex + 1;
        while (endIndex < allLines.length && !allLines[endIndex].includes('`')) {
          promptValue += '\n' + allLines[endIndex];
          endIndex++;
        }
        if (endIndex < allLines.length) {
          const endLine = allLines[endIndex];
          promptValue += '\n' + endLine.substring(0, endLine.indexOf('`'));
        }
        
        matches.push({
          key: promptMatch[1],
          value: promptValue,
          type: 'string',
          file,
          line: lineNumber,
          context: this.getContext(allLines, currentIndex)
        });
      }
    }

    return matches;
  }

  /**
   * Check if a configuration value is relevant to the query
   */
  private isRelevantToQuery(key: string, value: any, query: string): boolean {
    const lowerQuery = query.toLowerCase();
    const lowerKey = key.toLowerCase();
    
    // Always include some key configuration types
    if (lowerKey.includes('token') || lowerKey.includes('max') || lowerKey.includes('limit') || 
        lowerKey.includes('timeout') || lowerKey.includes('voice') || lowerKey.includes('prompt') ||
        lowerKey.includes('humor') || lowerKey.includes('sentence') || lowerKey.includes('response')) {
      return true;
    }

    // Check if query mentions this key
    if (lowerQuery.includes(lowerKey) || lowerQuery.includes(key.replace('_', ' '))) {
      return true;
    }

    // Check if value contains query terms
    if (typeof value === 'string' && value.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    return false;
  }

  /**
   * Get context around a line
   */
  private getContext(lines: string[], index: number): string {
    const start = Math.max(0, index - 2);
    const end = Math.min(lines.length, index + 3);
    return lines.slice(start, end).join('\n');
  }

  /**
   * Generate a summary of extracted configurations
   */
  private generateSummary(configs: ConfigValue[], constants: ConfigValue[], prompts: ConfigValue[], envVars: ConfigValue[], query: string): string {
    const total = configs.length + constants.length + prompts.length + envVars.length;
    
    if (total === 0) {
      return `No configuration values found relevant to "${query}".`;
    }

    const summary = [`Found ${total} configuration items for "${query}":`];
    
    if (configs.length > 0) {
      summary.push(`• ${configs.length} configuration properties`);
      const keyConfigs = configs.filter(c => 
        c.key.includes('token') || c.key.includes('max') || c.key.includes('timeout') || 
        c.key.includes('limit') || c.key.includes('length')
      );
      if (keyConfigs.length > 0) {
        summary.push(`  - Key settings: ${keyConfigs.map(c => `${c.key}=${c.value}`).join(', ')}`);
      }
    }
    
    if (constants.length > 0) {
      summary.push(`• ${constants.length} constants/static values`);
    }
    
    if (prompts.length > 0) {
      summary.push(`• ${prompts.length} prompts/voice patterns`);
    }
    
    if (envVars.length > 0) {
      summary.push(`• ${envVars.length} environment variables/tokens`);
    }

    return summary.join('\n');
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Extract specific configuration value by key
   */
  async extractSpecificValue(files: string[], configKey: string): Promise<ConfigValue | null> {
    for (const file of files) {
      try {
        if (await this.fileExists(file)) {
          const content = await fs.readFile(file, 'utf-8');
          const lines = content.split('\n');
          
          for (let i = 0; i < lines.length; i++) {
            const matches = this.extractConfigValues(lines[i], file, i + 1, lines, i);
            const found = matches.find(m => 
              m.key === configKey || 
              m.key.toLowerCase() === configKey.toLowerCase() ||
              m.key.replace('_', '').toLowerCase() === configKey.replace('_', '').toLowerCase()
            );
            if (found) {
              return found;
            }
          }
        }
      } catch (error) {
        console.error(`[ConfigurationExtractor] Error reading ${file}:`, error);
      }
    }
    
    return null;
  }
}