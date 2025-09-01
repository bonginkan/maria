/**
 * Metadata Validator for Help Command System
 * Ensures integrity of command metadata with zero-tolerance for inconsistencies
 */

export type Level = "primary" | "secondary" | "hidden";
export type Tag = "core" | "advanced" | "experimental" | "deprecated";

export interface CommandMeta {
  name: string; // '/pm sow'
  title?: string;
  category: string;
  parent?: string;
  level: Level;
  depth?: number; // 0=root, 1=child, 2=grandchild...
  rank?: number;
  tags?: Tag[];
  aliases?: string[];
  usage?: {
    count?: number;
    lastUsed?: string;
    frequency?: number;
  };
  titleKey?: string;
  examples?: string[];
}

export interface MetadataContainer {
  schemaVersion: number;
  generatedAt: string; // ISO 8601
  generatorVersion?: string;
  commands: CommandMeta[];
  stats?: {
    totalCommands: number;
    totalCategories: number;
    lastUpdated?: string;
  };
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  counts: {
    commands: number;
    categories: number;
  };
}

const ALLOWED_LEVEL: Level[] = ["primary", "secondary", "hidden"];
const ALLOWED_TAGS: Tag[] = ["core", "advanced", "experimental", "deprecated"];

export function validateHelpMetadata(
  container: unknown,
  opts: { expectedSchemaVersion?: number; maxDepth?: number } = {},
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 0) Type checking
  if (!isObject(container)) {
    return fail("container is not an object");
  }
  const c = container as MetadataContainer;

  if (!isInt(c.schemaVersion)) errors.push("schemaVersion must be an integer");
  if (!isISO(c.generatedAt)) errors.push("generatedAt must be ISO-8601 string");
  if (!Array.isArray(c.commands)) errors.push("commands must be an array");

  const expected = opts.expectedSchemaVersion;
  if (expected != null && c.schemaVersion !== expected) {
    warnings.push(
      `schemaVersion mismatch: meta=${c.schemaVersion}, expected=${expected}`,
    );
  }

  if (errors.length) {
    return {
      ok: false,
      errors,
      warnings,
      counts: { commands: 0, categories: 0 },
    };
  }

  const cmds = c.commands;
  if (cmds.length === 0) errors.push("commands array is empty");

  // 1) Name/alias uniqueness & basic validation
  const nameSet = new Set<string>();
  const aliasSet = new Set<string>();
  const categorySet = new Set<string>();

  for (const m of cmds) {
    if (!m || !isObject(m)) {
      errors.push("command entry is not an object");
      continue;
    }

    // Name validation
    if (!isString(m.name) || !m.name.startsWith("/")) {
      errors.push(`invalid name: ${JSON.stringify(m?.name)}`);
    } else if (nameSet.has(m.name)) {
      errors.push(`duplicated name: ${m.name}`);
    } else {
      nameSet.add(m.name);
    }

    // Category validation
    if (!isString(m.category) || !m.category.trim()) {
      errors.push(`invalid category for ${m.name}`);
    } else {
      categorySet.add(m.category);
    }

    // Level validation
    if (!ALLOWED_LEVEL.includes(m.level)) {
      errors.push(`invalid level for ${m.name}: ${m.level}`);
    }

    // Tags validation
    if (m.tags) {
      for (const t of m.tags) {
        if (!ALLOWED_TAGS.includes(t)) {
          errors.push(`invalid tag "${t}" on ${m.name}`);
        }
      }
    }

    // Usage validation
    if (m.usage) {
      if (
        m.usage.count != null &&
        (!isInt(m.usage.count) || m.usage.count! < 0)
      ) {
        errors.push(`usage.count must be non-negative int on ${m.name}`);
      }
      if (
        m.usage.frequency != null &&
        !(typeof m.usage.frequency === "number" && m.usage.frequency >= 0)
      ) {
        errors.push(`usage.frequency must be non-negative number on ${m.name}`);
      }
      if (m.usage.lastUsed != null && !isISO(m.usage.lastUsed)) {
        errors.push(`usage.lastUsed must be ISO-8601 on ${m.name}`);
      }
    }

    // Alias validation
    if (m.aliases) {
      for (const a of m.aliases) {
        if (!isString(a) || !a.startsWith("/")) {
          errors.push(
            `invalid alias "${a}" on ${m.name} (must start with "/")`,
          );
          continue;
        }
        if (nameSet.has(a)) {
          errors.push(`alias conflicts with existing name: ${a} on ${m.name}`);
          continue;
        }
        if (aliasSet.has(a)) {
          errors.push(`duplicated alias across commands: ${a} on ${m.name}`);
          continue;
        }
        aliasSet.add(a);
      }
    }
  }

  // 2) Parent existence and depth validation
  const byName = new Map<string, CommandMeta>(cmds.map((m) => [m.name, m]));

  for (const m of cmds) {
    if (m.parent) {
      if (!byName.has(m.parent)) {
        errors.push(`parent not found: ${m.name} → ${m.parent}`);
      }

      // Compute and validate depth
      const computedDepth = computeDepth(m, byName, errors);
      if (m.depth != null && m.depth !== computedDepth) {
        warnings.push(
          `depth mismatch on ${m.name}: meta=${m.depth} computed=${computedDepth}`,
        );
      }
      if (opts.maxDepth != null && computedDepth > opts.maxDepth) {
        warnings.push(
          `depth exceeds maxDepth on ${m.name}: ${computedDepth} > ${opts.maxDepth}`,
        );
      }

      // Level consistency check
      if (m.level === "primary") {
        warnings.push(`command marked primary but has parent: ${m.name}`);
      }
    } else {
      // Root commands should have depth 0
      if (m.depth != null && m.depth !== 0) {
        warnings.push(`root command depth should be 0 on ${m.name}`);
      }
    }
  }

  // 3) Circular dependency detection
  const seenGlobal = new Set<string>();
  for (const m of cmds) {
    if (seenGlobal.has(m.name)) continue;
    const cycle = detectCycle(m, byName);
    if (cycle) {
      errors.push(`cycle detected: ${cycle.join(" -> ")}`);
    }
    seenGlobal.add(m.name);
  }

  // 4) Stats consistency
  if (c.stats) {
    if (
      c.stats.totalCommands != null &&
      c.stats.totalCommands !== cmds.length
    ) {
      warnings.push(
        `stats.totalCommands mismatch: meta=${c.stats.totalCommands} actual=${cmds.length}`,
      );
    }
    if (
      c.stats.totalCategories != null &&
      c.stats.totalCategories !== categorySet.size
    ) {
      warnings.push(
        `stats.totalCategories mismatch: meta=${c.stats.totalCategories} actual=${categorySet.size}`,
      );
    }
    if (c.stats.lastUpdated && !isISO(c.stats.lastUpdated)) {
      warnings.push(`stats.lastUpdated must be ISO-8601`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    counts: {
      commands: cmds.length,
      categories: categorySet.size,
    },
  };

  function fail(msg: string): ValidationResult {
    return {
      ok: false,
      errors: [msg],
      warnings: [],
      counts: { commands: 0, categories: 0 },
    };
  }
}

/* ------------------------------ Helpers ------------------------------ */

function isObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object";
}

function isString(x: unknown): x is string {
  return typeof x === "string";
}

function isInt(x: unknown): x is number {
  return typeof x === "number" && Number.isInteger(x);
}

function isISO(x: unknown): boolean {
  if (typeof x !== "string") return false;
  const d = new Date(x);
  return !Number.isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}T/.test(x);
}

function computeDepth(
  node: CommandMeta,
  byName: Map<string, CommandMeta>,
  errors: string[],
): number {
  let depth = 0;
  const visited = new Set<string>();
  let cur: CommandMeta | undefined = node;

  while (cur?.parent) {
    if (visited.has(cur.name)) {
      errors.push(`cycle while computing depth at ${cur.name}`);
      break;
    }
    visited.add(cur.name);

    const p = byName.get(cur.parent);
    if (!p) break; // parent missing already reported

    depth++;
    cur = p;

    if (depth > 1000) {
      errors.push(`depth overflow at ${node.name}`);
      break;
    }
  }

  return depth;
}

function detectCycle(
  start: CommandMeta,
  byName: Map<string, CommandMeta>,
): string[] | null {
  const stack: string[] = [];
  const visiting = new Set<string>();
  let cur: CommandMeta | undefined = start;

  while (cur) {
    if (visiting.has(cur.name)) {
      const idx = stack.indexOf(cur.name);
      return idx >= 0
        ? stack.slice(idx).concat(cur.name)
        : [cur.name, cur.name];
    }

    visiting.add(cur.name);
    stack.push(cur.name);

    if (!cur.parent) break;
    cur = byName.get(cur.parent);
  }

  return null;
}
