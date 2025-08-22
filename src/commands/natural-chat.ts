import { Command } from 'commander';
import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatSession {
  messages: ChatMessage[];
  sessionId: string;
  startTime: Date;
}

export default function naturalChatCommand(program: Command) {
  program
    .command('chat')
    .description('自然言語での対話型チャットセッション')
    .option('-m, --mode <mode>', '動作モード (chat/research/creative)', 'chat')
    .option('-v, --verbose', '詳細出力を表示', false)
    .action(async (options) => {
      console.log(chalk.cyan.bold('🤖 MARIA CODE Chat Interface'));
      console.log(chalk.gray(`Mode: ${options.mode} | Verbose: ${options.verbose}`));
      console.log(chalk.yellow('Type your request in natural language. Type "exit" to quit.\n'));

      const session: ChatSession = {
        messages: [],
        sessionId: generateSessionId(),
        startTime: new Date(),
      };

      // チャットループ
      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          const response = await prompts({
            type: 'text',
            name: 'message',
            message: chalk.blue('You:'),
            validate: (value) => (value.length > 0 ? true : 'Please enter a message'),
          });

          if (!response.message) {
            console.log(chalk.yellow('👋 Chat session ended.'));
            break;
          }

          const userMessage = response.message.trim();

          // 終了コマンド
          if (userMessage.toLowerCase() === 'exit' || userMessage.toLowerCase() === 'quit') {
            console.log(chalk.yellow('👋 Chat session ended.'));
            break;
          }

          // ヘルプコマンド
          if (userMessage.toLowerCase() === 'help') {
            showHelp();
            continue;
          }

          // 履歴コマンド
          if (userMessage.toLowerCase() === 'history') {
            showHistory(session);
            continue;
          }

          // クリアコマンド
          if (userMessage.toLowerCase() === 'clear') {
            console.clear();
            console.log(chalk.cyan.bold('🤖 MARIA CODE Chat Interface'));
            console.log(chalk.gray('Chat history cleared.\n'));
            session.messages = [];
            continue;
          }

          // ユーザーメッセージを記録
          session.messages.push({
            role: 'user',
            content: userMessage,
            timestamp: new Date(),
          });

          // AI応答をシミュレート
          const aiResponse = await processUserMessage(userMessage);

          // AI応答を記録
          session.messages.push({
            role: 'assistant',
            content: aiResponse,
            timestamp: new Date(),
          });

          console.log(chalk.green('🤖 MARIA:'), aiResponse);
          console.log(''); // 空行
        } catch (error: unknown) {
          if (error instanceof Error && error.message.includes('cancelled')) {
            console.log(chalk.yellow('\n👋 Chat session cancelled.'));
            break;
          }
          console.error(chalk.red('Error:'), error);
        }
      }

      // セッション終了時の統計
      showSessionStats(session);
    });
}

async function processUserMessage(message: string): Promise<string> {
  const spinner = ora('🤔 MARIA is thinking...').start();

  try {
    // シミュレーション待機
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));

    spinner.stop();

    // 自然言語処理のシミュレーション
    const response = await generateResponse(message);
    return response;
  } catch (error: unknown) {
    spinner.stop();
    return `申し訳ありません。エラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

async function generateResponse(message: string): Promise<string> {
  const lowerMessage = message.toLowerCase();

  // パターンマッチングによる応答生成
  if (
    lowerMessage.includes('create') ||
    lowerMessage.includes('作成') ||
    lowerMessage.includes('作って')
  ) {
    if (lowerMessage.includes('file') || lowerMessage.includes('ファイル')) {
      return `ファイル作成のご依頼ですね。以下の手順で進めます：\n\n1. ファイル名と形式を確認\n2. 必要な内容を整理\n3. ファイル作成と保存\n\n具体的なファイル名と内容を教えてください。`;
    }
    if (lowerMessage.includes('function') || lowerMessage.includes('関数')) {
      return `関数作成のリクエストを承りました。\n\n必要な情報：\n• 関数名\n• 引数の型と名前\n• 戻り値の型\n• 処理内容\n\nこれらの詳細を教えてください。TypeScript/JavaScriptで実装します。`;
    }
    if (lowerMessage.includes('component') || lowerMessage.includes('コンポーネント')) {
      return `Reactコンポーネントの作成ですね！\n\n以下を教えてください：\n• コンポーネント名\n• 必要なプロパティ\n• 見た目や機能の要件\n• スタイリング方法（Tailwind CSS使用可能）`;
    }
  }

  if (
    lowerMessage.includes('fix') ||
    lowerMessage.includes('修正') ||
    lowerMessage.includes('直して')
  ) {
    return `問題の修正をお手伝いします。\n\n詳細情報をお聞かせください：\n• どのような問題が発生していますか？\n• エラーメッセージはありますか？\n• 問題が起きているファイルやコードはありますか？\n\n情報をいただければ、適切な解決策を提案します。`;
  }

  if (
    lowerMessage.includes('explain') ||
    lowerMessage.includes('説明') ||
    lowerMessage.includes('教えて')
  ) {
    return `説明のご依頼ですね。以下のような内容について詳しく説明できます：\n\n• コードの動作原理\n• ライブラリやフレームワークの使い方\n• ベストプラクティス\n• アーキテクチャの設計\n\n具体的に何について知りたいか教えてください。`;
  }

  if (lowerMessage.includes('test') || lowerMessage.includes('テスト')) {
    return `テスト作成のサポートをします。\n\nテストの種類：\n• ユニットテスト（関数・コンポーネント単位）\n• 統合テスト（機能単位）\n• E2Eテスト（シナリオベース）\n\nどのようなテストを作成したいか詳細を教えてください。`;
  }

  if (lowerMessage.includes('deploy') || lowerMessage.includes('デプロイ')) {
    return `デプロイメントについてサポートします。\n\n利用可能な環境：\n• Development (dev)\n• Staging (stg)\n• Production (prod)\n\n現在の設定やデプロイしたい環境を教えてください。`;
  }

  // プロジェクト関連
  if (lowerMessage.includes('project') || lowerMessage.includes('プロジェクト')) {
    return `プロジェクトに関するご質問ですね。\n\nMARIA PLATFORMの主要機能：\n• Paper Editor - LaTeX論文編集\n• Slides Editor - プレゼンテーション作成\n• AI Chat - 対話型開発支援\n• Graph RAG - Knowledge Graph (optional)\n\n何か特定の機能について詳しく知りたいことはありますか？`;
  }

  // 一般的な応答
  const responses = [
    `なるほど、「${message}」についてですね。もう少し詳細を教えていただけますか？具体的にどのような作業をお手伝いできるでしょうか？`,
    `ご依頼の内容を理解しました。以下の観点から検討してみましょう：\n\n• 技術的要件\n• 実装方法\n• 必要なリソース\n\n追加の情報があれば教えてください。`,
    `「${message}」に関して、MARIA CODEでサポートできる方法を考えています。\n\n関連するツールや機能：\n• コード生成\n• ファイル操作\n• テスト作成\n• デプロイメント\n\nどちらの方向で進めたいでしょうか？`,
  ];

  const randomIndex = Math.floor(Math.random() * responses.length);
  return responses[randomIndex] ?? '申し訳ありません。現在処理できません。';
}

function showHelp() {
  console.log(chalk.cyan.bold('\n📚 Available Commands:'));
  console.log(`${chalk.yellow('  help     ')  }- Show this help message`);
  console.log(`${chalk.yellow('  history  ')  }- Show conversation history`);
  console.log(`${chalk.yellow('  clear    ')  }- Clear chat history`);
  console.log(`${chalk.yellow('  exit     ')  }- End chat session`);
  console.log(chalk.gray('\n💡 Tips:'));
  console.log(chalk.gray('  - Use natural language to describe what you want'));
  console.log(chalk.gray('  - Be specific about files, functions, or features'));
  console.log(chalk.gray('  - Ask for explanations, code creation, or fixes'));
  console.log('');
}

function showHistory(session: ChatSession) {
  console.log(chalk.cyan.bold('\n📝 Conversation History:'));
  if (session.messages.length === 0) {
    console.log(chalk.gray('No messages yet.'));
  } else {
    session.messages.forEach((msg) => {
      const time = msg.timestamp.toLocaleTimeString();
      const role = msg.role === 'user' ? chalk.blue('You') : chalk.green('🤖 MARIA');
      console.log(
        chalk.gray(`[${time}]`),
        `${role  }:`,
        msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : ''),
      );
    });
  }
  console.log('');
}

function showSessionStats(session: ChatSession) {
  const duration = Date.now() - session.startTime.getTime();
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);

  console.log(chalk.cyan.bold('\n📊 Session Summary:'));
  console.log(chalk.gray(`Session ID: ${session.sessionId}`));
  console.log(chalk.gray(`Duration: ${minutes}m ${seconds}s`));
  console.log(chalk.gray(`Messages: ${session.messages.length}`));
  console.log(chalk.gray(`Started: ${session.startTime.toLocaleString()}`));
  console.log('');
}

function generateSessionId(): string {
  return `session_${  Date.now().toString(36)  }${Math.random().toString(36).substr(2)}`;
}
