/**
 * Project Manager Component
 * プロジェクト管理コマンド実装
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { MariaConfig } from '../utils/config.js';
import { existsSync, writeFileSync, statSync } from 'fs';
import { join, basename } from 'path';
// import * as clipy from 'clipboardy';

export interface ProjectManagerProps {
  action: 'init' | 'add-dir' | 'memory' | 'export';
  config: MariaConfig;
  onUpdate: (config: MariaConfig) => void;
  onExit: () => void;
  args?: string[];
}

type InitStep = 'welcome' | 'confirm' | 'complete';
type ExportFormat = 'json' | 'markdown' | 'yaml' | 'clipboard';

const ProjectManager: React.FC<ProjectManagerProps> = ({
  action,
  config,
  onUpdate,
  onExit,
  args,
}) => {
  const [step, setStep] = useState<InitStep>('welcome');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useInput((_input, key) => {
    if (key.escape) {
      onExit();
    }
  });

  const createMariaMdTemplate = useCallback(() => {
    const currentDate = new Date().toISOString().split('T')[0];
    const projectName = config.project?.name || basename(process.cwd());
    const projectType = config.project?.type || 'typescript-nodejs';

    return `# MARIA.md

This file provides guidance to MARIA CODE (CLI) when working with code in this repository.

## Repository Status

**Project**: ${projectName}
**Type**: ${projectType}
**Created**: ${currentDate}
**Last Updated**: ${currentDate}

## Project Overview

### Description
${config.project?.description || 'AI-powered development project using MARIA CODE CLI for intelligent code generation, analysis, and project management.'}

### Technology Stack
- **Runtime**: Node.js 20+ LTS
- **Language**: TypeScript
- **Package Manager**: ${config.project?.packageManager || 'pnpm'}
- **AI Integration**: MARIA Platform (Gemini 2.5 Pro, Grok-4)
- **Development**: MARIA CODE CLI

## Development Workflow

### MARIA CODE CLI Commands

#### Basic Commands
\`\`\`bash
# Initialize project
mc init

# Analyze codebase  
mc read src

# Interactive development
mc chat

# Generate code
mc "Add REST endpoint for /api/health" --apply

# Run tests
mc test

# AI-generated commit
mc commit -m "feat: new feature"

# Deploy
mc deploy --env stg
\`\`\`

#### Slash Commands (Interactive Mode)
\`\`\`bash
# Project Management
/init            # Initialize MARIA.md
/add-dir         # Add working directory
/memory          # Edit Claude memory file
/export          # Export conversation

# Agent Management
/agents          # Manage AI agents
/mcp             # MCP server management
/ide             # IDE integration
/install-github-app # GitHub Actions setup
\`\`\`

### Project Structure

\`\`\`
${projectName}/
├─ src/                 # Source code
├─ tests/               # Test files
├─ docs/                # Documentation
├─ .maria-code.toml     # MARIA CODE configuration
├─ MARIA.md            # Development guidance (this file)
└─ README.md           # Project documentation
\`\`\`

## AI Model Configuration

### Default Model
- **Primary**: ${config.ai?.preferredModel || 'gemini-2.5-pro'}
- **Context**: Extended context for complex analysis
- **Temperature**: 0.7 (balanced creativity/precision)

### Model Selection Guidelines
- **Gemini 2.5 Pro**: Complex reasoning, code analysis, architecture decisions
- **Grok-4**: Creative solutions, alternative approaches, rapid prototyping

## Development Guidelines

### Code Style
- Follow TypeScript best practices
- Use meaningful variable/function names
- Implement proper error handling
- Write comprehensive tests
- Document complex logic

### AI Interaction Patterns
- Provide clear, specific prompts
- Include relevant context from codebase
- Use incremental development approach
- Review and validate AI-generated code
- Maintain human oversight for critical decisions

### Quality Standards
- TypeScript: Zero type errors
- ESLint: Zero violations in production code
- Tests: Minimum 80% coverage
- Documentation: All public APIs documented

## Common Tasks

### Development Scripts
\`\`\`bash
# Start development server
npm run dev

# Run tests
npm test

# Build project
npm run build

# Type checking
npm run typecheck

# Linting
npm run lint
\`\`\`

### MARIA CODE Workflows
\`\`\`bash
# Full development cycle
mc read src                    # Analyze codebase
mc "implement user auth"       # Generate code
mc test                       # Generate/run tests
mc commit -m                  # AI commit message
mc deploy --env stg          # Deploy to staging
\`\`\`

## Integration Configuration

### Knowledge Graph (optional)
- **Instance ID**: ${config.neo4j?.instanceId || 'Not configured'}'}
- **Database**: ${config.neo4j?.database || 'Not configured'}'}
- **Usage**: Code relationship analysis, dependency mapping

### Environment Variables
\`\`\`bash
# Required for AI integration
MARIA_USER_EMAIL=${config.user?.email || 'your-email@example.com'}
MARIA_PROJECT_ID=${config.project?.id || 'your-project-id'}

# Optional configuration
MARIA_AI_MODEL=${config.ai?.preferredModel || 'gemini-2.5-pro'}
MARIA_LOG_LEVEL=${config.logging?.level || 'info'}
\`\`\`

## Working Directories

${config.project?.workingDirectories?.map((dir) => `- ${dir}`).join('\n') || '- src/ (default)'}

## Memory Files

${config.project?.memoryFiles?.map((file) => `- ${file}`).join('\n') || '- .maria-memory.md (default)'}

## Troubleshooting

### Common Issues
1. **AI Model Access**: Ensure MARIA account has proper plan access
2. **Configuration**: Verify .maria-code.toml is properly configured
3. **Network**: Check internet connection for AI API calls
4. **Permissions**: Ensure file system write permissions

### Debug Commands
\`\`\`bash
# Check configuration  
/config

# Test AI connection
mc chat "Hello, test connection"

# System diagnostics
/doctor
\`\`\`

## Important Notes

### Best Practices
- Always review AI-generated code before committing
- Use version control for all changes
- Test thoroughly before deployment
- Keep MARIA.md updated with project evolution
- Document custom workflows and patterns

### Security
- Never commit API keys or sensitive data
- Use environment variables for secrets
- Follow principle of least privilege
- Regular security audits with AI assistance

---

*This file is continuously updated by MARIA CODE CLI to reflect project evolution and development patterns.*

Generated by MARIA CODE CLI v${process.env['npm_package_version'] || '1.0.0'} on ${currentDate}
`;
  }, [config]);

  const handleInit = useCallback(async () => {
    try {
      const mariaMdPath = join(process.cwd(), 'MARIA.md');
      const mariaMdContent = createMariaMdTemplate();

      if (existsSync(mariaMdPath)) {
        setStep('confirm');
      } else {
        writeFileSync(mariaMdPath, mariaMdContent, 'utf8');
        setSuccess('✅ MARIA.md file created successfully');
        setStep('complete');
      }
    } catch (err: unknown) {
      setError(`Failed to create MARIA.md: ${String(err)}`);
    }
  }, [createMariaMdTemplate]);

  const confirmOverwrite = useCallback(
    async (confirmed: boolean) => {
      if (confirmed) {
        try {
          const mariaMdPath = join(process.cwd(), 'MARIA.md');
          const mariaMdContent = createMariaMdTemplate();
          writeFileSync(mariaMdPath, mariaMdContent, 'utf8');
          setSuccess('✅ MARIA.md file updated successfully');
          setStep('complete');
        } catch (err: unknown) {
          setError(`Failed to update MARIA.md: ${String(err)}`);
        }
      } else {
        setSuccess('MARIA.md initialization cancelled');
        setStep('complete');
      }
    },
    [createMariaMdTemplate],
  );

  const handleAddDir = useCallback(() => {
    const targetDir = args?.[0] || '.';
    const resolvedPath = join(process.cwd(), targetDir);

    if (!existsSync(resolvedPath) || !statSync(resolvedPath).isDirectory()) {
      setError(`Directory not found: ${targetDir}`);
      return;
    }

    const updatedConfig = {
      ...config,
      project: {
        ...config.project,
        workingDirectories: [...(config.project?.workingDirectories || []), resolvedPath],
      },
    };

    onUpdate(updatedConfig);
    setSuccess(`✅ Added working directory: ${targetDir}`);
  }, [args, config, onUpdate]);

  const handleMemoryEdit = useCallback(() => {
    const memoryPath = join(process.cwd(), '.maria-memory.md');

    if (!existsSync(memoryPath)) {
      const defaultMemory = `# MARIA Memory

This file stores context and learnings for AI-assisted development.

## Project Context

### Key Files
- List important files and their purposes

### Patterns
- Common code patterns used in this project
- Naming conventions
- Architecture decisions

### Dependencies
- Important libraries and their usage
- Configuration files
- Build tools

## Recent Learnings

### Development Notes
- Solutions to complex problems
- Code optimization insights
- Bug fixes and their causes

### AI Interaction History
- Successful prompts and approaches
- Areas where AI assistance was most effective
- Patterns that work well for this codebase

---

*This file is automatically updated during AI interactions to improve context awareness.*
`;
      writeFileSync(memoryPath, defaultMemory, 'utf8');
      setSuccess('✅ Created .maria-memory.md file');
    } else {
      setSuccess('✅ .maria-memory.md already exists - edit manually');
    }

    // Add to memory files in config
    const updatedConfig = {
      ...config,
      project: {
        ...config.project,
        memoryFiles: [...(config.project?.memoryFiles || []), memoryPath],
      },
    };
    onUpdate(updatedConfig);
  }, [config, onUpdate]);

  const exportConversation = useCallback(async () => {
    try {
      const format = (args?.[0] as ExportFormat) || 'markdown';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      // Mock conversation data - in real implementation, this would come from conversation history
      const conversationData = {
        timestamp: new Date().toISOString(),
        project: config.project?.name || 'Unknown Project',
        user: config.user?.email || 'Unknown User',
        model: config.ai?.preferredModel || 'gemini-2.5-pro',
        messages: [
          {
            role: 'user',
            content: 'Example conversation message',
            timestamp: new Date().toISOString(),
          },
          {
            role: 'assistant',
            content: 'Example AI response',
            timestamp: new Date().toISOString(),
          },
        ],
      };

      let exportContent: string;
      let filename: string;

      switch (format) {
        case 'json':
          exportContent = JSON.stringify(conversationData, null, 2);
          filename = `conversation-${timestamp}.json`;
          break;
        case 'yaml':
          // Simple YAML conversion - in production use proper YAML library
          exportContent = `timestamp: ${conversationData.timestamp}
project: ${conversationData.project}
user: ${conversationData.user}
model: ${conversationData.model}
messages:
${conversationData.messages.map((m) => `  - role: ${m.role}\n    content: "${m.content}"\n    timestamp: ${m.timestamp}`).join('\n')}`;
          filename = `conversation-${timestamp}.yaml`;
          break;
        case 'clipboard':
          exportContent = `# Conversation Export

**Project**: ${conversationData.project}
**User**: ${conversationData.user}
**Model**: ${conversationData.model}
**Exported**: ${conversationData.timestamp}

## Messages

${conversationData.messages
  .map(
    (m) => `### ${m.role.toUpperCase()}
${m.content}
*${m.timestamp}*`,
  )
  .join('\n\n')}`;
          // Clipboard functionality temporarily disabled due to import issues
          // await clipy.write(exportContent);
          setSuccess('✅ Clipboard feature temporarily disabled - content saved to file instead');
          filename = `conversation-clipboard-${timestamp}.md`;
          break;
        default: // markdown
          exportContent = `# Conversation Export

**Project**: ${conversationData.project}
**User**: ${conversationData.user}
**Model**: ${conversationData.model}
**Exported**: ${conversationData.timestamp}

## Messages

${conversationData.messages
  .map(
    (m) => `### ${m.role.toUpperCase()}
${m.content}
*${m.timestamp}*`,
  )
  .join('\n\n')}`;
          filename = `conversation-${timestamp}.md`;
      }

      writeFileSync(filename, exportContent, 'utf8');
      setSuccess(`✅ Conversation exported to ${filename}`);
    } catch (err: unknown) {
      setError(`Failed to export conversation: ${err}`);
    }
  }, [args, config]);

  useEffect(() => {
    switch (action) {
      case 'init':
        handleInit();
        break;
      case 'add-dir':
        handleAddDir();
        break;
      case 'memory':
        handleMemoryEdit();
        break;
      case 'export':
        exportConversation();
        break;
    }
  }, [action, handleInit, handleAddDir, handleMemoryEdit, exportConversation]);

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
        <Text color="gray">Press ESC to exit</Text>
      </Box>
    );
  }

  if (action === 'init' && step === 'confirm') {
    const confirmItems = [
      { label: 'Yes, overwrite MARIA.md', value: true },
      { label: 'No, keep existing file', value: false },
    ];

    return (
      <Box flexDirection="column">
        <Text color="yellow">⚠️ MARIA.md already exists</Text>
        <Text>Do you want to overwrite it?</Text>
        <Box marginTop={1}>
          <SelectInput items={confirmItems} onSelect={(item) => confirmOverwrite(item.value)} />
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text color="cyan">📁 Project Manager</Text>
      <Text>Processing {action}...</Text>
    </Box>
  );
};

export default ProjectManager;
