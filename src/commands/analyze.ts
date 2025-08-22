import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { Neo4jService } from '../services/neo4j.service';
import { logger } from '../utils/logger';
import { Table } from 'console-table-printer';
import {
  Community as _Community,
  Metric as _Metric,
  PathResult as _PathResult,
  Recommendation as _Recommendation,
  Dictionary,
  GraphEdge,
  isCommunity,
  isDictionary,
  isMetric,
  isPathResult,
  isRecommendation,
} from '../types/common';

interface AnalyzeOptions {
  format?: 'table' | 'json' | 'graph';
  limit?: number;
  depth?: number;
}

export default function analyzeCommand(command: Command): void {
  const analyzeCmd = command
    .command('analyze')
    .alias('analyse')
    .description('Analyze Neo4j graph data and patterns');

  // Su_command: analyze schema
  analyzeCmd
    .command('schema')
    .description('Analyze graph schema (nodes, relationships, properties)')
    .action(async () => {
      const spinner = ora('Analyzing graph schema...').start();
      try {
        const neo4j = new Neo4jService();
        const schema = await neo4j.analyzeSchema();
        spinner.succeed('Schema analysis complete');

        // Display node types
        console.log(chalk.bold.cyan('\n📊 Node Labels:'));
        const nodeTable = new Table({
          columns: [
            { name: 'label', title: 'Label', alignment: 'left' },
            { name: 'count', title: 'Count', alignment: 'right' },
            { name: 'properties', title: 'Properties', alignment: 'left' },
          ],
        });
        // TODO: Update when Neo4jService schema format is finalized
        const nodes =
          (schema as { nodes?: Array<{ label: string; count: number; properties: string[] }> })
            .nodes || [];
        nodes.forEach((node) => {
          nodeTable.addRow({
            label: node.label,
            count: node.count,
            properties: node.properties.join(', '),
          });
        });
        nodeTable.printTable();

        // Display relationship types
        console.log(chalk.bold.cyan('\n🔗 Relationship Types:'));
        const relTable = new Table({
          columns: [
            { name: 'type', title: 'Type', alignment: 'left' },
            { name: 'count', title: 'Count', alignment: 'right' },
            { name: 'fromTo', title: 'From → To', alignment: 'left' },
          ],
        });
        // TODO: Update when Neo4jService schema format is finalized
        const relationships =
          (
            schema as {
              relationships?: Array<
                GraphEdge & {
                  type: string;
                  count: number;
                  startNode: string;
                  endNode: string;
                }
              >;
            }
          ).relationships || [];
        relationships.forEach((rel) => {
          relTable.addRow({
            type: rel.type,
            count: rel.count,
            fromTo: `${rel.startLabel || rel.startNode} → ${rel.endLabel || rel.endNode}`,
          });
        });
        relTable.printTable();
      } catch (error: unknown) {
        spinner.fail('Schema analysis failed');
        logger.error('Schema analysis error:', error);
        process.exit(1);
      }
    });

  // Su_command: analyze patterns
  analyzeCmd
    .command('patterns')
    .description('Find common patterns in the graph')
    .option('-l, --limit <number>', 'Limit results', '10')
    .action(async (options) => {
      const spinner = ora('Analyzing graph patterns...').start();
      try {
        const neo4j = new Neo4jService();
        const patterns = await neo4j.analyzePatterns({ limit: parseInt(options.limit) });
        spinner.succeed('Pattern analysis complete');

        console.log(chalk.bold.cyan('\n🔍 Common Patterns:'));
        patterns.forEach(
          (
            pattern: { name: string; count: number; pattern: string; example?: unknown },
            _index: number,
          ) => {
            console.log(chalk.yellow(`\n${_index + 1}. ${pattern.name}`));
            console.log(`   Occurrences: ${pattern.count}`);
            console.log(`   Pattern: ${pattern.pattern}`);
            if (pattern.example) {
              console.log(`   Example: ${JSON.stringify(pattern.example, null, 2)}`);
            }
          },
        );
      } catch (error: unknown) {
        spinner.fail('Pattern analysis failed');
        logger.error('Pattern analysis error:', error);
        process.exit(1);
      }
    });

  // Su_command: analyze metrics
  analyzeCmd
    .command('metrics')
    .description('Calculate graph metrics (centrality, clustering, etc.)')
    .option('-t, --type <type>', 'Metric type (degree|betweenness|pagerank|clustering)', 'degree')
    .option('-l, --limit <number>', 'Limit results', '20')
    .action(async (options) => {
      const spinner = ora(`Calculating ${options.type} metrics...`).start();
      try {
        const neo4j = new Neo4jService();
        const metrics = await neo4j.calculateMetrics({
          type: options.type,
          limit: parseInt(options.limit),
        });
        spinner.succeed('Metrics calculation complete');

        console.log(
          chalk.bold.cyan(
            `\n📈 ${options.type.charAt(0).toUpperCase() + options.type.slice(1)} Metrics:`,
          ),
        );
        const table = new Table({
          columns: [
            { name: 'rank', title: '#', alignment: 'right' },
            { name: 'node', title: 'Node', alignment: 'left' },
            { name: 'score', title: 'Score', alignment: 'right' },
            { name: 'details', title: 'Details', alignment: 'left' },
          ],
        });

        (metrics as unknown[]).forEach((item, _index: number) => {
          if (isMetric(item)) {
            table.addRow({
              rank: _index + 1,
              node: item.name,
              score: item.value.toFixed(4),
              details: '-',
            });
          } else if (
            typeof item === 'object' &&
            item !== null &&
            'node' in item &&
            'score' in item
          ) {
            const metric = item as { node: string; score: number; details?: string };
            table.addRow({
              rank: _index + 1,
              node: metric.node,
              score: metric.score.toFixed(4),
              details: metric.details || '-',
            });
          }
        });
        table.printTable();
      } catch (error: unknown) {
        spinner.fail('Metrics calculation failed');
        logger.error('Metrics calculation error:', error);
        process.exit(1);
      }
    });

  // Su_command: analyze communities
  analyzeCmd
    .command('communities')
    .description('Detect communities in the graph')
    .option('-a, --algorithm <algorithm>', 'Algorithm (louvain|label-propagation)', 'louvain')
    .action(async (options) => {
      const spinner = ora('Detecting communities...').start();
      try {
        const neo4j = new Neo4jService();
        const communities = await neo4j.detectCommunities({
          algorithm: options.algorithm,
        });
        spinner.succeed('Community detection complete');

        console.log(chalk.bold.cyan('\n👥 Communities:'));
        communities.forEach((item, _index: number) => {
          if (isCommunity(item)) {
            console.log(chalk.yellow(`\nCommunity ${_index + 1}:`));
            console.log(`  Size: ${item.size} nodes`);
            console.log(
              `  Key Members: ${item.nodes.slice(0, 5).join(', ')}${item.nodes.length > 5 ? '...' : ''}`,
            );
          } else if (typeof item === 'object' && item !== null) {
            const community = item as {
              size: number;
              keyMembers: string[];
              density: number;
              centralNode?: string;
            };
            console.log(chalk.yellow(`\nCommunity ${_index + 1}:`));
            console.log(`  Size: ${community.size} nodes`);
            console.log(
              `  Key Members: ${community.keyMembers.slice(0, 5).join(', ')}${community.keyMembers.length > 5 ? '...' : ''}`,
            );
            console.log(`  Density: ${(community.density * 100).toFixed(1)}%`);
            if (community.centralNode) {
              console.log(`  Central Node: ${community.centralNode}`);
            }
          }
        });
      } catch (error: unknown) {
        spinner.fail('Community detection failed');
        logger.error('Community detection error:', error);
        process.exit(1);
      }
    });

  // Su_command: analyze query (custom Cypher query)
  analyzeCmd
    .command('query <cypher>')
    .description('Execute custom Cypher query for analysis')
    .option('-f, --format <format>', 'Output format (table|json|graph)', 'table')
    .option('-l, --limit <number>', 'Limit results', '50')
    .action(async (cypher: string, options: AnalyzeOptions) => {
      const spinner = ora('Executing query...').start();
      try {
        const neo4j = new Neo4jService();

        // Add LIMIT if not present
        if (!cypher.toLowerCase().includes('limit') && options.limit) {
          cypher += ` LIMIT ${options.limit}`;
        }

        const results = await neo4j.runQuery(cypher);
        spinner.succeed('Query executed successfully');

        if (options.format === 'json') {
          console.log(JSON.stringify(results, null, 2));
        } else if (options.format === 'table' && results.length > 0) {
          const table = new Table();
          results.forEach((row: unknown) => {
            if (isDictionary(row)) {
              table.addRow(row as Dictionary);
            }
          });
          table.printTable();
        } else if (options.format === 'graph') {
          // Simple graph visualization in terminal
          console.log(chalk.bold.cyan('\n🌐 Graph Visualization:'));
          results.forEach((row: unknown) => {
            console.log(chalk.yellow(`Node: ${JSON.stringify(row)}`));
          });
        }

        console.log(chalk.dim(`\n${results.length} results returned`));
      } catch (error: unknown) {
        spinner.fail('Query execution failed');
        logger.error('Query error:', error);
        process.exit(1);
      }
    });

  // Su_command: analyze recommendations
  analyzeCmd
    .command('recommend')
    .description('Generate recommendations based on graph analysis')
    .option('-t, --type <type>', 'Recommendation type (similar|related|missing)', 'similar')
    .option('-n, --node <node>', 'Starting node for recommendations')
    .option('-l, --limit <number>', 'Number of recommendations', '10')
    .action(async (options) => {
      const spinner = ora('Generating recommendations...').start();
      try {
        const neo4j = new Neo4jService();
        const recommendations = await neo4j.generateRecommendations({
          type: options.type,
          startNode: options.node,
          limit: parseInt(options.limit),
        });
        spinner.succeed('Recommendations generated');

        console.log(
          chalk.bold.cyan(
            `\n💡 ${options.type.charAt(0).toUpperCase() + options.type.slice(1)} Recommendations:`,
          ),
        );
        recommendations.forEach((item, _index: number) => {
          if (isRecommendation(item)) {
            console.log(chalk.yellow(`\n${_index + 1}. ${item.title}`));
            console.log(`   Description: ${item.description}`);
            console.log(`   Priority: ${item.priority}`);
            if (item.impact) {
              console.log(`   Impact: ${item.impact}`);
            }
          } else if (typeof item === 'object' && item !== null) {
            const rec = item as {
              node: string;
              score: number;
              reason: string;
              connections?: string[];
            };
            console.log(chalk.yellow(`\n${_index + 1}. ${rec.node}`));
            console.log(`   Score: ${rec.score.toFixed(3)}`);
            console.log(`   Reason: ${rec.reason}`);
            if (rec.connections) {
              console.log(`   Connections: ${rec.connections.join(' → ')}`);
            }
          }
        });
      } catch (error: unknown) {
        spinner.fail('Recommendation generation failed');
        logger.error('Recommendation error:', error);
        process.exit(1);
      }
    });

  // Su_command: analyze paths
  analyzeCmd
    .command('path <from> <to>')
    .description('Find paths between nodes')
    .option('-t, --type <type>', 'Path type (shortest|all|weighted)', 'shortest')
    .option('-m, --max-length <number>', 'Maximum path length', '5')
    .action(async (from: string, to: string, options) => {
      const spinner = ora('Finding paths...').start();
      try {
        const neo4j = new Neo4jService();
        const paths = await neo4j.findPaths({
          from,
          to,
          type: options.type,
          maxLength: parseInt(options.maxLength),
        });
        spinner.succeed('Path analysis complete');

        console.log(chalk.bold.cyan(`\n🛤️  Paths from "${from}" to "${to}":`));
        if (paths.length === 0) {
          console.log(chalk.yellow('No paths found'));
        } else {
          paths.forEach((item, _index: number) => {
            if (isPathResult(item)) {
              console.log(chalk.yellow(`\nPath ${_index + 1} (length: ${item.nodes.length}):`));
              console.log(`  ${item.nodes.join(' → ')}`);
              if (item.cost !== undefined) {
                console.log(`  Cost: ${item.cost}`);
              }
            } else if (typeof item === 'object' && item !== null && 'nodes' in item) {
              const path = item as {
                nodes: string[];
                length: number;
                cost?: number;
              };
              console.log(chalk.yellow(`\nPath ${_index + 1} (length: ${path.length}):`));
              console.log(`  ${path.nodes.join(' → ')}`);
              if (path.cost !== undefined) {
                console.log(`  Cost: ${path.cost}`);
              }
            }
          });
        }
      } catch (error: unknown) {
        spinner.fail('Path finding failed');
        logger.error('Path finding error:', error);
        process.exit(1);
      }
    });
}
