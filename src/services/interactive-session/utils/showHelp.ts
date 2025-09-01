/**
 * showHelp utility function
 * Migrated from legacy interactive-session.ts (lines 1161-1245)
 */

import chalk from "chalk";

export function showHelp(): void {
  console.log(chalk.blue("\n📖 MARIA Commands:\n"));

  console.log(chalk.yellow("🎨 Interface:"));
  console.log(
    `${chalk.cyan("/enhanced")}       - Switch to enhanced visual CLI with file/image support`,
  );
  console.log(
    `${chalk.cyan("/visual")}         - Switch to visual CLI interface (alias for /enhanced)`,
  );
  console.log("");

  console.log(chalk.yellow("🚀 Development:"));
  console.log(
    `${chalk.cyan("/code")}          - Generate code from description`,
  );
  console.log(`${chalk.cyan("/test")}          - Generate tests for code`);
  console.log(`${chalk.cyan("/review")}        - Review and improve code`);
  console.log(
    `${chalk.cyan("/paper")}         - Process research papers to code (Multi-Agent)`,
  );
  console.log(`${chalk.cyan("/model")}         - Show/select AI _models`);
  console.log(
    `${chalk.cyan("/_mode")}          - Show/set operation & internal cognitive modes`,
  );
  console.log("");

  console.log(chalk.yellow("🔍 Code Quality Analysis:"));
  console.log(
    `${chalk.cyan("/bug")}           - Bug analysis and fix suggestions`,
  );
  console.log(`${chalk.cyan("/lint")}          - ESLint analysis and auto-fix`);
  console.log(
    `${chalk.cyan("/typecheck")}     - TypeScript type safety analysis`,
  );
  console.log(
    `${chalk.cyan("/security-review")} - Security vulnerability assessment`,
  );
  console.log("");

  console.log(chalk.yellow("🤝 Human-in-the-Loop Approval:"));
  console.log(
    `${chalk.cyan("/approve")}        - Show current approval _request or manage approvals`,
  );
  console.log(chalk.gray("  Keyboard Shortcuts:"));
  console.log(chalk.gray("  • Shift+Tab     - Quick approve (いいよ)"));
  console.log(chalk.gray("  • Ctrl+Y        - Approve (はい、承認)"));
  console.log(chalk.gray("  • Ctrl+N        - Reject (いいえ、拒否)"));
  console.log(chalk.gray("  • Ctrl+Alt+T    - Trust & auto-approve (任せる)"));
  console.log(chalk.gray("  • Ctrl+R        - Request review (レビュー要求)"));
  console.log("");

  console.log(chalk.yellow("⚙️  Configuration:"));
  console.log(
    `${chalk.cyan("/setup")}         - First-_time environment setup wizard`,
  );
  console.log(`${chalk.cyan("/settings")}      - Environment variable setup`);
  console.log(`${chalk.cyan("/_config")}        - Show configuration`);
  console.log("");

  console.log(chalk.yellow("🎨 Media Generation:"));
  console.log(`${chalk.cyan("/image")}         - Generate images`);
  console.log(`${chalk.cyan("/video")}         - Generate videos`);
  console.log(`${chalk.cyan("/avatar")}        - Interactive ASCII avatar`);
  console.log(`${chalk.cyan("/voice")}         - Voice chat _mode`);
  console.log("");

  console.log(chalk.yellow("📁 Project Management:"));
  console.log(`${chalk.cyan("/init")}          - Initialize new project`);
  console.log(`${chalk.cyan("/add-dir")}       - Add directory to project`);
  console.log(`${chalk.cyan("/memory")}        - Manage project memory`);
  console.log(`${chalk.cyan("/export")}        - Export project data`);
  console.log("");

  console.log(chalk.yellow("🤖 Agent Management:"));
  console.log(`${chalk.cyan("/agents")}        - Manage AI agents`);
  console.log(`${chalk.cyan("/mcp")}           - MCP integrations`);
  console.log(`${chalk.cyan("/ide")}           - IDE integration setup`);
  console.log(`${chalk.cyan("/install-github-app")} - Install GitHub app`);
  console.log("");

  console.log(chalk.yellow("⚙️  System:"));
  console.log(`${chalk.cyan("/_status")}        - Show system _status`);
  console.log(`${chalk.cyan("/_health")}        - Check system _health`);
  console.log(`${chalk.cyan("/doctor")}        - System diagnostics`);
  console.log(`${chalk.cyan("/_models")}        - List _available _models`);
  console.log(`${chalk.cyan("/priority")}      - Set priority _mode`);
  console.log("");

  console.log(chalk.yellow("📝 Session:"));
  console.log(
    `${chalk.cyan("/clear")}         - Reset _context window and clear conversation _history`,
  );
  console.log(`${chalk.cyan("/help")}          - Show this help`);
  console.log(
    `${chalk.cyan("/exit")}          - Exit session (only way to quit MARIA)`,
  );
  console.log("");
}
