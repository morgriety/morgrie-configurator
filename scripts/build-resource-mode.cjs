// Build-resource selection only; no device or application behavior is changed.
const {spawnSync} = require('node:child_process');
const path = require('node:path');
const mode = process.argv[2];
if (!['public', 'licensed'].includes(mode)) throw new Error('Expected public or licensed resource mode');
const result = spawnSync('bun', ['run', 'build'], {
  cwd: path.resolve(__dirname, '..'),
  env: {...process.env, MORGRIE_RESOURCE_MODE: mode},
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
