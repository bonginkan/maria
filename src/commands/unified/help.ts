/**
 * Unified Help Command
 * Consolidates functionality from multiple help command implementations
 */

import chalk from "chalk";
import type { DualMemoryEngine } from "../../services/memory-system/dual-memory-engine";
import type { MemoryCoordinator } from "../../services/memory-system/memory-coordinator";
import {
  getCommandInfo,
  getCommandsByCategory,
  commandCategories,
  suggestCommands,
  _buildHelp,
} from "../../lib/command-groups";

export async function executeHelp(
  _args: string[],
  _maria?: unknown,
  _memoryEngine?: DualMemoryEngine | null,
  _memoryCoordinator?: MemoryCoordinator | null,
): Promise<boolean | "exit"> {
  try {
    // Parse arguments
    const _query = _args.length > 0 ? _args[0] : "";
    const _isCategory = _args.includes("--_category");
    const _isSearch = _args.includes("--search");

    // Specific command help
    if (_query && !_isCategory && !_isSearch) {
      return showCommandHelp(_query);
    }

    // Category help
    if (_isCategory && _query) {
      return showCategoryHelp(_query);
    }

    // Search help
    if (_isSearch && _query) {
      return searchCommands(_query);
    }

    // General help
    return showGeneralHelp();
  } catch (error) {
    console.error(chalk.red("❌ Error displaying help:"), error);
    return true;
  }
}

function showCommandHelp(commandName: string): boolean {
  const _commandInfo = getCommandInfo(commandName);

  if (!_commandInfo) {
    console.log(chalk.red(`❌ Command '${commandName}' not found`));

    // Suggest similar _commands
    const _suggestions = suggestCommands(commandName, 3);
    if (_suggestions.length > 0) {
      console.log(chalk.yellow("\n💡 Did you mean:"));
      suggestions.forEach((cmd) => {
        console.log(chalk.gray(`  ${cmd.name} - ${cmd.description}`));
      });
    }
    return true;
  }

  // Display command help
  console.log(chalk.blue(`\n📖 Help for ${chalk.cyan(_commandInfo.name)}\n`));
  console.log(chalk.white(_commandInfo.description));

  if (_commandInfo.usage) {
    console.log(chalk.gray("\nUsage:"));
    console.log(`  ${chalk.cyan(_commandInfo.usage)}`);
  }

  if (_commandInfo.aliases && _commandInfo.aliases.length > 0) {
    console.log(chalk.gray("\nAliases:"));
    console.log(
      `  ${_commandInfo.aliases.map((a) => chalk.cyan(a)).join(", ")}`,
    );
  }

  if (_commandInfo.examples && _commandInfo.examples.length > 0) {
    console.log(chalk.gray("\nExamples:"));
    commandInfo.examples.forEach((example) => {
      console.log(`  ${chalk.dim(example)}`);
    });
  }

  console.log(
    chalk.gray(
      `\nCategory: ${commandCategories[_commandInfo.category] || _commandInfo.category}`,
    ),
  );

  return true;
}

function showCategoryHelp(categoryName: string): boolean {
  const _category =
    categoryName.toLowerCase() as keyof typeof commandCategories;

  if (!commandCategories[_category]) {
    console.log(chalk.red(`❌ Category '${categoryName}' not found`));
    console.log(chalk.yellow("\n💡 Available categories:"));
    Object.keys(commandCategories).forEach((cat) => {
      console.log(
        `  ${chalk.cyan(cat)} - ${commandCategories[cat as keyof typeof commandCategories]}`,
      );
    });
    return true;
  }

  const _commands = getCommandsByCategory(_category);
  const _categoryTitle = commandCategories[_category];

  console.log(chalk.blue(`\n📚 ${_categoryTitle}\n`));

  if (_commands.length === 0) {
    console.log(chalk.gray("No _commands available in this category."));
    return true;
  }

  commands.forEach((cmd) => {
    const _deprecatedLabel = cmd.deprecated ? chalk.red(" (deprecated)") : "";
    console.log(
      `  ${chalk.cyan(cmd.name)} - ${cmd.description}${_deprecatedLabel}`,
    );
  });

  console.log(
    chalk.gray(
      `\n💡 Use "help ${_commands[0]?.name}" for detailed information about a specific command`,
    ),
  );

  return true;
}

function searchCommands(searchTerm: string): boolean {
  const _suggestions = suggestCommands(searchTerm, 10);

  if (_suggestions.length === 0) {
    console.log(chalk.yellow(`🔍 No _commands found matching "${searchTerm}"`));
    return true;
  }

  console.log(
    chalk.blue(`\n🔍 Search results for "${chalk.cyan(searchTerm)}":\n`),
  );

  const _grouped = new Map<string, typeof _suggestions>();
  suggestions.forEach((cmd) => {
    const _category = cmd._category;
    if (!_grouped.has(_category)) {
      grouped.set(_category, []);
    }
    grouped.get(_category)!.push(cmd);
  });

  grouped.forEach((_commands, _category) => {
    const _categoryTitle =
      commandCategories[_category as keyof typeof commandCategories] ||
      _category;
    console.log(chalk.magenta(_categoryTitle));

    commands.forEach((cmd) => {
      const _deprecatedLabel = cmd.deprecated ? chalk.red(" (deprecated)") : "";
      console.log(
        `  ${chalk.cyan(cmd.name)} - ${cmd.description}${_deprecatedLabel}`,
      );
    });
    console.log();
  });

  return true;
}

function showGeneralHelp(): boolean {
  console.log(chalk.blue("\n🤖 MARIA - AI-Powered Development Assistant\n"));

  console.log(
    chalk.white(
      "MARIA helps you with intelligent code generation, analysis, and project management.",
    ),
  );
  console.log(
    chalk.gray("Use slash _commands to interact with MARIA's features.\n"),
  );

  // Quick start section
  console.log(chalk.cyan("🚀 Quick Start:"));
  console.log(`  ${chalk.cyan("/help")}           Show this help`);
  console.log(
    `  ${chalk.cyan("/init")}           Initialize MARIA in your project`,
  );
  console.log(`  ${chalk.cyan("/code")}           Generate code`);
  console.log(`  ${chalk.cyan("/review")}         Review code quality`);
  console.log(`  ${chalk.cyan("/test")}           Generate and run tests`);
  console.log();

  // Categories overview
  console.log(chalk.cyan("📚 Command Categories:\n"));

  const _categoryEntries = Object.entries(commandCategories);
  const _maxLength = Math.max(..._categoryEntries.map(([key]) => key.length));

  categoryEntries.forEach(([_category, title]) => {
    const _commands = getCommandsByCategory(
      _category as keyof typeof commandCategories,
    );
    const _count = _commands.length;
    if (_count > 0) {
      const _paddedCategory = category.padEnd(_maxLength);
      console.log(
        `  ${chalk.cyan(_paddedCategory)} ${title} ${chalk.gray(`(${_count} _commands)`)}`,
      );
    }
  });

  console.log();
  console.log(chalk.gray("💡 Usage examples:"));
  console.log(
    chalk.gray("  /help _category core      - Show all core _commands"),
  );
  console.log(
    chalk.gray("  /help /init              - Show detailed help for /init"),
  );
  console.log(
    chalk.gray(
      '  /help --search "config"  - Search for config-related _commands',
    ),
  );

  console.log();
  console.log(
    chalk.gray("📖 Documentation: https://github.com/bonginkan/maria"),
  );
  console.log(
    chalk.gray("💬 Support: https://github.com/bonginkan/maria/issues"),
  );

  return true;
}
