import { BaseService } from '../../BaseService.js';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';

export interface CollaborationSession {
  id: string;
  name: string;
  createdAt: Date;
  participants: Participant[];
  document: SharedDocument;
  operations: Operation[];
  cursors: Map<string, CursorPosition>;
  selections: Map<string, SelectionRange>;
  status: 'active' | 'paused' | 'ended';
}

export interface Participant {
  id: string;
  name: string;
  email?: string;
  color: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: Date;
  lastActiveAt: Date;
  cursor?: CursorPosition;
  selection?: SelectionRange;
  isOnline: boolean;
}

export interface SharedDocument {
  id: string;
  content: string;
  version: number;
  checksum: string;
  language: string;
  filePath?: string;
}

export interface Operation {
  id: string;
  type: 'insert' | 'delete' | 'replace' | 'format';
  participantId: string;
  timestamp: Date;
  position: number;
  content?: string;
  length?: number;
  version: number;
  transformed?: boolean;
}

export interface CursorPosition {
  line: number;
  column: number;
  participantId: string;
  timestamp: Date;
}

export interface SelectionRange {
  start: { line: number; column: number };
  end: { line: number; column: number };
  participantId: string;
  timestamp: Date;
}

export interface CollaborationEvent {
  type: 'operation' | 'cursor' | 'selection' | 'join' | 'leave' | 'sync';
  sessionId: string;
  participantId: string;
  data: any;
  timestamp: Date;
}

export interface ConflictResolution {
  strategy: 'last-write-wins' | 'operational-transform' | 'crdt' | 'manual';
  conflictingOps: Operation[];
  resolvedOp: Operation;
  participantPriority?: string[];
}

// Operational Transformation algorithm for real-time collaboration
export class OperationalTransform {
  static transformOperation(op1: Operation, op2: Operation): [Operation, Operation] {
    // Transform op1 against op2
    const transformed1 = { ...op1 };
    const transformed2 = { ...op2 };

    if (op1.type === 'insert' && op2.type === 'insert') {
      if (op1.position < op2.position) {
        transformed2.position += op1.content?.length || 0;
      } else if (op1.position > op2.position) {
        transformed1.position += op2.content?.length || 0;
      } else {
        // Same position - resolve by participant ID (deterministic ordering)
        if (op1.participantId < op2.participantId) {
          transformed2.position += op1.content?.length || 0;
        } else {
          transformed1.position += op2.content?.length || 0;
        }
      }
    } else if (op1.type === 'delete' && op2.type === 'delete') {
      const end1 = op1.position + (op1.length || 0);
      const end2 = op2.position + (op2.length || 0);

      if (end1 <= op2.position) {
        transformed2.position -= op1.length || 0;
      } else if (end2 <= op1.position) {
        transformed1.position -= op2.length || 0;
      } else {
        // Overlapping deletes
        const overlapStart = Math.max(op1.position, op2.position);
        const overlapEnd = Math.min(end1, end2);
        const overlapLength = overlapEnd - overlapStart;

        if (op1.position < op2.position) {
          transformed2.position = op1.position;
          transformed2.length = (op2.length || 0) - overlapLength;
        } else {
          transformed1.position = op2.position;
          transformed1.length = (op1.length || 0) - overlapLength;
        }
      }
    } else if (op1.type === 'insert' && op2.type === 'delete') {
      const end2 = op2.position + (op2.length || 0);
      
      if (op1.position <= op2.position) {
        transformed2.position += op1.content?.length || 0;
      } else if (op1.position >= end2) {
        transformed1.position -= op2.length || 0;
      } else {
        // Insert within delete range
        transformed1.position = op2.position;
      }
    } else if (op1.type === 'delete' && op2.type === 'insert') {
      const end1 = op1.position + (op1.length || 0);
      
      if (op2.position <= op1.position) {
        transformed1.position += op2.content?.length || 0;
      } else if (op2.position >= end1) {
        transformed2.position -= op1.length || 0;
      } else {
        // Insert within delete range
        transformed2.position = op1.position;
      }
    }

    transformed1.transformed = true;
    transformed2.transformed = true;

    return [transformed1, transformed2];
  }

  static compose(op1: Operation, op2: Operation): Operation {
    // Compose two operations into a single operation
    if (op1.type === 'insert' && op2.type === 'insert') {
      if (op1.position + (op1.content?.length || 0) === op2.position) {
        // Adjacent inserts
        return {
          ...op1,
          content: (op1.content || '') + (op2.content || ''),
          version: op2.version
        };
      }
    } else if (op1.type === 'delete' && op2.type === 'delete') {
      if (op1.position === op2.position) {
        // Consecutive deletes
        return {
          ...op1,
          length: (op1.length || 0) + (op2.length || 0),
          version: op2.version
        };
      }
    }

    // Cannot compose - return the second operation
    return op2;
  }
}

// CRDT (Conflict-free Replicated Data Type) for eventual consistency
export class CRDT {
  private state: Map<string, { value: any; timestamp: number; participantId: string }> = new Map();

  merge(key: string, value: any, timestamp: number, participantId: string): void {
    const existing = this.state.get(key);
    
    if (!existing || timestamp > existing.timestamp || 
        (timestamp === existing.timestamp && participantId > existing.participantId)) {
      this.state.set(key, { value, timestamp, participantId });
    }
  }

  get(key: string): any {
    return this.state.get(key)?.value;
  }

  getState(): Map<string, any> {
    const result = new Map();
    this.state.forEach((v, k) => result.set(k, v.value));
    return result;
  }
}

export class RealtimeCollaborationEngine extends BaseService {
  private sessions: Map<string, CollaborationSession> = new Map();
  private connections: Map<string, WebSocket> = new Map();
  private eventEmitter: EventEmitter = new EventEmitter();
  private operationBuffer: Map<string, Operation[]> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startSyncInterval();
  }

  private startSyncInterval(): void {
    // Periodic sync to ensure consistency
    this.syncInterval = setInterval(() => {
      this.syncAllSessions();
    }, 5000); // Sync every 5 seconds
  }

  async createSession(
    name: string,
    owner: Participant,
    document: Omit<SharedDocument, 'id' | 'version' | 'checksum'>
  ): Promise<CollaborationSession> {
    const sessionId = this.generateSessionId();
    const docId = this.generateDocumentId();
    
    const session: CollaborationSession = {
      id: sessionId,
      name,
      createdAt: new Date(),
      participants: [{ ...owner, isOnline: true }],
      document: {
        ...document,
        id: docId,
        version: 0,
        checksum: this.calculateChecksum(document.content)
      },
      operations: [],
      cursors: new Map(),
      selections: new Map(),
      status: 'active'
    };

    this.sessions.set(sessionId, session);
    this.operationBuffer.set(sessionId, []);

    console.log(`🤝 Created collaboration session: ${sessionId}`);
    
    return session;
  }

  async joinSession(
    sessionId: string,
    participant: Participant
  ): Promise<CollaborationSession | null> {
    const session = this.sessions.get(sessionId);
    
    if (!session || session.status !== 'active') {
      return null;
    }

    // Add participant if not already present
    const existingIndex = session.participants.findIndex(p => p.id === participant.id);
    
    if (existingIndex === -1) {
      session.participants.push({ ...participant, isOnline: true });
    } else {
      session.participants[existingIndex] = { ...participant, isOnline: true };
    }

    // Broadcast join event
    this.broadcastEvent({
      type: 'join',
      sessionId,
      participantId: participant.id,
      data: participant,
      timestamp: new Date()
    });

    console.log(`👤 ${participant.name} joined session ${sessionId}`);
    
    return session;
  }

  async leaveSession(sessionId: string, participantId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    
    if (!session) return;

    const participant = session.participants.find(p => p.id === participantId);
    if (participant) {
      participant.isOnline = false;
      participant.lastActiveAt = new Date();
    }

    // Remove cursor and selection
    session.cursors.delete(participantId);
    session.selections.delete(participantId);

    // Broadcast leave event
    this.broadcastEvent({
      type: 'leave',
      sessionId,
      participantId,
      data: null,
      timestamp: new Date()
    });

    console.log(`👋 Participant ${participantId} left session ${sessionId}`);
  }

  async applyOperation(
    sessionId: string,
    operation: Omit<Operation, 'id' | 'timestamp' | 'version'>
  ): Promise<Operation | null> {
    const session = this.sessions.get(sessionId);
    
    if (!session || session.status !== 'active') {
      return null;
    }

    // Check participant permissions
    const participant = session.participants.find(p => p.id === operation.participantId);
    if (!participant || participant.role === 'viewer') {
      console.warn(`Participant ${operation.participantId} lacks edit permissions`);
      return null;
    }

    // Create full operation
    const fullOp: Operation = {
      ...operation,
      id: this.generateOperationId(),
      timestamp: new Date(),
      version: session.document.version + 1
    };

    // Transform against buffered operations
    const buffered = this.operationBuffer.get(sessionId) || [];
    let transformedOp = fullOp;
    
    for (const bufOp of buffered) {
      if (bufOp.version >= transformedOp.version) {
        const [transformed, _] = OperationalTransform.transformOperation(transformedOp, bufOp);
        transformedOp = transformed;
      }
    }

    // Apply operation to document
    session.document.content = this.applyOperationToContent(
      session.document.content,
      transformedOp
    );
    session.document.version = transformedOp.version;
    session.document.checksum = this.calculateChecksum(session.document.content);

    // Store operation
    session.operations.push(transformedOp);
    this.operationBuffer.get(sessionId)?.push(transformedOp);

    // Broadcast operation
    this.broadcastEvent({
      type: 'operation',
      sessionId,
      participantId: transformedOp.participantId,
      data: transformedOp,
      timestamp: new Date()
    });

    return transformedOp;
  }

  async updateCursor(
    sessionId: string,
    participantId: string,
    position: Omit<CursorPosition, 'participantId' | 'timestamp'>
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    
    if (!session) return;

    const cursor: CursorPosition = {
      ...position,
      participantId,
      timestamp: new Date()
    };

    session.cursors.set(participantId, cursor);

    // Update participant cursor
    const participant = session.participants.find(p => p.id === participantId);
    if (participant) {
      participant.cursor = cursor;
      participant.lastActiveAt = new Date();
    }

    // Broadcast cursor update
    this.broadcastEvent({
      type: 'cursor',
      sessionId,
      participantId,
      data: cursor,
      timestamp: new Date()
    });
  }

  async updateSelection(
    sessionId: string,
    participantId: string,
    range: Omit<SelectionRange, 'participantId' | 'timestamp'>
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    
    if (!session) return;

    const selection: SelectionRange = {
      ...range,
      participantId,
      timestamp: new Date()
    };

    session.selections.set(participantId, selection);

    // Update participant selection
    const participant = session.participants.find(p => p.id === participantId);
    if (participant) {
      participant.selection = selection;
      participant.lastActiveAt = new Date();
    }

    // Broadcast selection update
    this.broadcastEvent({
      type: 'selection',
      sessionId,
      participantId,
      data: selection,
      timestamp: new Date()
    });
  }

  async resolveConflict(
    sessionId: string,
    conflictingOps: Operation[],
    strategy: ConflictResolution['strategy'] = 'operational-transform'
  ): Promise<Operation> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }

    let resolvedOp: Operation;

    switch (strategy) {
      case 'last-write-wins':
        // Simple: take the most recent operation
        resolvedOp = conflictingOps.reduce((latest, op) => 
          op.timestamp > latest.timestamp ? op : latest
        );
        break;

      case 'operational-transform':
        // Transform all operations against each other
        resolvedOp = conflictingOps[0];
        for (let i = 1; i < conflictingOps.length; i++) {
          const [transformed, _] = OperationalTransform.transformOperation(
            resolvedOp,
            conflictingOps[i]
          );
          resolvedOp = transformed;
        }
        break;

      case 'crdt':
        // Use CRDT for automatic resolution
        const crdt = new CRDT();
        conflictingOps.forEach(op => {
          crdt.merge(
            `op_${op.position}`,
            op,
            op.timestamp.getTime(),
            op.participantId
          );
        });
        resolvedOp = crdt.get(`op_${conflictingOps[0].position}`) || conflictingOps[0];
        break;

      case 'manual':
        // Require manual resolution (return first for now)
        resolvedOp = conflictingOps[0];
        console.warn('Manual conflict resolution required');
        break;

      default:
        resolvedOp = conflictingOps[0];
    }

    // Apply resolved operation
    await this.applyOperation(sessionId, resolvedOp);

    return resolvedOp;
  }

  async getSessionState(sessionId: string): Promise<CollaborationSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  async syncSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    
    if (!session) return;

    // Verify document consistency
    const calculatedChecksum = this.calculateChecksum(session.document.content);
    
    if (calculatedChecksum !== session.document.checksum) {
      console.warn(`Checksum mismatch in session ${sessionId}, resyncing...`);
      
      // Rebuild document from operations
      let content = '';
      let version = 0;
      
      for (const op of session.operations) {
        content = this.applyOperationToContent(content, op);
        version = op.version;
      }
      
      session.document.content = content;
      session.document.version = version;
      session.document.checksum = this.calculateChecksum(content);
    }

    // Clear old operations buffer
    const buffer = this.operationBuffer.get(sessionId);
    if (buffer && buffer.length > 100) {
      // Keep only last 50 operations
      this.operationBuffer.set(sessionId, buffer.slice(-50));
    }

    // Broadcast sync event
    this.broadcastEvent({
      type: 'sync',
      sessionId,
      participantId: 'system',
      data: {
        document: session.document,
        participants: session.participants.filter(p => p.isOnline),
        cursors: Array.from(session.cursors.values()),
        selections: Array.from(session.selections.values())
      },
      timestamp: new Date()
    });
  }

  private syncAllSessions(): void {
    this.sessions.forEach((session, sessionId) => {
      if (session.status === 'active') {
        this.syncSession(sessionId).catch(err => 
          console.error(`Error syncing session ${sessionId}:`, err)
        );
      }
    });
  }

  private applyOperationToContent(content: string, operation: Operation): string {
    switch (operation.type) {
      case 'insert':
        return content.slice(0, operation.position) + 
               (operation.content || '') + 
               content.slice(operation.position);
      
      case 'delete':
        return content.slice(0, operation.position) + 
               content.slice(operation.position + (operation.length || 0));
      
      case 'replace':
        return content.slice(0, operation.position) + 
               (operation.content || '') + 
               content.slice(operation.position + (operation.length || 0));
      
      default:
        return content;
    }
  }

  private broadcastEvent(event: CollaborationEvent): void {
    // Emit to local listeners
    this.eventEmitter.emit('collaboration-event', event);

    // Broadcast to WebSocket connections
    const message = JSON.stringify(event);
    this.connections.forEach((ws, participantId) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  onCollaborationEvent(
    callback: (event: CollaborationEvent) => void
  ): () => void {
    this.eventEmitter.on('collaboration-event', callback);
    
    // Return unsubscribe function
    return () => {
      this.eventEmitter.off('collaboration-event', callback);
    };
  }

  async establishWebSocketConnection(
    participantId: string,
    ws: WebSocket
  ): Promise<void> {
    this.connections.set(participantId, ws);

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleWebSocketMessage(participantId, message);
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      this.connections.delete(participantId);
      console.log(`WebSocket connection closed for ${participantId}`);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for ${participantId}:`, error);
    });
  }

  private async handleWebSocketMessage(participantId: string, message: any): Promise<void> {
    switch (message.type) {
      case 'operation':
        await this.applyOperation(message.sessionId, {
          ...message.data,
          participantId
        });
        break;
      
      case 'cursor':
        await this.updateCursor(message.sessionId, participantId, message.data);
        break;
      
      case 'selection':
        await this.updateSelection(message.sessionId, participantId, message.data);
        break;
      
      case 'sync':
        await this.syncSession(message.sessionId);
        break;
      
      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private generateDocumentId(): string {
    return `doc_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private calculateChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  dispose(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.connections.forEach(ws => ws.close());
    this.connections.clear();
    this.sessions.clear();
    this.operationBuffer.clear();
    this.eventEmitter.removeAllListeners();
  }

  // Statistics and monitoring
  getStatistics(): {
    activeSessions: number;
    totalParticipants: number;
    totalOperations: number;
    activeConnections: number;
  } {
    let totalParticipants = 0;
    let totalOperations = 0;

    this.sessions.forEach(session => {
      totalParticipants += session.participants.filter(p => p.isOnline).length;
      totalOperations += session.operations.length;
    });

    return {
      activeSessions: Array.from(this.sessions.values()).filter(s => s.status === 'active').length,
      totalParticipants,
      totalOperations,
      activeConnections: this.connections.size
    };
  }
}