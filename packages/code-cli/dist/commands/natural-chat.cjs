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

// src/commands/natural-chat.ts
var natural_chat_exports = {};
__export(natural_chat_exports, {
  default: () => naturalChatCommand
});
module.exports = __toCommonJS(natural_chat_exports);
var import_prompts = __toESM(require("prompts"), 1);

// ../../node_modules/.pnpm/chalk@5.5.0/node_modules/chalk/source/vendor/ansi-styles/index.js
var ANSI_BACKGROUND_OFFSET = 10;
var wrapAnsi16 = (offset = 0) => (code) => `\x1B[${code + offset}m`;
var wrapAnsi256 = (offset = 0) => (code) => `\x1B[${38 + offset};5;${code}m`;
var wrapAnsi16m = (offset = 0) => (red, green, blue) => `\x1B[${38 + offset};2;${red};${green};${blue}m`;
var styles = {
  modifier: {
    reset: [0, 0],
    // 21 isn't widely supported and 22 does the same thing
    bold: [1, 22],
    dim: [2, 22],
    italic: [3, 23],
    underline: [4, 24],
    overline: [53, 55],
    inverse: [7, 27],
    hidden: [8, 28],
    strikethrough: [9, 29]
  },
  color: {
    black: [30, 39],
    red: [31, 39],
    green: [32, 39],
    yellow: [33, 39],
    blue: [34, 39],
    magenta: [35, 39],
    cyan: [36, 39],
    white: [37, 39],
    // Bright color
    blackBright: [90, 39],
    gray: [90, 39],
    // Alias of `blackBright`
    grey: [90, 39],
    // Alias of `blackBright`
    redBright: [91, 39],
    greenBright: [92, 39],
    yellowBright: [93, 39],
    blueBright: [94, 39],
    magentaBright: [95, 39],
    cyanBright: [96, 39],
    whiteBright: [97, 39]
  },
  bgColor: {
    bgBlack: [40, 49],
    bgRed: [41, 49],
    bgGreen: [42, 49],
    bgYellow: [43, 49],
    bgBlue: [44, 49],
    bgMagenta: [45, 49],
    bgCyan: [46, 49],
    bgWhite: [47, 49],
    // Bright color
    bgBlackBright: [100, 49],
    bgGray: [100, 49],
    // Alias of `bgBlackBright`
    bgGrey: [100, 49],
    // Alias of `bgBlackBright`
    bgRedBright: [101, 49],
    bgGreenBright: [102, 49],
    bgYellowBright: [103, 49],
    bgBlueBright: [104, 49],
    bgMagentaBright: [105, 49],
    bgCyanBright: [106, 49],
    bgWhiteBright: [107, 49]
  }
};
var modifierNames = Object.keys(styles.modifier);
var foregroundColorNames = Object.keys(styles.color);
var backgroundColorNames = Object.keys(styles.bgColor);
var colorNames = [...foregroundColorNames, ...backgroundColorNames];
function assembleStyles() {
  const codes = /* @__PURE__ */ new Map();
  for (const [groupName, group] of Object.entries(styles)) {
    for (const [styleName, style] of Object.entries(group)) {
      styles[styleName] = {
        open: `\x1B[${style[0]}m`,
        close: `\x1B[${style[1]}m`
      };
      group[styleName] = styles[styleName];
      codes.set(style[0], style[1]);
    }
    Object.defineProperty(styles, groupName, {
      value: group,
      enumerable: false
    });
  }
  Object.defineProperty(styles, "codes", {
    value: codes,
    enumerable: false
  });
  styles.color.close = "\x1B[39m";
  styles.bgColor.close = "\x1B[49m";
  styles.color.ansi = wrapAnsi16();
  styles.color.ansi256 = wrapAnsi256();
  styles.color.ansi16m = wrapAnsi16m();
  styles.bgColor.ansi = wrapAnsi16(ANSI_BACKGROUND_OFFSET);
  styles.bgColor.ansi256 = wrapAnsi256(ANSI_BACKGROUND_OFFSET);
  styles.bgColor.ansi16m = wrapAnsi16m(ANSI_BACKGROUND_OFFSET);
  Object.defineProperties(styles, {
    rgbToAnsi256: {
      value(red, green, blue) {
        if (red === green && green === blue) {
          if (red < 8) {
            return 16;
          }
          if (red > 248) {
            return 231;
          }
          return Math.round((red - 8) / 247 * 24) + 232;
        }
        return 16 + 36 * Math.round(red / 255 * 5) + 6 * Math.round(green / 255 * 5) + Math.round(blue / 255 * 5);
      },
      enumerable: false
    },
    hexToRgb: {
      value(hex) {
        const matches = /[a-f\d]{6}|[a-f\d]{3}/i.exec(hex.toString(16));
        if (!matches) {
          return [0, 0, 0];
        }
        let [colorString] = matches;
        if (colorString.length === 3) {
          colorString = [...colorString].map((character) => character + character).join("");
        }
        const integer = Number.parseInt(colorString, 16);
        return [
          /* eslint-disable no-bitwise */
          integer >> 16 & 255,
          integer >> 8 & 255,
          integer & 255
          /* eslint-enable no-bitwise */
        ];
      },
      enumerable: false
    },
    hexToAnsi256: {
      value: (hex) => styles.rgbToAnsi256(...styles.hexToRgb(hex)),
      enumerable: false
    },
    ansi256ToAnsi: {
      value(code) {
        if (code < 8) {
          return 30 + code;
        }
        if (code < 16) {
          return 90 + (code - 8);
        }
        let red;
        let green;
        let blue;
        if (code >= 232) {
          red = ((code - 232) * 10 + 8) / 255;
          green = red;
          blue = red;
        } else {
          code -= 16;
          const remainder = code % 36;
          red = Math.floor(code / 36) / 5;
          green = Math.floor(remainder / 6) / 5;
          blue = remainder % 6 / 5;
        }
        const value = Math.max(red, green, blue) * 2;
        if (value === 0) {
          return 30;
        }
        let result = 30 + (Math.round(blue) << 2 | Math.round(green) << 1 | Math.round(red));
        if (value === 2) {
          result += 60;
        }
        return result;
      },
      enumerable: false
    },
    rgbToAnsi: {
      value: (red, green, blue) => styles.ansi256ToAnsi(styles.rgbToAnsi256(red, green, blue)),
      enumerable: false
    },
    hexToAnsi: {
      value: (hex) => styles.ansi256ToAnsi(styles.hexToAnsi256(hex)),
      enumerable: false
    }
  });
  return styles;
}
var ansiStyles = assembleStyles();
var ansi_styles_default = ansiStyles;

// ../../node_modules/.pnpm/chalk@5.5.0/node_modules/chalk/source/vendor/supports-color/index.js
var import_node_process = __toESM(require("process"), 1);
var import_node_os = __toESM(require("os"), 1);
var import_node_tty = __toESM(require("tty"), 1);
function hasFlag(flag, argv = globalThis.Deno ? globalThis.Deno.args : import_node_process.default.argv) {
  const prefix = flag.startsWith("-") ? "" : flag.length === 1 ? "-" : "--";
  const position = argv.indexOf(prefix + flag);
  const terminatorPosition = argv.indexOf("--");
  return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
}
var { env } = import_node_process.default;
var flagForceColor;
if (hasFlag("no-color") || hasFlag("no-colors") || hasFlag("color=false") || hasFlag("color=never")) {
  flagForceColor = 0;
} else if (hasFlag("color") || hasFlag("colors") || hasFlag("color=true") || hasFlag("color=always")) {
  flagForceColor = 1;
}
function envForceColor() {
  if ("FORCE_COLOR" in env) {
    if (env.FORCE_COLOR === "true") {
      return 1;
    }
    if (env.FORCE_COLOR === "false") {
      return 0;
    }
    return env.FORCE_COLOR.length === 0 ? 1 : Math.min(Number.parseInt(env.FORCE_COLOR, 10), 3);
  }
}
function translateLevel(level) {
  if (level === 0) {
    return false;
  }
  return {
    level,
    hasBasic: true,
    has256: level >= 2,
    has16m: level >= 3
  };
}
function _supportsColor(haveStream, { streamIsTTY, sniffFlags = true } = {}) {
  const noFlagForceColor = envForceColor();
  if (noFlagForceColor !== void 0) {
    flagForceColor = noFlagForceColor;
  }
  const forceColor = sniffFlags ? flagForceColor : noFlagForceColor;
  if (forceColor === 0) {
    return 0;
  }
  if (sniffFlags) {
    if (hasFlag("color=16m") || hasFlag("color=full") || hasFlag("color=truecolor")) {
      return 3;
    }
    if (hasFlag("color=256")) {
      return 2;
    }
  }
  if ("TF_BUILD" in env && "AGENT_NAME" in env) {
    return 1;
  }
  if (haveStream && !streamIsTTY && forceColor === void 0) {
    return 0;
  }
  const min = forceColor || 0;
  if (env.TERM === "dumb") {
    return min;
  }
  if (import_node_process.default.platform === "win32") {
    const osRelease = import_node_os.default.release().split(".");
    if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) {
      return Number(osRelease[2]) >= 14931 ? 3 : 2;
    }
    return 1;
  }
  if ("CI" in env) {
    if (["GITHUB_ACTIONS", "GITEA_ACTIONS", "CIRCLECI"].some((key) => key in env)) {
      return 3;
    }
    if (["TRAVIS", "APPVEYOR", "GITLAB_CI", "BUILDKITE", "DRONE"].some((sign) => sign in env) || env.CI_NAME === "codeship") {
      return 1;
    }
    return min;
  }
  if ("TEAMCITY_VERSION" in env) {
    return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
  }
  if (env.COLORTERM === "truecolor") {
    return 3;
  }
  if (env.TERM === "xterm-kitty") {
    return 3;
  }
  if (env.TERM === "xterm-ghostty") {
    return 3;
  }
  if ("TERM_PROGRAM" in env) {
    const version = Number.parseInt((env.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
    switch (env.TERM_PROGRAM) {
      case "iTerm.app": {
        return version >= 3 ? 3 : 2;
      }
      case "Apple_Terminal": {
        return 2;
      }
    }
  }
  if (/-256(color)?$/i.test(env.TERM)) {
    return 2;
  }
  if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
    return 1;
  }
  if ("COLORTERM" in env) {
    return 1;
  }
  return min;
}
function createSupportsColor(stream, options = {}) {
  const level = _supportsColor(stream, {
    streamIsTTY: stream && stream.isTTY,
    ...options
  });
  return translateLevel(level);
}
var supportsColor = {
  stdout: createSupportsColor({ isTTY: import_node_tty.default.isatty(1) }),
  stderr: createSupportsColor({ isTTY: import_node_tty.default.isatty(2) })
};
var supports_color_default = supportsColor;

// ../../node_modules/.pnpm/chalk@5.5.0/node_modules/chalk/source/utilities.js
function stringReplaceAll(string, substring, replacer) {
  let index = string.indexOf(substring);
  if (index === -1) {
    return string;
  }
  const substringLength = substring.length;
  let endIndex = 0;
  let returnValue = "";
  do {
    returnValue += string.slice(endIndex, index) + substring + replacer;
    endIndex = index + substringLength;
    index = string.indexOf(substring, endIndex);
  } while (index !== -1);
  returnValue += string.slice(endIndex);
  return returnValue;
}
function stringEncaseCRLFWithFirstIndex(string, prefix, postfix, index) {
  let endIndex = 0;
  let returnValue = "";
  do {
    const gotCR = string[index - 1] === "\r";
    returnValue += string.slice(endIndex, gotCR ? index - 1 : index) + prefix + (gotCR ? "\r\n" : "\n") + postfix;
    endIndex = index + 1;
    index = string.indexOf("\n", endIndex);
  } while (index !== -1);
  returnValue += string.slice(endIndex);
  return returnValue;
}

// ../../node_modules/.pnpm/chalk@5.5.0/node_modules/chalk/source/index.js
var { stdout: stdoutColor, stderr: stderrColor } = supports_color_default;
var GENERATOR = Symbol("GENERATOR");
var STYLER = Symbol("STYLER");
var IS_EMPTY = Symbol("IS_EMPTY");
var levelMapping = [
  "ansi",
  "ansi",
  "ansi256",
  "ansi16m"
];
var styles2 = /* @__PURE__ */ Object.create(null);
var applyOptions = (object, options = {}) => {
  if (options.level && !(Number.isInteger(options.level) && options.level >= 0 && options.level <= 3)) {
    throw new Error("The `level` option should be an integer from 0 to 3");
  }
  const colorLevel = stdoutColor ? stdoutColor.level : 0;
  object.level = options.level === void 0 ? colorLevel : options.level;
};
var chalkFactory = (options) => {
  const chalk2 = (...strings) => strings.join(" ");
  applyOptions(chalk2, options);
  Object.setPrototypeOf(chalk2, createChalk.prototype);
  return chalk2;
};
function createChalk(options) {
  return chalkFactory(options);
}
Object.setPrototypeOf(createChalk.prototype, Function.prototype);
for (const [styleName, style] of Object.entries(ansi_styles_default)) {
  styles2[styleName] = {
    get() {
      const builder = createBuilder(this, createStyler(style.open, style.close, this[STYLER]), this[IS_EMPTY]);
      Object.defineProperty(this, styleName, { value: builder });
      return builder;
    }
  };
}
styles2.visible = {
  get() {
    const builder = createBuilder(this, this[STYLER], true);
    Object.defineProperty(this, "visible", { value: builder });
    return builder;
  }
};
var getModelAnsi = (model, level, type, ...arguments_) => {
  if (model === "rgb") {
    if (level === "ansi16m") {
      return ansi_styles_default[type].ansi16m(...arguments_);
    }
    if (level === "ansi256") {
      return ansi_styles_default[type].ansi256(ansi_styles_default.rgbToAnsi256(...arguments_));
    }
    return ansi_styles_default[type].ansi(ansi_styles_default.rgbToAnsi(...arguments_));
  }
  if (model === "hex") {
    return getModelAnsi("rgb", level, type, ...ansi_styles_default.hexToRgb(...arguments_));
  }
  return ansi_styles_default[type][model](...arguments_);
};
var usedModels = ["rgb", "hex", "ansi256"];
for (const model of usedModels) {
  styles2[model] = {
    get() {
      const { level } = this;
      return function(...arguments_) {
        const styler = createStyler(getModelAnsi(model, levelMapping[level], "color", ...arguments_), ansi_styles_default.color.close, this[STYLER]);
        return createBuilder(this, styler, this[IS_EMPTY]);
      };
    }
  };
  const bgModel = "bg" + model[0].toUpperCase() + model.slice(1);
  styles2[bgModel] = {
    get() {
      const { level } = this;
      return function(...arguments_) {
        const styler = createStyler(getModelAnsi(model, levelMapping[level], "bgColor", ...arguments_), ansi_styles_default.bgColor.close, this[STYLER]);
        return createBuilder(this, styler, this[IS_EMPTY]);
      };
    }
  };
}
var proto = Object.defineProperties(() => {
}, {
  ...styles2,
  level: {
    enumerable: true,
    get() {
      return this[GENERATOR].level;
    },
    set(level) {
      this[GENERATOR].level = level;
    }
  }
});
var createStyler = (open, close, parent) => {
  let openAll;
  let closeAll;
  if (parent === void 0) {
    openAll = open;
    closeAll = close;
  } else {
    openAll = parent.openAll + open;
    closeAll = close + parent.closeAll;
  }
  return {
    open,
    close,
    openAll,
    closeAll,
    parent
  };
};
var createBuilder = (self, _styler, _isEmpty) => {
  const builder = (...arguments_) => applyStyle(builder, arguments_.length === 1 ? "" + arguments_[0] : arguments_.join(" "));
  Object.setPrototypeOf(builder, proto);
  builder[GENERATOR] = self;
  builder[STYLER] = _styler;
  builder[IS_EMPTY] = _isEmpty;
  return builder;
};
var applyStyle = (self, string) => {
  if (self.level <= 0 || !string) {
    return self[IS_EMPTY] ? "" : string;
  }
  let styler = self[STYLER];
  if (styler === void 0) {
    return string;
  }
  const { openAll, closeAll } = styler;
  if (string.includes("\x1B")) {
    while (styler !== void 0) {
      string = stringReplaceAll(string, styler.close, styler.open);
      styler = styler.parent;
    }
  }
  const lfIndex = string.indexOf("\n");
  if (lfIndex !== -1) {
    string = stringEncaseCRLFWithFirstIndex(string, closeAll, openAll, lfIndex);
  }
  return openAll + string + closeAll;
};
Object.defineProperties(createChalk.prototype, styles2);
var chalk = createChalk();
var chalkStderr = createChalk({ level: stderrColor ? stderrColor.level : 0 });
var source_default = chalk;

// src/commands/natural-chat.ts
var import_ora = __toESM(require("ora"), 1);
function naturalChatCommand(program) {
  program.command("chat").description("\u81EA\u7136\u8A00\u8A9E\u3067\u306E\u5BFE\u8A71\u578B\u30C1\u30E3\u30C3\u30C8\u30BB\u30C3\u30B7\u30E7\u30F3").option("-m, --mode <mode>", "\u52D5\u4F5C\u30E2\u30FC\u30C9 (chat/research/creative)", "chat").option("-v, --verbose", "\u8A73\u7D30\u51FA\u529B\u3092\u8868\u793A", false).action(async (options) => {
    console.log(source_default.cyan.bold("\u{1F916} MARIA CODE Chat Interface"));
    console.log(source_default.gray(`Mode: ${options.mode} | Verbose: ${options.verbose}`));
    console.log(source_default.yellow('Type your request in natural language. Type "exit" to quit.\n'));
    const session = {
      messages: [],
      sessionId: generateSessionId(),
      startTime: /* @__PURE__ */ new Date()
    };
    while (true) {
      try {
        const response = await (0, import_prompts.default)({
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
          showHelp();
          continue;
        }
        if (userMessage.toLowerCase() === "history") {
          showHistory(session);
          continue;
        }
        if (userMessage.toLowerCase() === "clear") {
          console.clear();
          console.log(source_default.cyan.bold("\u{1F916} MARIA CODE Chat Interface"));
          console.log(source_default.gray("Chat history cleared.\n"));
          session.messages = [];
          continue;
        }
        session.messages.push({
          role: "user",
          content: userMessage,
          timestamp: /* @__PURE__ */ new Date()
        });
        const aiResponse = await processUserMessage(userMessage);
        session.messages.push({
          role: "assistant",
          content: aiResponse,
          timestamp: /* @__PURE__ */ new Date()
        });
        console.log(source_default.green("\u{1F916} MARIA:"), aiResponse);
        console.log("");
      } catch (error) {
        if (error instanceof Error && error.message.includes("cancelled")) {
          console.log(source_default.yellow("\n\u{1F44B} Chat session cancelled."));
          break;
        }
        console.error(source_default.red("Error:"), error);
      }
    }
    showSessionStats(session);
  });
}
async function processUserMessage(message) {
  const spinner = (0, import_ora.default)("\u{1F914} MARIA is thinking...").start();
  try {
    await new Promise((resolve) => setTimeout(resolve, 1e3 + Math.random() * 2e3));
    spinner.stop();
    const response = await generateResponse(message);
    return response;
  } catch (error) {
    spinner.stop();
    return `\u7533\u3057\u8A33\u3042\u308A\u307E\u305B\u3093\u3002\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}
async function generateResponse(message) {
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
    if (lowerMessage.includes("component") || lowerMessage.includes("\u30B3\u30F3\u30DD\u30FC\u30CD\u30F3\u30C8")) {
      return `React\u30B3\u30F3\u30DD\u30FC\u30CD\u30F3\u30C8\u306E\u4F5C\u6210\u3067\u3059\u306D\uFF01

\u4EE5\u4E0B\u3092\u6559\u3048\u3066\u304F\u3060\u3055\u3044\uFF1A
\u2022 \u30B3\u30F3\u30DD\u30FC\u30CD\u30F3\u30C8\u540D
\u2022 \u5FC5\u8981\u306A\u30D7\u30ED\u30D1\u30C6\u30A3
\u2022 \u898B\u305F\u76EE\u3084\u6A5F\u80FD\u306E\u8981\u4EF6
\u2022 \u30B9\u30BF\u30A4\u30EA\u30F3\u30B0\u65B9\u6CD5\uFF08Tailwind CSS\u4F7F\u7528\u53EF\u80FD\uFF09`;
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
  if (lowerMessage.includes("test") || lowerMessage.includes("\u30C6\u30B9\u30C8")) {
    return `\u30C6\u30B9\u30C8\u4F5C\u6210\u306E\u30B5\u30DD\u30FC\u30C8\u3092\u3057\u307E\u3059\u3002

\u30C6\u30B9\u30C8\u306E\u7A2E\u985E\uFF1A
\u2022 \u30E6\u30CB\u30C3\u30C8\u30C6\u30B9\u30C8\uFF08\u95A2\u6570\u30FB\u30B3\u30F3\u30DD\u30FC\u30CD\u30F3\u30C8\u5358\u4F4D\uFF09
\u2022 \u7D71\u5408\u30C6\u30B9\u30C8\uFF08\u6A5F\u80FD\u5358\u4F4D\uFF09
\u2022 E2E\u30C6\u30B9\u30C8\uFF08\u30B7\u30CA\u30EA\u30AA\u30D9\u30FC\u30B9\uFF09

\u3069\u306E\u3088\u3046\u306A\u30C6\u30B9\u30C8\u3092\u4F5C\u6210\u3057\u305F\u3044\u304B\u8A73\u7D30\u3092\u6559\u3048\u3066\u304F\u3060\u3055\u3044\u3002`;
  }
  if (lowerMessage.includes("deploy") || lowerMessage.includes("\u30C7\u30D7\u30ED\u30A4")) {
    return `\u30C7\u30D7\u30ED\u30A4\u30E1\u30F3\u30C8\u306B\u3064\u3044\u3066\u30B5\u30DD\u30FC\u30C8\u3057\u307E\u3059\u3002

\u5229\u7528\u53EF\u80FD\u306A\u74B0\u5883\uFF1A
\u2022 Development (dev)
\u2022 Staging (stg)
\u2022 Production (prod)

\u73FE\u5728\u306E\u8A2D\u5B9A\u3084\u30C7\u30D7\u30ED\u30A4\u3057\u305F\u3044\u74B0\u5883\u3092\u6559\u3048\u3066\u304F\u3060\u3055\u3044\u3002`;
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
    `\u306A\u308B\u307B\u3069\u3001\u300C${message}\u300D\u306B\u3064\u3044\u3066\u3067\u3059\u306D\u3002\u3082\u3046\u5C11\u3057\u8A73\u7D30\u3092\u6559\u3048\u3066\u3044\u305F\u3060\u3051\u307E\u3059\u304B\uFF1F\u5177\u4F53\u7684\u306B\u3069\u306E\u3088\u3046\u306A\u4F5C\u696D\u3092\u304A\u624B\u4F1D\u3044\u3067\u304D\u308B\u3067\u3057\u3087\u3046\u304B\uFF1F`,
    `\u3054\u4F9D\u983C\u306E\u5185\u5BB9\u3092\u7406\u89E3\u3057\u307E\u3057\u305F\u3002\u4EE5\u4E0B\u306E\u89B3\u70B9\u304B\u3089\u691C\u8A0E\u3057\u3066\u307F\u307E\u3057\u3087\u3046\uFF1A

\u2022 \u6280\u8853\u7684\u8981\u4EF6
\u2022 \u5B9F\u88C5\u65B9\u6CD5
\u2022 \u5FC5\u8981\u306A\u30EA\u30BD\u30FC\u30B9

\u8FFD\u52A0\u306E\u60C5\u5831\u304C\u3042\u308C\u3070\u6559\u3048\u3066\u304F\u3060\u3055\u3044\u3002`,
    `\u300C${message}\u300D\u306B\u95A2\u3057\u3066\u3001MARIA CODE\u3067\u30B5\u30DD\u30FC\u30C8\u3067\u304D\u308B\u65B9\u6CD5\u3092\u8003\u3048\u3066\u3044\u307E\u3059\u3002

\u95A2\u9023\u3059\u308B\u30C4\u30FC\u30EB\u3084\u6A5F\u80FD\uFF1A
\u2022 \u30B3\u30FC\u30C9\u751F\u6210
\u2022 \u30D5\u30A1\u30A4\u30EB\u64CD\u4F5C
\u2022 \u30C6\u30B9\u30C8\u4F5C\u6210
\u2022 \u30C7\u30D7\u30ED\u30A4\u30E1\u30F3\u30C8

\u3069\u3061\u3089\u306E\u65B9\u5411\u3067\u9032\u3081\u305F\u3044\u3067\u3057\u3087\u3046\u304B\uFF1F`
  ];
  const randomIndex = Math.floor(Math.random() * responses.length);
  return responses[randomIndex] ?? "\u7533\u3057\u8A33\u3042\u308A\u307E\u305B\u3093\u3002\u73FE\u5728\u51E6\u7406\u3067\u304D\u307E\u305B\u3093\u3002";
}
function showHelp() {
  console.log(source_default.cyan.bold("\n\u{1F4DA} Available Commands:"));
  console.log(source_default.yellow("  help     ") + "- Show this help message");
  console.log(source_default.yellow("  history  ") + "- Show conversation history");
  console.log(source_default.yellow("  clear    ") + "- Clear chat history");
  console.log(source_default.yellow("  exit     ") + "- End chat session");
  console.log(source_default.gray("\n\u{1F4A1} Tips:"));
  console.log(source_default.gray("  - Use natural language to describe what you want"));
  console.log(source_default.gray("  - Be specific about files, functions, or features"));
  console.log(source_default.gray("  - Ask for explanations, code creation, or fixes"));
  console.log("");
}
function showHistory(session) {
  console.log(source_default.cyan.bold("\n\u{1F4DD} Conversation History:"));
  if (session.messages.length === 0) {
    console.log(source_default.gray("No messages yet."));
  } else {
    session.messages.forEach((msg) => {
      const time = msg.timestamp.toLocaleTimeString();
      const role = msg.role === "user" ? source_default.blue("You") : source_default.green("\u{1F916} MARIA");
      console.log(source_default.gray(`[${time}]`), role + ":", msg.content.substring(0, 100) + (msg.content.length > 100 ? "..." : ""));
    });
  }
  console.log("");
}
function showSessionStats(session) {
  const duration = Date.now() - session.startTime.getTime();
  const minutes = Math.floor(duration / 6e4);
  const seconds = Math.floor(duration % 6e4 / 1e3);
  console.log(source_default.cyan.bold("\n\u{1F4CA} Session Summary:"));
  console.log(source_default.gray(`Session ID: ${session.sessionId}`));
  console.log(source_default.gray(`Duration: ${minutes}m ${seconds}s`));
  console.log(source_default.gray(`Messages: ${session.messages.length}`));
  console.log(source_default.gray(`Started: ${session.startTime.toLocaleString()}`));
  console.log("");
}
function generateSessionId() {
  return "session_" + Date.now().toString(36) + Math.random().toString(36).substr(2);
}
//# sourceMappingURL=natural-chat.cjs.map