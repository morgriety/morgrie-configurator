import {afterAll, beforeEach, describe, expect, mock, test} from 'bun:test';
import {readFileSync, mkdtempSync, rmSync, mkdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve, join, dirname, basename} from 'node:path';
import {createHash} from 'node:crypto';
import {keyboardDefinitionV3ToVIADefinitionV3} from '@the-via/reader';
import registry from '../definitions/model-registry.json';
import {
  resolveModelDefinition, getDefinitionKey, definitionForDevice,
  getCustomDefinitionKey,
} from '../src/utils/model-definitions';

const root = resolve(import.meta.dir, '..');
const air = {vendorId: 0xfffe, productId: 0x006c, productName: 'RIE68', requiredDefinitionVersion: 'v3' as const};
const dos = {...air, productName: 'DOS 68'};
const models = registry.models.map((entry) => ({
  ...entry,
  source: JSON.parse(readFileSync(resolve(root, entry.source), 'utf8')),
}));
const airDefinition = keyboardDefinitionV3ToVIADefinitionV3(models[0].source);
const dosDefinition = keyboardDefinitionV3ToVIADefinitionV3(models[1].source);

describe('DOS68 model identity and generation', () => {
  test('retains both complete source files and the original AIR68 resource path', () => {
    const hashes = registry.models.map((entry) => createHash('sha256')
      .update(readFileSync(resolve(root, entry.source)))
      .digest('hex'));
    expect(hashes).toEqual([
      '80e3e6b19a634a418aa6296be10c6f1531ed1602d7f195b37e43bb82bf3023a2',
      '301d8e59fe78581b56070fb9484180706278a6dde00ccfbc3343d5927a3d80bf',
    ]);
    expect(registry.models[0].resourcePath).toBe('v3/4294836332.json');
    expect(registry.models[1].resourcePath).toBe('models/morgrie-dos68-v3.json');
    expect(models.map(({source}) => source.matrix)).toEqual([{rows: 5, cols: 15}, {rows: 5, cols: 16}]);
  });

  test('binds exact product names to different stable identities despite equal USB IDs', () => {
    expect(resolveModelDefinition(air)).toMatchObject({kind: 'model', modelDefinitionId: 'morgrie-air68'});
    expect(resolveModelDefinition(dos)).toMatchObject({kind: 'model', modelDefinitionId: 'morgrie-dos68'});
    expect(getDefinitionKey(air)).not.toBe(getDefinitionKey(dos));
  });

  test.each(['', 'rie68', 'RIE68 ', ' DOS 68', 'DOS68', 'DOS 68 ', 'morgrie Air68'])
    ('rejects unconfirmed exact name %j without numeric AIR68 fallback', (productName) => {
      const device = {...air, productName};
      expect(resolveModelDefinition(device).kind).toBe('unresolved');
      expect(getDefinitionKey(device)).toBeUndefined();
      expect(definitionForDevice(device, {'4294836332': {v3: airDefinition}})).toBeUndefined();
    });

  test('rejects stale model binding and unsupported definition version', () => {
    expect(getDefinitionKey({...dos, modelDefinitionId: 'morgrie-air68'})).toBeUndefined();
    expect(getDefinitionKey({...dos, requiredDefinitionVersion: 'v2'})).toBeUndefined();
  });

  test('keeps nonambiguous devices on their existing numeric definition route', () => {
    const spacetime = {...dos, productId: 0x00b1, productName: 'anything'};
    expect(resolveModelDefinition(spacetime)).toEqual({kind: 'legacy'});
    expect(getDefinitionKey(spacetime)).toBe('4294836401');
  });

  test('isolates managed definitions and ignores old shared numeric overrides', () => {
    const dictionary = {
      '4294836332': {v3: {...dosDefinition, name: 'unassigned imported draft'}},
      'morgrie-air68': {v3: airDefinition},
      'morgrie-dos68': {v3: dosDefinition},
    };
    expect(definitionForDevice(air, dictionary)).toBe(airDefinition);
    expect(definitionForDevice(dos, dictionary)).toBe(dosDefinition);
    expect(definitionForDevice(dos, {'4294836332': {v3: dosDefinition}})).toBeUndefined();
  });

  test('custom scopes must be explicit and must match USB identity and version', () => {
    expect(getCustomDefinitionKey(dosDefinition, 'v3')).toBe('4294836332');
    expect(getCustomDefinitionKey(dosDefinition, 'v3', 'morgrie-dos68')).toBe('morgrie-dos68');
    expect(() => getCustomDefinitionKey({...dosDefinition, vendorProductId: 1}, 'v3', 'morgrie-dos68')).toThrow();
    expect(() => getCustomDefinitionKey(dosDefinition, 'v2', 'morgrie-dos68')).toThrow();
    expect(() => getCustomDefinitionKey(dosDefinition, 'v3', 'unregistered-model')).toThrow();
  });

  test('generates only the sidecar model resource and covers registry content in the deployment hash', () => {
    const {buildModelDefinitions, verifyModelDefinitions} = require('./model-definitions.cjs');
    const output = mkdtempSync(join(tmpdir(), 'morgrie-model-generation-'));
    try {
      mkdirSync(join(output, 'v3'));
      const airPath = join(output, 'v3/4294836332.json');
      const airBytes = JSON.stringify(airDefinition);
      writeFileSync(airPath, airBytes);
      writeFileSync(join(output, 'hash.json'), JSON.stringify('1'.repeat(64)));
      const result = buildModelDefinitions(output);
      expect(readFileSync(airPath, 'utf8')).toBe(airBytes);
      expect(JSON.parse(readFileSync(join(output, 'models/morgrie-dos68-v3.json'), 'utf8'))).toEqual(JSON.parse(JSON.stringify(dosDefinition)));
      expect(JSON.parse(readFileSync(join(output, 'model-registry.json'), 'utf8')))
        .toEqual({...registry, baseDefinitionHash: '1'.repeat(64)});
      expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.hash).not.toBe('1'.repeat(64));
      expect(() => verifyModelDefinitions(output)).not.toThrow();
      writeFileSync(join(output, 'hash.json'), JSON.stringify('2'.repeat(64)));
      expect(() => verifyModelDefinitions(output)).toThrow('hash');
      writeFileSync(join(output, 'hash.json'), JSON.stringify(result.hash));
      const badRegistry = {...structuredClone(registry), baseDefinitionHash: '1'.repeat(64)};
      badRegistry.models[1].productName = 'different firmware name';
      writeFileSync(join(output, 'model-registry.json'), JSON.stringify(badRegistry));
      expect(() => verifyModelDefinitions(output)).toThrow();
    } finally {
      if (dirname(output) !== resolve(tmpdir()) || !basename(output).startsWith('morgrie-model-generation-')) throw new Error('Unexpected test output directory');
      rmSync(output, {recursive: true, force: true});
    }
  });
});

// These cache tests run against the real Store/device-store modules with only
// browser storage and HTTP substituted. They never enumerate or open USB devices.
const savedGlobals = new Map<string, PropertyDescriptor | undefined>();
const fakeStorage = new Map<string, string>([
  ['via-app-store', JSON.stringify({
    definitionIndex: {hash: 'before-model-registry'},
    definitions: {'4294836332': {v3: airDefinition}},
    settings: {hostKeyboardLayout: 'keymap_de', disableFastRemap: true},
  })],
  ['unrelated-user-data', 'preserved'],
]);
const clearStorage = mock(() => fakeStorage.clear());
function replaceGlobal(name: string, value: unknown) {
  savedGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, {configurable: true, value});
}
let deploymentHash = 'before-model-registry';
let cacheCase = 0;
const requests: {url: string; cache?: RequestCache}[] = [];
const responses = new Map<string, unknown>();
replaceGlobal('localStorage', {
  getItem: (key: string) => fakeStorage.get(key) ?? null,
  setItem: (key: string, value: string) => fakeStorage.set(key, value),
  removeItem: (key: string) => fakeStorage.delete(key),
  clear: clearStorage,
});
replaceGlobal('document', {
  getElementById: (id: string) => id === 'definition_hash' ? {dataset: {hash: deploymentHash}} : null,
});
replaceGlobal('fetch', async (url: string, options?: RequestInit) => {
  requests.push({url, cache: options?.cache});
  return responses.has(url)
    ? new Response(JSON.stringify(responses.get(url)), {status: 200})
    : new Response('missing fixture', {status: 404});
});
mock.module('../src/components/void/test-keyboard-sounds', () => ({
  TestKeyboardSoundsMode: {Random: 0, WickiHayden: 1, Chromatic: 2},
}));
mock.module('../src/utils/hid-keyboards', () => ({
  getVendorProductId: (vendorId: number, productId: number) => vendorId * 65536 + productId,
}));
const cache = await import('../src/utils/device-store');
const {Store} = await import('../src/shims/via-app-store');
const authorized = (identity: typeof air) => ({
  ...identity, path: identity.productName, vendorProductId: 4294836332,
  protocol: 13, hasResolvedDefinition: false as const,
});

afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (const [name, descriptor] of savedGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('DOS68 managed definition cache', () => {
  beforeEach(async () => {
    responses.clear();
    responses.set('/definitions/supported_kbs.json', {
      generatedAt: 1, version: 'test', theme: {},
      vendorProductIds: {v2: [], v3: [4294836332, 4294836401]},
    });
    responses.set('/definitions/v3/4294836332.json', airDefinition);
    responses.set('/definitions/models/morgrie-dos68-v3.json', dosDefinition);
    deploymentHash = createHash('sha256').update('test-model-deployment-' + ++cacheCase).digest('hex');
    await cache.syncStore();
    requests.length = 0;
    clearStorage.mockClear();
  });

  test('loads both resources and caches them under separate stable model IDs', async () => {
    await Promise.all([
      cache.getMissingDefinition(authorized(air), 'v3'),
      cache.getMissingDefinition(authorized(dos), 'v3'),
    ]);
    expect(requests).toEqual(expect.arrayContaining([
      {url: '/definitions/v3/4294836332.json', cache: 'reload'},
      {url: '/definitions/models/morgrie-dos68-v3.json', cache: 'reload'},
    ]));
    const stored = cache.getDefinitionsFromStore();
    expect(Object.keys(stored).sort()).toEqual(['morgrie-air68', 'morgrie-dos68']);
    expect(stored['morgrie-air68'].v3).toEqual(JSON.parse(JSON.stringify(airDefinition)));
    expect(stored['morgrie-dos68'].v3).toEqual(JSON.parse(JSON.stringify(dosDefinition)));
  });

  test('unknown shared-ID identities never fetch the numeric AIR68 definition', async () => {
    await expect(cache.getMissingDefinition(authorized({...air, productName: 'unknown'}), 'v3')).rejects.toThrow('unresolved');
    expect(requests).toEqual([]);
    expect(cache.getDefinitionsFromStore()).toEqual({});
  });

  test('a missing DOS68 resource fails without numeric fallback', async () => {
    responses.delete('/definitions/models/morgrie-dos68-v3.json');
    await expect(cache.getMissingDefinition(authorized(dos), 'v3')).rejects.toThrow('unavailable');
    expect(requests.map(({url}) => url)).toEqual(['/definitions/models/morgrie-dos68-v3.json']);
    expect(cache.getDefinitionsFromStore()).toEqual({});
  });

  test('rejects a response with a different USB identity', async () => {
    responses.set('/definitions/models/morgrie-dos68-v3.json', {...dosDefinition, vendorProductId: 1});
    await expect(cache.getMissingDefinition(authorized(dos), 'v3')).rejects.toThrow('USB identity');
    expect(cache.getDefinitionsFromStore()).toEqual({});
  });

  test('new deployment hashes invalidate model caches while preserving settings and other data', async () => {
    await cache.getMissingDefinition(authorized(air), 'v3');
    await cache.getMissingDefinition(authorized(dos), 'v3');
    const settings = structuredClone(cache.getSettings());
    deploymentHash = createHash('sha256').update(deploymentHash + '-updated-registry').digest('hex');
    await cache.syncStore();
    expect(cache.getDefinitionsFromStore()).toEqual({});
    expect(cache.getSettings()).toEqual(settings);
    expect(cache.getSettings().hostKeyboardLayout).toBe('keymap_de');
    expect(cache.getSettings().disableFastRemap).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const persisted = JSON.parse(fakeStorage.get('via-app-store')!);
    expect(persisted.definitionIndex.hash).toBe(deploymentHash);
    expect(persisted.definitions).toEqual({});
    expect(persisted.settings).toEqual(settings);
    expect(fakeStorage.get('unrelated-user-data')).toBe('preserved');
    expect(clearStorage).not.toHaveBeenCalled();
  });

  test('a failed cache write never clears all browser storage', async () => {
    const original = Store.prototype.set;
    Store.prototype.set = function (key, value) {
      if (key === 'definitions') throw new Error('simulated storage failure');
      return original.call(this, key, value);
    };
    try {
      await expect(cache.getMissingDefinition(authorized(dos), 'v3')).rejects.toThrow('storage failure');
      expect(clearStorage).not.toHaveBeenCalled();
      expect(fakeStorage.get('unrelated-user-data')).toBe('preserved');
      expect(cache.getSettings().hostKeyboardLayout).toBe('keymap_de');
    } finally {
      Store.prototype.set = original;
    }
  });
});
