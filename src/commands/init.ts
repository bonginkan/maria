import { Command } from 'commander';
import prompts from 'prompts';
import { saveConfig } from '../utils/config.js';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { ProjectConfig } from '../types/common.js';

function createMariaMdTemplate(config: ProjectConfig): string {
  const currentDate = new Date().toISOString().split('T')[0];

  return `# MARIA.md

This file provides guidance to MARIA CODE (CLI) when working with code in this repository.

## Repository Status

**Project**: ${config.name || 'MARIA Development Project'}
**Type**: ${config.type || 'TypeScript/Node.js'}
**Created**: ${currentDate}
**Last Updated**: ${currentDate}

## Project Overview

### Description
${config.description || 'AI-powered development project using MARIA CODE CLI for intelligent code generation, analysis, and project management.'}

### Technology Stack
- **Runtime**: Node.js 20+ LTS
- **Language**: TypeScript
- **Package Manager**: ${config.packageManager || 'pnpm'}
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

#### Specialized Commands
\`\`\`bash
# Paper development
mc paper

# Presentation creation
mc slides  

# DevOps operations
mc dev
\`\`\`

### Project Structure

\`\`\`
${config.name || 'project'}/
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
MARIA_PROJECT_ID=${config.id || 'your-project-id'}

# Optional configuration
MARIA_AI_MODEL=${config.ai?.preferredModel || 'gemini-2.5-pro'}
MARIA_LOG_LEVEL=${config.logging?.level || 'info'}
\`\`\`

## Troubleshooting

### Common Issues
1. **AI Model Access**: Ensure MARIA account has proper plan access
2. **Configuration**: Verify .maria-code.toml is properly configured
3. **Network**: Check internet connection for AI API calls
4. **Permissions**: Ensure file system write permissions

### Debug Commands
\`\`\`bash
# Check configuration
mc config show

# Test AI connection
mc chat "Hello, test connection"

# Verify project status
mc status
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
}

async function initHandler() {
  // Check if config already exists
  const configPath = join(process.cwd(), '.maria-code.toml');
  if (existsSync(configPath)) {
    const { overwrite } = await prompts({
      type: 'confirm',
      name: 'overwrite',
      message: 'Configuration file already exists. Overwrite?',
      initial: false,
    });

    if (!overwrite) {
      return;
    }
  }

  // Collect user information
  const responses = await prompts([
    {
      type: 'text',
      name: 'email',
      message: 'Your email address',
      initial: process.env['USER'] ? `${process.env['USER']}@example.com` : '',
      validate: (value) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value) || 'Please enter a valid email address';
      },
    },
    {
      type: 'text',
      name: 'projectName',
      message: 'Project name',
      initial: process.cwd().split('/').pop() || 'MARIA Development Project',
      hint: 'Name of your development project',
    },
    {
      type: 'select',
      name: 'projectType',
      message: 'Project type',
      choices: [
        { title: 'TypeScript/Node.js', value: 'typescript-nodejs' },
        { title: 'React/Next.js', value: 'react-nextjs' },
        { title: 'Python/FastAPI', value: 'python-fastapi' },
        { title: 'Go/Gin', value: 'go-gin' },
        { title: 'Rust/Actix', value: 'rust-actix' },
        { title: 'Other', value: 'other' },
      ],
      initial: 0,
    },
    {
      type: 'text',
      name: 'projectDescription',
      message: 'Project description',
      initial: 'AI-powered development project using MARIA CODE CLI',
      hint: 'Brief description of what this project does',
    },
    {
      type: 'select',
      name: 'packageManager',
      message: 'Package manager',
      choices: [
        { title: 'pnpm', value: 'pnpm' },
        { title: 'npm', value: 'npm' },
        { title: 'yarn', value: 'yarn' },
        { title: 'bun', value: 'bun' },
      ],
      initial: 0,
    },
    {
      type: 'text',
      name: 'neo4jInstanceId',
      message: 'Neo4j instance ID',
      initial: '4234c1a0',
      hint: 'Found in Neo4j Console URL',
    },
    {
      type: 'select',
      name: 'aiModel',
      message: 'Preferred AI model',
      choices: [
        { title: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro-preview' },
        { title: 'Grok-4', value: 'grok-4-latest' },
      ],
      initial: 0,
    },
    {
      type: 'confirm',
      name: 'createMariaMd',
      message: 'Create MARIA.md development guidance file?',
      initial: true,
      hint: 'Recommended for AI-assisted development',
    },
  ]);

  // Create configuration
  const config: ProjectConfig = {
    name: responses.projectName,
    type: responses.projectType,
    description: responses.projectDescription,
    packageManager: responses.packageManager,
    id: responses.projectName.toLowerCase().replace(/\s+/g, '-'),
    user: {
      email: responses.email,
    },
    neo4j: {
      instanceId: responses.neo4jInstanceId,
      database: 'neo4j',
    },
    ai: {
      preferredModel: responses.aiModel,
    },
    logging: {
      level: 'info',
    },
  };

  // Save configuration
  try {
    saveConfig(config);
    console.log('✅ Configuration saved to .maria-code.toml');
  } catch (error: unknown) {
    console.error('❌ Failed to save configuration:', error);
    process.exit(1);
  }

  // Create MARIA.md file if requested
  if (responses.createMariaMd) {
    const mariaMdPath = join(process.cwd(), 'MARIA.md');

    // Check if MARIA.md already exists
    if (existsSync(mariaMdPath)) {
      const { overwriteMariaMd } = await prompts({
        type: 'confirm',
        name: 'overwriteMariaMd',
        message: 'MARIA.md already exists. Overwrite?',
        initial: false,
      });

      if (!overwriteMariaMd) {
        console.log('✅ Initialization complete! MARIA.md was not modified.');
        return;
      }
    }

    try {
      const mariaMdContent = createMariaMdTemplate(config);
      writeFileSync(mariaMdPath, mariaMdContent, 'utf8');
      console.log('✅ MARIA.md development guidance file created');
    } catch (error: unknown) {
      console.error('❌ Failed to create MARIA.md:', error);
      process.exit(1);
    }
  }

  console.log('\n🎉 MARIA CODE initialization complete!');
  console.log('\n📖 Next steps:');
  console.log('  1. Review your .maria-code.toml configuration');
  if (responses.createMariaMd) {
    console.log('  2. Check your MARIA.md development guidance');
    console.log('  3. Start using: mc chat "Help me understand this project"');
  } else {
    console.log('  2. Start using: mc chat "Help me understand this project"');
  }
}

export default function registerInitCommand(program: Command) {
  program
    .command('init')
    .description('Initialize .maria-code.toml configuration and MARIA.md guidance file')
    .action(initHandler);
}
