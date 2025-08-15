#!/usr/bin/env node

/**
 * Dynamic Version Generator for MARIA CLI
 * Generates unique versions based on git metadata and timestamp
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(PROJECT_ROOT, 'package.json');

function executeCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8', cwd: PROJECT_ROOT }).trim();
  } catch (error) {
    console.error(`Failed to execute: ${command}`);
    console.error(error.message);
    return null;
  }
}

function readPackageJson() {
  try {
    const content = fs.readFileSync(PACKAGE_JSON_PATH, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to read package.json: ${error.message}`);
    process.exit(1);
  }
}

function writePackageJson(packageData) {
  try {
    fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(packageData, null, 2) + '\n');
    console.log(`✅ Updated package.json with version ${packageData.version}`);
  } catch (error) {
    console.error(`Failed to write package.json: ${error.message}`);
    process.exit(1);
  }
}

function getLatestNpmVersion() {
  try {
    const stableVersion = executeCommand('npm view @bonginkan/maria version') || '0.0.0';
    const alphaVersion = executeCommand('npm view @bonginkan/maria dist-tags.alpha') || '0.0.0';
    
    console.log(`📦 Latest stable on NPM: ${stableVersion}`);
    console.log(`📦 Latest alpha on NPM: ${alphaVersion}`);
    
    // Return the higher version
    const versions = [stableVersion, alphaVersion].filter(v => v !== '0.0.0');
    if (versions.length === 0) return '1.0.0';
    
    return versions.sort((a, b) => {
      const aParts = a.split('.').map(Number);
      const bParts = b.split('.').map(Number);
      
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aPart = aParts[i] || 0;
        const bPart = bParts[i] || 0;
        if (aPart !== bPart) return bPart - aPart;
      }
      return 0;
    })[0];
  } catch (error) {
    console.warn('⚠️  Could not fetch NPM versions, using default');
    return '1.0.0';
  }
}

function generateDynamicVersion() {
  console.log('🚀 Generating dynamic version...\n');
  
  // Get git metadata
  const commitCount = executeCommand('git rev-list --count HEAD') || '0';
  const shortSha = executeCommand('git rev-parse --short HEAD') || 'unknown';
  const branchName = executeCommand('git rev-parse --abbrev-ref HEAD') || 'main';
  
  // Generate timestamp
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-T:\.Z]/g, '').slice(0, 12); // YYYYMMDDHHMM
  
  console.log(`📊 Git Metadata:`);
  console.log(`   Commit count: ${commitCount}`);
  console.log(`   Short SHA: ${shortSha}`);
  console.log(`   Branch: ${branchName}`);
  console.log(`   Timestamp: ${timestamp}\n`);
  
  // Get base version from NPM
  const baseVersion = getLatestNpmVersion();
  const baseVersionClean = baseVersion.replace(/-alpha.*$/, '');
  
  console.log(`🎯 Base version: ${baseVersionClean}`);
  
  // Generate new version
  let newVersion;
  if (branchName === 'main') {
    // Main branch: use commit count and timestamp
    newVersion = `${baseVersionClean}-alpha.${commitCount}.${timestamp}`;
  } else {
    // Feature branches: include branch name
    const safeBranchName = branchName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    newVersion = `${baseVersionClean}-alpha.${commitCount}.${safeBranchName}.${timestamp}`;
  }
  
  console.log(`✨ Generated version: ${newVersion}\n`);
  
  return newVersion;
}

function main() {
  console.log('🔧 MARIA CLI Dynamic Version Generator\n');
  console.log('=' * 50);
  
  // Read current package.json
  const packageData = readPackageJson();
  const currentVersion = packageData.version;
  
  console.log(`📋 Current version: ${currentVersion}`);
  
  // Generate new version
  const newVersion = generateDynamicVersion();
  
  // Update package.json
  packageData.version = newVersion;
  writePackageJson(packageData);
  
  console.log('=' * 50);
  console.log('✅ Dynamic version generation completed!');
  console.log(`🚀 Version updated: ${currentVersion} → ${newVersion}`);
  
  return newVersion;
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { generateDynamicVersion };