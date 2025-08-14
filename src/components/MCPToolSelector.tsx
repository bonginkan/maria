/**
 * MCP Tool Selector Component
 * インタラクティブツール選択UI
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { MCPService, MCPToolExecution } from '../mcp/MCPService.js';

export interface MCPToolSelectorProps {
  mcpService: MCPService;
  onExecute: (result: unknown) => void;
  onCancel: () => void;
}

interface ToolOption {
  server: string;
  tool: string;
  description: string;
}

type View = 'servers' | 'tools' | 'params' | 'executing' | 'result';

const MCPToolSelector: React.FC<MCPToolSelectorProps> = ({ mcpService, onExecute, onCancel }) => {
  const [currentView, setCurrentView] = useState<View>('servers');
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [selectedTool, setSelectedTool] = useState<string>('');
  const [toolParams, setToolParams] = useState<Record<string, unknown>>({});
  const [currentParam, setCurrentParam] = useState<string>('');
  const [paramValue, setParamValue] = useState<string>('');
  const [execution, setExecution] = useState<MCPToolExecution | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const [availableTools, setAvailableTools] = useState<ToolOption[]>([]);

  useInput((_input, key) => {
    if (key.escape) {
      if (currentView === 'servers') {
        onCancel();
      } else if (currentView === 'result') {
        onExecute(result);
      } else {
        // Go back one step
        switch (currentView) {
          case 'tools':
            setCurrentView('servers');
            break;
          case 'params':
            setCurrentView('tools');
            break;
          case 'executing':
            // Can't go back while executing
            break;
        }
      }
    }
  });

  useEffect(() => {
    // Get available tools when component mounts
    const tools = mcpService.getAvailableTools();
    const options: ToolOption[] = [];

    for (const { server, tools: serverTools } of tools) {
      for (const tool of serverTools) {
        options.push({
          server,
          tool: tool.name,
          description: tool.description,
        });
      }
    }

    setAvailableTools(options);
  }, [mcpService]);

  const handleServerSelect = useCallback((server: string) => {
    setSelectedServer(server);
    setCurrentView('tools');
  }, []);

  const handleToolSelect = useCallback(
    (toolOption: ToolOption) => {
      setSelectedTool(toolOption.tool);
      setSelectedServer(toolOption.server);

      // Get tool schema to determine required parameters
      const tools = mcpService.getAvailableTools();
      const serverTools = tools.find((t) => t.server === toolOption.server);
      const tool = serverTools?.tools.find((t) => t.name === toolOption.tool);

      if (tool?.inputSchema?.properties) {
        const params = Object.keys(tool.inputSchema.properties);
        if (params.length > 0) {
          setCurrentParam(params[0] || '');
          setCurrentView('params');
        } else {
          // No parameters needed, execute directly
          executeTool({});
        }
      } else {
        // No schema, execute without parameters
        executeTool({});
      }
    },
    [mcpService],
  );

  const handleParamInput = useCallback((value: string) => {
    setParamValue(value);
  }, []);

  const handleParamSubmit = useCallback(() => {
    // Save current parameter value
    const newParams = { ...toolParams, [currentParam]: paramValue };
    setToolParams(newParams);
    setParamValue('');

    // Get next parameter
    const tools = mcpService.getAvailableTools();
    const serverTools = tools.find((t) => t.server === selectedServer);
    const tool = serverTools?.tools.find((t) => t.name === selectedTool);

    if (tool?.inputSchema?.properties) {
      const allParams = Object.keys(tool.inputSchema.properties);
      const currentIndex = allParams.indexOf(currentParam);

      if (currentIndex < allParams.length - 1) {
        // More parameters to fill
        setCurrentParam(allParams[currentIndex + 1] || '');
      } else {
        // All parameters filled, execute
        executeTool(newParams);
      }
    }
  }, [currentParam, paramValue, toolParams, selectedServer, selectedTool, mcpService]);

  const executeTool = useCallback(
    async (params: Record<string, unknown>) => {
      setCurrentView('executing');
      setError(null);

      const exec: MCPToolExecution = {
        server: selectedServer,
        tool: selectedTool,
        args: params,
        startTime: new Date(),
      };
      setExecution(exec);

      try {
        const result = await mcpService.executeTool(selectedServer, selectedTool, params);
        setResult(result);
        setCurrentView('result');
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
        setCurrentView('result');
      }
    },
    [selectedServer, selectedTool, mcpService],
  );

  const renderServerSelection = () => {
    const servers = mcpService.getServerStatus();
    const runningServers = servers.filter((s) => s.status === 'running');

    if (runningServers.length === 0) {
      return (
        <Box flexDirection="column">
          <Text color="yellow">⚠️ No MCP servers are currently running</Text>
          <Text color="gray">Start a server using /mcp command first</Text>
          <Text color="gray" dimColor>
            Press ESC to go back
          </Text>
        </Box>
      );
    }

    const items = runningServers.map((server) => ({
      label: `${server.id} (${server.status})`,
      value: server.id,
    }));

    return (
      <Box flexDirection="column">
        <Text color="cyan" bold>
          Select MCP Server
        </Text>
        <Box marginTop={1}>
          <SelectInput items={items} onSelect={(item) => handleServerSelect(item.value)} />
        </Box>
      </Box>
    );
  };

  const renderToolSelection = () => {
    const serverTools = availableTools.filter((t) => t.server === selectedServer);

    if (serverTools.length === 0) {
      return (
        <Box flexDirection="column">
          <Text color="yellow">No tools available for {selectedServer}</Text>
          <Text color="gray" dimColor>
            Press ESC to go back
          </Text>
        </Box>
      );
    }

    const items = serverTools.map((tool) => ({
      label: `${tool.tool} - ${tool.description}`,
      value: tool,
    }));

    return (
      <Box flexDirection="column">
        <Text color="cyan" bold>
          Select Tool from {selectedServer}
        </Text>
        <Box marginTop={1}>
          <SelectInput items={items} onSelect={(item) => handleToolSelect(item.value)} />
        </Box>
      </Box>
    );
  };

  const renderParameterInput = () => {
    return (
      <Box flexDirection="column">
        <Text color="cyan" bold>
          Enter Parameters for {selectedTool}
        </Text>
        <Box marginTop={1}>
          <Text>{currentParam}: </Text>
          <TextInput value={paramValue} onChange={handleParamInput} onSubmit={handleParamSubmit} />
        </Box>
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            Press Enter to continue, ESC to go back
          </Text>
        </Box>
      </Box>
    );
  };

  const renderExecuting = () => {
    return (
      <Box flexDirection="column">
        <Text color="cyan">
          <Spinner type="dots" /> Executing {selectedTool}...
        </Text>
        <Box marginTop={1} flexDirection="column">
          <Text color="gray">Server: {selectedServer}</Text>
          <Text color="gray">Tool: {selectedTool}</Text>
          <Text color="gray">Parameters: {JSON.stringify(toolParams, null, 2)}</Text>
        </Box>
      </Box>
    );
  };

  const renderResult = () => {
    return (
      <Box flexDirection="column">
        <Text color={error ? 'red' : 'green'} bold>
          {error ? '❌ Execution Failed' : '✅ Execution Successful'}
        </Text>

        <Box marginTop={1} flexDirection="column">
          <Text color="yellow">Tool: {selectedTool}</Text>
          <Text color="gray">Server: {selectedServer}</Text>
          {execution && (
            <Text color="gray">
              Duration:{' '}
              {execution.endTime
                ? `${execution.endTime.getTime() - execution.startTime.getTime()}ms`
                : 'N/A'}
            </Text>
          )}
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text color="cyan">Result:</Text>
          <Box paddingLeft={2}>
            <Text color={error ? 'red' : 'white'}>{error || JSON.stringify(result, null, 2)}</Text>
          </Box>
        </Box>

        <Box marginTop={1}>
          <Text color="gray" dimColor>
            Press ESC to continue
          </Text>
        </Box>
      </Box>
    );
  };

  switch (currentView) {
    case 'servers':
      return renderServerSelection();
    case 'tools':
      return renderToolSelection();
    case 'params':
      return renderParameterInput();
    case 'executing':
      return renderExecuting();
    case 'result':
      return renderResult();
    default:
      return null;
  }
};

export default MCPToolSelector;
