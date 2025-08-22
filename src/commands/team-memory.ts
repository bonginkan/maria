/**
 * Team Memory Collaboration Commands
 *
 * CLI commands for team memory sharing and collaboration features
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import {
  TeamCollaborationAPI,
  TeamMember,
  TeamWorkspace,
} from '../services/memory-system/team/team-collaboration-api';
import { logger } from '../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

let collaborationAPI: TeamCollaborationAPI | null = null;
let currentSession: unknown = null;
let currentUser: TeamMember | null = null;

export default function registerTeamMemoryCommand(program: Command) {
  const team = program.command('team').description('Team memory collaboration features');

  // Create workspace
  team
    .command('create <name>')
    .description('Create a new team workspace')
    .option('-d, --description <desc>', 'Workspace description')
    .action(async (name: string, options) => {
      const spinner = ora('Creating team workspace...').start();

      try {
        const api = await getCollaborationAPI();
        const user = await getCurrentUser();

        const workspace = await api.createTeamWorkspace(
          name,
          options.description || `${name} workspace`,
          user,
        );

        spinner.succeed(`Workspace '${workspace.name}' created`);
        console.log(chalk.blue(`Workspace ID: ${workspace.id}`));

        // Save workspace info
        await saveWorkspaceInfo(workspace);
      } catch (error) {
        spinner.fail('Failed to create workspace');
        console.error(chalk.red('Error:'), (error as Error).message);
      }
    });

  // Join workspace
  team
    .command('join <workspaceId>')
    .description('Join an existing team workspace')
    .action(async (workspaceId: string) => {
      const spinner = ora('Joining workspace...').start();

      try {
        const api = await getCollaborationAPI();
        const user = await getCurrentUser();

        await api.joinWorkspace(workspaceId, user);

        spinner.succeed('Successfully joined workspace');
        console.log(chalk.green('You can now access team memory and collaborate'));
      } catch (error) {
        spinner.fail('Failed to join workspace');
        console.error(chalk.red('Error:'), (error as Error).message);
      }
    });

  // Start collaboration session
  team
    .command('start')
    .description('Start a team collaboration session')
    .option('-w, --workspace <id>', 'Workspace ID')
    .action(async (options) => {
      const spinner = ora('Starting collaboration session...').start();

      try {
        const api = await getCollaborationAPI();
        const user = await getCurrentUser();
        const workspaceId = options.workspace || (await getDefaultWorkspace());

        if (!workspaceId) {
          throw new Error('No workspace specified. Use -w option or set default workspace');
        }

        currentSession = await api.startCollaborationSession(workspaceId, [user]);

        spinner.succeed('Collaboration session started');
        console.log(chalk.blue(`Session ID: ${currentSession.id}`));
        console.log(chalk.gray('You can now share and query team memory'));
      } catch (error) {
        spinner.fail('Failed to start session');
        console.error(chalk.red('Error:'), (error as Error).message);
      }
    });

  // Share memory
  team
    .command('share <type> [content...]')
    .description('Share memory with team (types: code, bug, pattern, solution, knowledge)')
    .option('-f, --file <path>', 'Share from file')
    .option('-m, --message <msg>', 'Add description')
    .action(async (type: string, content: string[], options) => {
      if (!currentSession) {
        console.error(chalk.red('No active session. Run "team start" first'));
        return;
      }

      const spinner = ora('Sharing with team...').start();

      try {
        const api = await getCollaborationAPI();
        const user = await getCurrentUser();

        let memoryContent: any;

        if (options.file) {
          // Read from file
          memoryContent = await fs.readFile(options.file, 'utf-8');
        } else if (content.length > 0) {
          // Use provided content
          memoryContent = content.join(' ');
        } else {
          // Interactive input
          const response = await prompts({
            type: 'text',
            name: 'content',
            message: `Enter ${type} to share:`,
            validate: (value) => value.length > 0 || 'Content required',
          });
          memoryContent = response.content;
        }

        const sharedMemory = await api.shareWithTeam(currentSession.id, user.id, {
          type: type as any,
          content: memoryContent,
          metadata: {
            description: options.message,
            timestamp: new Date(),
          },
        });

        spinner.succeed(`${type} shared with team`);
        console.log(chalk.green(`Share ID: ${sharedMemory.id}`));
      } catch (error) {
        spinner.fail('Failed to share memory');
        console.error(chalk.red('Error:'), (error as Error).message);
      }
    });

  // Query team memory
  team
    .command('query <query...>')
    .description('Query team knowledge base')
    .option('-t, --type <type>', 'Filter by type (code, bug, pattern, solution, knowledge)')
    .option('-l, --limit <n>', 'Limit results', '10')
    .action(async (query: string[], options) => {
      if (!currentSession) {
        console.error(chalk.red('No active session. Run "team start" first'));
        return;
      }

      const spinner = ora('Searching team memory...').start();

      try {
        const api = await getCollaborationAPI();
        const user = await getCurrentUser();

        const results = await api.queryTeamKnowledge(currentSession.id, user.id, query.join(' '), {
          type: options.type,
          limit: parseInt(options.limit),
          includeRatings: true,
        });

        spinner.stop();

        if (results.length === 0) {
          console.log(chalk.yellow('No results found'));
        } else {
          console.log(chalk.blue(`\nFound ${results.length} result(s):\n`));

          results.forEach((result, index) => {
            console.log(chalk.cyan(`${index + 1}. ${result.type || 'knowledge'}`));
            console.log(chalk.white(formatContent(result.content || result)));
            console.log(chalk.gray('---'));
          });
        }
      } catch (error) {
        spinner.fail('Query failed');
        console.error(chalk.red('Error:'), (error as Error).message);
      }
    });

  // Rate shared memory
  team
    .command('rate <memoryId> <score>')
    .description('Rate shared memory (1-5 stars)')
    .option('-c, --comment <text>', 'Add comment')
    .action(async (memoryId: string, score: string, options) => {
      if (!currentSession) {
        console.error(chalk.red('No active session. Run "team start" first'));
        return;
      }

      try {
        const api = await getCollaborationAPI();
        const user = await getCurrentUser();
        const rating = parseInt(score);

        if (rating < 1 || rating > 5) {
          throw new Error('Rating must be between 1 and 5');
        }

        await api.rateSharedMemory(currentSession.id, memoryId, user.id, rating, options.comment);

        console.log(chalk.green(`✅ Rated ${rating}/5 stars`));
      } catch (error) {
        console.error(chalk.red('Failed to rate:'), (error as Error).message);
      }
    });

  // Get team insights
  team
    .command('insights')
    .description('View team collaboration insights')
    .option('-w, --workspace <id>', 'Workspace ID')
    .action(async (options) => {
      const spinner = ora('Loading team insights...').start();

      try {
        const api = await getCollaborationAPI();
        const workspaceId = options.workspace || (await getDefaultWorkspace());

        if (!workspaceId) {
          throw new Error('No workspace specified');
        }

        const insights = await api.getTeamInsights(workspaceId);

        spinner.stop();

        console.log(chalk.blue('\n📊 Team Collaboration Insights\n'));

        // Top contributors
        console.log(chalk.cyan('🏆 Top Contributors:'));
        insights.topContributors.forEach((contributor, index) => {
          console.log(
            chalk.white(
              `  ${index + 1}. ${contributor.member.id}: ${contributor.contributions} contributions`,
            ),
          );
        });

        // Most used patterns
        if (insights.mostUsedPatterns.length > 0) {
          console.log(chalk.cyan('\n📈 Most Used Patterns:'));
          insights.mostUsedPatterns.forEach((pattern, index) => {
            console.log(chalk.white(`  ${index + 1}. Pattern used ${pattern.usage} times`));
          });
        }

        // Metrics
        console.log(chalk.cyan('\n📊 Metrics:'));
        console.log(chalk.white(`  Collaboration Score: ${insights.collaborationScore}/100`));
        console.log(
          chalk.white(`  Learning Progress: ${(insights.learningProgress * 100).toFixed(1)}%`),
        );

        // Knowledge growth
        console.log(chalk.cyan('\n📚 Knowledge Growth:'));
        insights.knowledgeGrowth.forEach((point) => {
          console.log(
            chalk.white(`  ${point.date.toLocaleDateString()}: ${point.totalKnowledge} items`),
          );
        });
      } catch (error) {
        spinner.fail('Failed to load insights');
        console.error(chalk.red('Error:'), (error as Error).message);
      }
    });

  // Get personalized suggestions
  team
    .command('suggest')
    .description('Get personalized team suggestions')
    .action(async () => {
      const spinner = ora('Generating suggestions...').start();

      try {
        const api = await getCollaborationAPI();
        const user = await getCurrentUser();
        const workspaceId = await getDefaultWorkspace();

        if (!workspaceId) {
          throw new Error('No workspace set');
        }

        const suggestions = await api.getPersonalizedSuggestions(user.id, workspaceId, {
          currentTask: 'team collaboration',
        });

        spinner.stop();

        if (suggestions.length === 0) {
          console.log(chalk.yellow('No suggestions available yet'));
        } else {
          console.log(chalk.blue('\n💡 Personalized Suggestions:\n'));
          suggestions.forEach((suggestion, index) => {
            console.log(chalk.cyan(`${index + 1}. ${suggestion}`));
          });
        }
      } catch (error) {
        spinner.fail('Failed to get suggestions');
        console.error(chalk.red('Error:'), (error as Error).message);
      }
    });

  // End session
  team
    .command('end')
    .description('End collaboration session')
    .action(async () => {
      if (!currentSession) {
        console.error(chalk.red('No active session'));
        return;
      }

      const spinner = ora('Ending session...').start();

      try {
        const api = await getCollaborationAPI();

        await api.endCollaborationSession(currentSession.id);

        spinner.succeed('Session ended');
        console.log(chalk.gray('Session data saved'));

        currentSession = null;
      } catch (error) {
        spinner.fail('Failed to end session');
        console.error(chalk.red('Error:'), (error as Error).message);
      }
    });

  // Export workspace data
  team
    .command('export')
    .description('Export workspace data')
    .option('-w, --workspace <id>', 'Workspace ID')
    .option('-o, --output <file>', 'Output file')
    .action(async (options) => {
      const spinner = ora('Exporting workspace data...').start();

      try {
        const api = await getCollaborationAPI();
        const workspaceId = options.workspace || (await getDefaultWorkspace());

        if (!workspaceId) {
          throw new Error('No workspace specified');
        }

        const data = await api.exportWorkspaceData(workspaceId);

        const outputFile = options.output || `workspace_${workspaceId}_${Date.now()}.json`;
        await fs.writeFile(outputFile, JSON.stringify(data, null, 2));

        spinner.succeed(`Data exported to ${outputFile}`);
      } catch (error) {
        spinner.fail('Export failed');
        console.error(chalk.red('Error:'), (error as Error).message);
      }
    });
}

// Helper functions
async function getCollaborationAPI(): Promise<TeamCollaborationAPI> {
  if (!collaborationAPI) {
    collaborationAPI = new TeamCollaborationAPI({
      enableRealTimeSync: true,
      enableCrossSessionLearning: true,
      enablePersonalization: true,
      syncInterval: 5000,
      maxTeamSize: 50,
      dataRetentionDays: 90,
    });
  }
  return collaborationAPI;
}

async function getCurrentUser(): Promise<TeamMember> {
  if (!currentUser) {
    // Load or create user profile
    try {
      const configPath = path.join(process.env.HOME || '', '.maria', 'user.json');
      const data = await fs.readFile(configPath, 'utf-8');
      currentUser = JSON.parse(data);
    } catch {
      // Create new user
      const response = await prompts([
        {
          type: 'text',
          name: 'name',
          message: 'Enter your name:',
          validate: (value) => value.length > 0 || 'Name required',
        },
        {
          type: 'text',
          name: 'email',
          message: 'Enter your email:',
          validate: (value) => value.includes('@') || 'Valid email required',
        },
      ]);

      currentUser = {
        id: `user_${Date.now()}`,
        name: response.name,
        email: response.email,
        role: 'developer',
        joinedAt: new Date(),
        lastActive: new Date(),
        preferences: {
          codeStyle: 'functional',
          outputFormat: 'detailed',
          learningEnabled: true,
        },
      };

      // Save user profile
      const configDir = path.join(process.env.HOME || '', '.maria');
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(path.join(configDir, 'user.json'), JSON.stringify(currentUser, null, 2));
    }
  }

  return currentUser;
}

async function getDefaultWorkspace(): Promise<string | null> {
  try {
    const configPath = path.join(process.env.HOME || '', '.maria', 'workspace.json');
    const data = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(data);
    return config.defaultWorkspace;
  } catch {
    return null;
  }
}

async function saveWorkspaceInfo(workspace: TeamWorkspace): Promise<void> {
  const configDir = path.join(process.env.HOME || '', '.maria');
  await fs.mkdir(configDir, { recursive: true });

  const configPath = path.join(configDir, 'workspace.json');

  let config: unknown = {};
  try {
    const existing = await fs.readFile(configPath, 'utf-8');
    config = JSON.parse(existing);
  } catch {
    // File doesn't exist yet
  }

  config.defaultWorkspace = workspace.id;
  config.workspaces = config.workspaces || {};
  config.workspaces[workspace.id] = {
    name: workspace.name,
    description: workspace.description,
    createdAt: workspace.createdAt,
  };

  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

function formatContent(content: unknown): string {
  if (typeof content === 'string') {
    return content.substring(0, 200) + (content.length > 200 ? '...' : '');
  }

  return JSON.stringify(content, null, 2).substring(0, 200) + '...';
}
