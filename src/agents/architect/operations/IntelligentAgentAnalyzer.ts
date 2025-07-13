import Anthropic from '@anthropic-ai/sdk';

interface AgentPurposeAnalysis {
  agentName: string;
  corePurpose: string;
  specificCapabilities: string[];
  interactionPatterns: string[];
  responseTypes: string[];
  dataNeeds: string[];
  integrationNeeds: string[];
  learningAspects: string[];
  clarifyingQuestions: string[];
  readyToBuild: boolean;
  confidence: number;
}

export class IntelligentAgentAnalyzer {
  private claude: Anthropic;
  private analysisHistory: Map<string, AgentPurposeAnalysis> = new Map();

  constructor(claudeApiKey: string) {
    this.claude = new Anthropic({ apiKey: claudeApiKey });
  }

  async analyzeAgentPurpose(request: string, previousAnswers?: Record<string, string>): Promise<AgentPurposeAnalysis> {
    console.log(`[IntelligentAgentAnalyzer] Analyzing agent purpose: ${request}`);

    try {
      const response = await this.claude.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: `You are an expert AI agent architect. Analyze this agent creation request to understand EXACTLY what the agent needs to do.

AGENT REQUEST: "${request}"

${previousAnswers ? `PREVIOUS CLARIFICATIONS: ${JSON.stringify(previousAnswers)}` : ''}

Your job is to understand the agent's specific purpose and determine what code capabilities it needs.

ANALYSIS FRAMEWORK:

1. **Agent Identity**: What should this agent be called? (TestBot, MonitorBot, DeployBot, etc.)

2. **Core Purpose**: What is this agent's primary job? Be specific.

3. **Specific Capabilities**: What exact functions does it need?
   - For "ping responses" → respond to ping messages, health checks
   - For "monitoring" → check system status, send alerts, track metrics
   - For "deployment" → deploy code, manage environments, run tests

4. **Interaction Patterns**: How do users interact with it?
   - Simple command/response
   - Complex workflows with multiple steps
   - Continuous monitoring with alerts
   - File uploads and processing

5. **Response Types**: What kinds of responses does it give?
   - Simple text responses
   - Rich embeds with data
   - File attachments
   - Status updates

6. **Data Needs**: What data does it work with?
   - User messages only
   - External APIs
   - File systems
   - Databases

7. **Integration Needs**: What external services?
   - GitHub, Railway, monitoring tools
   - Custom APIs
   - Third-party services

8. **Learning Aspects**: How should it improve?
   - Response quality based on user reactions
   - Better understanding of specific domain
   - Pattern recognition for its use case

Respond with JSON:
{
  "agentName": "ProperAgentName",
  "corePurpose": "Specific primary function",
  "specificCapabilities": ["capability1", "capability2"],
  "interactionPatterns": ["how users interact"],
  "responseTypes": ["what kinds of responses"],
  "dataNeeds": ["what data it works with"],
  "integrationNeeds": ["external services needed"],
  "learningAspects": ["how it should improve"],
  "clarifyingQuestions": ["question1", "question2"] or [],
  "readyToBuild": true/false,
  "confidence": 0.0-1.0
}

If you need clarification, set readyToBuild to false and provide 1-3 specific questions.
If the request is clear enough, set readyToBuild to true.

EXAMPLES:

Request: "TestBot for ping responses"
- agentName: "TestBot"  
- corePurpose: "Respond to ping messages to verify system is online"
- specificCapabilities: ["respond to ping", "health status check", "uptime reporting"]
- readyToBuild: true

Request: "monitoring agent"
- readyToBuild: false
- clarifyingQuestions: ["What specifically should it monitor?", "How should it alert you?", "What metrics matter most?"]

Request: "agent for customer support"
- readyToBuild: false  
- clarifyingQuestions: ["What type of support requests?", "Should it escalate to humans?", "What knowledge base should it use?"]`
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        try {
          let jsonText = content.text.trim();
          
          // Extract JSON from response
          const jsonStart = jsonText.indexOf('{');
          const jsonEnd = jsonText.lastIndexOf('}') + 1;
          
          if (jsonStart !== -1 && jsonEnd > jsonStart) {
            jsonText = jsonText.substring(jsonStart, jsonEnd);
          }
          
          const analysis = JSON.parse(jsonText);
          
          // Store analysis for potential follow-up
          this.analysisHistory.set(analysis.agentName, analysis);
          
          console.log(`[IntelligentAgentAnalyzer] Analysis complete - Ready to build: ${analysis.readyToBuild}`);
          
          return analysis;
          
        } catch (parseError) {
          console.error('[IntelligentAgentAnalyzer] JSON parsing failed:', parseError);
          return this.createFallbackAnalysis(request);
        }
      }
    } catch (error) {
      console.error('[IntelligentAgentAnalyzer] Analysis failed:', error);
    }

    return this.createFallbackAnalysis(request);
  }

  async refineAnalysisWithAnswers(agentName: string, answers: Record<string, string>): Promise<AgentPurposeAnalysis> {
    const previousAnalysis = this.analysisHistory.get(agentName);
    if (!previousAnalysis) {
      throw new Error(`No previous analysis found for ${agentName}`);
    }

    console.log(`[IntelligentAgentAnalyzer] Refining analysis for ${agentName} with answers`);

    const combinedRequest = `${previousAnalysis.corePurpose}\n\nAdditional details: ${JSON.stringify(answers)}`;
    return await this.analyzeAgentPurpose(combinedRequest, answers);
  }

  private createFallbackAnalysis(request: string): AgentPurposeAnalysis {
    const agentName = this.extractAgentName(request);
    
    return {
      agentName,
      corePurpose: request,
      specificCapabilities: ['basic-responses'],
      interactionPatterns: ['simple-command-response'],
      responseTypes: ['text-messages'],
      dataNeeds: ['user-messages'],
      integrationNeeds: [],
      learningAspects: ['response-quality'],
      clarifyingQuestions: [
        `What specific tasks should ${agentName} handle?`,
        `How should users interact with ${agentName}?`,
        `What kind of responses should ${agentName} provide?`
      ],
      readyToBuild: false,
      confidence: 0.3
    };
  }

  private extractAgentName(request: string): string {
    const patterns = [
      /named (\w+)/i,
      /(\w+) for/i,
      /(\w+)bot/i,
      /build (\w+)/i,
      /create (\w+)/i,
      /(\w+) agent/i
    ];
    
    for (const pattern of patterns) {
      const match = request.match(pattern);
      if (match && match[1] && match[1].toLowerCase() !== 'agent') {
        const name = match[1].charAt(0).toUpperCase() + match[1].slice(1);
        // Ensure it ends with Bot if it's not already a proper agent name
        if (!name.endsWith('Bot') && !name.endsWith('Agent')) {
          return name + 'Bot';
        }
        return name;
      }
    }
    
    return 'CustomBot';
  }

  getAnalysisHistory(): AgentPurposeAnalysis[] {
    return Array.from(this.analysisHistory.values());
  }

  clearAnalysisHistory(): void {
    this.analysisHistory.clear();
  }
}
