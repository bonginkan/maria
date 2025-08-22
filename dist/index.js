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
  program.name("maria").description("MARIA - AI-Powered Development Platform").version("1.0.7");
  program.command("chat").description("Start interactive chat mode").action(() => {
    console.log(import_chalk.default.blue("\u{1F916} MARIA AI-Powered Development Platform v1.0.7"));
    console.log(import_chalk.default.gray("Enterprise-Grade CLI with Advanced Intelligence"));
    console.log(import_chalk.default.yellow("\n\u{1F4A1} This is the OSS distribution of MARIA."));
    console.log(import_chalk.default.yellow("   Full features available at: https://maria-code.vercel.app"));
    console.log(import_chalk.default.cyan("\n\u2728 Key Features:"));
    console.log(import_chalk.default.cyan("   \u2022 22+ AI Models (GPT, Claude, Gemini, Local LLMs)"));
    console.log(import_chalk.default.cyan("   \u2022 Advanced Code Quality Systems"));
    console.log(import_chalk.default.cyan("   \u2022 Intelligent Dependency Management"));
    console.log(import_chalk.default.cyan("   \u2022 AI-Driven Project Analysis"));
    console.log(import_chalk.default.cyan("   \u2022 Automated Refactoring Engine"));
    console.log(import_chalk.default.cyan("   \u2022 Phase 5: Enterprise-Grade Infrastructure"));
  });
  program.command("version").description("Show version information").action(() => {
    console.log(import_chalk.default.bold("MARIA CLI v1.0.7"));
    console.log(import_chalk.default.gray("AI-Powered Development Platform"));
    console.log(import_chalk.default.gray("\xA9 2025 Bonginkan Inc."));
  });
  program.command("status").description("Show system status").action(() => {
    console.log(import_chalk.default.green("\u2705 MARIA OSS Distribution"));
    console.log(import_chalk.default.blue("\u{1F4E6} Version: 1.0.7"));
    console.log(import_chalk.default.yellow("\u{1F517} Full Platform: https://maria-code.vercel.app"));
  });
  return program;
}
if (require.main === module) {
  const cli = createCLI();
  cli.parse();
}

// src/index.ts
var VERSION = "1.0.7";
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  VERSION,
  createCLI
});
