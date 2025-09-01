/**
 * Modern Code Command - With Authentication & Free Plan Support
 * Demonstrates integration with the new authentication system
 */

import { BaseCommand, CommandMeta, CommandResult, CommandContext } from '../../shared/BaseCommand';
import { User, ERROR_MESSAGES } from '../../../services/cli-auth';
import chalk from 'chalk';
import ora from 'ora';

export class CodeCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'code',
    description: 'Generate code with AI assistance',
    category: 'code',
    requiresAuth: true,
    planRestrictions: [], // Available in FREE plan
    status: 'stable'
  };

  async execute(): Promise<CommandResult> {
    // Use the authentication guard system
    return await this.executeWithGuards(async (user: User) => {
      const args = this.context.args || [];
      const prompt = args.join(' ');

      if (!prompt) {
        console.log(chalk.yellow('\n⚠️  Please provide a description of the code you want to generate'));
        console.log(chalk.gray('Example: /code create a REST API endpoint'));
        return this.error('Code prompt required', 'MISSING_PROMPT');
      }

      const spinner = ora('Generating code...').start();

      try {
        // Show free plan context
        if (user.plan === 'FREE') {
          spinner.text = 'Generating code with Gemini Flash (Free Plan)...';
        }

        // Simulate API call to code generation service
        const result = await this.generateCode(prompt, user);

        spinner.succeed('Code generated successfully!');

        // Display results with free plan messaging
        console.log(chalk.green('\n✨ Generated Code:'));
        console.log(chalk.gray('─'.repeat(50)));
        console.log(result.code);
        console.log(chalk.gray('─'.repeat(50)));

        // Free plan tips
        if (user.plan === 'FREE') {
          console.log(chalk.gray('\n💡 Free Plan Tips:'));
          console.log(chalk.gray(`   • ${user.usage.requestLimit - user.usage.requests - 1} requests remaining this month`));
          console.log(chalk.gray('   • Resets on ' + user.usage.resetDate));
          console.log(chalk.gray('   • Upgrade coming soon for more features!'));
        }

        return this.success('Code generated', {
          code: result.code,
          language: result.language,
          model: result.model
        });

      } catch (error: any) {
        spinner.fail('Code generation failed');
        
        if (error.message?.includes('quota')) {
          console.error(chalk.red('\n⚠ Monthly quota exceeded'));
          console.error(chalk.gray('Your free plan quota will reset on ' + user.usage.resetDate));
          console.error(chalk.gray('Upgrade coming soon for higher limits!'));
          return this.error(ERROR_MESSAGES.QUOTA_EXCEEDED, 'QUOTA_EXCEEDED');
        }

        return this.error(`Code generation failed: ${error.message}`, 'GENERATION_ERROR');
      }
    });
  }

  /**
   * Generate code using AI service
   */
  private async generateCode(prompt: string, user: User): Promise<{ code: string; language: string; model: string }> {
    // Simulate different models based on plan
    const model = user.plan === 'FREE' ? 'gemini-flash' : 'gpt-4';
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Mock code generation
    const language = this.detectLanguage(prompt);
    const code = this.mockCodeGeneration(prompt, language);

    return {
      code,
      language,
      model
    };
  }

  /**
   * Detect programming language from prompt
   */
  private detectLanguage(prompt: string): string {
    const lower = prompt.toLowerCase();
    
    if (lower.includes('python') || lower.includes('flask') || lower.includes('django')) return 'python';
    if (lower.includes('javascript') || lower.includes('node') || lower.includes('express')) return 'javascript';
    if (lower.includes('typescript') || lower.includes('ts')) return 'typescript';
    if (lower.includes('react') || lower.includes('jsx')) return 'tsx';
    if (lower.includes('java') && !lower.includes('javascript')) return 'java';
    if (lower.includes('go') || lower.includes('golang')) return 'go';
    if (lower.includes('rust')) return 'rust';
    if (lower.includes('sql') || lower.includes('database')) return 'sql';
    if (lower.includes('html')) return 'html';
    if (lower.includes('css')) return 'css';
    
    return 'javascript'; // Default
  }

  /**
   * Mock code generation for demo
   */
  private mockCodeGeneration(prompt: string, language: string): string {
    const templates = {
      javascript: `// Generated JavaScript code
function handleRequest() {
  // ${prompt}
  console.log('Hello from generated code!');
  return { success: true };
}

module.exports = { handleRequest };`,

      typescript: `// Generated TypeScript code
interface ApiResponse {
  success: boolean;
  data?: any;
}

function handleRequest(): ApiResponse {
  // ${prompt}
  console.log('Hello from generated code!');
  return { success: true };
}

export { handleRequest, ApiResponse };`,

      python: `# Generated Python code
def handle_request():
    """${prompt}"""
    print("Hello from generated code!")
    return {"success": True}

if __name__ == "__main__":
    result = handle_request()
    print(result)`,

      go: `// Generated Go code
package main

import "fmt"

// ${prompt}
func HandleRequest() map[string]interface{} {
    fmt.Println("Hello from generated code!")
    return map[string]interface{}{
        "success": true,
    }
}

func main() {
    result := HandleRequest()
    fmt.Printf("%+v\\n", result)
}`,
    };

    return templates[language as keyof typeof templates] || templates.javascript;
  }
}