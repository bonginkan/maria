/**
 * Safety Validator
 * Validates commands for safety and security
 */

import { validateCommand, createBackup } from "./LinuxIntelligenceEngine";

export class SafetyValidator {
  async validate(command: string): Promise<any> {
    const _validation = await validateCommand(command);

    if (
      _validation.riskLevel === "HIGH" ||
      _validation.riskLevel === "CRITICAL"
    ) {
      // Auto-backup for risky operations
      await createBackup("system");
    }

    return _validation;
  }

  isCommandSafe(command: string): boolean {
    const _dangerousCommands = ["rm -rf /", "dd", "format"];
    return !_dangerousCommands.some((dangerous) => command.includes(dangerous));
  }
}
