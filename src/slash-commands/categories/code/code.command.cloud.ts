/**
 * Code Generation Command
 * Cloud-only implementation using MARIA API
 */

import { callApi } from "../../shared/cloud-api-client.js";
import { shield, withShield } from "../../shared/shield.js";
import chalk from "chalk";

interface CodeCommandOptions {
  file?: string;
  language?: string;
  save?: boolean;
}

export const codeCommand = {
  name: "code",
  description: "Revolutionary natural language code generation",
  category: "code",
  examples: [
    '/code create a REST API for user management',
    '/code fix TypeScript errors in this file',
    '/code add authentication middleware --language=typescript',
    '/code refactor this function to use async/await --file=src/utils.ts'
  ],

  execute: withShield("code", async (context: any): Promise<any> => {
    const options = context.options as CodeCommandOptions;
    const prompt = context.args?.join(" ").trim();

    if (!prompt) {
      console.log(
        chalk.cyan("💻 Code Generation\n\n") +
        "Revolutionary natural language code operations powered by AI\n\n" +
        chalk.gray("Usage:\n") +
        "```\n" +
        '/code "describe what you want to build"\n' +
        '/code create a REST API for user management\n' +
        '/code fix TypeScript errors in this file\n' +
        '/code add authentication middleware\n' +
        "```\n\n" +
        chalk.yellow("Features:\n") +
        "• Natural language to code\n" +
        "• Multiple programming languages\n" +
        "• Error fixing and refactoring\n" +
        "• Smart suggestions\n\n" +
        chalk.blue("🚀 Start coding with AI!")
      );
      return { success: true, endReason: 'help-shown' };
    }

    console.log(chalk.cyan(`💻 Generating code: "${prompt}"`));

    try {
      const result = await callApi('/v1/generate/code', {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          model: 'gemini-2.5-flash',
          language: options?.language || 'typescript',
          maxTokens: 2048,
          temperature: 0.1,
          plan: context.plan || 'free'
        })
      });

      if (!result.success) {
        console.log(chalk.red("❌ Code generation failed"));
        console.log(result.error || "Service temporarily unavailable");
        return { success: false, endReason: 'service-error' };
      }

      console.log(chalk.green("✅ Code generated successfully!"));
      
      if (result.data.summary) {
        console.log(`📋 ${result.data.summary}`);
      }
      
      if (result.data.code) {
        console.log('\n```typescript');
        console.log(result.data.code.slice(0, 1000)); // Preview
        if (result.data.code.length > 1000) {
          console.log('... (truncated)');
        }
        console.log('```\n');
      }
      
      if (result.data.filename) {
        console.log(`📁 Saved: ${result.data.filename}`);
      }
      
      console.log(chalk.gray("💡 Tip: Use --save to save the code to a file"));

      return { success: true, endReason: 'completed' };

    } catch (error) {
      console.log(chalk.red("❌ Unexpected error occurred"));
      return { success: false, endReason: 'service-error' };
    }
  })
};

// Export metadata and execute for command registry
export const metadata = {
  name: 'code',
  description: 'Revolutionary natural language code generation',
  category: 'code',
  version: '1.0.0',
  type: 'functional' as const,
  planRequired: 'free' as const,
  isPreview: false
};

export async function execute(context: any): Promise<any> {
  return await codeCommand.execute(context);
}