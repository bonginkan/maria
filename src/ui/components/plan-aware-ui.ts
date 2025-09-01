/**
 * Plan-Aware UI Components
 * Visual components that adapt based on user's subscription plan
 */

import chalk from 'chalk';
import { getUserPlan, Plan } from '../../services/subscription/subscription-manager.js';

export interface FeatureUIConfig {
  name: string;
  description?: string;
  requiredPlan: Plan;
  icon?: string;
  shortcut?: string;
}

/**
 * Renders a feature with plan-aware styling
 */
export function renderFeature(
  feature: FeatureUIConfig,
  currentPlan: Plan = getUserPlan()
): string {
  const isAvailable = isPlanSufficient(currentPlan, feature.requiredPlan);
  
  if (isAvailable) {
    return renderAvailableFeature(feature);
  } else {
    return renderGrayedOutFeature(feature, currentPlan);
  }
}

/**
 * Check if current plan meets feature requirements
 */
function isPlanSufficient(currentPlan: Plan, requiredPlan: Plan): boolean {
  const planHierarchy: Record<Plan, number> = {
    FREE: 0,
    PRO: 1,
    ULTRA: 2
  };
  
  return planHierarchy[currentPlan] >= planHierarchy[requiredPlan];
}

/**
 * Render available feature with full colors
 */
function renderAvailableFeature(feature: FeatureUIConfig): string {
  const parts: string[] = [];
  
  if (feature.icon) {
    parts.push(feature.icon);
  }
  
  parts.push(chalk.bold.cyan(feature.name));
  
  if (feature.shortcut) {
    parts.push(chalk.gray(`(${feature.shortcut})`));
  }
  
  if (feature.description) {
    parts.push(chalk.white(`- ${feature.description}`));
  }
  
  return parts.join(' ');
}

/**
 * Render grayed out feature for insufficient plan
 */
function renderGrayedOutFeature(feature: FeatureUIConfig, currentPlan: Plan): string {
  const parts: string[] = [];
  
  // Gray icon
  if (feature.icon) {
    parts.push(chalk.gray(feature.icon));
  }
  
  // Gray name with strikethrough effect
  parts.push(chalk.gray.dim(feature.name));
  
  // Plan badge
  parts.push(renderPlanBadge(feature.requiredPlan));
  
  if (feature.description) {
    parts.push(chalk.gray.dim(`- ${feature.description}`));
  }
  
  return parts.join(' ');
}

/**
 * Render plan requirement badge
 */
function renderPlanBadge(plan: Plan): string {
  const badges = {
    FREE: '',
    PRO: chalk.bgYellow.black(' PRO '),
    ULTRA: chalk.bgMagenta.white(' ULTRA ')
  };
  
  return badges[plan];
}

/**
 * Render command list with plan awareness
 */
export function renderCommandList(
  commands: Array<{
    name: string;
    description: string;
    category: string;
    requiredPlan?: Plan;
  }>,
  currentPlan: Plan = getUserPlan()
): string {
  const grouped = groupByCategory(commands);
  const output: string[] = [];
  
  for (const [category, cmds] of Object.entries(grouped)) {
    output.push('');
    output.push(chalk.bold.white(`${category}:`));
    output.push('');
    
    for (const cmd of cmds) {
      const feature: FeatureUIConfig = {
        name: `/${cmd.name}`,
        description: cmd.description,
        requiredPlan: cmd.requiredPlan || 'FREE'
      };
      
      const isAvailable = isPlanSufficient(currentPlan, feature.requiredPlan);
      
      if (isAvailable) {
        output.push(`  ${renderAvailableFeature(feature)}`);
      } else {
        output.push(`  ${renderGrayedOutFeature(feature, currentPlan)}`);
      }
    }
  }
  
  // Add upgrade prompt if there are locked features
  const hasLockedFeatures = commands.some(cmd => 
    !isPlanSufficient(currentPlan, cmd.requiredPlan || 'FREE')
  );
  
  if (hasLockedFeatures && currentPlan === 'FREE') {
    output.push('');
    output.push(chalk.yellow('  💎 Unlock premium features with /upgrade'));
  }
  
  return output.join('\n');
}

/**
 * Group commands by category
 */
function groupByCategory<T extends { category: string }>(
  items: T[]
): Record<string, T[]> {
  return items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

/**
 * Render upgrade prompt based on attempted feature
 */
export function renderUpgradePrompt(
  feature: string,
  requiredPlan: Plan,
  currentPlan: Plan = getUserPlan()
): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push(chalk.yellow('🔒 Premium Feature'));
  lines.push('');
  lines.push(chalk.white(`The ${chalk.bold(feature)} feature requires a ${chalk.bold(requiredPlan)} plan.`));
  lines.push(chalk.gray(`Your current plan: ${currentPlan}`));
  lines.push('');
  
  if (requiredPlan === 'PRO') {
    lines.push(chalk.green('✨ Upgrade to PRO to unlock:'));
    lines.push(chalk.gray('  • Advanced code generation'));
    lines.push(chalk.gray('  • Higher rate limits (5 req/sec)'));
    lines.push(chalk.gray('  • 500 code operations/month'));
    lines.push(chalk.gray('  • 100 images/month'));
    lines.push(chalk.gray('  • Priority support'));
  } else if (requiredPlan === 'ULTRA') {
    lines.push(chalk.magenta('🚀 Upgrade to ULTRA to unlock:'));
    lines.push(chalk.gray('  • Unlimited code operations'));
    lines.push(chalk.gray('  • Maximum rate limits (10 req/sec)'));
    lines.push(chalk.gray('  • 500 images/month'));
    lines.push(chalk.gray('  • 100 videos/month'));
    lines.push(chalk.gray('  • Custom AI models'));
    lines.push(chalk.gray('  • Dedicated support'));
  }
  
  lines.push('');
  lines.push(chalk.cyan('📈 Upgrade now: /upgrade'));
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Render feature comparison table
 */
export function renderFeatureComparison(): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push(chalk.bold.white('📊 Plan Comparison'));
  lines.push('');
  lines.push(chalk.gray('─'.repeat(60)));
  lines.push('');
  
  // Header
  lines.push(`  ${chalk.gray.bold('Feature')}${' '.repeat(25)}${chalk.bold('FREE')}   ${chalk.yellow.bold('PRO')}    ${chalk.magenta.bold('ULTRA')}`);
  lines.push('');
  
  // Features
  const features = [
    ['Code Operations/month', '20', '500', 'Unlimited'],
    ['Images/month', '25', '100', '500'],
    ['Videos/month', '5', '25', '100'],
    ['Rate Limit', '1/3s', '5/s', '10/s'],
    ['Advanced Models', '❌', '✅', '✅'],
    ['Custom Models', '❌', '❌', '✅'],
    ['Priority Support', '❌', '✅', '✅'],
    ['API Access', '❌', '❌', '✅']
  ];
  
  for (const [feature, free, pro, ultra] of features) {
    const featurePadded = feature.padEnd(30);
    const freePadded = formatValue(free).padEnd(7);
    const proPadded = formatValue(pro, 'yellow').padEnd(17);
    const ultraPadded = formatValue(ultra, 'magenta');
    
    lines.push(`  ${featurePadded}${freePadded}${proPadded}${ultraPadded}`);
  }
  
  lines.push('');
  lines.push(chalk.gray('─'.repeat(60)));
  lines.push('');
  lines.push(chalk.cyan('  💎 Upgrade: /upgrade'));
  lines.push('');
  
  return lines.join('\n');
}

function formatValue(value: string, color?: string): string {
  if (value === '❌') return chalk.red(value);
  if (value === '✅') return chalk.green(value);
  if (value === 'Unlimited') {
    return color === 'magenta' ? chalk.magenta.bold(value) : chalk.bold(value);
  }
  
  switch (color) {
    case 'yellow':
      return chalk.yellow(value);
    case 'magenta':
      return chalk.magenta(value);
    default:
      return chalk.white(value);
  }
}

/**
 * Interactive feature selector with plan filtering
 */
export function renderFeatureSelector(
  features: FeatureUIConfig[],
  selectedIndex: number,
  currentPlan: Plan = getUserPlan()
): string {
  const lines: string[] = [];
  
  features.forEach((feature, index) => {
    const isSelected = index === selectedIndex;
    const isAvailable = isPlanSufficient(currentPlan, feature.requiredPlan);
    
    let line = isSelected ? '▶ ' : '  ';
    
    if (isAvailable) {
      if (isSelected) {
        line += chalk.bgCyan.black(` ${feature.name} `);
      } else {
        line += chalk.cyan(feature.name);
      }
      
      if (feature.description) {
        line += chalk.gray(` - ${feature.description}`);
      }
    } else {
      line += chalk.gray.dim(feature.name);
      line += ' ' + renderPlanBadge(feature.requiredPlan);
      
      if (feature.description) {
        line += chalk.gray.dim(` - ${feature.description}`);
      }
      
      if (isSelected) {
        line += chalk.yellow(' (Upgrade required)');
      }
    }
    
    lines.push(line);
  });
  
  return lines.join('\n');
}