# 📋 MARIA Platform Command Reference

Complete reference for all 36+ interactive slash commands in MARIA Platform v1.6.4

## 🚀 How to Use Commands

All commands in MARIA are **slash commands** used within interactive mode:

```bash
# Start MARIA interactive mode
maria

# Use slash commands within MARIA
> /command_name [options]
```

## 🎓 Algorithm Education Commands

### Sorting Algorithms

| Command               | Description                         | Options                      | Example                        |
| --------------------- | ----------------------------------- | ---------------------------- | ------------------------------ |
| `/sort quicksort`     | Interactive quicksort tutorial      | `--visualize`, `--benchmark` | `/sort quicksort --visualize`  |
| `/sort mergesort`     | Interactive merge sort tutorial     | `--visualize`, `--benchmark` | `/sort mergesort --benchmark`  |
| `/sort heapsort`      | Interactive heap sort tutorial      | `--visualize`, `--benchmark` | `/sort heapsort`               |
| `/sort bubblesort`    | Interactive bubble sort tutorial    | `--visualize`                | `/sort bubblesort --visualize` |
| `/sort insertionsort` | Interactive insertion sort tutorial | `--visualize`                | `/sort insertionsort`          |

### Learning & Analysis

| Command                 | Description              | Options                          | Example                                       |
| ----------------------- | ------------------------ | -------------------------------- | --------------------------------------------- |
| `/learn algorithms`     | Complete CS curriculum   | `--topic [name]`                 | `/learn algorithms --topic sorting`           |
| `/algorithm complexity` | Big O notation tutorials | `--algorithm [name]`             | `/algorithm complexity --algorithm quicksort` |
| `/benchmark sorting`    | Performance analysis     | `--size [n]`, `--iterations [n]` | `/benchmark sorting --size 10000`             |
| `/analyze performance`  | Memory and time analysis | `--algorithm [name]`             | `/analyze performance --algorithm mergesort`  |

## 🤖 AI Development Commands

### Code Generation

| Command                | Description                 | Options                                 | Example                                      |
| ---------------------- | --------------------------- | --------------------------------------- | -------------------------------------------- |
| `/code "description"`  | AI code generation          | `--language [lang]`, `--style [style]`  | `/code "REST API" --language python`         |
| `/generate function`   | Generate specific functions | `--type [type]`, `--complexity [level]` | `/generate function --type sorting`          |
| `/implement algorithm` | Implement algorithms        | `--language [lang]`, `--optimize`       | `/implement algorithm --language typescript` |
| `/refactor code`       | Refactor existing code      | `--style [style]`, `--optimize`         | `/refactor code --optimize`                  |

### Code Quality & Analysis

| Command                | Description                 | Options                               | Example                              |
| ---------------------- | --------------------------- | ------------------------------------- | ------------------------------------ |
| `/bug analyze`         | Bug detection and fixes     | `--file [path]`, `--severity [level]` | `/bug analyze --file src/app.js`     |
| `/lint check`          | Code quality analysis       | `--fix`, `--rules [ruleset]`          | `/lint check --fix`                  |
| `/security review`     | Security vulnerability scan | `--level [level]`                     | `/security review --level strict`    |
| `/performance profile` | Performance profiling       | `--type [type]`                       | `/performance profile --type memory` |

## 🧠 AI Model & Mode Commands

### Model Management

| Command         | Description              | Options                                 | Example                            |
| --------------- | ------------------------ | --------------------------------------- | ---------------------------------- |
| `/model`        | AI model selection       | `--provider [name]`, `--list`           | `/model --provider openai`         |
| `/model list`   | Show available models    | `--provider [name]`                     | `/model list --provider anthropic` |
| `/model switch` | Switch AI model          | `--to [model_name]`                     | `/model switch --to gpt-4`         |
| `/model config` | Configure model settings | `--temperature [n]`, `--max-tokens [n]` | `/model config --temperature 0.7`  |

### Cognitive Modes

| Command          | Description                  | Options                   | Example                           |
| ---------------- | ---------------------------- | ------------------------- | --------------------------------- |
| `/mode internal` | Access 50 cognitive AI modes | `--list`, `--mode [name]` | `/mode internal --mode debugging` |
| `/mode list`     | List all cognitive modes     | `--category [type]`       | `/mode list --category creative`  |
| `/mode switch`   | Switch cognitive mode        | `--to [mode_name]`        | `/mode switch --to optimizing`    |
| `/thinking mode` | Enter thinking mode          | `--depth [level]`         | `/thinking mode --depth deep`     |

## 🔧 System & Utility Commands

### System Management

| Command   | Description              | Options                            | Example                    |
| --------- | ------------------------ | ---------------------------------- | -------------------------- |
| `/status` | System status and health | `--detailed`, `--services`         | `/status --detailed`       |
| `/config` | Configuration management | `--set [key=value]`, `--get [key]` | `/config --set theme=dark` |
| `/update` | Check for updates        | `--install`, `--check`             | `/update --check`          |
| `/reset`  | Reset MARIA settings     | `--confirm`, `--keep-models`       | `/reset --keep-models`     |

### Help & Information

| Command     | Description           | Options                                | Example                        |
| ----------- | --------------------- | -------------------------------------- | ------------------------------ |
| `/help`     | Show all commands     | `--category [name]`, `--search [term]` | `/help --category algorithm`   |
| `/docs`     | Access documentation  | `--topic [name]`, `--search [term]`    | `/docs --topic quicksort`      |
| `/examples` | Show command examples | `--command [name]`                     | `/examples --command sort`     |
| `/tutorial` | Interactive tutorials | `--topic [name]`, `--level [level]`    | `/tutorial --topic algorithms` |

### Session Management

| Command         | Description          | Options                      | Example                        |
| --------------- | -------------------- | ---------------------------- | ------------------------------ |
| `/history`      | Command history      | `--search [term]`, `--clear` | `/history --search sort`       |
| `/save session` | Save current session | `--name [name]`              | `/save session --name my_work` |
| `/load session` | Load saved session   | `--name [name]`, `--list`    | `/load session --name my_work` |
| `/clear`        | Clear screen         | `--history`, `--all`         | `/clear --history`             |
| `/exit`         | Exit MARIA           | `--save`, `--force`          | `/exit --save`                 |

## 🚀 Advanced Features

### Multi-Agent Commands

| Command         | Description              | Options                | Example                                   |
| --------------- | ------------------------ | ---------------------- | ----------------------------------------- |
| `/agent create` | Create autonomous agent  | `--task [description]` | `/agent create --task "build API"`        |
| `/agent list`   | List active agents       | `--status [status]`    | `/agent list --status active`             |
| `/agent stop`   | Stop agent execution     | `--id [agent_id]`      | `/agent stop --id agent_123`              |
| `/orchestrate`  | Multi-agent coordination | `--agents [list]`      | `/orchestrate --agents "dev,test,deploy"` |

### Integration Commands

| Command            | Description            | Options                            | Example                         |
| ------------------ | ---------------------- | ---------------------------------- | ------------------------------- |
| `/git integrate`   | Git integration        | `--status`, `--commit [message]`   | `/git integrate --status`       |
| `/project analyze` | Project analysis       | `--deep`, `--report`               | `/project analyze --deep`       |
| `/export results`  | Export session results | `--format [type]`, `--file [path]` | `/export results --format json` |

## 💡 Usage Tips

### Command Shortcuts

- Use **Tab completion** for command names and options
- **Up/Down arrows** to navigate command history
- **Ctrl+C** to cancel current operation
- **Ctrl+L** to clear screen (same as `/clear`)

### Option Patterns

- `--help` works with any command for detailed help
- `--verbose` or `-v` for detailed output
- `--quiet` or `-q` for minimal output
- `--dry-run` to preview actions without executing

### Combining Commands

```bash
# Chain operations
> /sort quicksort --visualize && /benchmark sorting

# Use command output
> /model list --provider openai | /config --set preferred-model

# Save and reuse
> /save session --name algo_learning
> /tutorial --topic sorting && /save session --name algo_complete
```

## 🔍 Command Categories

### 🎓 Education (8 commands)

`/sort`, `/learn`, `/algorithm`, `/benchmark`, `/analyze`, `/tutorial`, `/examples`, `/docs`

### 🤖 AI Development (10 commands)

`/code`, `/generate`, `/implement`, `/refactor`, `/model`, `/mode`, `/thinking`, `/bug`, `/lint`, `/security`

### 🔧 System (8 commands)

`/status`, `/config`, `/update`, `/reset`, `/help`, `/history`, `/clear`, `/exit`

### 🚀 Advanced (6 commands)

`/agent`, `/orchestrate`, `/git`, `/project`, `/export`, `/performance`

### 💾 Session (4 commands)

`/save`, `/load`, `/history`, `/clear`

## 🆘 Getting Help

```bash
# General help
> /help

# Help for specific command
> /sort --help
> /model --help

# Search help
> /help --search "algorithm"

# Show examples
> /examples --command code
```

**Total Commands: 36+ interactive slash commands for complete AI-powered development and algorithm education experience!**
