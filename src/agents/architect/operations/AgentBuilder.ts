import { AgentSpec } from '../types/index.js';
import Anthropic from '@anthropic-ai/sdk';

export class AgentBuilder {
  private claude: Anthropic;

  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
  }

  async parseAgentRequirements(request: string): Promise<AgentSpec> {
    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `Parse this agent creation request: "${request}"

Extract agent specifications in JSON format:
{
  "name": "AgentName",
  "purpose": "What this agent does",
  "capabilities": ["capability1", "capability2"],
  "dependencies": ["dependency1", "dependency2"],
  "structure": {
    "core": ["CoreClass.ts"],
    "intelligence": ["Intelligence.ts"],
    "communication": ["Communication.ts"]
  }
}`
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        try {
          return JSON.parse(content.text);
        } catch (parseError) {
          console.error('[AgentBuilder] Failed to parse agent spec:', parseError);
        }
      }
    } catch (error) {
      console.error('[AgentBuilder] Agent spec parsing failed:', error);
    }

    return {
      name: 'CustomAgent',
      purpose: 'Custom functionality',
      capabilities: ['basic-processing'],
      dependencies: ['@anthropic-ai/sdk'],
      structure: {
        core: ['CustomAgent.ts'],
        intelligence: ['CustomIntelligence.ts'],
        communication: ['CustomCommunication.ts']
      }
    };
  }

  async generateAgent(spec: AgentSpec): Promise<any> {
    console.log(`[AgentBuilder] Building agent: ${spec.name}`);
    
    return {
      summary: `Agent ${spec.name} framework created with ${spec.capabilities.length} capabilities`,
      files: [...spec.structure.core, ...spec.structure.intelligence, ...spec.structure.communication],
      capabilities: spec.capabilities,
      ready: true
    };
  }
}
