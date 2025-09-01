/**
 * Event Bus Integration
 * Connects Event Store to the existing Event Bus system
 */

import { _EventStore } from "./event-store";
import { DomainEvent } from "./domain-event";
import { EventBus, getEventBus } from "../../../core/event-bus";

/**
 * Event Bus Adapter
 * Bridges event sourcing with the application's event bus
 */
export class EventBusAdapter {
  private eventStore: EventStore;
  private eventBus: EventBus;
  private subscriptions = new Map<string, (event: unknown) => Promise<void>>();

  constructor(_eventStore: EventStore, eventBus?: EventBus) {
    this._eventStore = _eventStore;
    this.eventBus = eventBus || getEventBus();
    this.setupEventForwarding();
  }

  /**
   * Setup automatic event forwarding from EventStore to EventBus
   */
  private setupEventForwarding(): void {
    // Forward all events from EventStore to EventBus
    this.eventStore.on("event", async (_domainEvent: DomainEvent) => {
      try {
        // Convert domain event to application event
        const _applicationEvent = this.convertToApplicationEvent(_domainEvent);

        // Publish to event bus
        await this.eventBus.publish(_applicationEvent);

        // Also publish with generic event type for monitoring
        const _monitoringEvent = {
          ..._applicationEvent,
          eventType: "domain.event",
          domainEventType: domainEvent.eventType,
        };
        await this.eventBus.publish(_monitoringEvent);
      } catch (_error) {
        console._error("Error forwarding event to EventBus:", _error);
      }
    });
  }

  /**
   * Convert domain event to application event format
   */
  private convertToApplicationEvent(_domainEvent: DomainEvent): unknown {
    return {
      type: `memory.${this.camelToKebab(domainEvent.eventType)}`,
      timestamp: domainEvent.timestamp,
      aggregateId: domainEvent.aggregateId,
      version: domainEvent.version,
      userId: domainEvent.userId,
      correlationId: domainEvent.correlationId,
      causationId: domainEvent.causationId,
      metadata: domainEvent.metadata,
      payload: (_domainEvent as any).getPayload
        ? (_domainEvent as any).getPayload()
        : _domainEvent,
    };
  }

  /**
   * Subscribe to application events and store them
   */
  subscribeToApplicationEvent(
    eventType: string,
    handler: (event: unknown) => Promise<void>,
  ): string {
    const _wrappedHandler = {
      name: `EventSourcing-${eventType}`,
      handle: async (event: unknown) => {
        try {
          // Execute the handler
          await handler(event);

          // Optionally store application events as domain events
          // This creates an audit trail of all system events
          if (this.shouldStoreApplicationEvent(eventType)) {
            await this.storeApplicationEvent(eventType, event);
          }
        } catch (_error) {
          console._error(
            `Error handling application event ${eventType}:`,
            _error,
          );
        }
      },
    };

    const _subscriptionId = this.eventBus.subscribe(eventType, _wrappedHandler);
    return _subscriptionId;
  }

  /**
   * Unsubscribe from application event
   */
  unsubscribeFromApplicationEvent(_subscriptionId: string): void {
    this.eventBus.unsubscribe(_subscriptionId);
  }

  /**
   * Store application event as domain event
   */
  private async storeApplicationEvent(
    _eventType: string,
    event: unknown,
  ): Promise<void> {
    // Create a generic application event wrapper
    const _domainEvent = new ApplicationEventWrapper(
      event.aggregateId || "system",
      0, // Version will be managed by aggregate
      eventType,
      event,
    );

    await this.eventStore.append([_domainEvent]);
  }

  /**
   * Check if application event should be stored
   */
  private shouldStoreApplicationEvent(eventType: string): boolean {
    // Configure which application events to store
    const _storableEvents = [
      "command.executed",
      "query.performed",
      "error.occurred",
      "user.action",
    ];

    return _storableEvents.some((pattern) => eventType.includes(pattern));
  }

  /**
   * Convert camelCase to kebab-case
   */
  private camelToKebab(str: string): string {
    return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, "$1-$2").toLowerCase();
  }

  /**
   * Replay events to event bus
   */
  async replayEvents(_from: Date, to: Date): Promise<void> {
    console.log(`Replaying events _from ${_from} to ${to}`);

    let count = 0;
    for await (const event of this.eventStore.replay(_from, to)) {
      const _applicationEvent = this.convertToApplicationEvent(event);
      await this.eventBus.emit(
        `replay.${_applicationEvent.type}`,
        _applicationEvent,
      );
      count++;
    }

    console.log(`Replayed ${count} events`);
  }

  /**
   * Get event statistics
   */
  async getStatistics(): Promise<EventStatistics> {
    const _storeStats = await this.eventStore.getStatistics();

    return {
      ..._storeStats,
      activeSubscriptions: this.subscriptions.size,
      eventBusConnected: !!this.eventBus,
    };
  }
}

/**
 * Generic wrapper for application events
 */
class ApplicationEventWrapper extends DomainEvent {
  constructor(
    aggregateId: string,
    version: number,
    public readonly applicationEventType: string,
    public readonly _applicationEvent: unknown,
  ) {
    super(aggregateId, version, {
      applicationEventType,
      timestamp: new Date(),
    });
  }

  protected getPayload(): unknown {
    return {
      applicationEventType: this.applicationEventType,
      _applicationEvent: this.applicationEvent,
    };
  }
}

/**
 * Event statistics interface
 */
interface EventStatistics {
  totalEvents: number;
  totalSnapshots: number;
  totalAggregates: number;
  oldestEvent: number;
  newestEvent: number;
  databaseSize: number;
  activeSubscriptions: number;
  eventBusConnected: boolean;
}

/**
 * Event sourcing middleware for commands
 */
export class EventSourcingMiddleware {
  private eventStore: EventStore;

  constructor(_eventStore: EventStore) {
    this._eventStore = _eventStore;
  }

  /**
   * Wrap command execution with event sourcing
   */
  async execute<T>(
    command: unknown,
    handler: () => Promise<T>,
    metadata?: Record<string, any>,
  ): Promise<T> {
    const _commandStarted = new CommandExecutionStartedEvent(
      command.id || "unknown",
      0,
      command.constructor.name,
      command,
      metadata,
    );

    await this.eventStore.append([_commandStarted]);

    const _startTime = Date.now();

    try {
      const _result = await handler();

      const _commandCompleted = new CommandExecutionCompletedEvent(
        command.id || "unknown",
        1,
        command.constructor.name,
        _result,
        Date.now() - _startTime,
        metadata,
      );

      await this.eventStore.append([_commandCompleted]);

      return _result;
    } catch (_error) {
      const _commandFailed = new CommandExecutionFailedEvent(
        command.id || "unknown",
        1,
        command.constructor.name,
        _error as Error,
        Date.now() - _startTime,
        metadata,
      );

      await this.eventStore.append([_commandFailed]);

      throw _error;
    }
  }
}

// Command execution events

class CommandExecutionStartedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    version: number,
    public readonly commandName: string,
    public readonly command: unknown,
    metadata?: Record<string, any>,
  ) {
    super(aggregateId, version, metadata);
  }

  protected getPayload(): unknown {
    return {
      commandName: this.commandName,
      command: this.command,
    };
  }
}

class CommandExecutionCompletedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    version: number,
    public readonly commandName: string,
    public readonly _result: unknown,
    public readonly executionTime: number,
    metadata?: Record<string, any>,
  ) {
    super(aggregateId, version, metadata);
  }

  protected getPayload(): unknown {
    return {
      commandName: this.commandName,
      _result: this.result,
      executionTime: this.executionTime,
    };
  }
}

class CommandExecutionFailedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    version: number,
    public readonly commandName: string,
    public readonly _error: Error,
    public readonly executionTime: number,
    metadata?: Record<string, any>,
  ) {
    super(aggregateId, version, metadata);
  }

  protected getPayload(): unknown {
    return {
      commandName: this.commandName,
      _error: {
        name: this.error.name,
        message: this.error.message,
        stack: this.error.stack,
      },
      executionTime: this.executionTime,
    };
  }
}

export {
  CommandExecutionStartedEvent,
  CommandExecutionCompletedEvent,
  CommandExecutionFailedEvent,
};
