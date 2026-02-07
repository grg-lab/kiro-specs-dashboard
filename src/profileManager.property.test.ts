/**
 * Property-based tests for ProfileManager
 * 
 * Tests universal properties that should hold across all valid inputs using fast-check.
 * Each test runs a minimum of 100 iterations with randomized inputs.
 * 
 * Requirements: 1.6
 */

import * as fc from 'fast-check';
import { ProfileManager } from './profileManager';
import { ExecutionProfile } from './types';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock output channel
class MockOutputChannel implements vscode.OutputChannel {
  name = 'Test';
  append(value: string): void {}
  appendLine(value: string): void {}
  replace(value: string): void {}
  clear(): void {}
  show(): void {}
  hide(): void {}
  dispose(): void {}
}

/**
 * Generator for valid execution profiles
 * Generates profiles with all required fields and valid formats
 */
const validProfileGenerator = (): fc.Arbitrary<ExecutionProfile> =>
  fc.record({
    id: fc.stringOf(
      fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'),
      { minLength: 3, maxLength: 30 }
    ).filter(s => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)), // Ensure kebab-case
    name: fc.string({ minLength: 1, maxLength: 100 }),
    icon: fc.constantFrom('rocket', 'star', 'checklist', 'gear', 'zap', 'beaker', 'flame'),
    promptTemplate: fc.string({ minLength: 10, maxLength: 1000 }),
    isBuiltIn: fc.boolean(),
    createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
      .map(d => d.toISOString()),
    updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
      .map(d => d.toISOString()),
    description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
    metadata: fc.option(
      fc.dictionary(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.oneof(
          fc.string(),
          fc.integer(),
          fc.boolean()
        )
      ),
      { nil: undefined }
    )
  });

describe('ProfileManager - Property-Based Tests', () => {
  let profileManager: ProfileManager;
  let outputChannel: MockOutputChannel;
  let tempDir: string;
  let tempWorkspaceFolder: vscode.WorkspaceFolder;

  beforeEach(async () => {
    outputChannel = new MockOutputChannel();
    profileManager = new ProfileManager(outputChannel);
    
    // Create temporary directory for testing
    tempDir = path.join(__dirname, '..', 'test-temp', `pbt-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    tempWorkspaceFolder = {
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

  // Feature: automated-spec-execution, Property 1: Profile Persistence Round-Trip
  test('Property 1: Profile Persistence Round-Trip', async () => {
    /**
     * For any valid execution profile, writing it to the profiles file and then 
     * reading it back should produce an equivalent profile with all fields preserved.
     * 
     * Validates: Requirements 1.6
     */
    await fc.assert(
      fc.asyncProperty(
        validProfileGenerator(),
        async (profile) => {
          // Create the profile
          await profileManager.createProfile(profile, tempWorkspaceFolder);
          
          // Read it back
          const retrieved = await profileManager.getProfile(profile.id, tempWorkspaceFolder);
          
          // Assert all fields are preserved
          expect(retrieved).toBeDefined();
          expect(retrieved?.id).toBe(profile.id);
          expect(retrieved?.name).toBe(profile.name);
          expect(retrieved?.icon).toBe(profile.icon);
          expect(retrieved?.promptTemplate).toBe(profile.promptTemplate);
          expect(retrieved?.isBuiltIn).toBe(profile.isBuiltIn);
          expect(retrieved?.description).toBe(profile.description);
          
          // Timestamps should be preserved (createdAt) or updated (updatedAt)
          expect(retrieved?.createdAt).toBeDefined();
          expect(retrieved?.updatedAt).toBeDefined();
          
          // Metadata should be preserved if present
          if (profile.metadata) {
            expect(retrieved?.metadata).toEqual(expect.objectContaining(profile.metadata));
          }
        }
      ),
      { 
        numRuns: 100,
        verbose: true
      }
    );
  }, 60000); // 60 second timeout for property test

  // Feature: automated-spec-execution, Property 2: Profile Validation Rejects Invalid Profiles
  test('Property 2: Profile Validation Rejects Invalid Profiles', async () => {
    /**
     * For any profile object missing required fields (id, name, or promptTemplate),
     * the ProfileManager validation should reject it and return validation errors.
     * 
     * Validates: Requirements 1.3
     */
    
    // Generator for profiles with missing or invalid required fields
    const invalidProfileGenerator = fc.oneof(
      // Missing id (empty string)
      fc.record({
        id: fc.constant(''),
        name: fc.string({ minLength: 1, maxLength: 100 }),
        icon: fc.string({ minLength: 1 }),
        promptTemplate: fc.string({ minLength: 10, maxLength: 1000 }),
        isBuiltIn: fc.boolean(),
        createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString()),
        updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString())
      }),
      
      // Missing name (empty string)
      fc.record({
        id: fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'), { minLength: 3, maxLength: 30 })
          .filter(s => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)),
        name: fc.constant(''),
        icon: fc.string({ minLength: 1 }),
        promptTemplate: fc.string({ minLength: 10, maxLength: 1000 }),
        isBuiltIn: fc.boolean(),
        createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString()),
        updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString())
      }),
      
      // Missing promptTemplate (empty string)
      fc.record({
        id: fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'), { minLength: 3, maxLength: 30 })
          .filter(s => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)),
        name: fc.string({ minLength: 1, maxLength: 100 }),
        icon: fc.string({ minLength: 1 }),
        promptTemplate: fc.constant(''),
        isBuiltIn: fc.boolean(),
        createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString()),
        updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString())
      }),
      
      // Invalid id format (not kebab-case) - contains uppercase, spaces, or special chars
      fc.record({
        id: fc.oneof(
          fc.constant('Invalid ID'),  // Contains space and uppercase
          fc.constant('invalid_id'),  // Contains underscore
          fc.constant('INVALID'),     // All uppercase
          fc.constant('invalid.id'),  // Contains dot
          fc.constant('-invalid'),    // Starts with hyphen
          fc.constant('invalid-'),    // Ends with hyphen
          fc.constant('invalid--id'), // Double hyphen
          fc.string({ minLength: 1, maxLength: 30 }).filter(s => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)) // Any non-kebab-case
        ),
        name: fc.string({ minLength: 1, maxLength: 100 }),
        icon: fc.string({ minLength: 1 }),
        promptTemplate: fc.string({ minLength: 10, maxLength: 1000 }),
        isBuiltIn: fc.boolean(),
        createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString()),
        updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString())
      }),
      
      // ID too long (> 50 characters)
      fc.record({
        id: fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'), { minLength: 51, maxLength: 100 })
          .filter(s => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)),
        name: fc.string({ minLength: 1, maxLength: 100 }),
        icon: fc.string({ minLength: 1 }),
        promptTemplate: fc.string({ minLength: 10, maxLength: 1000 }),
        isBuiltIn: fc.boolean(),
        createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString()),
        updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString())
      }),
      
      // Name too long (> 100 characters)
      fc.record({
        id: fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'), { minLength: 3, maxLength: 30 })
          .filter(s => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)),
        name: fc.string({ minLength: 101, maxLength: 200 }),
        icon: fc.string({ minLength: 1 }),
        promptTemplate: fc.string({ minLength: 10, maxLength: 1000 }),
        isBuiltIn: fc.boolean(),
        createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString()),
        updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString())
      }),
      
      // PromptTemplate too long (> 10000 characters)
      fc.record({
        id: fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'), { minLength: 3, maxLength: 30 })
          .filter(s => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)),
        name: fc.string({ minLength: 1, maxLength: 100 }),
        icon: fc.string({ minLength: 1 }),
        promptTemplate: fc.string({ minLength: 10001, maxLength: 15000 }),
        isBuiltIn: fc.boolean(),
        createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString()),
        updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString())
      })
    );
    
    await fc.assert(
      fc.property(
        invalidProfileGenerator,
        (invalidProfile) => {
          // Validate the invalid profile
          const validation = profileManager.validateProfile(invalidProfile as ExecutionProfile);
          
          // Assert validation fails
          expect(validation.valid).toBe(false);
          
          // Assert errors array is not empty
          expect(validation.errors).toBeDefined();
          expect(validation.errors.length).toBeGreaterThan(0);
          
          // Assert errors contain meaningful messages
          expect(validation.errors.every(error => typeof error === 'string' && error.length > 0)).toBe(true);
        }
      ),
      { 
        numRuns: 100,
        verbose: true
      }
    );
  }, 60000); // 60 second timeout for property test
});
