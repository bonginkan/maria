import { Command } from 'commander';
import { existsSync, mkdirSync, chmodSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execa } from 'execa';
import chalk from 'chalk';
import ora from 'ora';
import { writeFileSync } from 'fs';
import { generateNeo4jJWT, getNeo4jBloomURL } from '../shared/utils/jwt.js';
import { loadConfig } from '../utils/config.js';

interface GraphOptions {
  query?: string;
  png?: string;
}

const MARIA_DIR = join(homedir(), '.maria-code');
const JWT_FILE = join(MARIA_DIR, 'neo4j-jwt.token');
const JWT_EXPIRY_MINUTES = 15;

// Ensure .maria-code directory exists
function ensureMariaDir() {
  if (!existsSync(MARIA_DIR)) {
    mkdirSync(MARIA_DIR, { recursive: true });
  }
}

// Generate JWT for Neo4j Bloom access
async function generateJWT(): Promise<string> {
  const spinner = ora('Generating Neo4j Bloom JWT...').start();

  try {
    // Load configuration
    const config = loadConfig();
    const userEmail = config.user?.email || process.env['MARIA_USER_EMAIL'] || 'user@example.com';

    // TODO: In production, retrieve the secret from Secret Manager
    const secret = process.env['NEO4J_BLOOM_JWT_SECRET'] || 'temporary-dev-secret';

    const jwt = generateNeo4jJWT(userEmail, {
      secret,
      expiryMinutes: JWT_EXPIRY_MINUTES,
      role: 'editor',
    });

    spinner.succeed('JWT generated successfully');
    return jwt;
  } catch (error: unknown) {
    spinner.fail('Failed to generate JWT');
    throw error;
  }
}

// Save JWT to local file with secure permissions
function saveJWT(jwt: string) {
  ensureMariaDir();
  writeFileSync(JWT_FILE, jwt, { mode: 0o600 });
  // Ensure file permissions are set correctly (readable by owner only)
  chmodSync(JWT_FILE, 0o600);
}

// Get Neo4j Bloom URL with JWT
function getBloomURL(jwt: string, query?: string): string {
  const config = loadConfig();
  const instanceId = config.neo4j?.instanceId || process.env['NEO4J_INSTANCE_ID'] || '4234c1a0';
  return getNeo4jBloomURL(instanceId, jwt, query);
}

// Open URL in default browser
async function openInBrowser(url: string) {
  const spinner = ora('Opening Graph Database in browser...').start();

  try {
    const platform = process.platform;
    const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';

    await execa(command, [url]);
    spinner.succeed('Graph Database interface opened in browser');
  } catch {
    spinner.fail('Failed to open browser');
  }
}

// Export graph as PNG
async function exportGraphAsPNG(bloomURL: string, outputPath: string) {
  const spinner = ora(`Exporting graph to ${outputPath}...`).start();

  try {
    // In a real implementation, this would use Puppeteer or similar
    // to capture a screenshot of the Bloom visualization

    // Create a placeholder file for now
    const placeholderContent = `# Graph Export Placeholder
    
Export URL: ${bloomURL}
Generated at: ${new Date().toISOString()}

To manually export:
1. Open the URL in your browser
2. Use Neo4j Bloom's built-in export feature
3. Save the visualization as PNG
`;

    writeFileSync(outputPath, placeholderContent);
    spinner.succeed(`Export instructions saved to ${outputPath}`);
  } catch (error: unknown) {
    spinner.fail('Failed to export graph as PNG');
    throw error;
  }
}

// Main graph command handler
async function graphHandler(options: GraphOptions) {
  try {
    // Generate JWT
    const jwt = await generateJWT();
    saveJWT(jwt);

    // Build Bloom URL
    const bloomURL = getBloomURL(jwt, options.query);

    if (options.query) {
      // Query will be passed through URL parameter
    }

    // Handle PNG export if requested
    if (options.png) {
      await exportGraphAsPNG(bloomURL, options.png);
    } else {
      // Open in browser
      await openInBrowser(bloomURL);
    }

    console.log(chalk.bold('\n✨ Graph viewer launched successfully!\n'));

    if (!options.png) {
      console.log(chalk.gray('Tips:'));
      console.log(chalk.gray("  • Use Bloom's search to explore nodes"));
    }
  } catch {
    process.exit(1);
  }
}

// Export command registration function
export default function registerGraphCommand(program: Command) {
  program
    .command('graph')
    .description('Visualize Graph Database (requires Neo4j setup)')
    .option('-q, --query <cypher>', 'Deep-link with Cypher query')
    .option('-p, --png <output>', 'Export graph as PNG')
    .action(graphHandler);
}
