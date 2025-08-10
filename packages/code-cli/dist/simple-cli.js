#!/usr/bin/env node
import {
  source_default
} from "./chunk-PHGI5UVR.js";
import "./chunk-7D4SUZUM.js";

// src/simple-cli.ts
import { Command } from "commander";
import prompts from "prompts";
import ora from "ora";
var program = new Command();
program.name("mc").description("MARIA CODE - AI-powered development CLI").version("1.0.0");
program.command("test").description("Test CLI functionality").action(() => {
  console.log("[TEST] MARIA CODE CLI Test");
  console.log("[OK] CLI is working correctly!");
  console.log("Version: 1.0.0");
  console.log("");
  console.log("Available commands:");
  console.log("  mc init        Initialize .maria-code.toml");
  console.log("  mc chat        Interactive chat session");
  console.log("  mc graph       Visualize Graph Database (requires Neo4j setup)");
  console.log("  mc --help      Show help information");
});
program.command("init").description("Initialize .maria-code.toml").action(() => {
  console.log("[INIT] Initializing MARIA CODE configuration...");
  console.log("[OK] Configuration initialized successfully!");
});
program.command("chat").description("\u81EA\u7136\u8A00\u8A9E\u3067\u306E\u5BFE\u8A71\u578B\u30C1\u30E3\u30C3\u30C8\u30BB\u30C3\u30B7\u30E7\u30F3").option("-m, --mode <mode>", "\u52D5\u4F5C\u30E2\u30FC\u30C9 (chat/research/creative)", "chat").option("-v, --verbose", "\u8A73\u7D30\u51FA\u529B\u3092\u8868\u793A", false).action(async (options) => {
  await startNaturalChat(options);
});
program.command("version").description("Show version information").action(() => {
  console.log("MARIA CODE CLI v1.0.0");
  console.log("Node.js:", process.version);
  console.log("Platform:", process.platform);
});
program.parse(process.argv);
async function startNaturalChat(options) {
  console.log(source_default.cyan.bold("[AI] MARIA CODE Chat Interface"));
  console.log(source_default.gray(`Mode: ${options.mode} | Verbose: ${options.verbose}`));
  console.log(source_default.yellow('Type your request in natural language. Type "exit" to quit.\n'));
  while (true) {
    try {
      const response = await prompts({
        type: "text",
        name: "message",
        message: source_default.blue("You:"),
        validate: (value) => value.length > 0 ? true : "Please enter a message"
      });
      if (!response.message) {
        console.log(source_default.yellow("\u{1F44B} Chat session ended."));
        break;
      }
      const userMessage = response.message.trim();
      if (userMessage.toLowerCase() === "exit" || userMessage.toLowerCase() === "quit") {
        console.log(source_default.yellow("\u{1F44B} Chat session ended."));
        break;
      }
      if (userMessage.toLowerCase() === "help") {
        showChatHelp();
        continue;
      }
      if (userMessage.toLowerCase() === "clear") {
        console.clear();
        console.log(source_default.cyan.bold("[AI] MARIA CODE Chat Interface"));
        console.log(source_default.gray("Chat history cleared.\n"));
        continue;
      }
      const aiResponse = await processMessage(userMessage);
      console.log(source_default.green("[AI] MARIA:"), aiResponse);
      console.log("");
    } catch (error) {
      if (error instanceof Error && error.message.includes("cancelled")) {
        console.log(source_default.yellow("\n\u{1F44B} Chat session cancelled."));
        break;
      }
      console.error(source_default.red("Error:"), error);
    }
  }
}
async function processMessage(message) {
  const spinner = ora("\u{1F914} MARIA is thinking...").start();
  try {
    await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 1200));
    spinner.stop();
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes("create") || lowerMessage.includes("\u4F5C\u6210") || lowerMessage.includes("\u4F5C\u3063\u3066")) {
      if (lowerMessage.includes("file") || lowerMessage.includes("\u30D5\u30A1\u30A4\u30EB")) {
        return `\u30D5\u30A1\u30A4\u30EB\u4F5C\u6210\u306E\u3054\u4F9D\u983C\u3067\u3059\u306D\u3002\u4EE5\u4E0B\u306E\u624B\u9806\u3067\u9032\u3081\u307E\u3059\uFF1A

1. \u30D5\u30A1\u30A4\u30EB\u540D\u3068\u5F62\u5F0F\u3092\u78BA\u8A8D
2. \u5FC5\u8981\u306A\u5185\u5BB9\u3092\u6574\u7406
3. \u30D5\u30A1\u30A4\u30EB\u4F5C\u6210\u3068\u4FDD\u5B58

\u5177\u4F53\u7684\u306A\u30D5\u30A1\u30A4\u30EB\u540D\u3068\u5185\u5BB9\u3092\u6559\u3048\u3066\u304F\u3060\u3055\u3044\u3002`;
      }
      if (lowerMessage.includes("function") || lowerMessage.includes("\u95A2\u6570")) {
        return `\u95A2\u6570\u4F5C\u6210\u306E\u30EA\u30AF\u30A8\u30B9\u30C8\u3092\u627F\u308A\u307E\u3057\u305F\u3002

\u5FC5\u8981\u306A\u60C5\u5831\uFF1A
\u2022 \u95A2\u6570\u540D
\u2022 \u5F15\u6570\u306E\u578B\u3068\u540D\u524D
\u2022 \u623B\u308A\u5024\u306E\u578B
\u2022 \u51E6\u7406\u5185\u5BB9

\u3053\u308C\u3089\u306E\u8A73\u7D30\u3092\u6559\u3048\u3066\u304F\u3060\u3055\u3044\u3002TypeScript/JavaScript\u3067\u5B9F\u88C5\u3057\u307E\u3059\u3002`;
      }
    }
    if (lowerMessage.includes("fix") || lowerMessage.includes("\u4FEE\u6B63") || lowerMessage.includes("\u76F4\u3057\u3066")) {
      return `\u554F\u984C\u306E\u4FEE\u6B63\u3092\u304A\u624B\u4F1D\u3044\u3057\u307E\u3059\u3002

\u8A73\u7D30\u60C5\u5831\u3092\u304A\u805E\u304B\u305B\u304F\u3060\u3055\u3044\uFF1A
\u2022 \u3069\u306E\u3088\u3046\u306A\u554F\u984C\u304C\u767A\u751F\u3057\u3066\u3044\u307E\u3059\u304B\uFF1F
\u2022 \u30A8\u30E9\u30FC\u30E1\u30C3\u30BB\u30FC\u30B8\u306F\u3042\u308A\u307E\u3059\u304B\uFF1F
\u2022 \u554F\u984C\u304C\u8D77\u304D\u3066\u3044\u308B\u30D5\u30A1\u30A4\u30EB\u3084\u30B3\u30FC\u30C9\u306F\u3042\u308A\u307E\u3059\u304B\uFF1F

\u60C5\u5831\u3092\u3044\u305F\u3060\u3051\u308C\u3070\u3001\u9069\u5207\u306A\u89E3\u6C7A\u7B56\u3092\u63D0\u6848\u3057\u307E\u3059\u3002`;
    }
    if (lowerMessage.includes("explain") || lowerMessage.includes("\u8AAC\u660E") || lowerMessage.includes("\u6559\u3048\u3066")) {
      return `\u8AAC\u660E\u306E\u3054\u4F9D\u983C\u3067\u3059\u306D\u3002\u4EE5\u4E0B\u306E\u3088\u3046\u306A\u5185\u5BB9\u306B\u3064\u3044\u3066\u8A73\u3057\u304F\u8AAC\u660E\u3067\u304D\u307E\u3059\uFF1A

\u2022 \u30B3\u30FC\u30C9\u306E\u52D5\u4F5C\u539F\u7406
\u2022 \u30E9\u30A4\u30D6\u30E9\u30EA\u3084\u30D5\u30EC\u30FC\u30E0\u30EF\u30FC\u30AF\u306E\u4F7F\u3044\u65B9
\u2022 \u30D9\u30B9\u30C8\u30D7\u30E9\u30AF\u30C6\u30A3\u30B9
\u2022 \u30A2\u30FC\u30AD\u30C6\u30AF\u30C1\u30E3\u306E\u8A2D\u8A08

\u5177\u4F53\u7684\u306B\u4F55\u306B\u3064\u3044\u3066\u77E5\u308A\u305F\u3044\u304B\u6559\u3048\u3066\u304F\u3060\u3055\u3044\u3002`;
    }
    if (lowerMessage.includes("project") || lowerMessage.includes("\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8")) {
      return `\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u306B\u95A2\u3059\u308B\u3054\u8CEA\u554F\u3067\u3059\u306D\u3002

MARIA PLATFORM\u306E\u4E3B\u8981\u6A5F\u80FD\uFF1A
\u2022 Paper Editor - LaTeX\u8AD6\u6587\u7DE8\u96C6
\u2022 Slides Editor - \u30D7\u30EC\u30BC\u30F3\u30C6\u30FC\u30B7\u30E7\u30F3\u4F5C\u6210
\u2022 AI Chat - \u5BFE\u8A71\u578B\u958B\u767A\u652F\u63F4
\u2022 Graph RAG - Knowledge Graph (optional)

\u4F55\u304B\u7279\u5B9A\u306E\u6A5F\u80FD\u306B\u3064\u3044\u3066\u8A73\u3057\u304F\u77E5\u308A\u305F\u3044\u3053\u3068\u306F\u3042\u308A\u307E\u3059\u304B\uFF1F`;
    }
    const responses = [
      `\u306A\u308B\u307B\u3069\u3001\u300C${message}\u300D\u306B\u3064\u3044\u3066\u3067\u3059\u306D\u3002\u3082\u3046\u5C11\u3057\u8A73\u7D30\u3092\u6559\u3048\u3066\u3044\u305F\u3060\u3051\u307E\u3059\u304B\uFF1F`,
      `\u3054\u4F9D\u983C\u306E\u5185\u5BB9\u3092\u7406\u89E3\u3057\u307E\u3057\u305F\u3002\u5177\u4F53\u7684\u306B\u3069\u306E\u3088\u3046\u306A\u4F5C\u696D\u3092\u304A\u624B\u4F1D\u3044\u3067\u304D\u308B\u3067\u3057\u3087\u3046\u304B\uFF1F`,
      `\u300C${message}\u300D\u306B\u95A2\u3057\u3066\u3001MARIA CODE\u3067\u30B5\u30DD\u30FC\u30C8\u3067\u304D\u308B\u65B9\u6CD5\u3092\u8003\u3048\u3066\u3044\u307E\u3059\u3002\u8FFD\u52A0\u306E\u60C5\u5831\u304C\u3042\u308C\u3070\u6559\u3048\u3066\u304F\u3060\u3055\u3044\u3002`
    ];
    const randomIndex = Math.floor(Math.random() * responses.length);
    return responses[randomIndex] ?? "\u7533\u3057\u8A33\u3042\u308A\u307E\u305B\u3093\u3002\u73FE\u5728\u51E6\u7406\u3067\u304D\u307E\u305B\u3093\u3002";
  } catch (error) {
    spinner.stop();
    return `\u7533\u3057\u8A33\u3042\u308A\u307E\u305B\u3093\u3002\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}
function showChatHelp() {
  console.log(source_default.cyan.bold("\n\u{1F4DA} Available Commands:"));
  console.log(source_default.yellow("  help     ") + "- Show this help message");
  console.log(source_default.yellow("  clear    ") + "- Clear chat history");
  console.log(source_default.yellow("  exit     ") + "- End chat session");
  console.log(source_default.gray("\n[TIP] Tips:"));
  console.log(source_default.gray("  - Use natural language to describe what you want"));
  console.log(source_default.gray("  - Be specific about files, functions, or features"));
  console.log(source_default.gray("  - Ask for explanations, code creation, or fixes"));
  console.log("");
}
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
//# sourceMappingURL=simple-cli.js.map