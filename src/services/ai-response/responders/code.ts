/**
 * Code Response Builder
 * Generates complete, runnable code responses with execution instructions
 */

import { formatFileBlock, generateFooter, formatList } from "./common";

export interface FileSpec {
  _path: string;
  lang: string;
  content: string;
}

export interface CodeResponseOptions {
  title: string;
  files: FileSpec[];
  runCommands: string[];
  notes?: string[];
  dependencies?: string[];
  envVars?: Record<string, string>;
  isJapanese?: boolean;
}

/**
 * Build a complete code response with files, run instructions, and notes
 * @param options - Code response configuration
 * @returns Formatted code response
 */
export function buildCodeResponse(options: CodeResponseOptions): string {
  const {
    title,
    files,
    runCommands,
    notes = [],
    dependencies = [],
    envVars = {},
    isJapanese = false,
  } = options;

  const parts: string[] = [];

  // Title
  parts.push(`### ${title}`);
  parts.push("");

  // File blocks
  files.forEach((file) => {
    parts.push(formatFileBlock(file._path, file.lang, file.content));
    parts.push("");
  });

  // Dependencies (if any)
  if (dependencies.length > 0) {
    parts.push(isJapanese ? "**必要な依存関係**" : "**Dependencies**");
    parts.push("```bash");
    parts.push(
      isJapanese
        ? `pnpm add ${dependencies.join(" ")}`
        : `npm install ${dependencies.join(" ")}`,
    );
    parts.push("```");
    parts.push("");
  }

  // Environment variables (if any)
  if (Object.keys(envVars).length > 0) {
    parts.push(
      isJapanese ? "**環境変数 (.env)**" : "**Environment Variables (.env)**",
    );
    parts.push("```env");
    Object.entries(envVars).forEach(([key, value]) => {
      parts.push(`${key}=${value}`);
    });
    parts.push("```");
    parts.push("");
  }

  // Run instructions
  parts.push(isJapanese ? "**実行手順**" : "**Run Instructions**");
  parts.push(formatList(runCommands, true));
  parts.push("");

  // Notes and troubleshooting
  const defaultNotes = isJapanese
    ? [
        "エラーが発生した場合は、依存関係が正しくインストールされているか確認してください",
      ]
    : [
        "If you encounter errors, ensure all dependencies are properly installed",
      ];

  const allNotes = [...notes, ...defaultNotes];
  parts.push(isJapanese ? "**注意事項**" : "**Notes**");
  parts.push(formatList(allNotes));

  // Footer with next actions
  const footerOptions = isJapanese
    ? ["エラー処理を追加", "テストを書く", "機能を拡張"]
    : ["Add error handling", "Write tests", "Extend features"];

  parts.push(generateFooter(isJapanese, footerOptions));

  return parts.join("\n");
}

/**
 * Generate CLI application template
 * @param isJapanese - Language preference
 * @returns Complete CLI application code response
 */
export function generateCLITemplate(isJapanese: boolean): string {
  return buildCodeResponse({
    title: isJapanese
      ? "TypeScript CLI アプリケーション"
      : "TypeScript CLI Application",
    files: [
      {
        _path: "src/index.ts",
        lang: "typescript",
        content: `#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';

const program = new Command();

program
  .name('my-cli')
  .description('CLI application template')
  .version('1.0.0');

program
  .command('greet <name>')
  .description('Greet someone')
  .option('-u, --uppercase', 'Convert to uppercase')
  .action((name: string, options: { uppercase?: boolean }) => {
    const greeting = options.uppercase 
      ? \`HELLO ${name.toUpperCase()}!\`
      : \`Hello ${name}!\`;
    console.log(chalk.green(greeting));
  });

program.parse(process.argv);`,
      },
      {
        _path: "package.json",
        lang: "json",
        content: `{
  "name": "my-cli",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "my-cli": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "chalk": "^5.3.0",
    "commander": "^11.1.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "tsx": "^4.6.0",
    "typescript": "^5.3.0"
  }
}`,
      },
      {
        _path: "tsconfig.json",
        lang: "json",
        content: `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}`,
      },
    ],
    runCommands: isJapanese
      ? [
          "pnpm install",
          "pnpm build",
          "node dist/index.js greet World",
          "npm link (グローバルインストール用)",
        ]
      : [
          "npm install",
          "npm run build",
          "node dist/index.js greet World",
          "npm link (for global installation)",
        ],
    dependencies: ["chalk", "commander"],
    notes: isJapanese
      ? ["tsx を使用して開発中は TypeScript を直接実行できます"]
      : ["Use tsx to run TypeScript directly during development"],
    isJapanese,
  });
}

/**
 * Generate Next.js API route template
 * @param isJapanese - Language preference
 * @returns Complete Next.js API route code response
 */
export function generateNextAPITemplate(isJapanese: boolean): string {
  return buildCodeResponse({
    title: isJapanese ? "Next.js API ルート" : "Next.js API Route",
    files: [
      {
        _path: "app/api/users/route.ts",
        lang: "typescript",
        content: `import { NextRequest, NextResponse } from 'next/server';

// Sample data
const users = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' }
];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    
    if (id) {
      const user = users.find(u => u.id === parseInt(id));
      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(user);
    }
    
    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email } = body;
    
    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      );
    }
    
    const newUser = {
      id: users.length + 1,
      name,
      email
    };
    
    users.push(newUser);
    
    return NextResponse.json(newUser, { status: 201 });
  } catch (innerError) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}`,
      },
      {
        _path: "app/api/users/[id]/route.ts",
        lang: "typescript",
        content: `import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json({ 
    message: \`User ${params.id} details\` 
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  return NextResponse.json({ 
    message: \`Updated user ${params.id}\`,
    data: body
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json({ 
    message: \`Deleted user ${params.id}\` 
  });
}`,
      },
    ],
    runCommands: isJapanese
      ? [
          "Next.js プロジェクトに配置",
          "pnpm dev でサーバー起動",
          "curl http://localhost:3000/api/users でテスト",
        ]
      : [
          "Place in Next.js project",
          "Run server with npm run dev",
          "Test with curl http://localhost:3000/api/users",
        ],
    notes: isJapanese
      ? [
          "App Router (Next.js 13+) を使用",
          "データベース接続は別途実装が必要",
          "Middleware で認証を追加可能",
        ]
      : [
          "Uses App Router (Next.js 13+)",
          "Database connection needs separate implementation",
          "Can add authentication via middleware",
        ],
    envVars: {
      DATABASE_URL: "postgresql://user:pass@localhost/db",
    },
    isJapanese,
  });
}
