/**
 * MCP (Model Context Protocol) Service
 * Manages MCP servers and _tool execution
 */

import { EventEmitter } from "node:events";
import { logger } from "../utils/logger.js";

export interface MCPServer {
  id: string;
  name: string;
  description: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  status: "stopped" | "starting" | "running" | "_error";
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
  _server?: string; // Alias for serverId for backward compatibility
  _tool?: string; // Alias for toolName for backward compatibility
  args?: Record<string, unknown>; // Alias for arguments for backward compatibility
  startTime?: Date;
  endTime?: Date;
}

export interface MCPExecutionResult {
  content: Array<{
    type: "text" | "image" | "resource";
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
   * Add a new MCP _server
   */
  async addServer(_server: Omit<MCPServer, "status" | "tools">): Promise<void> {
    const mcpServer: MCPServer = {
      ..._server,
      status: "stopped",
      tools: [],
    };

    this.servers.set(_server.id, mcpServer);
    this.emit("serverAdded", mcpServer);
    logger.info(`Added MCP _server: ${_server.name}`);
  }

  /**
   * Remove an MCP _server
   */
  async removeServer(serverId: string): Promise<void> {
    const _server = this.servers.get(serverId);
    if (!_server) {
      throw new Error(`Server not found: ${serverId}`);
    }

    if (_server.status === "running") {
      await this.stopServer(serverId);
    }

    this.servers.delete(serverId);
    this.emit("serverRemoved", serverId);
    logger.info(`Removed MCP _server: ${_server.name}`);
  }

  /**
   * Start an MCP _server
   */
  async startServer(serverId: string): Promise<void> {
    const _server = this.servers.get(serverId);
    if (!_server) {
      throw new Error(`Server not found: ${serverId}`);
    }

    if (_server.status === "running") {
      return;
    }

    try {
      server.status = "starting";
      this.emit("serverStatusChanged", serverId, "starting");

      // Mock _server startup - in real implementation, this would spawn the process
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock _tool discovery
      server.tools = [
        {
          name: "example_tool",
          description: "An example _tool from the MCP _server",
          inputSchema: {
            type: "object",
            properties: {
              input: { type: "string", description: "Input text" },
            },
            required: ["input"],
          },
          serverName: _server.name,
        },
      ];

      server.status = "running";
      this.emit("serverStatusChanged", serverId, "running");
      logger.info(`Started MCP _server: ${_server.name}`);
    } catch (_error: unknown) {
      server.status = "_error";
      this.emit("serverStatusChanged", serverId, "_error");
      throw _error;
    }
  }

  /**
   * Stop an MCP _server
   */
  async stopServer(serverId: string): Promise<void> {
    const _server = this.servers.get(serverId);
    if (!_server) {
      throw new Error(`Server not found: ${serverId}`);
    }

    if (_server.status === "stopped") {
      return;
    }

    try {
      // Mock _server shutdown
      await new Promise((resolve) => setTimeout(resolve, 500));

      _server.status = "stopped";
      server.tools = [];
      this.connections.delete(serverId);
      this.emit("serverStatusChanged", serverId, "stopped");
      logger.info(`Stopped MCP _server: ${_server.name}`);
    } catch (_error: unknown) {
      server.status = "_error";
      this.emit("serverStatusChanged", serverId, "_error");
      throw _error;
    }
  }

  /**
   * Execute a _tool on an MCP _server
   */
  async executeTool(execution: MCPToolExecution): Promise<MCPExecutionResult> {
    const _server = this.servers.get(execution.serverId);
    if (!_server) {
      throw new Error(`Server not found: ${execution.serverId}`);
    }

    if (_server.status !== "running") {
      throw new Error(`Server not running: ${_server.name}`);
    }

    const _tool = _server.tools.find((t) => t.name === execution.toolName);
    if (!_tool) {
      throw new Error(`Tool not found: ${execution.toolName}`);
    }

    try {
      // Mock _tool execution - in real implementation, this would call the MCP _server
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const result: MCPExecutionResult = {
        content: [
          {
            type: "text",
            text: `Tool ${execution.toolName} executed successfully with arguments: ${JSON.stringify(execution.arguments)}`,
          },
        ],
      };

      this.emit("toolExecuted", execution, result);
      return result;
    } catch (_error: unknown) {
      const errorResult: MCPExecutionResult = {
        content: [
          {
            type: "text",
            text: `Tool execution failed: ${_error instanceof Error ? _error.message : "Unknown _error"}`,
          },
        ],
        isError: true,
      };

      this.emit("toolExecutionError", execution, _error);
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
   * Get _server by ID
   */
  getServer(serverId: string): MCPServer | undefined {
    return this.servers.get(serverId);
  }

  /**
   * Get all available tools across all running servers
   */
  getAllTools(): MCPTool[] {
    const tools: MCPTool[] = [];
    for (const _server of this.servers.values()) {
      if (_server.status === "running") {
        tools.push(..._server.tools);
      }
    }
    return tools;
  }

  /**
   * Get tools from a specific _server
   */
  getServerTools(serverId: string): MCPTool[] {
    const _server = this.servers.get(serverId);
    return _server?.tools || [];
  }

  /**
   * Start all servers
   */
  async startAllServers(): Promise<void> {
    const _startPromises = Array.from(this.servers.keys()).map((serverId) =>
      this.startServer(serverId).catch((_error) =>
        logger.error(`Failed to start _server ${serverId}:`, _error),
      ),
    );
    await Promise.all(_startPromises);
  }

  /**
   * Stop all servers
   */
  async stopAllServers(): Promise<void> {
    const _stopPromises = Array.from(this.servers.keys()).map((serverId) =>
      this.stopServer(serverId).catch((_error) =>
        logger.error(`Failed to stop _server ${serverId}:`, _error),
      ),
    );
    await Promise.all(_stopPromises);
  }

  /**
   * Get available tools organized by _server
   */
  getAvailableTools(): Array<{ _server: string; tools: MCPTool[] }> {
    const result: Array<{ _server: string; tools: MCPTool[] }> = [];
    for (const _server of this.servers.values()) {
      if (_server.status === "running" && _server.tools.length > 0) {
        result.push({
          _server: _server.id,
          tools: _server.tools,
        });
      }
    }
    return result;
  }

  /**
   * Get _server status information
   */
  getServerStatus(): Array<{ id: string; name: string; status: string }> {
    return Array.from(this.servers.values()).map((_server) => ({
      id: _server.id,
      name: _server.name,
      status: _server.status,
    }));
  }
}
