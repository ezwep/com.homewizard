#!/usr/bin/env node
'use strict';

// UserPromptSubmit hook: when a prompt touches a domain topic where I have
// repeatedly re-derived what was already recorded (sat-YF, forecast, DP,
// curtailment, ...), surface the matching detail-memory files and inject a
// hard reminder to READ them before analysing. Built 2026-07-13 after twice
// re-deriving the sat-YF morning-residu verdict that was already in MEMORY.md.

const fs = require('fs');
const path = require('path');

const MEMORY_DIR = '/root/.claude/projects/-root-github-com-homewizard/memory';

// Domain tokens that gate the reminder. Only fire on these — a reminder on
// every prompt is noise I would learn to ignore. These are the topics where
// re-derivation has actually burned sessions.
const DOMAIN_TOKENS = [
  'sat', 'satelliet', 'satellite', 'yield', 'yf', 'forecast', 'ema',
  'curtailment', 'reorder', 'optimizer', 'elevation', 'elevatie', 'azimuth',
  'shading', 'shade', 'blend', 'learning', 'accuracy', 'pooling', 'nowcast',
  'radiation', 'straling', 'msgcpp', 'knmi', 'solcast', 'baseload',
  'consumption', 'consumptie', 'discharge', 'ontlaad', 'refill', 'reserve',
];

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

function main() {
  let prompt = '';
  try {
    const data = JSON.parse(readStdin() || '{}');
    prompt = String(data.prompt || '').toLowerCase();
  } catch {
    process.exit(0); // malformed input → do nothing, never block a prompt
  }
  if (!prompt) process.exit(0);

  // Which domain tokens are present as whole words in the prompt?
  const hits = DOMAIN_TOKENS.filter(t =>
    new RegExp(`(^|[^a-z0-9])${t}([^a-z0-9]|$)`, 'i').test(prompt));
  if (hits.length === 0) process.exit(0);

  // Find memory files whose name contains any hit token, rank by hit count.
  let files = [];
  try { files = fs.readdirSync(MEMORY_DIR).filter(f => f.endsWith('.md') && f !== 'MEMORY.md'); }
  catch { process.exit(0); }

  const scored = files
    .map(f => {
      const base = f.toLowerCase();
      const score = hits.reduce((s, t) => s + (base.includes(t) ? 1 : 0), 0);
      return { f, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  if (scored.length === 0) process.exit(0);

  const list = scored.map(x => `  - ${x.f}`).join('\n');
  const ctx = [
    `[memory-recall-guard] This prompt touches: ${hits.join(', ')}.`,
    `Before running any analysis/scripts, READ the matching detail-memory file(s) fully — do NOT re-derive what is already recorded there (this has burned whole sessions):`,
    list,
    `Also grep MEMORY.md for the verdict line. If a file already records a VERDICT/decision on this, cite it and continue from there instead of re-analysing.`,
  ].join('\n');

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: ctx,
    },
  }));
  process.exit(0);
}

main();
