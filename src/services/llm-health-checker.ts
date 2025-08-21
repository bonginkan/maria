interface ServiceHealthStatus {
  name: string;
  isRunning: boolean;
  port?: number;
  version?: string;
  models?: string[];
  error?: string;
}

export class LLMHealthChecker {
  private static readonly services = [
    {
      name: 'LM Studio',
      port: 1234,
      endpoint: '/v1/models',
      checkUrl: 'http://localhost:1234/v1/models',
    },
    {
      name: 'Ollama',
      port: 11434,
      endpoint: '/api/version',
      checkUrl: 'http://localhost:11434/api/version',
    },
    {
      name: 'vLLM',
      port: 8000,
      endpoint: '/v1/models',
      checkUrl: 'http://localhost:8000/v1/models',
    },
  ];

  async checkService(serviceName: string): Promise<ServiceHealthStatus> {
    const serviceConfig = LLMHealthChecker.services.find((s) => s.name === serviceName);
    if (!serviceConfig) {
      return {
        name: serviceName,
        isRunning: false,
        error: 'Unknown service',
      };
    }

    try {
      const response = await fetch(serviceConfig.checkUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) {
        const data = (await response.json()) as unknown;

        let models: string[] = [];
        if (serviceName === 'LM Studio' && (data as { data?: { id: string }[] }).data) {
          models = (data as { data: { id: string }[] }).data.map((model) => model.id);
        } else if (serviceName === 'Ollama' && (data as { models?: { name: string }[] }).models) {
          models = (data as { models: { name: string }[] }).models.map((model) => model.name);
        } else if (serviceName === 'vLLM' && (data as { data?: { id: string }[] }).data) {
          models = (data as { data: { id: string }[] }).data.map((model) => model.id);
        }

        return {
          name: serviceName,
          isRunning: true,
          port: serviceConfig.port,
          models,
          version: (data as { version?: string }).version || 'unknown',
        };
      } else {
        return {
          name: serviceName,
          isRunning: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
    } catch (error) {
      return {
        name: serviceName,
        isRunning: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  async checkAllServices(): Promise<ServiceHealthStatus[]> {
    const results: ServiceHealthStatus[] = [];

    for (const service of LLMHealthChecker.services) {
      const status = await this.checkService(service.name);
      results.push(status);
    }

    return results;
  }

  async startLMStudio(): Promise<boolean> {
    try {
      // Try to start LM Studio using CLI if available
      const { spawn } = await import('child_process');

      // Check if lms command is available
      const lmsPath = '/Users/bongin_max/.lmstudio/bin/lms';

      return new Promise((resolve) => {
        const child = spawn(lmsPath, ['server', 'start'], {
          stdio: 'ignore',
          detached: true,
        });

        child.on('error', () => {
          resolve(false);
        });

        child.on('spawn', () => {
          child.unref();

          // Give it a moment to start
          setTimeout(async () => {
            const status = await this.checkService('LM Studio');
            resolve(status.isRunning);
          }, 3000);
        });
      });
    } catch {
      return false;
    }
  }
}
