#!/bin/bash

# MARIA CODE - LM Studio Setup Script
# Phase 1: 基礎検出システム

set -e

echo "🚀 MARIA CODE - LM Studio Setup"
echo "================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if LM Studio is installed
check_lmstudio() {
    log_info "Checking for LM Studio installation..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        LMSTUDIO_PATH="/Applications/LM Studio.app/Contents/MacOS/LM Studio"
        LMS_BINARY="$HOME/.lmstudio/bin/lms"
        
        if [[ -f "$LMSTUDIO_PATH" ]]; then
            log_success "Found LM Studio at: $LMSTUDIO_PATH"
            return 0
        elif [[ -f "$LMS_BINARY" ]]; then
            log_success "Found lms binary at: $LMS_BINARY"
            return 0
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command -v lmstudio &> /dev/null; then
            log_success "Found LM Studio in PATH"
            return 0
        elif [[ -f "/opt/lmstudio/lmstudio" ]]; then
            log_success "Found LM Studio at: /opt/lmstudio/lmstudio"
            return 0
        fi
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        # Windows
        if [[ -f "/c/Program Files/LM Studio/LM Studio.exe" ]]; then
            log_success "Found LM Studio at: C:\\Program Files\\LM Studio\\LM Studio.exe"
            return 0
        fi
    fi
    
    return 1
}

# Install LM Studio
install_lmstudio() {
    log_warning "LM Studio not found. Installation instructions:"
    echo ""
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "  🍎 macOS:"
        echo "  1. Download LM Studio from: https://lmstudio.ai/"
        echo "  2. Install the application to /Applications/"
        echo "  3. Run LM Studio once to complete setup"
        echo ""
        
        # Check if Homebrew is available
        if command -v brew &> /dev/null; then
            echo "  Alternative (using Homebrew):"
            echo "  brew install --cask lm-studio"
            echo ""
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "  🐧 Linux:"
        echo "  1. Download LM Studio AppImage from: https://lmstudio.ai/"
        echo "  2. Make it executable: chmod +x LMStudio-*.AppImage"
        echo "  3. Run: ./LMStudio-*.AppImage"
        echo ""
    else
        echo "  🪟 Windows:"
        echo "  1. Download LM Studio from: https://lmstudio.ai/"
        echo "  2. Run the installer as administrator"
        echo "  3. Complete the setup process"
        echo ""
    fi
    
    echo "After installation, run this script again to verify."
    return 1
}

# Check Node.js version
check_nodejs() {
    log_info "Checking Node.js version..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        log_success "Node.js version: $NODE_VERSION"
        
        # Check if version is >= 18
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
        if [[ $MAJOR_VERSION -ge 18 ]]; then
            return 0
        else
            log_warning "Node.js version $NODE_VERSION is too old. Need >= 18.0.0"
            return 1
        fi
    else
        log_error "Node.js not found. Please install Node.js >= 18.0.0"
        return 1
    fi
}

# Create configuration directory
setup_config() {
    log_info "Setting up configuration directory..."
    
    MARIA_DIR="$HOME/.maria"
    if [[ ! -d "$MARIA_DIR" ]]; then
        mkdir -p "$MARIA_DIR"
        log_success "Created directory: $MARIA_DIR"
    else
        log_info "Directory already exists: $MARIA_DIR"
    fi
    
    # Create sample configuration if it doesn't exist
    CONFIG_FILE="$MARIA_DIR/.maria-code.toml"
    if [[ ! -f "$CONFIG_FILE" ]]; then
        log_info "Creating sample configuration..."
        
        cat > "$CONFIG_FILE" << 'EOF'
# MARIA CODE - LM Studio Configuration

[lmstudio]
enabled = true
auto_start = true
startup_timeout = 30000
health_check_interval = 5000
default_model = "gpt-oss-20b"
context_length = 32768
base_url = "http://localhost:1234"

[lmstudio.paths]
mac = "/Applications/LM Studio.app/Contents/MacOS/LM Studio"
windows = "C:\\Program Files\\LM Studio\\LM Studio.exe"
linux = "/opt/lmstudio/lmstudio"
# custom = "/path/to/lmstudio"

[lmstudio.models]
preload = ["gpt-oss-20b"]
max_concurrent = 2

[lmstudio.startup_options]
headless = true
port = 1234
host = "localhost"
# gpu_layers = 32

[lmstudio.retry]
max_attempts = 3
delay_ms = 1000
backoff_multiplier = 2
EOF
        
        log_success "Created configuration: $CONFIG_FILE"
    else
        log_info "Configuration already exists: $CONFIG_FILE"
    fi
}

# Test LM Studio connection
test_connection() {
    log_info "Testing LM Studio connection..."
    
    # Try to connect to LM Studio API
    if command -v curl &> /dev/null; then
        RESPONSE=$(curl -s -w "%{http_code}" http://localhost:1234/v1/models -o /dev/null || echo "000")
        
        if [[ "$RESPONSE" == "200" ]]; then
            log_success "LM Studio is running and accessible!"
            return 0
        elif [[ "$RESPONSE" == "000" ]]; then
            log_warning "LM Studio is not running. Start it manually to test."
            return 1
        else
            log_warning "LM Studio responded with HTTP $RESPONSE"
            return 1
        fi
    else
        log_warning "curl not found. Cannot test connection."
        return 1
    fi
}

# Main setup process
main() {
    echo ""
    log_info "Starting LM Studio setup process..."
    echo ""
    
    # Check Node.js
    if ! check_nodejs; then
        log_error "Node.js check failed. Please install Node.js >= 18.0.0"
        exit 1
    fi
    echo ""
    
    # Check LM Studio
    if check_lmstudio; then
        echo ""
        log_success "LM Studio is installed!"
    else
        echo ""
        install_lmstudio
        exit 1
    fi
    echo ""
    
    # Setup configuration
    setup_config
    echo ""
    
    # Test connection
    test_connection
    echo ""
    
    # Final instructions
    echo "🎉 Setup Complete!"
    echo "=================="
    echo ""
    echo "Next steps:"
    echo "1. Start LM Studio if it's not running"
    echo "2. Download and load a model (e.g., gpt-oss-20b)"
    echo "3. Run 'maria --verbose' to test auto-start"
    echo ""
    echo "Configuration file: $HOME/.maria/.maria-code.toml"
    echo "Edit this file to customize LM Studio settings."
    echo ""
    log_success "LM Studio setup completed successfully!"
}

# Run main function
main "$@"