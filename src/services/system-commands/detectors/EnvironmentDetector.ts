/**
 * EnvironmentDetector - LLM-free Environment Detection
 *
 * Detects project environment using decision tree approach:
 * - Framework detection (Next.js, React, Vue, etc.)
 * - Package manager detection (pnpm, yarn, npm)
 * - Language runtime detection (Node.js, Python, etc.)
 * - Build tool detection (Vite, Webpack, etc.)
 *
 * No LLM usage - pure file-based detection for speed and reliability
 */

export interface FileInfo {
  name: string;
  path: string;
  content?: string;
  size: number;
  isDirectory: boolean;
  exists: boolean;
}

export interface DetectedEnvironment {
  // Primary identifiers
  framework?: string;
  runtime?: string;
  packageManager?: string;
  buildTool?: string;

  // Language information
  languages: string[];

  // Project metadata
  projectName?: string;
  version?: string;

  // Configuration files found
  configFiles: string[];

  // Detection confidence (0-100)
  confidence: number;

  // Recommendations
  recommendations: string[];
}

export class EnvironmentDetector {
  /**
   * Detect project environment from file list
   * Uses deterministic decision tree - no AI required
   */
  detectEnvironment(files: FileInfo[]): DetectedEnvironment {
    const startTime = performance.now();

    const env: DetectedEnvironment = {
      languages: [],
      configFiles: [],
      confidence: 0,
      recommendations: [],
    };

    // Create file lookup for efficient access
    const fileMap = this.createFileMap(files);

    // Detection phases
    this.detectPackageManager(fileMap, env);
    this.detectFramework(fileMap, env);
    this.detectRuntime(fileMap, env);
    this.detectBuildTools(fileMap, env);
    this.detectLanguages(fileMap, env);
    this.detectProjectMetadata(fileMap, env);
    this.generateRecommendations(env, fileMap);
    this.calculateConfidence(env, fileMap);

    const detectionTimeMs = performance.now() - startTime;
    console.log(
      `Environment detection completed in ${detectionTimeMs.toFixed(2)}ms`,
    );

    return env;
  }

  /**
   * Create efficient file lookup map
   */
  private createFileMap(files: FileInfo[]): Map<string, FileInfo> {
    const map = new Map<string, FileInfo>();

    for (const file of files) {
      // Add by exact name
      map.set(file.name, file);

      // Add by full path for nested files
      map.set(file.path, file);

      // Add by basename for common config files
      const basename = file.name.split("/").pop();
      if (basename && basename !== file.name) {
        map.set(basename, file);
      }
    }

    return map;
  }

  /**
   * Detect package manager (highest priority)
   */
  private detectPackageManager(
    fileMap: Map<string, FileInfo>,
    env: DetectedEnvironment,
  ): void {
    // Priority order matters for detection accuracy
    const packageManagers = [
      { name: "pnpm", lockFile: "pnpm-lock.yaml", configFile: ".pnpmrc" },
      { name: "yarn", lockFile: "yarn.lock", configFile: ".yarnrc.yml" },
      { name: "bun", lockFile: "bun.lockb", configFile: "bunfig.toml" },
      { name: "npm", lockFile: "package-lock.json", configFile: ".npmrc" },
    ];

    for (const pm of packageManagers) {
      if (fileMap.has(pm.lockFile)) {
        env.packageManager = pm.name;
        env.configFiles.push(pm.lockFile);

        // Add config file if present
        if (fileMap.has(pm.configFile)) {
          env.configFiles.push(pm.configFile);
        }

        break; // First match wins
      }
    }

    // Fallback to npm if package.json exists but no lock file
    if (!env.packageManager && fileMap.has("package.json")) {
      env.packageManager = "npm";
    }
  }

  /**
   * Detect framework (based on dependencies and config files)
   */
  private detectFramework(
    fileMap: Map<string, FileInfo>,
    env: DetectedEnvironment,
  ): void {
    const packageJson = this.parsePackageJson(fileMap.get("package.json"));

    if (packageJson) {
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      // Framework detection with priority
      const frameworkRules = [
        {
          name: "nextjs",
          deps: ["next"],
          configs: ["next.config.js", "next.config.mjs", "next.config.ts"],
        },
        {
          name: "nuxtjs",
          deps: ["nuxt"],
          configs: ["nuxt.config.js", "nuxt.config.ts"],
        },
        {
          name: "sveltekit",
          deps: ["@sveltejs/kit"],
          configs: ["svelte.config.js"],
        },
        {
          name: "remix",
          deps: ["@remix-run/dev"],
          configs: ["remix.config.js"],
        },
        { name: "gatsby", deps: ["gatsby"], configs: ["gatsby-config.js"] },
        { name: "vue", deps: ["vue"], configs: ["vue.config.js"] },
        { name: "react", deps: ["react"], configs: [] },
        { name: "svelte", deps: ["svelte"], configs: ["svelte.config.js"] },
        { name: "angular", deps: ["@angular/core"], configs: ["angular.json"] },
        { name: "express", deps: ["express"], configs: [] },
        { name: "fastify", deps: ["fastify"], configs: [] },
      ];

      for (const rule of frameworkRules) {
        const hasDependency = rule.deps.some((dep) => deps[dep]);
        const hasConfig = rule.configs.some((config) => fileMap.has(config));

        if (hasDependency || hasConfig) {
          env.framework = rule.name;

          // Add config files if present
          rule.configs.forEach((config) => {
            if (fileMap.has(config)) {
              env.configFiles.push(config);
            }
          });

          break;
        }
      }
    }

    // Alternative detection methods for non-Node.js projects
    this.detectNonNodeFrameworks(fileMap, env);
  }

  /**
   * Detect non-Node.js frameworks
   */
  private detectNonNodeFrameworks(
    fileMap: Map<string, FileInfo>,
    env: DetectedEnvironment,
  ): void {
    if (env.framework) return; // Already detected

    const frameworkFiles = [
      { name: "django", files: ["manage.py", "django.wsgi"] },
      { name: "flask", files: ["app.py", "wsgi.py"] },
      { name: "rails", files: ["Gemfile", "config/application.rb"] },
      { name: "laravel", files: ["artisan", "composer.json"] },
      { name: "spring", files: ["pom.xml", "build.gradle"] },
      { name: "dotnet", files: ["*.csproj", "*.sln"] },
    ];

    for (const framework of frameworkFiles) {
      const hasFiles = framework.files.some((file) => {
        if (file.includes("*")) {
          // Wildcard matching
          const pattern = file.replace("*", "");
          return Array.from(fileMap.keys()).some((f) => f.includes(pattern));
        }
        return fileMap.has(file);
      });

      if (hasFiles) {
        env.framework = framework.name;
        break;
      }
    }
  }

  /**
   * Detect runtime environment
   */
  private detectRuntime(
    fileMap: Map<string, FileInfo>,
    env: DetectedEnvironment,
  ): void {
    // Node.js detection
    if (fileMap.has("package.json")) {
      env.runtime = "nodejs";

      const packageJson = this.parsePackageJson(fileMap.get("package.json"));
      if (packageJson?.engines?.node) {
        env.recommendations.push(
          `Node.js version: ${packageJson.engines.node}`,
        );
      }
      return;
    }

    // Other runtime detection
    const runtimeFiles = [
      {
        name: "python",
        files: [
          "requirements.txt",
          "pyproject.toml",
          "Pipfile",
          "environment.yml",
        ],
      },
      { name: "ruby", files: ["Gemfile", ".ruby-version"] },
      { name: "php", files: ["composer.json", "composer.lock"] },
      { name: "go", files: ["go.mod", "go.sum"] },
      { name: "rust", files: ["Cargo.toml", "Cargo.lock"] },
      { name: "java", files: ["pom.xml", "build.gradle", "build.gradle.kts"] },
      { name: "dotnet", files: ["*.csproj", "*.fsproj", "*.vbproj"] },
    ];

    for (const runtime of runtimeFiles) {
      const hasFiles = runtime.files.some((file) => {
        if (file.includes("*")) {
          const pattern = file.replace("*", "");
          return Array.from(fileMap.keys()).some((f) => f.includes(pattern));
        }
        return fileMap.has(file);
      });

      if (hasFiles) {
        env.runtime = runtime.name;
        break;
      }
    }
  }

  /**
   * Detect build tools
   */
  private detectBuildTools(
    fileMap: Map<string, FileInfo>,
    env: DetectedEnvironment,
  ): void {
    const buildTools = [
      {
        name: "vite",
        files: ["vite.config.js", "vite.config.ts", "vite.config.mjs"],
      },
      { name: "webpack", files: ["webpack.config.js", "webpack.config.ts"] },
      { name: "rollup", files: ["rollup.config.js", "rollup.config.ts"] },
      { name: "parcel", files: [".parcelrc", "parcel.json"] },
      { name: "esbuild", files: ["esbuild.config.js"] },
      { name: "turbo", files: ["turbo.json"] },
      { name: "nx", files: ["nx.json", "workspace.json"] },
    ];

    for (const tool of buildTools) {
      const hasConfig = tool.files.some((file) => fileMap.has(file));
      if (hasConfig) {
        env.buildTool = tool.name;

        // Add config files
        tool.files.forEach((file) => {
          if (fileMap.has(file)) {
            env.configFiles.push(file);
          }
        });

        break;
      }
    }
  }

  /**
   * Detect programming languages
   */
  private detectLanguages(
    fileMap: Map<string, FileInfo>,
    env: DetectedEnvironment,
  ): void {
    const languageExtensions = {
      typescript: [".ts", ".tsx"],
      javascript: [".js", ".jsx", ".mjs", ".cjs"],
      python: [".py", ".pyi"],
      java: [".java"],
      go: [".go"],
      rust: [".rs"],
      php: [".php"],
      ruby: [".rb"],
      csharp: [".cs"],
      cpp: [".cpp", ".cc", ".cxx"],
      c: [".c", ".h"],
    };

    const foundExtensions = new Set<string>();

    // Collect all file extensions
    for (const [fileName] of fileMap) {
      const ext = this.getFileExtension(fileName);
      if (ext) {
        foundExtensions.add(ext);
      }
    }

    // Match extensions to languages
    for (const [language, extensions] of Object.entries(languageExtensions)) {
      const hasLanguage = extensions.some((ext) => foundExtensions.has(ext));
      if (hasLanguage) {
        env.languages.push(language);
      }
    }

    // TypeScript projects implicitly include JavaScript
    if (
      env.languages.includes("typescript") &&
      !env.languages.includes("javascript")
    ) {
      env.languages.push("javascript");
    }

    // Sort by likelihood (TypeScript > JavaScript, etc.)
    env.languages.sort((a, b) => {
      const priority = {
        typescript: 10,
        javascript: 9,
        python: 8,
        java: 7,
        go: 6,
        rust: 5,
      };

      return (priority[b] || 0) - (priority[a] || 0);
    });
  }

  /**
   * Extract project metadata
   */
  private detectProjectMetadata(
    fileMap: Map<string, FileInfo>,
    env: DetectedEnvironment,
  ): void {
    const packageJson = this.parsePackageJson(fileMap.get("package.json"));

    if (packageJson) {
      env.projectName = packageJson.name;
      env.version = packageJson.version;

      // Add package.json to config files
      env.configFiles.push("package.json");
    }

    // Add other important config files
    const importantFiles = [
      "tsconfig.json",
      ".eslintrc.js",
      ".eslintrc.json",
      "prettier.config.js",
      ".gitignore",
      "README.md",
      "docker-compose.yml",
      "Dockerfile",
    ];

    importantFiles.forEach((file) => {
      if (fileMap.has(file) && !env.configFiles.includes(file)) {
        env.configFiles.push(file);
      }
    });
  }

  /**
   * Generate setup recommendations
   */
  private generateRecommendations(
    env: DetectedEnvironment,
    fileMap: Map<string, FileInfo>,
  ): void {
    // Framework-specific recommendations
    if (env.framework === "nextjs") {
      env.recommendations.push(
        "Next.js project detected - ensure .next/ is in .gitignore",
      );
      if (!fileMap.has("tsconfig.json")) {
        env.recommendations.push(
          "Consider adding TypeScript support with tsconfig.json",
        );
      }
    }

    if (env.framework === "react" && !env.buildTool) {
      env.recommendations.push(
        "React project without build tool - consider adding Vite or Create React App",
      );
    }

    // Package manager recommendations
    if (env.packageManager === "npm" && fileMap.has("package-lock.json")) {
      env.recommendations.push(
        "Using npm - consider upgrading to pnpm for better performance",
      );
    }

    // Language recommendations
    if (
      env.languages.includes("javascript") &&
      !env.languages.includes("typescript")
    ) {
      env.recommendations.push(
        "JavaScript project - consider migrating to TypeScript",
      );
    }

    // Missing important files
    if (!fileMap.has(".gitignore")) {
      env.recommendations.push(
        "Add .gitignore file to exclude build artifacts",
      );
    }

    if (!fileMap.has("README.md")) {
      env.recommendations.push("Add README.md file for project documentation");
    }
  }

  /**
   * Calculate detection confidence score
   */
  private calculateConfidence(
    env: DetectedEnvironment,
    fileMap: Map<string, FileInfo>,
  ): void {
    let score = 0;

    // Base score for having any detection
    if (env.framework) score += 30;
    if (env.runtime) score += 25;
    if (env.packageManager) score += 20;
    if (env.languages.length > 0) score += 15;

    // Bonus for consistent detection
    if (
      env.framework &&
      env.runtime &&
      (env.framework.includes("react") ||
        env.framework.includes("next") ||
        env.framework.includes("vue")) &&
      env.runtime === "nodejs"
    ) {
      score += 10; // Framework matches runtime
    }

    // Penalty for inconsistencies
    if (
      env.packageManager &&
      !fileMap.has("package.json") &&
      env.packageManager !== "npm"
    ) {
      score -= 10; // Package manager without package.json
    }

    env.confidence = Math.max(0, Math.min(100, score));
  }

  /**
   * Helper methods
   */
  private parsePackageJson(file: FileInfo | undefined): any {
    if (!file || !file.content) return null;

    try {
      return JSON.parse(file.content);
    } catch {
      return null;
    }
  }

  private getFileExtension(fileName: string): string | null {
    const match = fileName.match(/\.[^/.]+$/);
    return match ? match[0] : null;
  }
}
