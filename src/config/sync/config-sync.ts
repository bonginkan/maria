/**
 * Real-time Configuration Synchronization - Phase 3
 * WebSocket-based configuration sync for distributed systems
 */

import { EventEmitter } from "node:events";
import { ValidatedConfig, ConfigManager } from "../config-manager";

// Sync message types
export enum SyncMessageType {
  CONFIG_UPDATE = "config_update",
  CONFIG_REQUEST = "config_request",
  CONFIG_RESPONSE = "config_response",
  HEARTBEAT = "heartbeat",
  SYNC_REQUEST = "sync_request",
  SYNC_RESPONSE = "sync_response",
  CONFLICT_DETECTED = "conflict_detected",
  CONFLICT_RESOLVED = "conflict_resolved",
  PEER_CONNECTED = "peer_connected",
  PEER_DISCONNECTED = "peer_disconnected",
}

export interface SyncMessage {
  type: SyncMessageType;
  timestamp: number;
  nodeId: string;
  version: number;
  payload: unknown;
  checksum?: string;
}

export interface ConfigUpdate {
  _path: string;
  value: unknown;
  previousValue?: unknown;
  source: "local" | "remote";
  author: string;
  timestamp: number;
}

export interface SyncConflict {
  _path: string;
  localValue: unknown;
  remoteValue: unknown;
  localTimestamp: number;
  remoteTimestamp: number;
  resolutionStrategy: ConflictResolutionStrategy;
}

export enum ConflictResolutionStrategy {
  LAST_WRITE_WINS = "last_write_wins",
  MERGE = "merge",
  MANUAL = "manual",
  LOCAL_WINS = "local_wins",
  REMOTE_WINS = "remote_wins",
}

export interface SyncNode {
  id: string;
  address: string;
  lastSeen: Date;
  version: number;
  status: "connected" | "disconnected" | "syncing";
  latency?: number;
}

export interface SyncOptions {
  nodeId?: string;
  heartbeatInterval?: number;
  syncInterval?: number;
  conflictResolution?: ConflictResolutionStrategy;
  enableCompression?: boolean;
  maxRetries?: number;
  encryption?: boolean;
  channels?: string[];
}

/**
 * Real-time configuration synchronization manager
 */
export class ConfigSyncManager extends EventEmitter {
  private nodeId: string;
  private configManager: ConfigManager;
  private connections: Map<string, any> = new Map(); // WebSocket connections
  private peers: Map<string, SyncNode> = new Map();
  private pendingChanges: Map<string, ConfigUpdate> = new Map();
  private conflicts: Map<string, SyncConflict> = new Map();
  private version: number = 1;
  private options: Required<SyncOptions>;

  private heartbeatTimer?: NodeJS.Timeout;
  private syncTimer?: NodeJS.Timeout;
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(configManager: ConfigManager, options: SyncOptions = {}) {
    super();

    this.configManager = configManager;
    this.nodeId = options.nodeId || this.generateNodeId();

    this.options = {
      nodeId: this.nodeId,
      heartbeatInterval: options.heartbeatInterval || 30000, // 30s
      syncInterval: options.syncInterval || 5000, // 5s
      conflictResolution:
        options.conflictResolution ||
        ConflictResolutionStrategy.LAST_WRITE_WINS,
      enableCompression: options.enableCompression ?? true,
      maxRetries: options.maxRetries || 3,
      encryption: options.encryption ?? true,
      channels: options.channels || ["default"],
    };

    this.setupConfigWatcher();
  }

  /**
   * Start synchronization service
   */
  async start(): Promise<void> {
    try {
      // Start heartbeat
      this.startHeartbeat();

      // Start periodic sync
      this.startPeriodicSync();

      this.emit("syncStarted", { nodeId: this.nodeId });
    } catch (error) {
      this.emit("syncError", error);
      throw error;
    }
  }

  /**
   * Stop synchronization service
   */
  async stop(): Promise<void> {
    // Clear timers
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    // Clear reconnection timers
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();

    // Close all connections
    for (const [peerId, connection] of this.connections) {
      try {
        if (connection.readyState === 1) {
          // WebSocket.OPEN
          connection.close();
        }
      } catch (innerError) {
        console.warn(`Error closing connection to ${peerId}:`, error);
      }
    }

    this.connections.clear();
    this.peers.clear();

    this.emit("syncStopped", { nodeId: this.nodeId });
  }

  /**
   * Connect to a peer node
   */
  async connectToPeer(address: string, nodeId?: string): Promise<void> {
    if (this.connections.has(nodeId || address)) {
      throw new Error(`Already connected to ${nodeId || address}`);
    }

    try {
      // In a real implementation, this would use actual WebSocket
      const connection = await this.createWebSocketConnection(address);
      const peerId = nodeId || this.generatePeerId(address);

      this.connections.set(peerId, connection);
      this.peers.set(peerId, {
        id: peerId,
        address,
        lastSeen: new Date(),
        version: 0,
        status: "connected",
      });

      this.setupConnectionHandlers(peerId, connection);

      // Send initial sync request
      await this.sendSyncRequest(peerId);

      this.emit("peerConnected", { peerId, address });
    } catch (error) {
      this.emit("connectionError", { address, error });
      throw error;
    }
  }

  /**
   * Disconnect from a peer
   */
  async disconnectFromPeer(peerId: string): Promise<void> {
    const connection = this.connections.get(peerId);
    if (connection) {
      connection.close();
      this.connections.delete(peerId);
    }

    const peer = this.peers.get(peerId);
    if (peer) {
      peer.status = "disconnected";
      this.peers.delete(peerId);
    }

    // Clear reconnection timer
    const timer = this.reconnectTimers.get(peerId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(peerId);
    }

    this.emit("peerDisconnected", { peerId });
  }

  /**
   * Broadcast configuration update to all peers
   */
  async broadcastUpdate(
    _path: string,
    value: unknown,
    author: string = "system",
  ): Promise<void> {
    const update: ConfigUpdate = {
      _path,
      value,
      source: "local",
      author,
      timestamp: Date.now(),
    };

    const message: SyncMessage = {
      type: SyncMessageType.CONFIG_UPDATE,
      timestamp: Date.now(),
      nodeId: this.nodeId,
      version: ++this.version,
      payload: update,
      checksum: this.calculateChecksum(update),
    };

    for (const [peerId, connection] of this.connections) {
      try {
        if (connection.readyState === 1) {
          // WebSocket.OPEN
          await this.sendMessage(connection, message);
        }
      } catch (innerError) {
        console.warn(`Failed to send update to ${peerId}:`, error);
        this.handleConnectionError(peerId, error);
      }
    }

    this.emit("updateBroadcast", { update, peers: this.connections.size });
  }

  /**
   * Request full configuration sync from peers
   */
  async requestFullSync(): Promise<void> {
    const message: SyncMessage = {
      type: SyncMessageType.SYNC_REQUEST,
      timestamp: Date.now(),
      nodeId: this.nodeId,
      version: this.version,
      payload: {
        configVersion: this.version,
        requestedSections: ["*"],
      },
    };

    for (const [peerId, connection] of this.connections) {
      try {
        if (connection.readyState === 1) {
          await this.sendMessage(connection, message);
        }
      } catch (error) {
        console.warn(`Failed to request sync from ${peerId}:`, error);
      }
    }
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): {
    nodeId: string;
    version: number;
    peers: SyncNode[];
    pendingChanges: number;
    conflicts: number;
    lastSync?: Date;
  } {
    return {
      nodeId: this.nodeId,
      version: this.version,
      peers: Array.from(this.peers.values()),
      pendingChanges: this.pendingChanges.size,
      conflicts: this.conflicts.size,
    };
  }

  /**
   * Resolve a configuration conflict
   */
  async resolveConflict(
    _path: string,
    strategy: ConflictResolutionStrategy = this.options.conflictResolution,
    customValue?: unknown,
  ): Promise<void> {
    const conflict = this.conflicts.get(_path);
    if (!conflict) {
      throw new Error(`No conflict found for _path: ${_path}`);
    }

    let resolvedValue: unknown;

    switch (strategy) {
      case ConflictResolutionStrategy.LAST_WRITE_WINS:
        resolvedValue =
          conflict.localTimestamp > conflict.remoteTimestamp
            ? conflict.localValue
            : conflict.remoteValue;
        break;

      case ConflictResolutionStrategy.LOCAL_WINS:
        resolvedValue = conflict.localValue;
        break;

      case ConflictResolutionStrategy.REMOTE_WINS:
        resolvedValue = conflict.remoteValue;
        break;

      case ConflictResolutionStrategy.MERGE:
        resolvedValue = this.mergeValues(
          conflict.localValue,
          conflict.remoteValue,
        );
        break;

      case ConflictResolutionStrategy.MANUAL:
        if (customValue === undefined) {
          throw new Error(
            "Custom value required for manual conflict resolution",
          );
        }
        resolvedValue = customValue;
        break;

      default:
        throw new Error(`Unknown conflict resolution strategy: ${strategy}`);
    }

    // Apply resolved value
    try {
      await this.applyConfigurationChange(_path, resolvedValue);
      this.conflicts.delete(_path);

      // Broadcast resolution
      await this.broadcastUpdate(_path, resolvedValue, "conflict-resolver");

      this.emit("conflictResolved", {
        _path,
        strategy,
        resolvedValue,
        originalConflict: conflict,
      });
    } catch (innerError) {
      this.emit("conflictResolutionError", { _path, error: innerError instanceof Error ? innerError.message : String(innerError) });
      throw error;
    }
  }

  /**
   * Setup configuration change watcher
   */
  private setupConfigWatcher(): void {
    // Listen for configuration changes
    this.configManager["on"]?.("change", async (change: any) => {
      if (change.source !== "remote") {
        await this.broadcastUpdate(
          change.key,
          change.newValue,
          change.author || "system",
        );
      }
    });
  }

  /**
   * Create WebSocket connection (mock implementation)
   */
  private async createWebSocketConnection(address: string): Promise<any> {
    // In real implementation, use actual WebSocket
    const mockConnection = {
      readyState: 1, // OPEN
      address,
      send: (data: string) => {
        // Mock send - in real implementation, actually send via WebSocket
        console.log(`Mock send to ${address}:`, data.length, "bytes");
      },
      close: () => {
        // Mock close
        console.log(`Mock close connection to ${address}`);
      },
      on: (event: string, handler: (...args: any[]) => any) => {
        // Mock event handling
        if (event === "message") {
          // Simulate receiving messages
          setTimeout(() => {
            const mockMessage: SyncMessage = {
              type: SyncMessageType.HEARTBEAT,
              timestamp: Date.now(),
              nodeId: this.generatePeerId(address),
              version: 1,
              payload: { status: "alive" },
            };
            handler(JSON.stringify(mockMessage));
          }, 1000);
        }
      },
    };

    return mockConnection;
  }

  /**
   * Setup connection event handlers
   */
  private setupConnectionHandlers(peerId: string, connection: any): void {
    connection.on("message", (data: string) => {
      try {
        const message: SyncMessage = JSON.parse(data);
        this.handleMessage(peerId, message);
      } catch (error) {
        console.warn(`Invalid message from ${peerId}:`, error);
      }
    });

    connection.on("close", () => {
      this.handleConnectionClosed(peerId);
    });

    connection.on("error", (error: any) => {
      this.handleConnectionError(peerId, error);
    });
  }

  /**
   * Handle incoming sync messages
   */
  private async handleMessage(
    peerId: string,
    message: SyncMessage,
  ): Promise<void> {
    // Update peer info
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.lastSeen = new Date();
      peer.version = Math.max(peer.version, message.version);
    }

    switch (message.type) {
      case SyncMessageType.CONFIG_UPDATE:
        await this.handleConfigUpdate(peerId, message.payload as ConfigUpdate);
        break;

      case SyncMessageType.CONFIG_REQUEST:
        await this.handleConfigRequest(peerId, message);
        break;

      case SyncMessageType.SYNC_REQUEST:
        await this.handleSyncRequest(peerId, message);
        break;

      case SyncMessageType.HEARTBEAT:
        // Heartbeat received - peer is alive
        break;

      case SyncMessageType.CONFLICT_DETECTED:
        await this.handleConflictDetected(
          peerId,
          message.payload as SyncConflict,
        );
        break;

      default:
        console.warn(`Unknown message type from ${peerId}: ${message.type}`);
    }
  }

  /**
   * Handle configuration update from peer
   */
  private async handleConfigUpdate(
    peerId: string,
    update: ConfigUpdate,
  ): Promise<void> {
    try {
      // Check for conflicts
      const _currentValue = this.getConfigValue(update._path);
      const hasLocalChange = this.pendingChanges.has(update._path);

      if (hasLocalChange) {
        const localChange = this.pendingChanges.get(update._path)!;
        if (localChange.timestamp !== update.timestamp) {
          // Conflict detected
          const conflict: SyncConflict = {
            _path: update._path,
            localValue: localChange.value,
            remoteValue: update.value,
            localTimestamp: localChange.timestamp,
            remoteTimestamp: update.timestamp,
            resolutionStrategy: this.options.conflictResolution,
          };

          this.conflicts.set(update._path, conflict);
          this.emit("conflictDetected", { peerId, conflict });
          return;
        }
      }

      // Apply update
      await this.applyConfigurationChange(update._path, update.value, "remote");
      this.emit("remoteUpdateApplied", { peerId, update });
    } catch (innerError) {
      this.emit("updateError", { peerId, update, error: innerError instanceof Error ? innerError.message : String(innerError) });
    }
  }

  /**
   * Apply configuration change
   */
  private async applyConfigurationChange(
    _path: string,
    value: unknown,
    source: "local" | "remote" = "local",
  ): Promise<void> {
    // Parse path and apply to configuration
    const pathParts = _path.split(".");
    const key = pathParts[0] as keyof ValidatedConfig;

    try {
      this.configManager.set(key, value as any, source);
    } catch (error) {
      throw new Error(
        `Failed to apply configuration change at ${_path}: ${error}`,
      );
    }
  }

  /**
   * Get configuration value by path
   */
  private getConfigValue(_path: string): unknown {
    const pathParts = _path.split(".");
    const key = pathParts[0] as keyof ValidatedConfig;
    return this.configManager.get(key);
  }

  /**
   * Handle sync request from peer
   */
  private async handleSyncRequest(
    peerId: string,
    _message: SyncMessage,
  ): Promise<void> {
    try {
      const currentConfig = this.configManager.getAll();

      const response: SyncMessage = {
        type: SyncMessageType.SYNC_RESPONSE,
        timestamp: Date.now(),
        nodeId: this.nodeId,
        version: this.version,
        payload: {
          config: currentConfig,
          version: this.version,
        },
        checksum: this.calculateChecksum(currentConfig),
      };

      const connection = this.connections.get(peerId);
      if (connection) {
        await this.sendMessage(connection, response);
      }
    } catch (innerError) {
      console.warn(`Failed to handle sync request from ${peerId}:`, error);
    }
  }

  /**
   * Send sync request to peer
   */
  private async sendSyncRequest(peerId: string): Promise<void> {
    const message: SyncMessage = {
      type: SyncMessageType.SYNC_REQUEST,
      timestamp: Date.now(),
      nodeId: this.nodeId,
      version: this.version,
      payload: {
        requestedSections: ["*"],
      },
    };

    const connection = this.connections.get(peerId);
    if (connection) {
      await this.sendMessage(connection, message);
    }
  }

  /**
   * Send message to connection
   */
  private async sendMessage(
    connection: any,
    message: SyncMessage,
  ): Promise<void> {
    const data = JSON.stringify(message);

    if (this.options.enableCompression) {
      // In real implementation, compress data
    }

    if (this.options.encryption) {
      // In real implementation, encrypt data
    }

    connection.send(data);
  }

  /**
   * Handle connection closed
   */
  private handleConnectionClosed(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.status = "disconnected";
    }

    this.connections.delete(peerId);

    // Schedule reconnection
    const timer = setTimeout(() => {
      if (peer) {
        this.connectToPeer(peer.address, peerId).catch((error) => {
          console.warn(`Reconnection failed for ${peerId}:`, error);
        });
      }
    }, 5000);

    this.reconnectTimers.set(peerId, timer);

    this.emit("peerDisconnected", { peerId });
  }

  /**
   * Handle connection error
   */
  private handleConnectionError(peerId: string, error: any): void {
    this.emit("connectionError", { peerId, error });

    const peer = this.peers.get(peerId);
    if (peer) {
      peer.status = "disconnected";
    }
  }

  /**
   * Handle conflict detected from peer
   */
  private async handleConflictDetected(
    peerId: string,
    conflict: SyncConflict,
  ): Promise<void> {
    this.conflicts.set(conflict._path, conflict);
    this.emit("conflictDetected", { peerId, conflict });
  }

  /**
   * Start heartbeat timer
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const message: SyncMessage = {
        type: SyncMessageType.HEARTBEAT,
        timestamp: Date.now(),
        nodeId: this.nodeId,
        version: this.version,
        payload: { status: "alive" },
      };

      for (const [peerId, connection] of this.connections) {
        try {
          if (connection.readyState === 1) {
            this.sendMessage(connection, message);
          }
        } catch (error) {
          console.warn(`Heartbeat failed for ${peerId}:`, error);
        }
      }
    }, this.options.heartbeatInterval);
  }

  /**
   * Start periodic sync
   */
  private startPeriodicSync(): void {
    this.syncTimer = setInterval(() => {
      if (this.pendingChanges.size > 0) {
        // Process pending changes
        for (const [_path, change] of this.pendingChanges) {
          this.broadcastUpdate(_path, change.value, change.author);
        }
        this.pendingChanges.clear();
      }
    }, this.options.syncInterval);
  }

  /**
   * Generate unique node ID
   */
  private generateNodeId(): string {
    return `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate peer ID from address
   */
  private generatePeerId(address: string): string {
    return `peer-${address.replace(/[^a-zA-Z0-9]/g, "-")}`;
  }

  /**
   * Calculate checksum for data integrity
   */
  private calculateChecksum(data: unknown): string {
    // Simple checksum - in real implementation, use crypto.createHash
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  /**
   * Merge two values for conflict resolution
   */
  private mergeValues(local: unknown, remote: unknown): unknown {
    if (
      typeof local === "object" &&
      typeof remote === "object" &&
      local !== null &&
      remote !== null &&
      !Array.isArray(local) &&
      !Array.isArray(remote)
    ) {
      return { ...(local as any), ...(remote as any) };
    }

    // For non-objects, prefer remote (last write wins)
    return remote;
  }
}
