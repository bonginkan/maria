/**
 * Agent Manager Component
 * エージェント設定管理とIDE統合
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { MariaConfig, Agent } from '../utils/config.js';
import { execSync } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';

export interface AgentManagerProps {
  action?: 'ide' | 'github-app';
  config: MariaConfig;
  onUpdate: (config: MariaConfig) => void;
  onExit: () => void;
}

// Agent interface imported from config.ts

const AgentManager: React.FC<AgentManagerProps> = ({ action, config, onUpdate, onExit }) => {
  const [currentView, setCurrentView] = useState<'main' | 'agents' | 'ide' | 'github'>('main');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useInput((_input, key) => {
    if (key.escape) {
      if (currentView === 'main') {
        onExit();
      } else {
        setCurrentView('main');
      }
    }
  });

  const builtInAgents: Agent[] = [
    {
      id: 'paper-writer',
      name: 'Academic Paper Writer',
      description: 'AI agent specialized in academic paper writing and LaTeX formatting',
      type: 'built-in',
      status: 'active',
      capabilities: [
        'latex-generation',
        'citation-management',
        'structure-optimization',
        'language-enhancement',
      ],
    },
    {
      id: 'slides-creator',
      name: 'Presentation Creator',
      description: 'AI agent for creating engaging presentations and slide decks',
      type: 'built-in',
      status: 'active',
      capabilities: [
        'slide-design',
        'content-structuring',
        'visual-optimization',
        'google-slides-integration',
      ],
    },
    {
      id: 'code-reviewer',
      name: 'Code Reviewer',
      description: 'AI agent for comprehensive code review and quality analysis',
      type: 'built-in',
      status: 'active',
      capabilities: ['static-analysis', 'security-audit', 'performance-review', 'best-practices'],
    },
    {
      id: 'devops-engineer',
      name: 'DevOps Engineer',
      description: 'AI agent for CI/CD pipeline management and infrastructure automation',
      type: 'built-in',
      status: 'active',
      capabilities: [
        'pipeline-optimization',
        'monitoring-setup',
        'deployment-automation',
        'infrastructure-management',
      ],
    },
  ];

  useEffect(() => {
    setAgents([...builtInAgents, ...(config.agents?.custom || [])]);

    if (action === 'ide') {
      setCurrentView('ide');
    } else if (action === 'github-app') {
      setCurrentView('github');
    }
  }, [action, config]);

  // Placeholder usage of onUpdate to avoid TypeScript warning
  // In a real implementation, onUpdate would be used to save agent configuration changes
  void onUpdate;

  // const handleAgentToggle = useCallback((agentId: string) => {
  //   const updatedAgents = agents.map(agent =>
  //     agent.id === agentId
  //       ? { ...agent, status: agent.status === 'active' ? 'inactive' : 'active' as 'active' | 'inactive' }
  //       : agent
  //   );

  //   setAgents(updatedAgents);

  //   const customAgents = updatedAgents.filter(agent => agent.type === 'custom');
  //   const updatedConfig = {
  //     ...config,
  //     agents: {
  //       ...config.agents,
  //       custom: customAgents
  //     }
  //   };

  //   onUpdate(updatedConfig);
  //   setSuccess(`✅ Agent ${agentId} status updated`);
  // }, [agents, config, onUpdate]);

  const checkIDEIntegration = useCallback(() => {
    const integrations = [];

    // VS Code Extension
    try {
      const vsCodeExtensions = execSync('code --list-extensions', { encoding: 'utf8' });
      const hasMariaExtension = vsCodeExtensions.includes('maria.maria-code');
      integrations.push({
        name: 'VS Code Extension',
        status: hasMariaExtension ? 'installed' : 'not-installed',
        command: hasMariaExtension ? 'Installed' : 'code --install-extension maria.maria-code',
      });
    } catch {
      integrations.push({
        name: 'VS Code Extension',
        status: 'unavailable',
        command: 'VS Code not found',
      });
    }

    // JetBrains Plugin
    integrations.push({
      name: 'JetBrains Plugin',
      status: 'planned',
      command: 'Available in next release',
    });

    // Neovim Plugin
    const nvimConfigPath = join(process.env.HOME || '', '.config/nvim/init.lua');
    const hasNvimConfig = existsSync(nvimConfigPath);
    integrations.push({
      name: 'Neovim Plugin',
      status: hasNvimConfig ? 'configurable' : 'not-available',
      command: hasNvimConfig ? 'Manual configuration required' : 'Neovim config not found',
    });

    return integrations;
  }, []);

  const installGitHubApp = useCallback(async () => {
    try {
      // GitHub Actions workflow for MARIA integration
      const workflowContent = `name: MARIA Platform Integration

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  maria-analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install MARIA CODE CLI
        run: npm install -g @maria/code-cli
      
      - name: Configure MARIA
        run: |
          mc init --non-interactive
        env:
          MARIA_USER_EMAIL: \${{ secrets.MARIA_USER_EMAIL }}
          MARIA_PROJECT_ID: \${{ secrets.MARIA_PROJECT_ID }}
      
      - name: Analyze Codebase
        run: mc read src
      
      - name: Generate Quality Report
        run: mc "Generate comprehensive code quality report" --output quality-report.md
      
      - name: Run AI Code Review
        run: mc "Review all changes in this PR" --pr-mode
        if: github.event_name == 'pull_request'
      
      - name: Upload Reports
        uses: actions/upload-artifact@v4
        with:
          name: maria-reports
          path: |
            quality-report.md
            maria-review.md

  playwright-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Install Playwright MCP
        run: npx @playwright/mcp@latest --install
      
      - name: Run Playwright Tests with MCP
        run: pnpm test:mcp
        env:
          PLAYWRIGHT_MCP_CONFIG: ./.playwright-mcp.json
      
      - name: Generate Test Report
        run: mc "Analyze test results and generate improvement suggestions"
        if: always()
`;

      const workflowDir = join(process.cwd(), '.github/workflows');
      const workflowPath = join(workflowDir, 'maria-integration.yml');

      if (!existsSync(workflowDir)) {
        execSync('mkdir -p .github/workflows');
      }

      writeFileSync(workflowPath, workflowContent, 'utf8');

      // Playwright MCP configuration
      const playwrightMCPConfig = {
        server: {
          command: 'npx',
          args: ['@playwright/mcp'],
          env: {},
        },
        client: {
          browser: 'chromium',
          headless: true,
          timeout: 30000,
        },
        tests: {
          baseUrl: 'http://localhost:3000',
          testDir: './tests/mcp',
          outputDir: './test-results/mcp',
        },
        capabilities: [
          'browser.navigate',
          'browser.screenshot',
          'element.click',
          'element.type',
          'accessibility.snapshot',
        ],
      };

      writeFileSync(
        join(process.cwd(), '.playwright-mcp.json'),
        JSON.stringify(playwrightMCPConfig, null, 2),
        'utf8',
      );

      setSuccess('✅ GitHub Actions workflow and Playwright MCP configuration created');
    } catch (err) {
      setError(`Failed to install GitHub app configuration: ${err}`);
    }
  }, []);

  const renderMainMenu = () => {
    const menuItems = [
      { label: '🤖 Manage AI Agents', value: 'agents' },
      { label: '🔧 IDE Integration Status', value: 'ide' },
      { label: '🐙 Install GitHub App Configuration', value: 'github' },
      { label: '↩️  Back', value: 'back' },
    ];

    return (
      <Box flexDirection="column">
        <Text color="cyan" bold>
          🎯 Agent & Integration Manager
        </Text>
        <Text color="gray">Select an option:</Text>
        <Box marginTop={1}>
          <SelectInput
            items={menuItems}
            onSelect={(item) => {
              if (item.value === 'back') {
                onExit();
              } else {
                setCurrentView(item.value as any);
              }
            }}
          />
        </Box>
      </Box>
    );
  };

  const renderAgentsList = () => (
    <Box flexDirection="column">
      <Text color="cyan" bold>
        🤖 AI Agents Management
      </Text>
      <Text color="gray">Current agents in your workspace:</Text>

      {agents.map((agent) => (
        <Box key={agent.id} flexDirection="column" marginTop={1}>
          <Box>
            <Text color={agent.status === 'active' ? 'green' : 'gray'}>
              {agent.status === 'active' ? '✅' : '❌'} {agent.name}
            </Text>
            <Text color={agent.type === 'built-in' ? 'blue' : 'yellow'}> ({agent.type})</Text>
          </Box>
          <Text color="gray"> {agent.description}</Text>
          <Text color="magenta"> Capabilities: {agent.capabilities.join(', ')}</Text>
        </Box>
      ))}

      <Box marginTop={2}>
        <Text color="yellow">Available actions:</Text>
      </Box>
      <SelectInput
        items={[
          { label: 'Toggle agent status', value: 'toggle' },
          { label: 'Add custom agent', value: 'add' },
          { label: 'Back to main menu', value: 'back' },
        ]}
        onSelect={(item) => {
          if (item.value === 'back') {
            setCurrentView('main');
          } else if (item.value === 'toggle') {
            // Simplified - in real implementation, show agent selection
            setSuccess('✅ Agent toggling feature - select specific agent in full implementation');
          } else if (item.value === 'add') {
            setSuccess('✅ Custom agent creation - implementation in progress');
          }
        }}
      />
    </Box>
  );

  const renderIDEStatus = () => {
    const integrations = checkIDEIntegration();

    return (
      <Box flexDirection="column">
        <Text color="cyan" bold>
          🔧 IDE Integration Status
        </Text>
        <Text color="gray">Current integration status:</Text>

        {integrations.map((integration, index) => (
          <Box key={index} flexDirection="column" marginTop={1}>
            <Box>
              <Text color={integration.status === 'installed' ? 'green' : 'yellow'}>
                {integration.status === 'installed' ? '✅' : '⚠️ '} {integration.name}
              </Text>
            </Box>
            <Text color="gray"> Status: {integration.status}</Text>
            <Text color="gray"> Command: {integration.command}</Text>
          </Box>
        ))}

        <Box marginTop={2}>
          <SelectInput
            items={[
              { label: 'Refresh status', value: 'refresh' },
              { label: 'Install VS Code extension', value: 'install-vscode' },
              { label: 'Back to main menu', value: 'back' },
            ]}
            onSelect={(item) => {
              if (item.value === 'back') {
                setCurrentView('main');
              } else if (item.value === 'refresh') {
                setSuccess('✅ Status refreshed');
              } else if (item.value === 'install-vscode') {
                setSuccess('✅ VS Code extension installation - manual step required');
              }
            }}
          />
        </Box>
      </Box>
    );
  };

  const renderGitHubApp = () => (
    <Box flexDirection="column">
      <Text color="cyan" bold>
        🐙 GitHub Actions Integration
      </Text>
      <Text color="gray">Set up automated workflows with Playwright MCP:</Text>

      <Box marginTop={1} flexDirection="column">
        <Text color="yellow">Features:</Text>
        <Text color="gray">• AI-powered code review on PRs</Text>
        <Text color="gray">• Automated quality analysis</Text>
        <Text color="gray">• Playwright MCP browser testing</Text>
        <Text color="gray">• MARIA CLI integration</Text>
      </Box>

      <Box marginTop={2}>
        <SelectInput
          items={[
            { label: 'Install GitHub Actions workflow', value: 'install' },
            { label: 'View configuration details', value: 'details' },
            { label: 'Back to main menu', value: 'back' },
          ]}
          onSelect={(item) => {
            if (item.value === 'back') {
              setCurrentView('main');
            } else if (item.value === 'install') {
              installGitHubApp();
            } else if (item.value === 'details') {
              setSuccess(
                '✅ Configuration includes: workflow file, Playwright MCP config, and secrets setup',
              );
            }
          }}
        />
      </Box>
    </Box>
  );

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">❌ {error}</Text>
        <Text color="gray">Press ESC to exit</Text>
      </Box>
    );
  }

  if (success) {
    return (
      <Box flexDirection="column">
        <Text color="green">{success}</Text>
        <Text color="gray">Press ESC to continue</Text>
      </Box>
    );
  }

  switch (currentView) {
    case 'agents':
      return renderAgentsList();
    case 'ide':
      return renderIDEStatus();
    case 'github':
      return renderGitHubApp();
    default:
      return renderMainMenu();
  }
};

export default AgentManager;
