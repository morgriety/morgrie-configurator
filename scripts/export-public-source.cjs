const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {spawnSync} = require('node:child_process');

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (bytes) => JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
const inside = (parent, child) => {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
};
function relativePath(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes(':') || value.includes('\0') ||
      value.startsWith('/') || value.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('Invalid public-source relative path');
  }
  return value;
}
function futureRealPath(value) {
  const resolved = path.resolve(value);
  if (fs.existsSync(resolved)) return fs.realpathSync(resolved);
  const parent = path.dirname(resolved);
  if (parent === resolved) throw new Error('Cannot resolve output parent');
  return path.join(futureRealPath(parent), path.basename(resolved));
}
function assertOutput(projectRoot, outputRoot) {
  const source = fs.realpathSync(projectRoot);
  const output = futureRealPath(outputRoot);
  if (inside(source, output) || inside(output, source)) throw new Error('Output must be outside and separate from the development repository');
  if (output.split(path.sep).some((p) => p.toLowerCase() === '.git')) throw new Error('Output cannot be Git metadata');
  if (fs.existsSync(output)) {
    if (!fs.statSync(output).isDirectory()) throw new Error('Output is not a directory');
    if (fs.existsSync(path.join(output, '.git'))) throw new Error('Output contains Git metadata');
    if (fs.readdirSync(output).length) throw new Error('Output must be empty; existing source is never deleted or overwritten');
  }
  return output;
}
function readSource(root, relative) {
  relativePath(relative);
  let current = root;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Symlink source is not allowed: ' + relative);
  }
  if (!fs.statSync(current).isFile() || !inside(root, fs.realpathSync(current))) throw new Error('Invalid source file: ' + relative);
  return fs.readFileSync(current);
}
function assertPublicFile(relative, bytes, restrictedHashes) {
  if (/(^|\/)(\.git|node_modules|dist|\.local|\.tools|private-assets|restricted-assets)(\/|$)|(^|\/)\.env(?:\.|$)|Gotham[^/]*\.(otf|ttf|woff2?)$/i.test(relative)) {
    throw new Error('Forbidden public-source path: ' + relative);
  }
  if (restrictedHashes.has(hash(bytes))) throw new Error('Restricted font bytes detected: ' + relative);
  // Archive provenance/hashes are checked separately below. Preserve upstream
  // copyright contacts; an email address by itself is not a private credential.
  if (/\.(png|gif|jpe?g|ico|glb|ttf|otf|woff2?|zip)$/i.test(relative)) return;
  const text = bytes.toString('utf8');
  if (/[A-Za-z]:[\\/](Users|CODEX)[\\/]/i.test(text)) throw new Error('Private local path detected: ' + relative);
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{25,}|\bAKIA[A-Z0-9]{16}\b|\bsk-[A-Za-z0-9_-]{32,}/.test(text)) {
    throw new Error('Credential pattern detected: ' + relative);
  }
}
function planExport({projectRoot, policy, manifest, files, state, allowDirty = false}) {
  projectRoot = fs.realpathSync(projectRoot);
  if (state.dirty && !allowDirty) throw new Error('Development worktree is dirty; use --allow-dirty only for a non-RC preparation snapshot');
  if (!/^[a-f0-9]{40}$/.test(state.head) || !Number.isSafeInteger(state.epoch) || state.epoch < 0) throw new Error('Invalid Git source identity');
  if (policy.version !== 1 || manifest.version !== 1 || !Array.isArray(manifest.files) || !manifest.files.length) throw new Error('Invalid public-source policy or font manifest');
  const restrictedHashes = new Set(manifest.files.map((f) => {
    relativePath(f.path);
    if (!/^[a-f0-9]{64}$/.test(f.sha256)) throw new Error('Invalid font hash');
    return f.sha256;
  }));
  const restrictedPaths = new Set(manifest.files.map((f) => 'public/' + f.path));
  const candidates = new Set(files.map(relativePath));
  const roots = policy.includeDirectories.map(relativePath);
  const explicit = new Set(policy.includeFiles.map(relativePath));
  const excluded = new Set(policy.excludeFiles.map(relativePath));
  const excludedDirs = policy.excludeDirectories.map(relativePath);
  const mappings = new Map(policy.mappings.map((m) => [relativePath(m.source), relativePath(m.destination)]));
  const required = [...explicit, ...mappings.keys()];
  for (const requiredFile of required) if (!candidates.has(requiredFile)) throw new Error('Required public-source file is absent from the selected Git snapshot: ' + requiredFile);
  const plan = [];
  const destinations = new Set();
  for (const source of [...candidates].sort()) {
    if (!explicit.has(source) && !mappings.has(source) && !roots.some((p) => source.startsWith(p + '/'))) continue;
    if (excluded.has(source) || excludedDirs.some((p) => source === p || source.startsWith(p + '/')) || restrictedPaths.has(source) || /Gotham[^/]*\.(otf|ttf|woff2?)$/i.test(source)) continue;
    const destination = mappings.get(source) || source;
    if (destinations.has(destination)) throw new Error('Duplicate export destination: ' + destination);
    const bytes = readSource(projectRoot, source);
    assertPublicFile(destination, bytes, restrictedHashes);
    destinations.add(destination);
    plan.push({source, destination, bytes, sha256: hash(bytes)});
  }
  for (const directory of policy.requiredDirectories || []) {
    relativePath(directory);
    if (!plan.some((p) => p.destination.startsWith(directory + '/'))) throw new Error('Required public-source directory is empty: ' + directory);
  }
  if (destinations.has('SOURCE_SNAPSHOT.json') || destinations.has('SOURCE-FILES.json')) throw new Error('Generated source metadata cannot be copied from an old snapshot');
  const byName = new Map(plan.map((p) => [p.destination, p]));
  const archives = byName.get('third_party/GPL-SOURCES.json');
  if (archives) for (const item of json(archives.bytes)) {
    relativePath(item.archive);
    const entry = byName.get(item.archive);
    if (!entry || entry.sha256 !== item.sha256) throw new Error('GPL source archive is missing or changed: ' + item.archive);
  }
  const lock = byName.get('bun.lock');
  if (!lock) throw new Error('Frozen dependency lock is required');
  const records = plan.map(({source, destination, sha256, bytes}) => ({source, path: destination, sha256, bytes: bytes.length}));
  const sourceFingerprint = hash(Buffer.from(JSON.stringify(records)));
  const snapshot = {
    status: state.dirty ? 'WORKTREE_PREPARATION_NOT_FROZEN_RC' : 'CLEAN_GIT_SOURCE_NOT_RC_APPROVAL',
    originalDevelopmentHead: state.head,
    originalWorkingTreeWasDirty: state.dirty,
    sourceDateEpoch: state.epoch,
    bunLockSha256: lock.sha256,
    sourceFingerprint,
    frozenRelease: false,
    note: 'Exported from one development source. Application/build files are byte-preserved; only explicit public documentation mappings and generated provenance differ. Clean Git identity is not release approval.',
  };
  return {projectRoot, plan, records, snapshot};
}
function writeExport(prepared, outputRoot) {
  const output = assertOutput(prepared.projectRoot, outputRoot);
  // Verify the entire plan before creating output. A concurrently edited source
  // cannot silently receive provenance for earlier bytes.
  for (const item of prepared.plan) if (hash(readSource(prepared.projectRoot, item.source)) !== item.sha256) throw new Error('Source changed during export: ' + item.source);
  fs.mkdirSync(output, {recursive: true});
  for (const item of prepared.plan) {
    const target = path.join(output, ...item.destination.split('/'));
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, item.bytes, {flag: 'wx'});
  }
  const snapshotBytes = Buffer.from(JSON.stringify(prepared.snapshot, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'SOURCE_SNAPSHOT.json'), snapshotBytes, {flag: 'wx'});
  fs.writeFileSync(path.join(output, 'SOURCE-FILES.json'), JSON.stringify({
    status: prepared.snapshot.status,
    originalDevelopmentHead: prepared.snapshot.originalDevelopmentHead,
    originalWorkingTreeWasDirty: prepared.snapshot.originalWorkingTreeWasDirty,
    sourceFingerprint: prepared.snapshot.sourceFingerprint,
    note: 'The inventory excludes itself. All source/path mappings are explicit and byte-preserving. SOURCE_SNAPSHOT.json is generated provenance, not an application source edit.',
    files: prepared.records,
    generated: [{path: 'SOURCE_SNAPSHOT.json', sha256: hash(snapshotBytes), bytes: snapshotBytes.length}],
  }, null, 2) + '\n', {flag: 'wx'});
  return {output, files: prepared.plan.length + 2, ...prepared.snapshot};
}
function git(projectRoot, args) {
  const result = spawnSync('git', ['-C', projectRoot, ...args], {encoding: 'utf8', env: {...process.env, GIT_OPTIONAL_LOCKS: '0'}});
  if (result.error || result.status !== 0) throw new Error('Unable to read Git source identity');
  return result.stdout;
}
function collectGitState(projectRoot) {
  const status = git(projectRoot, ['status', '--porcelain=v1', '--untracked-files=all']);
  return {
    head: git(projectRoot, ['rev-parse', 'HEAD']).trim(),
    epoch: Number(git(projectRoot, ['log', '-1', '--format=%ct']).trim()),
    dirty: Boolean(status.trim()),
    status,
  };
}
function main(argv = process.argv.slice(2)) {
  let outputRoot, allowDirty = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--allow-dirty') allowDirty = true;
    else if (argv[i] === '--output' && argv[i + 1] && !argv[i + 1].startsWith('--')) outputRoot = argv[++i];
    else throw new Error('Usage: node scripts/export-public-source.cjs --output <empty-directory> [--allow-dirty]');
  }
  if (!outputRoot) throw new Error('--output is required; no default path is overwritten');
  const projectRoot = fs.realpathSync(path.resolve(__dirname, '..'));
  assertOutput(projectRoot, outputRoot);
  const state = collectGitState(projectRoot);
  const args = ['ls-files', '-z', '--cached'];
  if (allowDirty) args.push('--others', '--exclude-standard');
  const files = git(projectRoot, args).split('\0').filter(Boolean);
  const prepared = planExport({projectRoot, state, files, allowDirty,
    policy: json(readSource(projectRoot, 'resources/public-source-policy.json')),
    manifest: json(readSource(projectRoot, 'resources/restricted-fonts.json')),
  });
  const after = collectGitState(projectRoot);
  if (state.head !== after.head || state.status !== after.status) throw new Error('Git state changed during export');
  console.log(JSON.stringify(writeExport(prepared, outputRoot), null, 2));
}
module.exports = {assertOutput, assertPublicFile, planExport, writeExport};
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
