#!/bin/bash

# MARIA Auto-Start LLM Script
# Automatically detects and starts the best available LLM
# Created: 2025-08-10

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
ENV_FILE="$PROJECT_ROOT/.env.local"
CONFIG_DIR="$HOME/.maria"
CONFIG_FILE="$CONFIG_DIR/config.json"
LOG_FILE="$CONFIG_DIR/startup.log"

# Create config directory if not exists
mkdir -p "$CONFIG_DIR"

# Function to print colored output
print_color() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $message" >> "$LOG_FILE"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a port is open
port_is_open() {
    local port=$1
    nc -z localhost "$port" 2>/dev/null
}

# Function to wait for port
wait_for_port() {
    local port=$1
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if port_is_open "$port"; then
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    return 1
}

# Function to check LM Studio availability
check_lmstudio() {
    if command_exists lms; then
        if lms server status 2>/dev/null | grep -q "running"; then
            print_color "$GREEN" "✅ LM Studio server is already running"
            return 0
        else
            return 1
        fi
    fi
    return 1
}

# Function to start LM Studio
start_lmstudio() {
    if ! command_exists lms; then
        print_color "$YELLOW" "⚠️  LM Studio CLI not found"
        return 1
    fi
    
    print_color "$BLUE" "🚀 Starting LM Studio..."
    
    # Start server
    lms server start >/dev/null 2>&1 &
    
    # Wait for server to start
    if wait_for_port 1234; then
        print_color "$GREEN" "✅ LM Studio server started"
        
        # Try to load a model
        if lms ls 2>/dev/null | grep -q "gpt-oss-20b"; then
            print_color "$BLUE" "📦 Loading GPT-OSS 20B..."
            lms load gpt-oss-20b --gpu 0.3 --context-length 8192 >/dev/null 2>&1
            print_color "$GREEN" "✅ GPT-OSS 20B loaded"
            return 0
        elif lms ls 2>/dev/null | grep -q "gpt-oss-120b"; then
            print_color "$BLUE" "📦 Loading GPT-OSS 120B..."
            lms load gpt-oss-120b --gpu max --context-length 128000 >/dev/null 2>&1
            print_color "$GREEN" "✅ GPT-OSS 120B loaded"
            return 0
        else
            print_color "$YELLOW" "⚠️  No models found in LM Studio"
            return 1
        fi
    else
        print_color "$RED" "❌ Failed to start LM Studio server"
        return 1
    fi
}

# Function to check vLLM availability
check_vllm() {
    if port_is_open 8000; then
        if curl -s "http://localhost:8000/v1/models" >/dev/null 2>&1; then
            print_color "$GREEN" "✅ vLLM server is already running"
            return 0
        fi
    fi
    return 1
}

# Function to start vLLM
start_vllm() {
    local venv_dir="$HOME/.maria/vllm/venv"
    
    if [ ! -d "$venv_dir" ]; then
        print_color "$YELLOW" "⚠️  vLLM environment not found"
        return 1
    fi
    
    print_color "$BLUE" "🚀 Starting vLLM..."
    
    # Activate virtual environment and start server
    (
        source "$venv_dir/bin/activate"
        
        # Check for Japanese model
        if [ -d "$HOME/.maria/vllm/models" ]; then
            nohup python -m vllm.entrypoints.openai.api_server \
                --model stabilityai/japanese-stablelm-2-instruct-1_6b \
                --host 0.0.0.0 \
                --port 8000 \
                --download-dir "$HOME/.maria/vllm/models" \
                --gpu-memory-utilization 0.5 \
                --max-model-len 4096 \
                --trust-remote-code \
                > "$CONFIG_DIR/vllm.log" 2>&1 &
            
            echo $! > "$CONFIG_DIR/vllm.pid"
        fi
    ) 2>/dev/null
    
    # Wait for server to start
    if wait_for_port 8000; then
        print_color "$GREEN" "✅ vLLM server started"
        return 0
    else
        print_color "$RED" "❌ Failed to start vLLM server"
        return 1
    fi
}

# Function to check Ollama availability
check_ollama() {
    if command_exists ollama; then
        if ollama list 2>/dev/null | grep -q "qwen"; then
            print_color "$GREEN" "✅ Ollama with Qwen models is ready"
            return 0
        else
            return 1
        fi
    fi
    return 1
}

# Function to start Ollama
start_ollama() {
    if ! command_exists ollama; then
        print_color "$YELLOW" "⚠️  Ollama not found"
        return 1
    fi
    
    print_color "$BLUE" "🚀 Starting Ollama..."
    
    # Start Ollama daemon if not running
    if ! pgrep -f "ollama serve" >/dev/null 2>&1; then
        ollama serve > "$CONFIG_DIR/ollama.log" 2>&1 &
        echo $! > "$CONFIG_DIR/ollama.pid"
        sleep 3
    fi
    
    # Check if Qwen models are available
    if ! ollama list 2>/dev/null | grep -q "qwen"; then
        print_color "$BLUE" "📦 Pulling Qwen2.5-VL model..."
        ollama pull qwen2.5-vl:7b >/dev/null 2>&1 &
        print_color "$GREEN" "✅ Qwen2.5-VL model is being downloaded"
    fi
    
    # Verify server is running
    if wait_for_port 11434; then
        print_color "$GREEN" "✅ Ollama server started"
        return 0
    else
        print_color "$RED" "❌ Failed to start Ollama server"
        return 1
    fi
}

# Function to check API availability
check_api() {
    local provider=$1
    
    case $provider in
        gemini)
            if [ -n "$GEMINI_API_KEY" ] && [ "$GEMINI_API_KEY" != "your-gemini-api-key-here" ]; then
                # Simple API test
                if curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY" >/dev/null 2>&1; then
                    print_color "$GREEN" "✅ Gemini API available"
                    return 0
                fi
            fi
            ;;
        grok)
            if [ -n "$GROK_API_KEY" ] && [ "$GROK_API_KEY" != "xai-your-grok-api-key-here" ]; then
                print_color "$GREEN" "✅ Grok API configured"
                return 0
            fi
            ;;
        groq)
            if [ -n "$GROQ_API_KEY" ] && [ "$GROQ_API_KEY" != "gsk_your-groq-api-key-here" ]; then
                print_color "$GREEN" "✅ Groq API configured"
                return 0
            fi
            ;;
    esac
    return 1
}

# Function to update environment variables
update_env() {
    local key=$1
    local value=$2
    
    if [ -f "$ENV_FILE" ]; then
        if grep -q "^$key=" "$ENV_FILE"; then
            # Update existing
            sed -i.bak "s|^$key=.*|$key=$value|" "$ENV_FILE"
        else
            # Add new
            echo "$key=$value" >> "$ENV_FILE"
        fi
    fi
}

# Function to select best provider with intelligent priority system
select_best_provider() {
    local available_providers=()
    local priority_mode="${MARIA_PRIORITY:-privacy-first}"  # privacy-first, performance, cost-effective
    
    print_color "$BLUE" "🎯 Priority mode: $priority_mode"
    
    # Priority 1: Privacy-first (Local LLMs, highest accuracy)
    if [ "$priority_mode" = "privacy-first" ] || [ "$priority_mode" = "auto" ]; then
        # Check LM Studio (120B/20B models - highest accuracy)
        if check_lmstudio; then
            available_providers+=("lmstudio")
            update_env "AI_PROVIDER" "lmstudio"
            update_env "LMSTUDIO_ENABLED" "true"
            print_color "$CYAN" "🤖 Selected provider: LM Studio (Privacy-First, High Accuracy)"
            return 0
        fi
        
        # Try to start LM Studio
        if start_lmstudio; then
            available_providers+=("lmstudio")
            update_env "AI_PROVIDER" "lmstudio"
            update_env "LMSTUDIO_ENABLED" "true"
            print_color "$CYAN" "🤖 Selected provider: LM Studio (Privacy-First, Started)"
            return 0
        fi
        
        # vLLM as secondary privacy option
        if check_vllm; then
            available_providers+=("vllm")
            update_env "AI_PROVIDER" "vllm"
            update_env "VLLM_ENABLED" "true"
            print_color "$CYAN" "🤖 Selected provider: vLLM (Privacy-First, Fast Japanese)"
            return 0
        fi
        
        if start_vllm; then
            available_providers+=("vllm")
            update_env "AI_PROVIDER" "vllm"
            update_env "VLLM_ENABLED" "true"
            print_color "$CYAN" "🤖 Selected provider: vLLM (Privacy-First, Started)"
            return 0
        fi
    fi
    
    # Priority 2: Performance (Fast inference, balanced accuracy)
    if [ "$priority_mode" = "performance" ] || [ "$priority_mode" = "auto" ]; then
        # Ollama for vision tasks and balanced performance
        if check_ollama; then
            available_providers+=("ollama")
            update_env "AI_PROVIDER" "ollama"
            update_env "OLLAMA_ENABLED" "true"
            print_color "$CYAN" "🤖 Selected provider: Ollama (Performance, Vision)"
            return 0
        fi
        
        if start_ollama; then
            available_providers+=("ollama")
            update_env "AI_PROVIDER" "ollama"
            update_env "OLLAMA_ENABLED" "true"
            print_color "$CYAN" "🤖 Selected provider: Ollama (Performance, Started)"
            return 0
        fi
        
        # Groq for ultra-fast cloud inference
        if check_api "groq"; then
            available_providers+=("groq")
            update_env "AI_PROVIDER" "groq"
            print_color "$CYAN" "🤖 Selected provider: Groq (Performance, Ultra-Fast)"
            return 0
        fi
    fi
    
    # Priority 3: Cost-effective (Free/low-cost options)
    if [ "$priority_mode" = "cost-effective" ] || [ "$priority_mode" = "auto" ]; then
        # Gemini Flash (free tier)
        if check_api "gemini"; then
            available_providers+=("gemini")
            update_env "AI_PROVIDER" "google"
            print_color "$CYAN" "🤖 Selected provider: Gemini (Cost-Effective, Free Tier)"
            return 0
        fi
        
        # Any available local (always free)
        if check_ollama; then
            available_providers+=("ollama")
            update_env "AI_PROVIDER" "ollama"
            update_env "OLLAMA_ENABLED" "true"
            print_color "$CYAN" "🤖 Selected provider: Ollama (Cost-Effective, Local)"
            return 0
        fi
        
        if start_ollama; then
            available_providers+=("ollama")
            update_env "AI_PROVIDER" "ollama"
            update_env "OLLAMA_ENABLED" "true"
            print_color "$CYAN" "🤖 Selected provider: Ollama (Cost-Effective, Started)"
            return 0
        fi
    fi
    
    # Fallback: Try any available provider
    print_color "$YELLOW" "⚠️  Trying fallback providers..."
    
    if check_api "gemini"; then
        available_providers+=("gemini")
        update_env "AI_PROVIDER" "google"
        print_color "$CYAN" "🤖 Selected provider: Gemini (Fallback)"
        return 0
    fi
    
    if check_api "groq"; then
        available_providers+=("groq")
        update_env "AI_PROVIDER" "groq"
        print_color "$CYAN" "🤖 Selected provider: Groq (Fallback)"
        return 0
    fi
    
    if check_api "grok"; then
        available_providers+=("grok")
        update_env "AI_PROVIDER" "grok"
        print_color "$CYAN" "🤖 Selected provider: Grok (Fallback)"
        return 0
    fi
    
    # No providers available
    print_color "$RED" "❌ No LLM providers available"
    return 1
}

# Function to save configuration
save_config() {
    local provider=$1
    local model=$2
    
    cat > "$CONFIG_FILE" <<EOF
{
  "version": "1.0.0",
  "last_startup": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "selected_provider": "$provider",
  "selected_model": "$model",
  "auto_start": {
    "lmstudio": true,
    "vllm": true
  },
  "providers": {
    "lmstudio": {
      "enabled": $(check_lmstudio && echo "true" || echo "false"),
      "port": 1234
    },
    "vllm": {
      "enabled": $(check_vllm && echo "true" || echo "false"),
      "port": 8000
    }
  }
}
EOF
}

# Function to show status
show_status() {
    print_color "$MAGENTA" "╔══════════════════════════════════════╗"
    print_color "$MAGENTA" "║       MARIA LLM Status Report        ║"
    print_color "$MAGENTA" "╚══════════════════════════════════════╝"
    echo ""
    
    # Local LLMs
    print_color "$BLUE" "📊 Local LLMs:"
    if check_lmstudio; then
        print_color "$GREEN" "  ✅ LM Studio: Running (port 1234)"
    else
        print_color "$YELLOW" "  ⚠️  LM Studio: Not running"
    fi
    
    if check_vllm; then
        print_color "$GREEN" "  ✅ vLLM: Running (port 8000)"
    else
        print_color "$YELLOW" "  ⚠️  vLLM: Not running"
    fi
    
    if check_ollama; then
        print_color "$GREEN" "  ✅ Ollama: Running (port 11434)"
    else
        print_color "$YELLOW" "  ⚠️  Ollama: Not running"
    fi
    
    echo ""
    
    # Cloud APIs
    print_color "$BLUE" "☁️  Cloud APIs:"
    if check_api "gemini"; then
        print_color "$GREEN" "  ✅ Gemini: Available"
    else
        print_color "$YELLOW" "  ⚠️  Gemini: Not configured"
    fi
    
    if check_api "grok"; then
        print_color "$GREEN" "  ✅ Grok: Available"
    else
        print_color "$YELLOW" "  ⚠️  Grok: Not configured"
    fi
    
    echo ""
}

# Main execution
main() {
    print_color "$CYAN" "⚡ MARIA Auto-Start LLM Manager"
    print_color "$CYAN" "================================"
    echo ""
    
    # Load environment variables
    if [ -f "$ENV_FILE" ]; then
        export $(grep -v '^#' "$ENV_FILE" | xargs)
    else
        print_color "$YELLOW" "⚠️  No .env.local file found"
    fi
    
    # Check and select best provider
    if select_best_provider; then
        print_color "$GREEN" "✅ LLM provider ready!"
        
        # Save configuration
        save_config "$AI_PROVIDER" "$AI_MODEL"
        
        # Show final status
        echo ""
        show_status
        
        print_color "$GREEN" "🎉 MARIA is ready to use!"
        exit 0
    else
        print_color "$RED" "❌ Failed to initialize any LLM provider"
        print_color "$YELLOW" "Please run the setup wizard:"
        print_color "$CYAN" "  ./scripts/setup-wizard.sh"
        exit 1
    fi
}

# Handle script arguments
case "${1:-}" in
    status)
        show_status
        ;;
    start-lmstudio)
        start_lmstudio
        ;;
    start-vllm)
        start_vllm
        ;;
    start-ollama)
        start_ollama
        ;;
    stop)
        # Stop all services
        if [ -f "$CONFIG_DIR/vllm.pid" ]; then
            kill $(cat "$CONFIG_DIR/vllm.pid") 2>/dev/null || true
            rm "$CONFIG_DIR/vllm.pid"
        fi
        if [ -f "$CONFIG_DIR/ollama.pid" ]; then
            kill $(cat "$CONFIG_DIR/ollama.pid") 2>/dev/null || true
            rm "$CONFIG_DIR/ollama.pid"
        fi
        lms server stop 2>/dev/null || true
        pkill -f "ollama serve" 2>/dev/null || true
        print_color "$GREEN" "✅ All services stopped"
        ;;
    *)
        main
        ;;
esac