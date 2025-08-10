/**
 * Slash Command Handler
 * 対話型コマンドシステムの統一処理
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { MariaConfig, loadConfig, saveConfig } from '../utils/config.js';
import ConfigPanel from './ConfigPanel.js';
import SystemDiagnostics from './SystemDiagnostics.js';
import ProjectManager from './ProjectManager.js';
import AgentManager from './AgentManager.js';
import MCPManager from './MCPManager.js';

export interface SlashCommandProps {
  command: string;
  args?: string[];
  onExit: () => void;
}

const SlashCommandHandler: React.FC<SlashCommandProps> = ({ command, args, onExit }) => {
  const [config, setConfig] = useState<MariaConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const loadedConfig = loadConfig();
      setConfig(loadedConfig);
    } catch (err) {
      setError(`Failed to load configuration: ${err}`);
    }
  }, []);

  const handleConfigUpdate = useCallback((newConfig: MariaConfig) => {
    try {
      saveConfig(newConfig);
      setConfig(newConfig);
    } catch (err) {
      setError(`Failed to save configuration: ${err}`);
    }
  }, []);

  useInput((_input, key) => {
    if (key.escape) {
      onExit();
    }
  });

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">❌ Error: {error}</Text>
        <Text color="gray">Press ESC to exit</Text>
      </Box>
    );
  }

  if (!config) {
    return (
      <Box flexDirection="column">
        <Text>Loading configuration...</Text>
      </Box>
    );
  }

  // プロジェクト管理コマンド
  if (command === '/init') {
    return (
      <ProjectManager action="init" config={config} onUpdate={handleConfigUpdate} onExit={onExit} />
    );
  }

  if (command === '/add-dir') {
    return (
      <ProjectManager
        action="add-dir"
        config={config}
        onUpdate={handleConfigUpdate}
        onExit={onExit}
        args={args}
      />
    );
  }

  if (command === '/memory') {
    return (
      <ProjectManager
        action="memory"
        config={config}
        onUpdate={handleConfigUpdate}
        onExit={onExit}
      />
    );
  }

  if (command === '/export') {
    return (
      <ProjectManager
        action="export"
        config={config}
        onUpdate={handleConfigUpdate}
        onExit={onExit}
        args={args}
      />
    );
  }

  // エージェント・統合管理コマンド
  if (command === '/agents') {
    return <AgentManager config={config} onUpdate={handleConfigUpdate} onExit={onExit} />;
  }

  if (command === '/mcp') {
    return <MCPManager config={config} onUpdate={handleConfigUpdate} onExit={onExit} />;
  }

  if (command === '/ide') {
    return (
      <AgentManager action="ide" config={config} onUpdate={handleConfigUpdate} onExit={onExit} />
    );
  }

  if (command === '/install-github-app') {
    return (
      <AgentManager
        action="github-app"
        config={config}
        onUpdate={handleConfigUpdate}
        onExit={onExit}
      />
    );
  }

  // その他のコマンド（既存）
  if (command === '/config') {
    return (
      <ConfigPanel
        config={config}
        onSave={(newConfig) => {
          handleConfigUpdate(newConfig);
          onExit();
        }}
        onCancel={onExit}
      />
    );
  }

  if (command === '/doctor') {
    return <SystemDiagnostics onExit={onExit} />;
  }

  // 不明なコマンド
  return (
    <Box flexDirection="column">
      <Text color="red">❌ Unknown command: {command}</Text>
      <Text color="yellow">Available commands:</Text>
      <Text color="gray"> Project Management: /init, /add-dir, /memory, /export</Text>
      <Text color="gray"> Agent Management: /agents, /mcp, /ide, /install-github-app</Text>
      <Text color="gray"> Configuration: /config, /doctor</Text>
      <Text color="gray">Press ESC to exit</Text>
    </Box>
  );
};

export default SlashCommandHandler;
