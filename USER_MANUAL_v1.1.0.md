# MARIA Platform v1.2.0 - User Manual

## 🎯 Welcome to MARIA

**MARIA Platform v1.2.0 "Cognitive Revolution"** is the world's most advanced AI-powered development platform, featuring the revolutionary **Internal Mode System** with 50 cognitive modes that adapt to your context in real-time. This user manual will guide you through every feature, from basic setup to advanced cognitive AI interactions.

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [Installation Guide](#installation-guide)
3. [Basic Usage](#basic-usage)
4. [🧠 Internal Mode System (NEW)](#internal-mode-system)
5. [Natural Language Interface](#natural-language-interface)
6. [Code Quality Analysis](#code-quality-analysis)
7. [AI Development Commands](#ai-development-commands)
8. [Project Management](#project-management)
9. [Advanced Features](#advanced-features)
10. [Customization & Settings](#customization--settings)
11. [Troubleshooting](#troubleshooting)
12. [Tips & Best Practices](#tips--best-practices)

## 🚀 Getting Started

### What is MARIA?

MARIA (Multi-Agent Research & Intelligence Assistant) is an enterprise-grade AI development platform that combines:

- **🧠 Internal Mode System**: Revolutionary 50 cognitive modes that adapt to your context in real-time
- **Natural Language Understanding**: Talk to AI in 5 languages (English, Japanese, Chinese, Korean, Vietnamese)
- **Code Quality Analysis**: Professional-grade bug detection, linting, type checking, and security review
- **Multi-Model AI Integration**: Access to 22+ AI models (OpenAI, Anthropic, Google, local models)
- **Intelligent Development**: Automated coding, testing, and documentation generation

### Key Benefits

✅ **🧠 Cognitive Adaptation**: AI automatically adjusts thinking style to your needs  
✅ **Boost Productivity**: Write code 3x faster with context-aware AI assistance  
✅ **Improve Quality**: Catch bugs and security issues before they reach production  
✅ **Reduce Errors**: Zero-error policy with automated quality enforcement  
✅ **Learn Continuously**: AI adapts to your coding patterns and preferences  
✅ **Work Naturally**: Use plain language instead of complex commands  

## 💻 Installation Guide

### System Requirements

- **Operating System**: Windows 10+, macOS 10.15+, or Linux
- **Node.js**: Version 18.0.0 or higher
- **Memory**: 2GB RAM minimum (4GB recommended)
- **Storage**: 500MB available space
- **Internet**: Optional for cloud AI models

### Quick Installation

#### Option 1: Global Installation (Recommended)
```bash
# Install MARIA globally
npm install -g @bonginkan/maria

# Verify installation
maria --version
# Should display: 1.1.0
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

## 🎮 Basic Usage

### Starting MARIA

```bash
# Start interactive mode (recommended)
maria

# You'll see the beautiful MARIA interface:
╭──────────────────────────────────────────────────────────╮
│                   MARIA CODE                              │
│        AI-Powered Development Platform                    │
╰──────────────────────────────────────────────────────────╯

🎉 Ready! Using LM Studio as primary provider
You: 
```

### Basic Commands

Once in interactive mode, you can use commands by typing `/` followed by the command name:

```bash
# See all available commands
/help

# Check system status
/status

# Analyze code quality
/lint check

# Generate code
/code

# Exit MARIA
/exit
```

### Your First Code Analysis

Let's start with a simple code quality check:

```bash
# In MARIA interactive mode
You: /lint check

# MARIA will analyze your codebase and show:
🔍 Lint Analysis & Code Quality Check

🔄 Running lint analysis on codebase...
Checking for ESLint errors, code style violations, and best practices...

📊 Lint Analysis Results:
• Syntax errors: 0
• Style violations: 3 (auto-fixable)
• Best practice issues: 1
• Code quality score: 94/100

💡 Run "/lint fix" to automatically fix resolvable issues
```

## 🗣️ Natural Language Interface

### Revolutionary Natural Language Understanding

MARIA understands natural language in 5 languages and automatically converts your requests into the appropriate commands:

#### English Examples
```bash
You: "check my code quality"
MARIA: → Automatically executes /lint check

You: "find bugs in my code"
MARIA: → Automatically executes /bug analyze

You: "generate a React component"
MARIA: → Automatically executes /code with React context
```

#### Japanese Examples
```bash
You: "コードを分析して"
MARIA: → /lint check を自動実行

You: "バグを見つけて"
MARIA: → /bug analyze を自動実行

You: "型安全性をチェックして"
MARIA: → /typecheck analyze を自動実行
```

#### Other Languages
```bash
# Chinese
You: "检查代码质量" → /lint check

# Korean  
You: "코드 품질 검사" → /lint check

# Vietnamese
You: "kiểm tra chất lượng mã" → /lint check
```

### Smart Context Understanding

MARIA remembers context and adapts to your workflow:

```bash
You: "analyze this code"
MARIA: What would you like me to analyze?
      • Code quality (/lint)
      • Bug detection (/bug)
      • Type safety (/typecheck)
      • Security (/security-review)

You: "security issues"
MARIA: → Automatically switches to /security-review scan
```

## 🧠 Internal Mode System

### Revolutionary Cognitive Adaptation

**NEW in v1.2.0**: MARIA introduces the world's first **Internal Mode System** - a breakthrough cognitive framework that automatically adapts the AI's thinking style to your specific context and needs.

#### What Are Internal Modes?

Internal modes are specialized cognitive states that change how MARIA processes and responds to your requests. Instead of using static AI responses, MARIA now dynamically switches between 50 different thinking modes for optimal results.

#### How It Works

```bash
# MARIA starts in default thinking mode
You: "I need to fix this bug"
MARIA: ✽ 🐛 Debugging…
        [Automatically switches to debugging mode for error analysis]

You: "Give me some creative ideas"  
MARIA: ✽ 💡 Brainstorming…
        [Switches to brainstorming mode for creative thinking]

You: "Optimize this algorithm"
MARIA: ✽ ⚡ Optimizing…
        [Switches to optimization mode for performance focus]
```

### The 50 Cognitive Modes

MARIA's cognitive modes are organized into 9 categories:

#### 🧠 Reasoning Modes (5)
- **✽ Thinking…** - Standard reasoning and problem-solving
- **✽ Ultra Thinking…** - Deep, multi-perspective analysis  
- **✽ Optimizing…** - Performance improvement and efficiency
- **✽ Researching…** - Information gathering and verification
- **✽ TODO…** - Task planning and action item creation

#### 💡 Creative Modes (5+)
- **✽ Brainstorming…** - Unrestricted idea generation
- **✽ Drafting…** - Initial concept and content creation
- **✽ Inventing…** - Novel solution development
- **✽ Remixing…** - Combining and adapting existing ideas
- **✽ Dreaming…** - Abstract and visionary thinking

#### 📊 Analytical Modes (5+)
- **✽ Summarizing…** - Condensing complex information
- **✽ Distilling…** - Extracting core insights
- **✽ Highlighting…** - Identifying key points
- **✽ Categorizing…** - Organizing and classifying
- **✽ Mapping…** - Creating conceptual relationships

#### 📐 Structural Modes (5+)
- **✽ Visualizing…** - Creating diagrams and charts
- **✽ Outlining…** - Hierarchical organization
- **✽ Wireframing…** - Interface and layout design
- **✽ Diagramming…** - Technical architecture planning
- **✽ Storyboarding…** - Process and flow design

#### 🔍 Validation Modes (5+)
- **✽ Debugging…** - Error detection and fixing
- **✽ Validating…** - Accuracy and consistency checking
- **✽ Reviewing…** - Quality assessment and feedback
- **✽ Refactoring…** - Code structure improvement
- **✽ Finalizing…** - Polish and completion

#### 🤔 Contemplative Modes (5+)
- **✽ Stewing…** - Patient consideration of complex issues
- **✽ Mulling…** - Thoughtful reflection and reconsideration  
- **✽ Marinating…** - Deep immersion in context
- **✽ Gestating…** - Gradual idea development
- **✽ Brewing…** - Slow evolution of concepts

#### 💪 Intensive Modes (5+)
- **✽ Schlepping…** - Methodical, repetitive work
- **✽ Grinding…** - Persistent, detailed processing
- **✽ Tinkering…** - Incremental adjustments and tuning
- **✽ Puzzling…** - Complex problem solving
- **✽ Wrangling…** - Data manipulation and organization

#### 📚 Learning Modes (5+)
- **✽ Learning…** - Knowledge acquisition and integration
- **✽ Exploring…** - Discovery and investigation
- **✽ Connecting…** - Relationship identification
- **✽ Simulating…** - Hypothetical scenario testing
- **✽ Strategizing…** - Long-term planning

#### 🤝 Collaborative Modes (5+)
- **✽ Echoing…** - Reflecting and confirming understanding
- **✽ Mirroring…** - Matching communication style
- **✽ Debating…** - Multi-perspective discussion
- **✽ Coaching…** - Guidance and skill development
- **✽ Pairing…** - Collaborative problem-solving

### Using the /mode Command

Control internal modes manually with the comprehensive `/mode` command:

#### View Current Mode Status
```bash
/mode
# Shows:
# 📋 Mode Status:
# Operation Mode: chat (default)
# Internal Mode: ✽ Thinking… - Standard reasoning and problem solving
# Category: reasoning
```

#### List All Available Modes
```bash
/mode internal list
# Displays all 50 cognitive modes organized by category
```

#### Switch to Specific Mode
```bash
/mode internal debugging    # Switch to debugging mode
/mode internal brainstorming # Switch to brainstorming mode
/mode internal optimizing   # Switch to optimization mode
```

#### View Mode History
```bash
/mode internal history
# Shows recent mode switches and usage patterns
```

#### View Usage Statistics  
```bash
/mode internal stats
# Displays mode usage analytics and effectiveness metrics
```

#### Control Auto-Switching
```bash
/mode internal auto     # Enable automatic mode switching (default)
/mode internal manual   # Disable auto-switching for manual control
```

### Automatic Mode Recognition

MARIA automatically recognizes context and switches modes based on:

#### Intent Recognition
- **"Fix this bug"** → ✽ 🐛 Debugging…
- **"Make this faster"** → ✽ ⚡ Optimizing…
- **"Give me ideas"** → ✽ 💡 Brainstorming…
- **"Explain this code"** → ✽ 📊 Analyzing…

#### Context Analysis
- **Error messages detected** → Debugging mode
- **Performance issues mentioned** → Optimization mode
- **Creative requests** → Brainstorming mode
- **Documentation needs** → Drafting mode

#### Learning Adaptation
- MARIA learns your patterns and preferences
- Mode selection improves over time
- Personalized to your workflow style
- Cross-session pattern memory

### Advanced Mode Features

#### Multi-Language Support
Internal modes work in all 5 supported languages:
- **English**: "Debug this error" → ✽ 🐛 Debugging…
- **Japanese**: "このバグを直して" → ✽ 🐛 Debugging…
- **Chinese**: "优化这个代码" → ✽ ⚡ Optimizing…
- **Korean**: "아이디어를 주세요" → ✽ 💡 Brainstorming…
- **Vietnamese**: "Kiểm tra lỗi này" → ✽ 🐛 Debugging…

#### Real-Time Performance
- **Mode switching**: <200ms response time
- **Recognition accuracy**: 95%+ intent detection
- **Memory efficient**: <10MB additional overhead
- **Background processing**: Non-blocking operations

#### Configuration & Customization
```bash
# Adjust recognition sensitivity
/mode internal auto         # Standard auto-switching
/mode internal manual       # Full manual control

# View detailed mode information
/mode internal stats        # Usage analytics
/mode internal history      # Pattern tracking
```

### Benefits of Internal Modes

#### Enhanced Productivity
- **Context-Appropriate Responses**: AI thinking matches your needs
- **Faster Problem Resolution**: Optimized cognitive approach per task
- **Reduced Iteration**: Better first-response accuracy
- **Workflow Acceleration**: Seamless mode transitions

#### Improved Quality
- **Specialized Processing**: Each mode optimized for specific tasks
- **Consistency**: Reproducible thinking patterns
- **Comprehensive Coverage**: 50 modes for diverse scenarios
- **Adaptive Learning**: Continuous improvement

#### Natural Interaction
- **Intuitive Usage**: No command memorization required
- **Multi-Language**: Native support for 5 languages
- **Visual Feedback**: Clear mode indicators
- **Seamless Experience**: Transparent mode switching

### Tips for Effective Mode Usage

#### Let Auto-Switching Work
```bash
# Good: Natural language triggers automatic modes
"Debug this error" → ✽ 🐛 Debugging…
"Brainstorm solutions" → ✽ 💡 Brainstorming…
"Optimize performance" → ✽ ⚡ Optimizing…
```

#### Use Manual Override When Needed
```bash
# Switch manually for specific approaches
/mode internal contemplative   # For deep thinking
/mode internal collaborative   # For pair programming
/mode internal intensive       # For detailed work
```

#### Monitor Your Patterns
```bash
# Check what modes work best for you
/mode internal stats
/mode internal history
```

## 🔍 Code Quality Analysis

### Overview of Quality Features

MARIA v1.1.0 includes enterprise-grade code quality analysis with four main categories:

1. **Bug Detection** (`/bug`) - Find and fix bugs automatically
2. **Lint Analysis** (`/lint`) - Code style and best practices
3. **Type Safety** (`/typecheck`) - TypeScript type analysis
4. **Security Review** (`/security-review`) - Security vulnerability assessment

### 1. Bug Detection (`/bug`)

#### Basic Bug Analysis
```bash
# Start bug analysis
/bug

# Available options:
• /bug report - Start interactive bug report
• /bug analyze - Analyze error logs/stack traces  
• /bug fix <description> - Get fix suggestions
• /bug search <keywords> - Search for similar issues

Example: /bug fix "TypeError: Cannot read property"
```

#### Fixing Specific Bugs
```bash
# Get AI-powered fix suggestions
/bug fix "null pointer exception"

# MARIA will provide:
🔧 Analyzing bug: "null pointer exception"
Searching knowledge base and generating fix suggestions...

💡 Fix Suggestions:
🔹 Null/Undefined Reference Issue:
  • Add null checks: if (obj && obj.property)
  • Use optional chaining: obj?.property
  • Initialize variables before use
  • Check async data loading completion
```

#### Interactive Bug Reports
```bash
/bug report

# MARIA guides you through:
🔍 Interactive Bug Report Generator
Please provide the following information:
1. What were you trying to do?
2. What actually happened?
3. What did you expect to happen?
4. Steps to reproduce the issue
5. Environment details (OS, browser, version)
```

### 2. Lint Analysis (`/lint`)

#### Code Quality Checking
```bash
# Run comprehensive lint analysis
/lint check

# Results include:
📊 Lint Analysis Results:
• Syntax errors: 0
• Style violations: 3 (auto-fixable)
• Best practice issues: 1
• Code quality score: 94/100

💡 Run "/lint fix" to automatically fix resolvable issues
```

#### Auto-Fix Issues
```bash
# Automatically fix resolvable issues
/lint fix

# MARIA will fix:
🔧 Auto-fixing lint issues...
Applying automatic fixes for style and formatting issues...
✅ Fixed 3 auto-fixable issues
⚠️ 1 issue requires manual attention
```

#### Detailed Reports
```bash
# Generate comprehensive report
/lint report

📋 Comprehensive Lint Report:
🔍 Code Quality Analysis:
  • Total files analyzed: 45
  • Lines of code: 12,847
  • Overall quality score: 94/100

📊 Issue Breakdown:
  • Errors: 0
  • Warnings: 3
  • Suggestions: 7
```

#### View Active Rules
```bash
# See what rules are being applied
/lint rules

🎯 Core ESLint Rules:
  ✅ no-console: warn
  ✅ no-unused-vars: error
  ✅ no-undef: error
  ✅ semi: error
  ✅ quotes: ["error", "single"]

🎨 Style Rules:
  ✅ indent: ["error", 2]
  ✅ max-len: ["warn", 120]
  ✅ no-trailing-spaces: error
```

### 3. TypeScript Type Safety (`/typecheck`)

#### Comprehensive Type Analysis
```bash
# Analyze TypeScript type safety
/typecheck analyze

# Results show:
📊 Type Analysis Results:
• Type errors: 0
• Any type usage: 2 instances
• Unknown type usage: 5 instances
• Type coverage: 87%
• Strict mode: Partially compliant

💡 Consider enabling strict mode for better type safety
```

#### Type Coverage Calculation
```bash
# Calculate type coverage
/typecheck coverage

📊 Type Coverage Analysis:
  • Total symbols: 1,247
  • Typed symbols: 1,085
  • Any types: 2
  • Unknown types: 5
  • Coverage: 87.0%

🎯 Areas for improvement:
  • src/utils/helpers.ts: 67% coverage
  • src/services/legacy.ts: 45% coverage
```

#### Strict Mode Compliance
```bash
# Check strict mode compliance
/typecheck strict

🔒 Strict Mode Compliance:
  ✅ noImplicitAny: enabled
  ✅ strictNullChecks: enabled
  ❌ strictFunctionTypes: disabled
  ❌ noImplicitReturns: disabled

💡 Enable remaining strict flags for maximum type safety
```

#### Configuration Optimization
```bash
# Get TSConfig recommendations
/typecheck config

⚙️ Recommended TSConfig optimizations:
  • Enable "strict": true
  • Add "noUnusedLocals": true
  • Add "noUnusedParameters": true
  • Consider "exactOptionalPropertyTypes": true

These settings improve type safety and catch more potential issues
```

### 4. Security Review (`/security-review`)

#### Comprehensive Security Scan
```bash
# Run complete security analysis
/security-review scan

# Results include:
🛡️ Security Scan Results:
• Critical vulnerabilities: 0
• High risk issues: 1
• Medium risk issues: 3
• Security score: 89/100
• OWASP compliance: 8/10

⚠️ High Risk Issue: Potential XSS vulnerability in user input handling
```

#### Dependency Security Audit
```bash
# Check dependencies for vulnerabilities
/security-review audit

🔍 Dependency Security Audit:
  • Total dependencies: 127
  • Vulnerabilities found: 0
  • Outdated packages: 5
  • Security advisories: 0

✅ No critical security vulnerabilities found in dependencies
```

#### OWASP Compliance Check
```bash
# Check OWASP Top 10 compliance
/security-review owasp

📋 OWASP Top 10 Compliance:
  ✅ A01 - Broken Access Control: Compliant
  ✅ A02 - Cryptographic Failures: Compliant
  ⚠️ A03 - Injection: Needs review
  ✅ A04 - Insecure Design: Compliant
  ✅ A05 - Security Misconfiguration: Compliant
  ✅ A06 - Vulnerable Components: Compliant
  ✅ A07 - Identity/Auth Failures: Compliant
  ✅ A08 - Software Integrity Failures: Compliant
  ✅ A09 - Security Logging Failures: Compliant
  ✅ A10 - Server-Side Request Forgery: Compliant

⚠️ Injection (A03): Review input validation and sanitization
```

#### Detailed Security Report
```bash
# Generate comprehensive security assessment
/security-review report

🛡️ Comprehensive Security Assessment:
📊 Security Overview:
  • Overall security score: 89/100
  • Critical issues: 0
  • High risk issues: 1
  • Medium risk issues: 3
  • Low risk issues: 7

🚨 High Priority Issues:
  1. Potential XSS in user input processing

⚠️ Medium Priority Issues:
  1. Missing CSRF protection on some endpoints
  2. Insufficient rate limiting
  3. Weak password policy enforcement

💡 Next steps: Address high priority issues first, then medium priority
```

## 🤖 AI Development Commands

### Code Generation (`/code`)

```bash
# Generate code with AI assistance
/code

# Interactive mode starts:
💻 Code Generation Mode
Entering interactive coding mode...
What would you like me to code for you?

# Example requests:
You: "Create a React component for user authentication"
You: "Write a Python function to sort an array"
You: "Generate a REST API endpoint for user management"
```

### Test Generation (`/test`)

```bash
# Generate tests for your code
/test

🧪 Test Generation Mode
Entering test generation mode...
What code would you like me to write tests for?

# MARIA will create:
• Unit tests
• Integration tests
• Mock implementations
• Test data fixtures
```

### Code Review (`/review`)

```bash
# Get AI-powered code review
/review

🔍 Code Review Mode
Entering code review mode...
Please paste the code you'd like me to review:

# MARIA provides:
• Code quality feedback
• Performance suggestions
• Security recommendations
• Best practice improvements
```

### AI Model Selection (`/model`)

```bash
# See available AI models
/model

🤖 AI Model Selector
📋 Available AI Models:

  ✅ GPT-5 [OpenAI] ($0.03/$0.06)
     Advanced reasoning and code generation
     Capabilities: chat, code, analysis

  ✅ Claude Opus 4.1 [Anthropic] ($0.015/$0.075)
     Expert-level analysis and reasoning
     Capabilities: chat, code, analysis, safety

  ✅ Gemini 2.5 Pro [Google] ($0.0025/$0.01)
     Fast and efficient processing
     Capabilities: chat, code, multimodal

  ✅ Qwen 3-30B [LM Studio] (Local)
     High-performance local model
     Capabilities: chat, code, reasoning
```

## 📁 Project Management

### Project Initialization (`/init`)

```bash
# Initialize a new project
/init

📁 Project Initialization
Initializing new MARIA project...
What type of project would you like to initialize?

# Options include:
• React/Next.js application
• Node.js/Express API
• Python Flask/Django app
• TypeScript library
• Full-stack application
```

### Directory Management (`/add-dir`)

```bash
# Add directory to project context
/add-dir

📂 Add Directory to Project
Adding directory to current project context...
Which directory would you like to add?

# MARIA will:
• Scan directory structure
• Analyze existing code
• Set up intelligent monitoring
• Enable context-aware assistance
```

### Memory Management (`/memory`)

```bash
# Manage project memory and context
/memory

🧠 Project Memory Management
Managing project context and memory...

Current project memory status:
• Active files: 23
• Context size: 145KB
• Last updated: 2 minutes ago
• Sync status: ✅ Up to date
```

### Data Export (`/export`)

```bash
# Export project data and configurations
/export

📤 Export Project Data
Exporting project configuration and data...

Available export formats:
• JSON configuration
• Markdown documentation
• CSV analysis reports
• ZIP archive backup
```

## 🎨 Media Generation

### Image Generation (`/image`)

```bash
# Generate images with AI
/image

🎨 Image Generation Mode
Entering image generation mode...
Describe the image you'd like me to generate:

# Example requests:
You: "A modern app interface wireframe"
You: "Technical architecture diagram"
You: "User flow chart for e-commerce"
```

### Video Generation (`/video`)

```bash
# Generate videos and animations
/video

🎬 Video Generation Mode
Entering video generation mode...
Describe the video content you'd like me to create:

# MARIA can create:
• Tutorial videos
• Product demos
• Animated explanations
• Code walkthroughs
```

### Avatar Interface (`/avatar`)

```bash
# Interact with MARIA's visual avatar
/avatar

🎭 MARIA Avatar Interface
═══════════════════════════════════════════
     ⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣦
   ⣰⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣆
  ⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
═══════════════════════════════════════════

👋 Hello! I am MARIA, your AI assistant!
This is a preview of the avatar interface.
Full interactive avatar with animations is coming soon!
```

## ⚙️ Customization & Settings

### Environment Setup (`/setup`)

```bash
# Run the setup wizard
/setup

🚀 Environment Setup Wizard
This wizard helps you configure MARIA for first-time use.

Set the following environment variables:
  export OPENAI_API_KEY=your_openai_key
  export ANTHROPIC_API_KEY=your_anthropic_key
  export GOOGLE_AI_API_KEY=your_google_key
```

### Settings Management (`/settings`)

```bash
# Check current settings
/settings

⚙️ Environment Settings
Checking current environment configuration...

OPENAI_API_KEY: ✅ Set
ANTHROPIC_API_KEY: ✅ Set
GOOGLE_AI_API_KEY: ❌ Not set

Current configuration:
• Default model: GPT-5
• Language: English
• Debug mode: Disabled
• Auto-save: Enabled
```

### Configuration (`/config`)

```bash
# View configuration options
/config

⚙️ Configuration Options
Available environment variables:
  OPENAI_API_KEY=Your OpenAI API key
  ANTHROPIC_API_KEY=Your Anthropic API key
  GOOGLE_AI_API_KEY=Your Google AI API key

Local AI Services:
  LMSTUDIO_API_URL=http://localhost:1234
  OLLAMA_API_URL=http://localhost:11434
```

## 🔧 System Commands

### System Status (`/status`)

```bash
# Check system health
/status

📊 System Status:
✅ Overall: healthy
💻 CPU: 45%
🧠 Memory: 67%
💾 Disk: 23%

AI Services:
✅ OpenAI: Available
✅ Anthropic: Available  
✅ LM Studio: 5 models available
⚠️ Ollama: Not running
```

### Health Check (`/health`)

```bash
# Detailed health diagnostics
/health

🏥 Health Status:
Local Services:
  ✅ LM Studio: running
  ⚠️ Ollama: Not running
  ⚠️ vLLM: Not running

Cloud APIs:
  ✅ OpenAI: available
  ✅ Anthropic: available
  ✅ Google AI: available

Recommendations:
  💡 Consider starting Ollama for additional local models
```

### System Diagnostics (`/doctor`)

```bash
# Comprehensive system diagnostics
/doctor

🏥 System Diagnostics
Running comprehensive system health checks...

✅ Node.js version: 18.2.0 (supported)
✅ MARIA version: 1.1.0 (latest)
✅ Dependencies: All up to date
✅ Configuration: Valid
✅ Network connectivity: Good
⚠️ Warning: High memory usage detected
```

## 🛠️ Troubleshooting

### Common Issues and Solutions

#### 1. MARIA Command Not Found

**Problem**: `maria: command not found`

**Solution**:
```bash
# Check if installed globally
npm list -g @bonginkan/maria

# Reinstall if needed
npm install -g @bonginkan/maria

# Or use npx
npx @bonginkan/maria --version
```

#### 2. AI Provider Connection Issues

**Problem**: "Failed to connect to AI provider"

**Solution**:
```bash
# Check API keys
/settings

# Test specific provider
/health

# Set API keys if missing
export OPENAI_API_KEY="your-key-here"
export ANTHROPIC_API_KEY="your-key-here"
```

#### 3. Slow Performance

**Problem**: Commands taking too long to respond

**Solution**:
```bash
# Check system status
/status

# Run diagnostics
/doctor

# Clear cache
rm -rf ~/.maria/cache

# Restart MARIA
/exit
maria
```

#### 4. Code Analysis Not Working

**Problem**: `/lint` or `/typecheck` commands not working

**Solution**:
```bash
# Ensure you're in a project directory
cd /path/to/your/project

# Check if package.json exists
ls package.json

# Install dependencies
npm install

# Try analysis again
/lint check
```

#### 5. Memory Issues

**Problem**: "Out of memory" errors

**Solution**:
```bash
# Check memory usage
/status

# Close other applications
# Restart MARIA with more memory
NODE_OPTIONS="--max-old-space-size=4096" maria
```

### Getting Help

```bash
# See all available commands
/help

# Get command-specific help
/bug --help
/lint --help
/typecheck --help

# Check system status
/status
/health
/doctor
```

### Contact Support

If you need additional help:

- **GitHub Issues**: https://github.com/bonginkan/maria_code/issues
- **Documentation**: Complete guides and API reference
- **Community Forum**: Connect with other MARIA users
- **Enterprise Support**: Priority support for business users

## 💡 Tips & Best Practices

### 1. Effective Natural Language Usage

**Good Examples**:
```bash
✅ "check my code for bugs"
✅ "analyze security vulnerabilities"
✅ "generate a React component"
✅ "fix this TypeScript error"
```

**Avoid**:
```bash
❌ "do something with code"
❌ "help me"
❌ "make it better"
```

### 2. Code Quality Workflow

**Recommended Daily Workflow**:
```bash
# 1. Start with overall health check
/status

# 2. Run comprehensive analysis
/lint check
/typecheck analyze
/security-review scan

# 3. Fix issues in priority order
/lint fix              # Auto-fix style issues
/bug fix "specific bug" # Address critical bugs
/security-review scan   # Verify security fixes

# 4. Generate tests for new code
/test

# 5. Final review
/review
```

### 3. AI Model Selection

**For Different Tasks**:
- **Code Generation**: GPT-5 or Claude Opus 4.1
- **Code Analysis**: Any model works well
- **Security Review**: Claude Opus 4.1 (excellent safety)
- **Performance Optimization**: Gemini 2.5 Pro (fast analysis)
- **Local Development**: LM Studio models (privacy)

### 4. Project Organization

**Best Practices**:
```bash
# Initialize MARIA in your project root
cd /your/project
maria
/init

# Add relevant directories
/add-dir src
/add-dir tests

# Set up regular analysis
/memory  # Check context status
```

### 5. Performance Optimization

**Speed Up MARIA**:
- Use local AI models for faster responses
- Keep project context focused (avoid adding unnecessary directories)
- Run `/lint fix` regularly to maintain code quality
- Use specific commands instead of broad natural language

### 6. Security Best Practices

**Maintain Security**:
```bash
# Regular security scans
/security-review scan

# Check dependencies monthly
/security-review audit

# Verify OWASP compliance
/security-review owasp

# Address high-priority issues immediately
```

### 7. Team Collaboration

**Sharing MARIA Results**:
- Use `/export` to share analysis reports
- Document security findings with `/security-review report`
- Share lint configurations across team
- Set up consistent quality standards

## 🎓 Learning Resources

### Getting Better with MARIA

1. **Start Simple**: Begin with basic commands like `/help` and `/status`
2. **Use Natural Language**: Don't memorize commands, just talk naturally
3. **Explore Gradually**: Try one new feature each day
4. **Read the Output**: MARIA provides helpful explanations and suggestions
5. **Practice Regularly**: Use MARIA in your daily development workflow

### Advanced Usage

Once comfortable with basics:
- Explore custom model configurations
- Set up CI/CD integration
- Use MARIA for code reviews
- Implement security standards
- Optimize team workflows

### Community Resources

- **Documentation**: Complete technical guides
- **Video Tutorials**: Step-by-step walkthroughs
- **Example Projects**: Sample implementations
- **Best Practices**: Industry-standard patterns
- **User Forum**: Community discussions and tips

---

## 🎉 Conclusion

MARIA Platform v1.1.0 provides enterprise-grade AI development tools that adapt to your workflow. Whether you're a beginner learning to code or an experienced developer maintaining complex applications, MARIA's natural language interface and comprehensive code quality analysis help you build better software faster.

**Key Takeaways**:
- Use natural language - MARIA understands what you want to do
- Run regular code quality checks with `/lint`, `/typecheck`, and `/security-review`
- Let MARIA learn your patterns and preferences over time
- Leverage AI assistance for coding, debugging, and documentation
- Maintain high quality standards with automated analysis

Start your journey with MARIA today and experience the future of AI-powered development!

For additional support and resources: **support@bonginkan.ai**

*Copyright © 2025 Bonginkan Inc. All rights reserved.*