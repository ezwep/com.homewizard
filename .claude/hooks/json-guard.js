'use strict';

// PostToolUse hook (matcher: Edit|Write) — after editing a Homey manifest/changelog
// JSON file, verify it still parses as JSON; on failure, surface the error to the
// model (exit 2) so it is fixed before commit.
//
// Guards against hand-authored JSON (especially changelog text) getting curly
// "smart-quote" string delimiters (" " instead of ASCII ") instead of ASCII quotes,
// producing invalid JSON that `homey app validate` lets through. Fail-open on our
// own errors. Adapted from tnsturm/skill-agentic-loop-framework.

const fs = require('fs');
const path = require('path');
const { logHook } = require('./lib/log');

// The Homey manifest/changelog JSON set — pure JSON (no JSONC comments). Tooling
// JSON under .claude/ is deliberately NOT guarded (may be JSONC).
function isGuardedJson(filePath) {
  const p = String(filePath || '').replace(/\\/g, '/');
  if (!/\.json$/.test(p)) return false;
  if (/(?:^|\/)(node_modules|\.git|scratchpad)\//.test(p)) return false;
  if (/(?:^|\/)\.homeycompose\//.test(p)) return true;
  if (/(?:^|\/)drivers\//.test(p)) return true;
  if (/(?:^|\/)locales\//.test(p)) return true;
  return /(?:^|\/)(app\.json|\.homeychangelog\.json|package\.json)$/.test(p);
}

let payload = '';
process.stdin.on('data', (chunk) => { payload += chunk; });
process.stdin.on('end', () => {
  let input;
  try { input = JSON.parse(payload); } catch { process.exit(0); }

  const filePath = (input.tool_input && input.tool_input.file_path) || '';
  if (!isGuardedJson(filePath)) process.exit(0);

  const abs = path.isAbsolute(filePath)
    ? filePath
    : path.join(input.cwd || process.cwd(), filePath);
  let text;
  try { text = fs.readFileSync(abs, 'utf8'); } catch { process.exit(0); }

  try {
    JSON.parse(text);
    logHook('json-guard', 'pass', input.cwd);
    process.exit(0);
  } catch (err) {
    logHook('json-guard', 'block', input.cwd);
    console.error(
      `json-guard: ${path.basename(abs)} is not valid JSON after this edit — ${err.message}. `
      + `Common cause: an ASCII " string delimiter came out as a curly "smart quote" `
      + `(" "). Fix by rebuilding the file via node + JSON.stringify (never hand-type JSON `
      + `delimiters). Re-check with JSON.parse before committing.`
    );
    process.exit(2); // PostToolUse: surface the error back to the model
  }
});
