# TypeScript Error Fix SOW (Statement of Work)

## 📊 現状分析 (2025/01/13)

### エラー統計
- **総エラー数**: 1,359個
- **影響ファイル数**: 約80ファイル
- **重要度**: CRITICAL (ビルドブロッカー)

### エラー分類
| エラーコード | 件数 | 説明 | 優先度 |
|------------|-----|------|-------|
| TS18046 | 576 | 'variable' is of type 'unknown' | P0 |
| TS4111 | 319 | Index signatures are incompatible | P0 |
| TS2339 | 76 | Property does not exist | P1 |
| TS2304 | 62 | Cannot find name | P1 |
| TS18048 | 53 | 'variable' is possibly 'undefined' | P1 |
| TS2345 | 47 | Argument type not assignable | P1 |
| TS2307 | 37 | Cannot find module | P0 |
| TS2322 | 29 | Type not assignable | P2 |
| TS2532 | 25 | Object possibly 'undefined' | P2 |
| TS7006 | 22 | Parameter implicitly has 'any' type | P2 |

## 🎯 修正戦略

### Phase 1: 緊急修正 (Day 1 - 4時間)
**目標**: ビルドを通す最小限の修正

#### 1.1 Missing Modules 修正 (37 errors)
```bash
# 不足モジュールのインストール
pnpm add -D @types/prompts
pnpm add ink-text-input ink-select-input

# @maria/core-api参照の修正
# src/commands/auto-improve.tsx内の不正なimportを修正
```

#### 1.2 Unknown型の明示的キャスト (576 errors)
```typescript
// Quick fix pattern
// Before
const value = someFunction(); // type: unknown
value.property; // Error TS18046

// After
const value = someFunction() as ExpectedType;
// または型ガード追加
if (typeof value === 'object' && value !== null && 'property' in value) {
  value.property; // OK
}
```

#### 1.3 Undefined チェック追加 (53 errors)
```typescript
// Before
line.trim() // Error if line is undefined

// After
line?.trim() || ''
```

### Phase 2: 型定義整備 (Day 2 - 6時間)

#### 2.1 共通型定義ファイル作成
```typescript
// src/types/common.ts
export interface CommandOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  verbose?: boolean;
  output?: string;
  format?: 'json' | 'text' | 'markdown';
}

export interface AnalysisResult {
  metrics: Record<string, number>;
  communities: Array<{
    id: string;
    name: string;
    nodes: string[];
    size: number;
  }>;
  paths: Array<{
    nodes: string[];
    cost: number;
    type: string;
  }>;
}

export interface Workflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface WorkflowStep {
  id: string;
  type: string;
  params: Record<string, unknown>;
  result?: unknown;
}
```

#### 2.2 Index Signature修正 (319 errors)
```typescript
// Before
interface BadIndex {
  [key: string]: string;
  specificProp: number; // Error: incompatible
}

// After
interface GoodIndex {
  [key: string]: string | number;
  specificProp: number; // OK
}
```

### Phase 3: 包括的リファクタリング (Day 3-4 - 8時間)

#### 3.1 型安全性の強化
- Generics活用でany/unknown削減
- 型ガード関数の実装
- Utility Types活用 (Partial, Required, Pick)

#### 3.2 エラーハンドリング改善
```typescript
// エラーハンドリング用ユーティリティ
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

export function getErrorMessage(error: unknown): string {
  if (isError(error)) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error occurred';
}
```

## 📋 実装計画

### Day 1 (4時間) - 緊急修正
- [ ] Missing modules インストール (30分)
- [ ] Import path 修正 (1時間)
- [ ] Critical unknown型修正 (2時間)
- [ ] Undefined checks追加 (30分)

### Day 2 (6時間) - 型定義整備
- [ ] 共通型定義ファイル作成 (2時間)
- [ ] Index signature修正 (2時間)
- [ ] Component props型定義 (2時間)

### Day 3 (4時間) - サービス層修正
- [ ] intelligent-router モジュール修正
- [ ] services層の型定義
- [ ] Provider interface統一

### Day 4 (4時間) - 最終調整
- [ ] 残存エラー修正
- [ ] 型テスト追加
- [ ] ドキュメント更新

## 🔧 修正手順

### Step 1: 依存関係修正
```bash
# 不足パッケージインストール
pnpm add -D @types/prompts @types/node
pnpm add ink-text-input ink-select-input

# キャッシュクリア
rm -rf node_modules .turbo
pnpm install
```

### Step 2: 自動修正実行
```bash
# 可能な限り自動修正
pnpm typecheck --noEmit 2>&1 | grep "TS2304\|TS2307" > missing-imports.txt
# missing-importsを元に修正
```

### Step 3: 段階的修正
```bash
# ファイル単位で修正
npx tsc --noEmit src/commands/bug.ts
# 修正
npx tsc --noEmit src/commands/bug.ts # 確認
```

### Step 4: 検証
```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm test
```

## 💰 コスト見積もり

### 工数
- **総工数**: 22時間 (3営業日)
- **優先度P0修正**: 4時間
- **優先度P1修正**: 10時間
- **優先度P2修正**: 8時間

### リソース
- **開発者**: 1名 (TypeScript熟練者)
- **レビュアー**: 1名 (4時間)

### 成果物
- ✅ TypeScriptエラー0達成
- ✅ 型定義ドキュメント
- ✅ 型安全性向上によるバグ削減
- ✅ IDE補完機能改善

## 🎯 成功基準

### 必須達成項目
- [ ] `pnpm typecheck`エラー0
- [ ] `pnpm build`成功
- [ ] CI/CDパイプライン通過

### 品質指標
- [ ] 型カバレッジ: 95%以上
- [ ] any型使用: 5箇所以下
- [ ] unknown型の適切な型ガード: 100%

## ⚠️ リスクと対策

### リスク1: 大規模な構造変更
**対策**: 段階的修正アプローチ採用

### リスク2: 実行時エラー増加
**対策**: 型ガード実装とテスト強化

### リスク3: パフォーマンス劣化
**対策**: 型チェックのビルド時実行のみ

## 📅 タイムライン

```
Day 1 (緊急修正) - 4時間
├── 09:00-09:30: 依存関係修正
├── 09:30-10:30: Import path修正
├── 10:30-12:30: Critical unknown型修正
└── 12:30-13:00: Undefined checks

Day 2 (型定義) - 6時間
├── 09:00-11:00: 共通型定義作成
├── 11:00-13:00: Index signature修正
├── 14:00-16:00: Component props型定義

Day 3 (サービス層) - 4時間
├── 09:00-11:00: intelligent-router修正
├── 11:00-13:00: services層修正

Day 4 (最終調整) - 4時間
├── 09:00-11:00: 残存エラー修正
├── 11:00-12:00: 型テスト追加
└── 12:00-13:00: ドキュメント更新
```

## 🚀 実行開始

```bash
# SOW承認後、以下のコマンドで開始
git checkout -b fix/typescript-errors
git add -A
git commit -m "chore: backup before TypeScript error fixes"

# Phase 1開始
./scripts/fix-typescript-phase1.sh
```

---

**作成日**: 2025/01/13  
**作成者**: MARIA CODE AI Assistant  
**承認者**: [Pending]  
**ステータス**: 計画中

## 次のアクション
1. このSOWのレビューと承認
2. 優先度P0エラーの即時修正開始
3. 段階的な型安全性向上

このSOWに従って修正を進めることで、TypeScriptエラーを体系的に解決し、コードベースの型安全性を大幅に向上させます。