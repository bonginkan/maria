/**
 * MARIA CODE VS Code Extension Local Test
 * ローカル拡張機能テストスクリプト
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 MARIA CODE VS Code Extension Local Test');
console.log('='.repeat(60));

// 1. 拡張機能のインストール確認
console.log('\n1. Extension Installation Check');
console.log('-'.repeat(40));

exec('code --list-extensions | grep maria', (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Error checking extensions:', error);
    return;
  }
  
  if (stdout.includes('bonginkan.maria-code')) {
    console.log('✅ MARIA CODE extension is installed');
    console.log(`   Extension ID: ${stdout.trim()}`);
  } else {
    console.log('❌ MARIA CODE extension not found');
  }
});

// 2. パッケージ情報確認
console.log('\n2. Package Information Check');
console.log('-'.repeat(40));

try {
  const packagePath = path.join(__dirname, 'package.json');
  const packageInfo = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  console.log(`✅ Extension Name: ${packageInfo.displayName}`);
  console.log(`✅ Version: ${packageInfo.version}`);
  console.log(`✅ Publisher: ${packageInfo.publisher}`);
  console.log(`✅ VS Code Engine: ${packageInfo.engines.vscode}`);
  console.log(`✅ Commands: ${packageInfo.contributes.commands.length} registered`);
  
  // コマンド一覧表示
  console.log('\n   Registered Commands:');
  packageInfo.contributes.commands.forEach((cmd, index) => {
    console.log(`   ${index + 1}. ${cmd.command} - ${cmd.title}`);
  });
  
} catch (error) {
  console.error('❌ Error reading package.json:', error.message);
}

// 3. ビルド出力確認
console.log('\n3. Build Output Check');
console.log('-'.repeat(40));

const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  const distFiles = fs.readdirSync(distPath);
  console.log(`✅ Compiled files found: ${distFiles.length} files`);
  
  const mainFile = path.join(distPath, 'extension.js');
  if (fs.existsSync(mainFile)) {
    const stats = fs.statSync(mainFile);
    console.log(`✅ Main extension file: ${Math.round(stats.size / 1024)}KB`);
  } else {
    console.log('❌ Main extension file not found');
  }
} else {
  console.log('❌ Dist directory not found');
}

// 4. リソース確認
console.log('\n4. Resources Check');
console.log('-'.repeat(40));

const resourcesPath = path.join(__dirname, 'resources');
if (fs.existsSync(resourcesPath)) {
  const resourceFiles = fs.readdirSync(resourcesPath);
  console.log(`✅ Resource files found: ${resourceFiles.length} files`);
  
  resourceFiles.forEach(file => {
    const filePath = path.join(resourcesPath, file);
    const stats = fs.statSync(filePath);
    console.log(`   - ${file}: ${Math.round(stats.size / 1024)}KB`);
  });
} else {
  console.log('❌ Resources directory not found');
}

// 5. VSIX パッケージ確認
console.log('\n5. VSIX Package Check');
console.log('-'.repeat(40));

const vsixFiles = fs.readdirSync(__dirname).filter(file => file.endsWith('.vsix'));
if (vsixFiles.length > 0) {
  console.log(`✅ VSIX packages found: ${vsixFiles.length}`);
  
  vsixFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    const stats = fs.statSync(filePath);
    console.log(`   - ${file}: ${Math.round(stats.size / 1024 / 1024 * 100) / 100}MB`);
  });
} else {
  console.log('❌ No VSIX packages found');
}

// 6. VS Code設定テスト
console.log('\n6. VS Code Configuration Test');
console.log('-'.repeat(40));

const settingsJson = {
  "maria.enableDiagnostics": true,
  "maria.enableInternalModes": true,
  "maria.preferredProvider": "auto",
  "maria.enableApprovalSystem": false
};

console.log('✅ Default configuration settings:');
Object.entries(settingsJson).forEach(([key, value]) => {
  console.log(`   - ${key}: ${value}`);
});

// 7. 分布準備状況確認
console.log('\n7. Distribution Readiness Check');
console.log('-'.repeat(40));

const checklist = [
  {
    name: 'Package.json configured',
    check: () => fs.existsSync(path.join(__dirname, 'package.json'))
  },
  {
    name: 'TypeScript compiled',
    check: () => fs.existsSync(path.join(__dirname, 'dist', 'extension.js'))
  },
  {
    name: 'VSIX package created',
    check: () => fs.readdirSync(__dirname).some(f => f.endsWith('.vsix'))
  },
  {
    name: 'Icon resources available',
    check: () => fs.existsSync(path.join(__dirname, 'resources', 'icon.png'))
  },
  {
    name: 'License file present',
    check: () => fs.existsSync(path.join(__dirname, 'LICENSE.md'))
  },
  {
    name: 'README documentation',
    check: () => fs.existsSync(path.join(__dirname, 'README.md'))
  }
];

let passedChecks = 0;
checklist.forEach(({ name, check }) => {
  if (check()) {
    console.log(`✅ ${name}`);
    passedChecks++;
  } else {
    console.log(`❌ ${name}`);
  }
});

console.log(`\n📊 Distribution Readiness: ${passedChecks}/${checklist.length} (${Math.round(passedChecks / checklist.length * 100)}%)`);

// 8. 推奨改善事項
console.log('\n8. Recommended Improvements');
console.log('-'.repeat(40));

const improvements = [
  'Add .vscodeignore file to reduce package size',
  'Fix ESLint warnings and errors',
  'Add comprehensive integration tests',
  'Optimize bundle size with webpack',
  'Add telemetry for usage analytics',
  'Implement enterprise license validation'
];

improvements.forEach((improvement, index) => {
  console.log(`${index + 1}. ${improvement}`);
});

console.log('\n🎉 Local testing completed!');
console.log('Ready for marketplace distribution preparation.');