# MARIA Platform v1.4.0 - User Manual

## 🎯 Welcome to MARIA

**MARIA Platform v1.4.0 "Active Intelligence"** introduces the revolutionary **Active Reporting System (ホウレンソウ)**, making MARIA the world's first AI platform with systematic task management and proactive collaboration. Building on the complete local AI integration from v1.3.0, v1.4.0 now provides intelligent task planning, real-time progress tracking, and seamless AI-human coordination.

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [Installation Guide](#installation-guide)
3. [🏠 Local AI Setup](#local-ai-setup)
4. [🔄 Active Reporting System (NEW v1.4.0)](#active-reporting-system)
5. [Basic Usage](#basic-usage)
6. [🧠 Internal Mode System](#internal-mode-system)
7. [Natural Language Interface](#natural-language-interface)
8. [Code Quality Analysis](#code-quality-analysis)
9. [AI Development Commands](#ai-development-commands)
10. [Project Management](#project-management)
11. [Advanced Features](#advanced-features)
12. [Customization & Settings](#customization--settings)
13. [Troubleshooting](#troubleshooting)
14. [Tips & Best Practices](#tips--best-practices)

## 🚀 Getting Started

### What is MARIA?

MARIA (Multi-Agent Research & Intelligence Assistant) is an enterprise-grade AI development platform that combines:

- **🔄 Active Reporting System (NEW v1.4.0)**: Revolutionary Horenso (報告・連絡・相談) methodology for AI-human collaboration
- **🏠 Complete Local AI Integration**: Full support for 3 local AI providers
- **🧠 Internal Mode System**: Revolutionary 50 cognitive modes that adapt to your context in real-time
- **Natural Language Understanding**: Talk to AI in 5 languages (English, Japanese, Chinese, Korean, Vietnamese)
- **Code Quality Analysis**: Professional-grade bug detection, linting, type checking, and security review
- **Multi-Model AI Integration**: Access to 47+ AI models (Cloud + Local providers)
- **Intelligent Development**: Automated coding, testing, and documentation generation

### Key Benefits

✅ **🔄 Systematic Collaboration**: Horenso-driven AI-human coordination  
✅ **📊 Intelligent Planning**: Automatic SOW generation and task management  
✅ **⚡ Proactive Reporting**: Real-time progress tracking and alerts  
✅ **🏠 Complete Privacy**: Full offline development with local AI models  
✅ **🧠 Cognitive Adaptation**: AI automatically adjusts thinking style to your needs  
✅ **💰 Zero API Costs**: Use local models without cloud API fees  
✅ **🔒 Enterprise Security**: Complete data privacy and compliance  
✅ **🌐 Multi-Provider Support**: LM Studio + Ollama + vLLM integration

## 💻 Installation Guide

### System Requirements

- **Operating System**: Windows 10+, macOS 10.15+, or Linux
- **Node.js**: Version 18.0.0 or higher
- **Memory**: 4GB RAM minimum (8GB recommended for local AI)
- **Storage**: 2GB available space (10GB for local models)
- **Internet**: Optional for cloud AI models

### Quick Installation

#### Option 1: Global Installation (Recommended)

```bash
# Install MARIA globally
npm install -g @bonginkan/maria

# Verify installation
maria --version
# Should display: 1.4.0
```

#### Option 2: Using npx (No Installation Required)

```bash
# Run MARIA without installing
npx @bonginkan/maria

# Check version
npx @bonginkan/maria --version
```

#### Option 3: Local Project Installation

```bash
# Install in your project
npm install @bonginkan/maria

# Use in your project
npx maria --version
```

### First-Time Setup

```bash
# Start MARIA for the first time
maria

# Run setup wizard (optional)
maria setup

# Configure AI providers (optional)
export OPENAI_API_KEY="your-openai-key"
export ANTHROPIC_API_KEY="your-anthropic-key"
```

## 🏠 Local AI Setup

### Supported Local AI Providers

#### 🦙 Ollama Integration

```bash
# Automated Ollama setup
maria setup-ollama

# Manual setup
brew install ollama
ollama run llama3.2:3b
```

#### 🚀 vLLM Integration

```bash
# Automated vLLM setup
maria setup-vllm

# Manual setup
pip install vllm
python -m vllm.entrypoints.openai.api_server --model microsoft/DialoGPT-medium
```

#### 🖥️ LM Studio Integration

```bash
# LM Studio integration guide
maria setup-lmstudio

# Download from: https://lmstudio.ai
# Load model and start server
```

### Local AI Service Management

```bash
# Start all local AI services
./scripts/auto-start-llm.sh start

# Check service status
maria health

# Stop all services
./scripts/auto-start-llm.sh stop
```

## 🔄 Active Reporting System (NEW v1.4.0)

### What is Active Reporting?

The **Active Reporting System** implements the Japanese business methodology **Horenso (ホウレンソウ)** - Report, Contact, Consult - enabling seamless AI-human collaboration through systematic task management and proactive communication.

### Key Components

#### 1. 🔄 Horenso Methodology

- **報告 (Hou - Report)**: Proactive progress reporting
- **連絡 (Ren - Contact)**: Real-time information sharing  
- **相談 (Sou - Consult)**: Collaborative decision making

#### 2. 📊 Intelligent SOW Generation

```bash
# Generate Statement of Work from natural language
maria report sow generate "Create a React dashboard with user authentication"
```

#### 3. 📋 Advanced Task Management

```bash
# Task lifecycle management
maria report task add "Implement login form"
maria report task status
maria report task update task-123 --progress 75
```

#### 4. 📈 Real-time Progress Tracking

```bash
# Comprehensive progress reports
maria report progress
maria report dashboard
```

### Active Reporting Commands

#### Core Commands

```bash
# Task Management
maria report task <action> [options]
  add <description>           # Create new task
  list                       # Show all tasks
  status                     # Show task status
  update <id> [options]      # Update task
  complete <id>              # Mark task complete
  block <id> <reason>        # Report blocker

# SOW Management  
maria report sow <action> [options]
  generate <description>     # Generate SOW from description
  show                       # Display current SOW
  approve                    # Approve proposed SOW
  modify <changes>           # Request SOW modifications

# Progress Reports
maria report progress         # Generate progress report
maria report dashboard       # Show visual dashboard
maria report horenso         # Full Horenso report

# System Management
maria report config          # Show reporting configuration
maria report reset           # Reset reporting state
maria report export          # Export reports and data
```

#### Advanced Usage Examples

```bash
# Complete workflow example
maria report sow generate "Build e-commerce API with user auth, product catalog, and payment processing"
# → Generates comprehensive SOW with tasks, timeline, and deliverables

maria report task status
# → Shows task breakdown with dependencies and progress

maria report progress
# → Real-time progress dashboard with visualizations

# Multi-language support
maria report task add "ユーザー認証システムを実装する"  # Japanese
maria report task add "创建用户身份验证系统"           # Chinese
maria report task add "사용자 인증 시스템 생성"          # Korean
```

### Proactive Features

#### Automatic Reporting Triggers

- **Milestone Completion**: Auto-reports when major tasks complete
- **Blocker Detection**: Alerts when tasks become blocked
- **Progress Thresholds**: Reports at 25%, 50%, 75%, 100% completion
- **Decision Points**: Requests user input when needed
- **Quality Gates**: Reports code quality metrics

#### Intelligent Notifications

```bash
# Example proactive reports
✓ Task "Implement login form" completed (2.5h, under estimate)
! Blocker detected: "API endpoint returns 404" - requires consultation
→ Decision needed: "Use JWT or session-based auth?" (3 options provided)
📊 Project 67% complete, on track for Friday deadline
```

### Collaborative Planning

#### SOW Approval Workflow

```bash
# AI proposes plan
maria report sow generate "Add dark mode to mobile app"
# → Shows proposed SOW with tasks and timeline

# User reviews and approves/modifies
maria report sow approve
# OR
maria report sow modify "Add accessibility testing to requirements"

# Collaborative iteration
maria report sow show  # View approved plan
maria report task status  # Track execution
```

#### User-AI Collaboration Features

- **Intent Analysis**: AI understands complex requirements
- **Smart Decomposition**: Breaks complex tasks into manageable steps
- **Dependency Management**: Automatic task dependency detection
- **Risk Assessment**: Identifies potential project risks
- **Resource Estimation**: Provides time and effort estimates

## 🧠 Basic Usage

### Starting MARIA

```bash
# Start interactive mode
maria

# Direct command execution
maria /code "Create a React component"
maria /bug "Fix memory leak in userService"
maria /model gpt-4  # Switch AI model
```

### Core Interactive Commands

```bash
# Essential commands
/help                        # Show all commands
/model [model-name]          # Switch AI model
/clear                       # Clear conversation
/exit                        # Exit MARIA

# Active Reporting (NEW v1.4.0)
/report task add             # Add new task
/report progress             # Show progress
/report sow generate         # Generate SOW

# Development commands  
/code [description]          # Generate code
/bug [description]           # Analyze and fix bugs
/test [type]                 # Generate tests
/lint                        # Run code quality checks
```

### Natural Language Interface

```bash
# English
"Create a login form with validation"
"Fix the memory leak in the auth service"
"Add task: implement user dashboard"

# Japanese
"ユーザー認証システムを作成して"
"メモリリークを修正して"
"タスクを追加：ダッシュボード実装"

# Chinese
"创建用户登录表单"
"修复内存泄漏问题"
"添加任务：实现用户仪表板"
```

## 🧠 Internal Mode System

### Understanding Cognitive Modes

MARIA automatically adapts its thinking process to your context:

```bash
# Debugging context
"Fix this TypeError" → ✽ 🐛 Debugging… [Analyzing error patterns]

# Creative context  
"Design a new feature" → ✽ 💡 Brainstorming… [Generating innovative ideas]

# Planning context
"Plan the authentication system" → ✽ 📋 TODO Planning… [Breaking down requirements]

# Learning context
"Explain GraphQL" → ✽ 📚 Learning… [Providing comprehensive education]
```

### Mode Categories

1. **🧠 Reasoning** (5 modes): Thinking, Ultra Thinking, Optimizing, Researching, TODO Planning
2. **💡 Creative** (5+ modes): Brainstorming, Drafting, Inventing, Remixing, Dreaming
3. **📊 Analytical** (5+ modes): Summarizing, Distilling, Highlighting, Categorizing, Mapping
4. **📐 Structural** (5+ modes): Visualizing, Outlining, Wireframing, Diagramming, Storyboarding
5. **🔍 Validation** (5+ modes): Debugging, Validating, Reviewing, Refactoring, Finalizing
6. **🤔 Contemplative** (5+ modes): Stewing, Mulling, Marinating, Gestating, Brewing
7. **💪 Intensive** (5+ modes): Schlepping, Grinding, Tinkering, Puzzling, Wrangling
8. **📚 Learning** (5+ modes): Learning, Exploring, Connecting, Simulating, Strategizing
9. **🤝 Collaborative** (5+ modes): Echoing, Mirroring, Debating, Coaching, Pairing

### Active Reporting Mode Integration

The Internal Mode System now seamlessly integrates with Active Reporting:

```bash
# Task creation triggers planning mode
maria report task add "Build API gateway" → ✽ 📋 TODO Planning…

# Progress updates trigger analytical mode
maria report progress → ✽ 📊 Summarizing…

# SOW generation triggers strategic mode
maria report sow generate → ✽ 🎯 Strategizing…
```

## 🔧 Natural Language Interface

### Multi-Language Support

MARIA understands natural language in 5 languages with context-aware routing:

#### English Examples
```bash
"Create a React component for user profiles"
"Fix the database connection issue"
"Generate tests for the authentication module"
"Add task: implement search functionality"
"Show me the project progress"
```

#### Japanese Examples
```bash
"ユーザープロフィール用のReactコンポーネントを作成して"
"データベース接続の問題を修正して"
"認証モジュールのテストを生成して"
"タスクを追加：検索機能の実装"
"プロジェクトの進捗を表示して"
```

#### Chinese Examples
```bash
"创建用户配置文件的React组件"
"修复数据库连接问题"
"为身份验证模块生成测试"
"添加任务：实现搜索功能"
"显示项目进度"
```

### Intelligent Command Routing

```bash
# Natural language → Command mapping
"Add a new task" → /report task add
"Show progress" → /report progress
"Fix this bug" → /bug
"Write tests" → /test
"Switch to GPT-4" → /model gpt-4
"Clear the chat" → /clear
```

## 🔍 Code Quality Analysis

### Enterprise-Grade Quality Tools

```bash
# Bug Detection & Analysis
maria /bug [description]
maria /bug analyze src/components/
maria /bug fix --auto

# Code Linting  
maria /lint
maria /lint --fix
maria /lint --config custom-rules.json

# Type Checking
maria /typecheck
maria /typecheck --strict
maria /typecheck src/

# Security Review
maria /security-review
maria /security-review --owasp
maria /security-review src/auth/
```

### Quality Integration with Active Reporting

```bash
# Quality gates in task management
maria report task add "Implement user service" --require-lint --require-tests
maria report progress  # Shows quality metrics
maria report dashboard  # Includes code quality status
```

## 🤖 AI Development Commands

### Code Generation

```bash
# Generate components
maria /code component UserProfile --props name,email,avatar
maria /code api userService --crud --auth
maria /code test UserProfile --unit --integration

# Generate with Active Reporting integration
maria /code "User authentication system"
# → Automatically creates tasks and tracks progress
```

### Testing & Documentation

```bash
# Test Generation
maria /test unit src/components/UserProfile.tsx
maria /test integration src/api/userService.ts
maria /test e2e "user login flow"

# Documentation
maria /docs generate src/
maria /docs api src/api/
maria /docs component UserProfile
```

## 📊 Project Management

### Active Reporting Project Management

#### Project Initialization

```bash
# Initialize project with Active Reporting
maria init --with-reporting
maria report config --frequency hourly --auto-sow true

# Or add to existing project
maria report init
```

#### Complete Project Workflow

```bash
# 1. Start with high-level goal
maria report sow generate "Build a social media dashboard with real-time updates"

# 2. Review and approve generated plan
maria report sow show
maria report sow approve

# 3. Track execution automatically
maria report dashboard  # Real-time progress view
maria report task status  # Detailed task breakdown

# 4. Handle blockers collaboratively
maria report task block task-123 "API rate limit exceeded"
# → Triggers consultation mode for resolution

# 5. Generate completion reports
maria report progress --final
maria report export --format pdf
```

#### Advanced Project Features

```bash
# Dependency management
maria report task add "Setup database" --priority high
maria report task add "Create user model" --depends-on setup-database

# Risk management
maria report risks
maria report risks add "Third-party API dependency" --probability medium --impact high

# Resource estimation
maria report estimate "Add payment processing"
# → Provides time, complexity, and resource estimates

# Team collaboration
maria report share --team-member john@company.com
maria report assign task-123 john@company.com
```

## 🚀 Advanced Features

### Multi-Agent Orchestration

```bash
# Paper-to-code transformation
maria /paper arxiv:2301.12345 --implement
maria /paper "path/to/research.pdf" --code --tests

# Document processing
maria /document analyze "requirements.docx"
maria /document extract "user-stories.pdf" --format tasks
```

### CodeRAG + Document AI

```bash
# Semantic code search
maria /coderag "authentication patterns"
maria /coderag "error handling" --scope src/

# Document integration
maria /document process "api-spec.yaml" --generate-client
maria /document analyze meeting-notes.md --extract-action-items
```

### Advanced Active Reporting

#### Custom Reporting Rules

```bash
# Configure proactive triggers
maria report config --trigger milestone --frequency auto
maria report config --trigger blocker --alert immediate
maria report config --trigger decision --timeout 2h

# Custom report templates
maria report template create weekly-status
maria report template apply weekly-status --schedule fridays
```

#### Analytics & Insights

```bash
# Performance analytics
maria report analytics --period 30days
maria report velocity --team
maria report burndown --project current

# Predictive insights
maria report forecast --based-on velocity
maria report risks predict --horizon 2weeks
maria report bottlenecks identify
```

## ⚙️ Customization & Settings

### Configuration Management

```bash
# Global configuration
maria config show
maria config set model.default "gpt-4"
maria config set reporting.frequency "hourly"
maria config set mode.auto-switch true

# Project-specific settings
maria config project --init
maria config project set reporting.auto-sow true
maria config project set quality.gates lint,test,security
```

### Active Reporting Customization

```bash
# Customize reporting behavior
maria report config --auto-generate-sow true
maria report config --proactive-frequency 30min
maria report config --visualization-style detailed

# Custom templates
maria report template edit horenso-report
maria report template create sprint-summary
maria report template import company-standard.json
```

### Hooks & Automation

```bash
# Git hooks integration
maria hooks install --git
maria hooks add pre-commit "maria /lint --fix"
maria hooks add pre-push "maria /test --coverage"

# Reporting hooks
maria hooks add task-complete "maria report progress --auto"
maria hooks add blocker-detected "maria report alert --team"
```

## 🔧 Troubleshooting

### Common Issues

#### Installation Problems

```bash
# Clear npm cache
npm cache clean --force

# Reinstall globally
npm uninstall -g @bonginkan/maria
npm install -g @bonginkan/maria

# Check Node.js version
node --version  # Should be 18.0.0+
```

#### Local AI Issues

```bash
# Check service status
maria health --verbose

# Restart services
./scripts/auto-start-llm.sh restart

# Test connectivity
curl http://localhost:11434/api/tags  # Ollama
curl http://localhost:1234/v1/models  # LM Studio
```

#### Active Reporting Issues

```bash
# Reset reporting state
maria report reset --confirm

# Clear corrupted data
maria report clear --all-data

# Reinitialize system
maria report init --force
```

### Debug Mode

```bash
# Enable verbose logging
DEBUG=maria:* maria
DEBUG=maria:reporting maria report progress
DEBUG=maria:ai maria /code "test"

# Export diagnostic information
maria doctor --export diagnostics.json
maria logs export --last-24h
```

### Performance Optimization

```bash
# Optimize for local AI
maria config set ai.prefer-local true
maria config set ai.timeout 30s

# Optimize reporting
maria report config --cache-enable true
maria report config --batch-updates true
```

## 💡 Tips & Best Practices

### Effective Active Reporting Usage

#### Task Management Best Practices

1. **Descriptive Tasks**: Use clear, actionable descriptions
   ```bash
   # Good
   maria report task add "Implement JWT authentication with refresh tokens"
   
   # Avoid
   maria report task add "Do auth stuff"
   ```

2. **Proper Dependencies**: Set up task dependencies correctly
   ```bash
   maria report task add "Setup database schema" --priority high
   maria report task add "Create user model" --depends-on database-schema
   ```

3. **Regular Updates**: Keep progress current
   ```bash
   # Update progress frequently
   maria report task update task-123 --progress 50 --notes "API integration complete"
   ```

#### SOW Generation Tips

1. **Be Specific**: Provide detailed requirements
   ```bash
   # Good
   maria report sow generate "Build REST API with Node.js, JWT auth, PostgreSQL, rate limiting, and OpenAPI documentation"
   
   # Basic
   maria report sow generate "Build an API"
   ```

2. **Review Before Approval**: Always review generated SOWs
   ```bash
   maria report sow show  # Review thoroughly
   maria report sow modify "Add security requirements"  # Refine if needed
   maria report sow approve  # Approve when ready
   ```

### Multi-Language Development

```bash
# Consistent language use improves accuracy
# Japanese project
maria report task add "データベース設計を完了する"
maria report progress

# English project  
maria report task add "Complete database design"
maria report progress
```

### Local AI Optimization

1. **Model Selection**: Choose appropriate models for tasks
   ```bash
   # Lightweight tasks → smaller models
   maria /model llama3.2:3b
   
   # Complex tasks → larger models
   maria /model qwen3-30b-a3b
   ```

2. **Resource Management**: Monitor system resources
   ```bash
   maria health --system
   # Adjust model selection based on available memory
   ```

### Productivity Workflows

#### Daily Development Routine

```bash
# Morning startup
maria  # Start interactive session
maria report dashboard  # Check overnight progress
maria report task status  # Review today's tasks

# During development
maria /code "feature implementation"  # Generate code
maria report task update --progress auto  # Auto-update progress
maria /bug "fix issue"  # Debug problems

# End of day
maria report progress --summary  # Generate daily report
maria report horenso  # Full status update
```

#### Project Milestones

```bash
# Sprint planning
maria report sow generate "Sprint 3: User dashboard and analytics"
maria report milestone add "Dashboard MVP" --date "2025-09-01"

# Sprint execution
maria report dashboard  # Track sprint progress
maria report risks review  # Monitor risks

# Sprint retrospective
maria report analytics --sprint 3
maria report export --format "sprint-summary"
```

### Team Collaboration

```bash
# Share progress with team
maria report export --format json --share team@company.com

# Collaborative planning
maria report sow generate "Team project"
maria report sow share --reviewers lead-dev,product-manager

# Status communication
maria report horenso --audience management
maria report blocker add "Waiting for API documentation" --escalate
```

---

## 📞 Support & Resources

### Getting Help

- **Documentation**: [docs.bonginkan.ai/maria](https://docs.bonginkan.ai/maria)
- **Issues**: [github.com/bonginkan/maria_code/issues](https://github.com/bonginkan/maria_code/issues)
- **Enterprise Support**: enterprise@bonginkan.ai
- **Community**: [Discord](https://discord.gg/maria-platform)

### Additional Resources

- **Video Tutorials**: [YouTube Playlist](https://youtube.com/playlist?list=maria-tutorials)
- **Best Practices Guide**: [Active Reporting Patterns](https://docs.bonginkan.ai/active-reporting)
- **API Documentation**: [REST API Reference](https://api.bonginkan.ai/docs)
- **Integrations**: [Third-party Tools](https://docs.bonginkan.ai/integrations)

---

**MARIA Platform v1.4.0 "Active Intelligence"**  
© 2025 Bonginkan AI. All rights reserved.  
Licensed under dual license: Free for personal use, Enterprise license required for commercial use.

---

🎉 **Welcome to the future of AI-powered development with systematic collaboration!**  
Experience the power of Active Reporting and transform how you work with AI.