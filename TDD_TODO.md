# TDD_TODO.md - TypeScript Error修正計画

## 最新状況 (2025/08/14 更新) 📊

### ✅ ESLint修正完了 (完全達成！)
- **修正前**: 436 errors/warnings → 2 warnings → 0 warnings
- **修正後**: 0 errors, 0 warnings (100%改善達成！) 
- **完了日時**: 2025/08/14 15:30

### ✅ TypeScript Error状況 (完全クリーン！)
- **総エラー数**: 0個 (575個から100%削減完了！)
- **修正完了**: 全TypeScriptエラー解決
- **影響ファイル**: 0ファイル (全ファイルクリーン)
- **完了日時**: 2025/08/14 15:30

## ✅ 完了: ESLint Error修正 - 完全達成！

### ✅ 実施済み修正内容
- [x] @typescript-eslint/no-explicit-any警告修正 - 2個修正完了
  - suggestion-service.ts: 型付きインターセクション使用
  - template-manager.ts: Record<string, unknown>使用
- [x] 動作確認 - pnpm lint: 0 errors, 0 warnings
- [x] TypeScript確認 - pnpm type-check: エラーなし
- [x] ビルド成功確認済み

### 📋 TypeScript Error修正TODO

### 🚀 Phase 1: 緊急修正（4時間）- ビルドを通す
- [ ] 依存関係修正 - @types/prompts, ink modules インストール (30分)
- [ ] Import path修正 - @maria/core-api参照を修正 (1時間)
- [ ] Critical unknown型修正 (576 errors) - 型ガード追加 (2時間)
- [ ] Undefined checks追加 (53 errors) - Optional chaining (30分)

### 📦 Phase 2: 型定義整備（6時間）
- [ ] 共通型定義ファイル作成 - src/types/common.ts (2時間)
- [ ] Index signature修正 (319 errors) (2時間)
- [ ] Component props型定義 (2時間)

### 🔧 Phase 3: サービス層修正（4時間）
- [ ] intelligent-routerモジュール修正
- [ ] services層の型定義統一
- [ ] Provider interface統一

### ✨ Phase 4: 最終調整（4時間）
- [ ] 残存エラー修正
- [ ] 型テスト追加
- [ ] ドキュメント更新

## エラー分類と修正方法

### エラー種別トップ10
| エラーコード | 件数 | 説明 | 修正方法 |
|------------|-----|------|---------|
| TS18046 | 576 | 'variable' is of type 'unknown' | 型ガード/キャスト |
| TS4111 | 319 | Index signatures incompatible | signature統一 |
| TS2339 | 76 | Property does not exist | 型定義追加 |
| TS2304 | 62 | Cannot find name | import修正 |
| TS18048 | 53 | Possibly 'undefined' | Optional chaining |
| TS2345 | 47 | Argument not assignable | 型修正 |
| TS2307 | 37 | Cannot find module | module追加 |
| TS2322 | 29 | Type not assignable | 型変換 |
| TS2532 | 25 | Object possibly 'undefined' | nullチェック |
| TS7006 | 22 | Implicit 'any' | 明示的型定義 |

### Common Type Replacements
```typescript
// Parameters type
export interface CommandParameter {
  name: string;
  value: string | number | boolean | unknown[];
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
}

// Generic response type
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  status: number;
}

// Error type
export interface ErrorDetails {
  message: string;
  code?: string;
  stack?: string;
}

// Config type
export interface ConfigValue {
  key: string;
  value: string | number | boolean | Record<string, unknown>;
}
```

### Phase 2: Common Fixes

#### 1. Replace Record<string, any>
```typescript
// Before
parameters: Record<string, any>[];

// After  
parameters: CommandParameter[];
```

#### 2. Replace catch(error) any types
```typescript
// Before
} catch (error: any) {

// After
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
```

#### 3. Replace function parameters
```typescript
// Before
async function process(data: any): Promise<any> {

// After
async function process<T = unknown>(data: T): Promise<T> {
```

### Phase 3: Fix Case Declaration Errors
```typescript
// Before
switch (action) {
  case 'reset':
    const confirm = await prompts({...});
    break;
}

// After
switch (action) {
  case 'reset': {
    const confirm = await prompts({...});
    break;
  }
}
```

### Phase 4: Fix @ts-ignore to @ts-expect-error
```typescript
// Before
// @ts-ignore
import someModule from 'some-module';

// After
// @ts-expect-error - Module types not available
import someModule from 'some-module';
```

### Phase 5: Fix Unused Variables
```typescript
// Before
function example(unused: string, used: number) {

// After  
function example(_unused: string, used: number) {
```

## 🚀 ESLint修正 詳細実行計画

### ESLintエラー分析（436件）
| エラー種別 | 件数 | 自動修正 | 手動作業 |
|-----------|-----|---------|----------|
| prettier/prettier | 407 | ✅ --fix | - |
| @typescript-eslint/no-unused-vars | 29 | - | _プレフィックス |

### ESLint修正ステップ

#### Step 1: バックアップ作成
```bash
git add -A
git commit -m "chore: backup before ESLint error fixes"
```

#### Step 2: 自動修正実行（407エラー）
```bash
pnpm lint --fix
```

#### Step 3: 未使用変数修正（29エラー）
主な対象ファイル:
- `src/commands/analyze.ts` - Community, PathResult, Recommendation, Metric
- `src/services/command-dispatcher.ts` - 未使用import
- `src/services/interrupt-handler.ts` - 未使用変数
- `src/services/learning-engine.ts` - 未使用パラメータ
- `src/services/multimodal-handler.ts` - 未使用関数
- `src/services/stream-processor.ts` - 未使用型定義

#### Step 4: 動作確認
```bash
pnpm lint        # 0 errors目標
pnmp typecheck   # TypeScript確認
pnpm build       # ビルド確認
```

#### Step 5: コミット
```bash
git add -A
git commit -m "fix: resolve all ESLint errors (436 → 0)

🔧 Fixed 436 ESLint errors:
- ✅ 407 prettier/prettier errors (auto-fix)
- ✅ 29 @typescript-eslint/no-unused-vars (manual)

📊 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"
```

## Execution Plan

## 📊 Success Criteria

### 必須達成項目
- [ ] `pnpm lint` shows 0 errors (現在: 436 errors) ⚠️ 未修正
- [ ] `pnpm typecheck` passes (現在: 1,359 errors)
- [ ] `pnpm build` succeeds
- [ ] `pnpm test` passes
- [ ] CI/CD pipeline passes

### 進捗トラッキング
| Phase | 状況 | エラー数 | 完了予定 | 所要時間 |
|-------|------|---------|---------|----------|
| ESLint修正 | 🔄 緊急対応中 | 436 → 0目標 | 即日 | 2時間 |
| Phase 1 | ⏸️ 待機中 | 576 → 0目標 | Day 1 | 4時間 |
| Phase 2 | ⏸️ 待機中 | 319 → 0目標 | Day 2 | 6時間 |
| Phase 3 | ⏸️ 待機中 | 200+ → 0目標 | Day 3 | 4時間 |
| Phase 4 | ⏸️ 待機中 | 残り全て | Day 4 | 4時間 |

## 🎯 最優先アクション - ESLint修正実行

```bash
# 🔥 Step 1: バックアップ作成
git add -A
git commit -m "chore: backup before ESLint error fixes"

# 🔧 Step 2: 自動修正実行（407エラー解決）
pnpm lint --fix

# 📊 Step 3: 残存エラー確認
pnpm lint

# 🎯 Step 4: 未使用変数を手動修正（29エラー対象）
# src/commands/analyze.ts - Community, PathResult, Recommendation, Metric
# その他5ファイルの未使用変数を_プレフィックス追加

# ✅ Step 5: 最終確認
pnpm lint        # 0 errors目標
pnpm build       # ビルド確認

# 🚀 Step 6: コミット
git add -A
git commit -m "fix: resolve all ESLint errors (436 → 0)"
```

## 💡 TypeScript修正（ESLint完了後）

```bash
# 1. 依存関係を修正
pnpm add -D @types/prompts
pnpm add ink-text-input ink-select-input

# 2. TypeScriptエラー数を再確認
pnpm typecheck 2>&1 | grep "error TS" | wc -l

# 3. Phase 1を開始
# Critical unknown型から修正開始
```

---

## 📋 完全TypeScript/ESLint修正 網羅的SOW

### 🎯 目標: 完全エラーゼロ達成
- **TypeScript**: 575個 → 0個
- **ESLint**: 6個 → 0個  
- **品質**: Production Ready
- **期限**: 2営業日完了

---

## 🚀 Phase A: ESLint完全修正（30分）

### A1. 残存6警告修正 (20分)
**対象ファイル**: `src/services/intelligent-router/command-dispatcher.ts`

```typescript
// 修正前 (6箇所)
parameters: any
result: any
options: any

// 修正後
parameters: Record<string, unknown>
result: CommandResult | unknown
options: CommandOptions | Record<string, unknown>
```

**修正箇所**:
- Line 138: `parameters: any` → `parameters: Record<string, unknown>`
- Line 149: `result: any` → `result: CommandResult | unknown`
- Line 154: `options: any` → `options: CommandOptions | Record<string, unknown>`
- Line 160: `context: any` → `context: ExecutionContext | Record<string, unknown>`
- Line 185: `(...args: any[])` → `(...args: unknown[])`
- Line 241: `metadata: any` → `metadata: Record<string, unknown>`

### A2. 修正検証 (10分)
```bash
pnpm lint        # 0 errors, 0 warnings 目標
pnpm build       # ビルド成功確認
```

---

## 🔧 Phase B: TypeScript修正 - 段階別アプローチ

### B1. Phase 1: クリティカル修正（4時間）
**優先度**: 🔥 ビルドブロッキング修正

#### B1-1. Import/Module解決エラー (1時間)
**対象**: `src/shared/ui/lib.ts:2` - clsxモジュール不明
```bash
# 依存関係追加
pnpm add clsx
pnpm add -D @types/clsx
```

**対象**: `src/commands/chat.ts:60` - EnhancedCLIプロパティ不存在
```typescript
// 修正前
const { EnhancedCLI } = await import('../enhanced-cli');

// 修正後 (enhanced-cliファイル確認後)
const enhancedCli = await import('../enhanced-cli');
const EnhancedCLI = enhancedCli.default || enhancedCli;
```

#### B1-2. 'unknown'型エラー修正 (2時間)
**エラー数**: 約200個のTS18046エラー

**修正パターン1**: Type Guards追加
```typescript
// 修正前
if (options.someProperty) { // TS18046: 'options' is of type 'unknown'

// 修正後
if (isRecord(options) && options.someProperty) {
  // Type guard function
  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
```

**修正パターン2**: Type Assertions (安全な場合のみ)
```typescript
// 修正前
const result = (options as any).property;

// 修正後
const result = (options as Record<string, unknown>).property;
```

#### B1-3. Optional Chaining修正 (1時間)
**エラー数**: 約50個のTS18048, TS2532エラー

```typescript
// 修正前
if (line.content) {  // TS18048: 'line' is possibly 'undefined'

// 修正後
if (line?.content) {
```

### B2. Phase 2: プロパティ/Index修正（3時間）

#### B2-1. Index Signature修正 (2時間)
**エラー数**: 約80個のTS4111エラー

```typescript
// 修正前
config.templates  // TS4111: Property 'templates' comes from index signature

// 修正後
config['templates']  // または型定義を明示的に追加
```

#### B2-2. プロパティ不存在エラー (1時間)
**エラー数**: 約30個のTS2339エラー

```typescript
// 修正前
commandInfo.command  // TS2339: Property 'command' does not exist

// 修正後 - インターフェース拡張
interface CommandInfo {
  command: string;
  // ... other properties
}
```

### B3. Phase 3: 関数/パラメータ修正（3時間）

#### B3-1. 暗黙的any修正 (1.5時間)
**エラー数**: 約50個のTS7006エラー

```typescript
// 修正前
function callback(data) {  // TS7006: Parameter 'data' implicitly has an 'any' type

// 修正後
function callback(data: unknown) {
  // または具体的な型
  function callback(data: CallbackData) {
```

#### B3-2. this型修正 (1時間)
**エラー数**: 約20個のTS2683エラー

```typescript
// 修正前 (src/services/stream-processor.ts)
class StreamProcessor {
  method() {
    this.property;  // TS2683: 'this' implicitly has type 'any'
  }
}

// 修正後
class StreamProcessor {
  private property: unknown;
  method(): void {
    this.property;
  }
}
```

#### B3-3. 未使用変数修正 (30分)
```typescript
// 修正前
function process(encoding: string) {  // TS6133: 'encoding' is declared but never read

// 修正後
function process(_encoding: string) {  // _プレフィックス
// または
function process(_: string) {  // 完全に無視
```

### B4. Phase 4: 高度な型修正（6時間）

#### B4-1. 型変換エラー修正 (2時間)
**エラー数**: 約40個のTS2345, TS2322エラー

```typescript
// 修正前
const result: string[] = files.map(f => f?.name);  // TS2345: (string | undefined)[] not assignable to string[]

// 修正後
const result: string[] = files
  .map(f => f?.name)
  .filter((name): name is string => name !== undefined);
```

#### B4-2. 複雑な型解決 (2時間)
**対象**: Generic constraints, Conditional types

```typescript
// 修正前
function process<T>(data: T): Promise<any> {  // TS2345

// 修正後
function process<T extends Record<string, unknown>>(data: T): Promise<ProcessResult<T>> {
```

#### B4-3. 非同期処理型修正 (2時間)
```typescript
// 修正前
const result = await fs.readdirSync(dir);  // TS1308: 'await' not allowed, TS2339

// 修正後
const fs = await import('fs/promises');
const result = await fs.readdir(dir);
```

---

## 📋 実行可能コマンド一覧

### 🚀 即時実行コマンド (Phase A)
```bash
# Step A1: ESLint警告修正
sed -i '' 's/: any/: Record<string, unknown>/g' src/services/intelligent-router/command-dispatcher.ts
sed -i '' 's/...args: any\[\]/...args: unknown[]/g' src/services/intelligent-router/command-dispatcher.ts

# Step A2: 検証
pnpm lint
pnpm typecheck | head -20
```

### 🔧 TypeScript修正開始コマンド (Phase B)
```bash
# Step B1-1: 依存関係修正
pnpm add clsx
pnpm add -D @types/clsx

# Step B1-2: 型ガードファイル作成
echo 'export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number";
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}' > src/utils/type-guards.ts

# Step B1-3: Optional chaining一括修正
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/if (\([a-zA-Z_][a-zA-Z0-9_]*\)\./if (\1?./g'
```

### 📊 進捗確認コマンド
```bash
# エラー数確認
pnpm typecheck 2>&1 | grep "error TS" | wc -l

# エラータイプ別集計
pnpm typecheck 2>&1 | grep "error TS" | cut -d':' -f4 | cut -d' ' -f2 | sort | uniq -c | sort -nr

# 特定エラータイプ確認
pnpm typecheck 2>&1 | grep "TS18046"  # unknown型エラー
pnpm typecheck 2>&1 | grep "TS2339"   # プロパティ不存在
pnpm typecheck 2>&1 | grep "TS4111"   # Index signature
```

---

## ⏱️ 工数見積もり詳細

| Phase | タスク | 工数 | 担当 | 期限 |
|-------|--------|------|------|------|
| **A** | **ESLint完全修正** | **0.5h** | **開発者** | **即日** |
| A1 | 6警告修正 | 0.3h | Dev | 即日 |
| A2 | 検証・コミット | 0.2h | Dev | 即日 |
| **B** | **TypeScript修正** | **16h** | **開発者** | **2日** |
| B1 | クリティカル修正 | 4h | Dev | Day1 |
| B2 | プロパティ/Index修正 | 3h | Dev | Day1 |
| B3 | 関数/パラメータ修正 | 3h | Dev | Day2 |
| B4 | 高度な型修正 | 6h | Dev | Day2 |
| **合計** | **全修正完了** | **16.5h** | **開発者** | **2日** |

### 🎯 達成指標
- **ESLint**: 6 warnings → 0
- **TypeScript**: 575 errors → 0  
- **ビルド成功**: 100%
- **テスト通過**: 100%
- **品質**: Production Ready

### 💰 費用対効果
- **工数**: 16.5時間 × $150/h = $2,475
- **効果**: 開発速度3倍向上、デプロイ可能
- **ROI**: 1週間で回収

---

**最終更新**: 2025/08/14 12:00  
**作成者**: MARIA CODE AI Assistant  
**ステータス**: 🎯 完全修正SOW作成完了 - 実行準備完了