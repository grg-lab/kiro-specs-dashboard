/**
 * Velocity Migration Utility
 * 
 * Scans existing spec files and Git history to populate velocity data
 * for tasks that were completed before the extension was installed.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { StateManager } from './stateManager';
import { VelocityCalculator } from './velocityCalculator';

const execAsync = promisify(exec);

interface GitCommit {
    hash: string;
    author: string;
    authorEmail: string;
    date: Date;
    message: string;
}

interface TaskChange {
    specName: string;
    taskLine: number;
    wasCompleted: boolean;
    isCompleted: boolean;
    isRequired: boolean;
    taskText?: string;  // Task content for stable identification
    commit: GitCommit;
}

/**
 * Migrate existing completed tasks to velocity data
 */
export async function migrateVelocityData(
    workspaceFolders: readonly vscode.WorkspaceFolder[],
    stateManager: StateManager,
    velocityCalculator: VelocityCalculator,
    outputChannel: vscode.OutputChannel
): Promise<{ tasksProcessed: number; specsProcessed: number; authors: Set<string> }> {
    outputChannel.appendLine(`[${new Date().toISOString()}] Starting velocity data migration...`);
    outputChannel.appendLine(`[${new Date().toISOString()}] Resetting existing velocity data...`);
    
    // Reset velocity data to ensure clean import
    await velocityCalculator.resetVelocityData();
    
    outputChannel.appendLine(`[${new Date().toISOString()}] Current date: ${new Date().toISOString()}`);
    
    const stats = {
        tasksProcessed: 0,
        specsProcessed: 0,
        authors: new Set<string>()
    };
    
    // Track week distribution for summary
    const weekDistribution = new Map<string, number>();
    
    // Track last completion for each task (taskKey -> completion info)
    interface TaskCompletion {
        specName: string;
        taskLine: number;
        isRequired: boolean;
        date: Date;
        author: string;
        authorEmail?: string;
    }
    const lastCompletions = new Map<string, TaskCompletion>();

    for (const folder of workspaceFolders) {
        const specsPath = path.join(folder.uri.fsPath, '.kiro', 'specs');
        
        try {
            const specDirs = await vscode.workspace.fs.readDirectory(vscode.Uri.file(specsPath));
            
            for (const [specName, fileType] of specDirs) {
                if (fileType !== vscode.FileType.Directory) {
                    continue;
                }
                
                const tasksPath = path.join(specsPath, specName, 'tasks.md');
                
                try {
                    // Check if tasks.md exists
                    await vscode.workspace.fs.stat(vscode.Uri.file(tasksPath));
                    
                    outputChannel.appendLine(`[${new Date().toISOString()}] Processing spec: ${specName}`);
                    
                    // Get Git history for this tasks.md file
                    const taskChanges = await analyzeTaskHistory(tasksPath, specName, folder.uri.fsPath, outputChannel);
                    
                    if (taskChanges.length > 0) {
                        // Collect all completions and track only the last one for each task
                        // Use task content hash as key to handle line number changes
                        for (const change of taskChanges) {
                            if (!change.wasCompleted && change.isCompleted) {
                                // Task was marked as completed
                                // Create a stable key using spec name and task content (first 100 chars)
                                // This handles cases where tasks move to different lines
                                const taskContent = change.taskText?.substring(0, 100) || '';
                                const taskKey = `${change.specName}:${taskContent}`;
                                
                                // Check if we already have a completion for this task
                                const existing = lastCompletions.get(taskKey);
                                
                                if (!existing || change.commit.date > existing.date) {
                                    // This is the first completion or a more recent one
                                    lastCompletions.set(taskKey, {
                                        specName: change.specName,
                                        taskLine: change.taskLine,
                                        isRequired: change.isRequired,
                                        date: change.commit.date,
                                        author: change.commit.author,
                                        authorEmail: change.commit.authorEmail
                                    });
                                    
                                    outputChannel.appendLine(
                                        `[${new Date().toISOString()}] Tracking completion: ${taskKey.substring(0, 80)}, date: ${change.commit.date.toISOString()}, author: ${change.commit.author}`
                                    );
                                }
                            }
                        }
                        
                        // Track spec completion by analyzing when all tasks were done
                        const currentContent = await vscode.workspace.fs.readFile(vscode.Uri.file(tasksPath));
                        const content = Buffer.from(currentContent).toString('utf8');
                        const taskStats = countTasks(content);
                        
                        if (taskChanges.length > 0 && taskStats.total > 0) {
                            // Find the last task completion that brought the spec to 100%
                            // Sort task changes by date
                            const sortedChanges = [...taskChanges].sort((a, b) => 
                                a.commit.date.getTime() - b.commit.date.getTime()
                            );
                            
                            // Track cumulative completions
                            let completedSoFar = 0;
                            let specCompletionCommit: typeof sortedChanges[0]['commit'] | null = null;
                            
                            for (const change of sortedChanges) {
                                if (!change.wasCompleted && change.isCompleted) {
                                    completedSoFar++;
                                    
                                    // Check if this completion brought us to 100%
                                    if (completedSoFar === taskStats.total) {
                                        specCompletionCommit = change.commit;
                                        break;
                                    }
                                }
                            }
                            
                            // If we found when the spec was completed, record it
                            if (specCompletionCommit) {
                                outputChannel.appendLine(
                                    `[${new Date().toISOString()}] Spec ${specName} completed on ${specCompletionCommit.date.toISOString()} by ${specCompletionCommit.author}`
                                );
                                
                                await velocityCalculator.recordSpecCompletion(
                                    specName,
                                    taskStats.total,
                                    taskStats.total,
                                    specCompletionCommit.date,
                                    specCompletionCommit.author,
                                    specCompletionCommit.authorEmail
                                );
                                stats.specsProcessed++;
                            }
                        }
                        
                        outputChannel.appendLine(
                            `[${new Date().toISOString()}] Processed ${taskChanges.length} task changes for ${specName}`
                        );
                    }
                } catch (error) {
                    // tasks.md doesn't exist or error reading it
                    outputChannel.appendLine(
                        `[${new Date().toISOString()}] Skipping ${specName}: ${error}`
                    );
                }
            }
        } catch (error) {
            outputChannel.appendLine(
                `[${new Date().toISOString()}] Error scanning specs folder: ${error}`
            );
        }
    }
    
    // Process uncommitted changes (working directory vs last commit)
    outputChannel.appendLine(`[${new Date().toISOString()}] Checking for uncommitted task completions...`);
    
    for (const folder of workspaceFolders) {
        const specsPath = path.join(folder.uri.fsPath, '.kiro', 'specs');
        
        try {
            const specDirs = await vscode.workspace.fs.readDirectory(vscode.Uri.file(specsPath));
            
            for (const [specName, fileType] of specDirs) {
                if (fileType !== vscode.FileType.Directory) {
                    continue;
                }
                
                const tasksPath = path.join(specsPath, specName, 'tasks.md');
                
                try {
                    // Check if tasks.md exists
                    await vscode.workspace.fs.stat(vscode.Uri.file(tasksPath));
                    
                    // Get current working directory content
                    const currentContent = await vscode.workspace.fs.readFile(vscode.Uri.file(tasksPath));
                    const currentText = Buffer.from(currentContent).toString('utf8');
                    
                    // Get last committed version
                    let lastCommittedText = '';
                    try {
                        const { stdout } = await execAsync(
                            `git show HEAD:"${path.relative(folder.uri.fsPath, tasksPath)}"`,
                            { cwd: folder.uri.fsPath, timeout: 10000 }
                        );
                        lastCommittedText = stdout;
                    } catch (error) {
                        // File might not be in Git yet, treat as all new
                        outputChannel.appendLine(
                            `[${new Date().toISOString()}] ${specName}/tasks.md not in Git yet, treating all completed tasks as uncommitted`
                        );
                    }
                    
                    // Find tasks that are completed now but weren't in last commit
                    const uncommittedCompletions = findUncommittedCompletions(
                        lastCommittedText,
                        currentText,
                        specName
                    );
                    
                    outputChannel.appendLine(
                        `[${new Date().toISOString()}] Uncommitted completions check for ${specName}:`
                    );
                    outputChannel.appendLine(
                        `  - Last committed text length: ${lastCommittedText.length} chars`
                    );
                    outputChannel.appendLine(
                        `  - Current text length: ${currentText.length} chars`
                    );
                    outputChannel.appendLine(
                        `  - Found ${uncommittedCompletions.length} uncommitted completions`
                    );
                    
                    if (uncommittedCompletions.length > 0) {
                        outputChannel.appendLine(
                            `[${new Date().toISOString()}] Found ${uncommittedCompletions.length} uncommitted task completions in ${specName}`
                        );
                        outputChannel.appendLine(
                            `  Uncommitted task lines: ${uncommittedCompletions.map(t => t.line).join(', ')}`
                        );
                        
                        // Get current user info
                        const { getFileAuthor } = await import('./gitUtils');
                        const author = await getFileAuthor(tasksPath);
                        const authorName = author?.name || 'unknown';
                        
                        // Add uncommitted completions to lastCompletions map
                        // Only add if not already in Git history
                        for (const task of uncommittedCompletions) {
                            // Use task content for stable identification
                            const taskContent = task.content?.substring(0, 100) || `line-${task.line}`;
                            const taskKey = `${specName}:${taskContent}`;
                            
                            // Check if we already have a completion for this task from Git history
                            const existing = lastCompletions.get(taskKey);
                            
                            if (!existing) {
                                // This task was completed but never committed
                                const today = new Date();
                                lastCompletions.set(taskKey, {
                                    specName,
                                    taskLine: task.line,
                                    isRequired: task.isRequired,
                                    date: today,
                                    author: authorName,
                                    authorEmail: author?.email
                                });
                                
                                outputChannel.appendLine(
                                    `[${new Date().toISOString()}] Tracking uncommitted completion: ${taskKey.substring(0, 80)}, author: ${authorName}`
                                );
                            } else {
                                outputChannel.appendLine(
                                    `[${new Date().toISOString()}] Skipping uncommitted task ${taskKey.substring(0, 80)} - already tracked from Git history (author: ${existing.author})`
                                );
                            }
                        }
                    }
                } catch (error) {
                    // tasks.md doesn't exist or error reading it
                    outputChannel.appendLine(
                        `[${new Date().toISOString()}] Error checking uncommitted changes for ${specName}: ${error}`
                    );
                }
            }
        } catch (error) {
            outputChannel.appendLine(
                `[${new Date().toISOString()}] Error scanning specs folder for uncommitted changes: ${error}`
            );
        }
    }
    
    // Now record all the last completions
    outputChannel.appendLine(
        `[${new Date().toISOString()}] Recording ${lastCompletions.size} unique task completions (last completion only)...`
    );
    outputChannel.appendLine(
        `[${new Date().toISOString()}] Breakdown by author:`
    );
    
    // Count by author for debugging
    const authorCounts = new Map<string, number>();
    for (const [_, completion] of lastCompletions) {
        authorCounts.set(completion.author, (authorCounts.get(completion.author) || 0) + 1);
    }
    for (const [author, count] of authorCounts) {
        outputChannel.appendLine(`  - ${author}: ${count} tasks`);
    }
    
    for (const [taskKey, completion] of lastCompletions) {
        const weekStart = new Date(completion.date);
        const day = weekStart.getDay();
        const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
        weekStart.setDate(diff);
        weekStart.setHours(0, 0, 0, 0);
        
        // Track week distribution
        const weekKey = weekStart.toISOString().split('T')[0];
        weekDistribution.set(weekKey, (weekDistribution.get(weekKey) || 0) + 1);
        
        outputChannel.appendLine(
            `[${new Date().toISOString()}] Recording final task: ${completion.specName}, line ${completion.taskLine}, date: ${completion.date.toISOString()}, author: ${completion.author}`
        );
        
        await velocityCalculator.recordTaskCompletion(
            completion.specName,
            `line-${completion.taskLine}`,
            completion.isRequired,
            completion.date,
            undefined,
            completion.author,
            completion.authorEmail
        );
        
        stats.tasksProcessed++;
        stats.authors.add(completion.author);
    }
    
    outputChannel.appendLine(
        `[${new Date().toISOString()}] Migration complete: ${stats.tasksProcessed} tasks, ${stats.specsProcessed} specs, ${stats.authors.size} authors`
    );
    outputChannel.appendLine(`[${new Date().toISOString()}] Authors: ${Array.from(stats.authors).join(', ')}`);
    
    // Show week distribution
    if (weekDistribution.size > 0) {
        outputChannel.appendLine(`[${new Date().toISOString()}] Week distribution:`);
        const sortedWeeks = Array.from(weekDistribution.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        for (const [week, count] of sortedWeeks) {
            outputChannel.appendLine(`  Week of ${week}: ${count} tasks`);
        }
    }
    
    return stats;
}

/**
 * Analyze Git history for a tasks.md file to find task completions
 */
async function analyzeTaskHistory(
    filePath: string,
    specName: string,
    workspaceRoot: string,
    outputChannel: vscode.OutputChannel
): Promise<TaskChange[]> {
    const changes: TaskChange[] = [];
    
    try {
        // Get all commits that modified this file
        const { stdout: logOutput } = await execAsync(
            `git log --format="%H|%an|%ae|%aI|%s" --follow -- "${filePath}"`,
            { cwd: workspaceRoot, timeout: 30000 }
        );
        
        if (!logOutput.trim()) {
            return changes;
        }
        
        const commits = logOutput.trim().split('\n').map(line => {
            const [hash, author, authorEmail, dateStr, ...messageParts] = line.split('|');
            return {
                hash,
                author,
                authorEmail,
                date: new Date(dateStr),
                message: messageParts.join('|')
            };
        }).reverse(); // Process oldest to newest
        
        // Get the diff for each commit to find task checkbox changes
        let previousContent = '';
        
        for (const commit of commits) {
            try {
                // Get file content at this commit
                const { stdout: content } = await execAsync(
                    `git show ${commit.hash}:"${path.relative(workspaceRoot, filePath)}"`,
                    { cwd: workspaceRoot, timeout: 10000 }
                );
                
                // Compare with previous version to find checkbox changes
                const taskChangesInCommit = findTaskCheckboxChanges(
                    previousContent,
                    content,
                    specName,
                    commit
                );
                
                changes.push(...taskChangesInCommit);
                previousContent = content;
            } catch (error) {
                // File might not exist in this commit
                outputChannel.appendLine(
                    `[${new Date().toISOString()}] Could not get content for commit ${commit.hash}: ${error}`
                );
            }
        }
    } catch (error) {
        outputChannel.appendLine(
            `[${new Date().toISOString()}] Error analyzing Git history for ${filePath}: ${error}`
        );
    }
    
    return changes;
}

/**
 * Find task checkbox changes between two versions of tasks.md
 */
function findTaskCheckboxChanges(
    oldContent: string,
    newContent: string,
    specName: string,
    commit: GitCommit
): TaskChange[] {
    const changes: TaskChange[] = [];
    
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    
    // Compare line by line
    const maxLines = Math.max(oldLines.length, newLines.length);
    
    for (let i = 0; i < maxLines; i++) {
        const oldLine = oldLines[i] || '';
        const newLine = newLines[i] || '';
        
        // Check if both lines are task checkboxes
        const oldMatch = oldLine.match(/^(\s*)-\s*\[([ x])\](\*)?/);
        const newMatch = newLine.match(/^(\s*)-\s*\[([ x])\](\*)?/);
        
        if (oldMatch && newMatch) {
            const wasCompleted = oldMatch[2] === 'x';
            const isCompleted = newMatch[2] === 'x';
            const isOptional = newMatch[3] === '*';
            
            // Extract task text (everything after the checkbox)
            const taskText = newLine.replace(/^(\s*)-\s*\[([ x])\](\*)?/, '').trim();
            
            // Only record if checkbox state changed
            if (wasCompleted !== isCompleted) {
                changes.push({
                    specName,
                    taskLine: i,
                    wasCompleted,
                    isCompleted,
                    isRequired: !isOptional,
                    taskText,
                    commit
                });
            }
        } else if (!oldMatch && newMatch) {
            // New task added (if it's already completed, record it)
            const isCompleted = newMatch[2] === 'x';
            const isOptional = newMatch[3] === '*';
            
            // Extract task text
            const taskText = newLine.replace(/^(\s*)-\s*\[([ x])\](\*)?/, '').trim();
            
            if (isCompleted) {
                changes.push({
                    specName,
                    taskLine: i,
                    wasCompleted: false,
                    isCompleted: true,
                    isRequired: !isOptional,
                    taskText,
                    commit
                });
            }
        }
    }
    
    return changes;
}

/**
 * Count tasks in tasks.md content
 */
function countTasks(content: string): { total: number; completed: number; required: number; optional: number } {
    const lines = content.split('\n');
    let total = 0;
    let completed = 0;
    let required = 0;
    let optional = 0;
    
    for (const line of lines) {
        const match = line.match(/^(\s*)-\s*\[([ x~-])\](\*)?/);
        if (match) {
            total++;
            const isCompleted = match[2] === 'x';
            const isOptional = match[3] === '*';
            
            if (isCompleted) {
                completed++;
            }
            
            if (isOptional) {
                optional++;
            } else {
                required++;
            }
        }
    }
    
    return { total, completed, required, optional };
}

/**
 * Find tasks that are completed in current content but not in previous content
 * Used to detect uncommitted task completions
 */
function findUncommittedCompletions(
    previousContent: string,
    currentContent: string,
    specName: string
): Array<{ line: number; isRequired: boolean; content: string }> {
    const completions: Array<{ line: number; isRequired: boolean; content: string }> = [];
    
    const previousLines = previousContent.split('\n');
    const currentLines = currentContent.split('\n');
    
    // Compare line by line
    const maxLines = Math.max(previousLines.length, currentLines.length);
    
    for (let i = 0; i < maxLines; i++) {
        const previousLine = previousLines[i] || '';
        const currentLine = currentLines[i] || '';
        
        // Check if both lines are task checkboxes
        const previousMatch = previousLine.match(/^(\s*)-\s*\[([ x~-])\](\*)?/);
        const currentMatch = currentLine.match(/^(\s*)-\s*\[([ x])\](\*)?/);
        
        if (currentMatch) {
            const wasCompleted = previousMatch ? previousMatch[2] === 'x' : false;
            const isCompleted = currentMatch[2] === 'x';
            const isOptional = currentMatch[3] === '*';
            
            // Extract task text
            const taskContent = currentLine.replace(/^(\s*)-\s*\[([ x])\](\*)?/, '').trim();
            
            // Task is completed now but wasn't before (or didn't exist before)
            if (isCompleted && !wasCompleted) {
                completions.push({
                    line: i,
                    isRequired: !isOptional,
                    content: taskContent
                });
            }
        }
    }
    
    return completions;
}
