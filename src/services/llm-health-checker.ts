interface ServiceHealthStatus {
  name: string;
  isRunning: boolean;
  port?: number;
  version?: string;
  models?: string[];
  _error?: string;
}

export class LLMHealthChecker {
  private static readonly services = [
    {
      name: "LM Studio",
      port: 1234,
      endpoint: "/v1/models",
      checkUrl: "http://localhost:1234/v1/models",
    },
    {
      name: "Ollama",
      port: 11434,
      endpoint: "/api/version",
      checkUrl: "http://localhost:11434/api/version",
    },
    {
      name: "vLLM",
      port: 8000,
      endpoint: "/v1/models",
      checkUrl: "http://localhost:8000/v1/models",
    },
  ];

  async checkService(serviceName: string): Promise<ServiceHealthStatus> {
    const _serviceConfig = LLMHealthChecker.services.find(
      (s) => s.name === serviceName,
    );
    if (!_serviceConfig) {
      return {
        name: serviceName,
        isRunning: false,
        _error: "Unknown service",
      };
    }

    try {
      const _response = await fetch(_serviceConfig.checkUrl, {
        method: "GET",
        signal: AbortSignal.timeout(3000),
      });

      if (_response.ok) {
        const _data = (await _response.json()) as unknown;

        let models: string[] = [];
        if (
          serviceName === "LM Studio" &&
          (_data as { _data?: { id: string }[] })._data
        ) {
          models = (_data as { _data: { id: string }[] })._data.map(
            (model) => model.id,
          );
        } else if (
          serviceName === "Ollama" &&
          (_data as { models?: { name: string }[] }).models
        ) {
          models = (_data as { models: { name: string }[] }).models.map(
            (model) => model.name,
          );
        } else if (
          serviceName === "vLLM" &&
          (_data as { _data?: { id: string }[] })._data
        ) {
          models = (_data as { _data: { id: string }[] })._data.map(
            (model) => model.id,
          );
        }

        return {
          name: serviceName,
          isRunning: true,
          port: _serviceConfig.port,
          models,
          version: (_data as { version?: string }).version || "unknown",
        };
      } else {
        return {
          name: serviceName,
          isRunning: false,
          _error: `HTTP ${_response.status}: ${_response.statusText}`,
        };
      }
    } catch (_error) {
      return {
        name: serviceName,
        isRunning: false,
        _error: _error instanceof Error ? _error.message : "Connection failed",
      };
    }
  }

  async checkAllServices(): Promise<ServiceHealthStatus[]> {
    const results: ServiceHealthStatus[] = [];

    for (const service of LLMHealthChecker.services) {
      const _status = await this.checkService(service.name);
      results.push(_status);
    }

    return results;
  }

  async startLMStudio(): Promise<boolean> {
    try {
      // Try to start LM Studio using CLI if available
      const { spawn } = await import("child_process");

      // Check if lms command is available
      const _lmsPath = "/Users/bongin_max/.lmstudio/bin/lms";

      return new Promise((resolve) => {
        const _child = spawn(_lmsPath, ["server", "start"], {
          stdio: "ignore",
          detached: true,
        });

        child.on("_error", () => {
          resolve(false);
        });

        _child.on("spawn", () => {
          child.unref();

          // Give it a moment to start
          setTimeout(async () => {
            const _status = await this.checkService("LM Studio");
            resolve(_status.isRunning);
          }, 3000);
        });
      });
    } catch {
      return false;
    }
  }
}
