/**
 * Node.js Version Check Utility
 * Ensures the runtime environment meets minimum requirements
 */

import chalk from 'chalk';
import semver from 'semver';

const MINIMUM_NODE_VERSION = '18.0.0';
const RECOMMENDED_NODE_VERSION = '20.0.0';

export function checkNodeVersion(): void {
  const currentVersion = process.version;

  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.bold('🔍 Node.js Version Check'));
  console.log(chalk.gray('─'.repeat(60)));

  // Check if current version meets minimum requirements
  if (!semver.satisfies(currentVersion, `>=${MINIMUM_NODE_VERSION}`)) {
    console.error(chalk.red(`\n❌ Node.js version ${currentVersion} is not supported.`));
    console.error(chalk.yellow(`Minimum required version: ${MINIMUM_NODE_VERSION}`));
    console.error(chalk.yellow(`Recommended version: ${RECOMMENDED_NODE_VERSION} or higher`));
    console.error(chalk.cyan('\nPlease upgrade Node.js:'));
    console.error(chalk.gray('  • Using nvm: nvm install 20 && nvm use 20'));
    console.error(chalk.gray('  • Using nodenv: nodenv install 20.0.0 && nodenv global 20.0.0'));
    console.error(chalk.gray('  • Download from: https://nodejs.org/'));
    console.error(chalk.gray('─'.repeat(60)));
    process.exit(1);
  }

  // Show current version info
  console.log(chalk.green(`✅ Node.js ${currentVersion} is supported`));

  // Recommend upgrade if using older version
  if (semver.lt(currentVersion, RECOMMENDED_NODE_VERSION)) {
    console.log(
      chalk.yellow(
        `\n💡 Recommendation: Upgrade to Node.js ${RECOMMENDED_NODE_VERSION} or higher for best performance`,
      ),
    );
  }

  console.log(chalk.gray('─'.repeat(60)));
  console.log();
}

// Export for use in CLI entry point
export default checkNodeVersion;
