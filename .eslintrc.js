module.exports = {
  env: {
    es2022: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
    'plugin:node/recommended'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  settings: {
    node: {
      version: '>=18.0.0',
      tryExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
    }
  },
  plugins: ['@typescript-eslint', 'prettier', 'node'],
  rules: {
    // Node.js version requirements
    'node/no-unsupported-features/es-syntax': ['error', {
      version: '>=18.0.0',
      ignores: ['modules']
    }],
    'node/no-unsupported-features/node-builtins': ['error', {
      version: '>=18.0.0'
    }],
    
    // CLI-specific rules
    'no-process-exit': 'off',  // CLIs need process.exit
    'node/shebang': ['error', {
      'convertPath': {
        'src/bin/**/*.ts': ['^src/bin/(.+)\\.ts$', 'dist/bin/$1.js']
      }
    }],
    
    // TypeScript rules
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }
    ],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/ban-ts-comment': ['error', {
      'ts-expect-error': 'allow-with-description',
      'ts-ignore': 'allow-with-description',
      'ts-nocheck': 'allow-with-description',
      'ts-check': false
    }],
    
    // Node rules adjustments for TypeScript
    'node/no-missing-import': 'off',
    'node/no-missing-require': 'off',
    'node/no-unpublished-import': 'off',
    'node/no-unpublished-require': 'off',
    'node/no-extraneous-import': 'off',
    'node/no-extraneous-require': 'off',
    
    // Prettier
    'prettier/prettier': 'error'
  },
  ignorePatterns: [
    'dist',
    'node_modules',
    'coverage',
    '*.js',
    '*.d.ts',
    '.eslintrc.js',
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
    '**/*.spec.tsx'
  ],
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        'node/no-unsupported-features/es-syntax': 'off'
      }
    }
  ]
};