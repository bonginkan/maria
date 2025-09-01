/**
 * Mock Dependency Injection Helper
 * Phase 1 Track B: Standardized mock dependencies
 * 
 * Prevents null DI issues and LegacyAdapter conflicts
 */

export interface MockService {
  name: string;
  reset(): void;
}

export class MockFileSystem implements MockService {
  name = 'MockFileSystem';
  private files = new Map<string, string>();

  constructor() {
    // Pre-populate with common test files
    this.files.set('/test/file.txt', 'test content');
    this.files.set('/test/code.js', 'console.log("hello");');
  }

  async readFile(path: string): Promise<string> {
    if (!this.files.has(path)) {
      throw new Error(`File not found: ${path}`);
    }
    return this.files.get(path)!;
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  reset(): void {
    this.files.clear();
  }
}

export class MockAPIClient implements MockService {
  name = 'MockAPIClient';
  private responses = new Map<string, any>();

  constructor() {
    // Default responses
    this.responses.set('/health', { status: 'ok' });
    this.responses.set('/version', { version: '1.0.0' });
  }

  async get(url: string): Promise<any> {
    if (this.responses.has(url)) {
      return this.responses.get(url);
    }
    return { data: 'mock response' };
  }

  async post(url: string, data: any): Promise<any> {
    return { success: true, data };
  }

  setResponse(url: string, response: any): void {
    this.responses.set(url, response);
  }

  reset(): void {
    this.responses.clear();
  }
}

export class MockProvider implements MockService {
  name = 'MockProvider';
  private model = 'mock-model';
  private responses = [
    'This is a mock AI response.',
    'I understand your request.',
    'Here is the generated content.'
  ];
  private responseIndex = 0;

  async complete(prompt: string): Promise<string> {
    const response = this.responses[this.responseIndex % this.responses.length];
    this.responseIndex++;
    return response;
  }

  async stream(prompt: string): Promise<AsyncIterable<string>> {
    const response = await this.complete(prompt);
    return (async function* () {
      for (const word of response.split(' ')) {
        yield word + ' ';
      }
    })();
  }

  setModel(model: string): void {
    this.model = model;
  }

  getModel(): string {
    return this.model;
  }

  reset(): void {
    this.responseIndex = 0;
    this.model = 'mock-model';
  }
}

export class MockGitClient implements MockService {
  name = 'MockGitClient';
  private branches = ['main', 'develop', 'feature/test'];
  private currentBranch = 'main';
  private commits = [
    { hash: 'abc123', message: 'Initial commit' },
    { hash: 'def456', message: 'Add feature' }
  ];

  async status(): Promise<string> {
    return `On branch ${this.currentBranch}\nnothing to commit, working tree clean`;
  }

  async branch(): Promise<string[]> {
    return this.branches;
  }

  async checkout(branch: string): Promise<void> {
    if (!this.branches.includes(branch)) {
      throw new Error(`Branch not found: ${branch}`);
    }
    this.currentBranch = branch;
  }

  async log(): Promise<any[]> {
    return this.commits;
  }

  reset(): void {
    this.currentBranch = 'main';
  }
}

export class MockDatabaseClient implements MockService {
  name = 'MockDatabaseClient';
  private data = new Map<string, any>();

  async query(sql: string): Promise<any[]> {
    return [];
  }

  async insert(table: string, data: any): Promise<void> {
    const key = `${table}:${Date.now()}`;
    this.data.set(key, data);
  }

  async find(table: string, query: any): Promise<any[]> {
    const results: any[] = [];
    for (const [key, value] of this.data) {
      if (key.startsWith(`${table}:`)) {
        results.push(value);
      }
    }
    return results;
  }

  reset(): void {
    this.data.clear();
  }
}

/**
 * Main Mock DI Helper class
 */
export class MockDIHelper {
  private static instance: MockDIHelper;
  private mocks = new Map<string, MockService>();
  private disabled = new Set<string>();

  private constructor() {
    this.registerStandardMocks();
  }

  /**
   * Singleton setup
   */
  static setup(): MockDIHelper {
    if (!this.instance) {
      this.instance = new MockDIHelper();
    }
    return this.instance;
  }

  /**
   * Register all standard mocks
   */
  private registerStandardMocks(): void {
    // Core services
    this.register('FileSystemService', new MockFileSystem());
    this.register('APIClient', new MockAPIClient());
    this.register('Provider', new MockProvider());
    this.register('GitClient', new MockGitClient());
    this.register('DatabaseClient', new MockDatabaseClient());
    
    // Provider-specific mocks
    this.register('OpenAIProvider', new MockProvider());
    this.register('AnthropicProvider', new MockProvider());
    this.register('GoogleProvider', new MockProvider());
    
    // Explicitly disable problematic services
    this.disable('LegacyAdapter');
    this.disable('LegacySlashCommandAdapter');
    
    // Set default configurations
    this.setDefaults();
  }

  /**
   * Set default configuration values
   */
  private setDefaults(): void {
    // Prevent null/undefined issues
    process.env.DEFAULT_PROVIDER = 'mock-provider';
    process.env.DEFAULT_MODEL = 'mock-model';
    process.env.MOCK_MODE = 'true';
    
    // Disable UI elements
    process.env.NO_INTERACTIVE = 'true';
    process.env.NO_SPINNER = 'true';
    process.env.NO_PROGRESS = 'true';
  }

  /**
   * Register a mock service
   */
  register(name: string, mock: MockService): void {
    this.mocks.set(name, mock);
  }

  /**
   * Disable a service (return null when requested)
   */
  disable(name: string): void {
    this.disabled.add(name);
  }

  /**
   * Get a mock service
   */
  inject<T = any>(name: string): T | null {
    if (this.disabled.has(name)) {
      return null;
    }
    
    if (!this.mocks.has(name)) {
      console.warn(`No mock registered for ${name}, returning default mock`);
      return this.createDefaultMock(name) as T;
    }
    
    return this.mocks.get(name) as T;
  }

  /**
   * Create a default mock for unknown services
   */
  private createDefaultMock(name: string): MockService {
    return {
      name: `Mock${name}`,
      reset: () => {}
    };
  }

  /**
   * Reset all mocks to initial state
   */
  resetAll(): void {
    for (const mock of this.mocks.values()) {
      mock.reset();
    }
  }

  /**
   * Clear all mocks and disabled services
   */
  clear(): void {
    this.mocks.clear();
    this.disabled.clear();
  }

  /**
   * Get list of registered mocks
   */
  getRegisteredMocks(): string[] {
    return Array.from(this.mocks.keys());
  }

  /**
   * Get list of disabled services
   */
  getDisabledServices(): string[] {
    return Array.from(this.disabled);
  }

  /**
   * Setup mock environment for testing
   */
  setupTestEnvironment(): void {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.TESTING = 'true';
    process.env.USE_MOCKS = 'true';
    
    // Disable external connections
    process.env.NO_NETWORK = 'true';
    process.env.OFFLINE_MODE = 'true';
    
    // Set timeouts for testing
    process.env.COMMAND_TIMEOUT = '5000';
    process.env.API_TIMEOUT = '1000';
  }

  /**
   * Restore original environment
   */
  restoreEnvironment(): void {
    // Remove test-specific variables
    delete process.env.TESTING;
    delete process.env.USE_MOCKS;
    delete process.env.MOCK_MODE;
    delete process.env.NO_NETWORK;
    delete process.env.OFFLINE_MODE;
    
    // Reset mocks
    this.resetAll();
  }

  /**
   * Create a mock context for command execution
   */
  createMockContext(): any {
    return {
      fileSystem: this.inject('FileSystemService'),
      apiClient: this.inject('APIClient'),
      provider: this.inject('Provider'),
      gitClient: this.inject('GitClient'),
      database: this.inject('DatabaseClient'),
      logger: {
        log: () => {},
        error: () => {},
        warn: () => {},
        info: () => {},
        debug: () => {}
      },
      ui: {
        showSpinner: () => {},
        hideSpinner: () => {},
        showProgress: () => {},
        hideProgress: () => {},
        print: (msg: string) => console.log(msg)
      }
    };
  }
}

export default MockDIHelper;