/**
 * Integration tests for ProfileManager file watcher functionality
 * 
 * Tests external profile file changes detection and merge conflict handling:
 * - Requirement 11.4: Detect external changes to profiles file
 * - Requirement 11.5: Handle merge conflicts gracefully
 */

import { ProfileManager } from './profileManager';
import { ExecutionProfile } from './types';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock output channel
class MockOutputChannel implements vscode.OutputChannel {
  name = 'Test';
  messages: string[] = [];
  
  append(value: string): void {
    this.messages.push(value);
  }
  
  appendLine(value: string): void {
    this.messages.push(value + '\n');
  }
  
  clear(): void {
    this.messages = [];
  }
  
  show(): void {}
  hide(): void {}
  dispose(): void {}
  replace(value: string): void {}
}

describe('ProfileManager - File Watcher Integration', () => {
  let profileManager: ProfileManager;
  let outputChannel: MockOutputChannel;
  let tempDir: string;
  let workspaceFolder: vscode.WorkspaceFolder;

  beforeEach(async () => {
    outputChannel = new MockOutputChannel();
    profileManager = new ProfileManager(outputChannel);
    
    // Create temporary directory for test workspace
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'profile-watcher-test-'));
    
    workspaceFolder = {
      uri: vscode.Uri.file(tempDir),
      name: 'test-workspace',
      index: 0
    };
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should detect external changes to profiles file', async () => {
    // Requirement 11.4
    
    // Step 1: Create initial profiles file
    const profiles = await profileManager.loadProfiles(workspaceFolder);
    expect(profiles.length).toBeGreaterThan(0);
    
    // Step 2: Simulate external modification by directly writing to file
    const profilesPath = path.join(tempDir, '.kiro', 'execution-profiles.json');
    const customProfile: ExecutionProfile = {
      id: 'external-profile',
      name: 'Externally Added Profile',
      icon: 'star',
      promptTemplate: 'This profile was added externally: {{specName}}',
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Read existing file
    const content = await fs.readFile(profilesPath, 'utf-8');
    const profilesFile = JSON.parse(content.split('\n').filter(line => !line.trim().startsWith('//')).join('\n'));
    
    // Add custom profile
    profilesFile.profiles.push(customProfile);
    
    // Write back with formatting
    await fs.writeFile(profilesPath, JSON.stringify(profilesFile, null, 2), 'utf-8');
    
    // Step 3: Reload profiles (simulating what file watcher would trigger)
    const reloadedProfiles = await profileManager.loadProfiles(workspaceFolder);
    
    // Step 4: Verify the external change was detected
    const externalProfile = reloadedProfiles.find(p => p.id === 'external-profile');
    expect(externalProfile).toBeDefined();
    expect(externalProfile?.name).toBe('Externally Added Profile');
    expect(externalProfile?.promptTemplate).toContain('externally');
  });

  test('should handle merge conflicts gracefully', async () => {
    // Requirement 11.5
    
    // Step 1: Create initial profiles file
    await profileManager.loadProfiles(workspaceFolder);
    
    // Step 2: Simulate merge conflict by writing invalid JSON with conflict markers
    const profilesPath = path.join(tempDir, '.kiro', 'execution-profiles.json');
    const conflictedContent = `{
  "version": "1.0.0",
<<<<<<< HEAD
  "profiles": [
    {
      "id": "mvp",
      "name": "MVP (HEAD version)",
      "icon": "rocket",
      "promptTemplate": "Execute MVP tasks",
      "isBuiltIn": true
    }
  ]
=======
  "profiles": [
    {
      "id": "mvp",
      "name": "MVP (incoming version)",
      "icon": "star",
      "promptTemplate": "Execute MVP tasks differently",
      "isBuiltIn": true
    }
  ]
>>>>>>> feature-branch
}`;
    
    await fs.writeFile(profilesPath, conflictedContent, 'utf-8');
    
    // Step 3: Attempt to load profiles (should handle gracefully)
    const profiles = await profileManager.loadProfiles(workspaceFolder);
    
    // Step 4: Verify graceful handling
    // Should fall back to built-in profiles
    expect(profiles.length).toBeGreaterThan(0);
    expect(profiles.some(p => p.id === 'mvp')).toBe(true);
    expect(profiles.some(p => p.id === 'full')).toBe(true);
    
    // Should log error message
    const errorLog = outputChannel.messages.join('');
    expect(errorLog).toContain('Malformed JSON');
    expect(errorLog).toContain('execution-profiles.json');
  });

  test('should handle corrupted JSON gracefully', async () => {
    // Requirement 11.5 (related to merge conflicts)
    
    // Step 1: Create initial profiles file
    await profileManager.loadProfiles(workspaceFolder);
    
    // Step 2: Corrupt the JSON file
    const profilesPath = path.join(tempDir, '.kiro', 'execution-profiles.json');
    const corruptedContent = `{
  "version": "1.0.0",
  "profiles": [
    {
      "id": "mvp",
      "name": "MVP",
      // This is an invalid comment in JSON
      "icon": "rocket"
      "promptTemplate": "Missing comma above"
    }
  ]
}`;
    
    await fs.writeFile(profilesPath, corruptedContent, 'utf-8');
    
    // Step 3: Attempt to load profiles
    const profiles = await profileManager.loadProfiles(workspaceFolder);
    
    // Step 4: Verify graceful handling
    expect(profiles.length).toBeGreaterThan(0);
    expect(profiles.some(p => p.id === 'mvp')).toBe(true);
    
    // Should log error
    const errorLog = outputChannel.messages.join('');
    expect(errorLog).toContain('Malformed JSON');
  });

  test('should preserve valid profiles when file has partial corruption', async () => {
    // Requirement 11.5
    
    // Step 1: Create profiles file with one valid and one invalid profile
    const profilesPath = path.join(tempDir, '.kiro', 'execution-profiles.json');
    await fs.mkdir(path.dirname(profilesPath), { recursive: true });
    
    const profilesFile = {
      version: '1.0.0',
      profiles: [
        {
          id: 'valid-profile',
          name: 'Valid Profile',
          icon: 'star',
          promptTemplate: 'This is valid: {{specName}}',
          isBuiltIn: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'invalid-profile',
          // Missing required fields: name, promptTemplate
          icon: 'rocket',
          isBuiltIn: false
        }
      ]
    };
    
    await fs.writeFile(profilesPath, JSON.stringify(profilesFile, null, 2), 'utf-8');
    
    // Step 2: Load profiles
    const profiles = await profileManager.loadProfiles(workspaceFolder);
    
    // Step 3: Verify valid profile is loaded, invalid is skipped
    expect(profiles.some(p => p.id === 'valid-profile')).toBe(true);
    expect(profiles.some(p => p.id === 'invalid-profile')).toBe(false);
    
    // Should log warning about invalid profile
    const errorLog = outputChannel.messages.join('');
    expect(errorLog).toContain('Skipping invalid profile');
  });

  test('should reload profiles multiple times without issues', async () => {
    // Requirement 11.4 - Verify file watcher can trigger multiple reloads
    
    // Step 1: Initial load
    const profiles1 = await profileManager.loadProfiles(workspaceFolder);
    expect(profiles1.length).toBeGreaterThan(0);
    
    // Step 2: Modify file externally
    const profilesPath = path.join(tempDir, '.kiro', 'execution-profiles.json');
    const content = await fs.readFile(profilesPath, 'utf-8');
    const profilesFile = JSON.parse(content.split('\n').filter(line => !line.trim().startsWith('//')).join('\n'));
    
    profilesFile.profiles.push({
      id: 'reload-test-1',
      name: 'Reload Test 1',
      icon: 'star',
      promptTemplate: 'Test 1',
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    await fs.writeFile(profilesPath, JSON.stringify(profilesFile, null, 2), 'utf-8');
    
    // Step 3: Reload
    const profiles2 = await profileManager.loadProfiles(workspaceFolder);
    expect(profiles2.some(p => p.id === 'reload-test-1')).toBe(true);
    
    // Step 4: Modify again
    const content2 = await fs.readFile(profilesPath, 'utf-8');
    const profilesFile2 = JSON.parse(content2);
    
    profilesFile2.profiles.push({
      id: 'reload-test-2',
      name: 'Reload Test 2',
      icon: 'rocket',
      promptTemplate: 'Test 2',
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    await fs.writeFile(profilesPath, JSON.stringify(profilesFile2, null, 2), 'utf-8');
    
    // Step 5: Reload again
    const profiles3 = await profileManager.loadProfiles(workspaceFolder);
    expect(profiles3.some(p => p.id === 'reload-test-1')).toBe(true);
    expect(profiles3.some(p => p.id === 'reload-test-2')).toBe(true);
  });
});
