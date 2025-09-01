/**
 * GovernanceConfig - Enhanced governance configuration with strict safety controls
 * Defines LOC limits, protected paths, and risk classification rules
 */

import { RiskLevel } from '../ai/contracts';

/**
 * Enhanced governance policy configuration
 */
export const GOVERNANCE_POLICY = {
  // Lines of Code limits
  limits: {
    maxLocPerStep: 500,
    maxTotalLocPerPlan: 2000,
    maxStepsPerPlan: 20,
    maxConcurrentOperations: 3
  },
  
  // Protected file patterns (always require approval)
  protectedGlobs: [
    "**/package.json",
    "**/package-lock.json",
    "**/pnpm-lock.yaml",
    "**/yarn.lock",
    "**/.github/**",
    "**/infra/**",
    "**/*.env*",
    "**/secrets/**",
    "**/credentials/**",
    "**/.git/config",
    "**/docker*",
    "**/Docker*",
    "**/k8s/**",
    "**/terraform/**",
    "**/cloudformation/**",
    "**/*.key",
    "**/**.pem",
    "**/*.cert",
    "**/tsconfig.json",
    "**/webpack.config.*",
    "**/rollup.config.*",
    "**/vite.config.*"
  ],
  
  // Auto-approve patterns (low risk)
  autoApproveGlobs: [
    "src/**/*.ts",
    "src/**/*.tsx",
    "src/**/*.js", 
    "src/**/*.jsx",
    "tests/**/*.test.ts",
    "tests/**/*.spec.ts",
    "__tests__/**/*.test.ts",
    "test/**/*.test.ts",
    "spec/**/*.spec.ts",
    "docs/**/*.md",
    "README.md",
    "CHANGELOG.md",
    "outputs/**/*",
    "tmp/**/*",
    ".tmp/**/*"
  ],
  
  // Blocked commands (never allowed)
  blockedCommands: [
    "rm -rf /",
    "rm -rf /*",
    "sudo rm",
    "chmod -R 777",
    "chmod 777",
    "chown",
    "mkfs",
    "dd if=",
    "mount",
    "umount",
    "curl | sh",
    "curl | bash",
    "wget | sh",
    "wget | bash",
    "eval(",
    "exec(",
    "nc -l",
    "netcat",
    ":(){:|:&};:"  // Fork bomb
  ],
  
  // Commands requiring approval
  approvalRequiredCommands: [
    "npm install",
    "npm uninstall",
    "npm update",
    "pnpm install",
    "pnpm add",
    "pnpm remove",
    "yarn add",
    "yarn remove",
    "pip install",
    "pip uninstall",
    "git push",
    "git push --force",
    "git pull",
    "git merge",
    "git rebase",
    "docker",
    "kubectl",
    "aws",
    "gcloud",
    "az"
  ],
  
  // Safe commands (auto-approved)
  safeCommands: [
    "git status",
    "git diff",
    "git log",
    "git branch",
    "git branch -a",
    "npm test",
    "npm run test",
    "npm run lint",
    "pnpm test",
    "pnpm lint",
    "pnpm type-check",
    "jest",
    "vitest",
    "mocha",
    "tsc --noEmit",
    "eslint",
    "prettier",
    "ls",
    "pwd",
    "echo",
    "cat"
  ]
};

/**
 * Risk classification rules
 */
export interface RiskRule {
  pattern: string;
  minRisk: RiskLevel;
  reason: string;
}

export const RISK_RULES: RiskRule[] = [
  // File operations
  { pattern: "DELETE:*", minRisk: "high", reason: "File deletion is high risk" },
  { pattern: "CREATE:**/package.json", minRisk: "high", reason: "Package file creation requires review" },
  { pattern: "MODIFY:**/package.json", minRisk: "high", reason: "Package modifications require review" },
  { pattern: "MODIFY:**/.github/**", minRisk: "high", reason: "CI/CD modifications are high risk" },
  { pattern: "MODIFY:**/*.env*", minRisk: "high", reason: "Environment variable changes are sensitive" },
  
  // Code operations
  { pattern: "MODIFY:**/auth/**", minRisk: "high", reason: "Authentication code is critical" },
  { pattern: "MODIFY:**/security/**", minRisk: "high", reason: "Security code is critical" },
  { pattern: "MODIFY:**/payment/**", minRisk: "high", reason: "Payment code is critical" },
  
  // Command operations
  { pattern: "EXEC:npm install", minRisk: "medium", reason: "Installing dependencies" },
  { pattern: "EXEC:git push", minRisk: "medium", reason: "Pushing code to remote" },
  { pattern: "EXEC:docker", minRisk: "high", reason: "Docker operations require review" }
];

/**
 * Classify risk based on operation and context
 */
export function classifyRisk(
  action: string,
  path: string,
  estimatedLOC: number
): RiskLevel {
  // Check against risk rules
  for (const rule of RISK_RULES) {
    const pattern = rule.pattern;
    if (pattern.startsWith(action.toUpperCase() + ':')) {
      const pathPattern = pattern.substring(action.length + 1);
      if (pathPattern === '*' || matchGlob(path, pathPattern)) {
        return rule.minRisk;
      }
    }
  }
  
  // LOC-based risk classification
  if (estimatedLOC > 500) return "high";
  if (estimatedLOC > 200) return "medium";
  
  // Check if path is protected
  for (const protectedGlob of GOVERNANCE_POLICY.protectedGlobs) {
    if (matchGlob(path, protectedGlob)) {
      return "high";
    }
  }
  
  // Check if path is auto-approved
  for (const safeGlob of GOVERNANCE_POLICY.autoApproveGlobs) {
    if (matchGlob(path, safeGlob)) {
      return estimatedLOC > 100 ? "medium" : "low";
    }
  }
  
  return "medium"; // Default to medium risk
}

/**
 * Check if a command is blocked
 */
export function isCommandBlocked(command: string): boolean {
  const normalizedCommand = command.toLowerCase().trim();
  
  for (const blocked of GOVERNANCE_POLICY.blockedCommands) {
    if (normalizedCommand.includes(blocked.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if a command requires approval
 */
export function commandRequiresApproval(command: string): boolean {
  const normalizedCommand = command.toLowerCase().trim();
  
  for (const approvalRequired of GOVERNANCE_POLICY.approvalRequiredCommands) {
    if (normalizedCommand.startsWith(approvalRequired.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if a command is safe
 */
export function isCommandSafe(command: string): boolean {
  const normalizedCommand = command.toLowerCase().trim();
  
  for (const safe of GOVERNANCE_POLICY.safeCommands) {
    if (normalizedCommand === safe.toLowerCase() || 
        normalizedCommand.startsWith(safe.toLowerCase() + ' ')) {
      return true;
    }
  }
  
  return false;
}

/**
 * Simple glob matching (would use minimatch in production)
 */
function matchGlob(path: string, pattern: string): boolean {
  // Simplified glob matching
  const regex = pattern
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.');
  
  return new RegExp(`^${regex}$`).test(path);
}