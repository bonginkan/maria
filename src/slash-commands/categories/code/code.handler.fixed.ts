/**
 * /code コマンドハンドラ(緊急修正版)
 * - 無限ループ防止
 * - タイムアウト対応
 * - AbortSignal伝播
 */

import type { HandlerContext } from '../../../shared/types/context';
import type { CommandResult } from '../../../shared/types/result';
import { ERROR_CODES } from '../../../shared/types/result';
import { CodeGenerationService } from '../../../services/code-generation.service';
import { StreamingOptimizedGenerator } from '../../../services/code-quality/StreamingOptimizedGenerator';
import { UIPort } from '../../../services/code-quality/StreamingRenderer';
import { CodeGenerationAnimator } from '../../../services/code-quality/CodeGenerationAnimator';
import { FastStreamingRenderer } from '../../../services/code-quality/FastStreamingRenderer';
import { readConfig } from '../../../utils/config';

/**
 * オプション抽出ヘルパー
 */
function extractOption(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1 || index === args.length - 1) return undefined;
  const value = args[index + 1];
  if (value?.startsWith('--')) return undefined;
  return value;
}

/**
 * Terminal UI adapter for streaming output with fast renderer
 */
class TerminalUIPort implements UIPort {
  private animator?: CodeGenerationAnimator;
  private animatorStarted = false;
  private renderer: FastStreamingRenderer;
  private firstChunk = true;
  
  constructor() {
    this.renderer = new FastStreamingRenderer();
  }
  
  writeChunk(chunk: string): void {
    // Stop spinner when actual content starts streaming
    if (this.firstChunk && chunk.trim()) {
      this.renderer.stopSpinner();
      this.firstChunk = false;
      process.stdout.write('\n'); // Add newline after spinner
    }
    // Stream chunk with instant display
    process.stdout.write(chunk);
  }
  
  clear(): void {
    if (process.stdout.isTTY) {
      process.stdout.write('\x1b[2J\x1b[H');
    }
  }
  
  showProgress(message: string): void {
    if (process.stdout.isTTY) {
      process.stdout.write(`\r${message}`);
    }
  }
  
  setAnimator(animator: CodeGenerationAnimator): void {
    this.animator = animator;
  }
  
  startAnimation(): void {
    // Use fast streaming renderer instead of old animator
    this.renderer.startSpinner('Generating code');
    this.animatorStarted = true;
  }
  
  stopAnimation(): void {
    this.renderer.stopSpinner();
    if (this.animator) {
      this.animator.stop();
    }
    this.animatorStarted = false;
  }
}

/**
 * /codeコマンドハンドラ(ストリーミング最適化版)
 * プロンプトからコードを生成する - リアルタイムストリーミング対応
 */
export async function codeHandler(
  args: string[], 
  ctx: HandlerContext
): Promise<CommandResult> {
  // プロンプト抽出(フラグ以外の引数を結合)
  const prompt = args.filter(a => !a.startsWith('--')).join(' ').trim();
  
  // プロンプトがない場合はヘルプを表示
  if (!prompt) {
    // Check for PLAIN output mode
    const plainMode = process.env.MARIA_PLAIN_OUTPUT === '1' || process.env.MARIA_DISABLE_GUIDED_FLOW === '1';
    
    if (plainMode) {
      return {
        ok: false,
        message: `Usage: /code <request>  e.g. /code build a REST API`
      };
    }
    
    return {
      ok: false,
      message: `❌ Please provide a code generation request.

Usage: /code <prompt> [options]

Examples:
  /code "Create a REST API for user management"
  /code "Fix the authentication bug" --language typescript --dashboard
  /code "Add error handling to the payment service" --include-tests --stream

Options:
  --language <lang>     Specify programming language
  --framework <name>    Target framework (react, vue, express, etc.)
  --include-tests       Generate unit tests along with code
  --include-comments    Add detailed code comments
  --style <style>       Code style: clean, verbose, minimal
  --pattern <pattern>   Design pattern: mvc, functional, oop, reactive
  
Streaming Options:
  --stream              Enable real-time streaming output (🚀 DEFAULT - always enabled)
  --no-stream           Disable streaming, show result at once
  --dashboard           Show live performance metrics dashboard
  --concurrency <n>     Max parallel operations for multi-file generation (default: 3)

💡 Tips:
  • 🚀 Streaming is now enabled by default for instant feedback!\n  • Real-time streaming provides <500ms first response
  • Use --dashboard to monitor performance metrics
  • Configure streaming in config: maria.cli.streaming.enabled = true\n  • Natural language works best - I'll understand your intent!`,
      requiresInput: false,  // 明示的にfalse
      endReason: 'error',
      errorCode: ERROR_CODES.INVALID_INPUT
    };
  }

  try {
    // 🚀 設定ファイルからストリーミング設定を読み込み\n    const config = await readConfig();\n    const streamingConfig = config.cli?.streaming || {\n      enabled: true,\n      showDashboard: false,\n      maxConcurrency: 3,\n      throttleMs: 50\n    };\n    \n    // オプション解析(設定ファイルのデフォルト値を使用)
    const options = {
      language: extractOption(args, '--language') || 'typescript',
      framework: extractOption(args, '--framework'),
      includeTests: args.includes('--include-tests'),
      includeComments: args.includes('--include-comments'),
      style: extractOption(args, '--style') || 'clean',
      pattern: extractOption(args, '--pattern'),
      // 🚀 設定ファイルのデフォルトを使用、--no-streamで無効化可能\n      stream: streamingConfig.enabled && !args.includes('--no-stream'),
      showDashboard: args.includes('--dashboard') || streamingConfig.showDashboard,
      maxConcurrency: parseInt(extractOption(args, '--concurrency') || streamingConfig.maxConcurrency.toString())
    };

    // ストリーミング最適化ジェネレーターを初期化
    const uiPort = new TerminalUIPort();
    const streamingGenerator = new StreamingOptimizedGenerator(uiPort, {
      enableDashboard: options.showDashboard,
      maxConcurrency: options.maxConcurrency
    });
    
    // Start fast spinner animation if streaming is enabled
    if (options.stream) {
      uiPort.startAnimation();
      // Minimal delay for spinner to be visible
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    let code: string;
    let language: string = options.language;
    let tests: string | undefined;
    let documentation: string | undefined;
    let metrics: any;
    
    try {
      // AbortSignalチェック
      if (ctx.signal?.aborted) {
        throw new Error('AbortError');
      }
      
      // ストリーミング最適化を使用してコード生成
      const result = await streamingGenerator.generate({
        prompt,
        options: {
          stream: options.stream,
          showDashboard: options.showDashboard,
          maxConcurrency: options.maxConcurrency,
          timeout: 30000 // 30秒タイムアウト
        }
      });
      
      if (!result.content) {
        throw new Error('Code generation failed - no content generated');
      }
      
      code = result.content;
      metrics = result.metrics;
      
      // Stop animations
      uiPort.stopAnimation();
      
      // フォールバック: 従来のCodeGenerationServiceも試行
      if (!code || code.trim().length < 10) {
        const codeGenService = CodeGenerationService.getInstance();
        const fallbackResult = await codeGenService.generateCode({
          prompt,
          language: options.language,
          framework: options.framework,
          options: {
            includeTests: options.includeTests,
            includeComments: options.includeComments,
            style: options.style as any,
            pattern: options.pattern as any
          }
        });
        
        if (fallbackResult.success && fallbackResult.code) {
          code = fallbackResult.code;
          language = fallbackResult.language || options.language;
          tests = fallbackResult.tests;
          documentation = fallbackResult._documentation;
        }
      }
      
    } catch (error: any) {
      // Stop animator on error
      if (uiPort.animator) {
        await uiPort.animator.showError('Code generation failed');
        uiPort.animator.stop();
      }
      
      // Fallback to template if AI service fails
      console.warn('AI code generation failed, using fallback:', error.message);
      
      // AbortSignalチェック
      if (ctx.signal?.aborted || error.name === 'AbortError') {
        throw error;
      }
      
      // フォールバック: 基本的なテンプレート生成
      code = generateBasicTemplate(prompt, options);
    }
    
    // Show completion animation if animator was used
    if (uiPort.animator && options.stream) {
      await uiPort.animator.showCompletion();
    }
    
    // ストリーミング出力は既に表示済みなので、サマリーのみ表示
    let message = `\n\n✅ **Code generation completed!**`;
    
    // パフォーマンスメトリクスを表示
    if (metrics) {
      message += `\n\n📊 **Performance Metrics:**`;
      message += `\n  • Total time: ${metrics.totalTime}ms`;
      message += `\n  • First token: ${metrics.firstTokenMs}ms`;
      message += `\n  • Throughput: ${metrics.throughputTokensPerSec.toFixed(1)} tokens/sec`;
      if (metrics.cacheHitRate > 0) {
        message += `\n  • Cache hit rate: ${metrics.cacheHitRate.toFixed(1)}%`;
      }
      if (metrics.parallelSpeedup) {
        message += `\n  • Parallel speedup: ${metrics.parallelSpeedup.toFixed(2)}x`;
      }
    }
    
    // テストコードがあれば追加
    if (tests) {
      message += `\n\n📝 **Tests:**\n\`\`\`${language}\n${tests}\n\`\`\``;
    }
    
    // ドキュメントがあれば追加
    if (documentation) {
      message += `\n\n📚 **Documentation:**\n${documentation}`;
    }
    
    // 追加のヒント
    message += `\n\n💡 **Tips:**`;
    message += `\n  • Use \`--dashboard\` to see real-time metrics`;
    message += `\n  • Use \`--no-stream\` for traditional output`;
    message += `\n  • Use \`--concurrency N\` for parallel generation`;
    
    return {
      ok: true,
      message,
      data: { 
        code, 
        language,
        prompt,
        options,
        tests,
        documentation,
        metrics
      },
      requiresInput: false,  // 絶対にfalse(無限ループ防止)
      endReason: 'success'
    };
    
  } catch (error: any) {
    // タイムアウトエラー
    if (error.name === 'AbortError' || ctx.signal?.aborted) {
      return {
        ok: false,
        message: '❌ Code generation timed out. Please try with a simpler request.',
        requiresInput: false,
        endReason: 'timeout',
        errorCode: ERROR_CODES.TIMEOUT
      };
    }
    
    // レート制限エラー
    if (error.code === 'rate_limit' || error.message?.includes('rate limit')) {
      return {
        ok: false,
        message: '❌ Rate limit exceeded. Please wait a moment and try again.',
        requiresInput: false,
        endReason: 'error',
        errorCode: ERROR_CODES.RATE_LIMIT
      };
    }
    
    // その他のエラー
    return {
      ok: false,
      message: `❌ Code generation failed: ${error.message || 'Unknown error'}`,
      requiresInput: false,
      endReason: 'error',
      errorCode: error.code || ERROR_CODES.INTERNAL
    };
  }
}

/**
 * 基本的なフォールバックテンプレート生成
 */
function generateBasicTemplate(prompt: string, options: any): string {
  const lang = options.language || 'typescript';
  const includeComments = options.includeComments;
  
  // 基本的なテンプレート
  const templates: Record<string, string> = {
    typescript: `${includeComments ? '// Generated by MARIA\n// Prompt: ' + prompt + '\n\n' : ''}export function generatedFunction(): void {
  // TODO: Implement based on: ${prompt}
  console.log('Generated code for: ${prompt}');
}`,
    
    javascript: `${includeComments ? '// Generated by MARIA\n// Prompt: ' + prompt + '\n\n' : ''}function generatedFunction() {
  // TODO: Implement based on: ${prompt}
  console.log('Generated code for: ${prompt}');
}`,
    
    python: `${includeComments ? '# Generated by MARIA\n# Prompt: ' + prompt + '\n\n' : ''}def generated_function():
    """TODO: Implement based on: ${prompt}"""
    print(f"Generated code for: ${prompt}")`,
    
    java: `${includeComments ? '// Generated by MARIA\n// Prompt: ' + prompt + '\n\n' : ''}public class GeneratedClass {
    public void generatedMethod() {
        // TODO: Implement based on: ${prompt}
        System.out.println("Generated code for: ${prompt}");
    }
}`
  };
  
  // RESTAPIの特別処理
  if (prompt.toLowerCase().includes('rest api')) {
    if (lang === 'typescript' || lang === 'javascript') {
      return `${includeComments ? '// REST API generated by MARIA\n// ' + prompt + '\n\n' : ''}import express from 'express';

const app = express();
app.use(express.json());

// GET all items
app.get('/api/items', async (req, res) => {
  try {
    // TODO: Fetch from database
    res.json({ items: [] });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET single item
app.get('/api/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // TODO: Fetch from database
    res.json({ item: { id } });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST new item
app.post('/api/items', async (req, res) => {
  try {
    const data = req.body;
    // TODO: Save to database
    res.status(201).json({ item: data });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT update item
app.put('/api/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    // TODO: Update in database
    res.json({ item: { id, ...data } });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE item
app.delete('/api/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // TODO: Delete from database
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});`;
    }
  }
  
  // テスト生成の特別処理
  if (options.includeTests) {
    const testCode = lang === 'typescript' || lang === 'javascript'
      ? `
// Test file
describe('generatedFunction', () => {
  it('should work correctly', () => {
    // TODO: Add test implementation
    expect(true).toBe(true);
  });
});`
      : lang === 'python'
      ? `
# Test file
import unittest

class TestGeneratedFunction(unittest.TestCase):
    def test_generated_function(self):
        # TODO: Add test implementation
        self.assertTrue(True)`
      : '';
      
    return templates[lang] || templates.typescript + '\n' + testCode;
  }
  
  return templates[lang] || templates.typescript;
}
