#!/usr/bin/env node

/**
 * Synchronize versions across package.json and package-oss.json
 * This script ensures all package files have the same version number
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

// Files to sync
const packageFiles = [
  path.join(PROJECT_ROOT, 'package.json'),
  path.join(PROJECT_ROOT, 'package-oss.json')
];

function readPackageJson(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`⚠️  Could not read ${filePath}: ${error.message}`);
    return null;
  }
}

function writePackageJson(filePath, packageData) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(packageData, null, 2) + '\n');
    console.log(`✅ Updated ${path.relative(PROJECT_ROOT, filePath)}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to write ${filePath}: ${error.message}`);
    return false;
  }
}

function syncVersions() {
  console.log('🔄 Synchronizing versions across package files...\n');

  // Read main package.json
  const mainPackage = readPackageJson(packageFiles[0]);
  if (!mainPackage) {
    console.error('❌ Could not read main package.json');
    process.exit(1);
  }

  const targetVersion = mainPackage.version;
  console.log(`🎯 Target version: ${targetVersion}\n`);

  let allSuccess = true;

  // Update all package files
  for (const packageFile of packageFiles) {
    const packageData = readPackageJson(packageFile);
    if (!packageData) {
      allSuccess = false;
      continue;
    }

    const currentVersion = packageData.version;
    
    if (currentVersion === targetVersion) {
      console.log(`✅ ${path.relative(PROJECT_ROOT, packageFile)} already at ${targetVersion}`);
    } else {
      console.log(`🔄 ${path.relative(PROJECT_ROOT, packageFile)}: ${currentVersion} → ${targetVersion}`);
      packageData.version = targetVersion;
      
      if (!writePackageJson(packageFile, packageData)) {
        allSuccess = false;
      }
    }
  }

  // Handle package-lock.json if it exists
  const lockFile = path.join(PROJECT_ROOT, 'package-lock.json');
  if (fs.existsSync(lockFile)) {
    const lockData = readPackageJson(lockFile);
    if (lockData && lockData.version !== targetVersion) {
      console.log(`🔄 package-lock.json: ${lockData.version} → ${targetVersion}`);
      lockData.version = targetVersion;
      
      // Update packages entry if it exists
      if (lockData.packages && lockData.packages['']) {
        lockData.packages[''].version = targetVersion;
      }
      
      if (!writePackageJson(lockFile, lockData)) {
        allSuccess = false;
      }
    } else if (lockData) {
      console.log(`✅ package-lock.json already at ${targetVersion}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  
  if (allSuccess) {
    console.log('✅ All package files synchronized successfully!');
    console.log(`🚀 All files now at version: ${targetVersion}`);
  } else {
    console.log('❌ Some files could not be updated');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  syncVersions();
}

module.exports = { syncVersions };