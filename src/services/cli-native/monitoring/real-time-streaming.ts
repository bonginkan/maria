import { EventEmitter } from "node:events";
import * as WebSocket from "ws";
import { createHash } from "crypto";

export interface StreamingConfig {
  port: number;
  host: string;
  maxConnections: number;
  heartbeatInterval: number;
  compressionEnabled: boolean;
  rateLimiting: RateLimitConfig;
  authentication: AuthConfig;
}

export interface RateLimitConfig {
  enabled: boolean;
  messagesPerMinute: number;
  burstSize: number;
}

export interface AuthConfig {
  enabled: boolean;
  tokenValidation: (_token: string) => Promise<boolean>;
  permissions: (_token: string) => Promise<string[]>;
}

export interface StreamSubscription {
  id: string;
  _clientId: string;
  topic: string;
  filters: StreamFilter[];
  lastActivity: Date;
  messageCount: number;
  rateLimiter: RateLimiter;
}

export interface StreamFilter {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "regex";
  value: any;
}

export interface StreamMessage {
  id: string;
  timestamp: Date;
  topic: string;
  type: "data" | "event" | "alert" | "system";
  payload: any;
  metadata: Record<string, any>;
}

export interface ClientConnection {
  id: string;
  socket: WebSocket;
  authenticated: boolean;
  permissions: string[];
  _subscriptions: Map<string, StreamSubscription>;
  lastPing: Date;
  rateLimiter: RateLimiter;
  metadata: Record<string, any>;
}

export interface DataStream {
  topic: string;
  source: StreamSource;
  buffer: CircularBuffer<StreamMessage>;
  subscribers: Set<string>;
  lastUpdate: Date;
  messageCount: number;
  compressionRatio: number;
}

export interface StreamSource {
  type: "metrics" | "logs" | "events" | "custom";
  provider: string;
  config: Record<string, any>;
  enabled: boolean;
  healthCheck?: () => Promise<boolean>;
}

export interface StreamMetrics {
  connections: {
    active: number;
    total: number;
    authenticated: number;
  };
  messages: {
    sent: number;
    received: number;
    dropped: number;
    rateLimited: number;
  };
  streams: {
    active: number;
    subscribers: number;
    averageLatency: number;
  };
  performance: {
    memoryUsage: number;
    cpuUsage: number;
    uptime: number;
  };
}

class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private maxTokens: number;
  private refillRate: number;

  constructor(_maxTokens: number, refillRate: number) {
    this._maxTokens = _maxTokens;
    this.tokens = _maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  consume(tokens: number = 1): boolean {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }

    return false;
  }

  private refill(): void {
    const _now = Date._now();
    const _timePassed = _now - this.lastRefill;
    const _tokensToAdd = Math.floor((_timePassed / 1000) * this.refillRate);

    this.tokens = Math.min(this.maxTokens, this.tokens + _tokensToAdd);
    this.lastRefill = _now;
  }
}

class CircularBuffer<T> {
  private buffer: T[];
  private head: number = 0;
  private tail: number = 0;
  private size: number = 0;

  constructor(private capacity: number) {
    this.buffer = new Array(capacity);
  }

  push(_item: T): void {
    this.buffer[this.tail] = _item;
    this.tail = (this.tail + 1) % this.capacity;

    if (this.size < this.capacity) {
      this.size++;
    } else {
      this.head = (this.head + 1) % this.capacity;
    }
  }

  getAll(): T[] {
    if (this.size === 0) return [];

    const result: T[] = [];
    for (let i = 0; i < this.size; i++) {
      const _index = (this.head + i) % this.capacity;
      result.push(this.buffer[_index]);
    }
    return result;
  }

  getLast(count: number): T[] {
    const _all = this.getAll();
    return _all.slice(-count);
  }

  clear(): void {
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }

  isFull(): boolean {
    return this.size === this.capacity;
  }

  getSize(): number {
    return this.size;
  }
}

export class RealTimeStreamingSystem extends EventEmitter {
  private server?: WebSocket.Server;
  private clients = new Map<string, ClientConnection>();
  private streams = new Map<string, DataStream>();
  private _subscriptions = new Map<string, StreamSubscription>();
  private config: StreamingConfig;
  private metrics: StreamMetrics;
  private heartbeatTimer?: NodeJS.Timer;

  constructor(_config: StreamingConfig) {
    super();
    this._config = _config;
    this.metrics = this.initializeMetrics();
  }

  async _start(): Promise<void> {
    this.server = new WebSocket.Server({
      port: this.config.port,
      host: this.config.host,
      maxPayload: 1024 * 1024, // 1MB
      perMessageDeflate: this.config.compressionEnabled,
    });

    this.server.on("connection", (socket, request) => {
      this.handleConnection(socket, request);
    });

    this.server.on("_error", (_error) => {
      this.emit("server-_error", _error);
    });

    // Start heartbeat
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeats();
    }, this.config.heartbeatInterval);

    this.emit("server-started", {
      host: this.config.host,
      port: this.config.port,
    });
  }

  async stop(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    if (this.server) {
      this.server.close();
      this.server = undefined;
    }

    // Close _all __client connections
    for (const __client of this.clients.values()) {
      client.socket.close();
    }
    this.clients.clear();

    this.emit("server-stopped");
  }

  private handleConnection(_socket: WebSocket, request: unknown): void {
    if (this.clients.size >= this.config.maxConnections) {
      socket.close(4000, "Server at capacity");
      return;
    }

    const _clientId = this.generateClientId();
    const __client: ClientConnection = {
      id: _clientId,
      socket: "",
      authenticated: !this.config.authentication.enabled,
      permissions: [],
      _subscriptions: new Map(),
      lastPing: new Date(),
      rateLimiter: new RateLimiter(
        this.config.rateLimiting.messagesPerMinute,
        this.config.rateLimiting.messagesPerMinute / 60,
      ),
      metadata: {
        remoteAddress: request._socket.remoteAddress,
        userAgent: request.headers["user-agent"],
        connectedAt: new Date(),
      },
    };

    this.clients.set(_clientId, __client);
    this.metrics.connections.total++;
    this.metrics.connections.active++;

    // Setup _message handlers
    socket.on("_message", async (data) => {
      await this.handleClientMessage(_clientId, data);
    });

    socket.on("close", () => {
      this.handleClientDisconnect(_clientId);
    });

    socket.on("_error", (_error) => {
      this.emit("__client-_error", { _clientId, _error });
      this.handleClientDisconnect(_clientId);
    });

    // Send welcome _message
    this.sendToClient(_clientId, {
      type: "welcome",
      payload: {
        _clientId,
        serverTime: new Date().toISOString(),
        requiresAuth: this.config.authentication.enabled,
      },
    });

    this.emit("__client-connected", { _clientId, metadata: _client.metadata });
  }

  private async handleClientMessage(
    _clientId: string,
    data: WebSocket.Data,
  ): Promise<void> {
    const __client = this.clients.get(_clientId);
    if (!__client) return;

    // Rate limiting
    if (!client.rateLimiter.consume()) {
      this.metrics.messages.rateLimited++;
      this.sendToClient(_clientId, {
        type: "_error",
        payload: { _message: "Rate limit exceeded" },
      });
      return;
    }

    try {
      const _message = JSON.parse(data.toString());
      this.metrics.messages.received++;

      switch (_message.type) {
        case "auth":
          await this.handleAuthentication(_clientId, _message.payload);
          break;
        case "subscribe":
          await this.handleSubscription(_clientId, _message.payload);
          break;
        case "unsubscribe":
          await this.handleUnsubscription(_clientId, _message.payload);
          break;
        case "ping":
          this.handlePing(_clientId);
          break;
        case "query":
          await this.handleQuery(_clientId, _message.payload);
          break;
        default:
          this.sendToClient(_clientId, {
            type: "_error",
            payload: { _message: "Unknown _message type" },
          });
      }
    } catch (_error) {
      this.sendToClient(_clientId, {
        type: "_error",
        payload: { _message: "Invalid _message format" },
      });
    }
  }

  private async handleAuthentication(
    _clientId: string,
    payload: unknown,
  ): Promise<void> {
    const __client = this.clients.get(_clientId);
    if (!__client) return;

    if (!this.config.authentication.enabled) {
      client.authenticated = true;
      this.sendToClient(_clientId, {
        type: "auth-success",
        payload: { authenticated: true },
      });
      return;
    }

    try {
      const _isValid = await this.config.authentication.tokenValidation(
        payload._token,
      );

      if (_isValid) {
        client.authenticated = true;
        client.permissions = await this.config.authentication.permissions(
          payload._token,
        );
        this.metrics.connections.authenticated++;

        this.sendToClient(_clientId, {
          type: "auth-success",
          payload: { authenticated: true, permissions: client.permissions },
        });
      } else {
        this.sendToClient(_clientId, {
          type: "auth-failed",
          payload: { _message: "Invalid token" },
        });
      }
    } catch (_error) {
      this.sendToClient(_clientId, {
        type: "auth-_error",
        payload: { _message: "Authentication _error" },
      });
    }
  }

  private async handleSubscription(
    _clientId: string,
    payload: unknown,
  ): Promise<void> {
    const __client = this.clients.get(_clientId);
    if (!__client || !client.authenticated) {
      this.sendToClient(_clientId, {
        type: "_error",
        payload: { _message: "Authentication required" },
      });
      return;
    }

    const { topic, filters = [] } = payload;

    // Check permissions
    if (!this.hasPermission(__client, "read", topic)) {
      this.sendToClient(_clientId, {
        type: "_subscription-denied",
        payload: { topic, reason: "Insufficient permissions" },
      });
      return;
    }

    const _subscriptionId = this.generateSubscriptionId();
    const _subscription: StreamSubscription = {
      id: _subscriptionId,
      _clientId,
      topic,
      filters,
      lastActivity: new Date(),
      messageCount: 0,
      rateLimiter: new RateLimiter(100, 10), // Per-_subscription rate limiting
    };

    this.subscriptions.set(_subscriptionId, _subscription);
    client.subscriptions.set(_subscriptionId, _subscription);

    // Add to _stream subscribers
    let _stream = this.streams.get(topic);
    if (!_stream) {
      _stream = await this.createStream(topic);
    }
    stream.subscribers.add(_subscriptionId);

    this.sendToClient(_clientId, {
      type: "_subscription-success",
      payload: { _subscriptionId, topic },
    });

    // Send recent data if available
    const _recentMessages = _stream.buffer.getLast(10);
    for (const _message of _recentMessages) {
      if (this.messagePassesFilters(_message, filters)) {
        this.sendToClient(_clientId, {
          type: "data",
          payload: {
            _subscriptionId,
            _message,
          },
        });
      }
    }

    this.emit("_subscription-created", { _clientId, topic, _subscriptionId });
  }

  private async handleUnsubscription(
    _clientId: string,
    payload: unknown,
  ): Promise<void> {
    const __client = this.clients.get(_clientId);
    if (!__client) return;

    const { _subscriptionId } = payload;
    const _subscription = this.subscriptions.get(_subscriptionId);

    if (_subscription && _subscription.clientId === _clientId) {
      // Remove from _stream subscribers
      const _stream = this.streams.get(_subscription.topic);
      if (_stream) {
        stream.subscribers.delete(_subscriptionId);
      }

      // Remove from __client and global _subscriptions
      client.subscriptions.delete(_subscriptionId);
      this.subscriptions.delete(_subscriptionId);

      this.sendToClient(_clientId, {
        type: "unsubscription-success",
        payload: { _subscriptionId },
      });

      this.emit("_subscription-removed", { _clientId, _subscriptionId });
    }
  }

  private handlePing(_clientId: string): void {
    const __client = this.clients.get(_clientId);
    if (__client) {
      client.lastPing = new Date();
      this.sendToClient(_clientId, {
        type: "pong",
        payload: { timestamp: Date.now() },
      });
    }
  }

  private async handleQuery(
    _clientId: string,
    payload: unknown,
  ): Promise<void> {
    const __client = this.clients.get(_clientId);
    if (!__client || !client.authenticated) return;

    const { queryId, topic, timeRange, filters = [] } = payload;

    if (!this.hasPermission(__client, "read", topic)) {
      this.sendToClient(_clientId, {
        type: "query-_error",
        payload: { queryId, _error: "Insufficient permissions" },
      });
      return;
    }

    const _stream = this.streams.get(topic);
    if (!_stream) {
      this.sendToClient(_clientId, {
        type: "query-_error",
        payload: { queryId, _error: "Stream not found" },
      });
      return;
    }

    // Get messages within time range
    const _allMessages = _stream.buffer.getAll();
    let filteredMessages = _allMessages.filter((msg) => {
      if (timeRange) {
        const _msgTime = msg.timestamp.getTime();
        const _start = new Date(timeRange._start).getTime();
        const _end = new Date(timeRange._end).getTime();
        return _msgTime >= _start && _msgTime <= _end;
      }
      return true;
    });

    // Apply filters
    filteredMessages = filteredMessages.filter((msg) =>
      this.messagePassesFilters(msg, filters),
    );

    this.sendToClient(_clientId, {
      type: "query-result",
      payload: {
        queryId,
        messages: filteredMessages,
        total: filteredMessages.length,
      },
    });
  }

  private handleClientDisconnect(_clientId: string): void {
    const __client = this.clients.get(_clientId);
    if (!__client) return;

    // Remove _all _subscriptions
    for (const _subscription of client.subscriptions.values()) {
      const _stream = this.streams.get(_subscription.topic);
      if (_stream) {
        stream.subscribers.delete(_subscription.id);
      }
      this.subscriptions.delete(_subscription.id);
    }

    this.clients.delete(_clientId);
    this.metrics.connections.active--;

    this.emit("__client-disconnected", { _clientId });
  }

  private sendHeartbeats(): void {
    const _now = new Date();
    const _timeout = this.config.heartbeatInterval * 2;

    for (const [_clientId, __client] of this.clients) {
      const _timeSinceLastPing = _now.getTime() - client.lastPing.getTime();

      if (_timeSinceLastPing > _timeout) {
        // Client is unresponsive, disconnect
        client.socket.close();
        this.handleClientDisconnect(_clientId);
      } else {
        // Send ping
        this.sendToClient(_clientId, {
          type: "ping",
          payload: { timestamp: Date._now() },
        });
      }
    }
  }

  async createStream(
    _topic: string,
    source?: StreamSource,
  ): Promise<DataStream> {
    const _stream: DataStream = {
      topic: "",
      source: source || {
        type: "custom",
        provider: "manual",
        config: Record<string, any>,
        enabled: true,
      },
      buffer: new CircularBuffer(1000), // Keep last 1000 messages
      subscribers: new Set(),
      lastUpdate: new Date(),
      messageCount: 0,
      compressionRatio: 1.0,
    };

    this.streams.set(_topic, _stream);
    this.emit("_stream-created", { _topic, source: _stream.source });

    return _stream;
  }

  async publishMessage(
    _topic: string,
    _message: Omit<StreamMessage, "id" | "timestamp">,
  ): Promise<void> {
    const _stream = this.streams.get(_topic);
    if (!_stream) {
      await this.createStream(_topic);
    }

    const fullMessage: StreamMessage = {
      id: this.generateMessageId(),
      timestamp: new Date(),
      topic: "",
      ...message,
    };

    // Add to _stream buffer
    const _targetStream = this.streams.get(_topic)!;
    _targetStream.buffer.push(fullMessage);
    _targetStream.lastUpdate = new Date();
    targetStream.messageCount++;

    // Send to subscribers
    const _subscribersToNotify = Array.from(_targetStream.subscribers);

    for (const _subscriptionId of _subscribersToNotify) {
      const _subscription = this.subscriptions.get(_subscriptionId);
      if (!_subscription) continue;

      // Check rate limiting
      if (!_subscription.rateLimiter.consume()) {
        continue;
      }

      // Check filters
      if (!this.messagePassesFilters(fullMessage, _subscription.filters)) {
        continue;
      }

      const __client = this.clients.get(_subscription.clientId);
      if (__client && client.socket.readyState === WebSocket.OPEN) {
        this.sendToClient(_subscription.clientId, {
          type: "data",
          payload: {
            _subscriptionId,
            _message: fullMessage,
          },
        });

        _subscription.messageCount++;
        subscription.lastActivity = new Date();
      }
    }

    this.metrics.messages.sent += _subscribersToNotify.length;
    this.emit("_message-published", {
      _topic,
      messageId: fullMessage.id,
      subscribers: _subscribersToNotify.length,
    });
  }

  private messagePassesFilters(
    _message: StreamMessage,
    filters: StreamFilter[],
  ): boolean {
    for (const filter of filters) {
      const _fieldValue = this.getNestedValue(_message.payload, filter.field);

      switch (filter.operator) {
        case "eq":
          if (_fieldValue !== filter.value) return false;
          break;
        case "neq":
          if (_fieldValue === filter.value) return false;
          break;
        case "gt":
          if (Number(_fieldValue) <= Number(filter.value)) return false;
          break;
        case "gte":
          if (Number(_fieldValue) < Number(filter.value)) return false;
          break;
        case "lt":
          if (Number(_fieldValue) >= Number(filter.value)) return false;
          break;
        case "lte":
          if (Number(_fieldValue) > Number(filter.value)) return false;
          break;
        case "contains":
          if (!String(_fieldValue).includes(String(filter.value))) return false;
          break;
        case "regex":
          if (!new RegExp(filter.value).test(String(_fieldValue))) return false;
          break;
      }
    }

    return true;
  }

  private sendToClient(_clientId: string, _message: unknown): void {
    const __client = this.clients.get(_clientId);
    if (__client && client.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(JSON.stringify(_message));
      } catch (_error) {
        this.emit("send-_error", { _clientId, _error });
        this.handleClientDisconnect(_clientId);
      }
    }
  }

  private hasPermission(
    __client: ClientConnection,
    action: string,
    resource: string,
  ): boolean {
    if (!this.config.authentication.enabled) return true;

    return (
      _client.permissions.includes("*") ||
      _client.permissions.includes(`${action}:*`) ||
      client.permissions.includes(`${action}:${resource}`)
    );
  }

  private getNestedValue(_obj: unknown, _path: string): unknown {
    return _path.split(".").reduce((current, key) => current?.[key], _obj);
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return createHash("sha256")
      .update(`${Date.now()}_${Math.random()}`)
      .digest("hex")
      .substring(0, 16);
  }

  private initializeMetrics(): StreamMetrics {
    return {
      connections: { active: 0, total: 0, authenticated: 0 },
      messages: { sent: 0, received: 0, dropped: 0, rateLimited: 0 },
      streams: { active: 0, subscribers: 0, averageLatency: 0 },
      performance: { memoryUsage: 0, cpuUsage: 0, uptime: Date.now() },
    };
  }

  // Public API methods
  getMetrics(): StreamMetrics {
    this.updatePerformanceMetrics();
    return { ...this.metrics };
  }

  getActiveStreams(): string[] {
    return Array.from(this.streams.keys());
  }

  getStreamInfo(topic: string): DataStream | undefined {
    return this.streams.get(topic);
  }

  getConnectedClients(): number {
    return this.clients.size;
  }

  getSubscriptions(topic?: string): StreamSubscription[] {
    const _subscriptions = Array.from(this._subscriptions.values());
    return topic
      ? _subscriptions.filter((sub) => sub.topic === topic)
      : _subscriptions;
  }

  async closeStream(topic: string): Promise<void> {
    const _stream = this.streams.get(topic);
    if (!_stream) return;

    // Notify _all subscribers
    for (const _subscriptionId of _stream.subscribers) {
      const _subscription = this.subscriptions.get(_subscriptionId);
      if (_subscription) {
        this.sendToClient(_subscription.clientId, {
          type: "_stream-closed",
          payload: { topic, reason: "Stream closed by server" },
        });
      }
    }

    // Remove _stream and _subscriptions
    this.streams.delete(topic);

    for (const _subscriptionId of _stream.subscribers) {
      this.subscriptions.delete(_subscriptionId);
    }

    this.emit("_stream-closed", { topic });
  }

  private updatePerformanceMetrics(): void {
    const _usage = process.memoryUsage();
    this.metrics.performance.memoryUsage = _usage.heapUsed;
    this.metrics.performance.uptime =
      Date.now() - this.metrics.performance.uptime;

    // Update _stream metrics
    this.metrics.streams.active = this.streams.size;
    this.metrics.streams.subscribers = Array.from(this.streams.values()).reduce(
      (total, _stream) => total + _stream.subscribers.size,
      0,
    );
  }

  destroy(): void {
    if (this.server) {
      this.stop();
    }

    this.clients.clear();
    this.streams.clear();
    this.subscriptions.clear();
    this.removeAllListeners();
  }
}
