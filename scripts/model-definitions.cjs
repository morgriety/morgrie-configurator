const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {createRequire} = require('node:module');
const projectRoot = path.resolve(__dirname, '..');
const registry = JSON.parse(fs.readFileSync(path.join(projectRoot, 'definitions/model-registry.json'), 'utf8'));
const reader = createRequire(path.resolve(projectRoot, 'node_modules/via-keyboards/package.json'))('@the-via/reader');
const asJSON = (value) => JSON.parse(JSON.stringify(value));
const readJSON = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function modelDefinitions() {
  const ids = new Set();
  const identities = new Set();
  const resources = new Set();
  assert.equal(registry.version, 1);
  return registry.models.map((model) => {
    assert.match(model.modelDefinitionId, /^[a-z0-9-]+$/);
    assert(!ids.has(model.modelDefinitionId), 'Duplicate modelDefinitionId');
    ids.add(model.modelDefinitionId);
    const identity = JSON.stringify([model.vendorId, model.productId, model.productName, model.definitionVersion]);
    assert(!identities.has(identity), 'Ambiguous exact productName registration');
    identities.add(identity);
    assert(!resources.has(model.resourcePath), 'Duplicate model resource path');
    resources.add(model.resourcePath);
    assert.equal(model.definitionVersion, 'v3');
    assert.match(model.resourcePath, /^(v3\/\d+|models\/[a-z0-9-]+)\.json$/);
    const sourcePath = path.resolve(projectRoot, model.source);
    assert(sourcePath.startsWith(path.join(projectRoot, 'definitions') + path.sep), 'Model source must be inside definitions');
    const source = readJSON(sourcePath);
    assert.equal(Number(source.vendorId), model.vendorId, 'Model source VID mismatch');
    assert.equal(Number(source.productId), model.productId, 'Model source PID mismatch');
    const definition = asJSON(reader.keyboardDefinitionV3ToVIADefinitionV3(source));
    assert.equal(definition.vendorProductId, model.vendorId * 65536 + model.productId);
    return {model, definition};
  });
}

function combinedHash(baseDefinitionHash, entries) {
  return createHash('sha256')
    .update(JSON.stringify({baseDefinitionHash, registry, definitions: entries.map(({definition}) => definition)}))
    .digest('hex');
}

function buildModelDefinitions(outputRoot) {
  const output = path.resolve(outputRoot);
  const entries = modelDefinitions();
  const baseDefinitionHash = readJSON(path.join(output, 'hash.json'));
  assert.match(baseDefinitionHash, /^[a-f0-9]{64}$/, 'Invalid base definition hash');
  for (const {model, definition} of entries) {
    const target = path.join(output, model.resourcePath);
    if (model.resourcePath.startsWith('v3/')) {
      // AIR68's maintained source and original numeric output are untouched.
      assert.deepEqual(readJSON(target), definition, 'Existing model resource differs from its source');
    } else {
      fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.writeFileSync(target, JSON.stringify(definition));
    }
  }
  fs.writeFileSync(path.join(output, 'model-registry.json'), JSON.stringify({...registry, baseDefinitionHash}));
  const hash = combinedHash(baseDefinitionHash, entries);
  fs.writeFileSync(path.join(output, 'hash.json'), JSON.stringify(hash));
  return {hash, modelCount: entries.length};
}

function verifyModelDefinitions(outputRoot) {
  const output = path.resolve(outputRoot);
  const {baseDefinitionHash, ...generatedRegistry} = readJSON(path.join(output, 'model-registry.json'));
  assert.match(baseDefinitionHash, /^[a-f0-9]{64}$/, 'Invalid base definition hash');
  assert.deepEqual(generatedRegistry, registry, 'Model manifest differs from the source registry');
  const entries = modelDefinitions();
  assert.equal(readJSON(path.join(output, 'hash.json')), combinedHash(baseDefinitionHash, entries),
    'Model registry and resources do not match the final definition hash');
  for (const {model, definition} of entries) {
    assert.deepEqual(readJSON(path.join(output, model.resourcePath)), definition,
      'Generated model definition was omitted or changed: ' + model.modelDefinitionId);
  }
}

module.exports = {buildModelDefinitions, verifyModelDefinitions, modelDefinitions};
