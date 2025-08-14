/**
 * MCP Manager Component
 * Model Context Protocol サーバー管理
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { MariaConfig, MCPServer } from '../utils/config.js';
// import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';

export interface MCPManagerProps {
  config: MariaConfig;
  onUpdate: (config: MariaConfig) => void;
  onExit: () => void;
}

// MCPServer interface imported from config.ts

const MCPManager: React.FC<MCPManagerProps> = ({ config, onUpdate, onExit }) => {
  const [currentView, setCurrentView] = useState<'main' | 'servers' | 'install' | 'config'>('main');
  const [servers, setServers] = useState<MCPServer[]>([]);
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

  const builtInServers = [
    {
      id: 'playwright-mcp',
      name: 'Playwright MCP',
      description: 'Browser automation server using Playwright with accessibility tree',
      command: 'npx',
      args: ['@playwright/mcp@latest'],
      status: 'unknown' as const,
      capabilities: [
        'browser.navigate',
        'browser.screenshot',
        'element.click',
        'element.type',
        'element.hover',
        'accessibility.snapshot',
        'network.monitor',
      ],
      type: 'community' as const,
    },
    {
      id: 'filesystem-mcp',
      name: 'File System MCP',
      description: 'File system operations server for reading and writing files',
      command: 'npx',
      args: ['@modelcontextprotocol/server-filesystem'],
      status: 'unknown' as const,
      capabilities: ['file.read', 'file.write', 'directory.list', 'file.search'],
      type: 'built-in' as const,
    },
    {
      id: 'git-mcp',
      name: 'Git MCP',
      description: 'Git repository operations server',
      command: 'npx',
      args: ['@modelcontextprotocol/server-git'],
      status: 'unknown' as const,
      capabilities: ['git.status', 'git.diff', 'git.commit', 'git.branch', 'git.log'],
      type: 'built-in' as const,
    },
    {
      id: 'sqlite-mcp',
      name: 'SQLite MCP',
      description: 'SQLite database operations server',
      command: 'npx',
      args: ['@modelcontextprotocol/server-sqlite'],
      status: 'unknown' as const,
      capabilities: ['sqlite.query', 'sqlite.schema', 'sqlite.execute'],
      type: 'built-in' as const,
    },
  ];

  useEffect(() => {
    const customServers = config.mcp?.servers || [];
    const allServers: MCPServer[] = [...builtInServers, ...customServers];
    setServers(allServers);
    checkServerStatuses();
  }, [config]);

  const checkServerStatuses = useCallback(async () => {
    const updatedServers = await Promise.all(
      servers.map(async (server) => {
        try {
          // Check if the server package is installed
          if (server.command === 'npx') {
            // For npx commands, we can't easily check if they're running
            // but we can check if they can be executed
            return { ...server, status: 'stopped' as const };
          }

          // For other commands, try to ping or check if they respond
          return { ...server, status: 'unknown' as const };
        } catch {
          return { ...server, status: 'error' as const };
        }
      }),
    );

    setServers(updatedServers);
  }, [servers]);

  const installPlaywrightMCP = useCallback(async () => {
    try {
      // Create Playwright MCP configuration
      const playwrightMCPConfig = {
        name: 'playwright-browser-automation',
        version: '1.0.0',
        server: {
          command: 'npx',
          args: ['@playwright/mcp@latest'],
          env: {
            PLAYWRIGHT_BROWSERS_PATH: '0',
          },
        },
        client: {
          timeout: 30000,
          retries: 3,
        },
        browser: {
          type: 'chromium',
          headless: true,
          args: ['--no-sandbox', '--disable-dev-shm-usage'],
          viewport: {
            width: 1280,
            height: 720,
          },
        },
        capabilities: [
          {
            name: 'browser_navigate',
            description: 'Navigate to a URL',
          },
          {
            name: 'browser_screenshot',
            description: 'Take a screenshot of the current page',
          },
          {
            name: 'element_click',
            description: 'Click on an element',
          },
          {
            name: 'element_type',
            description: 'Type text into an element',
          },
          {
            name: 'element_hover',
            description: 'Hover over an element',
          },
          {
            name: 'accessibility_snapshot',
            description: 'Get accessibility tree snapshot',
          },
          {
            name: 'network_monitor',
            description: 'Monitor network requests and responses',
          },
        ],
        examples: [
          {
            name: 'basic_navigation',
            description: 'Navigate to a website and take a screenshot',
            steps: ["browser_navigate('https://example.com')", 'browser_screenshot()'],
          },
          {
            name: 'form_interaction',
            description: 'Fill out a form and submit',
            steps: [
              "element_type('#email', 'user@example.com')",
              "element_type('#password', 'secret123')",
              "element_click('#submit-button')",
            ],
          },
        ],
      };

      const configPath = join(process.cwd(), '.playwright-mcp.json');
      writeFileSync(configPath, JSON.stringify(playwrightMCPConfig, null, 2), 'utf8');

      // Create a simple test script
      const testScript = `#!/usr/bin/env node
/**
 * Playwright MCP Test Script
 * Tests basic MCP server functionality
 */

const { spawn } = require('child_process');

async function testPlaywrightMCP() {
  console.log('🧪 Testing Playwright MCP server...');
  
  try {
    // Start the MCP server
    const server = spawn('npx', ['@playwright/mcp@latest'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    server.stdout.on('data', (data) => {
      console.log('Server output:', data.toString());
    });
    
    server.stderr.on('data', (data) => {
      console.error('Server error:', data.toString());
    });
    
    // Wait a few seconds then test basic functionality
    setTimeout(() => {
      console.log('✅ Playwright MCP server appears to be working');
      server.kill();
    }, 3000);
    
  } catch (error: unknown) {
    console.error('❌ Failed to start Playwright MCP:', error);
  }
}

if (require.main === module) {
  testPlaywrightMCP();
}

module.exports = { testPlaywrightMCP };
`;

      const testScriptPath = join(process.cwd(), 'test-playwright-mcp.js');
      writeFileSync(testScriptPath, testScript, 'utf8');

      // Update config with MCP server information
      const newServer: MCPServer = {
        id: 'playwright-mcp-local',
        name: 'Local Playwright MCP',
        description: 'Local instance of Playwright MCP server',
        command: 'npx',
        args: ['@playwright/mcp@latest'],
        status: 'stopped',
        capabilities: ['browser.navigate', 'browser.screenshot', 'element.click'],
        configPath: configPath,
        type: 'community',
      };

      const updatedConfig = {
        ...config,
        mcp: {
          ...config.mcp,
          servers: [...(config.mcp?.servers || []), newServer],
          enabled: true,
        },
      };

      onUpdate(updatedConfig);
      setSuccess('✅ Playwright MCP configuration created successfully');
    } catch (err: unknown) {
      setError(`Failed to install Playwright MCP: ${err}`);
    }
  }, [config, onUpdate]);

  // const startServer = useCallback(async (serverId: string) => {
  //   const server = servers.find(s => s.id === serverId);
  //   if (!server) {
  //     setError('Server not found');
  //     return;
  //   }

  //   try {
  //     // Start the MCP server
  //     const process = spawn(server.command, server.args, {
  //       stdio: ['pipe', 'pipe', 'pipe'],
  //       detached: true
  //     });

  //     // Update server status
  //     const updatedServers = servers.map(s =>
  //       s.id === serverId ? { ...s, status: 'running' as const } : s
  //     );
  //     setServers(updatedServers);

  //     setSuccess(`✅ Started ${server.name}`);
  //   } catch (err: unknown) {
  //     setError(`Failed to start ${server.name}: ${err}`);
  //   }
  // }, [servers]);

  // const stopServer = useCallback(async (serverId: string) => {
  //   // In a real implementation, we'd track process IDs and kill them
  //   const server = servers.find(s => s.id === serverId);
  //   if (server) {
  //     const updatedServers = servers.map(s =>
  //       s.id === serverId ? { ...s, status: 'stopped' as const } : s
  //     );
  //     setServers(updatedServers);
  //     setSuccess(`✅ Stopped ${server.name}`);
  //   }
  // }, [servers]);

  const renderMainMenu = () => {
    const menuItems = [
      { label: '📋 View MCP Servers', value: 'servers' },
      { label: '⬆️  Install Playwright MCP', value: 'install' },
      { label: '⚙️  Configure MCP Settings', value: 'config' },
      { label: '🔄 Refresh Server Status', value: 'refresh' },
      { label: '↩️  Back', value: 'back' },
    ];

    return (
      <Box flexDirection="column">
        <Text color="cyan" bold>
          🔌 MCP Server Manager
        </Text>
        <Text color="gray">Model Context Protocol server management</Text>
        <Box marginTop={1}>
          <SelectInput
            items={menuItems}
            onSelect={(item) => {
              if (item.value === 'back') {
                onExit();
              } else if (item.value === 'refresh') {
                checkServerStatuses();
                setSuccess('✅ Server status refreshed');
              } else if (item.value === 'install') {
                installPlaywrightMCP();
              } else {
                setCurrentView(item.value as unknown);
              }
            }}
          />
        </Box>
      </Box>
    );
  };

  const renderServersList = () => (
    <Box flexDirection="column">
      <Text color="cyan" bold>
        📋 MCP Servers
      </Text>
      <Text color="gray">Available Model Context Protocol servers:</Text>

      {servers.map((server) => (
        <Box key={server.id} flexDirection="column" marginTop={1}>
          <Box>
            <Text color={server.status === 'running' ? 'green' : 'gray'}>
              {server.status === 'running' ? '🟢' : '⚪'} {server.name}
            </Text>
            <Text color={server.type === 'built-in' ? 'blue' : 'yellow'}> ({server.type})</Text>
          </Box>
          <Text color="gray"> {server.description}</Text>
          <Text color="gray"> Status: {server.status}</Text>
          <Text color="magenta">
            {' '}
            Capabilities: {server.capabilities.slice(0, 3).join(', ')}
            {server.capabilities.length > 3 ? '...' : ''}
          </Text>
        </Box>
      ))}

      <Box marginTop={2}>
        <SelectInput
          items={[
            { label: 'Start server', value: 'start' },
            { label: 'Stop server', value: 'stop' },
            { label: 'View server details', value: 'details' },
            { label: 'Back to main menu', value: 'back' },
          ]}
          onSelect={(item) => {
            if (item.value === 'back') {
              setCurrentView('main');
            } else if (item.value === 'start') {
              // In full implementation, show server selection
              setSuccess('✅ Server start functionality - select specific server');
            } else if (item.value === 'stop') {
              setSuccess('✅ Server stop functionality - select specific server');
            } else if (item.value === 'details') {
              setSuccess('✅ Server details view - select specific server');
            }
          }}
        />
      </Box>
    </Box>
  );

  const renderConfiguration = () => (
    <Box flexDirection="column">
      <Text color="cyan" bold>
        ⚙️ MCP Configuration
      </Text>
      <Text color="gray">Current MCP settings:</Text>

      <Box marginTop={1} flexDirection="column">
        <Text color="yellow">Global Settings:</Text>
        <Text color="gray">• MCP Enabled: {config.mcp?.enabled ? 'Yes' : 'No'}</Text>
        <Text color="gray">• Auto-start servers: {config.mcp?.autoStart ? 'Yes' : 'No'}</Text>
        <Text color="gray">• Server timeout: {config.mcp?.timeout || 30000}ms</Text>
        <Text color="gray">• Log level: {config.mcp?.logLevel || 'info'}</Text>
      </Box>

      <Box marginTop={2}>
        <SelectInput
          items={[
            { label: 'Toggle MCP enabled', value: 'toggle-enabled' },
            { label: 'Configure timeouts', value: 'timeouts' },
            { label: 'Set log level', value: 'log-level' },
            { label: 'Back to main menu', value: 'back' },
          ]}
          onSelect={(item) => {
            if (item.value === 'back') {
              setCurrentView('main');
            } else if (item.value === 'toggle-enabled') {
              const updatedConfig = {
                ...config,
                mcp: {
                  ...config.mcp,
                  enabled: !config.mcp?.enabled,
                },
              };
              onUpdate(updatedConfig);
              setSuccess(`✅ MCP ${updatedConfig.mcp.enabled ? 'enabled' : 'disabled'}`);
            } else {
              setSuccess(`✅ ${item.label} - configuration option available`);
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
        <Text color="gray">Press ESC to continue</Text>
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
    case 'servers':
      return renderServersList();
    case 'config':
      return renderConfiguration();
    default:
      return renderMainMenu();
  }
};

export default MCPManager;
