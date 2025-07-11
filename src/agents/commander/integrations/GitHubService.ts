import { Octokit } from '@octokit/rest';

export interface CreatePRParams {
  repository: 'aurora' | 'aos-dev-team';
  title: string;
  description: string;
  head: string; // source branch
  base: string; // target branch (usually 'main')
  assignees?: string[];
  reviewers?: string[];
  labels?: string[];
  draft?: boolean;
}

export interface PRResult {
  prNumber: number;
  prUrl: string;
}

export class GitHubService {
  private octokit: Octokit;
  private auroraRepo = { owner: 'lebron1212', repo: 'aurora' };
  private devTeamRepo = { owner: 'lebron1212', repo: 'aos-dev-team' };

  constructor(githubToken: string) {
    this.octokit = new Octokit({ auth: githubToken });
  }

  async createPullRequest(params: CreatePRParams): Promise<PRResult> {
    const repo = params.repository === 'aurora' ? this.auroraRepo : this.devTeamRepo;
    
    const prData = {
      ...repo,
      title: params.title,
      body: this.formatPRDescription(params.description, params),
      head: params.head,
      base: params.base || 'main',
      draft: params.draft || false
    };

    const pr = await this.octokit.rest.pulls.create(prData);
    
    // Auto-assign Copilot for AI-assisted review
    await this.assignCopilot(repo, pr.data.number);
    
    // Add additional assignees/reviewers
    if (params.assignees?.length) {
      await this.octokit.rest.issues.addAssignees({
        ...repo,
        issue_number: pr.data.number,
        assignees: params.assignees
      });
    }

    if (params.reviewers?.length) {
      await this.octokit.rest.pulls.requestReviewers({
        ...repo,
        pull_number: pr.data.number,
        reviewers: params.reviewers
      });
    }

    if (params.labels?.length) {
      await this.octokit.rest.issues.addLabels({
        ...repo,
        issue_number: pr.data.number,
        labels: params.labels
      });
    }

    return {
      prNumber: pr.data.number,
      prUrl: pr.data.html_url
    };
  }

  private formatPRDescription(description: string, params: CreatePRParams): string {
    return `${description}

## Details
- **Repository**: ${params.repository}
- **Type**: ${params.labels?.join(', ') || 'General'}
- **Draft**: ${params.draft ? 'Yes' : 'No'}

---
*Created via Commander AI Agent*
*Auto-assigned to @copilot for AI-assisted review*`;
  }

  private async assignCopilot(repo: any, prNumber: number): Promise<void> {
    try {
      // Assign Copilot as reviewer and assignee
      await this.octokit.rest.issues.addAssignees({
        ...repo,
        issue_number: prNumber,
        assignees: ['copilot']
      });

      await this.octokit.rest.pulls.requestReviewers({
        ...repo,
        pull_number: prNumber,
        reviewers: ['copilot']
      });

      console.log(`[GitHubService] Auto-assigned Copilot to PR #${prNumber}`);
    } catch (error) {
      console.warn(`[GitHubService] Failed to assign Copilot to PR #${prNumber}:`, error);
    }
  }

  async createBranch(repository: 'aurora' | 'aos-dev-team', branchName: string, fromBranch: string = 'main'): Promise<void> {
    const repo = repository === 'aurora' ? this.auroraRepo : this.devTeamRepo;
    
    try {
      // Get the SHA of the source branch
      const { data: refData } = await this.octokit.rest.git.getRef({
        ...repo,
        ref: `heads/${fromBranch}`
      });

      // Create new branch
      await this.octokit.rest.git.createRef({
        ...repo,
        ref: `refs/heads/${branchName}`,
        sha: refData.object.sha
      });

      console.log(`[GitHubService] Created branch ${branchName} from ${fromBranch}`);
    } catch (error: any) {
      if (error.status === 422) {
        console.log(`[GitHubService] Branch ${branchName} already exists, continuing...`);
      } else {
        throw error;
      }
    }
  }

  async validateBranchExists(repository: 'aurora' | 'aos-dev-team', branchName: string): Promise<boolean> {
    const repo = repository === 'aurora' ? this.auroraRepo : this.devTeamRepo;
    
    try {
      await this.octokit.rest.git.getRef({
        ...repo,
        ref: `heads/${branchName}`
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}