"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  VERSION: () => VERSION,
  createCLI: () => createCLI
});
module.exports = __toCommonJS(index_exports);

// src/cli.ts
var import_commander = require("commander");
var import_chalk = __toESM(require("chalk"));
function createCLI() {
  const program = new import_commander.Command();
  program.name("maria").description("MARIA - Intelligent CLI Assistant with Multi-Model AI Support").version("1.0.3");
  program.command("chat", { isDefault: true }).description("Start interactive chat session").option("--model <name>", "Specify AI model to use").option("--debug", "Enable debug output").action(async (options) => {
    console.log(import_chalk.default.blue.bold("\u{1F916} MARIA CLI v1.0.3"));
    console.log(import_chalk.default.gray("Intelligent CLI Assistant with Multi-Model AI Support"));
    console.log("");
    if (options.debug) {
      console.log(import_chalk.default.yellow("Debug mode enabled"));
    }
    console.log(import_chalk.default.green("\u2728 Welcome to MARIA!"));
    console.log(import_chalk.default.gray("Type /help for available commands or start chatting..."));
    console.log("");
    await startInteractiveSession(options);
  });
  program.command("help").description("Show help information").action(() => {
    console.log(import_chalk.default.blue.bold("\u{1F916} MARIA CLI v1.0.3"));
    console.log(import_chalk.default.gray("Intelligent CLI Assistant with Multi-Model AI Support"));
    console.log("");
    console.log(import_chalk.default.green("Available Commands:"));
    console.log("  maria chat     Start interactive chat session (default)");
    console.log("  maria help     Show this help message");
    console.log("  maria version  Show version information");
    console.log("");
    console.log(import_chalk.default.yellow("Options:"));
    console.log("  --model <name>  Specify AI model to use");
    console.log("  --debug         Enable debug output");
    console.log("");
    console.log(import_chalk.default.blue("Visit: https://github.com/bonginkan/maria"));
  });
  program.command("version").description("Show version information").action(() => {
    console.log("1.0.2");
  });
  return program;
}
async function startInteractiveSession(options) {
  console.log(import_chalk.default.cyan("\u{1F680} Starting interactive session..."));
  if (options.debug) {
    console.log(import_chalk.default.yellow(`Debug: Options passed: ${JSON.stringify(options)}`));
  }
  console.log("");
  console.log(import_chalk.default.yellow.bold("\u2699\uFE0F  Setup Required"));
  console.log("");
  console.log("To use MARIA CLI, you need to:");
  console.log("1. Set up your AI provider API keys");
  console.log("2. Configure your preferred models");
  console.log("");
  console.log(import_chalk.default.blue("For full setup instructions, visit:"));
  console.log(import_chalk.default.underline("https://github.com/bonginkan/maria#setup"));
  console.log("");
  console.log(import_chalk.default.green("Coming soon: Full interactive chat functionality!"));
}
if (require.main === module) {
  const program = createCLI();
  program.parse();
}

// src/index.ts
var VERSION = "1.0.3";
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  VERSION,
  createCLI
});
