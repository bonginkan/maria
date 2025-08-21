# MARIA Platform v1.3.0 - User Manual

## 🎯 Welcome to MARIA

**MARIA Platform v1.3.0 "Local AI Revolution"** is the world's most advanced AI-powered development platform, featuring the revolutionary **Internal Mode System** with 50 cognitive modes and **complete local AI integration** with 3 local providers. This user manual will guide you through every feature, from basic setup to advanced local AI development.

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [Installation Guide](#installation-guide)
3. [🏠 Local AI Setup (NEW v1.3.0)](#local-ai-setup)
4. [Basic Usage](#basic-usage)
5. [🧠 Internal Mode System](#internal-mode-system)
6. [Natural Language Interface](#natural-language-interface)
7. [Code Quality Analysis](#code-quality-analysis)
8. [AI Development Commands](#ai-development-commands)
9. [Project Management](#project-management)
10. [Advanced Features](#advanced-features)
11. [Customization & Settings](#customization--settings)
12. [Troubleshooting](#troubleshooting)
13. [Tips & Best Practices](#tips--best-practices)

## 🚀 Getting Started

### What is MARIA?

MARIA (Multi-Agent Research & Intelligence Assistant) is an enterprise-grade AI development platform that combines:

- **🏠 Complete Local AI Integration (NEW v1.3.0)**: Full support for 3 local AI providers
- **🧠 Internal Mode System**: Revolutionary 50 cognitive modes that adapt to your context in real-time
- **Natural Language Understanding**: Talk to AI in 5 languages (English, Japanese, Chinese, Korean, Vietnamese)
- **Code Quality Analysis**: Professional-grade bug detection, linting, type checking, and security review
- **Multi-Model AI Integration**: Access to 47+ AI models (Cloud + Local providers)
- **Intelligent Development**: Automated coding, testing, and documentation generation

### Key Benefits

✅ **🏠 Complete Privacy**: Full offline development with local AI models  
✅ **🧠 Cognitive Adaptation**: AI automatically adjusts thinking style to your needs  
✅ **💰 Zero API Costs**: Use local models without cloud API fees  
✅ **⚡ Lightning Fast**: Local inference with sub-second response times  
✅ **🔒 Enterprise Security**: Complete data privacy and compliance  
✅ **🌐 Multi-Provider Support**: LM Studio + Ollama + vLLM integration  
✅ **📊 Advanced Analysis**: 7 local models + 40+ cloud models available

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
# Should display: 1.3.0
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

## 🏠 Local AI Setup (NEW v1.3.0)

### Overview of Local AI Integration

**NEW in v1.3.0**: MARIA now provides complete local AI integration with three powerful providers:

1. **🖥️ LM Studio** - GUI-based local model management
2. **🦙 Ollama** - Lightweight local model runtime
3. **🚀 vLLM** - High-performance inference engine

### Automated Local AI Setup

#### Ollama Quick Setup

```bash
# Automated Ollama installation and setup
maria setup-ollama

# This will:
# ✅ Install Ollama via Homebrew
# ✅ Download llama3.2:3b model
# ✅ Start Ollama service
# ✅ Configure environment variables
# ✅ Test integration with MARIA
```

#### vLLM Quick Setup

```bash
# Automated vLLM installation and setup
maria setup-vllm

# This will:
# ✅ Create Python virtual environment
# ✅ Install vLLM and dependencies
# ✅ Download DialoGPT-medium model
# ✅ Start OpenAI-compatible API server
# ✅ Configure environment variables
# ✅ Test integration with MARIA
```

#### LM Studio Setup

```bash
# LM Studio setup assistance
maria setup-lmstudio

# This will guide you through:
# ✅ LM Studio installation
# ✅ Model downloading
# ✅ Server configuration
# ✅ MARIA integration
```

### Manual Local AI Configuration

#### Environment Variables Setup

```bash
# Ollama Configuration
export OLLAMA_ENABLED=true
export OLLAMA_API_BASE=http://localhost:11434
export OLLAMA_DEFAULT_MODEL=llama3.2:3b

# vLLM Configuration
export VLLM_ENABLED=true
export VLLM_API_BASE=http://localhost:8000/v1
export VLLM_DEFAULT_MODEL=DialoGPT-medium

# LM Studio Configuration
export LMSTUDIO_ENABLED=true
export LMSTUDIO_API_BASE=http://localhost:1234/v1
export LMSTUDIO_DEFAULT_MODEL=gpt-oss-120b
```

### Verifying Local AI Integration

```bash
# Check all available models
maria models

# Expected output with local providers:
📋 Available Models (47+):

✅ Local Models:
  🖥️ LM Studio (5 models):
    - qwen3-30b-a3b
    - gpt-oss-120b
    - gpt-oss-20b
    - mistral-7b-instruct
    - nomic-embed-text

  🦙 Ollama (1 model):
    - llama3.2:3b

  🚀 vLLM (1 model):
    - DialoGPT-medium

✅ Cloud Models:
  - GPT-5, Claude Opus 4.1, Gemini 2.5 Pro, etc.
```

### Local AI Service Management

#### Checking Service Status

```bash
# Check health of all AI services
maria health

🏥 AI Services Health Status:
Local Services:
  ✅ LM Studio: 5 models available
  ✅ Ollama: Running (llama3.2:3b)
  ✅ vLLM: 1 model available

Cloud Services:
  ✅ OpenAI: Available
  ✅ Anthropic: Available
  ✅ Google AI: Available
```

#### Starting/Stopping Services

```bash
# Auto-start all local AI services
./scripts/auto-start-llm.sh start

# Check service status
./scripts/auto-start-llm.sh status

# Stop all services
./scripts/auto-start-llm.sh stop
```

### Benefits of Local AI

#### Privacy & Security

- **Complete Offline Operation**: No data leaves your machine
- **Enterprise Compliance**: Meets strictest security requirements
- **No Cloud Dependencies**: Work anywhere, anytime
- **Data Sovereignty**: Full control over your code and data

#### Performance & Cost

- **Zero API Costs**: No usage fees or rate limits
- **Sub-second Response**: Local inference is lightning fast
- **Always Available**: No network connectivity required
- **Unlimited Usage**: Process as much code as needed

#### Developer Experience

- **Seamless Integration**: Works identically to cloud models
- **Model Diversity**: 7 local models for different use cases
- **Auto-Detection**: MARIA automatically finds running services
- **Unified Interface**: Single command works with all providers

## 🎮 Basic Usage

### Starting MARIA

```bash
# Start interactive mode (recommended)
maria

# You'll see the beautiful MARIA interface with local AI status:
╭──────────────────────────────────────────────────────────╮
│                   MARIA CODE                              │
│        AI-Powered Development Platform                    │
╰──────────────────────────────────────────────────────────╯

🚀 Initializing AI Services...

Local AI Services:
─────────────────────────────────────────────────────────────
LM Studio    [████████████████████] 100% ✅ 5 models available
Ollama       [████████████████████] 100% ✅ Running
vLLM         [████████████████████] 100% ✅ 1 model available

Cloud Services:
─────────────────────────────────────────────────────────────
OpenAI       ✅ Available (GPT-5)
Anthropic    ✅ Available (Claude Opus 4.1)
Google AI    ✅ Available (Gemini 2.5 Pro)

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

# See all available models (local + cloud)
/models

# Analyze code quality
/lint check

# Generate code
/code

# Switch AI model/provider
/model

# Exit MARIA
/exit
```

### Local AI Model Selection

```bash
# Switch to local providers for privacy
You: /model

🤖 AI Model Selector
📋 Available AI Models:

🏠 LOCAL MODELS (Privacy First):
  ✅ qwen3-30b-a3b [lmstudio] (Local)
     High-performance reasoning and code generation

  ✅ llama3.2:3b [ollama] (Local)
     Lightweight and efficient for quick tasks

  ✅ DialoGPT-medium [vllm] (Local)
     Optimized for dialogue and code assistance

☁️ CLOUD MODELS (Internet Required):
  ✅ GPT-5 [openai] ($0.03/$0.06)
  ✅ Claude Opus 4.1 [anthropic] ($0.015/$0.075)
  ✅ Gemini 2.5 Pro [google] ($0.0025/$0.01)

# Select a model:
You: Select qwen3-30b-a3b
🎯 Switched to qwen3-30b-a3b (LM Studio) - Local AI
```

### Your First Local Code Generation

Let's generate code using a local AI model:

````bash
# Generate code with local AI
You: "Create a TypeScript function to calculate fibonacci numbers"
MARIA: ✽ 💻 Coding… [Using qwen3-30b-a3b - Local AI]

Generated Code:
```typescript
function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Optimized version with memoization
function fibonacciMemo(n: number, memo: Map<number, number> = new Map()): number {
  if (n <= 1) return n;
  if (memo.has(n)) return memo.get(n)!;

  const result = fibonacciMemo(n - 1, memo) + fibonacciMemo(n - 2, memo);
  memo.set(n, result);
  return result;
}

// Example usage
console.log(fibonacci(10)); // 55
console.log(fibonacciMemo(50)); // Efficient for large numbers
````

🏠 Generated locally with complete privacy - no data sent to cloud!

````

## 🗣️ Natural Language Interface

### Revolutionary Natural Language Understanding

MARIA understands natural language in 5 languages and automatically converts your requests into the appropriate commands:

#### English Examples with Local AI
```bash
You: "check my code quality using local AI"
MARIA: → Automatically executes /lint check with local provider

You: "find bugs in my code privately"
MARIA: → Automatically executes /bug analyze with local AI

You: "generate a React component using Ollama"
MARIA: → Automatically executes /code with Ollama provider
````

#### Japanese Examples with Local AI

```bash
You: "ローカルAIでコードを分析して"
MARIA: → /lint check をローカルプロバイダーで自動実行

You: "プライベートにバグを見つけて"
MARIA: → /bug analyze をローカルAIで自動実行

You: "オフラインでTypeScriptコードを生成して"
MARIA: → /code をローカルプロバイダーで自動実行
```

#### Local AI Priority Settings

```bash
You: "use only local AI models"
MARIA: → Switches to privacy-first mode with local providers only

You: "work offline"
MARIA: → Enables offline mode with local AI providers

You: "fastest local model for quick task"
MARIA: → Automatically selects llama3.2:3b (Ollama) for speed
```

### Smart Context Understanding with Local AI

MARIA remembers context and adapts to your workflow:

```bash
You: "analyze this code privately"
MARIA: 🏠 Using local AI for privacy
What would you like me to analyze?
      • Code quality (/lint) - Local AI
      • Bug detection (/bug) - Local AI
      • Type safety (/typecheck) - Local AI
      • Security (/security-review) - Local AI

You: "security issues"
MARIA: ✽ 🔒 Security Analysis… [Using vLLM - Local AI]
      → Automatically switches to /security-review scan with local provider
```

## 🧠 Internal Mode System

### Revolutionary Cognitive Adaptation

**Enhanced in v1.3.0**: MARIA's Internal Mode System now works seamlessly with local AI providers, providing the same 50 cognitive modes with complete privacy.

#### How It Works with Local AI

```bash
# MARIA starts in default thinking mode with local AI
You: "I need to fix this bug using local AI"
MARIA: ✽ 🐛 Debugging… [Using qwen3-30b-a3b - Local AI]
        [Automatically switches to debugging mode with local provider]

You: "Give me creative ideas privately"
MARIA: ✽ 💡 Brainstorming… [Using llama3.2:3b - Local AI]
        [Switches to brainstorming mode with Ollama for privacy]

You: "Optimize this algorithm offline"
MARIA: ✽ ⚡ Optimizing… [Using vLLM - Local AI]
        [Switches to optimization mode with local inference]
```

### The 50 Cognitive Modes (Now with Local AI)

All cognitive modes work with local AI providers for complete privacy:

#### 🧠 Reasoning Modes (5) - Local AI Enabled

- **✽ Thinking…** - Standard reasoning using local models
- **✽ Ultra Thinking…** - Deep analysis with high-performance local AI
- **✽ Optimizing…** - Performance improvement using local inference
- **✽ Researching…** - Information analysis with local models
- **✽ TODO…** - Task planning with local AI assistance

#### 💡 Creative Modes (5+) - Local AI Enabled

- **✽ Brainstorming…** - Unrestricted idea generation with local AI
- **✽ Drafting…** - Content creation using local models
- **✽ Inventing…** - Novel solutions with local inference
- **✽ Remixing…** - Creative combinations using local AI
- **✽ Dreaming…** - Visionary thinking with local providers

#### 📊 Analytical Modes (5+) - Local AI Enabled

- **✽ Summarizing…** - Information condensing with local models
- **✽ Distilling…** - Core insight extraction using local AI
- **✽ Highlighting…** - Key point identification with local inference
- **✽ Categorizing…** - Organization using local providers
- **✽ Mapping…** - Relationship creation with local AI

#### 🔍 Validation Modes (5+) - Local AI Enabled

- **✽ Debugging…** - Error detection using local models
- **✽ Validating…** - Accuracy checking with local AI
- **✽ Reviewing…** - Quality assessment using local inference
- **✽ Refactoring…** - Code improvement with local providers
- **✽ Finalizing…** - Polish and completion using local AI

### Using Local AI with /mode Command

Control internal modes with local AI providers:

#### View Current Mode with Provider

```bash
/mode
# Shows:
# 📋 Mode Status:
# Operation Mode: chat (default)
# Internal Mode: ✽ Thinking… - Standard reasoning
# Provider: qwen3-30b-a3b (LM Studio) - Local AI
# Privacy: 🏠 Complete (Local processing)
```

#### Switch Modes with Local AI Preference

```bash
/mode internal debugging --local    # Force local AI for debugging
/mode internal brainstorming --offline # Use local AI for brainstorming
/mode internal optimizing --privacy # Use local AI for optimization
```

#### Local AI Performance Metrics

```bash
/mode internal stats --local
# Shows:
# 🏠 Local AI Mode Statistics:
# • Total local AI requests: 247
# • Average response time: 0.8s
# • Privacy compliance: 100%
# • Offline capability: Available
# • Cost savings: $23.45 (estimated)
```

### Benefits of Local AI + Internal Modes

#### Enhanced Privacy

- **Zero Data Transmission**: All cognitive processing stays local
- **Complete Confidentiality**: Your code never leaves your machine
- **Compliance Ready**: Meets strictest enterprise requirements
- **Audit Trail**: Full local logging and monitoring

#### Superior Performance

- **Sub-second Response**: Local cognitive mode switching
- **Always Available**: No network dependencies
- **Unlimited Usage**: No rate limits or quotas
- **Consistent Quality**: Reliable local inference

#### Cost Efficiency

- **Zero API Costs**: No charges for cognitive mode processing
- **Scalable Usage**: Process unlimited requests locally
- **Team Deployment**: Single setup for entire team
- **Enterprise Value**: Massive cost savings at scale

## 🔍 Code Quality Analysis

### Overview of Quality Features with Local AI

MARIA v1.3.0 includes enterprise-grade code quality analysis with complete local AI support:

1. **Bug Detection** (`/bug`) - Find and fix bugs using local AI
2. **Lint Analysis** (`/lint`) - Code style analysis with local models
3. **Type Safety** (`/typecheck`) - TypeScript analysis using local AI
4. **Security Review** (`/security-review`) - Security assessment with local providers

### 1. Bug Detection with Local AI (`/bug`)

#### Basic Bug Analysis Using Local AI

```bash
# Start bug analysis with local AI
/bug

🏠 Bug Detection Mode (Local AI)
Using qwen3-30b-a3b for complete privacy

# Available options:
• /bug report - Interactive bug report with local AI
• /bug analyze - Analyze error logs using local AI
• /bug fix <description> - Get local AI fix suggestions
• /bug search <keywords> - Search using local knowledge base

Example: /bug fix "TypeError: Cannot read property" --local
```

#### Local AI Bug Fixing

```bash
# Get AI-powered fix suggestions using local AI
/bug fix "null pointer exception" --local

🔧 Analyzing bug using local AI...
✽ 🐛 Debugging… [Using qwen3-30b-a3b - Local AI]

🏠 Local AI Bug Analysis (Privacy Protected):
💡 Fix Suggestions from Local AI:
🔹 Null/Undefined Reference Issue:
  • Add null checks: if (obj && obj.property)
  • Use optional chaining: obj?.property
  • Initialize variables before use
  • Check async data loading completion

🔹 Local AI Confidence: 95%
🔹 Processing Time: 0.7s (local inference)
🔹 Privacy: 100% (no data transmitted)
```

### 2. Lint Analysis with Local AI (`/lint`)

#### Code Quality Checking with Local AI

```bash
# Run comprehensive lint analysis using local AI
/lint check --local

🏠 Lint Analysis (Local AI Processing)
✽ 📊 Analyzing… [Using vLLM - Local AI]

📊 Local AI Lint Results:
• Syntax errors: 0
• Style violations: 3 (auto-fixable)
• Best practice issues: 1
• Code quality score: 94/100
• Analysis time: 1.2s (local inference)
• Privacy: 🏠 Complete

💡 Run "/lint fix --local" for local AI auto-fixes
```

#### Local AI Auto-Fix

```bash
# Automatically fix issues using local AI
/lint fix --local

🔧 Auto-fixing with local AI...
✽ 🔧 Fixing… [Using llama3.2:3b - Local AI]

🏠 Local AI Auto-Fix Results:
✅ Fixed 3 auto-fixable issues locally
⚠️ 1 issue requires manual attention
🚀 Processing time: 0.9s
🔒 Privacy: Complete (local processing)
```

### 3. TypeScript Type Safety with Local AI (`/typecheck`)

#### Comprehensive Type Analysis with Local AI

```bash
# Analyze TypeScript using local AI
/typecheck analyze --local

🏠 Type Analysis (Local AI)
✽ 📊 Type Checking… [Using qwen3-30b-a3b - Local AI]

📊 Local AI Type Analysis:
• Type errors: 0
• Any type usage: 2 instances
• Unknown type usage: 5 instances
• Type coverage: 87%
• Strict mode: Partially compliant
• Analysis time: 1.5s (local inference)

💡 Local AI suggests enabling strict mode for better type safety
```

### 4. Security Review with Local AI (`/security-review`)

#### Comprehensive Security Scan with Local AI

```bash
# Run security analysis using local AI
/security-review scan --local

🏠 Security Scan (Local AI)
✽ 🔒 Security Analysis… [Using vLLM - Local AI]

🛡️ Local AI Security Results:
• Critical vulnerabilities: 0
• High risk issues: 1
• Medium risk issues: 3
• Security score: 89/100
• OWASP compliance: 8/10
• Analysis time: 2.1s (local inference)
• Privacy: 🏠 Complete

⚠️ High Risk Issue detected by local AI:
   Potential XSS vulnerability in user input handling
```

#### Local AI OWASP Compliance

```bash
# Check OWASP compliance using local AI
/security-review owasp --local

🏠 OWASP Analysis (Local AI)
✽ 🛡️ Security Compliance… [Using qwen3-30b-a3b - Local AI]

📋 OWASP Top 10 Compliance (Local AI Analysis):
  ✅ A01 - Broken Access Control: Compliant
  ✅ A02 - Cryptographic Failures: Compliant
  ⚠️ A03 - Injection: Needs review (detected by local AI)
  ✅ A04 - Insecure Design: Compliant
  ✅ A05 - Security Misconfiguration: Compliant
  ✅ A06 - Vulnerable Components: Compliant
  ✅ A07 - Identity/Auth Failures: Compliant
  ✅ A08 - Software Integrity Failures: Compliant
  ✅ A09 - Security Logging Failures: Compliant
  ✅ A10 - Server-Side Request Forgery: Compliant

🔒 Analysis completed locally with complete privacy
```

## 🤖 AI Development Commands

### Code Generation with Local AI (`/code`)

```bash
# Generate code using local AI
/code

🏠 Code Generation Mode (Local AI)
✽ 💻 Coding… [Using qwen3-30b-a3b - Local AI]

💻 Local AI Code Generation
What would you like me to code for you?

# Example requests with local AI:
You: "Create a React component for user authentication"
MARIA: [Generates component using local AI with complete privacy]

You: "Write a Python function to sort an array"
MARIA: [Creates function using local inference]

You: "Generate a REST API endpoint for user management"
MARIA: [Builds endpoint using local AI models]

🏠 All code generated locally - complete privacy guaranteed!
```

### Test Generation with Local AI (`/test`)

```bash
# Generate tests using local AI
/test

🏠 Test Generation Mode (Local AI)
✽ 🧪 Testing… [Using llama3.2:3b - Local AI]

🧪 Local AI Test Generation
What code would you like me to write tests for?

# Local AI creates:
• Unit tests using local inference
• Integration tests with local AI
• Mock implementations using local models
• Test data fixtures with local generation

🔒 All tests generated privately using local AI
```

### Code Review with Local AI (`/review`)

```bash
# Get AI-powered code review using local AI
/review

🏠 Code Review Mode (Local AI)
✽ 🔍 Reviewing… [Using vLLM - Local AI]

🔍 Local AI Code Review
Please paste the code you'd like me to review:

# Local AI provides:
• Code quality feedback using local analysis
• Performance suggestions with local AI
• Security recommendations using local models
• Best practice improvements with local inference

🏠 Complete privacy - your code stays on your machine!
```

### AI Model Selection with Local Priority (`/model`)

```bash
# See available AI models with local priority
/model

🤖 AI Model Selector (Local AI Priority)
📋 Available AI Models:

🏠 LOCAL MODELS (Recommended for Privacy):
  ✅ qwen3-30b-a3b [lmstudio] (Local)
     🚀 High-performance reasoning and code generation
     💰 Cost: Free | 🔒 Privacy: Complete | ⚡ Speed: 0.8s avg

  ✅ llama3.2:3b [ollama] (Local)
     ⚡ Lightweight and efficient for quick tasks
     💰 Cost: Free | 🔒 Privacy: Complete | ⚡ Speed: 0.5s avg

  ✅ DialoGPT-medium [vllm] (Local)
     💬 Optimized for dialogue and code assistance
     💰 Cost: Free | 🔒 Privacy: Complete | ⚡ Speed: 0.9s avg

☁️ CLOUD MODELS (Internet Required):
  ✅ GPT-5 [openai] ($0.03/$0.06)
     🧠 Advanced reasoning and code generation

  ✅ Claude Opus 4.1 [anthropic] ($0.015/$0.075)
     🛡️ Expert-level analysis and safety

  ✅ Gemini 2.5 Pro [google] ($0.0025/$0.01)
     ⚡ Fast and efficient processing

🎯 Recommendation: Use local models for privacy and cost savings
💡 Switch anytime: "use qwen3-30b-a3b" or "switch to local AI"
```

## 📁 Project Management

### Project Initialization with Local AI (`/init`)

```bash
# Initialize project using local AI
/init

🏠 Project Initialization (Local AI)
✽ 📁 Initializing… [Using qwen3-30b-a3b - Local AI]

📁 Local AI Project Initialization
What type of project would you like to initialize?

# Options with local AI assistance:
• React/Next.js application (local AI scaffolding)
• Node.js/Express API (local AI templates)
• Python Flask/Django app (local AI generation)
• TypeScript library (local AI structure)
• Full-stack application (local AI architecture)

🏠 All project templates generated locally with complete privacy!
```

### Memory Management with Local AI (`/memory`)

```bash
# Manage project memory using local AI
/memory

🏠 Project Memory Management (Local AI)
✽ 🧠 Memory… [Using llama3.2:3b - Local AI]

🧠 Local AI Project Memory
Managing project context with local AI...

Current project memory status:
• Active files: 23
• Context size: 145KB
• Local AI analysis: Complete
• Privacy status: 🏠 100% Local
• Last updated: 2 minutes ago
• Sync status: ✅ Up to date

🔒 All project data processed locally - complete privacy
```

## ⚙️ Customization & Settings

### Local AI Environment Setup (`/setup`)

```bash
# Configure local AI environment
/setup

🏠 Local AI Environment Setup
This wizard helps you configure local AI providers.

Available local AI setup options:
  1. 🦙 Ollama Setup - Lightweight local models
  2. 🚀 vLLM Setup - High-performance inference
  3. 🖥️ LM Studio Setup - GUI-based model management
  4. 🌟 Complete Setup - Install all local AI providers

Select option [1-4]: 4

🚀 Setting up complete local AI environment...
✅ Installing Ollama with llama3.2:3b
✅ Setting up vLLM with DialoGPT-medium
✅ Configuring LM Studio integration
✅ Testing all local AI connections
✅ Complete local AI environment ready!
```

### Local AI Settings Management (`/settings`)

```bash
# Check local AI settings
/settings

🏠 Local AI Settings
⚙️ Local AI Environment Configuration

🦙 Ollama Status:
  • Service: ✅ Running
  • Model: llama3.2:3b
  • API: http://localhost:11434
  • Memory usage: 2.1GB

🚀 vLLM Status:
  • Service: ✅ Running
  • Model: DialoGPT-medium
  • API: http://localhost:8000
  • Memory usage: 1.8GB

🖥️ LM Studio Status:
  • Service: ✅ Running
  • Models: 5 available
  • API: http://localhost:1234
  • Memory usage: 4.2GB

☁️ Cloud API Status:
  • OpenAI: ✅ Configured
  • Anthropic: ✅ Configured
  • Google AI: ✅ Configured

🎯 Recommendation: Local AI is fully operational!
```

### Local AI Configuration (`/config`)

```bash
# View local AI configuration
/config

🏠 Local AI Configuration
⚙️ Local AI Environment Variables

🦙 Ollama Configuration:
  OLLAMA_ENABLED=true
  OLLAMA_API_BASE=http://localhost:11434
  OLLAMA_DEFAULT_MODEL=llama3.2:3b
  OLLAMA_MAX_TOKENS=4096
  OLLAMA_TEMPERATURE=0.7

🚀 vLLM Configuration:
  VLLM_ENABLED=true
  VLLM_API_BASE=http://localhost:8000/v1
  VLLM_DEFAULT_MODEL=DialoGPT-medium
  VLLM_MAX_TOKENS=2048
  VLLM_TEMPERATURE=0.7

🖥️ LM Studio Configuration:
  LMSTUDIO_ENABLED=true
  LMSTUDIO_API_BASE=http://localhost:1234/v1
  LMSTUDIO_DEFAULT_MODEL=qwen3-30b-a3b
  LMSTUDIO_MAX_TOKENS=8192
  LMSTUDIO_TEMPERATURE=0.7

🔒 Privacy Mode:
  DISABLE_CLOUD_PROVIDERS=false
  OFFLINE_MODE=false
  LOCAL_AI_PRIORITY=true
```

## 🔧 System Commands

### System Status with Local AI (`/status`)

```bash
# Check system health including local AI
/status

📊 System Status (Including Local AI):
✅ Overall: healthy
💻 CPU: 45%
🧠 Memory: 67%
💾 Disk: 23%

🏠 Local AI Services:
✅ LM Studio: 5 models available (4.2GB memory)
✅ Ollama: Running llama3.2:3b (2.1GB memory)
✅ vLLM: DialoGPT-medium ready (1.8GB memory)

☁️ Cloud AI Services:
✅ OpenAI: Available
✅ Anthropic: Available
✅ Google AI: Available

🎯 Performance: Local AI providing 0.7s avg response time
```

### Health Check with Local AI Focus (`/health`)

```bash
# Detailed health diagnostics for local AI
/health

🏥 Comprehensive Health Status:

🏠 Local AI Services:
  ✅ LM Studio:
    • Status: Running
    • Models: 5 available
    • API: http://localhost:1234 (responsive)
    • Memory: 4.2GB / 8GB allocated
    • Performance: Excellent (0.8s avg)

  ✅ Ollama:
    • Status: Running
    • Model: llama3.2:3b loaded
    • API: http://localhost:11434 (responsive)
    • Memory: 2.1GB / 4GB allocated
    • Performance: Excellent (0.5s avg)

  ✅ vLLM:
    • Status: Running
    • Model: DialoGPT-medium loaded
    • API: http://localhost:8000 (responsive)
    • Memory: 1.8GB / 3GB allocated
    • Performance: Good (0.9s avg)

☁️ Cloud APIs:
  ✅ OpenAI: available
  ✅ Anthropic: available
  ✅ Google AI: available

🎯 Recommendations:
  💡 Local AI is performing optimally
  💡 Consider using local models for privacy
  💡 Total local AI memory: 8.1GB (efficient)
```

## 🛠️ Troubleshooting

### Local AI Troubleshooting

#### 1. Local AI Services Not Starting

**Problem**: "Local AI services failed to start"

**Solution**:

```bash
# Check service status
maria health

# Restart all local AI services
./scripts/auto-start-llm.sh restart

# Check specific service logs
ollama logs
# or
docker logs vllm-container
# or
tail -f ~/.lmstudio/logs/server.log

# Verify ports are available
lsof -i :11434  # Ollama
lsof -i :8000   # vLLM
lsof -i :1234   # LM Studio
```

#### 2. Models Not Loading

**Problem**: "Failed to load local AI models"

**Solution**:

```bash
# Check available models
ollama list
# or
ls ~/.lmstudio/models
# or
ls ~/vllm-models

# Re-download models if needed
ollama pull llama3.2:3b
# or
maria setup-vllm --models "microsoft/DialoGPT-medium"

# Check model file integrity
ollama show llama3.2:3b
```

#### 3. Memory Issues with Local AI

**Problem**: "Out of memory when running local AI"

**Solution**:

```bash
# Check memory usage
maria status

# Optimize memory settings
export OLLAMA_GPU_LAYERS=20      # Reduce GPU layers
export VLLM_GPU_MEMORY_UTILIZATION=0.7  # Reduce GPU memory
export LMSTUDIO_MAX_TOKENS=4096  # Reduce context size

# Use smaller models
ollama pull llama3.2:1b  # Smaller Ollama model
# Switch to lighter vLLM models

# Monitor memory usage
htop
# or
maria health
```

#### 4. Network Port Conflicts

**Problem**: "Port already in use"

**Solution**:

```bash
# Find processes using ports
lsof -i :11434  # Ollama default port
lsof -i :8000   # vLLM default port
lsof -i :1234   # LM Studio default port

# Kill conflicting processes
kill -9 <process_id>

# Use alternative ports
export OLLAMA_API_BASE=http://localhost:11435
export VLLM_API_BASE=http://localhost:8001/v1
export LMSTUDIO_API_BASE=http://localhost:1235/v1

# Restart services with new ports
maria setup-ollama --port 11435
```

#### 5. Local AI Performance Issues

**Problem**: "Local AI responses are slow"

**Solution**:

```bash
# Check system resources
maria status

# Optimize for performance
export OLLAMA_NUM_PARALLEL=1     # Reduce parallel requests
export VLLM_TENSOR_PARALLEL_SIZE=1  # Single GPU mode
export LMSTUDIO_GPU_LAYERS=-1    # Use all GPU layers

# Use performance-optimized models
ollama pull llama3.2:3b  # Faster than larger models
# Select high-performance models in LM Studio

# Monitor performance
maria health
/model --performance  # Check response times
```

### Getting Help with Local AI

```bash
# Local AI specific help
/help local

# Check local AI status
/health --local

# Test local AI connectivity
maria models --local-only

# Local AI configuration check
/config --local

# Reset local AI environment
./scripts/auto-start-llm.sh reset
```

## 💡 Tips & Best Practices

### 1. Effective Local AI Usage

**Recommended Local AI Workflow**:

```bash
# 1. Start with local AI health check
maria health

# 2. Use local AI for privacy-sensitive tasks
"analyze this confidential code using local AI"
"review security using offline models"
"generate API keys handling code locally"

# 3. Optimize model selection
# - llama3.2:3b (Ollama): Quick tasks, fast responses
# - qwen3-30b-a3b (LM Studio): Complex reasoning, high quality
# - DialoGPT-medium (vLLM): Dialogue and conversation

# 4. Monitor resource usage
/status  # Check memory and performance
```

### 2. Privacy-First Development

**Best Practices for Maximum Privacy**:

```bash
# Enable offline mode for sensitive projects
export OFFLINE_MODE=true
export DISABLE_CLOUD_PROVIDERS=true

# Use local AI commands
/code --local "sensitive function implementation"
/review --local --privacy "confidential code review"
/security-review --local "internal security audit"

# Verify no data transmission
/health --privacy  # Confirms local-only processing
```

### 3. Performance Optimization

**Local AI Performance Tips**:

- **Model Selection**: Use llama3.2:3b for speed, qwen3-30b-a3b for quality
- **Memory Management**: Allocate 8GB+ RAM for optimal performance
- **GPU Utilization**: Enable GPU acceleration for 3-5x speed improvement
- **Concurrent Usage**: Limit to 2-3 simultaneous local AI requests

### 4. Cost Optimization

**Maximize Local AI Value**:

```bash
# Calculate cost savings
/model --cost-analysis

# Typical savings with local AI:
# • GPT-5 equivalent: $2000+/month → $0
# • Claude Opus equivalent: $1500+/month → $0
# • Unlimited usage: No rate limits or quotas
# • Team deployment: Single setup cost

# Track usage and savings
/model --usage-stats
```

### 5. Team Collaboration with Local AI

**Sharing Local AI Setup**:

```bash
# Export local AI configuration
/export --local-config

# Share setup scripts
cp scripts/auto-start-llm.sh team-setup.sh
cp .env.local .env.local.template

# Team best practices:
# • Standardize on same models across team
# • Share local AI configurations
# • Use version control for local AI scripts
# • Document local AI troubleshooting steps
```

### 6. Security Best Practices with Local AI

**Maintain Security with Local AI**:

```bash
# Regular security scans with local AI
/security-review scan --local

# Privacy auditing
/security-review privacy --local

# Ensure complete local processing
/health --privacy-audit

# Local AI security benefits:
# • No data transmission to third parties
# • Complete audit trail locally
# • No vendor dependency for security analysis
# • Compliance with strictest data protection regulations
```

### 7. Hybrid Cloud + Local AI Strategy

**Best of Both Worlds**:

```bash
# Use local AI for:
# • Privacy-sensitive code analysis
# • Offline development
# • Cost-sensitive high-volume tasks
# • Compliance-required processing

# Use cloud AI for:
# • Latest model capabilities
# • Specialized tasks (vision, audio)
# • Extremely complex reasoning
# • When local resources are insufficient

# Switch dynamically:
"use local AI for this analysis"
"switch to cloud for this complex task"
"analyze privately using local models"
```

## 🎓 Learning Resources

### Getting Started with Local AI

1. **Start Simple**: Begin with `maria setup-ollama` for easiest local AI setup
2. **Explore Models**: Try different local models for various tasks
3. **Monitor Performance**: Use `/health` and `/status` to understand resource usage
4. **Practice Privacy**: Use local AI for sensitive development tasks
5. **Optimize Setup**: Tune memory and performance settings for your hardware

### Advanced Local AI Usage

Once comfortable with basics:

- Set up all three local AI providers for maximum flexibility
- Configure GPU acceleration for performance
- Implement team-wide local AI standards
- Integrate local AI into CI/CD pipelines
- Monitor cost savings and ROI

### Community Resources

- **Local AI Documentation**: Complete setup and optimization guides
- **Video Tutorials**: Step-by-step local AI configuration
- **Example Projects**: Sample implementations with local AI
- **Best Practices**: Industry-standard local AI patterns
- **User Forum**: Community discussions and local AI tips

---

## 🎉 Conclusion

MARIA Platform v1.3.0 provides the world's most comprehensive local AI development environment. With complete privacy, zero API costs, and enterprise-grade performance, MARIA enables truly autonomous AI-powered development.

**Key v1.3.0 Features**:

- **🏠 Complete Local AI Integration**: 3 providers, 7 local models, unlimited usage
- **🔒 Total Privacy**: Zero data transmission, complete confidentiality
- **💰 Zero Costs**: No API fees, unlimited local processing
- **⚡ High Performance**: Sub-second local inference
- **🧠 Cognitive Modes**: 50 thinking modes with local AI support
- **🌐 Universal Access**: Work anywhere, anytime, offline

**Start Your Local AI Journey**:

1. Install MARIA v1.3.0
2. Run `maria setup-ollama` for quick start
3. Experience privacy-first AI development
4. Scale to complete local AI environment
5. Save thousands in API costs while maintaining privacy

The future of AI development is local, private, and unlimited. Start with MARIA v1.3.0 today!

For additional support and resources: **support@bonginkan.ai**

_Copyright © 2025 Bonginkan Inc. All rights reserved._
