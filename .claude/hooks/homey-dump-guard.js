#!/usr/bin/env node
'use strict';

// PreToolUse(Bash) hook: nudge to slim known-huge homey CLI dumps at the source.
// Several `homey api ...` calls return 40KB-16k-line blobs when only 1-2 fields
// are needed (get-app-setting policy_last_run_debug = 56KB, insights get-logs =
// 16k lines). Advisory only — never blocks. Built 2026-07-13 to stop pulling
// whole blobs into context when --jq / a downstream filter would do.

const fs = require('fs');

// Command fragments that are known to emit large output.
const HUGE = [
  'apps get-app-setting',   // big keys: policy_last_run_debug, learning_pv_chart_data, ...
  'apps get-app-settings',  // ALL settings
  'insights get-logs',      // every insights log (no --id) = thousands of lines
  'devices get-devices',    // every device
  'flow get-advanced-flows',
];

// If the command already filters, stay silent — the call is slimmed.
const FILTERS = ['--jq', '| jq', '| python', '| grep', '| head', '| tail', '| wc', '| cut', '| rtk'];

function readStdin() { try { return fs.readFileSync(0, 'utf8'); } catch { return ''; } }

function main() {
  let cmd = '';
  try {
    const d = JSON.parse(readStdin() || '{}');
    if (d.tool_name && d.tool_name !== 'Bash') process.exit(0);
    cmd = String(d.tool_input?.command || '');
  } catch { process.exit(0); }
  if (!cmd) process.exit(0);

  const isHuge = HUGE.some(h => cmd.includes(h));
  if (!isHuge) process.exit(0);
  const alreadyFiltered = FILTERS.some(f => cmd.includes(f));
  if (alreadyFiltered) process.exit(0);

  const ctx =
    '[homey-dump-guard] This homey command returns a large blob (tens of KB / thousands of lines). ' +
    'Slim it at the source before it lands in context: add `--jq \'<expr>\'` (the homey CLI supports it) ' +
    'to project only the field(s) you need, or pipe `--json` output to python/jq/grep. ' +
    'Do not pull the whole blob just to read one value.';

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: ctx },
  }));
  process.exit(0);
}

main();
