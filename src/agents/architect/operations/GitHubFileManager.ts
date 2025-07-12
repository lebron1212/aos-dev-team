import { Octokit } from '@octokit/rest';
import * as fs from 'fs/promises';

interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  branch?: string;
}

interface FileOperation {
  path: string;
  content: string;
  message: string;
  sha?: string;
}

export class GitHubFileManager {
  private octokit: Octokit;
  private config: GitHubConfig;

  constructor(config: GitHubConfig) {
    this.config = {
      branch: 'main',
      ...config
    };
    this.octokit = new Octokit({
      auth: this.config.token
    });
  }

  async getFile(path: string): Promise<{ content: string; sha: string } | null> {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner: this.config.owner,
        repo: this.config.repo,
        path,
        ref: this.config.branch
      });

      if ('content' in response.data) {
        return {
          content: Buffer.from(response.data.content, 'base64').toString('utf-8'),
          sha: response.data.sha
        };
      }
      return null;
    } catch (error) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async createFile(operation: FileOperation): Promise<string> {
    const response = await this.octokit.rest.repos.createFile({
      owner: this.config.owner,
      repo: this.config.repo,
      path: operation.path,
      message: operation.message,
      content: Buffer.from(operation.content).toString('base64'),
      branch: this.config.branch
    });

    return response.data.commit.sha;
  }

  async updateFile(operation: FileOperation): Promise<string> {
    if (!operation.sha) {
      throw new Error('SHA is required for file updates');
    }

    const response = await this.octokit.rest.repos.createFile({
      owner: this.config.owner,
      repo: this.config.repo,
      path: operation.path,
      message: operation.message,
      content: Buffer.from(operation.content).toString('base64'),
      sha: operation.sha,
      branch: this.config.branch
    });

    return response.data.commit.sha;
  }

  async deleteFile(path: string, message: string): Promise<string> {
    const file = await this.getFile(path);
    if (!file) {
      throw new Error(`File ${path} not found`);
    }

    const response = await this.octokit.rest.repos.deleteFile({
      owner: this.config.owner,
      repo: this.config.repo,
      path,
      message,
      sha: file.sha,
      branch: this.config.branch
    });

    return response.data.commit.sha;
  }

  async createOrUpdateFile(operation: FileOperation): Promise<string> {
    const existingFile = await this.getFile(operation.path);
    
    if (existingFile) {
      return await this.updateFile({
        ...operation,
        sha: existingFile.sha
      });
    } else {
      return await this.createFile(operation);
    }
  }

  async listFiles(path: string = ''): Promise<Array<{ name: string; path: string; type: string }>> {
    const response = await this.octokit.rest.repos.getContent({
      owner: this.config.owner,
      repo: this.config.repo,
      path,
      ref: this.config.branch
    });

    if (Array.isArray(response.data)) {
      return response.data.map(item => ({
        name: item.name,
        path: item.path,
        type: item.type
      }));
    }

    return [];
  }

  async syncLocalToGitHub(localPath: string, githubPath: string, message: string): Promise<string[]> {
    const results: string[] = [];
    
    try {
      const stats = await fs.stat(localPath);
      
      if (stats.isFile()) {
        const content = await fs.readFile(localPath, 'utf-8');
        const sha = await this.createOrUpdateFile({
          path: githubPath,
          content,
          message
        });
        results.push(`Synced ${githubPath}: ${sha}`);
      } else if (stats.isDirectory()) {
        const files = await fs.readdir(localPath);
        
        for (const file of files) {
          const localFilePath = `${localPath}/${file}`;
          const githubFilePath = `${githubPath}/${file}`;
          const subResults = await this.syncLocalToGitHub(localFilePath, githubFilePath, message);
          results.push(...subResults);
        }
      }
    } catch (error) {
      console.error(`Failed to sync ${localPath}:`, error);
      results.push(`Error syncing ${localPath}: ${error.message}`);
    }
    
    return results;
  }
}
