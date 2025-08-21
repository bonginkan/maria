# Integrated CLI System SOW - Unified Interactive Experience

**Project**: MARIA CODE - Integrated CLI with Internal Modes, Active Reporting & Approval System  
**Version**: 1.0.0  
**Date**: 2025-08-21  
**Priority**: CRITICAL - Core User Experience

## 🎯 Executive Summary

統合型CLIシステムの実装により、ユーザー入力、AI応答、内部モード表示、アクティブレポーティング、承認システムを一体化した革新的なインタラクティブ体験を実現。

### Core Innovation Points

1. **Chalk Box Input System**: ユーザー入力専用の白枠チョークボックス
2. **External Response Display**: AI応答は枠外に内部モードと共に表示
3. **Real-time Mode Indicator**: 50種類の内部モードをリアルタイム表示
4. **Active Reporting Integration**: タスク進捗の能動的報告
5. **Inline Approval Flow**: Shift+Tab による高速承認システム

## 📐 Visual Design Specification

### Input Area (User Zone)
```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  > Write your command or question here...                                   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────┘
```

### Response Area (AI Zone)
```
[✽ Thinking...] Analyzing your request...

Task Planning:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Understanding requirements
2. Creating implementation plan
3. Executing changes

[✽ Coding...] Implementing solution...
```

## 🏗️ Technical Architecture

### 1. Integrated CLI Manager (`src/ui/integrated-cli/`)

```typescript
interface IntegratedCLIConfig {
  // Input configuration
  input: {
    promptSymbol: string;        // Default: '>'
    chalkBoxStyle: ChalkStyle;   // White border
    maxLineLength: number;       // 124 characters
    multilineMode: boolean;
  };
  
  // Response configuration
  response: {
    showInternalMode: boolean;   // Always true
    showProgressBar: boolean;
    showApprovalPrompts: boolean;
    animationSpeed: number;
  };
  
  // Mode display
  modeDisplay: {
    position: 'prefix' | 'suffix' | 'floating';
    format: string;              // '[{mode}]'
    updateInterval: number;      // 200ms
  };
}
```

### 2. Component Structure

```typescript
// Main CLI components
src/ui/integrated-cli/
├── IntegratedCLIManager.ts      # 統合マネージャー
├── InputBox.ts                  # チョークボックス入力
├── ResponseRenderer.ts          # AI応答レンダラー
├── ModeIndicator.ts            # 内部モード表示
├── ProgressReporter.ts         # 進捗レポート
├── ApprovalPrompt.ts           # 承認プロンプト
├── LayoutEngine.ts             # レイアウト管理
└── types.ts                    # 型定義
```

### 3. User Input Box Component

```typescript
export class InputBox {
  private readonly CHALK_BOX_CHARS = {
    TOP_LEFT: '┌',
    TOP_RIGHT: '┐',
    BOTTOM_LEFT: '└',
    BOTTOM_RIGHT: '┘',
    HORIZONTAL: '─',
    VERTICAL: '│',
    PROMPT: '>'
  };

  render(width: number = 124): void {
    // White chalk box with input prompt
    const border = chalk.white;
    const promptColor = chalk.cyan;
    
    // Top border
    console.log(border(
      this.CHALK_BOX_CHARS.TOP_LEFT + 
      this.CHALK_BOX_CHARS.HORIZONTAL.repeat(width - 2) +
      this.CHALK_BOX_CHARS.TOP_RIGHT
    ));
    
    // Input line with prompt
    console.log(
      border(this.CHALK_BOX_CHARS.VERTICAL) +
      ' ' +
      promptColor(this.CHALK_BOX_CHARS.PROMPT) +
      ' ' +
      // User input area (width - 6 for borders and prompt)
      ' '.repeat(width - 6) +
      border(this.CHALK_BOX_CHARS.VERTICAL)
    );
    
    // Bottom border
    console.log(border(
      this.CHALK_BOX_CHARS.BOTTOM_LEFT + 
      this.CHALK_BOX_CHARS.HORIZONTAL.repeat(width - 2) +
      this.CHALK_BOX_CHARS.BOTTOM_RIGHT
    ));
  }
}
```

### 4. Response Renderer with Mode Display

```typescript
export class ResponseRenderer {
  private currentMode: InternalMode = '✽ Thinking...';
  private modeTransitions: Map<string, string[]> = new Map();
  
  renderWithMode(content: string, mode?: InternalMode): void {
    // Mode indicator outside the box
    const modeDisplay = chalk.yellow(`[${mode || this.currentMode}]`);
    const timestamp = chalk.gray(new Date().toLocaleTimeString());
    
    // Header with mode and time
    console.log(`${modeDisplay} ${timestamp}`);
    
    // Content rendering (outside the input box)
    console.log(content);
    
    // Progress or status if applicable
    if (this.hasActiveTask()) {
      this.renderTaskProgress();
    }
  }
  
  private renderTaskProgress(): void {
    const progress = this.getTaskProgress();
    const bar = this.createProgressBar(progress);
    console.log(chalk.dim(`Progress: ${bar} ${progress}%`));
  }
}
```

### 5. Internal Mode Integration

```typescript
export class ModeIndicator {
  private modes: InternalMode[] = [
    '✽ Thinking...',
    '✽ Ultra Thinking...',
    '✽ Researching...',
    '✽ Planning...',
    '✽ Coding...',
    '✽ Debugging...',
    '✽ Optimizing...',
    '✽ Reviewing...',
    '✽ Testing...',
    '✽ Documenting...',
    // ... 50 modes total
  ];
  
  private currentMode: InternalMode;
  private modeHistory: InternalMode[] = [];
  
  async transitionTo(newMode: InternalMode): Promise<void> {
    // Smooth transition animation
    await this.animateTransition(this.currentMode, newMode);
    this.currentMode = newMode;
    this.modeHistory.push(newMode);
    
    // Update display
    this.updateDisplay();
  }
  
  private async animateTransition(from: InternalMode, to: InternalMode): Promise<void> {
    // Fade out → change → fade in
    const steps = 3;
    for (let i = 0; i <= steps; i++) {
      const opacity = i / steps;
      process.stdout.write(`\r${chalk.gray.dim(from)} → ${chalk.yellow(to)}`);
      await this.delay(50);
    }
    process.stdout.write('\r' + ' '.repeat(50) + '\r');
  }
}
```

### 6. Active Reporting Integration

```typescript
export class ActiveReporter {
  private taskQueue: Task[] = [];
  private currentTask: Task | null = null;
  
  reportTaskStart(task: Task): void {
    this.currentTask = task;
    console.log(chalk.blue('━'.repeat(60)));
    console.log(chalk.bold('Task Starting:'), task.name);
    console.log(chalk.gray('Estimated time:'), task.estimatedTime);
    console.log(chalk.blue('━'.repeat(60)));
  }
  
  reportProgress(progress: number, detail?: string): void {
    const bar = this.createProgressBar(progress);
    process.stdout.write(`\r${bar} ${progress}% ${detail || ''}`);
  }
  
  reportCompletion(result: TaskResult): void {
    console.log('\n' + chalk.green('✓'), 'Task completed:', result.summary);
    if (result.changes) {
      console.log(chalk.gray('Changes made:'));
      result.changes.forEach(change => {
        console.log(chalk.gray('  •'), change);
      });
    }
  }
}
```

### 7. Approval System Integration

```typescript
export class ApprovalPrompt {
  async requestApproval(theme: ApprovalTheme): Promise<ApprovalDecision> {
    // Clear current line
    console.log('\n' + chalk.yellow('━'.repeat(60)));
    console.log(chalk.bold.yellow('⚠ Approval Required'));
    console.log(chalk.yellow('━'.repeat(60)));
    
    // Theme details
    console.log(chalk.cyan('Theme:'), theme.title);
    console.log(chalk.gray('Category:'), theme.category);
    console.log(chalk.gray('Impact:'), this.getImpactColor(theme.impact)(theme.impact));
    console.log(chalk.gray('Description:'), theme.description);
    
    // Proposed approach
    console.log('\n' + chalk.bold('Proposed Approach:'));
    console.log(theme.suggestedApproach);
    
    // Options
    console.log('\n' + chalk.bold('Quick Actions:'));
    console.log(chalk.green('  [Y]es') + ' - Approve and continue');
    console.log(chalk.yellow('  [M]odify') + ' - Suggest modifications');
    console.log(chalk.red('  [N]o') + ' - Reject this approach');
    console.log(chalk.blue('  [S]kip') + ' - Skip for now');
    console.log(chalk.gray('  [Shift+Tab]') + ' - Quick approve all similar');
    
    // Wait for input
    return await this.waitForDecision();
  }
  
  private getImpactColor(impact: string): ChalkFunction {
    const colors = {
      low: chalk.green,
      medium: chalk.yellow,
      high: chalk.orange,
      critical: chalk.red
    };
    return colors[impact] || chalk.white;
  }
}
```

## 🎮 User Interaction Flow

### 1. Standard Interaction
```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  > implement user authentication system                                    │
│                                                                            │
└──────────────────────────────────────────────────────────────────────────┘

[✽ Thinking...] 10:23:45
Analyzing requirements for user authentication system...

[✽ Planning...] 10:23:47
Creating implementation plan with 5 major components:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Task Breakdown:
  1. Database schema design
  2. User model implementation  
  3. Authentication middleware
  4. API endpoints
  5. Testing suite
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠ Approval Required
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Theme: Authentication Architecture
Category: security
Impact: high
Description: Implementing JWT-based authentication with refresh tokens

Proposed Approach:
- Use bcrypt for password hashing
- Implement JWT with 15min access token expiry
- Secure refresh token in httpOnly cookie
- Add rate limiting on auth endpoints

Quick Actions:
  [Y]es - Approve and continue
  [M]odify - Suggest modifications
  [N]o - Reject this approach
  [S]kip - Skip for now
  [Shift+Tab] - Quick approve all similar

Waiting for your decision...
```

### 2. Continuous Mode Display
```
[✽ Coding...] 10:24:15
Implementing user model...
Progress: ████████░░░░░░░░░░░░ 40% Creating schema

[✽ Testing...] 10:24:45  
Running unit tests...
Progress: ████████████████░░░░ 80% 24/30 tests passed

[✽ Optimizing...] 10:25:02
Optimizing database queries...
Progress: ████████████████████ 100% Complete
```

## 🚀 Implementation Phases

### Phase 1: Core CLI Structure (Week 1)
- [ ] Implement InputBox component with chalk styling
- [ ] Create ResponseRenderer with mode display
- [ ] Integrate ModeIndicator with 50 modes
- [ ] Setup basic layout engine

### Phase 2: Active Reporting (Week 2)
- [ ] Implement ActiveReporter
- [ ] Add progress tracking
- [ ] Create task breakdown display
- [ ] Integrate with existing task system

### Phase 3: Approval System (Week 3)
- [ ] Implement ApprovalPrompt
- [ ] Add keyboard shortcut handling
- [ ] Create approval history tracking
- [ ] Implement quick approval patterns

### Phase 4: Integration & Polish (Week 4)
- [ ] Full system integration
- [ ] Performance optimization
- [ ] Accessibility features
- [ ] Comprehensive testing

## 📊 Success Metrics

### User Experience
- Input latency: <50ms
- Mode transition: <200ms  
- Approval response: <100ms
- Overall satisfaction: >9/10

### Technical Performance
- Memory usage: <50MB
- CPU usage: <5% idle
- Render time: <16ms/frame
- Error rate: <0.1%

### Feature Adoption
- Approval system usage: >80%
- Quick shortcuts usage: >60%
- Mode visibility: 100%
- Active reporting engagement: >75%

## 🔧 Configuration

### Default Settings
```typescript
const DEFAULT_CONFIG: IntegratedCLIConfig = {
  input: {
    promptSymbol: '>',
    chalkBoxStyle: 'white',
    maxLineLength: 124,
    multilineMode: false
  },
  response: {
    showInternalMode: true,
    showProgressBar: true,
    showApprovalPrompts: true,
    animationSpeed: 50
  },
  modeDisplay: {
    position: 'prefix',
    format: '[{mode}]',
    updateInterval: 200
  }
};
```

## 🎨 Visual Examples

### Input State
```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  > |                                                                       │
│                                                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

### Processing State
```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  > implement feature                                                       │
│                                                                            │
└──────────────────────────────────────────────────────────────────────────┘

[✽ Ultra Thinking...] 10:30:15
Deep analysis in progress...
⠋ Analyzing codebase structure
⠙ Identifying dependencies
⠹ Planning implementation
⠸ Generating solution
```

### Completion State
```
[✽ Complete] 10:31:23
✓ Successfully implemented feature

Summary:
• Added 5 new components
• Modified 3 existing files
• Created 12 unit tests
• Updated documentation

All changes have been saved and tested.
```

## 📝 Notes

1. **Accessibility**: Full screen reader support with ARIA labels
2. **Internationalization**: Support for ja/en/zh/ko/vi
3. **Customization**: Themes and color schemes configurable
4. **Performance**: Optimized rendering with virtual scrolling
5. **Error Handling**: Graceful degradation and recovery

---

**Project ID**: MARIA-INTEGRATED-CLI-2025-001  
**Author**: Claude Code  
**Company**: Bonginkan Inc.  
**Status**: Ready for Implementation