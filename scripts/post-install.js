#!/usr/bin/env node

/**
 * Post-install script for MARIA
 * Sets up configuration and checks system requirements
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function postInstall() {
  console.log('🚀 Setting up MARIA...');

  try {
    // Create config directory
    const configDir = path.join(os.homedir(), '.maria');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
      console.log('✅ Created config directory:', configDir);
    }

    // Create default config if it doesn't exist
    const configFile = path.join(configDir, 'config.json');
    if (!fs.existsSync(configFile)) {
      const defaultConfig = {
        version: '1.0.0',
        priority: 'privacy-first',
        autoStart: true,
        healthMonitoring: true,
        language: 'auto',
        providers: {},
        setupCompleted: false
      };

      fs.writeFileSync(configFile, JSON.stringify(defaultConfig, null, 2));
      console.log('✅ Created default configuration');
    }

    // Make scripts executable (Unix-like systems)
    if (process.platform !== 'win32') {
      const scriptsDir = path.join(__dirname);
      const scripts = ['auto-start-llm.sh', 'health-monitor.sh', 'setup-wizard.sh'];
      
      scripts.forEach(script => {
        const scriptPath = path.join(scriptsDir, script);
        if (fs.existsSync(scriptPath)) {
          fs.chmodSync(scriptPath, 0o755);
        }
      });
      console.log('✅ Made scripts executable');
    }

    console.log('');
    console.log('🎉 MARIA setup complete!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Run "maria setup" to configure your AI providers');
    console.log('  2. Start chatting with "maria" or "maria chat"');
    console.log('  3. Check system health with "maria health"');
    console.log('');
    console.log('For help: maria --help');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run post-install
postInstall();