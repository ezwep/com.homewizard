'use strict';

// PreToolUse hook (matcher: Edit|Write) — blocks a direct hand-edit of the GENERATED
// root app.json. In this Homey Compose project the root manifest is assembled from
// .homeycompose/** + drivers/**/driver.compose.json by `homey app build|run|validate|
// version`; editing app.json directly is silently overwritten on the next build.
// Adapted from tnsturm/skill-agentic-loop-framework.

const fs = require('fs');
const path = require('path');
const { logHook } = require('./lib/log');

let payload = '';
process.stdin.on('data', (chunk) => { payload += chunk; });
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(payload);
  } catch {
    process.exit(0); // can't parse -> fail open, don't block on our own error
  }

  const filePath = (input.tool_input && input.tool_input.file_path) || '';
  if (!filePath) process.exit(0);

  const target = path.resolve(input.cwd || process.cwd(), filePath);

  // Guard ONLY a file named app.json (case-insensitive) — not .homeycompose/app.json,
  // driver compose files, or any other JSON.
  if (path.basename(target).toLowerCase() !== 'app.json') process.exit(0);

  // ...and only when a .homeycompose/ sits NEXT TO it (the generated-manifest
  // signature). Anchored on the edited file's OWN directory, not cwd.
  if (!fs.existsSync(path.join(path.dirname(target), '.homeycompose'))) {
    logHook('compose-guard', 'pass', input.cwd);
    process.exit(0);
  }

  logHook('compose-guard', 'block', input.cwd);
  console.error(
    'compose-guard: refusing to edit the generated root app.json directly. It is '
    + 'assembled from .homeycompose/** and drivers/**/driver.compose.json and will be '
    + 'overwritten on the next "npx homey app build|run|validate|version". Edit the '
    + 'matching compose source instead (app-level fields: .homeycompose/app.json; a '
    + 'driver: drivers/<id>/driver.compose.json), then rebuild.'
  );
  process.exit(2); // block the Edit/Write
});
