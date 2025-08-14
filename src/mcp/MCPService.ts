/**
 * MCP (Model Context Protocol) Service
 * Manages MCP servers and tool execution
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

export interface MCPServer {
  id: string;
  name: string;
  description: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  status: 'stopped' | 'starting' | 'running' | 'error';
  capabilities: MCPCapabilities;
  tools: MCPTool[];
}

export interface MCPCapabilities {
  tools?: boolean;
  resources?: boolean;
  prompts?: boolean;
  logging?: boolean;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  serverName: string;
}

export interface MCPToolExecution {
  toolName: string;
  arguments: Record<string, unknown>;
  serverId: string;
  server?: string; // Alias for serverId for backward compatibility
  tool?: string; // Alias for toolName for backward compatibility
  args?: Record<string, unknown>; // Alias for arguments for backward compatibility
  startTime?: Date;
  endTime?: Date;
}

export interface MCPExecutionResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export class MCPService extends EventEmitter {
  private servers: Map<string, MCPServer> = new Map();
  private connections: Map<string, unknown> = new Map();

  constructor() {
    super();
  }

  /**
   * Add a new MCP server
   */
  async addServer(server: Omit<MCPServer, 'status' | 'tools'>): Promise<void> {
    const mcpServer: MCPServer = {
      ...server,
      status: 'stopped',
      tools: [],
    };

    this.servers.set(server.id, mcpServer);
    this.emit('serverAdded', mcpServer);
    logger.info(`Added MCP server: ${server.name}`);
  }

  /**
   * Remove an MCP server
   */
  async removeServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }

    if (server.status === 'running') {
      await this.stopServer(serverId);
    }

    this.servers.delete(serverId);
    this.emit('serverRemoved', serverId);
    logger.info(`Removed MCP server: ${server.name}`);
  }

  /**
   * Start an MCP server
   */
  async startServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }

    if (server.status === 'running') {
      return;
    }

    try {
      server.status = 'starting';
      this.emit('serverStatusChanged', serverId, 'starting');

      // Mock server startup - in real implementation, this would spawn the process
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock tool discovery
      server.tools = [
        {
          name: 'example_tool',
          description: 'An example tool from the MCP server',
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'string', description: 'Input text' },
            },
            required: ['input'],
          },
          serverName: server.name,
        },
      ];

      server.status = 'running';
      this.emit('serverStatusChanged', serverId, 'running');
      logger.info(`Started MCP server: ${server.name}`);
    } catch (error: unknown) {
      server.status = 'error';
      this.emit('serverStatusChanged', serverId, 'error');
      throw error;
    }
  }

  /**
   * Stop an MCP server
   */
  async stopServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }

    if (server.status === 'stopped') {
      return;
    }

    try {
      // Mock server shutdown
      await new Promise((resolve) => setTimeout(resolve, 500));

      server.status = 'stopped';
      server.tools = [];
      this.connections.delete(serverId);
      this.emit('serverStatusChanged', serverId, 'stopped');
      logger.info(`Stopped MCP server: ${server.name}`);
    } catch (error: unknown) {
      server.status = 'error';
      this.emit('serverStatusChanged', serverId, 'error');
      throw error;
    }
  }

  /**
   * Execute a tool on an MCP server
   */
  async executeTool(execution: MCPToolExecution): Promise<MCPExecutionResult> {
    const server = this.servers.get(execution.serverId);
    if (!server) {
      throw new Error(`Server not found: ${execution.serverId}`);
    }

    if (server.status !== 'running') {
      throw new Error(`Server not running: ${server.name}`);
    }

    const tool = server.tools.find((t) => t.name === execution.toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${execution.toolName}`);
    }

    try {
      // Mock tool execution - in real implementation, this would call the MCP server
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const result: MCPExecutionResult = {
        content: [
          {
            type: 'text',
            text: `Tool ${execution.toolName} executed successfully with arguments: ${JSON.stringify(execution.arguments)}`,
          },
        ],
      };

      this.emit('toolExecuted', execution, result);
      return result;
    } catch (error: unknown) {
      const errorResult: MCPExecutionResult = {
        content: [
          {
            type: 'text',
            text: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };

      this.emit('toolExecutionError', execution, error);
      return errorResult;
    }
  }

  /**
   * Get all servers
   */
  getServers(): MCPServer[] {
    return Array.from(this.servers.values());
  }

  /**
   * Get server by ID
   */
  getServer(serverId: string): MCPServer | undefined {
    return this.servers.get(serverId);
  }

  /**
   * Get all available tools across all running servers
   */
  getAllTools(): MCPTool[] {
    const tools: MCPTool[] = [];
    for (const server of this.servers.values()) {
      if (server.status === 'running') {
        tools.push(...server.tools);
      }
    }
    return tools;
  }

  /**
   * Get tools from a specific server
   */
  getServerTools(serverId: string): MCPTool[] {
    const server = this.servers.get(serverId);
    return server?.tools || [];
  }

  /**
   * Start all servers
   */
  async startAllServers(): Promise<void> {
    const startPromises = Array.from(this.servers.keys()).map((serverId) =>
      this.startServer(serverId).catch((error) =>
        logger.error(`Failed to start server ${serverId}:`, error),
      ),
    );
    await Promise.all(startPromises);
  }

  /**
   * Stop all servers
   */
  async stopAllServers(): Promise<void> {
    const stopPromises = Array.from(this.servers.keys()).map((serverId) =>
      this.stopServer(serverId).catch((error) =>
        logger.error(`Failed to stop server ${serverId}:`, error),
      ),
    );
    await Promise.all(stopPromises);
  }

  /**
   * Get available tools organized by server
   */
  getAvailableTools(): Array<{ server: string; tools: MCPTool[] }> {
    const result: Array<{ server: string; tools: MCPTool[] }> = [];
    for (const server of this.servers.values()) {
      if (server.status === 'running' && server.tools.length > 0) {
        result.push({
          server: server.id,
          tools: server.tools,
        });
      }
    }
    return result;
  }

  /**
   * Get server status information
   */
  getServerStatus(): Array<{ id: string; name: string; status: string }> {
    return Array.from(this.servers.values()).map((server) => ({
      id: server.id,
      name: server.name,
      status: server.status,
    }));
  }
}
