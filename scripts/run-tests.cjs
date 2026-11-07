const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const tests = fs.readdirSync(__dirname).filter((file) => file.endsWith('.test.ts')).sort();
if (tests.length === 0) throw new Error('No regression test files found');
const failed = [];
for (const file of tests) {
  // Existing suites mock browser modules/globals: keep each suite in its own process.
  console.log('Running ' + file);
  const result = spawnSync('bun', ['test', path.join(__dirname, file)], {
    cwd: projectRoot,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) failed.push(file);
}
console.log('Regression suites: ' + (tests.length - failed.length) + '/' + tests.length + ' passed');
if (failed.length) {
  console.error('Failed suites: ' + failed.join(', '));
  process.exitCode = 1;
}
