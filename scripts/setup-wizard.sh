#!/bin/bash

# MARIA Setup Wizard - First-time configuration
# Auto-detects capabilities and guides users through setup
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
SETUP_FILE="$CONFIG_DIR/setup.json"

# Create config directory if not exists
mkdir -p "$CONFIG_DIR"

# Function to print colored output
print_color() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to print header
print_header() {
    local title=$1
    print_color "$MAGENTA" "╔══════════════════════════════════════════════════════════════╗"
    print_color "$MAGENTA" "║$(printf "%62s" "")║"
    print_color "$MAGENTA" "║$(printf "%*s" $(((62+${#title})/2)) "$title")$(printf "%*s" $(((62-${#title})/2)) "")║"
    print_color "$MAGENTA" "║$(printf "%62s" "")║"
    print_color "$MAGENTA" "╚══════════════════════════════════════════════════════════════╝"
    echo ""
}

# Function to ask yes/no questions
ask_yes_no() {
    local question=$1
    local default=${2:-"y"}
    
    while true; do
        if [ "$default" = "y" ]; then
            print_color "$CYAN" "$question (Y/n): "
        else
            print_color "$CYAN" "$question (y/N): "
        fi
        
        read -r response
        response=${response:-$default}
        
        case $response in
            [Yy]|[Yy][Ee][Ss])
                return 0
                ;;
            [Nn]|[Nn][Oo])
                return 1
                ;;
            *)
                print_color "$RED" "Please answer yes (y) or no (n)."
                ;;
        esac
    done
}

# Function to get user input with default
get_input() {
    local prompt=$1
    local default=$2
    local response
    
    if [ -n "$default" ]; then
        print_color "$CYAN" "$prompt [$default]: "
    else
        print_color "$CYAN" "$prompt: "
    fi
    
    read -r response
    echo "${response:-$default}"
}

# Function to select from multiple options
select_option() {
    local prompt=$1
    shift
    local options=("$@")
    local choice
    
    print_color "$CYAN" "$prompt"
    echo ""
    
    for i in "${!options[@]}"; do
        print_color "$YELLOW" "  $((i+1))) ${options[$i]}"
    done
    
    echo ""
    while true; do
        print_color "$CYAN" "Enter your choice (1-${#options[@]}): "
        read -r choice
        
        if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#options[@]}" ]; then
            echo "${options[$((choice-1))]}"
            return 0
        else
            print_color "$RED" "Invalid choice. Please enter a number between 1 and ${#options[@]}."
        fi
    done
}

# Function to detect system capabilities
detect_capabilities() {
    local capabilities=()
    
    print_color "$BLUE" "🔍 Detecting system capabilities..."
    echo ""
    
    # Check for LM Studio
    if command -v lms >/dev/null 2>&1; then
        capabilities+=("lmstudio")
        print_color "$GREEN" "  ✅ LM Studio CLI detected"
    else
        print_color "$YELLOW" "  ⚠️  LM Studio CLI not found"
    fi
    
    # Check for Ollama
    if command -v ollama >/dev/null 2>&1; then
        capabilities+=("ollama")
        print_color "$GREEN" "  ✅ Ollama detected"
    else
        print_color "$YELLOW" "  ⚠️  Ollama not found"
    fi
    
    # Check for Python/vLLM environment
    if [ -d "$HOME/.maria/vllm/venv" ]; then
        capabilities+=("vllm")
        print_color "$GREEN" "  ✅ vLLM environment detected"
    else
        print_color "$YELLOW" "  ⚠️  vLLM environment not found"
    fi
    
    # Check GPU capabilities
    if command -v nvidia-smi >/dev/null 2>&1; then
        local gpu_memory
        gpu_memory=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | head -1)
        if [ -n "$gpu_memory" ] && [ "$gpu_memory" -gt 0 ]; then
            capabilities+=("gpu")
            print_color "$GREEN" "  ✅ NVIDIA GPU detected (${gpu_memory}MB VRAM)"
        fi
    elif system_profiler SPDisplaysDataType 2>/dev/null | grep -q "Metal"; then
        capabilities+=("metal")
        print_color "$GREEN" "  ✅ Metal GPU detected (Apple Silicon)"
    else
        print_color "$YELLOW" "  ⚠️  No GPU acceleration detected"
    fi
    
    # Check available RAM
    local ram_gb
    if command -v free >/dev/null 2>&1; then
        ram_gb=$(free -g | awk '/^Mem:/{print $2}')
    elif command -v vm_stat >/dev/null 2>&1; then
        local pages
        pages=$(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\.//')
        ram_gb=$((pages * 4096 / 1024 / 1024 / 1024))
    fi
    
    if [ -n "$ram_gb" ] && [ "$ram_gb" -gt 0 ]; then
        print_color "$GREEN" "  ✅ System RAM: ${ram_gb}GB"
        if [ "$ram_gb" -ge 32 ]; then
            capabilities+=("high-memory")
        fi
    fi
    
    echo ""
    echo "${capabilities[@]}"
}

# Function to configure language preferences
configure_language() {
    print_header "Language Configuration"
    
    local language
    language=$(select_option "Select your preferred language:" \
        "English (International)" \
        "日本語 (Japanese)" \
        "简体中文 (Simplified Chinese)" \
        "Auto-detect from system")
    
    case "$language" in
        "English (International)")
            echo "en"
            ;;
        "日本語 (Japanese)")
            echo "ja"
            ;;
        "简体中文 (Simplified Chinese)")
            echo "zh-CN"
            ;;
        "Auto-detect from system")
            echo "auto"
            ;;
    esac
}

# Function to configure priority mode
configure_priority() {
    print_header "AI Provider Priority Configuration"
    
    print_color "$BLUE" "Choose your preferred AI usage priority:"
    echo ""
    print_color "$YELLOW" "🔒 Privacy-First: Local models preferred, maximum data privacy"
    print_color "$YELLOW" "⚡ Performance: Fast inference, balanced accuracy and speed"
    print_color "$YELLOW" "💰 Cost-Effective: Free/low-cost options, budget-conscious"
    print_color "$YELLOW" "🤖 Auto: Intelligent selection based on task requirements"
    echo ""
    
    local priority
    priority=$(select_option "Select priority mode:" \
        "Privacy-First (Recommended)" \
        "Performance" \
        "Cost-Effective" \
        "Auto (Intelligent)")
    
    case "$priority" in
        "Privacy-First (Recommended)")
            echo "privacy-first"
            ;;
        "Performance")
            echo "performance"
            ;;
        "Cost-Effective")
            echo "cost-effective"
            ;;
        "Auto (Intelligent)")
            echo "auto"
            ;;
    esac
}

# Function to configure cloud API keys
configure_cloud_apis() {
    print_header "Cloud API Configuration (Optional)"
    
    print_color "$BLUE" "Configure cloud AI providers for enhanced capabilities:"
    echo ""
    
    local apis=()
    
    # OpenAI API
    if ask_yes_no "Configure OpenAI API? (GPT-4, GPT-4o)"; then
        local openai_key
        openai_key=$(get_input "Enter OpenAI API key" "")
        if [ -n "$openai_key" ]; then
            apis+=("openai:$openai_key")
            print_color "$GREEN" "✅ OpenAI API configured"
        fi
    fi
    
    # Anthropic API
    if ask_yes_no "Configure Anthropic API? (Claude 3)"; then
        local anthropic_key
        anthropic_key=$(get_input "Enter Anthropic API key" "")
        if [ -n "$anthropic_key" ]; then
            apis+=("anthropic:$anthropic_key")
            print_color "$GREEN" "✅ Anthropic API configured"
        fi
    fi
    
    # Google AI API
    if ask_yes_no "Configure Google AI API? (Gemini)"; then
        local google_key
        google_key=$(get_input "Enter Google AI API key" "")
        if [ -n "$google_key" ]; then
            apis+=("google:$google_key")
            print_color "$GREEN" "✅ Google AI API configured"
        fi
    fi
    
    # Groq API
    if ask_yes_no "Configure Groq API? (Ultra-fast inference)"; then
        local groq_key
        groq_key=$(get_input "Enter Groq API key" "")
        if [ -n "$groq_key" ]; then
            apis+=("groq:$groq_key")
            print_color "$GREEN" "✅ Groq API configured"
        fi
    fi
    
    echo "${apis[@]}"
}

# Function to configure local model downloads
configure_local_models() {
    print_header "Local Model Configuration"
    
    local capabilities=($1)
    local models=()
    
    print_color "$BLUE" "Configure local AI models for offline usage:"
    echo ""
    
    if [[ " ${capabilities[@]} " =~ " ollama " ]]; then
        print_color "$CYAN" "Ollama Models Available:"
        
        if ask_yes_no "Download Qwen2.5-VL (7B) for vision tasks? (~4GB)"; then
            models+=("ollama:qwen2.5-vl:7b")
        fi
        
        if ask_yes_no "Download Llama 3.2 (3B) for general tasks? (~2GB)"; then
            models+=("ollama:llama3.2:3b")
        fi
        
        if [[ " ${capabilities[@]} " =~ " high-memory " ]]; then
            if ask_yes_no "Download Qwen2.5 (32B) for advanced reasoning? (~20GB)"; then
                models+=("ollama:qwen2.5:32b")
            fi
        fi
    fi
    
    if [[ " ${capabilities[@]} " =~ " lmstudio " ]]; then
        print_color "$CYAN" "LM Studio Models:"
        print_color "$YELLOW" "Note: Models should be downloaded through LM Studio interface"
        
        if ask_yes_no "Configure GPT-OSS 20B for balanced performance?"; then
            models+=("lmstudio:gpt-oss-20b")
        fi
        
        if [[ " ${capabilities[@]} " =~ " high-memory " ]]; then
            if ask_yes_no "Configure GPT-OSS 120B for maximum accuracy?"; then
                models+=("lmstudio:gpt-oss-120b")
            fi
        fi
    fi
    
    echo "${models[@]}"
}

# Function to create environment file
create_env_file() {
    local priority=$1
    local apis=($2)
    local models=($3)
    local language=$4
    
    print_color "$BLUE" "📝 Creating configuration files..."
    
    # Create .env.local
    cat > "$ENV_FILE" <<EOF
# MARIA Configuration
# Generated by Setup Wizard on $(date)

# Priority Mode
MARIA_PRIORITY=$priority

# Language Configuration
MARIA_LANGUAGE=$language

# Local LLM Configuration
LMSTUDIO_ENABLED=true
LMSTUDIO_API_BASE=http://localhost:1234

VLLM_ENABLED=true
VLLM_API_BASE=http://localhost:8000

OLLAMA_ENABLED=true
OLLAMA_API_BASE=http://localhost:11434

# Cloud API Keys
EOF
    
    # Add API keys
    for api in "${apis[@]}"; do
        local provider="${api%%:*}"
        local key="${api#*:}"
        
        case "$provider" in
            "openai")
                echo "OPENAI_API_KEY=$key" >> "$ENV_FILE"
                ;;
            "anthropic")
                echo "ANTHROPIC_API_KEY=$key" >> "$ENV_FILE"
                ;;
            "google")
                echo "GOOGLE_API_KEY=$key" >> "$ENV_FILE"
                echo "GEMINI_API_KEY=$key" >> "$ENV_FILE"
                ;;
            "groq")
                echo "GROQ_API_KEY=$key" >> "$ENV_FILE"
                ;;
        esac
    done
    
    # Add feature flags
    cat >> "$ENV_FILE" <<EOF

# Feature Flags
CONTEXT_WINDOW_MANAGEMENT=true
AUTO_MODEL_SWITCHING=true
INTELLIGENT_ROUTING=true
HEALTH_MONITORING=true

# Zero Configuration
ZERO_CONFIG_MODE=true
AUTO_START_LLMS=true

# Advanced Features
VIDEO_GENERATION_ENABLED=false
IMAGE_GENERATION_ENABLED=false
EOF
}

# Function to create setup configuration
create_setup_config() {
    local priority=$1
    local capabilities=($2)
    local models=($3)
    local language=$4
    
    cat > "$SETUP_FILE" <<EOF
{
  "version": "1.0.0",
  "setup_date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "setup_completed": true,
  "language": "$language",
  "priority_mode": "$priority",
  "capabilities": [$(printf '"%s",' "${capabilities[@]}" | sed 's/,$//')],
  "configured_models": [$(printf '"%s",' "${models[@]}" | sed 's/,$//')],
  "auto_start": {
    "enabled": true,
    "priority_order": $(case "$priority" in
      "privacy-first") echo '["lmstudio", "vllm", "ollama", "cloud"]' ;;
      "performance") echo '["ollama", "groq", "lmstudio", "vllm"]' ;;
      "cost-effective") echo '["ollama", "google", "vllm", "lmstudio"]' ;;
      "auto") echo '["lmstudio", "ollama", "vllm", "cloud"]' ;;
    esac)
  },
  "health_monitoring": {
    "enabled": true,
    "check_interval": 300
  }
}
EOF
}

# Function to download selected models
download_models() {
    local models=($1)
    
    if [ ${#models[@]} -eq 0 ]; then
        return 0
    fi
    
    print_header "Model Download"
    
    print_color "$BLUE" "📦 Downloading selected models..."
    echo ""
    
    for model in "${models[@]}"; do
        local provider="${model%%:*}"
        local model_name="${model#*:}"
        
        case "$provider" in
            "ollama")
                if command -v ollama >/dev/null 2>&1; then
                    print_color "$YELLOW" "Downloading $model_name..."
                    if ollama pull "$model_name"; then
                        print_color "$GREEN" "✅ Downloaded $model_name"
                    else
                        print_color "$RED" "❌ Failed to download $model_name"
                    fi
                fi
                ;;
            "lmstudio")
                print_color "$BLUE" "ℹ️  Please download $model_name through LM Studio interface"
                ;;
        esac
        echo ""
    done
}

# Function to run initial tests
run_initial_tests() {
    print_header "Initial System Test"
    
    print_color "$BLUE" "🧪 Running initial system tests..."
    echo ""
    
    # Test auto-start script
    if bash "$SCRIPT_DIR/auto-start-llm.sh" status >/dev/null 2>&1; then
        print_color "$GREEN" "✅ Auto-start system working"
    else
        print_color "$YELLOW" "⚠️  Auto-start system needs attention"
    fi
    
    # Test basic functionality
    if [ -f "$ENV_FILE" ]; then
        print_color "$GREEN" "✅ Environment configuration created"
    else
        print_color "$RED" "❌ Environment configuration missing"
    fi
    
    if [ -f "$SETUP_FILE" ]; then
        print_color "$GREEN" "✅ Setup configuration saved"
    else
        print_color "$RED" "❌ Setup configuration missing"
    fi
    
    echo ""
}

# Main setup function
main() {
    print_header "MARIA Setup Wizard"
    
    print_color "$CYAN" "Welcome to MARIA - Your Intelligent CLI Assistant!"
    print_color "$CYAN" "This wizard will help you configure MARIA for optimal performance."
    echo ""
    
    if [ -f "$SETUP_FILE" ] && ask_yes_no "Setup already completed. Run again?" "n"; then
        rm -f "$SETUP_FILE"
    elif [ -f "$SETUP_FILE" ]; then
        print_color "$GREEN" "Setup already completed. Run 'maria' to start using MARIA!"
        exit 0
    fi
    
    # Step 1: Detect capabilities
    local capabilities
    capabilities=$(detect_capabilities)
    
    # Step 2: Configure language
    local language
    language=$(configure_language)
    
    # Step 3: Configure priority
    local priority
    priority=$(configure_priority)
    
    # Step 4: Configure cloud APIs
    local apis
    apis=$(configure_cloud_apis)
    
    # Step 5: Configure local models
    local models
    models=$(configure_local_models "$capabilities")
    
    # Step 6: Create configuration files
    create_env_file "$priority" "$apis" "$models" "$language"
    create_setup_config "$priority" "$capabilities" "$models" "$language"
    
    # Step 7: Download models
    download_models "$models"
    
    # Step 8: Run tests
    run_initial_tests
    
    # Final message
    print_header "Setup Complete!"
    
    print_color "$GREEN" "🎉 MARIA has been successfully configured!"
    echo ""
    print_color "$CYAN" "Next steps:"
    print_color "$YELLOW" "  1. Run 'maria' to start your AI assistant"
    print_color "$YELLOW" "  2. Try '/help' to see available commands"
    print_color "$YELLOW" "  3. Use '/status' to check system health"
    echo ""
    print_color "$BLUE" "Configuration saved to:"
    print_color "$BLUE" "  📄 $ENV_FILE"
    print_color "$BLUE" "  📄 $SETUP_FILE"
    echo ""
    
    if ask_yes_no "Start MARIA now?" "y"; then
        print_color "$CYAN" "Starting MARIA..."
        cd "$PROJECT_ROOT"
        exec pnpm dev:cli
    fi
}

# Run main function
main "$@"