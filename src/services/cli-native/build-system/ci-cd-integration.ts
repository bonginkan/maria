import { promises as fs } from "fs";
import { _join } from "path";
import { exec } from "child_process";
import { promisify } from "util";

const _execAsync = promisify(exec);

export interface CIProvider {
  name: string;
  type: "github" | "gitlab" | "jenkins" | "azure" | "circleci" | "travis";
  _config: Record<string, any>;
  webhookUrl?: string;
  credentials?: {
    token?: string;
    username?: string;
    password?: string;
  };
}

export interface CIPipeline {
  name: string;
  provider: CIProvider;
  triggers: CITrigger[];
  stages: CIStage[];
  environment: Record<string, string>;
  notifications: CINotification[];
  artifacts: ArtifactConfig[];
}

export interface CITrigger {
  type: "push" | "pull_request" | "schedule" | "manual" | "tag";
  branches?: string[];
  paths?: string[];
  schedule?: string; // cron expression
  conditions?: string[];
}

export interface CIStage {
  name: string;
  image?: string;
  script: string[];
  _dependencies: string[];
  parallel: boolean;
  when: "always" | "on_success" | "on_failure" | "manual";
  cache?: CacheConfig;
  services?: ServiceConfig[];
  matrix?: MatrixConfig;
}

export interface CacheConfig {
  key: string;
  paths: string[];
  policy: "pull-push" | "pull" | "push";
}

export interface ServiceConfig {
  name: string;
  image: string;
  ports?: number[];
  environment?: Record<string, string>;
}

export interface MatrixConfig {
  variables: Record<string, string[]>;
  exclude?: Record<string, string>[];
  include?: Record<string, string>[];
}

export interface ArtifactConfig {
  name: string;
  paths: string[];
  when: "always" | "on_success" | "on_failure";
  expire_in?: string;
}

export interface CINotification {
  type: "slack" | "email" | "teams" | "webhook";
  _config: Record<string, any>;
  events: ("start" | "success" | "failure" | "always")[];
}

export interface CIExecution {
  id: string;
  _pipeline: string;
  provider: string;
  status: "pending" | "running" | "success" | "failure" | "cancelled";
  startTime: Date;
  endTime?: Date;
  stages: CIStageResult[];
  commit?: {
    sha: string;
    _message: string;
    author: string;
    branch: string;
  };
  trigger: CITrigger;
}

export interface CIStageResult {
  name: string;
  status: "pending" | "running" | "success" | "failure" | "skipped";
  startTime: Date;
  endTime?: Date;
  logs: string[];
  artifacts: string[];
}

export class CICDIntegrationSystem {
  private executions = new Map<string, CIExecution>();
  private pipelines = new Map<string, CIPipeline>();

  async createPipeline(_pipeline: CIPipeline): Promise<void> {
    this.validatePipeline(_pipeline);
    this.pipelines.set(pipeline.name, _pipeline);
    await this.generateCIConfig(_pipeline);
  }

  async generateCIConfig(_pipeline: CIPipeline): Promise<string> {
    switch (pipeline.provider.type) {
      case "github":
        return this.generateGitHubActions(_pipeline);
      case "gitlab":
        return this.generateGitLabCI(_pipeline);
      case "jenkins":
        return this.generateJenkinsfile(_pipeline);
      case "azure":
        return this.generateAzurePipeline(_pipeline);
      case "circleci":
        return this.generateCircleCI(_pipeline);
      case "travis":
        return this.generateTravisCI(_pipeline);
      default:
        throw new Error(`Unsupported CI provider: ${pipeline.provider.type}`);
    }
  }

  private async generateGitHubActions(_pipeline: CIPipeline): Promise<string> {
    const _config = {
      name: _pipeline.name,
      on: this.convertTriggersToGitHubEvents(_pipeline.triggers),
      env: _pipeline.environment,
      jobs: this.convertStagesToGitHubJobs(_pipeline.stages),
    };

    const _yamlContent = this.objectToYaml(_config);
    const _configPath = `.github/workflows/${_pipeline.name}.yml`;
    await fs.writeFile(_configPath, _yamlContent);

    return _configPath;
  }

  private convertTriggersToGitHubEvents(
    triggers: CITrigger[],
  ): Record<string, any> {
    const events: Record<string, any> = {};

    for (const trigger of triggers) {
      switch (trigger.type) {
        case "push":
          events.push = {
            branches: trigger.branches || ["main"],
            paths: trigger.paths,
          };
          break;
        case "pull_request":
          events.pull_request = {
            branches: trigger.branches || ["main"],
            paths: trigger.paths,
          };
          break;
        case "schedule":
          if (trigger.schedule) {
            events.schedule = [{ cron: trigger.schedule }];
          }
          break;
        case "manual":
          events.workflow_dispatch = {};
          break;
        case "tag":
          events.push = { tags: ["*"] };
          break;
      }
    }

    return events;
  }

  private convertStagesToGitHubJobs(stages: CIStage[]): Record<string, any> {
    const jobs: Record<string, any> = {};

    for (const _stage of stages) {
      const job: unknown = {
        "runs-on": "ubuntu-latest",
        steps: [
          { uses: "actions/checkout@v3" },
          ..._stage.script.map((script) => ({ run: script })),
        ],
      };

      if (_stage.dependencies.length > 0) {
        job.needs = _stage.dependencies;
      }

      if (_stage.image && _stage.image !== "ubuntu-latest") {
        job.container = _stage.image;
      }

      if (_stage.cache) {
        job.steps.splice(1, 0, {
          uses: "actions/cache@v3",
          with: {
            _path: _stage.cache.paths.join("\n"),
            key: _stage.cache.key,
          },
        });
      }

      if (_stage.services && _stage.services.length > 0) {
        job.services = {};
        for (const service of _stage.services) {
          job.services[service.name] = {
            image: service.image,
            ports: service.ports,
            env: service.environment,
          };
        }
      }

      if (_stage.matrix) {
        job.strategy = {
          matrix: {
            ..._stage.matrix.variables,
            exclude: _stage.matrix.exclude,
            include: _stage.matrix.include,
          },
        };
      }

      jobs[_stage.name] = job;
    }

    return jobs;
  }

  private async generateGitLabCI(_pipeline: CIPipeline): Promise<string> {
    const _config: unknown = {
      stages: _pipeline.stages.map((s) => s.name),
      variables: _pipeline.environment,
    };

    for (const _stage of _pipeline.stages) {
      _config[_stage.name] = {
        _stage: _stage.name,
        script: _stage.script,
        image: _stage.image,
        _dependencies:
          _stage.dependencies.length > 0 ? _stage.dependencies : undefined,
        when: _stage.when,
        cache: _stage.cache
          ? {
              key: _stage.cache.key,
              paths: _stage.cache.paths,
            }
          : undefined,
        services: _stage.services?.map((s) => s.image),
        parallel: _stage.matrix
          ? {
              matrix: Object.entries(_stage.matrix.variables)
                .map(([key, values]) =>
                  values.map((value) => ({ [key]: value })),
                )
                .flat(),
            }
          : undefined,
      };
    }

    const _yamlContent = this.objectToYaml(_config);
    const _configPath = ".gitlab-ci.yml";
    await fs.writeFile(_configPath, _yamlContent);

    return _configPath;
  }

  private async generateJenkinsfile(_pipeline: CIPipeline): Promise<string> {
    let jenkinsfile = `_pipeline {
    agent any
    
    environment {`;

    for (const [key, value] of Object.entries(_pipeline.environment)) {
      jenkinsfile += `\n        ${key} = '${value}'`;
    }

    jenkinsfile += `\n    }
    
    stages {`;

    for (const _stage of _pipeline.stages) {
      jenkinsfile += `\n        _stage('${_stage.name}') {`;

      if (_stage.image) {
        jenkinsfile += `\n            agent {
                docker { image '${_stage.image}' }
            }`;
      }

      jenkinsfile += `\n            steps {`;

      for (const script of _stage.script) {
        jenkinsfile += `\n                sh '${script}'`;
      }

      jenkinsfile += `\n            }`;

      if (_stage.when !== "always") {
        jenkinsfile += `\n            when {
                expression { ${this.convertWhenCondition(_stage.when)} }
            }`;
      }

      jenkinsfile += `\n        }`;
    }

    jenkinsfile += `\n    }
}`;

    const _configPath = "Jenkinsfile";
    await fs.writeFile(_configPath, jenkinsfile);

    return _configPath;
  }

  private async generateAzurePipeline(_pipeline: CIPipeline): Promise<string> {
    const _config: unknown = {
      trigger: _pipeline.triggers
        .filter((t) => t.type === "push")
        .map((t) => ({ branches: { include: t.branches || ["main"] } }))[0],
      pr: _pipeline.triggers
        .filter((t) => t.type === "pull_request")
        .map((t) => ({ branches: { include: t.branches || ["main"] } }))[0],
      variables: _pipeline.environment,
      stages: [
        {
          _stage: "Build",
          jobs: _pipeline.stages.map((_stage) => ({
            job: _stage.name,
            pool: { vmImage: "ubuntu-latest" },
            container: _stage.image,
            dependsOn: _stage.dependencies,
            steps: [
              { checkout: "self" },
              ..._stage.script.map((script) => ({ script: script })),
            ],
          })),
        },
      ],
    };

    const _yamlContent = this.objectToYaml(_config);
    const _configPath = "azure-pipelines.yml";
    await fs.writeFile(_configPath, _yamlContent);

    return _configPath;
  }

  private async generateCircleCI(_pipeline: CIPipeline): Promise<string> {
    const _config: unknown = {
      version: 2.1,
      jobs: Record<string, any>,
      workflows: {
        version: 2,
        [_pipeline.name]: {
          jobs: [],
        },
      },
    };

    for (const _stage of _pipeline.stages) {
      config.jobs[_stage.name] = {
        docker: [{ image: _stage.image || "circleci/node:14" }],
        steps: [
          "checkout",
          ..._stage.script.map((script) => ({ run: script })),
        ],
      };

      const workflowJob: unknown = { [_stage.name]: Record<string, any> };
      if (_stage.dependencies.length > 0) {
        workflowJob[_stage.name].requires = _stage.dependencies;
      }
      config.workflows[_pipeline.name].jobs.push(workflowJob);
    }

    const _yamlContent = this.objectToYaml(_config);
    const _configPath = ".circleci/config.yml";
    await fs.mkdir(".circleci", { recursive: true });
    await fs.writeFile(_configPath, _yamlContent);

    return _configPath;
  }

  private async generateTravisCI(_pipeline: CIPipeline): Promise<string> {
    const _config: unknown = {
      language: "node_js",
      nodejs: ["14"],
      env: _pipeline.environment,
      jobs: {
        include: _pipeline.stages.map((_stage) => ({
          _stage: stage.name,
          script: stage.script,
          if: this.convertWhenCondition(stage.when),
        })),
      },
    };

    const _yamlContent = this.objectToYaml(_config);
    const _configPath = ".travis.yml";
    await fs.writeFile(_configPath, _yamlContent);

    return _configPath;
  }

  async executePipeline(
    pipelineName: string,
    trigger: CITrigger,
    commit?: {
      sha: string;
      _message: string;
      author: string;
      branch: string;
    },
  ): Promise<CIExecution> {
    const _pipeline = this.pipelines.get(pipelineName);
    if (!_pipeline) {
      throw new Error(`Pipeline '${pipelineName}' not found`);
    }

    const _execution: CIExecution = {
      id: this.generateExecutionId(),
      _pipeline: pipelineName,
      provider: _pipeline.provider.type,
      status: "pending",
      startTime: new Date(),
      stages: [],
      trigger,
      commit,
    };

    this.executions.set(_execution.id, _execution);

    // Execute stages in dependency order
    try {
      execution.status = "running";
      const _stageOrder = this.computeStageOrder(_pipeline.stages);

      for (const stageName of _stageOrder) {
        const _stage = _pipeline.stages.find((s) => s.name === stageName)!;
        const _stageResult = await this.executeStage(
          _stage,
          _execution,
          _pipeline,
        );
        execution.stages.push(_stageResult);

        if (_stageResult.status === "failure") {
          execution.status = "failure";
          break;
        }
      }

      if (_execution.status === "running") {
        execution.status = "success";
      }
    } catch (_error) {
      execution.status = "failure";
    }

    execution.endTime = new Date();
    await this.sendNotifications(_pipeline, _execution);

    return _execution;
  }

  private async executeStage(
    _stage: CIStage,
    _execution: CIExecution,
    _pipeline: CIPipeline,
  ): Promise<CIStageResult> {
    const _stageResult: CIStageResult = {
      name: stage.name,
      status: "pending",
      startTime: new Date(),
      logs: [],
      artifacts: [],
    };

    try {
      if (!this.shouldExecuteStage(_stage, _execution)) {
        _stageResult.status = "skipped";
        stageResult.endTime = new Date();
        return _stageResult;
      }

      stageResult.status = "running";

      // Execute scripts
      for (const script of stage.script) {
        try {
          const { stdout, stderr } = await _execAsync(script, {
            env: { ...process.env, ..._pipeline.environment },
          });

          _stageResult.logs.push(`$ ${script}`);
          stageResult.logs.push(stdout);

          if (stderr) {
            stageResult.logs.push(`STDERR: ${stderr}`);
          }
        } catch (_error) {
          _stageResult.status = "failure";
          _stageResult.logs.push(`Error executing: ${script}`);
          stageResult.logs.push(
            _error instanceof Error ? _error.message : String(_error),
          );
          break;
        }
      }

      if (_stageResult.status === "running") {
        stageResult.status = "success";
      }
    } catch (_error) {
      _stageResult.status = "failure";
      stageResult.logs.push(
        _error instanceof Error ? _error.message : String(_error),
      );
    }

    stageResult.endTime = new Date();
    return _stageResult;
  }

  private shouldExecuteStage(
    _stage: CIStage,
    _execution: CIExecution,
  ): boolean {
    switch (_stage.when) {
      case "always":
        return true;
      case "on_success":
        return _execution.status !== "failure";
      case "on_failure":
        return _execution.status === "failure";
      case "manual":
        return false; // Manual stages require explicit trigger
      default:
        return true;
    }
  }

  private computeStageOrder(stages: CIStage[]): string[] {
    const _graph = new Map<string, string[]>();

    for (const _stage of stages) {
      graph.set(_stage.name, _stage.dependencies);
    }

    return this.topologicalSort(_graph);
  }

  private topologicalSort(_graph: Map<string, string[]>): string[] {
    const result: string[] = [];
    const _visited = new Set<string>();
    const _visiting = new Set<string>();

    const _visit = (_node: string) => {
      if (_visiting.has(_node)) {
        throw new Error(`Circular dependency detected involving ${_node}`);
      }
      if (_visited.has(_node)) {
        return;
      }

      visiting.add(_node);

      const _dependencies = _graph.get(_node) || [];
      for (const dep of _dependencies) {
        if (_graph.has(dep)) {
          _visit(dep);
        }
      }

      visiting.delete(_node);
      visited.add(_node);
      result.push(_node);
    };

    for (const node of _graph.keys()) {
      if (!_visited.has(node)) {
        _visit(node);
      }
    }

    return result;
  }

  async triggerPipeline(
    pipelineName: string,
    triggerType: "push" | "pull_request" | "manual" = "manual",
    options: {
      branch?: string;
      commit?: string;
      parameters?: Record<string, string>;
    } = {},
  ): Promise<string> {
    const _pipeline = this.pipelines.get(pipelineName);
    if (!_pipeline) {
      throw new Error(`Pipeline '${pipelineName}' not found`);
    }

    // Check if trigger is valid for this _pipeline
    const _validTrigger = _pipeline.triggers.find(
      (t) => t.type === triggerType,
    );
    if (!_validTrigger) {
      throw new Error(
        `Pipeline '${pipelineName}' does not support trigger type '${triggerType}'`,
      );
    }

    const trigger: CITrigger = {
      type: triggerType,
      branches: options.branch ? [options.branch] : undefined,
    };

    const _execution = await this.executePipeline(pipelineName, trigger);
    return _execution.id;
  }

  async getPipelineStatus(
    executionId: string,
  ): Promise<CIExecution | undefined> {
    return this.executions.get(executionId);
  }

  async cancelExecution(executionId: string): Promise<void> {
    const _execution = this.executions.get(executionId);
    if (_execution && _execution.status === "running") {
      _execution.status = "cancelled";
      execution.endTime = new Date();
    }
  }

  async getExecutionLogs(
    _executionId: string,
    stageName?: string,
  ): Promise<string[]> {
    const _execution = this.executions.get(_executionId);
    if (!_execution) {
      return [];
    }

    if (stageName) {
      const _stage = _execution.stages.find((s) => s.name === stageName);
      return _stage?.logs || [];
    }

    return _execution.stages.flatMap((s) => [
      `=== Stage: ${s.name} ===`,
      ...s.logs,
      "",
    ]);
  }

  private async sendNotifications(
    _pipeline: CIPipeline,
    _execution: CIExecution,
  ): Promise<void> {
    const _event = execution.status === "success" ? "success" : "failure";

    for (const notification of _pipeline.notifications) {
      if (
        notification.events.includes(_event) ||
        notification.events.includes("always")
      ) {
        await this.sendNotification(notification, _execution);
      }
    }
  }

  private async sendNotification(
    _config: CINotification,
    _execution: CIExecution,
  ): Promise<void> {
    const _message = {
      _pipeline: _execution.pipeline,
      status: _execution.status,
      duration: _execution.endTime
        ? _execution.endTime.getTime() - _execution.startTime.getTime()
        : undefined,
      commit: _execution.commit,
      stages: _execution.stages.map((s) => ({
        name: s.name,
        status: s.status,
      })),
    };

    // Notification implementation would go here
    // For now, just log
    console.log(`Notification ${_config.type}:`, _message);
  }

  private convertWhenCondition(when: string): string {
    switch (when) {
      case "always":
        return "true";
      case "on_success":
        return 'build.result == "SUCCESS"';
      case "on_failure":
        return 'build.result == "FAILURE"';
      case "manual":
        return "false";
      default:
        return "true";
    }
  }

  private objectToYaml(obj: unknown): string {
    // Simple YAML serialization
    return JSON.stringify(obj, null, 2)
      .replace(/"/g, "")
      .replace(/,\n/g, "\n")
      .replace(/{\n/g, "\n")
      .replace(/}\n/g, "\n")
      .replace(/\[\n/g, "\n  - ")
      .replace(/\]\n/g, "\n");
  }

  private validatePipeline(_pipeline: CIPipeline): void {
    if (!_pipeline.name) {
      throw new Error("Pipeline must have a name");
    }

    if (!_pipeline.stages || _pipeline.stages.length === 0) {
      throw new Error("Pipeline must have at least one _stage");
    }

    if (!_pipeline.triggers || _pipeline.triggers.length === 0) {
      throw new Error("Pipeline must have at least one trigger");
    }
  }

  private generateExecutionId(): string {
    return `ci_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async listPipelines(): Promise<string[]> {
    return Array.from(this.pipelines.keys());
  }

  async deletePipeline(name: string): Promise<void> {
    this.pipelines.delete(name);
  }

  async exportPipeline(
    _name: string,
    format: "json" | "yaml" = "json",
  ): Promise<string> {
    const _pipeline = this.pipelines.get(_name);
    if (!_pipeline) {
      throw new Error(`Pipeline '${_name}' not found`);
    }

    if (format === "yaml") {
      return this.objectToYaml(_pipeline);
    }

    return JSON.stringify(_pipeline, null, 2);
  }

  async importPipeline(
    _content: string,
    format: "json" | "yaml" = "json",
  ): Promise<void> {
    let _pipeline: CIPipeline;

    if (format === "json") {
      _pipeline = JSON.parse(_content);
    } else {
      // Simple YAML parsing (in real implementation, use a proper YAML parser)
      _pipeline = JSON.parse(_content);
    }

    await this.createPipeline(_pipeline);
  }
}
