/**
 * ProfileManager - Manages execution profiles with file I/O operations
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ExecutionProfile, ValidationResult, TemplateVariables, SpecFile } from './types';

/**
 * File format for execution profiles
 */
interface ProfilesFile {
  $schema?: string;
  version: string;
  profiles: ExecutionProfile[];
}

/**
 * Built-in profile definitions
 */
const MVP_PROFILE: ExecutionProfile = {
  id: 'mvp',
  name: 'MVP (Required Tasks)',
  icon: 'rocket',
  description: 'Execute only required tasks to complete the minimum viable product',
  promptTemplate: `Execute the spec "{{specName}}" located at {{specPath}}.

Focus on required tasks only (skip optional tasks marked with *).

Workspace: {{workspaceFolder}}
Total tasks: {{totalTasks}}
Completed: {{completedTasks}}
Remaining: {{remainingTasks}}

Please execute all remaining required tasks in order.`,
  isBuiltIn: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const FULL_PROFILE: ExecutionProfile = {
  id: 'full',
  name: 'Full (All Tasks)',
  icon: 'checklist',
  description: 'Execute all tasks including optional ones for complete implementation',
  promptTemplate: `Execute the spec "{{specName}}" located at {{specPath}}.

Execute ALL tasks including optional ones.

Workspace: {{workspaceFolder}}
Total tasks: {{totalTasks}}
Completed: {{completedTasks}}
Remaining: {{remainingTasks}}

Please execute all remaining tasks in order, including optional tasks.`,
  isBuiltIn: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

/**
 * ProfileManager handles CRUD operations for execution profiles
 */
export class ProfileManager {
  private readonly outputChannel: vscode.OutputChannel;
  private readonly profilesFileName = 'execution-profiles.json';

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  /**
   * Load profiles from all workspace folders
   * Tags each profile with source workspace folder
   * Handles profile ID conflicts by prefixing with workspace folder name
   * 
   * Requirements: 9.1, 9.2, 9.3
   */
  async loadAllProfiles(): Promise<ExecutionProfile[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    if (!workspaceFolders || workspaceFolders.length === 0) {
      this.outputChannel.appendLine(`[${new Date().toISOString()}] [ProfileManager] No workspace folders found`);
      return this.getBuiltInProfiles();
    }
    
    const allProfiles: ExecutionProfile[] = [];
    const profileIdCounts: Map<string, number> = new Map();
    
    // Load profiles from each workspace folder
    for (const folder of workspaceFolders) {
      try {
        const profiles = await this.loadProfiles(folder);
        
        // Tag each profile with source workspace folder and handle conflicts
        for (const profile of profiles) {
          // Track how many times we've seen this profile ID
          const count = profileIdCounts.get(profile.id) || 0;
          profileIdCounts.set(profile.id, count + 1);
          
          // If this is a duplicate ID (count > 0), prefix with workspace folder name
          let taggedProfile: ExecutionProfile;
          if (count > 0) {
            const folderName = folder.name;
            taggedProfile = {
              ...profile,
              id: `${folderName}-${profile.id}`,
              metadata: {
                ...profile.metadata,
                workspaceFolder: folder.uri.fsPath,
                workspaceFolderName: folderName,
                originalId: profile.id
              }
            };
            
            this.outputChannel.appendLine(
              `[${new Date().toISOString()}] [ProfileManager] Profile ID conflict resolved: "${profile.id}" → "${taggedProfile.id}" (from ${folderName})`
            );
          } else {
            // First occurrence, just tag with workspace folder
            taggedProfile = {
              ...profile,
              metadata: {
                ...profile.metadata,
                workspaceFolder: folder.uri.fsPath,
                workspaceFolderName: folder.name,
                originalId: profile.id
              }
            };
          }
          
          allProfiles.push(taggedProfile);
        }
      } catch (error) {
        this.outputChannel.appendLine(
          `[${new Date().toISOString()}] [ProfileManager] Error loading profiles from ${folder.name}: ${error}`
        );
        // Continue loading from other folders
      }
    }
    
    // If no profiles were loaded from any folder, return built-in profiles
    if (allProfiles.length === 0) {
      return this.getBuiltInProfiles();
    }
    
    this.outputChannel.appendLine(
      `[${new Date().toISOString()}] [ProfileManager] Loaded ${allProfiles.length} profiles from ${workspaceFolders.length} workspace folder(s)`
    );
    
    return allProfiles;
  }

  /**
   * Get the path to the profiles file for a workspace folder
   */
  private getProfilesFilePath(workspaceFolder: vscode.WorkspaceFolder): string {
    return path.join(workspaceFolder.uri.fsPath, '.kiro', this.profilesFileName);
  }

  /**
   * Get built-in profiles (MVP and Full)
   * 
   * Requirements: 3.1, 3.2
   */
  getBuiltInProfiles(): ExecutionProfile[] {
    return [
      { ...MVP_PROFILE },
      { ...FULL_PROFILE }
    ];
  }

  /**
   * Load all profiles from workspace folder
   * Falls back to built-in profiles if file doesn't exist or is malformed
   * 
   * Requirements: 1.1, 1.2, 1.6, 1.7, 10.1
   */
  async loadProfiles(workspaceFolder: vscode.WorkspaceFolder): Promise<ExecutionProfile[]> {
    const filePath = this.getProfilesFilePath(workspaceFolder);
    
    try {
      // Check if file exists
      await fs.access(filePath);
      
      // Read and parse file
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Strip comments from JSON (lines starting with //)
      const jsonContent = this.stripJsonComments(content);
      
      // Parse JSON with detailed error handling
      let profilesFile: ProfilesFile;
      try {
        profilesFile = JSON.parse(jsonContent);
      } catch (parseError) {
        // Malformed JSON - provide detailed error message
        const errorMsg = parseError instanceof Error ? parseError.message : String(parseError);
        this.outputChannel.appendLine(
          `[ProfileManager] Malformed JSON in profiles file at ${filePath}: ${errorMsg}`
        );
        
        // Show user-friendly error notification
        vscode.window.showWarningMessage(
          `Profile file is malformed. Using default profiles. Check the output channel for details.`,
          'View Output'
        ).then(selection => {
          if (selection === 'View Output') {
            this.outputChannel.show();
          }
        });
        
        return this.getBuiltInProfiles();
      }
      
      // Validate structure
      if (!profilesFile.profiles || !Array.isArray(profilesFile.profiles)) {
        this.outputChannel.appendLine(
          `[ProfileManager] Invalid profiles file structure at ${filePath}: 'profiles' field must be an array`
        );
        
        vscode.window.showWarningMessage(
          `Profile file has invalid structure. Using default profiles.`
        );
        
        return this.getBuiltInProfiles();
      }
      
      // Validate each profile and filter out invalid ones
      const validProfiles: ExecutionProfile[] = [];
      for (let i = 0; i < profilesFile.profiles.length; i++) {
        const profile = profilesFile.profiles[i];
        const validation = this.validateProfile(profile);
        
        if (validation.valid) {
          validProfiles.push(profile);
        } else {
          this.outputChannel.appendLine(
            `[ProfileManager] Skipping invalid profile at index ${i}: ${validation.errors.join(', ')}`
          );
        }
      }
      
      // If no valid profiles found, return built-in profiles
      if (validProfiles.length === 0) {
        this.outputChannel.appendLine(
          `[ProfileManager] No valid profiles found in ${filePath}, using built-in profiles`
        );
        return this.getBuiltInProfiles();
      }
      
      // Return all valid profiles
      return validProfiles;
      
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      
      if (nodeError.code === 'ENOENT') {
        // File doesn't exist - create it with built-in profiles
        this.outputChannel.appendLine(
          `[ProfileManager] Profiles file not found, creating default at ${filePath}`
        );
        
        try {
          await this.createDefaultProfilesFile(workspaceFolder);
        } catch (createError) {
          this.outputChannel.appendLine(
            `[ProfileManager] Failed to create default profiles file: ${createError}`
          );
          
          vscode.window.showErrorMessage(
            `Could not create profiles file. Check file permissions.`
          );
        }
        
        return this.getBuiltInProfiles();
        
      } else if (nodeError.code === 'EACCES' || nodeError.code === 'EPERM') {
        // Permission denied
        this.outputChannel.appendLine(
          `[ProfileManager] Permission denied reading profiles file at ${filePath}: ${error}`
        );
        
        vscode.window.showErrorMessage(
          `Cannot read profiles file due to insufficient permissions. Using default profiles.`
        );
        
        return this.getBuiltInProfiles();
        
      } else {
        // Other file system error
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.outputChannel.appendLine(
          `[ProfileManager] Error reading profiles file at ${filePath}: ${errorMsg}`
        );
        
        vscode.window.showWarningMessage(
          `Could not read profiles file. Using default profiles. Error: ${errorMsg}`
        );
        
        return this.getBuiltInProfiles();
      }
    }
  }

  /**
   * Ensure profiles file exists, create it if it doesn't
   * 
   * Requirements: 1.1, 10.1
   */
  async ensureProfilesFileExists(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    const filePath = this.getProfilesFilePath(workspaceFolder);
    
    try {
      // Check if file exists
      await fs.access(filePath);
      this.outputChannel.appendLine(`[ProfileManager] Profiles file already exists at ${filePath}`);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      
      if (nodeError.code === 'ENOENT') {
        // File doesn't exist, create it
        this.outputChannel.appendLine(`[ProfileManager] Profiles file not found, creating at ${filePath}`);
        await this.createDefaultProfilesFile(workspaceFolder);
      } else {
        // Other error (permissions, etc.)
        this.outputChannel.appendLine(`[ProfileManager] Error checking profiles file: ${error}`);
        throw error;
      }
    }
  }

  /**
   * Create default profiles file with built-in profiles
   * 
   * Requirements: 1.2, 11.1, 11.2
   */
  private async createDefaultProfilesFile(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    const filePath = this.getProfilesFilePath(workspaceFolder);
    const kiroDir = path.dirname(filePath);
    
    try {
      // Ensure .kiro directory exists
      await fs.mkdir(kiroDir, { recursive: true });
      
      // Create profiles file with documentation
      const profilesFile: ProfilesFile = {
        version: '1.0.0',
        profiles: this.getBuiltInProfiles()
      };
      
      // Write with pretty formatting and documentation comments
      const content = this.formatProfilesFileWithDocumentation(profilesFile);
      await fs.writeFile(filePath, content, 'utf-8');
      
      this.outputChannel.appendLine(`[ProfileManager] Created default profiles file at ${filePath}`);
    } catch (error) {
      this.outputChannel.appendLine(`[ProfileManager] Error creating default profiles file: ${error}`);
      throw error;
    }
  }

  /**
   * Get a specific profile by ID
   * 
   * Requirements: 1.1
   */
  async getProfile(profileId: string, workspaceFolder: vscode.WorkspaceFolder): Promise<ExecutionProfile | undefined> {
    const profiles = await this.loadProfiles(workspaceFolder);
    return profiles.find(p => p.id === profileId);
  }

  /**
   * Validate profile structure
   * Returns detailed validation errors for user feedback
   * 
   * Requirements: 1.3, 10.2
   */
  validateProfile(profile: ExecutionProfile): ValidationResult {
    const errors: string[] = [];
    
    // Check if profile object exists
    if (!profile || typeof profile !== 'object') {
      errors.push('Profile must be a valid object');
      return { valid: false, errors };
    }
    
    // Check required fields with detailed error messages
    if (!profile.id || typeof profile.id !== 'string' || profile.id.trim() === '') {
      errors.push('Profile ID is required and must be a non-empty string');
    } else {
      // Validate ID format (kebab-case)
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(profile.id)) {
        errors.push('Profile ID must be in kebab-case format (lowercase letters, numbers, and hyphens only)');
      }
      
      // Check ID length
      if (profile.id.length > 50) {
        errors.push('Profile ID must be 50 characters or less');
      }
    }
    
    if (!profile.name || typeof profile.name !== 'string' || profile.name.trim() === '') {
      errors.push('Profile name is required and must be a non-empty string');
    } else if (profile.name.length > 100) {
      errors.push('Profile name must be 100 characters or less');
    }
    
    if (!profile.promptTemplate || typeof profile.promptTemplate !== 'string' || profile.promptTemplate.trim() === '') {
      errors.push('Profile promptTemplate is required and must be a non-empty string');
    } else if (profile.promptTemplate.length > 10000) {
      errors.push('Profile promptTemplate must be 10,000 characters or less');
    }
    
    // Validate icon field if present
    if (profile.icon !== undefined && (typeof profile.icon !== 'string' || profile.icon.trim() === '')) {
      errors.push('Profile icon must be a non-empty string if provided');
    }
    
    // Validate isBuiltIn field
    if (profile.isBuiltIn !== undefined && typeof profile.isBuiltIn !== 'boolean') {
      errors.push('Profile isBuiltIn must be a boolean if provided');
    }
    
    // Validate timestamp fields
    if (profile.createdAt !== undefined) {
      if (typeof profile.createdAt !== 'string') {
        errors.push('Profile createdAt must be a string (ISO 8601 timestamp) if provided');
      } else {
        const date = new Date(profile.createdAt);
        if (isNaN(date.getTime())) {
          errors.push('Profile createdAt must be a valid ISO 8601 timestamp');
        }
      }
    }
    
    if (profile.updatedAt !== undefined) {
      if (typeof profile.updatedAt !== 'string') {
        errors.push('Profile updatedAt must be a string (ISO 8601 timestamp) if provided');
      } else {
        const date = new Date(profile.updatedAt);
        if (isNaN(date.getTime())) {
          errors.push('Profile updatedAt must be a valid ISO 8601 timestamp');
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create a new profile
   * Validates profile and provides detailed error messages
   * 
   * Requirements: 1.3, 10.2
   */
  async createProfile(profile: ExecutionProfile, workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    // Validate profile
    const validation = this.validateProfile(profile);
    if (!validation.valid) {
      const errorMsg = `Profile validation failed: ${validation.errors.join(', ')}`;
      this.outputChannel.appendLine(`[ProfileManager] ${errorMsg}`);
      
      // Show user-friendly error
      vscode.window.showErrorMessage(
        `Cannot create profile: ${validation.errors[0]}`,
        'View All Errors'
      ).then(selection => {
        if (selection === 'View All Errors') {
          vscode.window.showErrorMessage(
            `Profile validation errors:\n${validation.errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}`
          );
        }
      });
      
      throw new Error(errorMsg);
    }
    
    try {
      // Load existing profiles
      const profiles = await this.loadProfiles(workspaceFolder);
      
      // Check for duplicate ID
      if (profiles.some(p => p.id === profile.id)) {
        const errorMsg = `Profile with ID "${profile.id}" already exists`;
        this.outputChannel.appendLine(`[ProfileManager] ${errorMsg}`);
        
        vscode.window.showErrorMessage(errorMsg);
        throw new Error(errorMsg);
      }
      
      // Add timestamps
      const now = new Date().toISOString();
      const newProfile: ExecutionProfile = {
        ...profile,
        createdAt: now,
        updatedAt: now
      };
      
      // Add to profiles list
      profiles.push(newProfile);
      
      // Save to file
      await this.saveProfiles(profiles, workspaceFolder);
      
      this.outputChannel.appendLine(`[ProfileManager] Created profile: ${profile.id}`);
      
      // Show success notification
      vscode.window.showInformationMessage(`Profile "${profile.name}" created successfully`);
      
    } catch (error) {
      // If error is already thrown from validation or duplicate check, re-throw
      if (error instanceof Error && error.message.includes('validation failed') || 
          error instanceof Error && error.message.includes('already exists')) {
        throw error;
      }
      
      // Handle file system errors
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[ProfileManager] Error creating profile: ${errorMsg}`);
      
      vscode.window.showErrorMessage(
        `Could not create profile. ${errorMsg.includes('permission') ? 'Check file permissions.' : 'See output for details.'}`
      );
      
      throw error;
    }
  }

  /**
   * Update an existing profile
   * Validates updates and provides detailed error messages
   * 
   * Requirements: 1.4, 10.2
   */
  async updateProfile(
    profileId: string,
    updates: Partial<ExecutionProfile>,
    workspaceFolder: vscode.WorkspaceFolder
  ): Promise<void> {
    try {
      // Load existing profiles
      const profiles = await this.loadProfiles(workspaceFolder);
      
      // Find profile to update
      const index = profiles.findIndex(p => p.id === profileId);
      if (index === -1) {
        const errorMsg = `Profile with ID "${profileId}" not found`;
        this.outputChannel.appendLine(`[ProfileManager] ${errorMsg}`);
        
        vscode.window.showErrorMessage(errorMsg);
        throw new Error(errorMsg);
      }
      
      // Apply updates
      const updatedProfile: ExecutionProfile = {
        ...profiles[index],
        ...updates,
        id: profiles[index].id, // Prevent ID changes
        isBuiltIn: profiles[index].isBuiltIn, // Preserve built-in flag
        createdAt: profiles[index].createdAt, // Preserve creation date
        updatedAt: new Date().toISOString() // Update modification date
      };
      
      // Validate updated profile
      const validation = this.validateProfile(updatedProfile);
      if (!validation.valid) {
        const errorMsg = `Profile validation failed: ${validation.errors.join(', ')}`;
        this.outputChannel.appendLine(`[ProfileManager] ${errorMsg}`);
        
        vscode.window.showErrorMessage(
          `Cannot update profile: ${validation.errors[0]}`,
          'View All Errors'
        ).then(selection => {
          if (selection === 'View All Errors') {
            vscode.window.showErrorMessage(
              `Profile validation errors:\n${validation.errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}`
            );
          }
        });
        
        throw new Error(errorMsg);
      }
      
      // Update in list
      profiles[index] = updatedProfile;
      
      // Save to file
      await this.saveProfiles(profiles, workspaceFolder);
      
      this.outputChannel.appendLine(`[ProfileManager] Updated profile: ${profileId}`);
      
      // Show success notification
      vscode.window.showInformationMessage(`Profile "${updatedProfile.name}" updated successfully`);
      
    } catch (error) {
      // If error is already thrown from validation or not found check, re-throw
      if (error instanceof Error && (error.message.includes('validation failed') || 
          error.message.includes('not found'))) {
        throw error;
      }
      
      // Handle file system errors
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[ProfileManager] Error updating profile: ${errorMsg}`);
      
      vscode.window.showErrorMessage(
        `Could not update profile. ${errorMsg.includes('permission') ? 'Check file permissions.' : 'See output for details.'}`
      );
      
      throw error;
    }
  }

  /**
   * Delete a profile (prevents deletion of built-in profiles)
   * 
   * Requirements: 1.5, 3.4
   */
  async deleteProfile(profileId: string, workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    this.outputChannel.appendLine(`[ProfileManager] Attempting to delete profile: ${profileId} from ${workspaceFolder.name}`);
    
    // Load existing profiles
    const profiles = await this.loadProfiles(workspaceFolder);
    this.outputChannel.appendLine(`[ProfileManager] Loaded ${profiles.length} profiles from workspace`);
    
    // Find profile to delete
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) {
      this.outputChannel.appendLine(`[ProfileManager] Profile not found: ${profileId}`);
      this.outputChannel.appendLine(`[ProfileManager] Available profiles: ${profiles.map(p => p.id).join(', ')}`);
      throw new Error(`Profile with ID "${profileId}" not found`);
    }
    
    this.outputChannel.appendLine(`[ProfileManager] Found profile: ${profile.name} (isBuiltIn: ${profile.isBuiltIn})`);
    
    // Prevent deletion of built-in profiles
    if (profile.isBuiltIn) {
      throw new Error(`Cannot delete built-in profile "${profileId}"`);
    }
    
    // Remove from list
    const updatedProfiles = profiles.filter(p => p.id !== profileId);
    this.outputChannel.appendLine(`[ProfileManager] Profiles after deletion: ${updatedProfiles.length} (removed 1)`);
    
    // Save to file
    await this.saveProfiles(updatedProfiles, workspaceFolder);
    
    this.outputChannel.appendLine(`[ProfileManager] Successfully deleted profile: ${profileId}`);
  }

  /**
   * Reset a built-in profile to default
   * 
   * Requirements: 3.5
   */
  async resetBuiltInProfile(profileId: string, workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    // Get default built-in profile
    const builtInProfiles = this.getBuiltInProfiles();
    const defaultProfile = builtInProfiles.find(p => p.id === profileId);
    
    if (!defaultProfile) {
      throw new Error(`No built-in profile found with ID "${profileId}"`);
    }
    
    // Load existing profiles
    const profiles = await this.loadProfiles(workspaceFolder);
    
    // Find profile to reset
    const index = profiles.findIndex(p => p.id === profileId);
    
    if (index === -1) {
      // Profile doesn't exist in file yet (using default built-in)
      // No need to reset since it's already using defaults
      this.outputChannel.appendLine(`[ProfileManager] Profile "${profileId}" is already using default settings (not customized)`);
      return;
    }
    
    // Check if the profile is actually customized
    const currentProfile = profiles[index];
    if (currentProfile.isBuiltIn && 
        currentProfile.name === defaultProfile.name &&
        currentProfile.promptTemplate === defaultProfile.promptTemplate &&
        currentProfile.icon === defaultProfile.icon) {
      // Profile is already at defaults
      this.outputChannel.appendLine(`[ProfileManager] Profile "${profileId}" is already at default settings`);
      return;
    }
    
    // Reset to default (preserve creation date)
    profiles[index] = {
      ...defaultProfile,
      createdAt: profiles[index].createdAt,
      updatedAt: new Date().toISOString()
    };
    
    // Save to file
    await this.saveProfiles(profiles, workspaceFolder);
    
    this.outputChannel.appendLine(`[ProfileManager] Reset built-in profile: ${profileId}`);
  }

  /**
   * Save profiles to file
   * Handles file system errors with detailed logging
   * Preserves JSON formatting for version control
   * 
   * Requirements: 1.1, 10.1, 11.1, 11.3
   */
  private async saveProfiles(profiles: ExecutionProfile[], workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    const filePath = this.getProfilesFilePath(workspaceFolder);
    
    try {
      // Ensure .kiro directory exists
      const kiroDir = path.dirname(filePath);
      await fs.mkdir(kiroDir, { recursive: true });
      
      const profilesFile: ProfilesFile = {
        version: '1.0.0',
        profiles
      };
      
      // Write with pretty formatting and documentation comments for version control
      const content = this.formatProfilesFileWithDocumentation(profilesFile);
      await fs.writeFile(filePath, content, 'utf-8');
      
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      let errorMsg = 'Could not save profiles.';
      
      if (nodeError.code === 'EACCES' || nodeError.code === 'EPERM') {
        errorMsg = 'Could not save profiles. Check file permissions.';
        this.outputChannel.appendLine(
          `[ProfileManager] Permission denied writing to ${filePath}: ${error}`
        );
      } else if (nodeError.code === 'ENOSPC') {
        errorMsg = 'Could not save profiles. Disk is full.';
        this.outputChannel.appendLine(
          `[ProfileManager] No space left on device: ${filePath}`
        );
      } else if (nodeError.code === 'EROFS') {
        errorMsg = 'Could not save profiles. File system is read-only.';
        this.outputChannel.appendLine(
          `[ProfileManager] Read-only file system: ${filePath}`
        );
      } else {
        const errStr = error instanceof Error ? error.message : String(error);
        this.outputChannel.appendLine(
          `[ProfileManager] Error saving profiles file at ${filePath}: ${errStr}`
        );
      }
      
      throw new Error(errorMsg);
    }
  }

  /**
   * Instantiate a profile template with spec data
   * Handles template processing errors gracefully
   * 
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 10.4
   */
  instantiateTemplate(profile: ExecutionProfile, spec: SpecFile): string {
    try {
      // Build template variables
      const variables: TemplateVariables = {
        specName: this.escapeValue(spec.name),
        specPath: this.escapeValue(spec.path),
        totalTasks: spec.totalTasks,
        completedTasks: spec.completedTasks,
        remainingTasks: spec.totalTasks - spec.completedTasks,
        workspaceFolder: this.escapeValue(spec.workspaceFolder || ''),
        specRelativePath: this.escapeValue(this.getRelativePath(spec))
      };
      
      // Replace template variables
      let result = profile.promptTemplate;
      
      // Replace standard variables
      result = result.replace(/\{\{specName\}\}/g, variables.specName);
      result = result.replace(/\{\{specPath\}\}/g, variables.specPath);
      result = result.replace(/\{\{totalTasks\}\}/g, String(variables.totalTasks));
      result = result.replace(/\{\{completedTasks\}\}/g, String(variables.completedTasks));
      result = result.replace(/\{\{remainingTasks\}\}/g, String(variables.remainingTasks));
      result = result.replace(/\{\{workspaceFolder\}\}/g, variables.workspaceFolder);
      result = result.replace(/\{\{specRelativePath\}\}/g, variables.specRelativePath);
      
      // Unknown variables are left unchanged (Requirement 2.4)
      
      return result;
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(
        `[ProfileManager] Error instantiating template for profile "${profile.id}": ${errorMsg}`
      );
      
      // Log warning but don't show to user (this is internal processing)
      this.outputChannel.appendLine(
        `[ProfileManager] Falling back to original template text`
      );
      
      // Fall back to original template (Requirement 10.4)
      return profile.promptTemplate;
    }
  }

  /**
   * Escape special characters in variable values
   * 
   * Requirements: 2.5
   */
  private escapeValue(value: string | number): string {
    if (typeof value === 'number') {
      return String(value);
    }
    
    // Escape special characters to prevent injection
    return value
      .replace(/\\/g, '\\\\')  // Backslash
      .replace(/"/g, '\\"')    // Double quote
      .replace(/'/g, "\\'")    // Single quote
      .replace(/\n/g, '\\n')   // Newline
      .replace(/\r/g, '\\r')   // Carriage return
      .replace(/\t/g, '\\t');  // Tab
  }

  /**
   * Get relative path from workspace root
   */
  private getRelativePath(spec: SpecFile): string {
    // Extract relative path from absolute path
    // Assuming spec.path is absolute and contains .kiro/specs/
    const match = spec.path.match(/\.kiro[/\\]specs[/\\](.+)$/);
    return match ? match[1] : spec.name;
  }

  /**
   * Format profiles file with documentation comments
   * Creates a JSON file with header comments explaining structure and available variables
   * 
   * Requirements: 11.1, 11.2, 11.3
   */
  private formatProfilesFileWithDocumentation(profilesFile: ProfilesFile): string {
    // Build header documentation
    const header = [
      '// Kiro Execution Profiles Configuration',
      '//',
      '// This file defines execution profiles for automated spec execution.',
      '// Each profile contains a prompt template that can be customized with variables.',
      '//',
      '// Available Template Variables:',
      '//   {{specName}}         - Name of the spec (e.g., "user-authentication")',
      '//   {{specPath}}         - Absolute path to spec folder',
      '//   {{specRelativePath}} - Relative path from workspace root',
      '//   {{totalTasks}}       - Total number of tasks in the spec',
      '//   {{completedTasks}}   - Number of completed tasks',
      '//   {{remainingTasks}}   - Number of remaining tasks (totalTasks - completedTasks)',
      '//   {{workspaceFolder}}  - Workspace folder name',
      '//',
      '// Profile Structure:',
      '//   - id: Unique identifier (kebab-case, e.g., "my-custom-profile")',
      '//   - name: Display name shown in UI',
      '//   - icon: VSCode codicon name (e.g., "rocket", "star", "checklist")',
      '//   - promptTemplate: Template string with {{variables}} to be replaced',
      '//   - isBuiltIn: true for built-in profiles (MVP, Full), false for custom',
      '//   - createdAt: ISO 8601 timestamp of creation',
      '//   - updatedAt: ISO 8601 timestamp of last update',
      '//   - description: (optional) Description of the profile',
      '//   - metadata: (optional) Custom metadata object',
      '//',
      '// Built-in Profiles:',
      '//   - MVP: Executes only required tasks (skips optional tasks marked with *)',
      '//   - Full: Executes all tasks including optional ones',
      '//',
      '// You can edit built-in profiles or create custom profiles.',
      '// Built-in profiles can be reset to defaults from the UI.',
      '//',
      ''
    ].join('\n');
    
    // Pretty-print JSON with 2-space indentation
    const jsonContent = JSON.stringify(profilesFile, null, 2);
    
    // Combine header and JSON
    return header + jsonContent + '\n';
  }

  /**
   * Strip single-line comments from JSON content
   * Removes lines starting with // to allow parsing
   * 
   * Requirements: 11.1, 11.2
   */
  private stripJsonComments(content: string): string {
    // Split into lines and filter out comment lines
    const lines = content.split('\n');
    const filteredLines = lines.filter(line => {
      const trimmed = line.trim();
      return !trimmed.startsWith('//');
    });
    
    return filteredLines.join('\n');
  }
}
