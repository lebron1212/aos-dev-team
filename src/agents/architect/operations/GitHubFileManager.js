interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

export class GitHubFileManager {
  private config: GitHubConfig;
  private baseUrl = 'https://api.github.com';

  constructor(token: string, owner: string, repo: string) {
    this.config = { token, owner, repo };
  }

  async writeFile(path: string, content: string, message: string): Promise<boolean> {
    try {
      // Check if file exists to get SHA
      let sha: string | undefined;
      try {
        const existingFile = await this.getFile(path);
        sha = existingFile.sha;
      } catch (error) {
        // File doesn't exist, that's fine
      }

      const response = await fetch(
        `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.config.token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
          },
          body: JSON.stringify({
            message,
            content: Buffer.from(content).toString('base64'),
            ...(sha && { sha })
          })
        }
      );

      return response.ok;
    } catch (error) {
      console.error(`[GitHubFileManager] Failed to write ${path}:`, error);
      return false;
    }
  }

  async writeFiles(files: Array<{path: string, content: string}>, message: string): Promise<{success: boolean, commitSha?: string}> {
    try {
      // Get latest commit SHA
      const latestCommit = await this.getLatestCommit();
      if (!latestCommit) return { success: false };

      // Create tree with all files
      const tree = await Promise.all(
        files.map(async (file) => ({
          path: file.path,
          mode: '100644' as const,
          type: 'blob' as const,
          content: file.content
        }))
      );

      // Create new tree
      const treeResponse = await fetch(
        `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/git/trees`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            base_tree: latestCommit.tree.sha,
            tree
          })
        }
      );

      if (!treeResponse.ok) return { success: false };
      const treeData = await treeResponse.json();

      // Create commit
      const commitResponse = await fetch(
        `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/git/commits`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message,
            tree: treeData.sha,
            parents: [latestCommit.sha]
          })
        }
      );

      if (!commitResponse.ok) return { success: false };
      const commitData = await commitResponse.json();

      // Update main branch
      const refResponse = await fetch(
        `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/git/refs/heads/main`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${this.config.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sha: commitData.sha
          })
        }
      );

      return { 
        success: refResponse.ok, 
        commitSha: commitData.sha 
      };

    } catch (error) {
      console.error('[GitHubFileManager] Batch write failed:', error);
      return { success: false };
    }
  }

  async createDirectory(path: string): Promise<boolean> {
    // GitHub creates directories implicitly when files are added
    return true;
  }

  private async getFile(path: string): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`,
      {
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`File not found: ${path}`);
    }

    return await response.json();
  }

  private async getLatestCommit(): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/git/refs/heads/main`,
      {
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    if (!response.ok) return null;
    const refData = await response.json();

    const commitResponse = await fetch(
      `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}/git/commits/${refData.object.sha}`,
      {
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    return commitResponse.ok ? await commitResponse.json() : null;
  }
}
