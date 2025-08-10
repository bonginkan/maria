#!/bin/bash

# MARIA Health Monitor - Real-time system health monitoring
# Monitors AI providers, system resources, and performance
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
CONFIG_DIR="$HOME/.maria"
HEALTH_FILE="$CONFIG_DIR/health.json"
LOG_FILE="$CONFIG_DIR/health.log"

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
    local host="${2:-localhost}"
    nc -z "$host" "$port" 2>/dev/null
}

# Function to get response time
get_response_time() {
    local url=$1
    local timeout=${2:-5}
    
    if command_exists curl; then
        curl -o /dev/null -s -w "%{time_total}" -m "$timeout" "$url" 2>/dev/null || echo "timeout"
    else
        echo "unavailable"
    fi
}

# Function to check system resources
check_system_resources() {
    local cpu_usage memory_usage disk_usage gpu_usage
    
    # CPU usage
    if command_exists top; then
        cpu_usage=$(top -l 1 -n 0 | grep "CPU usage" | awk '{print $3}' | sed 's/%//' 2>/dev/null || echo "0")
    elif command_exists ps; then
        cpu_usage=$(ps -A -o %cpu | awk '{s+=$1} END {print s}' 2>/dev/null || echo "0")
    else
        cpu_usage="unknown"
    fi
    
    # Memory usage
    if command_exists vm_stat; then
        # macOS
        local pages_free pages_total
        pages_free=$(vm_stat | grep "Pages free:" | awk '{print $3}' | sed 's/\.//')
        pages_total=$(vm_stat | grep -E "(Pages free|Pages active|Pages inactive|Pages speculative|Pages wired)" | awk '{print $3}' | sed 's/\.//' | awk '{s+=$1} END {print s}')
        if [ -n "$pages_free" ] && [ -n "$pages_total" ] && [ "$pages_total" -gt 0 ]; then
            memory_usage=$(( (pages_total - pages_free) * 100 / pages_total ))
        else
            memory_usage="unknown"
        fi
    elif command_exists free; then
        # Linux
        memory_usage=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100.0)}')
    else
        memory_usage="unknown"
    fi
    
    # Disk usage
    if command_exists df; then
        disk_usage=$(df -h "$HOME" 2>/dev/null | tail -1 | awk '{print $5}' | sed 's/%//' || echo "unknown")
    else
        disk_usage="unknown"
    fi
    
    # GPU usage (if available)
    if command_exists nvidia-smi; then
        gpu_usage=$(nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>/dev/null | head -1 || echo "0")
    else
        gpu_usage="n/a"
    fi
    
    echo "$cpu_usage,$memory_usage,$disk_usage,$gpu_usage"
}

# Function to check LM Studio health
check_lmstudio_health() {
    local status="down"
    local response_time="n/a"
    local model_loaded="none"
    local memory_usage="unknown"
    
    if port_is_open 1234; then
        status="running"
        response_time=$(get_response_time "http://localhost:1234/v1/models" 3)
        
        # Check loaded model
        if command_exists curl; then
            local models_response
            models_response=$(curl -s -m 5 "http://localhost:1234/v1/models" 2>/dev/null || echo "")
            if echo "$models_response" | grep -q '"id"'; then
                model_loaded=$(echo "$models_response" | grep '"id"' | head -1 | sed 's/.*"id": *"\([^"]*\)".*/\1/')
            fi
        fi
    fi
    
    echo "$status,$response_time,$model_loaded,$memory_usage"
}

# Function to check vLLM health
check_vllm_health() {
    local status="down"
    local response_time="n/a"
    local model_loaded="none"
    local memory_usage="unknown"
    
    if port_is_open 8000; then
        status="running"
        response_time=$(get_response_time "http://localhost:8000/v1/models" 3)
        
        # Check loaded model
        if command_exists curl; then
            local models_response
            models_response=$(curl -s -m 5 "http://localhost:8000/v1/models" 2>/dev/null || echo "")
            if echo "$models_response" | grep -q '"id"'; then
                model_loaded=$(echo "$models_response" | grep '"id"' | head -1 | sed 's/.*"id": *"\([^"]*\)".*/\1/')
            fi
        fi
    fi
    
    echo "$status,$response_time,$model_loaded,$memory_usage"
}

# Function to check Ollama health
check_ollama_health() {
    local status="down"
    local response_time="n/a"
    local models_count=0
    local memory_usage="unknown"
    
    if port_is_open 11434; then
        status="running"
        response_time=$(get_response_time "http://localhost:11434/api/tags" 3)
        
        # Check available models
        if command_exists curl; then
            local tags_response
            tags_response=$(curl -s -m 5 "http://localhost:11434/api/tags" 2>/dev/null || echo "")
            if echo "$tags_response" | grep -q '"models"'; then
                models_count=$(echo "$tags_response" | grep -o '"name"' | wc -l)
            fi
        elif command_exists ollama; then
            models_count=$(ollama list 2>/dev/null | grep -v "NAME" | wc -l || echo "0")
        fi
    fi
    
    echo "$status,$response_time,$models_count,$memory_usage"
}

# Function to check cloud API health
check_cloud_api_health() {
    local provider=$1
    local status="unknown"
    local response_time="n/a"
    local quota_remaining="unknown"
    
    case "$provider" in
        "openai")
            if [ -n "$OPENAI_API_KEY" ] && [ "$OPENAI_API_KEY" != "your-openai-api-key-here" ]; then
                response_time=$(get_response_time "https://api.openai.com/v1/models" 5)
                if [ "$response_time" != "timeout" ]; then
                    status="available"
                else
                    status="timeout"
                fi
            else
                status="not_configured"
            fi
            ;;
        "anthropic")
            if [ -n "$ANTHROPIC_API_KEY" ] && [ "$ANTHROPIC_API_KEY" != "your-anthropic-api-key-here" ]; then
                # Anthropic doesn't have a simple health endpoint, so we assume it's available
                status="configured"
            else
                status="not_configured"
            fi
            ;;
        "google")
            if [ -n "$GOOGLE_API_KEY" ] && [ "$GOOGLE_API_KEY" != "your-google-api-key-here" ]; then
                response_time=$(get_response_time "https://generativelanguage.googleapis.com/v1beta/models?key=$GOOGLE_API_KEY" 5)
                if [ "$response_time" != "timeout" ]; then
                    status="available"
                else
                    status="timeout"
                fi
            else
                status="not_configured"
            fi
            ;;
        "groq")
            if [ -n "$GROQ_API_KEY" ] && [ "$GROQ_API_KEY" != "gsk_your-groq-api-key-here" ]; then
                response_time=$(get_response_time "https://api.groq.com/openai/v1/models" 5)
                if [ "$response_time" != "timeout" ]; then
                    status="available"
                else
                    status="timeout"
                fi
            else
                status="not_configured"
            fi
            ;;
        "grok")
            if [ -n "$GROK_API_KEY" ] && [ "$GROK_API_KEY" != "xai-your-grok-api-key-here" ]; then
                # xAI Grok API endpoint (when available)
                status="configured"
            else
                status="not_configured"
            fi
            ;;
    esac
    
    echo "$status,$response_time,$quota_remaining"
}

# Function to generate health recommendations
generate_recommendations() {
    local system_stats=$1
    local lmstudio_stats=$2
    local vllm_stats=$3
    local ollama_stats=$4
    
    local recommendations=()
    
    # Parse system stats
    IFS=',' read -r cpu_usage memory_usage disk_usage gpu_usage <<< "$system_stats"
    
    # System resource recommendations
    if [ "$cpu_usage" != "unknown" ] && [ "$cpu_usage" != "" ]; then
        if [ "$(echo "$cpu_usage > 80" | bc 2>/dev/null || echo 0)" = "1" ]; then
            recommendations+=("High CPU usage ($cpu_usage%). Consider using local models to reduce cloud API calls.")
        fi
    fi
    
    if [ "$memory_usage" != "unknown" ] && [ "$memory_usage" != "" ]; then
        if [ "$(echo "$memory_usage > 90" | bc 2>/dev/null || echo 0)" = "1" ]; then
            recommendations+=("High memory usage ($memory_usage%). Consider using smaller models or increasing system RAM.")
        fi
    fi
    
    if [ "$disk_usage" != "unknown" ] && [ "$disk_usage" != "" ]; then
        if [ "$(echo "$disk_usage > 85" | bc 2>/dev/null || echo 0)" = "1" ]; then
            recommendations+=("Low disk space ($disk_usage% used). Consider cleaning up old model files or logs.")
        fi
    fi
    
    # LLM service recommendations
    IFS=',' read -r lms_status lms_response_time lms_model lms_memory <<< "$lmstudio_stats"
    IFS=',' read -r vllm_status vllm_response_time vllm_model vllm_memory <<< "$vllm_stats"
    IFS=',' read -r ollama_status ollama_response_time ollama_models ollama_memory <<< "$ollama_stats"
    
    local active_services=0
    [ "$lms_status" = "running" ] && active_services=$((active_services + 1))
    [ "$vllm_status" = "running" ] && active_services=$((active_services + 1))
    [ "$ollama_status" = "running" ] && active_services=$((active_services + 1))
    
    if [ $active_services -eq 0 ]; then
        recommendations+=("No local AI services running. Run './scripts/auto-start-llm.sh' to start available services.")
    elif [ $active_services -gt 2 ] && [ "$memory_usage" != "unknown" ] && [ "$memory_usage" != "" ]; then
        if [ "$(echo "$memory_usage > 70" | bc 2>/dev/null || echo 0)" = "1" ]; then
            recommendations+=("Multiple AI services running with high memory usage. Consider using only one service at a time.")
        fi
    fi
    
    # Model recommendations
    if [ "$lms_model" = "none" ] && [ "$lms_status" = "running" ]; then
        recommendations+=("LM Studio running but no model loaded. Load a model for better performance.")
    fi
    
    if [ "$ollama_models" = "0" ] && [ "$ollama_status" = "running" ]; then
        recommendations+=("Ollama running but no models available. Run 'ollama pull' to download models.")
    fi
    
    printf '%s\n' "${recommendations[@]}"
}

# Function to create health report
create_health_report() {
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    # Load environment variables if available
    if [ -f "$PROJECT_ROOT/.env.local" ]; then
        export $(grep -v '^#' "$PROJECT_ROOT/.env.local" | xargs) 2>/dev/null || true
    fi
    
    # Gather health data
    local system_stats
    system_stats=$(check_system_resources)
    
    local lmstudio_stats
    lmstudio_stats=$(check_lmstudio_health)
    
    local vllm_stats
    vllm_stats=$(check_vllm_health)
    
    local ollama_stats
    ollama_stats=$(check_ollama_health)
    
    local openai_stats
    openai_stats=$(check_cloud_api_health "openai")
    
    local anthropic_stats
    anthropic_stats=$(check_cloud_api_health "anthropic")
    
    local google_stats
    google_stats=$(check_cloud_api_health "google")
    
    local groq_stats
    groq_stats=$(check_cloud_api_health "groq")
    
    local grok_stats
    grok_stats=$(check_cloud_api_health "grok")
    
    # Generate recommendations
    local recommendations
    recommendations=$(generate_recommendations "$system_stats" "$lmstudio_stats" "$vllm_stats" "$ollama_stats")
    
    # Create JSON report
    cat > "$HEALTH_FILE" <<EOF
{
  "timestamp": "$timestamp",
  "version": "1.0.0",
  "overall_status": "$(if echo "$lmstudio_stats$vllm_stats$ollama_stats" | grep -q "running"; then echo "healthy"; else echo "degraded"; fi)",
  "system": {
    "cpu_usage": "$(echo "$system_stats" | cut -d',' -f1)",
    "memory_usage": "$(echo "$system_stats" | cut -d',' -f2)",
    "disk_usage": "$(echo "$system_stats" | cut -d',' -f3)",
    "gpu_usage": "$(echo "$system_stats" | cut -d',' -f4)"
  },
  "services": {
    "lmstudio": {
      "status": "$(echo "$lmstudio_stats" | cut -d',' -f1)",
      "response_time": "$(echo "$lmstudio_stats" | cut -d',' -f2)",
      "model_loaded": "$(echo "$lmstudio_stats" | cut -d',' -f3)",
      "port": 1234
    },
    "vllm": {
      "status": "$(echo "$vllm_stats" | cut -d',' -f1)",
      "response_time": "$(echo "$vllm_stats" | cut -d',' -f2)",
      "model_loaded": "$(echo "$vllm_stats" | cut -d',' -f3)",
      "port": 8000
    },
    "ollama": {
      "status": "$(echo "$ollama_stats" | cut -d',' -f1)",
      "response_time": "$(echo "$ollama_stats" | cut -d',' -f2)",
      "models_count": "$(echo "$ollama_stats" | cut -d',' -f3)",
      "port": 11434
    }
  },
  "cloud_apis": {
    "openai": {
      "status": "$(echo "$openai_stats" | cut -d',' -f1)",
      "response_time": "$(echo "$openai_stats" | cut -d',' -f2)"
    },
    "anthropic": {
      "status": "$(echo "$anthropic_stats" | cut -d',' -f1)",
      "response_time": "$(echo "$anthropic_stats" | cut -d',' -f2)"
    },
    "google": {
      "status": "$(echo "$google_stats" | cut -d',' -f1)",
      "response_time": "$(echo "$google_stats" | cut -d',' -f2)"
    },
    "groq": {
      "status": "$(echo "$groq_stats" | cut -d',' -f1)",
      "response_time": "$(echo "$groq_stats" | cut -d',' -f2)"
    },
    "grok": {
      "status": "$(echo "$grok_stats" | cut -d',' -f1)",
      "response_time": "$(echo "$grok_stats" | cut -d',' -f2)"
    }
  },
  "recommendations": [$(echo "$recommendations" | sed 's/.*/"&"/' | paste -sd ',' -)]
}
EOF
}

# Function to display health status
display_health_status() {
    if [ ! -f "$HEALTH_FILE" ]; then
        print_color "$RED" "❌ No health data available. Run health check first."
        return 1
    fi
    
    local overall_status
    overall_status=$(grep '"overall_status"' "$HEALTH_FILE" | sed 's/.*: *"\([^"]*\)".*/\1/')
    
    print_color "$MAGENTA" "╔══════════════════════════════════════════════════╗"
    print_color "$MAGENTA" "║               MARIA Health Status                ║"
    print_color "$MAGENTA" "╚══════════════════════════════════════════════════╝"
    echo ""
    
    # Overall status
    case "$overall_status" in
        "healthy")
            print_color "$GREEN" "🟢 Overall Status: Healthy"
            ;;
        "degraded")
            print_color "$YELLOW" "🟡 Overall Status: Degraded"
            ;;
        *)
            print_color "$RED" "🔴 Overall Status: Critical"
            ;;
    esac
    echo ""
    
    # System resources
    print_color "$BLUE" "📊 System Resources:"
    
    local cpu_usage
    cpu_usage=$(grep '"cpu_usage"' "$HEALTH_FILE" | sed 's/.*: *"\([^"]*\)".*/\1/')
    if [ "$cpu_usage" != "unknown" ] && [ "$cpu_usage" != "" ]; then
        if [ "$(echo "$cpu_usage < 70" | bc 2>/dev/null || echo 1)" = "1" ]; then
            print_color "$GREEN" "  ✅ CPU: ${cpu_usage}%"
        elif [ "$(echo "$cpu_usage < 90" | bc 2>/dev/null || echo 0)" = "1" ]; then
            print_color "$YELLOW" "  ⚠️  CPU: ${cpu_usage}%"
        else
            print_color "$RED" "  🔴 CPU: ${cpu_usage}%"
        fi
    fi
    
    local memory_usage
    memory_usage=$(grep '"memory_usage"' "$HEALTH_FILE" | sed 's/.*: *"\([^"]*\)".*/\1/')
    if [ "$memory_usage" != "unknown" ] && [ "$memory_usage" != "" ]; then
        if [ "$(echo "$memory_usage < 80" | bc 2>/dev/null || echo 1)" = "1" ]; then
            print_color "$GREEN" "  ✅ Memory: ${memory_usage}%"
        elif [ "$(echo "$memory_usage < 95" | bc 2>/dev/null || echo 0)" = "1" ]; then
            print_color "$YELLOW" "  ⚠️  Memory: ${memory_usage}%"
        else
            print_color "$RED" "  🔴 Memory: ${memory_usage}%"
        fi
    fi
    
    echo ""
    
    # Local services
    print_color "$BLUE" "🤖 Local AI Services:"
    
    # LM Studio
    local lms_status
    lms_status=$(grep -A 5 '"lmstudio"' "$HEALTH_FILE" | grep '"status"' | sed 's/.*: *"\([^"]*\)".*/\1/')
    if [ "$lms_status" = "running" ]; then
        local lms_model
        lms_model=$(grep -A 5 '"lmstudio"' "$HEALTH_FILE" | grep '"model_loaded"' | sed 's/.*: *"\([^"]*\)".*/\1/')
        print_color "$GREEN" "  ✅ LM Studio: Running ($lms_model)"
    else
        print_color "$YELLOW" "  ⚠️  LM Studio: Not running"
    fi
    
    # vLLM
    local vllm_status
    vllm_status=$(grep -A 5 '"vllm"' "$HEALTH_FILE" | grep '"status"' | sed 's/.*: *"\([^"]*\)".*/\1/')
    if [ "$vllm_status" = "running" ]; then
        local vllm_model
        vllm_model=$(grep -A 5 '"vllm"' "$HEALTH_FILE" | grep '"model_loaded"' | sed 's/.*: *"\([^"]*\)".*/\1/')
        print_color "$GREEN" "  ✅ vLLM: Running ($vllm_model)"
    else
        print_color "$YELLOW" "  ⚠️  vLLM: Not running"
    fi
    
    # Ollama
    local ollama_status
    ollama_status=$(grep -A 5 '"ollama"' "$HEALTH_FILE" | grep '"status"' | sed 's/.*: *"\([^"]*\)".*/\1/')
    if [ "$ollama_status" = "running" ]; then
        local ollama_models
        ollama_models=$(grep -A 5 '"ollama"' "$HEALTH_FILE" | grep '"models_count"' | sed 's/.*: *"\([^"]*\)".*/\1/')
        print_color "$GREEN" "  ✅ Ollama: Running ($ollama_models models)"
    else
        print_color "$YELLOW" "  ⚠️  Ollama: Not running"
    fi
    
    echo ""
    
    # Cloud APIs
    print_color "$BLUE" "☁️  Cloud APIs:"
    
    local openai_status
    openai_status=$(grep -A 3 '"openai"' "$HEALTH_FILE" | grep '"status"' | sed 's/.*: *"\([^"]*\)".*/\1/')
    case "$openai_status" in
        "available") print_color "$GREEN" "  ✅ OpenAI: Available" ;;
        "configured") print_color "$GREEN" "  ✅ OpenAI: Configured" ;;
        "timeout") print_color "$YELLOW" "  ⚠️  OpenAI: Timeout" ;;
        "not_configured") print_color "$YELLOW" "  ⚠️  OpenAI: Not configured" ;;
        *) print_color "$RED" "  ❌ OpenAI: Unknown" ;;
    esac
    
    local google_status
    google_status=$(grep -A 3 '"google"' "$HEALTH_FILE" | grep '"status"' | sed 's/.*: *"\([^"]*\)".*/\1/')
    case "$google_status" in
        "available") print_color "$GREEN" "  ✅ Google AI: Available" ;;
        "configured") print_color "$GREEN" "  ✅ Google AI: Configured" ;;
        "timeout") print_color "$YELLOW" "  ⚠️  Google AI: Timeout" ;;
        "not_configured") print_color "$YELLOW" "  ⚠️  Google AI: Not configured" ;;
        *) print_color "$RED" "  ❌ Google AI: Unknown" ;;
    esac
    
    echo ""
    
    # Recommendations
    if grep -q '"recommendations"' "$HEALTH_FILE"; then
        local rec_count
        rec_count=$(grep -o '"recommendations"' "$HEALTH_FILE" | wc -l)
        if [ "$rec_count" -gt 0 ]; then
            print_color "$BLUE" "💡 Recommendations:"
            # Extract recommendations (simplified)
            grep '"recommendations"' -A 10 "$HEALTH_FILE" | grep '"' | sed 's/.*"\([^"]*\)".*/\1/' | while read -r rec; do
                if [ -n "$rec" ] && [ "$rec" != "recommendations" ]; then
                    print_color "$CYAN" "  • $rec"
                fi
            done
        fi
    fi
    
    echo ""
}

# Function to start continuous monitoring
start_monitoring() {
    local interval=${1:-300}  # Default 5 minutes
    
    print_color "$CYAN" "🔄 Starting continuous health monitoring (interval: ${interval}s)"
    print_color "$CYAN" "Press Ctrl+C to stop"
    echo ""
    
    while true; do
        create_health_report
        print_color "$GREEN" "$(date '+%H:%M:%S') - Health check completed"
        sleep "$interval"
    done
}

# Main execution
case "${1:-status}" in
    "check"|"update")
        print_color "$BLUE" "🔍 Running health check..."
        create_health_report
        print_color "$GREEN" "✅ Health data updated"
        ;;
    "status"|"show")
        display_health_status
        ;;
    "monitor")
        start_monitoring "${2:-300}"
        ;;
    "json")
        if [ -f "$HEALTH_FILE" ]; then
            cat "$HEALTH_FILE"
        else
            echo '{"error": "No health data available"}'
        fi
        ;;
    *)
        echo "Usage: $0 [check|status|monitor|json] [interval]"
        echo "  check    - Update health data"
        echo "  status   - Display current health status"
        echo "  monitor  - Start continuous monitoring"
        echo "  json     - Output raw health data as JSON"
        exit 1
        ;;
esac