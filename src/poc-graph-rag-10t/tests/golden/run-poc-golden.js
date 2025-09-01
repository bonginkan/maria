#!/usr/bin/env node
/**
 * PoC Golden Test Runner
 * - Reads tests/golden/poc-queries.json
 * - Sends queries to search API
 * - Validates must_have (in answer) and source prefixes (in citations)
 * - Writes JSON report and exits non-zero on failures
 *
 * Node 18+ (global fetch) required
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const { setTimeout: sleep } = require('node:timers/promises');

const argv = process.argv.slice(2);
const getArg = (name, def) => {
  const i = argv.findIndex(a => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return def;
  const v = argv[i].includes('=') ? argv[i].split('=')[1] : argv[i + 1];
  return v ?? def;
};

const FILE = getArg('file', 'tests/golden/poc-queries.json');
const BASE_URL = getArg('base', process.env.BASE_URL || 'http://localhost:3000');
const TOP_K = Number(getArg('topK', '10'));
const TIMEOUT_MS = Number(getArg('timeout', '8000'));
const OUT_DIR = getArg('outDir', 'tests/golden/results');
const OUT_FILE = path.join(OUT_DIR, 'poc-golden-result.json');

function nowISO() { return new Date().toISOString(); }

async function readJSON(p) {
  const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
  const txt = await fs.readFile(abs, 'utf-8');
  return JSON.parse(txt);
}

function normStr(s) {
  return (s || '').toString().normalize('NFKC');
}

function textIncludesAll(text, needles) {
  const t = normStr(text).toLowerCase();
  return (needles || []).every(n => t.includes(normStr(n).toLowerCase()));
}

function anySourceMatches(sources, expectedPrefixes) {
  if (!expectedPrefixes || expectedPrefixes.length === 0) return true;
  const got = (sources || []).map(s => {
    const v = s?.uri ?? s?.url ?? s?.path ?? s?.source ?? s?.id ?? '';
    return normStr(v);
  });
  return expectedPrefixes.some(pref => got.some(g => g.includes(pref)));
}

async function callSearchAPI(query) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const payload = { query, topK: TOP_K };
  const headers = { 'Content-Type': 'application/json' };

  // 1) Try POST /api/search
  try {
    const res = await fetch(`${BASE_URL.replace(/\/$/,'')}/api/search`, {
      method: 'POST',
      headers, body: JSON.stringify(payload), signal: controller.signal
    });
    clearTimeout(timeout);
    if (res.ok) return res.json();
  } catch (_) {}

  // 2) Fallback GET /search?q=
  try {
    const url = new URL(`${BASE_URL.replace(/\/$/,'')}/search`);
    url.searchParams.set('q', query);
    url.searchParams.set('k', String(TOP_K));
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) return res.json();
  } catch (_) {}

  // 3) Fallback: try /api/orchestrate (if exists)
  try {
    const res = await fetch(`${BASE_URL.replace(/\/$/,'')}/api/orchestrate`, {
      method: 'POST',
      headers, body: JSON.stringify({ task: 'search', query, topK: TOP_K }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (res.ok) return res.json();
  } catch (_) {}

  clearTimeout(timeout);
  throw new Error(`Search API not reachable at base=${BASE_URL}`);
}

function normalizeResponse(json) {
  // Accept several shapes; return { answer, sources[] }
  if (!json || typeof json !== 'object') {
    return { answer: '', sources: [] };
  }
  if (json.answer || json.sources) {
    return {
      answer: json.answer ?? json.text ?? json.output ?? '',
      sources: Array.isArray(json.sources) ? json.sources : []
    };
  }
  // array form: [{snippet, source:{...}}]
  if (Array.isArray(json.results)) {
    return {
      answer: json.summary ?? '',
      sources: json.results.map(r => ({
        id: r.id, uri: r.uri ?? r.url, path: r.path, snippet: r.snippet
      }))
    };
  }
  // flat fallback
  return {
    answer: json.text ?? json.content ?? '',
    sources: []
  };
}

async function main() {
  const data = await readJSON(FILE);
  const cases = data.queries || data.cases || [];
  if (!cases.length) {
    console.error(`No queries found in ${FILE}`);
    process.exit(2);
  }
  await fs.mkdir(OUT_DIR, { recursive: true });

  let passed = 0, failed = 0;
  const results = [];

  console.log(`\n🔎 Running PoC golden tests against ${BASE_URL}`);
  console.log(`📄 File: ${FILE} | topK=${TOP_K} | timeout=${TIMEOUT_MS}ms\n`);

  for (const c of cases) {
    const id = c.id || c.input?.slice(0, 24);
    const input = c.input || c.query;
    const expect = c.expect || {};
    const started = Date.now();
    let status = 'PASS', detail = '';

    try {
      const json = await callSearchAPI(input);
      const normalized = normalizeResponse(json);
      const answer = normalized.answer ?? '';
      const sources = normalized.sources ?? [];

      const hasMust = textIncludesAll(answer + ' ' + JSON.stringify(sources), expect.must_have || []);
      const hasSource = anySourceMatches(sources, expect.source || []);

      if (!hasMust || !hasSource) {
        status = 'FAIL';
        const miss = [];
        if (!hasMust) miss.push('must_have');
        if (!hasSource) miss.push('source');
        detail = `Missing: ${miss.join(', ')}`;
      }

      results.push({
        id, input, status,
        latency_ms: Date.now() - started,
        must_have: expect.must_have || [],
        expect_source: expect.source || [],
        got: {
          answerExcerpt: (answer || '').slice(0, 200),
          sources: (sources || []).slice(0, 5)
        }
      });

      const icon = status === 'PASS' ? '✅' : '❌';
      console.log(`${icon} ${id} (${Date.now() - started}ms) ${status}${detail ? ' - ' + detail : ''}`);
      if (status === 'PASS') passed++; else failed++;

      // polite pacing for local servers
      await sleep(50);
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        id, input, status: 'ERROR',
        latency_ms: Date.now() - started,
        error: msg
      });
      console.log(`❌ ${id} (${Date.now() - started}ms) ERROR - ${msg}`);
    }
  }

  const summary = { base: BASE_URL, file: FILE, topK: TOP_K, timestamp: nowISO(), total: cases.length, passed, failed };
  const out = { summary, results };
  await fs.writeFile(OUT_FILE, JSON.stringify(out, null, 2));
  console.log(`\n📝 Report: ${OUT_FILE}`);
  console.log(`📊 Summary: ${passed}/${cases.length} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Runner failed:', e);
  process.exit(3);
});