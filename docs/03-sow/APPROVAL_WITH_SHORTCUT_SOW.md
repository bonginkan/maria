# APPROVAL WITH SHORTCUT SOW - Human-in-the-Loop Approval System

**Project**: MARIA Platform - Human-in-the-Loop Approval System with Keyboard Shortcuts  
**Scope**: Theme-level approval confirmation with quick decision shortcuts  
**Timeline**: Phase 1 Implementation  
**Priority**: Critical - Core Human-AI Collaboration Feature

## 🎯 Executive Summary

MARIA CODEに革新的なHuman-in-the-Loop承認システムを実装。Shift+Tabによる高速決定を中心とした、ユーザーフレンドリーな承認フローを構築。

**Core Value Propositions:**

- **Human-AI Collaboration**: AIの提案に対するユーザー承認フロー
- **Task-level Granularity**: タスクレベルでの細かな制御とプレビュー
- **Quick Decision Making**: キーボードショートカットによる高速判断
- **Intelligent Context**: AIによる文脈理解と最適化
- **Trust Building**: ユーザーとAIの信頼関係構築

## 🏗️ Technical Architecture

### Core Components

#### 1. **Approval Engine** (`src/services/approval-engine/`)

```typescript
interface ApprovalTheme {
  id: string;
  category: 'architecture' | 'implementation' | 'refactoring' | 'security' | 'performance';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  suggestedApproach: string;
  alternatives?: string[];
  requiresConfirmation: boolean;
}

interface ApprovalRequest {
  themeId: string;
  context: TaskContext;
  proposedActions: ProposedAction[];
  rationale: string;
  riskAssessment: RiskLevel;
  estimatedTime: string;
  dependencies: string[];
}
```

#### 2. **Quick Decision Interface** (`src/services/quick-approval/`)

```typescript
interface QuickApprovalOptions {
  options: [
    { key: '1'; text: 'すべて承認して実行'; action: 'approve' },
    { key: '2'; text: '拒否して停止'; action: 'reject' },
    { key: '3'; text: '詳細確認して継続'; action: 'review' },
    { key: '4'; text: '信頼して自動実行'; action: 'trust' },
  ];
  shortcuts: {
    'shift+tab': 'approve'; // 高速承認
    'ctrl+y': 'approve'; // Yes
    'ctrl+n': 'reject'; // No
    'ctrl+r': 'review'; // Review
    'ctrl+t': 'trust'; // Trust/信頼
  };
}
```

#### 3. **Intelligent Context Analysis** (`src/services/approval-context/`)

```typescript
class ApprovalContextAnalyzer {
  async analyzeTaskForApproval(task: TaskRequest): Promise<ApprovalTheme[]> {
    // AI が分析:
    // - タスクの複雑性とリスクレベル
    // - 影響範囲と副作用の可能性
    // - セキュリティ上の懸念事項
    // - パフォーマンスへの影響
    // - 可逆性の有無
  }

  identifyApprovalPoints(task: TaskRequest): ApprovalPoint[] {
    // 重要な決定ポイントを特定:
    // - ファイル作成/削除の決定
    // - 外部APIへの接続決定
    // - データベース変更
    // - セキュリティ設定の変更
    // - API設計の決定
  }
}
```

### Integration Architecture

#### 4. **Interactive Session Integration** (`src/services/interactive-session.ts`)

```typescript
// 既存のインタラクティブセッションに承認フローを統合
class EnhancedInteractiveSession {
  private approvalEngine: ApprovalEngine;
  private quickApproval: QuickApprovalInterface;

  async processUserRequest(input: string): Promise<void> {
    // 1. リクエスト解析
    const taskRequest = await this.intelligentRouter.parseRequest(input);

    // 2. 承認が必要かを分析
    const approvalThemes = await this.approvalEngine.analyzeTask(taskRequest);

    // 3. 重要な変更の場合は承認を求める
    if (approvalThemes.length > 0) {
      const approval = await this.requestThemeApproval(approvalThemes);
      if (!approval.approved) return;
    }

    // 4. タスク実行
    await this.executeTask(taskRequest);
  }
}
```

#### 5. **Hotkey Integration** (既存 `src/services/hotkey-manager.ts` 拡張)

```typescript
// 既存HotkeyManagerを拡張
const approvalHotkeys: HotkeyBinding[] = [
  {
    key: 'tab',
    modifiers: ['shift'],
    command: '/approve',
    args: ['quick'],
    description: 'Quick approve current request',
    context: 'approval',
    enabled: true,
  },
  {
    key: 'y',
    modifiers: ['ctrl'],
    command: '/approve',
    args: ['yes'],
    description: 'Approve and proceed',
    context: 'approval',
    enabled: true,
  },
  {
    key: 't',
    modifiers: ['ctrl'],
    command: '/approve',
    args: ['trust'],
    description: 'Trust and auto-approve similar requests',
    context: 'approval',
    enabled: true,
  },
];
```

## 🎨 User Experience Design

### Approval Flow Examples

#### Example 1: 認証システム実装

```bash
maria> "ユーザー認証システムを実装して"

> [⚡ Thinking...]

  ┌─ 🔍 Approval Required ──────────────────────────────────────────┐
  │                                                                │
  │ 🎯 Theme: Architecture Design                                  │
  │ 📝 タスク: ユーザー認証システムの実装                              │
  │                                                                │
  │ 🔧 Proposed Approach:                                         │
  │ • JWT-based authentication with refresh tokens                │
  │ • bcrypt for password hashing                                 │
  │ • Rate limiting for login attempts                            │
  │ • Session management with Redis                               │
  │                                                                │
  │ 📊 Impact: High (Security-critical component)                  │
  │ ⏱️  Estimated Time: 2-3 hours                                  │
  │ 🔒 Security Considerations: Yes                                │
  │                                                                │
  │ すべて承認して実行しますか？                                      │
  │                                                                │
  │ Options:                                                       │
  │ ▶ 1. すべて承認して実行        [Shift+Tab]                      │
  │   2. 拒否して停止            [Ctrl+N]                          │
  │   3. 詳細確認して継続          [Ctrl+R]                          │
  │   4. 信頼して自動実行          [Ctrl+T]                          │
  │                                                                │
  └────────────────────────────────────────────────────────────────┘
```

#### Example 2: パフォーマンス最適化

```bash
maria> "この関数のパフォーマンスを改善して"

> [⚡ Optimizing...]

  ┌─ 🚀 Quick Approval ─────────────────────────────────────────────┐
  │                                                                │
  │ 🎯 Theme: Performance Optimization                             │
  │ 📝 Task: Code refactoring for better performance              │
  │                                                                │
  │ 🔧 Changes:                                                   │
  │ • Convert O(n²) algorithm to O(n log n)                       │
  │ • Add memoization for repeated calculations                   │
  │ • Replace nested loops with Map/Set operations               │
  │                                                                │
  │ 📊 Impact: Medium (Performance improvement)                    │
  │ ⚡ Expected Improvement: 80% faster execution                  │
  │                                                                │
  │ > AI推奨: このパフォーマンス改善は安全です                        │
  │                                                                │
  │ Quick Decision: [Shift+Tab] to approve and proceed            │
  │                                                                │
  └────────────────────────────────────────────────────────────────┘
```

### Progressive Trust System

#### Trust Level Evolution

```typescript
enum TrustLevel {
  NOVICE = 'novice', // 初心者: すべて承認が必要
  LEARNING = 'learning', // 学習中: 重要な操作のみ承認
  COLLABORATIVE = 'collaborative', // 協調的: 高リスクのみ承認
  TRUSTED = 'trusted', // 信頼済み: クリティカルのみ承認
  AUTONOMOUS = 'autonomous', // 自律的: ほぼ自動実行
}

interface TrustSettings {
  currentLevel: TrustLevel;
  autoApprovalCategories: ApprovalCategory[];
  requireApprovalFor: ApprovalCategory[];
  learningMetrics: {
    successfulTasks: number;
    userSatisfaction: number;
    errorsEncountered: number;
  };
}
```

## 🔧 Implementation Details

### Phase 1: Core Approval System (Week 1-2)

#### Files to Create:

```bash
src/services/approval-engine/
├── ApprovalEngine.ts              # Main approval coordination
├── ApprovalThemeRegistry.ts       # Predefined approval themes
├── ApprovalContextAnalyzer.ts     # Task analysis for approval needs
├── ApprovalRequestBuilder.ts      # Build approval requests
├── RiskAssessment.ts             # Risk level calculation
└── types.ts                      # TypeScript definitions

src/services/quick-approval/
├── QuickApprovalInterface.ts      # UI for quick decisions
├── ShortcutManager.ts            # Keyboard shortcut handling
├── ApprovalRenderer.ts           # Beautiful CLI rendering
└── ProgressTracker.ts            # Track approval patterns
```

#### Files to Modify:

```bash
src/services/interactive-session.ts    # Add approval flow integration
src/services/hotkey-manager.ts         # Add approval-specific shortcuts
src/services/slash-command-handler.ts  # Add /approve command
src/services/intelligent-router/       # Add approval context analysis
```

### Phase 2: Advanced Features (Week 3-4)

#### Smart Approval Features:

1. **Learning Algorithm**: ユーザーの承認パターン学習
2. **Context-Aware Suggestions**: 文脈に応じた推奨オプション
3. **Batch Approval**: 複数タスクの一括承認
4. **Approval Templates**: よく使う承認パターンのテンプレート化
5. **Integration Testing**: 承認システムの統合テスト

#### Advanced UI Features:

```typescript
// Rich CLI rendering with real-time updates
class ApprovalRenderer {
  renderApprovalRequest(request: ApprovalRequest): string {
    // Beautiful ASCII art UI with:
    // - Color-coded risk levels
    // - Progress indicators
    // - Interactive selection
    // - Real-time shortcut hints
    // - Context-sensitive help
  }

  renderQuickDecision(options: QuickApprovalOptions): void {
    // Compact approval interface with:
    // - Single-line decision prompt
    // - Keyboard shortcut display
    // - Auto-timeout for low-risk items
    // - Visual feedback on selection
  }
}
```

### Phase 3: Enterprise Integration (Week 5-6)

#### Integration Features:

1. **Audit Trail**: 承認履歴の詳細記録
2. **Team Collaboration**: チーム内の承認共有
3. **Policy Engine**: 企業ポリシーに基づく承認ルール
4. **Analytics Dashboard**: 承認パターンの分析ダッシュボード
5. **CI/CD Integration**: 継続的統合パイプラインとの連携

## 📊 Success Metrics

### Key Performance Indicators:

- **Decision Speed**: 承認決定速度 (target: <5 seconds)
- **Trust Evolution**: ユーザーの信頼レベル向上率 (target: 80% reach collaborative level)
- **Error Reduction**: エラー発生率の削減 (target: 95% error prevention)
- **User Satisfaction**: ユーザー満足度 (target: 4.5/5.0)
- **Automation Rate**: 自動化率 (target: 70% autonomous execution)

### Quality Metrics:

- **False Positives**: 誤検知率 (target: <10%)
- **False Negatives**: 見逃し率 (target: <2%)
- **Response Accuracy**: AI推奨の正確性 (target: >95%)
- **Context Understanding**: 文脈理解精度 (target: >90%)

## 🎯 Implementation Priorities

### Critical Path:

1. **Core Approval Engine** - 基本承認システム
2. **Quick Decision Interface** - Shift+Tabショートカット
3. **Interactive Session Integration** - 既存セッションとの統合
4. **Risk Assessment** - リスクレベル判定システム
5. **Trust System** - ユーザー信頼度システム

### Nice-to-Have Features:

- Voice confirmation support
- Mobile companion app for remote approvals
- AI explanation generation for complex decisions
- Multi-language approval interface
- Integration with external approval systems

## 🧪 Testing Strategy

### Unit Tests:

```bash
src/services/approval-engine/__tests__/
├── ApprovalEngine.test.ts
├── RiskAssessment.test.ts
├── ApprovalContextAnalyzer.test.ts
└── QuickApprovalInterface.test.ts
```

### Integration Tests:

```bash
src/__tests__/integration/
├── approval-flow.test.ts
├── shortcut-integration.test.ts
├── interactive-session-approval.test.ts
└── trust-level-progression.test.ts
```

### User Experience Tests:

- A/B testing for approval UI designs
- Response time measurement
- User satisfaction surveys
- Accessibility testing for keyboard navigation

## 🚀 Deployment Plan

### Phase 1 Release (MVP):

- Basic approval themes (5 categories)
- Core keyboard shortcuts (Shift+Tab, Ctrl+Y/N)
- Simple trust level system (3 levels)
- Integration with existing commands

### Phase 2 Release (Enhanced):

- Advanced approval themes (15+ categories)
- Learning algorithm for pattern recognition
- Rich CLI rendering with animations
- Comprehensive keyboard shortcut system

### Phase 3 Release (Enterprise):

- Full audit trail and analytics
- Team collaboration features
- Policy engine integration
- Advanced trust system (5 levels)

## 🎯 Expected Outcomes

この革新的なHuman-in-the-Loopシステムにより、MARIA CODEは以下を実現します:

1. **ユーザー制御**: AIの提案に対する適切なユーザー制御
2. **信頼性向上**: 段階的な信頼関係構築による品質向上
3. **効率性**: ユーザーの習熟に応じた承認フロー最適化
4. **透明性**: 承認プロセスの可視化と説明可能性
5. **学習効果**: 承認パターン学習による継続的改善

このシステムは、AIとユーザーの理想的な協働関係を築き、MARIA CODEをより信頼できる開発パートナーとして確立します。

## 🚀 Phase 2.5: Git-like Approval History System (Revolutionary Enhancement)

### 🎯 Git-Inspired Approval Management

```typescript
// Git-inspired approval versioning system
interface ApprovalCommit {
  id: string; // Unique commit hash (SHA-like)
  parentCommits: string[]; // Previous approval states
  approvalData: ApprovalResponse;
  metadata: {
    timestamp: Date;
    author: string;
    message: string; // Approval commit message
    tags: string[]; // e.g., ["security-review", "architecture"]
  };
  diff: ApprovalDiff; // Changes from previous state
}

interface ApprovalBranch {
  name: string; // e.g., "feature/auth-system", "hotfix/security"
  head: string; // Current commit ID
  approvalPath: ApprovalCommit[];
  mergeRequests: ApprovalMergeRequest[];
}

interface ApprovalMergeRequest {
  id: string;
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch: string;
  approvals: ApprovalReview[];
  status: 'pending' | 'approved' | 'rejected' | 'merged';
  githubPrNumber?: number; // GitHub PR integration
  gitlabMrId?: number; // GitLab MR integration
}

interface ApprovalRepository {
  branches: Map<string, ApprovalBranch>;
  commits: Map<string, ApprovalCommit>;
  remotes: GitRemoteIntegration[];
  config: ApprovalRepoConfig;
}
```

### 🔄 Git Integration Architecture

#### Core Git-like Features:

1. **Approval Commits**: 各承認決定をcommitとして永続化
   - SHA-like hash generation for approval states
   - Parent-child relationships for approval history
   - Commit messages with semantic approval descriptions
   - Automatic timestamping and author tracking

2. **Approval Branching**: 複数の承認パスを並行管理
   - Feature branches for approval workflows (`approval/feature/auth-system`)
   - Hotfix branches for emergency approvals (`approval/hotfix/security-patch`)
   - Release branches for deployment approvals (`approval/release/v1.2.0`)
   - Master/main branch for production approvals

3. **Merge Request Integration**: 承認フローをPR/MRワークフローに統合
   - Automatic GitHub PR creation for approval requests
   - GitLab MR integration with approval status sync
   - Code review integration with approval decisions
   - Automated branch protection rules

4. **Version Control Commands**: Git-like CLI commands
   ```bash
   maria approval log                    # Show approval history
   maria approval branch feature/auth    # Create approval branch
   maria approval merge main            # Merge approval branch
   maria approval revert <commit-hash>  # Revert approval decision
   maria approval tag v1.0.0           # Tag approval milestone
   maria approval push origin main     # Sync to GitHub/GitLab
   ```

### 🏗️ Implementation Components

#### Files to Create:

```bash
src/services/approval-git/
├── ApprovalRepository.ts         # Git-like repository management
├── ApprovalCommit.ts            # Commit creation and management
├── ApprovalBranch.ts            # Branch operations
├── ApprovalMergeRequest.ts      # MR/PR integration
├── GitHubIntegration.ts         # GitHub API integration
├── GitLabIntegration.ts         # GitLab API integration
├── ApprovalDiff.ts              # Diff generation for approval changes
└── types.ts                     # Git-specific type definitions

src/commands/
├── approval-log.ts              # Show approval history
├── approval-branch.ts           # Branch management
├── approval-merge.ts            # Merge operations
└── approval-revert.ts           # Rollback functionality
```

### 🔗 GitHub/GitLab Integration Features

#### 1. **Real-time Synchronization**

- Bidirectional sync between MARIA approvals and GitHub PRs
- Automatic PR status updates based on approval decisions
- GitLab MR integration with approval status reflection
- Branch protection rule enforcement

#### 2. **Automated Workflow Integration**

```yaml
# .github/workflows/maria-approval.yml
name: MARIA Approval Integration
on:
  pull_request:
    types: [opened, synchronize]
jobs:
  approval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: MARIA Approval Check
        uses: bonginkan/maria-approval-action@v1
        with:
          approval-level: collaborative
          auto-approve: low-risk
```

#### 3. **Advanced GitHub/GitLab Features**

- **PR Template Integration**: Automatic approval request templates
- **Status Checks**: MARIA approval as required status check
- **Review Assignment**: Automatic reviewer assignment based on approval category
- **Labels Management**: Automatic labeling based on risk level and category
- **Milestone Integration**: Link approvals to project milestones

### 📊 Advanced Approval Analytics

#### Git-inspired Metrics:

- **Approval Velocity**: Commits per time period
- **Branch Merge Frequency**: Feature approval completion rate
- **Conflict Resolution**: Approval conflicts and resolution patterns
- **Contributor Analysis**: User approval patterns and expertise areas
- **Risk Trend Analysis**: Risk level changes over time

### 🎯 Usage Examples

#### Basic Git-like Workflow:

```bash
# Start new approval workflow
maria> /approval branch feature/payment-system
✅ Created approval branch: feature/payment-system

# Make approval decisions (commits)
maria> "Implement payment gateway integration"
┌─ 📋 Approval Required ─────────────────────────────────────────┐
│ 🎯 Theme: Third-party Integration                              │
│ 📝 Task: Payment gateway API integration                       │
│ 📊 Risk: High                                                  │
│ Options: [Shift+Tab] Approve | [Ctrl+N] Reject                │
└────────────────────────────────────────────────────────────────┘
[Shift+Tab] → Approved

✅ Approval committed: a7f3k2d "Approve payment gateway integration"

# View approval history
maria> /approval log
commit a7f3k2d - Approve payment gateway integration (2 minutes ago)
├── Risk: High → Approved
├── Category: Implementation
└── Author: user@company.com

# Merge to main approval branch
maria> /approval merge main
✅ Merged feature/payment-system → main
🔗 GitHub PR #123 automatically updated: ✅ Approved

# Sync with GitHub
maria> /approval push origin main
🔗 Synced approval decisions to GitHub
📋 Updated PR status checks
🏷️  Added approval labels
```

### 🚀 Revolutionary Benefits

1. **Complete Approval Traceability**: Git-like history for all approval decisions
2. **Distributed Approval Workflows**: Multiple approval paths with merge capabilities
3. **GitHub/GitLab Native Integration**: Seamless PR/MR workflow integration
4. **Rollback Safety**: Revert approval decisions with full context preservation
5. **Team Collaboration**: Shared approval repository with conflict resolution
6. **Compliance Audit Trail**: Enterprise-grade approval documentation
7. **Automated CI/CD Integration**: Approval-gated deployment pipelines

この革新的な機能により、MARIA CODEは世界初の「Approval-as-Code」プラットフォームとなり、開発ワークフローとガバナンスを完全に統合します。
