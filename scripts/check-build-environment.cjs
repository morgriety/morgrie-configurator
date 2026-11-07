const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const requiredNode = fs.readFileSync(path.join(projectRoot, '.node-version'), 'utf8').trim();
const requiredBun = fs.readFileSync(path.join(projectRoot, '.bun-version'), 'utf8').trim();
assert.equal(process.versions.node, requiredNode, 'Use the Node version in .node-version for RC builds');
const bun = spawnSync('bun', ['--version'], {encoding: 'utf8', cwd: projectRoot});
if (bun.error) throw bun.error;
assert.equal(bun.status, 0, 'Unable to read the Bun version');
assert.equal(bun.stdout.trim(), requiredBun, 'Use the Bun version in .bun-version for RC builds');
console.log('Build toolchain: Node ' + requiredNode + ', Bun ' + requiredBun);
