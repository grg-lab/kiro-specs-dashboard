/**
 * Git utilities for tracking file authors and changes
 */

import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Author information from Git
 */
export interface GitAuthor {
  name: string;
  email: string;
}

/**
 * Get the author of the last commit that modified a specific file
 * 
 * @param filePath Absolute path to the file
 * @returns Author information or null if not in a Git repository
 */
export async function getFileAuthor(filePath: string): Promise<GitAuthor | null> {
  try {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
    if (!workspaceFolder) {
      return null;
    }

    const cwd = workspaceFolder.uri.fsPath;
    
    // Get the last commit author for this file
    const { stdout } = await execAsync(
      `git log -1 --format="%an|%ae" -- "${filePath}"`,
      { cwd, timeout: 5000 }
    );

    const trimmed = stdout.trim();
    if (!trimmed) {
      return null;
    }

    const [name, email] = trimmed.split('|');
    return { name: name || 'Unknown', email: email || '' };
  } catch (error) {
    // Not a git repository or git not available
    return null;
  }
}

/**
 * Get the current Git user configuration
 * 
 * @param workspacePath Workspace folder path
 * @returns Current user's Git configuration
 */
export async function getCurrentGitUser(workspacePath: string): Promise<GitAuthor | null> {
  try {
    const { stdout: nameOut } = await execAsync('git config user.name', { 
      cwd: workspacePath,
      timeout: 5000 
    });
    const { stdout: emailOut } = await execAsync('git config user.email', { 
      cwd: workspacePath,
      timeout: 5000 
    });

    const name = nameOut.trim();
    const email = emailOut.trim();

    if (!name) {
      return null;
    }

    return { name, email };
  } catch (error) {
    return null;
  }
}

/**
 * Check if a path is in a Git repository
 * 
 * @param path Path to check
 * @returns True if in a Git repository
 */
export async function isGitRepository(path: string): Promise<boolean> {
  try {
    await execAsync('git rev-parse --git-dir', { 
      cwd: path,
      timeout: 5000 
    });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get all unique authors who have contributed to files in a directory
 * 
 * @param dirPath Directory path to scan
 * @returns List of unique authors
 */
export async function getDirectoryAuthors(dirPath: string): Promise<GitAuthor[]> {
  try {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(dirPath));
    if (!workspaceFolder) {
      return [];
    }

    const cwd = workspaceFolder.uri.fsPath;
    
    // Get all authors who have committed to this directory
    const { stdout } = await execAsync(
      `git log --format="%an|%ae" -- "${dirPath}" | sort -u`,
      { cwd, timeout: 10000 }
    );

    const lines = stdout.trim().split('\n').filter(line => line);
    const authors: GitAuthor[] = [];
    const seen = new Set<string>();

    for (const line of lines) {
      const [name, email] = line.split('|');
      const key = `${name}|${email}`;
      if (!seen.has(key) && name) {
        seen.add(key);
        authors.push({ name, email: email || '' });
      }
    }

    return authors;
  } catch (error) {
    return [];
  }
}
