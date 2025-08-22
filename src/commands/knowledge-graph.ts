/**
 * MARIA Knowledge Graph CLI Commands
 * 
 * Interactive commands for exploring and managing the knowledge graph
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { KnowledgeGraphEngine } from '../services/memory-system/phase3/knowledge-graph-engine';
import { EventDrivenMemorySystem } from '../services/memory-system/phase3/event-driven-memory';
import { GraphVisualizer } from '../services/memory-system/phase3/graph-visualizer';
import { DualMemoryEngine } from '../services/memory-system/dual-memory-engine';

export default function registerKnowledgeGraphCommand(program: Command) {
  const kg = program
    .command('kg')
    .alias('knowledge-graph')
    .description('Interact with the knowledge graph memory system');

  // Initialize components
  let graphEngine: KnowledgeGraphEngine;
  let eventSystem: EventDrivenMemorySystem;
  let visualizer: GraphVisualizer;
  let memoryEngine: DualMemoryEngine;

  const initializeSystem = () => {
    if (!graphEngine) {
      graphEngine = new KnowledgeGraphEngine();
      memoryEngine = new DualMemoryEngine();
      eventSystem = new EventDrivenMemorySystem(memoryEngine, graphEngine);
      visualizer = new GraphVisualizer(graphEngine);
    }
  };

  // Visualize command
  kg.command('visualize')
    .alias('viz')
    .description('Visualize the knowledge graph')
    .option('-f, --format <format>', 'Visualization format (tree, matrix, list, summary)', 'tree')
    .option('-d, --depth <depth>', 'Maximum depth for tree view', '3')
    .option('-n, --nodes <count>', 'Maximum number of nodes to display', '50')
    .option('--no-color', 'Disable colorized output')
    .option('-m, --metadata', 'Show node metadata')
    .option('--filter-type <types...>', 'Filter by node types')
    .option('--min-confidence <value>', 'Minimum confidence threshold', '0.5')
    .action(async (options) => {
      initializeSystem();
      
      const spinner = ora('Loading knowledge graph...').start();
      
      try {
        const visualization = visualizer.visualize({
          format: options.format as any,
          maxDepth: parseInt(options.depth),
          maxNodes: parseInt(options.nodes),
          colorize: options.color,
          showMetadata: options.metadata,
          filter: {
            nodeTypes: options.filterType,
            minConfidence: parseFloat(options.minConfidence)
          }
        });
        
        spinner.succeed('Knowledge graph loaded');
        console.log('\n' + visualization);
      } catch (error) {
        spinner.fail('Failed to visualize graph');
        console.error(chalk.red('Error:'), error);
      }
    });

  // Search command
  kg.command('search <query>')
    .description('Search the knowledge graph semantically')
    .option('-k, --top-k <count>', 'Number of results to return', '10')
    .option('-s, --similarity <value>', 'Minimum similarity threshold', '0.5')
    .option('-r, --relationships', 'Include relationships in results')
    .action(async (query, options) => {
      initializeSystem();
      
      const spinner = ora(`Searching for "${query}"...`).start();
      
      try {
        const results = await graphEngine.search({
          query,
          topK: parseInt(options.topK),
          minSimilarity: parseFloat(options.similarity),
          includeRelationships: options.relationships
        });
        
        spinner.succeed(`Found ${results.length} results`);
        
        console.log('\n' + chalk.cyan('═══ Search Results ═══'));
        
        for (const [index, result] of results.entries()) {
          console.log(`\n${chalk.yellow(`[${index + 1}]`)} ${chalk.green(result.node.name)}`);
          console.log(`  Type: ${chalk.blue(result.node.type)}`);
          console.log(`  Similarity: ${chalk.magenta((result.similarity * 100).toFixed(1) + '%')}`);
          console.log(`  Confidence: ${chalk.gray((result.node.confidence * 100).toFixed(1) + '%')}`);
          
          if (result.relationships && result.relationships.length > 0) {
            console.log(`  ${chalk.cyan('Relationships:')}`);
            for (const rel of result.relationships) {
              console.log(`    → ${rel.type} (confidence: ${(rel.confidence * 100).toFixed(0)}%)`);
            }
          }
        }
      } catch (error) {
        spinner.fail('Search failed');
        console.error(chalk.red('Error:'), error);
      }
    });

  // Add knowledge command
  kg.command('add <text>')
    .description('Add knowledge to the graph')
    .option('-t, --type <type>', 'Context type for extraction', 'general')
    .action(async (text, options) => {
      initializeSystem();
      
      const spinner = ora('Extracting entities and relationships...').start();
      
      try {
        const extraction = await graphEngine.extractEntities(text, {
          type: options.type
        });
        
        spinner.text = 'Adding to knowledge graph...';
        await graphEngine.addToGraph(extraction);
        
        spinner.succeed('Knowledge added successfully');
        
        console.log('\n' + chalk.cyan('═══ Extraction Results ═══'));
        console.log(`Entities found: ${chalk.green(extraction.entities.length)}`);
        console.log(`Relationships found: ${chalk.blue(extraction.relationships.length)}`);
        console.log(`Confidence: ${chalk.magenta((extraction.confidence * 100).toFixed(1) + '%')}`);
        
        if (extraction.entities.length > 0) {
          console.log('\n' + chalk.yellow('Entities:'));
          for (const entity of extraction.entities.slice(0, 5)) {
            console.log(`  • ${entity.text} (${entity.type})`);
          }
          if (extraction.entities.length > 5) {
            console.log(`  ... and ${extraction.entities.length - 5} more`);
          }
        }
        
        if (extraction.relationships.length > 0) {
          console.log('\n' + chalk.yellow('Relationships:'));
          for (const rel of extraction.relationships.slice(0, 5)) {
            const source = extraction.entities.find(e => e.id === rel.sourceEntityId);
            const target = extraction.entities.find(e => e.id === rel.targetEntityId);
            if (source && target) {
              console.log(`  • ${source.text} → ${rel.type} → ${target.text}`);
            }
          }
          if (extraction.relationships.length > 5) {
            console.log(`  ... and ${extraction.relationships.length - 5} more`);
          }
        }
      } catch (error) {
        spinner.fail('Failed to add knowledge');
        console.error(chalk.red('Error:'), error);
      }
    });

  // Path finding command
  kg.command('path <source> <target>')
    .description('Find the shortest path between two nodes')
    .action(async (source, target) => {
      initializeSystem();
      
      const spinner = ora(`Finding path from "${source}" to "${target}"...`).start();
      
      try {
        // First, search for the nodes
        const sourceResults = await graphEngine.search({ query: source, topK: 1 });
        const targetResults = await graphEngine.search({ query: target, topK: 1 });
        
        if (sourceResults.length === 0) {
          spinner.fail(`Source node "${source}" not found`);
          return;
        }
        
        if (targetResults.length === 0) {
          spinner.fail(`Target node "${target}" not found`);
          return;
        }
        
        const sourcNode = sourceResults[0].node;
        const targetNode = targetResults[0].node;
        
        const path = graphEngine.findPath(sourceNode.id, targetNode.id);
        
        if (path) {
          spinner.succeed(`Path found with ${path.length} nodes`);
          
          console.log('\n' + chalk.cyan('═══ Path ═══'));
          for (const [index, node] of path.entries()) {
            const arrow = index < path.length - 1 ? ' → ' : '';
            console.log(`${chalk.yellow(`[${index + 1}]`)} ${chalk.green(node.name)}${arrow}`);
          }
        } else {
          spinner.warn('No path found between the nodes');
        }
      } catch (error) {
        spinner.fail('Path finding failed');
        console.error(chalk.red('Error:'), error);
      }
    });

  // Statistics command
  kg.command('stats')
    .description('Show knowledge graph statistics')
    .action(async () => {
      initializeSystem();
      
      const spinner = ora('Calculating statistics...').start();
      
      try {
        const stats = graphEngine.getStatistics();
        const eventStats = eventSystem.getStatistics();
        
        spinner.succeed('Statistics calculated');
        
        console.log('\n' + chalk.cyan('═══ Knowledge Graph Statistics ═══'));
        console.log(chalk.yellow('\nGraph Metrics:'));
        console.log(`  Total Nodes: ${chalk.green(stats.totalNodes)}`);
        console.log(`  Total Edges: ${chalk.blue(stats.totalEdges)}`);
        console.log(`  Total Clusters: ${chalk.magenta(stats.totalClusters)}`);
        console.log(`  Graph Density: ${chalk.cyan((stats.density * 100).toFixed(2) + '%')}`);
        console.log(`  Average Degree: ${chalk.gray(stats.averageDegree.toFixed(2))}`);
        
        console.log(chalk.yellow('\nNode Distribution:'));
        for (const [type, count] of Object.entries(stats.nodeTypes)) {
          const percentage = ((count as number) / stats.totalNodes * 100).toFixed(1);
          console.log(`  ${type}: ${count} (${percentage}%)`);
        }
        
        console.log(chalk.yellow('\nEdge Distribution:'));
        for (const [type, count] of Object.entries(stats.edgeTypes)) {
          const percentage = ((count as number) / stats.totalEdges * 100).toFixed(1);
          console.log(`  ${type}: ${count} (${percentage}%)`);
        }
        
        console.log(chalk.yellow('\nEvent Processing:'));
        console.log(`  Total Events: ${chalk.green(eventStats.totalEvents)}`);
        console.log(`  Queue Size: ${chalk.blue(eventStats.queueSize)}`);
        console.log(`  Success Rate: ${chalk.magenta((eventStats.successRate * 100).toFixed(1) + '%')}`);
        console.log(`  Avg Processing Time: ${chalk.cyan(eventStats.averageProcessingTime.toFixed(0) + 'ms')}`);
        console.log(`  Last Processed: ${chalk.gray(eventStats.lastProcessedTime.toLocaleString())}`);
      } catch (error) {
        console.error(chalk.red('Failed to get statistics:'), error);
      }
    });

  // Export command
  kg.command('export')
    .description('Export graph data for external visualization')
    .option('-o, --output <file>', 'Output file path', 'knowledge-graph.json')
    .action(async (options) => {
      initializeSystem();
      
      const spinner = ora('Exporting graph data...').start();
      
      try {
        const data = graphEngine.exportForVisualization();
        const fs = await import('fs/promises');
        
        await fs.writeFile(
          options.output,
          JSON.stringify(data, null, 2)
        );
        
        spinner.succeed(`Graph exported to ${options.output}`);
        console.log(`  Nodes: ${data.nodes.length}`);
        console.log(`  Edges: ${data.edges.length}`);
        console.log(`  Clusters: ${data.clusters.length}`);
      } catch (error) {
        spinner.fail('Export failed');
        console.error(chalk.red('Error:'), error);
      }
    });

  // Clear command
  kg.command('clear')
    .description('Clear the knowledge graph')
    .option('-f, --force', 'Skip confirmation')
    .action(async (options) => {
      if (!options.force) {
        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const answer = await new Promise<string>(resolve => {
          rl.question(chalk.yellow('Are you sure you want to clear the knowledge graph? (y/N) '), resolve);
        });
        
        rl.close();
        
        if (answer.toLowerCase() !== 'y') {
          console.log('Operation cancelled');
          return;
        }
      }
      
      initializeSystem();
      
      // Reinitialize to clear
      graphEngine = new KnowledgeGraphEngine();
      memoryEngine = new DualMemoryEngine();
      eventSystem = new EventDrivenMemorySystem(memoryEngine, graphEngine);
      visualizer = new GraphVisualizer(graphEngine);
      
      console.log(chalk.green('✓ Knowledge graph cleared'));
    });
}