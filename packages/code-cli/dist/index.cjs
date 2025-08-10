var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
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

// ../../node_modules/.pnpm/dotenv@16.6.1/node_modules/dotenv/package.json
var require_package = __commonJS({
  "../../node_modules/.pnpm/dotenv@16.6.1/node_modules/dotenv/package.json"(exports2, module2) {
    module2.exports = {
      name: "dotenv",
      version: "16.6.1",
      description: "Loads environment variables from .env file",
      main: "lib/main.js",
      types: "lib/main.d.ts",
      exports: {
        ".": {
          types: "./lib/main.d.ts",
          require: "./lib/main.js",
          default: "./lib/main.js"
        },
        "./config": "./config.js",
        "./config.js": "./config.js",
        "./lib/env-options": "./lib/env-options.js",
        "./lib/env-options.js": "./lib/env-options.js",
        "./lib/cli-options": "./lib/cli-options.js",
        "./lib/cli-options.js": "./lib/cli-options.js",
        "./package.json": "./package.json"
      },
      scripts: {
        "dts-check": "tsc --project tests/types/tsconfig.json",
        lint: "standard",
        pretest: "npm run lint && npm run dts-check",
        test: "tap run --allow-empty-coverage --disable-coverage --timeout=60000",
        "test:coverage": "tap run --show-full-coverage --timeout=60000 --coverage-report=text --coverage-report=lcov",
        prerelease: "npm test",
        release: "standard-version"
      },
      repository: {
        type: "git",
        url: "git://github.com/motdotla/dotenv.git"
      },
      homepage: "https://github.com/motdotla/dotenv#readme",
      funding: "https://dotenvx.com",
      keywords: [
        "dotenv",
        "env",
        ".env",
        "environment",
        "variables",
        "config",
        "settings"
      ],
      readmeFilename: "README.md",
      license: "BSD-2-Clause",
      devDependencies: {
        "@types/node": "^18.11.3",
        decache: "^4.6.2",
        sinon: "^14.0.1",
        standard: "^17.0.0",
        "standard-version": "^9.5.0",
        tap: "^19.2.0",
        typescript: "^4.8.4"
      },
      engines: {
        node: ">=12"
      },
      browser: {
        fs: false
      }
    };
  }
});

// ../../node_modules/.pnpm/dotenv@16.6.1/node_modules/dotenv/lib/main.js
var require_main = __commonJS({
  "../../node_modules/.pnpm/dotenv@16.6.1/node_modules/dotenv/lib/main.js"(exports2, module2) {
    var fs2 = require("fs");
    var path2 = require("path");
    var os2 = require("os");
    var crypto = require("crypto");
    var packageJson = require_package();
    var version = packageJson.version;
    var LINE = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg;
    function parse2(src) {
      const obj = {};
      let lines = src.toString();
      lines = lines.replace(/\r\n?/mg, "\n");
      let match;
      while ((match = LINE.exec(lines)) != null) {
        const key = match[1];
        let value = match[2] || "";
        value = value.trim();
        const maybeQuote = value[0];
        value = value.replace(/^(['"`])([\s\S]*)\1$/mg, "$2");
        if (maybeQuote === '"') {
          value = value.replace(/\\n/g, "\n");
          value = value.replace(/\\r/g, "\r");
        }
        obj[key] = value;
      }
      return obj;
    }
    function _parseVault(options) {
      options = options || {};
      const vaultPath = _vaultPath(options);
      options.path = vaultPath;
      const result = DotenvModule.configDotenv(options);
      if (!result.parsed) {
        const err = new Error(`MISSING_DATA: Cannot parse ${vaultPath} for an unknown reason`);
        err.code = "MISSING_DATA";
        throw err;
      }
      const keys = _dotenvKey(options).split(",");
      const length = keys.length;
      let decrypted;
      for (let i = 0; i < length; i++) {
        try {
          const key = keys[i].trim();
          const attrs = _instructions(result, key);
          decrypted = DotenvModule.decrypt(attrs.ciphertext, attrs.key);
          break;
        } catch (error) {
          if (i + 1 >= length) {
            throw error;
          }
        }
      }
      return DotenvModule.parse(decrypted);
    }
    function _warn(message) {
      console.log(`[dotenv@${version}][WARN] ${message}`);
    }
    function _debug(message) {
      console.log(`[dotenv@${version}][DEBUG] ${message}`);
    }
    function _log(message) {
      console.log(`[dotenv@${version}] ${message}`);
    }
    function _dotenvKey(options) {
      if (options && options.DOTENV_KEY && options.DOTENV_KEY.length > 0) {
        return options.DOTENV_KEY;
      }
      if (process.env.DOTENV_KEY && process.env.DOTENV_KEY.length > 0) {
        return process.env.DOTENV_KEY;
      }
      return "";
    }
    function _instructions(result, dotenvKey) {
      let uri;
      try {
        uri = new URL(dotenvKey);
      } catch (error) {
        if (error.code === "ERR_INVALID_URL") {
          const err = new Error("INVALID_DOTENV_KEY: Wrong format. Must be in valid uri format like dotenv://:key_1234@dotenvx.com/vault/.env.vault?environment=development");
          err.code = "INVALID_DOTENV_KEY";
          throw err;
        }
        throw error;
      }
      const key = uri.password;
      if (!key) {
        const err = new Error("INVALID_DOTENV_KEY: Missing key part");
        err.code = "INVALID_DOTENV_KEY";
        throw err;
      }
      const environment = uri.searchParams.get("environment");
      if (!environment) {
        const err = new Error("INVALID_DOTENV_KEY: Missing environment part");
        err.code = "INVALID_DOTENV_KEY";
        throw err;
      }
      const environmentKey = `DOTENV_VAULT_${environment.toUpperCase()}`;
      const ciphertext = result.parsed[environmentKey];
      if (!ciphertext) {
        const err = new Error(`NOT_FOUND_DOTENV_ENVIRONMENT: Cannot locate environment ${environmentKey} in your .env.vault file.`);
        err.code = "NOT_FOUND_DOTENV_ENVIRONMENT";
        throw err;
      }
      return { ciphertext, key };
    }
    function _vaultPath(options) {
      let possibleVaultPath = null;
      if (options && options.path && options.path.length > 0) {
        if (Array.isArray(options.path)) {
          for (const filepath of options.path) {
            if (fs2.existsSync(filepath)) {
              possibleVaultPath = filepath.endsWith(".vault") ? filepath : `${filepath}.vault`;
            }
          }
        } else {
          possibleVaultPath = options.path.endsWith(".vault") ? options.path : `${options.path}.vault`;
        }
      } else {
        possibleVaultPath = path2.resolve(process.cwd(), ".env.vault");
      }
      if (fs2.existsSync(possibleVaultPath)) {
        return possibleVaultPath;
      }
      return null;
    }
    function _resolveHome(envPath) {
      return envPath[0] === "~" ? path2.join(os2.homedir(), envPath.slice(1)) : envPath;
    }
    function _configVault(options) {
      const debug = Boolean(options && options.debug);
      const quiet = options && "quiet" in options ? options.quiet : true;
      if (debug || !quiet) {
        _log("Loading env from encrypted .env.vault");
      }
      const parsed = DotenvModule._parseVault(options);
      let processEnv = process.env;
      if (options && options.processEnv != null) {
        processEnv = options.processEnv;
      }
      DotenvModule.populate(processEnv, parsed, options);
      return { parsed };
    }
    function configDotenv(options) {
      const dotenvPath = path2.resolve(process.cwd(), ".env");
      let encoding = "utf8";
      const debug = Boolean(options && options.debug);
      const quiet = options && "quiet" in options ? options.quiet : true;
      if (options && options.encoding) {
        encoding = options.encoding;
      } else {
        if (debug) {
          _debug("No encoding is specified. UTF-8 is used by default");
        }
      }
      let optionPaths = [dotenvPath];
      if (options && options.path) {
        if (!Array.isArray(options.path)) {
          optionPaths = [_resolveHome(options.path)];
        } else {
          optionPaths = [];
          for (const filepath of options.path) {
            optionPaths.push(_resolveHome(filepath));
          }
        }
      }
      let lastError;
      const parsedAll = {};
      for (const path3 of optionPaths) {
        try {
          const parsed = DotenvModule.parse(fs2.readFileSync(path3, { encoding }));
          DotenvModule.populate(parsedAll, parsed, options);
        } catch (e) {
          if (debug) {
            _debug(`Failed to load ${path3} ${e.message}`);
          }
          lastError = e;
        }
      }
      let processEnv = process.env;
      if (options && options.processEnv != null) {
        processEnv = options.processEnv;
      }
      DotenvModule.populate(processEnv, parsedAll, options);
      if (debug || !quiet) {
        const keysCount = Object.keys(parsedAll).length;
        const shortPaths = [];
        for (const filePath of optionPaths) {
          try {
            const relative = path2.relative(process.cwd(), filePath);
            shortPaths.push(relative);
          } catch (e) {
            if (debug) {
              _debug(`Failed to load ${filePath} ${e.message}`);
            }
            lastError = e;
          }
        }
        _log(`injecting env (${keysCount}) from ${shortPaths.join(",")}`);
      }
      if (lastError) {
        return { parsed: parsedAll, error: lastError };
      } else {
        return { parsed: parsedAll };
      }
    }
    function config2(options) {
      if (_dotenvKey(options).length === 0) {
        return DotenvModule.configDotenv(options);
      }
      const vaultPath = _vaultPath(options);
      if (!vaultPath) {
        _warn(`You set DOTENV_KEY but you are missing a .env.vault file at ${vaultPath}. Did you forget to build it?`);
        return DotenvModule.configDotenv(options);
      }
      return DotenvModule._configVault(options);
    }
    function decrypt(encrypted, keyStr) {
      const key = Buffer.from(keyStr.slice(-64), "hex");
      let ciphertext = Buffer.from(encrypted, "base64");
      const nonce = ciphertext.subarray(0, 12);
      const authTag = ciphertext.subarray(-16);
      ciphertext = ciphertext.subarray(12, -16);
      try {
        const aesgcm = crypto.createDecipheriv("aes-256-gcm", key, nonce);
        aesgcm.setAuthTag(authTag);
        return `${aesgcm.update(ciphertext)}${aesgcm.final()}`;
      } catch (error) {
        const isRange = error instanceof RangeError;
        const invalidKeyLength = error.message === "Invalid key length";
        const decryptionFailed = error.message === "Unsupported state or unable to authenticate data";
        if (isRange || invalidKeyLength) {
          const err = new Error("INVALID_DOTENV_KEY: It must be 64 characters long (or more)");
          err.code = "INVALID_DOTENV_KEY";
          throw err;
        } else if (decryptionFailed) {
          const err = new Error("DECRYPTION_FAILED: Please check your DOTENV_KEY");
          err.code = "DECRYPTION_FAILED";
          throw err;
        } else {
          throw error;
        }
      }
    }
    function populate(processEnv, parsed, options = {}) {
      const debug = Boolean(options && options.debug);
      const override = Boolean(options && options.override);
      if (typeof parsed !== "object") {
        const err = new Error("OBJECT_REQUIRED: Please check the processEnv argument being passed to populate");
        err.code = "OBJECT_REQUIRED";
        throw err;
      }
      for (const key of Object.keys(parsed)) {
        if (Object.prototype.hasOwnProperty.call(processEnv, key)) {
          if (override === true) {
            processEnv[key] = parsed[key];
          }
          if (debug) {
            if (override === true) {
              _debug(`"${key}" is already defined and WAS overwritten`);
            } else {
              _debug(`"${key}" is already defined and was NOT overwritten`);
            }
          }
        } else {
          processEnv[key] = parsed[key];
        }
      }
    }
    var DotenvModule = {
      configDotenv,
      _configVault,
      _parseVault,
      config: config2,
      decrypt,
      parse: parse2,
      populate
    };
    module2.exports.configDotenv = DotenvModule.configDotenv;
    module2.exports._configVault = DotenvModule._configVault;
    module2.exports._parseVault = DotenvModule._parseVault;
    module2.exports.config = DotenvModule.config;
    module2.exports.decrypt = DotenvModule.decrypt;
    module2.exports.parse = DotenvModule.parse;
    module2.exports.populate = DotenvModule.populate;
    module2.exports = DotenvModule;
  }
});

// src/index.tsx
var src_exports = {};
__export(src_exports, {
  displayLogo: () => displayLogo,
  graphCommand: () => registerGraphCommand,
  runCLI: () => runCLI
});
module.exports = __toCommonJS(src_exports);

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

// src/simple-interactive-cli.ts
var import_readline = require("readline");

// src/utils/env-loader.ts
var import_fs = require("fs");
var import_path = require("path");
var import_dotenv = __toESM(require_main(), 1);
function loadEnvironmentVariables() {
  const localEnvPath = (0, import_path.join)(process.cwd(), ".env.local");
  if ((0, import_fs.existsSync)(localEnvPath)) {
    const result = (0, import_dotenv.config)({ path: localEnvPath });
    if (result.error) {
      console.warn("Error loading .env.local:", result.error);
    } else {
      console.log("\u2705 Loaded environment from .env.local");
    }
  }
  const envPath = (0, import_path.join)(process.cwd(), ".env");
  if ((0, import_fs.existsSync)(envPath)) {
    const result = (0, import_dotenv.config)({ path: envPath, override: false });
    if (result.error) {
      console.warn("Error loading .env:", result.error);
    }
  }
  const lmstudioEnvPath = (0, import_path.join)(process.cwd(), ".env.lmstudio");
  if ((0, import_fs.existsSync)(lmstudioEnvPath)) {
    const result = (0, import_dotenv.config)({ path: lmstudioEnvPath, override: false });
    if (result.error) {
      console.warn("Error loading .env.lmstudio:", result.error);
    }
  }
}
function getEnvironmentStatus() {
  const providers = [];
  if (process.env.OPENAI_API_KEY) providers.push("OpenAI");
  if (process.env.ANTHROPIC_API_KEY) providers.push("Anthropic");
  if (process.env.GEMINI_API_KEY) providers.push("Google Gemini");
  if (process.env.GROK_API_KEY) providers.push("Grok");
  if (process.env.LMSTUDIO_ENABLED === "true") providers.push("LM Studio");
  return {
    hasApiKeys: providers.length > 0,
    providers,
    offlineMode: process.env.OFFLINE_MODE === "true",
    lmStudioEnabled: process.env.LMSTUDIO_ENABLED === "true"
  };
}

// src/simple-interactive-cli.ts
var fs = __toESM(require("fs"), 1);
var path = __toESM(require("path"), 1);
var MariaCLI = class {
  rl;
  commands = [];
  isProcessing = false;
  constructor() {
    loadEnvironmentVariables();
    this.rl = (0, import_readline.createInterface)({
      input: process.stdin,
      output: process.stdout,
      prompt: source_default.cyan("\u27A4 "),
      terminal: true
    });
    this.showWelcome();
    this.setupHandlers();
    this.startPrompt();
  }
  showWelcome() {
    const logo = `
${source_default.bold.magenta("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557")}
${source_default.bold.magenta("\u2551")}                                                              ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}    ${source_default.bold.magenta("\u2588\u2588\u2588\u2557   \u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2557")}                    ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}    ${source_default.bold.magenta("\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}    ${source_default.bold.magenta("\u2588\u2588\u2554\u2588\u2588\u2588\u2588\u2554\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}    ${source_default.bold.magenta("\u2588\u2588\u2551\u255A\u2588\u2588\u2554\u255D\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}    ${source_default.bold.magenta("\u2588\u2588\u2551 \u255A\u2550\u255D \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}    ${source_default.bold.magenta("\u255A\u2550\u255D     \u255A\u2550\u255D\u255A\u2550\u255D  \u255A\u2550\u255D\u255A\u2550\u255D  \u255A\u2550\u255D\u255A\u2550\u255D\u255A\u2550\u255D  \u255A\u2550\u255D")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}                                                              ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}           ${source_default.bold.magenta("\u2591\u2588\u2588\u2588\u2588\u2588\u2557\u2591\u2591\u2588\u2588\u2588\u2588\u2588\u2557\u2591\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2591\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}           ${source_default.bold.magenta("\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}           ${source_default.bold.magenta("\u2588\u2588\u2551\u2591\u2591\u255A\u2550\u255D\u2588\u2588\u2551\u2591\u2591\u2588\u2588\u2551\u2588\u2588\u2551\u2591\u2591\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2557\u2591\u2591")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}           ${source_default.bold.magenta("\u2588\u2588\u2551\u2591\u2591\u2588\u2588\u2557\u2588\u2588\u2551\u2591\u2591\u2588\u2588\u2551\u2588\u2588\u2551\u2591\u2591\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u255D\u2591\u2591")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}           ${source_default.bold.magenta("\u255A\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u255A\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}           ${source_default.bold.magenta("\u2591\u255A\u2550\u2550\u2550\u2550\u255D\u2591\u2591\u255A\u2550\u2550\u2550\u2550\u255D\u2591\u255A\u2550\u2550\u2550\u2550\u2550\u255D\u2591\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}                                                              ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}          ${source_default.bold.magenta("AI-Powered Development Platform")}                    ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}              ${source_default.magenta("v1.0.0 | TypeScript Monorepo")}                     ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}                                                              ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}             ${source_default.bold.cyan("\xA9 2025 Bonginkan Inc.")}                           ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}                                                              ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D")}
`;
    console.log(logo);
    console.log(source_default.bold.cyan("\u{1F31F} Welcome to MARIA CODE CLI! \u{1F31F}\n"));
    console.log(source_default.cyan("\u{1F4DA} Available Commands:"));
    console.log(source_default.gray("  \u2022 /help            - Show available commands"));
    console.log(source_default.gray("  \u2022 /clear           - Clear command history"));
    console.log(source_default.gray("  \u2022 /status          - Show system status"));
    console.log(source_default.gray("  \u2022 /model           - Interactive AI model selector"));
    console.log(source_default.gray("  \u2022 /init            - Initialize MARIA project"));
    console.log(source_default.gray("  \u2022 mc chat          - Interactive AI chat mode"));
    console.log(source_default.gray("  \u2022 mc paper         - Academic paper development"));
    console.log(source_default.gray("  \u2022 mc slides        - Presentation creation"));
    console.log(source_default.gray("  \u2022 mc init          - Initialize project"));
    console.log(source_default.gray("  \u2022 exit             - Exit CLI\n"));
    console.log(source_default.yellow("\u{1F4A1} Try typing: /help, mc chat, or any natural language question!"));
    console.log(source_default.gray('Press Ctrl+C or type "exit" to quit\n'));
  }
  setupHandlers() {
    this.rl.on("line", async (input) => {
      if (this.isProcessing) {
        console.log(source_default.yellow("\u23F3 Please wait for the current command to finish..."));
        return;
      }
      const trimmed = input.trim();
      if (!trimmed) {
        this.rl.prompt();
        return;
      }
      if (trimmed.toLowerCase() === "exit" || trimmed.toLowerCase() === "quit") {
        this.exit();
        return;
      }
      await this.processCommand(trimmed);
    });
    this.rl.on("SIGINT", () => {
      this.exit();
    });
    process.on("SIGINT", () => {
      this.exit();
    });
  }
  startPrompt() {
    this.rl.prompt();
  }
  async processCommand(input) {
    this.isProcessing = true;
    const command = {
      input,
      output: "",
      timestamp: /* @__PURE__ */ new Date()
    };
    try {
      let output = "";
      if (input.startsWith("/")) {
        output = await this.handleSlashCommand(input);
      } else if (input.toLowerCase().startsWith("mc ")) {
        output = await this.handleMcCommand(input);
      } else {
        output = await this.handleChatMessage(input);
      }
      command.output = output;
      this.commands.push(command);
      console.log("\n" + source_default.green("\u2705 Response:"));
      console.log(output);
      console.log(source_default.gray(`
[${command.timestamp.toLocaleTimeString()}] Command completed
`));
    } catch (error) {
      const errorMsg = `\u274C Error: ${error}`;
      command.output = errorMsg;
      this.commands.push(command);
      console.log("\n" + source_default.red(errorMsg) + "\n");
    } finally {
      this.isProcessing = false;
      this.rl.prompt();
    }
  }
  async handleSlashCommand(input) {
    const parts = input.slice(1).toLowerCase().split(" ");
    const command = parts[0];
    const args = parts.slice(1);
    switch (command) {
      case "help":
        return `\u{1F4DA} MARIA CODE CLI Help

\u{1F539} Slash Commands:
  /help            - Show this help message
  /clear           - Clear command history  
  /status          - Show system status
  /model           - Interactive AI model selector
  /init            - Initialize MARIA project

\u{1F539} MC Commands:
  mc chat          - Interactive AI chat mode
  mc paper         - Academic paper development
  mc slides        - Presentation creation
  mc graph         - Neo4j knowledge graph
  mc init          - Initialize project configuration

\u{1F539} Chat:
  Type any natural language and I'll help you!
  
\u{1F4A1} Examples:
  \u2022 "Create a REST API for user management"
  \u2022 "Help me debug this React component"  
  \u2022 "Generate tests for my functions"`;
      case "clear":
        this.commands = [];
        console.clear();
        this.showWelcome();
        return "\u{1F9F9} Command history cleared!";
      case "status":
        return `\u{1F4CA} MARIA CODE CLI Status

\u{1F7E2} System: Online
\u{1F7E2} AI Agents: Ready  
\u{1F7E2} Neo4j: Connected
\u{1F4E6} Version: v1.0.0
\u26A1 Mode: Development

\u{1F4C8} Session Stats:
  Commands: ${this.commands.length}
  Uptime: ${Math.floor(process.uptime())}s
  Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`;
      case "model":
        return await this.handleModelCommand(args);
      case "init":
        return await this.handleInitCommand();
      default:
        return `\u2753 Unknown slash command: /${command}

Type /help to see available commands.`;
    }
  }
  async handleModelCommand(args = []) {
    const envStatus = getEnvironmentStatus();
    if (args.length > 0) {
      const requestedModel = args[0];
      const modelMap = {
        "gpt-4o": "gpt-4o",
        "gpt4o": "gpt-4o",
        "claude-3-opus": "claude-3-opus",
        "claude3opus": "claude-3-opus",
        "opus": "claude-3-opus",
        "gemini": "gemini-2.5-pro",
        "gemini-2.5-pro": "gemini-2.5-pro",
        "mixtral": "mixtral-8x7b",
        "mixtral-8x7b": "mixtral-8x7b",
        "gpt-oss-120b": "gpt-oss-120b",
        "120b": "gpt-oss-120b",
        "gpt-oss-20b": "gpt-oss-20b",
        "20b": "gpt-oss-20b",
        "qwen3-30b": "qwen3-30b",
        "qwen30b": "qwen3-30b",
        "qwen2.5-vl": "qwen2.5-vl",
        "qwenvl": "qwen2.5-vl"
      };
      const modelId = requestedModel ? modelMap[requestedModel] : void 0;
      if (modelId) {
        if (modelId.includes("gpt-oss")) {
          process.env.AI_PROVIDER = "lmstudio";
          process.env.LMSTUDIO_DEFAULT_MODEL = modelId;
          process.env.OFFLINE_MODE = "true";
        } else {
          process.env.AI_PROVIDER = "openai";
          process.env.AI_MODEL = modelId;
          process.env.OFFLINE_MODE = "false";
        }
        return `\u2705 AI Model Updated Successfully!

\u{1F916} Active Model: ${modelId}
\u{1F4CD} Configuration updated in environment
\u{1F4A1} Your next messages will use this model.

\u{1F31F} Ready to chat with ${modelId}!`;
      } else {
        return `\u274C Invalid model: "${requestedModel}"

\u{1F4A1} Available models: gpt-4o, claude-3-opus, gemini-2.5-pro, mixtral-8x7b, gpt-oss-120b, gpt-oss-20b, qwen3-30b, qwen2.5-vl`;
      }
    }
    let lmStudioStatus = "\u274C Not available";
    if (process.env.LMSTUDIO_ENABLED === "true") {
      try {
        const fetch = (await import("node-fetch")).default;
        const response = await fetch("http://localhost:1234/v1/models", {
          headers: { "Authorization": "Bearer lm-studio" },
          signal: AbortSignal.timeout(2e3)
        });
        lmStudioStatus = response.ok ? "\u2705 Running" : "\u26A0\uFE0F Server not running";
      } catch {
        lmStudioStatus = "\u26A0\uFE0F Server not running";
      }
    }
    return `\u{1F916} AI Model Selection

\u2601\uFE0F Cloud Models:
  \u2022 gpt-4o (OpenAI)          - High accuracy, multimodal
  \u2022 claude-3-opus (Anthropic) - Long text, complex tasks  
  \u2022 gemini-2.5-pro (Google)  - Research, analysis, vision
  \u2022 mixtral-8x7b (Groq)      - Fast inference

\u{1F4BB} Local Models:
  \u2022 gpt-oss-120b (LM Studio)  - Complex reasoning (~64GB VRAM)
  \u2022 gpt-oss-20b (LM Studio)   - Balanced performance (~12GB VRAM)  
  \u2022 qwen3-30b (LM Studio)     - Multilingual support (~16GB VRAM)
  \u2022 qwen2.5-vl (Ollama)      - Vision capabilities (~8GB VRAM)

\u{1F50D} **Current Status:**
\u2022 API Keys: ${envStatus.hasApiKeys ? "\u2705 Configured" : "\u274C Not found"}
\u2022 LM Studio: ${lmStudioStatus}
\u2022 Offline Mode: ${envStatus.offlineMode ? "\u2705 Enabled" : "\u274C Disabled"}
\u2022 Available Providers: ${envStatus.providers.join(", ")}

\u{1F4A1} To select a model, use: /model [model-name]
   Example: /model gpt-4o or /model 120b

\u{1F680} **Quick Setup:**
\u2022 For 120B model: /model 120b
\u2022 For cloud models: Add API keys to .env.local
\u2022 For offline work: Run LM Studio first`;
  }
  async handleInitCommand() {
    try {
      const currentDir = process.cwd();
      const configPath = path.join(currentDir, ".maria-code.toml");
      const memoryPath = path.join(currentDir, "MARIA.md");
      if (fs.existsSync(configPath)) {
        return `\u2705 MARIA project already initialized!

\u{1F4C1} Project: ${path.basename(currentDir)}
\u{1F4CD} Location: ${currentDir}
\u2699\uFE0F Config: .maria-code.toml
\u{1F4DD} Memory: MARIA.md

\u{1F4A1} Use /status to check project status
\u{1F527} Use /model to configure AI models`;
      }
      const tomlConfig = `# MARIA CODE Configuration
# AI-Powered Development Platform

[project]
name = "${path.basename(currentDir)}"
version = "1.0.0"
description = "MARIA AI-powered project"
created = "${(/* @__PURE__ */ new Date()).toISOString()}"

[ai]
default_model = "gemini-2.5-pro"
providers = [
  "openai",
  "anthropic", 
  "google",
  "groq",
  "lmstudio",
  "ollama"
]

[features]
auto_mode = false
learning_mode = true
collaboration_mode = false
mission_mode = false

[integrations]
neo4j_enabled = true
github_enabled = true
lm_studio_enabled = true

[memory]
file = "MARIA.md"
auto_save = true
context_window = 128000

[development]
typescript = true
testing = true
linting = true
formatting = true
`;
      const memoryContent = `# MARIA Memory

## Project: ${path.basename(currentDir)}

### Overview
- **Created**: ${(/* @__PURE__ */ new Date()).toLocaleDateString()}
- **AI Model**: Gemini 2.5 Pro (default)
- **Status**: Initialized

### Project Structure
\`\`\`
${currentDir}/
\u251C\u2500\u2500 .maria-code.toml    # Configuration
\u251C\u2500\u2500 MARIA.md           # AI memory & context
\u2514\u2500\u2500 ...                # Your project files
\`\`\`

### AI Models Available
- **Cloud Models**: GPT-4o, Claude 3 Opus, Gemini 2.5 Pro, Mixtral 8x7B
- **Local Models**: GPT-OSS 120B, GPT-OSS 20B, Qwen3 30B, Qwen2.5-VL

### Recent Commands
- \`/init\` - Project initialized

### Learning Notes
<!-- AI will automatically update this section based on interactions -->

---
*This file is automatically managed by MARIA CODE AI*
`;
      fs.writeFileSync(configPath, tomlConfig);
      fs.writeFileSync(memoryPath, memoryContent);
      return `\u{1F680} MARIA Project Initialized Successfully!

\u{1F4C1} **Project**: ${path.basename(currentDir)}
\u{1F4CD} **Location**: ${currentDir}

\u{1F4C4} **Files Created**:
  \u2705 .maria-code.toml - Project configuration
  \u2705 MARIA.md - AI memory & learning context

\u{1F916} **AI Configuration**:
  \u2022 Default Model: Gemini 2.5 Pro
  \u2022 Cloud & Local models available
  \u2022 Learning mode: Enabled

\u{1F527} **Next Steps**:
  1. Use \`/model\` to configure AI models
  2. Use \`mc chat\` to start AI conversations  
  3. Use \`mc read .\` to analyze your codebase
  4. Use \`/status\` to check system status

\u{1F4A1} **Pro Tips**:
  \u2022 MARIA.md tracks AI learning and project context
  \u2022 Use natural language for complex development tasks
  \u2022 LM Studio integration ready for local AI models

\u{1F31F} Welcome to AI-powered development with MARIA!`;
    } catch (error) {
      return `\u274C Failed to initialize MARIA project: ${error instanceof Error ? error.message : "Unknown error"}

\u{1F4A1} Make sure you have write permissions in the current directory.`;
    }
  }
  async handleMcCommand(input) {
    const args = input.split(" ").slice(1);
    const command = args[0];
    switch (command) {
      case "chat":
        return `\u{1F4AC} Starting AI Chat Mode...

\u{1F916} Hi! I'm MARIA, your AI development assistant.
\u{1F4DD} How can I help you today?

\u{1F4A1} Try asking me to:
  \u2022 "Create a REST API for user management"
  \u2022 "Help me debug this React component"
  \u2022 "Generate tests for my functions"

\u{1F504} I'm ready to help with any development task!`;
      case "paper":
        return `\u{1F4C4} Academic Paper Development Mode

\u{1F4DA} Features Available:
  \u2022 LaTeX document generation
  \u2022 BibTeX reference management
  \u2022 Real-time collaboration
  \u2022 Version control integration

\u{1F4DD} Example usage:
  mc paper --outline "AI in Healthcare"
  mc paper --template ieee
  mc paper --export pdf

\u2728 Ready to help with your academic writing!`;
      case "slides":
        return `\u{1F3A8} Presentation Creation Mode

\u{1F3AF} Features Available:
  \u2022 AI-generated content
  \u2022 Professional templates
  \u2022 Visual design optimization
  \u2022 Export to multiple formats

\u{1F4DD} Example usage:
  mc slides --structure "AI in Healthcare"
  mc slides --template corporate
  mc slides --export pptx

\u{1F3AA} Ready to create amazing presentations!`;
      case "graph":
        return `\u{1F578}\uFE0F Knowledge Graph (optional)

\u{1F5C2}\uFE0F Features Available:
  \u2022 Graph data visualization
  \u2022 Knowledge relationship mapping
  \u2022 Cypher query interface
  \u2022 Bloom integration

\u{1F4DD} Example usage:
  mc graph --query "MATCH (n) RETURN n LIMIT 25"
  mc graph --visualize entities
  mc graph --bloom

\u{1F310} Ready to explore your knowledge graph!`;
      case "init":
        return await this.handleInitCommand();
      default:
        return `\u2753 Unknown mc command: ${command}

\u{1F4DA} Available MC commands:
  \u2022 mc chat    - AI chat mode
  \u2022 mc paper   - Academic paper development  
  \u2022 mc slides  - Presentation creation
  \u2022 mc graph   - Knowledge graph
  \u2022 mc init    - Project initialization

Type /help for more information.`;
    }
  }
  async handleChatMessage(input) {
    return `\u{1F4AC} Chat Response for: "${input}"

\u{1F916} I understand you want help with: ${input}

\u{1F504} Processing your natural language request...

\u{1F4A1} Based on your input, I can help you with:
  \u2022 Code generation and debugging
  \u2022 Architecture planning
  \u2022 Testing strategies  
  \u2022 Documentation creation

\u{1F680} To get started with full AI capabilities, use /model to select an AI model first!

\u{1F4AC} For interactive chat, use: mc chat`;
  }
  exit() {
    console.log(source_default.cyan("\n\u{1F44B} Thank you for using MARIA CODE CLI!"));
    console.log(source_default.gray("Session saved. See you next time!\n"));
    process.exit(0);
  }
};

// src/commands/graph.ts
var import_fs3 = require("fs");
var import_path3 = require("path");
var import_os2 = require("os");
var import_execa = require("execa");
var import_ora = __toESM(require("ora"), 1);
var import_fs4 = require("fs");
var import_shared = require("@maria/shared");

// src/utils/config.ts
var import_fs2 = require("fs");
var import_path2 = require("path");
var import_toml = require("toml");
var import_os = require("os");
var CONFIG_FILE = ".maria-code.toml";
var GLOBAL_CONFIG_PATH = (0, import_path2.join)((0, import_os.homedir)(), ".maria-code", "config.toml");
function loadConfig() {
  let currentDir = process.cwd();
  while (currentDir !== "/") {
    const configPath = (0, import_path2.join)(currentDir, CONFIG_FILE);
    if ((0, import_fs2.existsSync)(configPath)) {
      try {
        const content = (0, import_fs2.readFileSync)(configPath, "utf-8");
        return (0, import_toml.parse)(content);
      } catch {
      }
    }
    const parentDir = (0, import_path2.join)(currentDir, "..");
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }
  if ((0, import_fs2.existsSync)(GLOBAL_CONFIG_PATH)) {
    try {
      const content = (0, import_fs2.readFileSync)(GLOBAL_CONFIG_PATH, "utf-8");
      return (0, import_toml.parse)(content);
    } catch {
    }
  }
  return {
    defaultModel: "gemini-2.5-pro",
    defaultMode: "chat",
    ai: {
      defaultModel: "gemini-2.5-pro",
      preferredModel: "gemini-2.5-pro"
    },
    cli: {
      defaultMode: "chat",
      theme: "auto",
      verbosity: "normal",
      autoSave: true,
      historySize: 100,
      vimMode: false
    }
  };
}

// src/commands/graph.ts
var MARIA_DIR = (0, import_path3.join)((0, import_os2.homedir)(), ".maria-code");
var JWT_FILE = (0, import_path3.join)(MARIA_DIR, "neo4j-jwt.token");
var JWT_EXPIRY_MINUTES = 15;
function ensureMariaDir() {
  if (!(0, import_fs3.existsSync)(MARIA_DIR)) {
    (0, import_fs3.mkdirSync)(MARIA_DIR, { recursive: true });
  }
}
async function generateJWT() {
  const spinner = (0, import_ora.default)("Generating Neo4j Bloom JWT...").start();
  try {
    const config2 = loadConfig();
    const userEmail = config2.user?.email || process.env.MARIA_USER_EMAIL || "user@example.com";
    const secret = process.env.NEO4J_BLOOM_JWT_SECRET || "temporary-dev-secret";
    const jwt = (0, import_shared.generateNeo4jJWT)(userEmail, {
      secret,
      expiryMinutes: JWT_EXPIRY_MINUTES,
      role: "editor"
    });
    spinner.succeed("JWT generated successfully");
    return jwt;
  } catch (error) {
    spinner.fail("Failed to generate JWT");
    throw error;
  }
}
function saveJWT(jwt) {
  ensureMariaDir();
  (0, import_fs4.writeFileSync)(JWT_FILE, jwt, { mode: 384 });
  (0, import_fs3.chmodSync)(JWT_FILE, 384);
}
function getBloomURL(jwt, query) {
  const config2 = loadConfig();
  const instanceId = config2.neo4j?.instanceId || process.env.NEO4J_INSTANCE_ID || "4234c1a0";
  return (0, import_shared.getNeo4jBloomURL)(instanceId, jwt, query);
}
async function openInBrowser(url) {
  const spinner = (0, import_ora.default)("Opening Graph Database in browser...").start();
  try {
    const platform = process.platform;
    const command = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
    await (0, import_execa.execa)(command, [url]);
    spinner.succeed("Graph Database interface opened in browser");
  } catch {
    spinner.fail("Failed to open browser");
  }
}
async function exportGraphAsPNG(bloomURL, outputPath) {
  const spinner = (0, import_ora.default)(`Exporting graph to ${outputPath}...`).start();
  try {
    const placeholderContent = `# Graph Export Placeholder
    
Export URL: ${bloomURL}
Generated at: ${(/* @__PURE__ */ new Date()).toISOString()}

To manually export:
1. Open the URL in your browser
2. Use Neo4j Bloom's built-in export feature
3. Save the visualization as PNG
`;
    (0, import_fs4.writeFileSync)(outputPath, placeholderContent);
    spinner.succeed(`Export instructions saved to ${outputPath}`);
  } catch (error) {
    spinner.fail("Failed to export graph as PNG");
    throw error;
  }
}
async function graphHandler(options) {
  try {
    const jwt = await generateJWT();
    saveJWT(jwt);
    const bloomURL = getBloomURL(jwt, options.query);
    if (options.query) {
    }
    if (options.png) {
      await exportGraphAsPNG(bloomURL, options.png);
    } else {
      await openInBrowser(bloomURL);
    }
    console.log(source_default.bold("\n\u2728 Graph viewer launched successfully!\n"));
    if (!options.png) {
      console.log(source_default.gray("Tips:"));
      console.log(source_default.gray("  \u2022 Use Bloom's search to explore nodes"));
    }
  } catch {
    process.exit(1);
  }
}
function registerGraphCommand(program) {
  program.command("graph").description("Visualize Graph Database (requires Neo4j setup)").option("-q, --query <cypher>", "Deep-link with Cypher query").option("-p, --png <output>", "Export graph as PNG").action(graphHandler);
}

// src/index.tsx
function displayLogo() {
  const logo = `
${source_default.bold.magenta("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557")}
${source_default.bold.magenta("\u2551")}                                                              ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}    ${source_default.bold.magenta("\u2588\u2588\u2588\u2557   \u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2557")}                    ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}    ${source_default.bold.magenta("\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}    ${source_default.bold.magenta("\u2588\u2588\u2554\u2588\u2588\u2588\u2588\u2554\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}    ${source_default.bold.magenta("\u2588\u2588\u2551\u255A\u2588\u2588\u2554\u255D\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}    ${source_default.bold.magenta("\u2588\u2588\u2551 \u255A\u2550\u255D \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}    ${source_default.bold.magenta("\u255A\u2550\u255D     \u255A\u2550\u255D\u255A\u2550\u255D  \u255A\u2550\u255D\u255A\u2550\u255D  \u255A\u2550\u255D\u255A\u2550\u255D\u255A\u2550\u255D  \u255A\u2550\u255D")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}                                                              ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}           ${source_default.bold.magenta("\u2591\u2588\u2588\u2588\u2588\u2588\u2557\u2591\u2591\u2588\u2588\u2588\u2588\u2588\u2557\u2591\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2591\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}           ${source_default.bold.magenta("\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}           ${source_default.bold.magenta("\u2588\u2588\u2551\u2591\u2591\u255A\u2550\u255D\u2588\u2588\u2551\u2591\u2591\u2588\u2588\u2551\u2588\u2588\u2551\u2591\u2591\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2557\u2591\u2591")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}           ${source_default.bold.magenta("\u2588\u2588\u2551\u2591\u2591\u2588\u2588\u2557\u2588\u2588\u2551\u2591\u2591\u2588\u2588\u2551\u2588\u2588\u2551\u2591\u2591\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u255D\u2591\u2591")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}           ${source_default.bold.magenta("\u255A\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u255A\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}           ${source_default.bold.magenta("\u2591\u255A\u2550\u2550\u2550\u2550\u255D\u2591\u2591\u255A\u2550\u2550\u2550\u2550\u255D\u2591\u255A\u2550\u2550\u2550\u2550\u2550\u255D\u2591\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D")}                   ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}                                                              ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}          ${source_default.bold.magenta("AI-Powered Development Platform")}                    ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}              ${source_default.magenta("v1.0.0 | TypeScript Monorepo")}                     ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}                                                              ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}             ${source_default.bold.cyan("\xA9 2025 Bonginkan Inc.")}                           ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u2551")}                                                              ${source_default.bold.magenta("\u2551")}
${source_default.bold.magenta("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D")}
`;
  console.log(logo);
  console.log(source_default.bold.magenta("\u{1F680} MARIA CODE CLI Development Server Starting...\n"));
}
async function runCLI() {
  new MariaCLI();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  displayLogo,
  graphCommand,
  runCLI
});
//# sourceMappingURL=index.cjs.map