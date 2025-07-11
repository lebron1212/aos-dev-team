/**
 * Smart file discovery system for targeted code analysis and modifications
 */

interface FeatureMapping {
  files: string[];
  patterns: string[];
  configKeys: string[];
}

export class FileMapper {
  private static readonly FEATURE_FILE_MAP: Record<string, FeatureMapping> = {
    'commander_voice': {
      files: ['src/agents/commander/communication/VoiceSystem.ts', 'src/agents/commander/intelligence/FeedbackLearningSystem.ts'],
      patterns: ['COMMANDER_VOICE_PROMPT', 'max_tokens', 'humor', 'voice', 'prompt'],
      configKeys: ['max_tokens', 'voice_prompt', 'humor_level', 'response_length']
    },
    'api_limits': {
      files: ['src/agents/commander/communication/VoiceSystem.ts', 'src/agents/architect/intelligence/CodeAnalyzer.ts', 'src/agents/commander/core/UniversalRouter.ts'],
      patterns: ['max_tokens', 'timeout', 'limit', 'api', 'claude', 'anthropic'],
      configKeys: ['max_tokens', 'timeout', 'api_timeout', 'rate_limit']
    },
    'discord': {
      files: ['src/agents/commander/communication/DiscordInterface.ts', 'src/agents/commander/Commander.ts', 'src/agents/architect/communication/ArchitectDiscord.ts'],
      patterns: ['discord', 'bot', 'channel', 'guild', 'message'],
      configKeys: ['discord_token', 'channel_id', 'guild_id']
    },
    'feedback': {
      files: ['src/agents/commander/intelligence/FeedbackLearningSystem.ts', 'src/agents/watcher/comwatch/ComWatch.ts'],
      patterns: ['feedback', 'learning', 'reaction', 'training', 'improvement'],
      configKeys: ['feedback_threshold', 'learning_rate', 'reaction_tracking']
    },
    'agents': {
      files: ['src/agents/commander/core/AgentOrchestrator.ts', 'src/agents/commander/core/BotOrchestrator.ts', 'src/agents/architect/operations/AgentBuilder.ts'],
      patterns: ['agent', 'orchestrator', 'delegation', 'routing'],
      configKeys: ['agent_config', 'orchestrator_settings']
    },
    'architect': {
      files: ['src/agents/architect/communication/ArchitectVoice.ts', 'src/agents/architect/core/ArchitectOrchestrator.ts', 'src/agents/architect/core/UniversalAnalyzer.ts'],
      patterns: ['architect', 'analysis', 'modification', 'system'],
      configKeys: ['architect_voice', 'analysis_depth', 'modification_settings']
    }
  };

  /**
   * Discover relevant files for a specific feature or query
   */
  static discoverFiles(query: string): string[] {
    const lowerQuery = query.toLowerCase();
    const relevantFiles = new Set<string>();

    // Direct feature matching
    for (const [feature, mapping] of Object.entries(this.FEATURE_FILE_MAP)) {
      if (lowerQuery.includes(feature.replace('_', ' ')) || 
          mapping.patterns.some(pattern => lowerQuery.includes(pattern.toLowerCase()))) {
        mapping.files.forEach(file => relevantFiles.add(file));
      }
    }

    // Keyword-based discovery
    if (lowerQuery.includes('commander') || lowerQuery.includes('voice') || lowerQuery.includes('humor')) {
      this.FEATURE_FILE_MAP.commander_voice.files.forEach(file => relevantFiles.add(file));
    }

    if (lowerQuery.includes('token') || lowerQuery.includes('limit') || lowerQuery.includes('timeout')) {
      this.FEATURE_FILE_MAP.api_limits.files.forEach(file => relevantFiles.add(file));
    }

    if (lowerQuery.includes('feedback') || lowerQuery.includes('learning') || lowerQuery.includes('reaction')) {
      this.FEATURE_FILE_MAP.feedback.files.forEach(file => relevantFiles.add(file));
    }

    if (lowerQuery.includes('discord') || lowerQuery.includes('bot') || lowerQuery.includes('channel')) {
      this.FEATURE_FILE_MAP.discord.files.forEach(file => relevantFiles.add(file));
    }

    // If no specific matches, return core files for general queries
    if (relevantFiles.size === 0) {
      relevantFiles.add('src/agents/commander/communication/VoiceSystem.ts');
      relevantFiles.add('src/agents/architect/core/UniversalAnalyzer.ts');
      relevantFiles.add('src/agents/commander/core/UniversalRouter.ts');
    }

    return Array.from(relevantFiles);
  }

  /**
   * Get configuration keys that might be relevant to a query
   */
  static getRelevantConfigKeys(query: string): string[] {
    const lowerQuery = query.toLowerCase();
    const configKeys = new Set<string>();

    for (const [feature, mapping] of Object.entries(this.FEATURE_FILE_MAP)) {
      if (lowerQuery.includes(feature.replace('_', ' ')) || 
          mapping.patterns.some(pattern => lowerQuery.includes(pattern.toLowerCase()))) {
        mapping.configKeys.forEach(key => configKeys.add(key));
      }
    }

    return Array.from(configKeys);
  }

  /**
   * Get all available features and their descriptions
   */
  static getAvailableFeatures(): Record<string, string> {
    return {
      'commander_voice': 'Commander personality, humor settings, response length, voice prompts',
      'api_limits': 'Token limits, API timeouts, rate limiting, Claude API settings',
      'discord': 'Discord bot integration, channels, message handling',
      'feedback': 'Learning system, feedback reactions, training patterns',
      'agents': 'Agent creation, orchestration, delegation logic',
      'architect': 'Architect system analysis, modifications, behavior'
    };
  }

  /**
   * Analyze a query and return the most relevant feature
   */
  static identifyFeature(query: string): string | null {
    const lowerQuery = query.toLowerCase();
    
    // Score each feature based on keyword matches
    const scores: Record<string, number> = {};
    
    for (const [feature, mapping] of Object.entries(this.FEATURE_FILE_MAP)) {
      let score = 0;
      
      // Direct feature name match
      if (lowerQuery.includes(feature.replace('_', ' '))) {
        score += 10;
      }
      
      // Pattern matches
      mapping.patterns.forEach(pattern => {
        if (lowerQuery.includes(pattern.toLowerCase())) {
          score += 3;
        }
      });
      
      // Config key matches
      mapping.configKeys.forEach(key => {
        if (lowerQuery.includes(key.replace('_', ' '))) {
          score += 2;
        }
      });
      
      if (score > 0) {
        scores[feature] = score;
      }
    }
    
    // Return the highest scoring feature
    if (Object.keys(scores).length === 0) return null;
    
    return Object.entries(scores)
      .sort(([,a], [,b]) => b - a)[0][0];
  }
}