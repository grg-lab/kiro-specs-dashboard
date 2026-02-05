/**
 * Mock VSCode API for testing
 */

export enum ViewColumn {
  One = 1,
  Two = 2,
  Three = 3
}

export class Uri {
  static file(path: string): Uri {
    return new Uri(path);
  }

  static joinPath(base: Uri, ...pathSegments: string[]): Uri {
    return new Uri(`${base.fsPath}/${pathSegments.join('/')}`);
  }

  constructor(public fsPath: string) {}

  toString(): string {
    return this.fsPath;
  }
}

export interface Disposable {
  dispose(): void;
}

export const window = {
  createWebviewPanel: jest.fn(),
  showErrorMessage: jest.fn(),
  showInformationMessage: jest.fn(),
  showTextDocument: jest.fn()
};

export const workspace = {
  fs: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    readDirectory: jest.fn()
  },
  workspaceFolders: [],
  createFileSystemWatcher: jest.fn()
};

export const commands = {
  registerCommand: jest.fn()
};
