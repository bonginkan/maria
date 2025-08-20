#!/bin/bash

# MARIA CODE - LM Studio Verification Script
# Phase 1: 基礎検出システム検証

set -e

echo "🔍 MARIA CODE - LM Studio Verification"
echo "======================================"

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

# Test detection system
test_detection() {
    log_info "Testing LM Studio detection..."
    
    # Check using node script
    NODE_SCRIPT=$(cat << 'EOF'
const { LMStudioDetector } = require('./dist/services/lmstudio-detector.js');

async function testDetection() {
    try {
        const detector = new LMStudioDetector();
        const result = await detector.detect();
        
        console.log('Detection Result:');
        console.log(`  Found: ${result.found}`);
        console.log(`  Platform: ${result.platform}`);
        if (result.path) {
            console.log(`  Path: ${result.path}`);
        }
        if (result.version) {
            console.log(`  Version: ${result.version}`);
        }
        
        process.exit(result.found ? 0 : 1);
    } catch (error) {
        console.error('Detection failed:', error.message);
        process.exit(1);
    }
}

testDetection();
EOF
)
    
    if echo "$NODE_SCRIPT" | node; then
        log_success "Detection system working!"
        return 0
    else
        log_error "Detection system failed"
        return 1
    fi
}

# Test health check system
test_health_check() {
    log_info "Testing LM Studio health check..."
    
    NODE_SCRIPT=$(cat << 'EOF'
const { LMStudioHealthChecker } = require('./dist/services/lmstudio-health.js');

async function testHealthCheck() {
    try {
        const healthChecker = new LMStudioHealthChecker();
        const status = await healthChecker.checkHealth();
        
        console.log('Health Check Result:');
        console.log(`  Running: ${status.isRunning}`);
        console.log(`  Healthy: ${status.isHealthy}`);
        if (status.responseTime) {
            console.log(`  Response Time: ${status.responseTime}ms`);
        }
        console.log(`  Models Loaded: ${status.modelsLoaded.length}`);
        if (status.modelsLoaded.length > 0) {
            status.modelsLoaded.forEach(model => {
                console.log(`    - ${model}`);
            });
        }
        if (status.error) {
            console.log(`  Error: ${status.error}`);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Health check failed:', error.message);
        process.exit(1);
    }
}

testHealthCheck();
EOF
)
    
    if echo "$NODE_SCRIPT" | node; then
        log_success "Health check system working!"
        return 0
    else
        log_error "Health check system failed"
        return 1
    fi
}

# Test configuration system
test_config() {
    log_info "Testing LM Studio configuration..."
    
    NODE_SCRIPT=$(cat << 'EOF'
const { LMStudioConfigManager } = require('./dist/services/lmstudio-config.js');

async function testConfig() {
    try {
        const configManager = new LMStudioConfigManager();
        const config = configManager.loadWithEnvironmentOverrides();
        
        console.log('Configuration Test:');
        console.log(`  Enabled: ${config.enabled}`);
        console.log(`  Auto Start: ${config.auto_start}`);
        console.log(`  Base URL: ${config.base_url}`);
        console.log(`  Startup Timeout: ${config.startup_timeout}ms`);
        
        const execPath = configManager.getExecutablePath(config);
        console.log(`  Executable Path: ${execPath || 'Not found'}`);
        
        const validation = configManager.validate(config);
        console.log(`  Valid: ${validation.valid}`);
        if (!validation.valid) {
            validation.errors.forEach(error => {
                console.log(`    Error: ${error}`);
            });
        }
        
        process.exit(validation.valid ? 0 : 1);
    } catch (error) {
        console.error('Config test failed:', error.message);
        process.exit(1);
    }
}

testConfig();
EOF
)
    
    if echo "$NODE_SCRIPT" | node; then
        log_success "Configuration system working!"
        return 0
    else
        log_error "Configuration system failed"
        return 1
    fi
}

# Test complete manager
test_manager() {
    log_info "Testing LM Studio manager..."
    
    NODE_SCRIPT=$(cat << 'EOF'
const { LMStudioManager } = require('./dist/services/lmstudio-manager.js');

async function testManager() {
    try {
        const manager = new LMStudioManager();
        
        console.log('Manager Test:');
        
        // Test status check
        const isRunning = await manager.isRunning();
        console.log(`  Is Running: ${isRunning}`);
        
        // Get detailed status
        const status = await manager.getStatus();
        console.log(`  Detailed Status:`);
        console.log(`    Running: ${status.isRunning}`);
        console.log(`    Healthy: ${status.isHealthy}`);
        if (status.processId) {
            console.log(`    Process ID: ${status.processId}`);
        }
        if (status.startTime) {
            console.log(`    Start Time: ${status.startTime}`);
        }
        
        // Test loaded models
        const models = await manager.getLoadedModels();
        console.log(`    Loaded Models: ${models.length}`);
        models.forEach(model => {
            console.log(`      - ${model}`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('Manager test failed:', error.message);
        process.exit(1);
    }
}

testManager();
EOF
)
    
    if echo "$NODE_SCRIPT" | node; then
        log_success "Manager system working!"
        return 0
    else
        log_error "Manager system failed"
        return 1
    fi
}

# Test integration with MARIA
test_integration() {
    log_info "Testing MARIA integration..."
    
    # Build the project first
    if command -v pnpm &> /dev/null; then
        log_info "Building project with pnpm..."
        pnpm build > /dev/null 2>&1 || {
            log_error "Build failed"
            return 1
        }
    elif command -v npm &> /dev/null; then
        log_info "Building project with npm..."
        npm run build > /dev/null 2>&1 || {
            log_error "Build failed"
            return 1
        }
    else
        log_error "Neither pnpm nor npm found"
        return 1
    fi
    
    log_success "Project built successfully!"
    return 0
}

# Main verification process
main() {
    echo ""
    log_info "Starting LM Studio verification process..."
    echo ""
    
    FAILED_TESTS=0
    
    # Test integration first (builds the project)
    if test_integration; then
        echo ""
    else
        echo ""
        log_error "Integration test failed"
        ((FAILED_TESTS++))
    fi
    
    # Test detection system
    if test_detection; then
        echo ""
    else
        echo ""
        log_error "Detection test failed"
        ((FAILED_TESTS++))
    fi
    
    # Test health check system
    if test_health_check; then
        echo ""
    else
        echo ""
        log_error "Health check test failed"
        ((FAILED_TESTS++))
    fi
    
    # Test configuration system
    if test_config; then
        echo ""
    else
        echo ""
        log_error "Configuration test failed"
        ((FAILED_TESTS++))
    fi
    
    # Test complete manager
    if test_manager; then
        echo ""
    else
        echo ""
        log_error "Manager test failed"
        ((FAILED_TESTS++))
    fi
    
    # Summary
    echo "🔍 Verification Summary"
    echo "======================"
    echo ""
    
    if [[ $FAILED_TESTS -eq 0 ]]; then
        log_success "All tests passed! ✨"
        echo ""
        echo "Your LM Studio integration is working correctly."
        echo "You can now use MARIA with automatic LM Studio startup."
        echo ""
        echo "Try running:"
        echo "  maria --verbose"
        echo ""
    else
        log_error "$FAILED_TESTS test(s) failed"
        echo ""
        echo "Please check the error messages above and:"
        echo "1. Make sure LM Studio is properly installed"
        echo "2. Run the setup script: ./scripts/setup-lmstudio.sh"
        echo "3. Check your configuration: ~/.maria/.maria-code.toml"
        echo ""
        exit 1
    fi
}

# Run main function
main "$@"