'use strict';

// Hook telemetry (pure helper) — adapted from tnsturm/skill-agentic-loop-framework.
// One JSONL decision record per hook decision, appended to the guarded repo's
// .claude/hooks/hook-log.jsonl (gitignored). Strictly fail-silent — telemetry must
// never break a hook.

const fs = require('fs');
const path = require('path');

/**
 * Append one decision record ({ts, hook, decision}) to the repo-local hook log.
 * Never throws; no-op when cwd is missing.
 * @param {string} hook Hook name, e.g. `compose-guard`.
 * @param {'block'|'pass'} decision Outcome at a real decision point.
 * @param {string|undefined} cwd Guarded repo root (the hook-input cwd), or undefined to skip.
 */
function logHook(hook, decision, cwd) {
  if (!cwd) return;
  try {
    fs.appendFileSync(
      path.join(cwd, '.claude', 'hooks', 'hook-log.jsonl'),
      `${JSON.stringify({ ts: new Date().toISOString(), hook, decision })}\n`
    );
  } catch {
    // telemetry must never break a hook
  }
}

module.exports = { logHook };
