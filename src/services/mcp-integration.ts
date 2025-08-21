/**
 * Model Context Protocol (MCP) Integration Service
 * Provides external tool integration capabilities for MARIA agents
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

// WebSocket type for browser environments
declare global {
  interface WebSocket {
    readyState: number;
    send(data: string): void;
    close(): void;
    addEventListener(type: string, listener: (event: unknown) => void): void;
  }
}

// Simple WebSocket stub for Node.js environments
const _WebSocket =
  (globalThis as Record<string, unknown>).WebSocket ||
  class MockWebSocket {
    readyState = 1;
    send(_data: string) {
      /* stub */
    }
    close() {
      /* stub */
    }
    addEventListener(_type: string, _listener: (event: unknown) => void) {
      /* stub */
    }
  };

// MCP Protocol Types
export interface MCPServer {
  name: string;
  version: string;
  description: string;
  url: string;
  capabilities: MCPCapability[];
  status: 'connected' | 'disconnected' | 'error' | 'initializing';
}

export interface MCPCapability {
  name: string;
  type: 'tool' | 'resource' | 'prompt';
  description: string;
  schema: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  server: string;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  server: string;
}

export interface MCPRequest {
  id: string;
  method: string;
  params: Record<string, unknown>;
  server: string;
  timestamp: Date;
}

export interface MCPResponse {
  id: string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  timestamp: Date;
}

// MCP Integration Service
export class MCPIntegrationService extends EventEmitter {
  private servers = new Map<string, MCPServer>();
  private tools = new Map<string, MCPTool>();
  private resources = new Map<string, MCPResource>();
  private connections = new Map<string, WebSocket>();
  private isInitialized = false;

  constructor() {
    super();
  }

  /**
   * Initialize MCP integration service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('MCP Integration Service already initialized');
      return;
    }

    logger.info('Initializing MCP Integration Service...');

    try {
      // Register default MCP servers
      await this.registerDefaultServers();

      // Initialize connections
      await this.initializeConnections();

      this.isInitialized = true;
      logger.info('MCP Integration Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize MCP Integration Service:', error);
      throw error;
    }
  }

  /**
   * Register an MCP server
   */
  async registerServer(server: MCPServer): Promise<void> {
    logger.info(`Registering MCP server: ${server.name}`);

    this.servers.set(server.name, server);

    try {
      // Attempt to connect to server
      await this.connectToServer(server);

      // Discover capabilities
      await this.discoverCapabilities(server);

      this.emit('serverRegistered', server);
    } catch (error) {
      logger.error(`Failed to register MCP server ${server.name}:`, error);
      server.status = 'error';
    }
  }

  /**
   * Execute an MCP tool
   */
  async executeTool(
    toolName: string,
    params: Record<string, unknown>,
    context?: {
      workflowId?: string;
      agentRole?: string;
      userIntent?: string;
    },
  ): Promise<unknown> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`MCP tool '${toolName}' not found`);
    }

    const server = this.servers.get(tool.server);
    if (!server || server.status !== 'connected') {
      throw new Error(`MCP server '${tool.server}' not available`);
    }

    logger.info(`Executing MCP tool: ${toolName} on server: ${tool.server}`);

    const request: MCPRequest = {
      id: this.generateRequestId(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: params,
        context: context || {},
      },
      server: tool.server,
      timestamp: new Date(),
    };

    try {
      const response = await this.sendRequest(request);

      if (response.error) {
        throw new Error(`MCP tool execution failed: ${response.error.message}`);
      }

      this.emit('toolExecuted', { tool, request, response, context });
      return response.result;
    } catch (error) {
      logger.error(`MCP tool execution failed for ${toolName}:`, error);
      throw error;
    }
  }

  /**
   * Get available MCP tools
   */
  getAvailableTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category/type
   */
  getToolsByCategory(category: string): MCPTool[] {
    return Array.from(this.tools.values()).filter(
      (tool) =>
        tool.description.toLowerCase().includes(category.toLowerCase()) ||
        tool.name.toLowerCase().includes(category.toLowerCase()),
    );
  }

  /**
   * Get MCP resources
   */
  getAvailableResources(): MCPResource[] {
    return Array.from(this.resources.values());
  }

  /**
   * Access an MCP resource
   */
  async accessResource(uri: string): Promise<unknown> {
    const resource = this.resources.get(uri);
    if (!resource) {
      throw new Error(`MCP resource '${uri}' not found`);
    }

    const server = this.servers.get(resource.server);
    if (!server || server.status !== 'connected') {
      throw new Error(`MCP server '${resource.server}' not available`);
    }

    const request: MCPRequest = {
      id: this.generateRequestId(),
      method: 'resources/read',
      params: { uri },
      server: resource.server,
      timestamp: new Date(),
    };

    const response = await this.sendRequest(request);

    if (response.error) {
      throw new Error(`MCP resource access failed: ${response.error.message}`);
    }

    return response.result;
  }

  /**
   * Get service status
   */
  getStatus(): {
    initialized: boolean;
    servers: { name: string; status: string; toolCount: number }[];
    totalTools: number;
    totalResources: number;
  } {
    const servers = Array.from(this.servers.values()).map((server) => ({
      name: server.name,
      status: server.status,
      toolCount: Array.from(this.tools.values()).filter((t) => t.server === server.name).length,
    }));

    return {
      initialized: this.isInitialized,
      servers,
      totalTools: this.tools.size,
      totalResources: this.resources.size,
    };
  }

  /**
   * Register default MCP servers
   */
  private async registerDefaultServers(): Promise<void> {
    // GitHub MCP Server
    await this.registerServer({
      name: 'github',
      version: '1.0.0',
      description: 'GitHub integration for repository management',
      url: 'mcp://github.com/api',
      capabilities: [],
      status: 'initializing',
    });

    // Code Analysis MCP Server
    await this.registerServer({
      name: 'code-analysis',
      version: '1.0.0',
      description: 'Code analysis and quality assessment tools',
      url: 'mcp://localhost:3001/code-analysis',
      capabilities: [],
      status: 'initializing',
    });

    // Document Processing MCP Server
    await this.registerServer({
      name: 'document-processor',
      version: '1.0.0',
      description: 'PDF parsing, arXiv fetching, and document processing',
      url: 'mcp://localhost:3002/documents',
      capabilities: [],
      status: 'initializing',
    });

    // Vector Database MCP Server
    await this.registerServer({
      name: 'vector-db',
      version: '1.0.0',
      description: 'Vector-based code search and semantic analysis',
      url: 'mcp://localhost:3003/vector',
      capabilities: [],
      status: 'initializing',
    });
  }

  /**
   * Initialize connections to all servers
   */
  private async initializeConnections(): Promise<void> {
    const connectionPromises = Array.from(this.servers.values()).map((server) =>
      this.connectToServer(server).catch((error) => {
        logger.warn(`Failed to connect to MCP server ${server.name}:`, error);
        server.status = 'error';
      }),
    );

    await Promise.allSettled(connectionPromises);
  }

  /**
   * Connect to an MCP server
   */
  private async connectToServer(server: MCPServer): Promise<void> {
    logger.debug(`Connecting to MCP server: ${server.name} at ${server.url}`);

    // For now, simulate connection (would implement actual WebSocket/HTTP connection)
    await new Promise((resolve) => setTimeout(resolve, 100));

    server.status = 'connected';
    this.emit('serverConnected', server);
  }

  /**
   * Discover capabilities from an MCP server
   */
  private async discoverCapabilities(server: MCPServer): Promise<void> {
    logger.debug(`Discovering capabilities for MCP server: ${server.name}`);

    // Simulate capability discovery
    const mockCapabilities = this.getMockCapabilities(server.name);
    server.capabilities = mockCapabilities;

    // Register tools and resources
    for (const capability of mockCapabilities) {
      if (capability.type === 'tool') {
        this.tools.set(capability.name, {
          name: capability.name,
          description: capability.description,
          inputSchema: capability.schema,
          server: server.name,
        });
      } else if (capability.type === 'resource') {
        this.resources.set(capability.name, {
          uri: capability.name,
          name: capability.name,
          description: capability.description,
          server: server.name,
        });
      }
    }
  }

  /**
   * Send request to MCP server
   */
  private async sendRequest(request: MCPRequest): Promise<MCPResponse> {
    logger.debug(`Sending MCP request: ${request.method} to ${request.server}`);

    // Simulate request/response (would implement actual protocol communication)
    await new Promise((resolve) => setTimeout(resolve, 200));

    const response: MCPResponse = {
      id: request.id,
      result: this.getMockResponse(request),
      timestamp: new Date(),
    };

    return response;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get mock capabilities for different servers
   */
  private getMockCapabilities(serverName: string): MCPCapability[] {
    switch (serverName) {
      case 'github':
        return [
          {
            name: 'create-repository',
            type: 'tool',
            description: 'Create a new GitHub repository',
            schema: { name: 'string', description: 'string', private: 'boolean' },
          },
          {
            name: 'search-code',
            type: 'tool',
            description: 'Search code across GitHub repositories',
            schema: { query: 'string', language: 'string' },
          },
        ];

      case 'code-analysis':
        return [
          {
            name: 'analyze-complexity',
            type: 'tool',
            description: 'Analyze code complexity metrics',
            schema: { code: 'string', language: 'string' },
          },
          {
            name: 'detect-patterns',
            type: 'tool',
            description: 'Detect code patterns and anti-patterns',
            schema: { codebase: 'string', patterns: 'array' },
          },
        ];

      case 'document-processor':
        return [
          {
            name: 'parse-pdf',
            type: 'tool',
            description: 'Parse PDF documents and extract text/structure',
            schema: { pdf_url: 'string', extract_images: 'boolean' },
          },
          {
            name: 'fetch-arxiv',
            type: 'tool',
            description: 'Fetch papers from arXiv by ID or search',
            schema: { arxiv_id: 'string', search_query: 'string' },
          },
        ];

      case 'vector-db':
        return [
          {
            name: 'semantic-search',
            type: 'tool',
            description: 'Semantic search through codebase using vector embeddings',
            schema: { query: 'string', limit: 'number', threshold: 'number' },
          },
          {
            name: 'index-codebase',
            type: 'tool',
            description: 'Index codebase for vector-based search',
            schema: { path: 'string', file_types: 'array' },
          },
        ];

      default:
        return [];
    }
  }

  /**
   * Get mock response for different requests
   */
  private getMockResponse(request: MCPRequest): unknown {
    switch (request.method) {
      case 'tools/call':
        return {
          success: true,
          data: `Mock result for ${request.params.name}`,
          metadata: {
            executionTime: '150ms',
            confidence: 0.95,
          },
        };

      case 'resources/read':
        return {
          content: `Mock resource content for ${request.params.uri}`,
          mimeType: 'text/plain',
          size: 1024,
        };

      default:
        return { message: 'Mock response' };
    }
  }
}

// Export singleton instance
export const mcpService = new MCPIntegrationService();
