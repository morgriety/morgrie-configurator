const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createRequire} = require('node:module');
const {getLocalDefinitions} = require('./build-definitions.js');
const {verifyModelDefinitions} = require('./model-definitions.cjs');

const root = path.resolve(process.argv[2] || 'public/definitions');
const readJSON = (relative) =>
  JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const index = readJSON('supported_kbs.json');
const hash = readJSON('hash.json');
assert.match(hash, /^[a-f0-9]{64}$/, 'Definition hash must be a SHA-256 string');
readJSON('keyboard_names.json');

const allIndexedIds = new Set([
  ...index.vendorProductIds.v2,
  ...index.vendorProductIds.v3,
]);
const counts = {};
for (const version of ['v2', 'v3']) {
  const files = fs.readdirSync(path.join(root, version))
    .filter((file) => file.endsWith('.json'));
  assert(files.length > 0, `${version}: no generated definitions`);
  const fileIds = new Set();
  for (const file of files) {
    const definition = readJSON(path.join(version, file));
    const id = Number(path.basename(file, '.json'));
    assert.equal(definition.vendorProductId, id, `${version}/${file}: ID mismatch`);
    assert(allIndexedIds.has(id), `${version}/${file}: missing from supported index`);
    fileIds.add(id);
  }
  for (const id of index.vendorProductIds[version]) {
    assert(fileIds.has(id), `${version}: indexed definition ${id} is missing`);
  }
  counts[version] = files.length;
}
const localDefinitions = getLocalDefinitions();
const reader = createRequire(path.resolve(__dirname, '../node_modules/via-keyboards/package.json'))('@the-via/reader');
for (const {version, id, definition} of localDefinitions) {
  const convert = version === 'v3'
    ? reader.keyboardDefinitionV3ToVIADefinitionV3
    : reader.keyboardDefinitionV2ToVIADefinitionV2;
  // Match the upstream writer's JSON serialization (drops undefined fields).
  const expected = JSON.parse(JSON.stringify(convert(definition)));
  assert.deepEqual(readJSON(`${version}/${id}.json`), expected,
    `Local definition ${id} was omitted or changed during generation`);
  assert(index.vendorProductIds[version].includes(id), `Local definition ${id} missing from ${version} index`);
}
verifyModelDefinitions(root);
console.log(JSON.stringify({root, counts, localDefinitions: localDefinitions.length, indexedDevices: allIndexedIds.size, hash}, null, 2));
