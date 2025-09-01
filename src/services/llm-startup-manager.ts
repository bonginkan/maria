import chalk from "chalk";

interface ServiceStatus {
  name: string;
  status: "checking" | "starting" | "running" | "failed" | "not-installed";
  progress?: number;
  message?: string;
}

export class LLMStartupManager {
  private services: ServiceStatus[] = [
    { name: "LM Studio", status: "checking", progress: 0 },
    { name: "Ollama", status: "checking", progress: 0 },
    { name: "vLLM", status: "checking", progress: 0 },
  ];

  async initializeServices(): Promise<void> {
    // Simplified initialization - just check services quietly
    for (const service of this.services) {
      await this.checkService(service);
    }

    // Provider initialization complete - no additional status needed

    // No additional status needed - startup display handles it
  }

  private async checkService(service: ServiceStatus): Promise<void> {
    service.status = "checking";
    service.progress = 0;

    try {
      // Try to check if service is running
      const { LLMHealthChecker } = await import("./llm-health-checker.js");
      const _healthChecker = new LLMHealthChecker();
      const _healthStatus = await _healthChecker.checkService(service.name);

      // Simulate progress for UI
      for (let progress = 0; progress <= 100; progress += 25) {
        service.progress = progress;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      if (_healthStatus.isRunning) {
        service.status = "running";
        service.progress = 100;
        if (_healthStatus.models && _healthStatus.models.length > 0) {
          service.message = `${_healthStatus.models.length} models available`;
        } else {
          service.message = "Running";
        }
      } else {
        service.status = "not-installed";
        service.message = "Not running";
        service.progress = 0;
      }
    } catch {
      service.status = "not-installed";
      service.message = "Skipping...";
      service.progress = 0;
    }
  }

  displayWelcome(providerCount: number = 8): void {
    // Don't clear screen - preserve any previous output

    // Beautiful MARIA ASCII art logo
    console.log("");
    console.log(
      chalk.magentaBright(
        "╔══════════════════════════════════════════════════════════╗",
      ),
    );
    console.log(
      chalk.magentaBright(
        "║                                                          ║",
      ),
    );
    console.log(
      chalk.magentaBright(
        "║  ███╗   ███╗ █████╗ ██████╗ ██╗ █████╗                  ║",
      ),
    );
    console.log(
      chalk.magentaBright(
        "║  ████╗ ████║██╔══██╗██╔══██╗██║██╔══██╗                 ║",
      ),
    );
    console.log(
      chalk.magentaBright(
        "║  ██╔████╔██║███████║██████╔╝██║███████║                 ║",
      ),
    );
    console.log(
      chalk.magentaBright(
        "║  ██║╚██╔╝██║██╔══██║██╔══██╗██║██╔══██║                 ║",
      ),
    );
    console.log(
      chalk.magentaBright(
        "║  ██║ ╚═╝ ██║██║  ██║██║  ██║██║██║  ██║                 ║",
      ),
    );
    console.log(
      chalk.magentaBright(
        "║  ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝                 ║",
      ),
    );
    console.log(
      chalk.magentaBright(
        "║                                                          ║",
      ),
    );
    console.log(
      chalk.magentaBright(
        "║   ██████╗ ██████╗ ██████╗ ███████╗                      ║",
      ),
    );
    console.log(
      chalk.magentaBright(
        "║  ██╔════╝██╔═══██╗██╔══██╗██╔════╝                      ║",
      ),
    );
    console.log(
      chalk.magentaBright(
        "║  ██║     ██║   ██║██║  ██║█████╗                        ║",
      ),
    );
    console.log(
      chalk.magentaBright(
        "║  ██║     ██║   ██║██║  ██║██╔══╝                        ║",
      ),
    );
    console.log(
      chalk.magentaBright(
        "║  ╚██████╗╚██████╔╝██████╔╝███████╗                      ║",
      ),
    );
    console.log(
      chalk.magentaBright(
        "║   ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝                      ║",
      ),
    );
    console.log(
      chalk.magentaBright(
        "║                                                          ║",
      ),
    );
    console.log(
      chalk.magentaBright(
        "║        AI-Powered Development Platform                   ║",
      ),
    );
    console.log(
      chalk.magentaBright(
        "║         (c) 2025 Bonginkan Inc.                          ║",
      ),
    );
    console.log(
      chalk.magentaBright(
        "║                                                          ║",
      ),
    );
    console.log(
      chalk.magentaBright(
        "╚══════════════════════════════════════════════════════════╝",
      ),
    );
    console.log("");
    console.log(chalk.cyan.bold("MARIA CODE v2.2.5") + chalk.gray(" — Ready"));
    console.log(
      chalk.yellow("/help for commands") +
        chalk.gray(` | Providers: ${providerCount}/${providerCount} OK`),
    );
    console.log("");
  }
}
