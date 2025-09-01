/**
 * Base Service
 * Abstract base class for all services
 */

export abstract class BaseService {
  protected name: string;
  protected config: any;

  constructor(_name: string, config: unknown = {}) {
    this._name = _name;
    this.config = config;
  }

  getName(): string {
    return this.name;
  }

  getConfig(): unknown {
    return this.config;
  }

  abstract initialize(): Promise<void>;
  abstract destroy(): Promise<void>;
}
