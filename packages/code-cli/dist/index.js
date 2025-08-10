import {
  MariaCLI
} from "./chunk-KPZ3JS2K.js";
import {
  loadConfig
} from "./chunk-DRFJ2DAP.js";
import "./chunk-KMGE4H2B.js";
import {
  source_default
} from "./chunk-PHGI5UVR.js";
import "./chunk-7D4SUZUM.js";

// src/commands/graph.ts
import { existsSync, mkdirSync, chmodSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { execa } from "execa";
import ora from "ora";
import { writeFileSync } from "fs";
import { generateNeo4jJWT, getNeo4jBloomURL } from "@maria/shared";
var MARIA_DIR = join(homedir(), ".maria-code");
var JWT_FILE = join(MARIA_DIR, "neo4j-jwt.token");
var JWT_EXPIRY_MINUTES = 15;
function ensureMariaDir() {
  if (!existsSync(MARIA_DIR)) {
    mkdirSync(MARIA_DIR, { recursive: true });
  }
}
async function generateJWT() {
  const spinner = ora("Generating Neo4j Bloom JWT...").start();
  try {
    const config = loadConfig();
    const userEmail = config.user?.email || process.env.MARIA_USER_EMAIL || "user@example.com";
    const secret = process.env.NEO4J_BLOOM_JWT_SECRET || "temporary-dev-secret";
    const jwt = generateNeo4jJWT(userEmail, {
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
  writeFileSync(JWT_FILE, jwt, { mode: 384 });
  chmodSync(JWT_FILE, 384);
}
function getBloomURL(jwt, query) {
  const config = loadConfig();
  const instanceId = config.neo4j?.instanceId || process.env.NEO4J_INSTANCE_ID || "4234c1a0";
  return getNeo4jBloomURL(instanceId, jwt, query);
}
async function openInBrowser(url) {
  const spinner = ora("Opening Graph Database in browser...").start();
  try {
    const platform = process.platform;
    const command = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
    await execa(command, [url]);
    spinner.succeed("Graph Database interface opened in browser");
  } catch {
    spinner.fail("Failed to open browser");
  }
}
async function exportGraphAsPNG(bloomURL, outputPath) {
  const spinner = ora(`Exporting graph to ${outputPath}...`).start();
  try {
    const placeholderContent = `# Graph Export Placeholder
    
Export URL: ${bloomURL}
Generated at: ${(/* @__PURE__ */ new Date()).toISOString()}

To manually export:
1. Open the URL in your browser
2. Use Neo4j Bloom's built-in export feature
3. Save the visualization as PNG
`;
    writeFileSync(outputPath, placeholderContent);
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
export {
  displayLogo,
  registerGraphCommand as graphCommand,
  runCLI
};
//# sourceMappingURL=index.js.map