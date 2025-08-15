/**
 * System Diagnostics Component
 * システム状態診断・検証用UI
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { readConfig } from '../utils/config.js';

interface DiagnosticResult {
  name: string;
  status: 'checking' | 'success' | 'warning' | 'error';
  message: string;
  details?: string;
}

interface SystemDiagnosticsProps {
  onExit: () => void;
}

const SystemDiagnostics: React.FC<SystemDiagnosticsProps> = ({ onExit }) => {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [currentCheck, setCurrentCheck] = useState(0);

  useInput((_input, key) => {
    if (key.escape) {
      onExit();
    }
  });

  const diagnosticChecks = [
    'Configuration file validation',
    'Node.js version compatibility',
    'NPM dependencies',
    'API endpoint connectivity',
    'Authentication status',
    'Storage permissions',
    'Neo4j connection',
    'AI model availability',
    'System resources',
  ];

  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    const newResults: DiagnosticResult[] = [];

    // 設定ファイル検証
    newResults.push(await checkConfiguration());
    setResults([...newResults]);
    setCurrentCheck(1);

    // Node.js バージョンチェック
    newResults.push(await checkNodeVersion());
    setResults([...newResults]);
    setCurrentCheck(2);

    // NPM依存関係チェック
    newResults.push(await checkDependencies());
    setResults([...newResults]);
    setCurrentCheck(3);

    // API接続性チェック
    newResults.push(await checkAPIConnectivity());
    setResults([...newResults]);
    setCurrentCheck(4);

    // 認証状態チェック
    newResults.push(await checkAuthentication());
    setResults([...newResults]);
    setCurrentCheck(5);

    // ストレージ権限チェック
    newResults.push(await checkStoragePermissions());
    setResults([...newResults]);
    setCurrentCheck(6);

    // Neo4j接続チェック
    // Only check Neo4j if enabled
    if (process.env['NEO4J_ENABLED'] === 'true') {
      newResults.push(await checkNeo4jConnection());
    } else {
      newResults.push({
        name: 'Neo4j',
        status: 'success' as const,
        message: 'Graph database disabled (optional feature)',
        details: 'Set NEO4J_ENABLED=true to enable',
      });
    }
    setResults([...newResults]);
    setCurrentCheck(7);

    // AIモデル可用性チェック
    newResults.push(await checkAIModels());
    setResults([...newResults]);
    setCurrentCheck(8);

    // システムリソースチェック
    newResults.push(await checkSystemResources());
    setResults([...newResults]);
    setCurrentCheck(9);

    // 診断完了 - UI表示継続のためonExitは手動で呼び出し
  };

  const checkConfiguration = async (): Promise<DiagnosticResult> => {
    try {
      const config = await readConfig();

      if (!config.apiUrl) {
        return {
          name: 'Configuration',
          status: 'warning',
          message: 'API URL not configured',
          details: 'Using default localhost:8080',
        };
      }

      return {
        name: 'Configuration',
        status: 'success',
        message: 'Configuration valid',
        details: `API URL: ${config.apiUrl}`,
      };
    } catch (error: unknown) {
      return {
        name: 'Configuration',
        status: 'error',
        message: 'Configuration file error',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };

  const checkNodeVersion = async (): Promise<DiagnosticResult> => {
    const version = process.version;
    if (!version) {
      return {
        name: 'Node.js',
        status: 'error',
        message: 'Unable to determine Node.js version',
        details: 'process.version is undefined',
      };
    }
    const majorVersion = parseInt(version.slice(1).split('.')[0] || '0');

    if (majorVersion >= 18) {
      return {
        name: 'Node.js',
        status: 'success',
        message: 'Node.js version compatible',
        details: `Version: ${version}`,
      };
    } else if (majorVersion >= 16) {
      return {
        name: 'Node.js',
        status: 'warning',
        message: 'Node.js version outdated',
        details: `Version: ${version} (recommended: 18+)`,
      };
    } else {
      return {
        name: 'Node.js',
        status: 'error',
        message: 'Node.js version too old',
        details: `Version: ${version} (minimum: 16+)`,
      };
    }
  };

  const checkDependencies = async (): Promise<DiagnosticResult> => {
    try {
      // 重要なパッケージの存在確認
      const criticalDeps = ['ink', 'uuid', 'toml'];
      const missingDeps: string[] = [];

      for (const dep of criticalDeps) {
        try {
          await import(dep);
        } catch {
          missingDeps.push(dep);
        }
      }

      if (missingDeps.length === 0) {
        return {
          name: 'Dependencies',
          status: 'success',
          message: 'All dependencies available',
          details: `Checked: ${criticalDeps.join(', ')}`,
        };
      } else {
        return {
          name: 'Dependencies',
          status: 'error',
          message: 'Missing dependencies',
          details: `Missing: ${missingDeps.join(', ')}`,
        };
      }
    } catch (error: unknown) {
      return {
        name: 'Dependencies',
        status: 'error',
        message: 'Dependency check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };

  const checkAPIConnectivity = async (): Promise<DiagnosticResult> => {
    try {
      const config = await readConfig();
      const apiUrl = config.apiUrl || 'http://localhost:8080';

      // ヘルスチェックエンドポイントをテスト
      const response = await fetch(`${apiUrl}/health`, {
        method: 'GET',
        timeout: 5000,
      } as RequestInit);

      if (response.ok) {
        return {
          name: 'API Connectivity',
          status: 'success',
          message: 'API server reachable',
          details: `Status: ${response.status} (${apiUrl})`,
        };
      } else {
        return {
          name: 'API Connectivity',
          status: 'warning',
          message: 'API server responded with error',
          details: `Status: ${response.status} (${apiUrl})`,
        };
      }
    } catch (error: unknown) {
      return {
        name: 'API Connectivity',
        status: 'error',
        message: 'Cannot reach API server',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };

  const checkAuthentication = async (): Promise<DiagnosticResult> => {
    // TODO: 実際の認証チェックを実装
    return {
      name: 'Authentication',
      status: 'warning',
      message: 'Authentication not configured',
      details: 'Run /login to authenticate',
    };
  };

  const checkStoragePermissions = async (): Promise<DiagnosticResult> => {
    try {
      const fs = await import('fs');
      const os = await import('os');
      const path = await import('path');

      const testDir = path.join(os.homedir(), '.maria-code-test');

      // 書き込みテスト
      fs.writeFileSync(testDir, 'test');
      fs.unlinkSync(testDir);

      return {
        name: 'Storage',
        status: 'success',
        message: 'File system permissions OK',
        details: 'Read/write access verified',
      };
    } catch (error: unknown) {
      return {
        name: 'Storage',
        status: 'error',
        message: 'File system permission error',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };

  const checkNeo4jConnection = async (): Promise<DiagnosticResult> => {
    try {
      const config = await readConfig();

      if (!config.neo4j?.instanceId) {
        return {
          name: 'Neo4j',
          status: 'warning',
          message: 'Neo4j not configured',
          details: 'Graph features unavailable',
        };
      }

      // TODO: 実際のNeo4j接続テスト
      return {
        name: 'Neo4j',
        status: 'success',
        message: 'Neo4j configuration found',
        details: `Instance: ${config.neo4j.instanceId}`,
      };
    } catch (error: unknown) {
      return {
        name: 'Neo4j',
        status: 'error',
        message: 'Neo4j connection failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };

  const checkAIModels = async (): Promise<DiagnosticResult> => {
    const availableModels = [];

    // Gemini可用性チェック
    if (process.env['GROK_API_KEY'] || process.env['VERTEX_TOKEN']) {
      availableModels.push('AI models configured');
    }

    if (availableModels.length > 0) {
      return {
        name: 'AI Models',
        status: 'success',
        message: 'AI models available',
        details: availableModels.join(', '),
      };
    } else {
      return {
        name: 'AI Models',
        status: 'warning',
        message: 'No AI API keys configured',
        details: 'Set GROK_API_KEY or VERTEX_TOKEN',
      };
    }
  };

  const checkSystemResources = async (): Promise<DiagnosticResult> => {
    const memoryUsage = process.memoryUsage();
    const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const memoryTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);

    if (memoryUsedMB < 100) {
      return {
        name: 'System Resources',
        status: 'success',
        message: 'Memory usage normal',
        details: `${memoryUsedMB}MB / ${memoryTotalMB}MB used`,
      };
    } else if (memoryUsedMB < 200) {
      return {
        name: 'System Resources',
        status: 'warning',
        message: 'Memory usage elevated',
        details: `${memoryUsedMB}MB / ${memoryTotalMB}MB used`,
      };
    } else {
      return {
        name: 'System Resources',
        status: 'error',
        message: 'High memory usage',
        details: `${memoryUsedMB}MB / ${memoryTotalMB}MB used`,
      };
    }
  };

  const getStatusColor = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return 'green';
      case 'warning':
        return 'yellow';
      case 'error':
        return 'red';
      case 'checking':
        return 'blue';
      default:
        return 'gray';
    }
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      case 'checking':
        return '🔍';
      default:
        return '⏸️';
    }
  };

  return (
    <Box flexDirection="column">
      <Text color="cyan" bold>
        🔧 System Diagnostics
      </Text>
      <Text color="gray">Running diagnostic checks...</Text>

      <Box marginTop={1} flexDirection="column">
        {diagnosticChecks.map((checkName, index) => {
          const result = results[index];
          const isCurrentCheck = index === currentCheck && !result;

          return (
            <Box key={index} marginBottom={0}>
              <Box minWidth={3}>
                {isCurrentCheck ? (
                  <Text color="blue">
                    <Spinner type="dots" />
                  </Text>
                ) : result ? (
                  <Text>{getStatusIcon(result.status)}</Text>
                ) : (
                  <Text color="gray">⏸️</Text>
                )}
              </Box>
              <Box flexDirection="column" marginLeft={1}>
                <Text color={result ? getStatusColor(result.status) : 'gray'}>
                  {result?.name || checkName}
                  {result && `: ${result.message}`}
                </Text>
                {result?.details && (
                  <Box marginLeft={2}>
                    <Text color="gray">{result.details}</Text>
                  </Box>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      {results.length === diagnosticChecks.length && (
        <Box marginTop={1}>
          <Text color="cyan">✨ Diagnostics complete! Check results above.</Text>
        </Box>
      )}
    </Box>
  );
};

export default SystemDiagnostics;
