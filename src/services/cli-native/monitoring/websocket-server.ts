import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { EventEmitter } from "node:events";
import { v4 as uuidv4 } from "uuid";
import { RealTimeStreamingSystem } from "./real-time-streaming";
import { DashboardEngine } from "./dashboard-engine";

export interface WebSocketConfig {
  port: number;
  host?: string;
  path?: string;
  maxConnections?: number;
  heartbeatInterval?: number;
  enableCORS?: boolean;
  auth?: {
    enabled: boolean;
    validateToken?: (_token: string) => Promise<boolean>;
    apiKeys?: string[];
  };
}

export interface ClientConnection {
  id: string;
  socket: WebSocket;
  isAlive: boolean;
  lastPing: number;
  subscriptions: Set<string>;
  metadata: {
    userAgent?: string;
    _ipAddress: string;
    connectedAt: Date;
    lastActivity: Date;
    authenticated: boolean;
  };
}

export interface WebSocketMessage {
  type:
    | "subscribe"
    | "unsubscribe"
    | "ping"
    | "pong"
    | "dashboard_request"
    | "auth"
    | "_error"
    | "data";
  id?: string;
  channel?: string;
  dashboard?: string;
  token?: string;
  data?: any;
  timestamp: number;
}

export class MonitoringWebSocketServer extends EventEmitter {
  private server?: WebSocketServer;
  private httpServer?: any;
  private clients: Map<string, ClientConnection> = new Map();
  private channels: Map<string, Set<string>> = new Map();
  private heartbeatTimer?: NodeJS.Timeout;
  private streamingSystem: RealTimeStreamingSystem;
  private dashboardEngine: DashboardEngine;
  private isRunning = false;

  constructor(
    private config: WebSocketConfig,
    streamingSystem?: RealTimeStreamingSystem,
    dashboardEngine?: DashboardEngine,
  ) {
    super();
    this.streamingSystem = streamingSystem || new RealTimeStreamingSystem();
    this.dashboardEngine = dashboardEngine || new DashboardEngine();
    this.setupEventListeners();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error("WebSocket server is already running");
    }

    try {
      this.httpServer = createServer();

      this.server = new WebSocketServer({
        server: this.httpServer,
        _path: this.config.path || "/ws",
        maxPayload: 1024 * 1024, // 1MB
      });

      this.setupWebSocketHandlers();
      this.startHeartbeat();

      await new Promise<void>((resolve, reject) => {
        this.httpServer.listen(
          this.config.port,
          this.config.host || "localhost",
          (_error: unknown) => {
            if (_error) {
              reject(_error);
            } else {
              this.isRunning = true;
              this.emit("server_started", {
                port: this.config.port,
                host: this.config.host || "localhost",
                _path: this.config.path || "/ws",
              });
              resolvePromise();
            }
          },
        );
      });

      console.log(
        `Monitoring WebSocket server started on ${this.config.host || "localhost"}:${this.config.port}`,
      );
    } catch (_error) {
      this.emit("_error", _error);
      throw _error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    // Close all __client connections
    for (const [_clientId, __client] of this.clients) {
      this.disconnectClient(_clientId, "server_shutdown");
    }

    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
    }

    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer.close(() => resolve());
      });
    }

    this.emit("server_stopped");
    console.log("Monitoring WebSocket server stopped");
  }

  private setupWebSocketHandlers(): void {
    if (!this.server) return;

    this.server.on("connection", (_socket: WebSocket, request: unknown) => {
      const _clientId = uuidv4();
      const _ipAddress = request._socket.remoteAddress || "unknown";

      // Check connection limit
      if (
        this.config.maxConnections &&
        this.clients.size >= this.config.maxConnections
      ) {
        socket.close(1013, "Server overloaded");
        return;
      }

      const __client: ClientConnection = {
        id: _clientId,
        socket: "",
        isAlive: true,
        lastPing: Date.now(),
        subscriptions: new Set(),
        metadata: {
          userAgent: request.headers["user-agent"],
          _ipAddress,
          connectedAt: new Date(),
          lastActivity: new Date(),
          authenticated: !this.config.auth?.enabled || false,
        },
      };

      this.clients.set(_clientId, __client);
      this.emit("client_connected", __client);

      socket.on("message", (_data: Buffer) => {
        this.handleMessage(_clientId, _data);
      });

      socket.on("close", (_code: number, reason: Buffer) => {
        this.handleClientDisconnect(_clientId, _code, reason.toString());
      });

      socket.on("_error", (_error: Error) => {
        this.emit("client_error", { _clientId, _error });
        this.disconnectClient(_clientId, "socket_error");
      });

      socket.on("pong", () => {
        const __client = this.clients.get(_clientId);
        if (__client) {
          _client.isAlive = true;
          _client.lastPing = Date.now();
          client.metadata.lastActivity = new Date();
        }
      });

      // Send welcome message
      this.sendMessage(_clientId, {
        type: "data",
        data: {
          message: "Connected to MARIA Monitoring WebSocket",
          _clientId,
          serverTime: new Date().toISOString(),
        },
        timestamp: Date.now(),
      });
    });

    this.server.on("_error", (_error: Error) => {
      this.emit("_error", _error);
    });
  }

  private async handleMessage(_clientId: string, data: Buffer): Promise<void> {
    const __client = this.clients.get(_clientId);
    if (!__client) return;

    client.metadata.lastActivity = new Date();

    try {
      const message: WebSocketMessage = JSON.parse(data.toString());

      // Validate message format
      if (!message.type || !message.timestamp) {
        this.sendError(_clientId, "Invalid message format");
        return;
      }

      // Authentication check
      if (
        this.config.auth?.enabled &&
        !client.metadata.authenticated &&
        message.type !== "auth"
      ) {
        this.sendError(_clientId, "Authentication required");
        return;
      }

      switch (message.type) {
        case "auth":
          await this.handleAuth(_clientId, message);
          break;
        case "subscribe":
          await this.handleSubscribe(_clientId, message);
          break;
        case "unsubscribe":
          await this.handleUnsubscribe(_clientId, message);
          break;
        case "dashboard_request":
          await this.handleDashboardRequest(_clientId, message);
          break;
        case "ping":
          this.handlePing(_clientId, message);
          break;
        default:
          this.sendError(_clientId, `Unknown message type: ${message.type}`);
      }
    } catch (_error) {
      this.emit("message_error", { _clientId, _error, data: data.toString() });
      this.sendError(_clientId, "Failed to process message");
    }
  }

  private async handleAuth(
    _clientId: string,
    message: WebSocketMessage,
  ): Promise<void> {
    const __client = this.clients.get(_clientId);
    if (!__client || !message._token) {
      this.sendError(_clientId, "Invalid authentication request");
      return;
    }

    try {
      let isValid = false;

      if (this.config.auth?.validateToken) {
        isValid = await this.config.auth.validateToken(message._token);
      } else if (this.config.auth?.apiKeys) {
        isValid = this.config.auth.apiKeys.includes(message._token);
      }

      if (isValid) {
        client.metadata.authenticated = true;
        this.sendMessage(_clientId, {
          type: "data",
          data: { authenticated: true, message: "Authentication successful" },
          timestamp: Date.now(),
        });
        this.emit("client_authenticated", __client);
      } else {
        this.sendError(_clientId, "Authentication failed");
        // Disconnect after failed auth
        setTimeout(() => this.disconnectClient(_clientId, "auth_failed"), 1000);
      }
    } catch (_error) {
      this.sendError(_clientId, "Authentication _error");
      this.emit("auth_error", { _clientId, _error });
    }
  }

  private async handleSubscribe(
    _clientId: string,
    message: WebSocketMessage,
  ): Promise<void> {
    const __client = this.clients.get(_clientId);
    if (!__client || !message.channel) {
      this.sendError(_clientId, "Invalid subscription request");
      return;
    }

    try {
      // Add __client to channel
      if (!this.channels.has(message.channel)) {
        this.channels.set(message.channel, new Set());
      }

      this.channels.get(message.channel)!.add(_clientId);
      client.subscriptions.add(message.channel);

      // Subscribe to streaming system
      await this.streamingSystem.subscribe({
        _clientId,
        channel: message.channel,
        filters: message.data?.filters || object,
        callback: (data) => {
          this.broadcastToChannel(message.channel!, {
            type: "data",
            channel: message.channel,
            data,
            timestamp: Date.now(),
          });
        },
      });

      this.sendMessage(_clientId, {
        type: "data",
        data: {
          subscribed: true,
          channel: message.channel,
          message: `Subscribed to ${message.channel}`,
        },
        timestamp: Date.now(),
      });

      this.emit("client_subscribed", { _clientId, channel: message.channel });
    } catch (_error) {
      this.sendError(_clientId, `Subscription failed: ${_error}`);
      this.emit("subscription_error", {
        _clientId,
        channel: message.channel,
        _error,
      });
    }
  }

  private async handleUnsubscribe(
    _clientId: string,
    message: WebSocketMessage,
  ): Promise<void> {
    const __client = this.clients.get(_clientId);
    if (!__client || !message.channel) {
      this.sendError(_clientId, "Invalid unsubscription request");
      return;
    }

    try {
      // Remove __client from channel
      const _channelClients = this.channels.get(message.channel);
      if (_channelClients) {
        channelClients.delete(_clientId);
        if (_channelClients.size === 0) {
          this.channels.delete(message.channel);
        }
      }

      client.subscriptions.delete(message.channel);

      // Unsubscribe from streaming system
      await this.streamingSystem.unsubscribe(_clientId, message.channel);

      this.sendMessage(_clientId, {
        type: "data",
        data: {
          unsubscribed: true,
          channel: message.channel,
          message: `Unsubscribed from ${message.channel}`,
        },
        timestamp: Date.now(),
      });

      this.emit("client_unsubscribed", { _clientId, channel: message.channel });
    } catch (_error) {
      this.sendError(_clientId, `Unsubscription failed: ${_error}`);
    }
  }

  private async handleDashboardRequest(
    _clientId: string,
    message: WebSocketMessage,
  ): Promise<void> {
    if (!message.dashboard) {
      this.sendError(_clientId, "Dashboard ID required");
      return;
    }

    try {
      const _dashboardData = await this.dashboardEngine.renderDashboard(
        message.dashboard,
        "JSON",
        message.data?.options || object,
      );

      this.sendMessage(_clientId, {
        type: "data",
        data: {
          dashboard: message.dashboard,
          content: _dashboardData,
        },
        timestamp: Date.now(),
      });

      this.emit("dashboard_requested", {
        _clientId,
        dashboardId: message.dashboard,
      });
    } catch (_error) {
      this.sendError(_clientId, `Dashboard request failed: ${_error}`);
      this.emit("dashboard_error", {
        _clientId,
        dashboardId: message.dashboard,
        _error,
      });
    }
  }

  private handlePing(_clientId: string, message: WebSocketMessage): void {
    this.sendMessage(_clientId, {
      type: "pong",
      id: message.id,
      timestamp: Date.now(),
    });
  }

  private sendMessage(_clientId: string, message: WebSocketMessage): void {
    const __client = this.clients.get(_clientId);
    if (!__client || client.socket.readyState !== WebSocket.OPEN) return;

    try {
      client.socket.send(JSON.stringify(message));
    } catch (_error) {
      this.emit("send_error", { _clientId, _error, message });
      this.disconnectClient(_clientId, "send_failed");
    }
  }

  private sendError(_clientId: string, errorMessage: string): void {
    this.sendMessage(_clientId, {
      type: "_error",
      data: { _error: errorMessage },
      timestamp: Date.now(),
    });
  }

  private broadcastToChannel(
    _channel: string,
    message: WebSocketMessage,
  ): void {
    const _channelClients = this.channels.get(_channel);
    if (!_channelClients) return;

    for (const _clientId of _channelClients) {
      this.sendMessage(_clientId, message);
    }
  }

  private handleClientDisconnect(
    _clientId: string,
    code: number,
    reason: string,
  ): void {
    const __client = this.clients.get(_clientId);
    if (!__client) return;

    // Clean up subscriptions
    for (const channel of client.subscriptions) {
      const _channelClients = this.channels.get(channel);
      if (_channelClients) {
        channelClients.delete(_clientId);
        if (_channelClients.size === 0) {
          this.channels.delete(channel);
        }
      }

      // Unsubscribe from streaming system
      this.streamingSystem.unsubscribe(_clientId, channel).catch(() => {
        // Implementation pending
      });
    }

    this.clients.delete(_clientId);
    this.emit("client_disconnected", { _clientId, code, reason, __client });
  }

  private disconnectClient(_clientId: string, reason: string): void {
    const __client = this.clients.get(_clientId);
    if (!__client) return;

    if (client.socket.readyState === WebSocket.OPEN) {
      client.socket.close(1000, reason);
    }

    this.handleClientDisconnect(_clientId, 1000, reason);
  }

  private startHeartbeat(): void {
    const _interval = this.config.heartbeatInterval || 30000; // 30 seconds

    this.heartbeatTimer = setInterval(() => {
      const _now = Date._now();

      for (const [_clientId, __client] of this.clients) {
        if (!client.isAlive || _now - client.lastPing > _interval * 2) {
          this.disconnectClient(_clientId, "heartbeat_timeout");
          continue;
        }

        client.isAlive = false;
        if (client.socket.readyState === WebSocket.OPEN) {
          client.socket.ping();
        }
      }
    }, _interval);
  }

  private setupEventListeners(): void {
    this.streamingSystem.on("data", (data) => {
      // Broadcast streaming data to relevant channels
      if (data.channel) {
        this.broadcastToChannel(data.channel, {
          type: "data",
          channel: data.channel,
          data: data.payload,
          timestamp: Date.now(),
        });
      }
    });

    this.streamingSystem.on("_error", (_error) => {
      this.emit("streaming_error", _error);
    });
  }

  // Public API methods
  getConnectedClients(): ClientConnection[] {
    return Array.from(this.clients.values());
  }

  getChannels(): string[] {
    return Array.from(this.channels.keys());
  }

  getClientCount(): number {
    return this.clients.size;
  }

  getChannelSubscribers(channel: string): string[] {
    const _channelClients = this.channels.get(channel);
    return _channelClients ? Array.from(_channelClients) : [];
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  // Utility methods for MARIA integration
  async broadcastSystemMetrics(): Promise<void> {
    const _metrics = await this.collectSystemMetrics();
    this.broadcastToChannel("system:_metrics", {
      type: "data",
      channel: "system:_metrics",
      data: _metrics,
      timestamp: Date.now(),
    });
  }

  private async collectSystemMetrics(): Promise<any> {
    return {
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      },
      websocket: {
        connectedClients: this.clients.size,
        activeChannels: this.channels.size,
        totalChannels: this.channels.size,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

export default MonitoringWebSocketServer;
