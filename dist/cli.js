#!/usr/bin/env node
'use strict';

var commander = require('commander');
var chalk = require('chalk');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var chalk__default = /*#__PURE__*/_interopDefault(chalk);

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
function createCLI() {
  const program = new commander.Command();
  program.name("maria").description("MARIA - AI-Powered Development Platform").version("2.1.9");
  program.command("chat").description("Start interactive chat mode").action(() => {
    console.log(chalk__default.default.blue("\u{1F916} MARIA AI-Powered Development Platform v2.1.9"));
    console.log(chalk__default.default.gray("Enhanced UX & Advanced Content Analysis Edition"));
    console.log(chalk__default.default.yellow("\n\u{1F4A1} This is the OSS distribution of MARIA."));
    console.log(chalk__default.default.yellow("   Full features available at: https://maria-code.vercel.app"));
    console.log(chalk__default.default.cyan("\n\u2728 Key Features:"));
    console.log(chalk__default.default.cyan("   \u2022 Cloud Vision AI (Gemini 2.0 Flash, GPT-4o-mini)"));
    console.log(chalk__default.default.cyan("   \u2022 Enhanced UX with Real-time Feedback"));
    console.log(chalk__default.default.cyan("   \u2022 58+ Cognitive Modes with Advanced Indicators"));
    console.log(chalk__default.default.cyan("   \u2022 Professional Progress Reporting"));
    console.log(chalk__default.default.cyan("   \u2022 Advanced Content Analysis & OCR"));
    console.log(chalk__default.default.cyan("   \u2022 Complete Local LLM Integration"));
    console.log(chalk__default.default.cyan("   \u2022 CLI Native Development System"));
  });
  program.command("version").description("Show version information").action(() => {
    console.log(chalk__default.default.bold("MARIA CLI v2.1.9"));
    console.log(chalk__default.default.gray("Enhanced UX & Advanced Content Analysis Edition"));
    console.log(chalk__default.default.gray("\xA9 2025 Bonginkan Inc."));
  });
  program.command("status").description("Show system status").action(() => {
    console.log(chalk__default.default.green("\u2705 MARIA OSS Distribution v2.1.9"));
    console.log(chalk__default.default.blue("\u{1F4E6} Enhanced UX & Advanced Content Analysis Edition"));
    console.log(chalk__default.default.yellow("\u{1F517} Full Platform: https://maria-code.vercel.app"));
    console.log(chalk__default.default.cyan("\u2728 New Features:"));
    console.log(chalk__default.default.cyan("   \u2022 Cloud Vision AI Integration"));
    console.log(chalk__default.default.cyan("   \u2022 Real-time Feedback Management"));
    console.log(chalk__default.default.cyan("   \u2022 Enhanced Progress Reporting"));
    console.log(chalk__default.default.cyan("   \u2022 Advanced Mode Indicators"));
  });
  return program;
}
__name(createCLI, "createCLI");
if (__require.main === module) {
  const cli = createCLI();
  cli.parse();
}

exports.createCLI = createCLI;
//# sourceMappingURL=cli.js.map
//# sourceMappingURL=cli.js.map