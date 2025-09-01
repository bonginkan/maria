/**
 * MARIA CODE Startup Display
 * Simple and clean startup screen
 */

import chalk from "chalk";
import { getResponsiveWidth } from "../ui/integrated-cli/responsive-width.js";
import * as path from "path";
import * as os from "os";
import { getVersion } from "../utils/version";

export function displayStartupLogo(): void {
  // Clear screen completely first
  process.stdout.write("\u001b[2J\u001b[3J\u001b[H");

  // Display the beautiful MARIA logo
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
  console.log(
    chalk.cyan.bold(`MARIA CODE v${getVersion()}`) + chalk.gray(" — Ready")
  );
  console.log(
    chalk.yellow("Type /login to get started · /help for commands")
  );
  console.log("");
}

export function displayCompactLogo(): void {
  // Clear screen completely first
  process.stdout.write("\u001b[2J\u001b[H");

  console.log(
    chalk.cyan.bold(`MARIA CODE v${getVersion()}`) + chalk.gray(" — Ready")
  );
  console.log(
    chalk.yellow("Type /login to get started · /help for commands")
  );
  console.log("");
}

export function displayDashboardHeader(): void {
  // Clear screen completely first
  process.stdout.write("\u001b[2J\u001b[H");

  // Compact header line
  const version = chalk.cyan.bold(`MARIA CODE v${getVersion()}`);
  const commands = chalk.gray(" | /help  /status  /model");
  const providers = chalk.gray(
    "Providers: 8/8 OK  (openai, anthropic, google, groq, lmstudio, ollama, vllm)",
  );

  console.log(version + commands);
  console.log(providers);
  console.log("");
}

export function displayLogsBox(logs: string[]): void {
  const width = getResponsiveWidth({ marginLeft: 5, marginRight: 5, maxWidth: 120 });
  const borderColor = chalk.white;
  const titleColor = chalk.cyan;

  // Box characters
  const topLeft = "┌";
  const topRight = "┐";
  const bottomLeft = "└";
  const bottomRight = "┘";
  const horizontal = "─";
  const vertical = "│";

  // Build the box
  const lines: string[] = [];

  // Top border with title
  const title = " Logs ";
  const titlePadding = width - title.length - 2;
  const leftPadding = Math.floor(titlePadding / 2);
  const _rightPadding = titlePadding - leftPadding;

  lines.push(
    borderColor(topLeft) +
      titleColor(title) +
      borderColor(horizontal.repeat(width - title.length - 2)) +
      borderColor(topRight),
  );

  // Log content lines
  logs.forEach((log) => {
    const contentWidth = width - 4; // Account for borders and padding
    const truncatedLog =
      log.length > contentWidth
        ? log.substring(0, contentWidth - 3) + "..."
        : log;
    const padding = width - truncatedLog.length - 4;

    lines.push(
      borderColor(vertical) +
        " " +
        truncatedLog +
        " ".repeat(Math.max(0, padding)) +
        " " +
        borderColor(vertical),
    );
  });

  // Add empty line if no logs
  if (logs.length === 0) {
    lines.push(
      borderColor(vertical) + " ".repeat(width - 2) + borderColor(vertical),
    );
  }

  // Bottom border
  lines.push(
    borderColor(bottomLeft + horizontal.repeat(width - 2) + bottomRight),
  );

  // Display the box
  console.log(lines.join("\n"));
}

export function displaySpinner(text: string = "Processing"): void {
  const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const frame =
    spinnerFrames[Math.floor(Date.now() / 80) % spinnerFrames.length];
  process.stdout.write(`\r[${chalk.cyan(frame)}] ${text}...`);
}

/**
 * Get current working directory path
 */
function getCurrentPath(): string {
  return process.cwd();
}

/**
 * Get system information
 */
function getSystemInfo() {
  return {
    platform: os.platform(),
    hostname: os.hostname(),
    user: os.userInfo().username,
    cwd: getCurrentPath(),
  };
}

// Version is now imported from centralized utils/version.ts

/**
 * Display simple startup screen with authentication status
 */
export async function displayFinalStartupScreen(
  _selectedProvider?: string,
  _selectedModel?: string,
): Promise<void> {
  // Clear screen completely first
  process.stdout.write("\u001b[2J\u001b[3J\u001b[H");

  const version = getVersion();
  const systemInfo = getSystemInfo();

  // Version and status line
  console.log(
    chalk.cyan.bold(`MARIA CODE v${version}`) + chalk.gray(" — Ready")
  );
  
  // Display current working directory (simplified path)
  const cwd = systemInfo.cwd.replace(os.homedir(), '~');
  console.log(chalk.gray("cwd: ") + chalk.white(cwd));
  
  // Check authentication status and display appropriate message
  try {
    const { authManager } = await import('../cli-auth/index.js').catch(() => ({ authManager: null }));
    
    if (authManager && await authManager.isAuthenticated()) {
      // User is authenticated
      try {
        const user = await authManager.getCurrentUser();
        console.log(chalk.green(`Signed in: ${user.email}`));
        console.log(chalk.yellow("Tip: /help · /help code · /usage"));
      } catch {
        console.log(chalk.green("Signed in"));
        console.log(chalk.yellow("Tip: /help · /help code · /usage"));
      }
    } else {
      // User not authenticated
      console.log(chalk.gray("Not signed in"));
      console.log(chalk.yellow("Tip: /login · /help · /help code"));
    }
  } catch {
    // Fallback if auth service unavailable
    console.log(chalk.gray("Not signed in"));
    console.log(chalk.yellow("Tip: /login · /help · /help code"));
  }
  
  console.log("");
}

/**
 * Display rounded input box with modern design
 */
export function displayRoundedInputBox(): void {
  const width = getResponsiveWidth({ marginLeft: 5, marginRight: 5, maxWidth: 90 });
  const borderColor = chalk.white;
  const promptColor = chalk.cyan;

  // Rounded box characters
  const topLeft = "╭";
  const topRight = "╮";
  const bottomLeft = "╰";
  const bottomRight = "╯";
  const horizontal = "─";
  const vertical = "│";

  // Build the rounded box
  const lines: string[] = [];

  // Top border
  lines.push(borderColor(topLeft + horizontal.repeat(width - 2) + topRight));

  // Input line with prompt
  const promptStr = promptColor("> ");
  const placeholder = chalk.gray("");
  const inputLine = promptStr + placeholder;
  const padding = width - 4; // Account for borders and prompt

  lines.push(
    borderColor(vertical) +
      inputLine +
      " ".repeat(Math.max(0, padding)) +
      borderColor(vertical),
  );

  // Bottom border
  lines.push(
    borderColor(bottomLeft + horizontal.repeat(width - 2) + bottomRight),
  );

  // Display the box
  console.log(lines.join("\n"));
}
