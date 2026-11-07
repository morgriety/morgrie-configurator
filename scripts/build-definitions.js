const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {spawnSync} = require('node:child_process');
const {buildModelDefinitions} = require('./model-definitions.cjs');

const projectRoot = path.resolve(__dirname, '..');
const localRoot = path.join(projectRoot, 'definitions');
const upstreamRoot = path.join(projectRoot, 'node_modules/via-keyboards');

function readDefinitions(root, version) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, {recursive: true}).sort()
    .filter((file) => file.endsWith('.json') && fs.statSync(path.join(root, file)).isFile())
    .map((file) => {
      const source = path.join(root, file);
      const definition = JSON.parse(fs.readFileSync(source, 'utf8'));
      // VIA accepts hexadecimal strings with or without an 0x prefix.
      const vendorId = Number.parseInt(definition.vendorId, 16);
      const productId = Number.parseInt(definition.productId, 16);
      if (![vendorId, productId].every((id) => Number.isInteger(id) && id >= 0 && id <= 0xffff)) {
        throw new Error(`Invalid VID/PID in ${source}`);
      }
      return {source, version, definition, id: vendorId * 65536 + productId};
    });
}

function getLocalDefinitions() {
  return ['v2', 'v3'].flatMap((version) =>
    readDefinitions(path.join(localRoot, version), version),
  );
}

// Check both upstream versions before generating anything. Never silently
// replace an upstream device with a manufacturer definition sharing its IDs.
function assertNoDefinitionConflicts(localDefinitions, upstreamDefinitions) {
  const localById = new Map();
  for (const entry of localDefinitions) {
    const previous = localById.get(entry.id);
    if (previous) {
      throw new Error(`Duplicate local VID/PID ${entry.id}: ${previous.source} and ${entry.source}`);
    }
    localById.set(entry.id, entry);
  }
  for (const entry of upstreamDefinitions) {
    const local = localById.get(entry.id);
    if (local) {
      throw new Error(`VID/PID conflict ${entry.id}: ${local.source} and ${entry.source}`);
    }
  }
}

function runNode(args, env = process.env) {
  const result = spawnSync(process.execPath, args, {
    cwd: projectRoot,
    env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Definition build command failed (${result.status ?? result.signal})`);
  }
}

// The upstream generator uses wall-clock time for this index field, but excludes
// it from the definition hash. Use source time so repeated RC builds are identical.
function getBuildTimestamp(epoch = process.env.SOURCE_DATE_EPOCH) {
  // Source exports carry the timestamp of their original development commit.
  // The development repository has no snapshot file and continues to use Git.
  const snapshotFile = path.join(projectRoot, 'SOURCE_SNAPSHOT.json');
  if (epoch === undefined && fs.existsSync(snapshotFile)) {
    epoch = String(JSON.parse(fs.readFileSync(snapshotFile, 'utf8')).sourceDateEpoch);
  }
  if (epoch === undefined) {
    const result = spawnSync('git', ['log', '-1', '--format=%ct'], {
      cwd: projectRoot,
      encoding: 'utf8',
    });
    if (result.error || result.status !== 0) {
      throw new Error('Set SOURCE_DATE_EPOCH when building without Git history');
    }
    epoch = result.stdout.trim();
  }
  const milliseconds = Number(epoch) * 1000;
  if (!/^\d+$/.test(epoch) || !Number.isSafeInteger(milliseconds) || milliseconds > 8640000000000000) {
    throw new Error('SOURCE_DATE_EPOCH must be a valid non-negative Unix timestamp in seconds');
  }
  return milliseconds;
}

function normalizeDefinitionTimestamp(outputRoot, timestamp) {
  const file = path.join(outputRoot, 'supported_kbs.json');
  const index = JSON.parse(fs.readFileSync(file, 'utf8'));
  index.generatedAt = timestamp;
  fs.writeFileSync(file, JSON.stringify(index));
}

function buildDefinitions() {
  const timestamp = getBuildTimestamp();
  const localDefinitions = getLocalDefinitions();
  const upstreamDefinitions = [
    ...readDefinitions(path.join(upstreamRoot, 'src'), 'v2'),
    ...readDefinitions(path.join(upstreamRoot, 'v3'), 'v3'),
  ];
  assertNoDefinitionConflicts(localDefinitions, upstreamDefinitions);
  console.log(`Building upstream definitions and ${localDefinitions.length} local definition(s).`);
  runNode(['--import', 'tsx', path.join(upstreamRoot, 'scripts/build-all.ts'), 'public/definitions'], {
    ...process.env,
    VIA_LOCAL_DEFINITIONS: localRoot,
  });
  normalizeDefinitionTimestamp(path.join(projectRoot, 'public/definitions'), timestamp);
  buildModelDefinitions(path.join(projectRoot, 'public/definitions'));
  runNode([path.join(__dirname, 'verify-definitions.cjs')]);
}

// Build the revision lookup from the same verified resources that ship to browsers.
function getDefinitionRevisions(outputRoot) {
  const registry = JSON.parse(fs.readFileSync(path.join(localRoot, 'model-registry.json'), 'utf8'));
  const sources = new Map(getLocalDefinitions().map(({source, version, id}) =>
    [source, `${version}/${id}.json`],
  ));
  for (const model of registry.models) {
    sources.set(path.resolve(projectRoot, model.source), model.resourcePath);
  }
  const revisions = {};
  for (const [source, resourcePath] of sources) {
    const match = /_via_v(\d+)_(\d+)_(\d{8})\.json$/i.exec(path.basename(source));
    if (!match) continue;
    const resource = JSON.parse(fs.readFileSync(path.join(outputRoot, resourcePath), 'utf8'));
    const digest = createHash('sha256').update(JSON.stringify(resource)).digest('hex');
    revisions[digest] = `v${match[1]}.${match[2]} (${match[3]})`;
  }
  return revisions;
}

module.exports = {getLocalDefinitions, assertNoDefinitionConflicts, getDefinitionRevisions, getBuildTimestamp, normalizeDefinitionTimestamp};
if (require.main === module) {
  try {
    buildDefinitions();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
