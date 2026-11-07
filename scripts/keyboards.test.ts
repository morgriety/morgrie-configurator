/**
 * Software-only keyboard integration tests; no USB device is opened or written.
 * Run with Bun. VIA_DEFINITIONS_ROOT selects public/definitions (default)
 * or dist/definitions so the same checks cover development and production.
 * The older AIR68_DEFINITIONS_ROOT environment variable is also supported.
 * The VIA matching, WebHID adapter, definition store, and connection/keymap
 * thunks are real. Browser APIs and firmware replies are isolated mocks.
 * Macro, lighting, and firmware metadata thunks are stubbed, not validated.
 */
import {afterAll, beforeEach, describe, expect, mock, test} from 'bun:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {configureStore, createNextState} from '@reduxjs/toolkit';
import {
  BuiltInKeycodeModule,
  isKeyboardDefinitionV3,
  keyboardDefinitionV3ToVIADefinitionV3,
} from '@the-via/reader';

const projectRoot = resolve(import.meta.dir, '..');
const resourceRoot = resolve(
  projectRoot,
  process.env.VIA_DEFINITIONS_ROOT || process.env.AIR68_DEFINITIONS_ROOT || 'public/definitions',
);
const readJSON = (relative: string) =>
  JSON.parse(readFileSync(resolve(resourceRoot, relative), 'utf8'));
const vendorId = 0xfffe;
const keyboards = [
  {
    label: 'AIR68',
    relativeSource: 'definitions/v3/morgrie/air68/Morgrie_Air68_via_v1_02_20250904.json',
    productId: 0x006c,
    vendorProductId: 4294836332,
    displayName: 'morgrie Air68',
    matrix: {rows: 5, cols: 15},
  },
  {
    label: 'Spacetime65',
    relativeSource: 'definitions/v3/morgrie/spacetime65/rkb65_via_v1_01_20261020.json',
    productId: 0x00b1,
    vendorProductId: 4294836401,
    displayName: 'spacetime 65',
    matrix: {rows: 5, cols: 16},
  },
].map((keyboard) => {
  const sourcePath = resolve(projectRoot, keyboard.relativeSource);
  const sourceBytes = readFileSync(sourcePath);
  return {
    ...keyboard,
    sourcePath,
    sourceBytes,
    source: JSON.parse(sourceBytes.toString('utf8')),
    generatedRelativePath: `v3/${keyboard.vendorProductId}.json`,
  };
});
const {getLocalDefinitions, assertNoDefinitionConflicts} = require('./build-definitions.js');

// Install browser-only dependencies before importing the application modules.
const savedGlobals = new Map<string, PropertyDescriptor | undefined>();
function replaceGlobal(name: string, value: unknown) {
  savedGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, {configurable: true, value});
}
const storage = new Map<string, string>();
replaceGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
});
replaceGlobal('self', {crypto: globalThis.crypto});
let deploymentHash = '';
replaceGlobal('document', {
  getElementById: (id: string) =>
    id === 'definition_hash' ? {dataset: {hash: deploymentHash}} : null,
});
const requestedResources: string[] = [];
replaceGlobal('fetch', async (input: string) => {
  requestedResources.push(input);
  if (!input.startsWith('/definitions/')) {
    throw new Error(`Unexpected network request: ${input}`);
  }
  const relative = input.slice('/definitions/'.length);
  if (!/^(supported_kbs\.json|v[23]\/\d+\.json|models\/morgrie-dos68-v3\.json)$/.test(relative)) {
    throw new Error(`Unexpected definition request: ${input}`);
  }
  try {
    return new Response(readFileSync(resolve(resourceRoot, relative)), {
      status: 200,
      headers: {'Content-Type': 'application/json'},
    });
  } catch {
    return new Response('Definition not found', {status: 404});
  }
});

const makeHIDDevice = (pid: number) => ({
  vendorId,
  productId: pid,
  productName: pid === 0x006c ? 'RIE68' : 'Simulated USB descriptor (not physical hardware)',
  collections: [{usagePage: 0xff60, usage: 0x61}],
  forget: mock(async () => undefined),
});
let authorizedDevices: ReturnType<typeof makeHIDDevice>[] = [];
let requestedDevice: ReturnType<typeof makeHIDDevice> | null = null;
const requestDevice = mock(async (_options: unknown) => {
  if (!requestedDevice) {
    return [];
  }
  authorizedDevices = [requestedDevice];
  return authorizedDevices;
});
replaceGlobal('navigator', {
  hid: {
    getDevices: async () => authorizedDevices,
    requestDevice,
  },
});

// No mock can call navigator.hid.open/sendReport: firmware replies are plain data.
let protocol = 11;
const readMatrix = mock(async (matrix: {rows: number; cols: number}, layer: number) =>
  Array(matrix.rows * matrix.cols).fill(4 + layer),
);
class SimulatedKeyboardAPI {
  constructor(readonly path: string) {}
  getProtocolVersion = async () => protocol;
  getLayerCount = async () => 4;
  readRawMatrix = readMatrix;
  getKeyboardValue = async () => [0, 0, 0, 3];
}
const {KeyboardValue} = await import('../src/utils/keyboard-values');
mock.module('../src/utils/keyboard-api', () => ({
  KeyboardAPI: SimulatedKeyboardAPI,
  KeyboardValue,
  canConnect: () => true,
}));
mock.module('../src/components/void/test-keyboard-sounds', () => ({
  TestKeyboardSoundsMode: {Random: 0, WickiHayden: 1, Chromatic: 2},
}));
const noOpThunk = () => async () => undefined;
mock.module('../src/store/macrosSlice', () => ({loadMacros: noOpThunk}));
mock.module('../src/store/lightingSlice', () => ({updateLightingData: noOpThunk}));
mock.module('../src/store/menusSlice', () => ({updateV3MenuData: noOpThunk}));
mock.module('../src/store/firmwareSlice', () => ({
  loadKeycodesVersion: noOpThunk,
  loadFirmwareVersion: noOpThunk,
  getSelectedKeycodesVersion: () => undefined,
}));
const importedDefinitions = mock(async () => []);
mock.module('idb-keyval', () => ({
  entries: importedDefinitions,
  del: async () => undefined,
  setMany: async () => undefined,
  update: async () => undefined,
}));

const matching = await import('../src/utils/hid-keyboards');
const definitionStore = await import('../src/utils/device-store');
const devices = await import('../src/store/devicesSlice');
const definitions = await import('../src/store/definitionsSlice');
const definitionNames = await import('../src/store/definitionNameSlice');
const {getDeviceDisplayName} = await import('../src/utils/device-display-name');
const keymaps = await import('../src/store/keymapSlice');
const errors = await import('../src/store/errorsSlice');
const connection = await import('../src/store/devicesThunks');
const newStore = () => configureStore({
  reducer: {
    devices: devices.default,
    definitions: definitions.default,
    definitionName: definitionNames.default,
    keymap: keymaps.default,
    errors: errors.default,
  },
});
const waitUntil = async (condition: () => boolean) => {
  const deadline = Date.now() + 2000;
  while (!condition() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  expect(condition()).toBe(true);
};
let caseNumber = 0;
beforeEach(() => {
  authorizedDevices = [];
  requestedDevice = null;
  requestedResources.length = 0;
  requestDevice.mockClear();
  importedDefinitions.mockClear();
  readMatrix.mockClear();
  protocol = 11;
  // A distinct simulated deployment forces the real cache invalidation path.
  deploymentHash = createHash('sha256')
    .update(`${readJSON('hash.json')}:${++caseNumber}`)
    .digest('hex');
});
afterAll(() => {
  for (const [name, descriptor] of savedGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

for (const keyboard of keyboards) {
  const {
    label, sourcePath, sourceBytes, source, productId, vendorProductId,
    displayName, matrix, generatedRelativePath,
  } = keyboard;
  describe(`${label} source and generated resources`, () => {
    test('preserves supplied JSON data and accepts its v3 schema', () => {
      if (label === 'AIR68') {
        expect(createHash('sha256').update(sourceBytes).digest('hex')).toBe(
          '80e3e6b19a634a418aa6296be10c6f1531ed1602d7f195b37e43bb82bf3023a2',
        );
      } else {
        // Keep the entire 20261020 attachment byte-for-byte, including its name.
        expect(createHash('sha256').update(sourceBytes).digest('hex')).toBe(
          '8089adbc525ad69e4d386e35ea5388b8d7212bcc933020134f7c8cf683a5b2b9',
        );
      }
      expect(isKeyboardDefinitionV3(source)).toBe(true);
      expect(Number(source.vendorId)).toBe(vendorId);
      expect(Number(source.productId)).toBe(productId);
      expect(source.name).toBe(displayName);
    });

    test('indexes the correct VID/PID and preserves all parsed definition data', () => {
      const generated = readJSON(generatedRelativePath);
      const expected = keyboardDefinitionV3ToVIADefinitionV3(source);
      expect(generated).toEqual(JSON.parse(JSON.stringify(expected)));
      expect(generated.vendorProductId).toBe(vendorProductId);
      expect(generated.matrix).toEqual(matrix);
      expect(generated.layouts.keys).toHaveLength(label === 'AIR68' ? 68 : 62);
      expect(generated.layouts.labels).toEqual(source.layouts.labels);
      expect(generated.layouts.optionKeys).toEqual(expected.layouts.optionKeys);
      expect(generated.menus).toEqual(source.menus);
      expect(generated.customKeycodes).toEqual(source.customKeycodes);
      expect(generated.keycodes).toEqual(source.keycodes);
      const index = readJSON('supported_kbs.json');
      expect(index.vendorProductIds.v3.filter((id: number) => id === vendorProductId))
        .toEqual([vendorProductId]);
      expect(index.vendorProductIds.v2).not.toContain(vendorProductId);
      expect(readJSON('keyboard_names.json').filter((name: string) => name === displayName))
        .toEqual([displayName]);
      expect(readJSON('hash.json')).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe(`${label} definition conflict preflight`, () => {
    test('reads both maintained sources and accepts nonconflicting IDs', () => {
      const local = getLocalDefinitions();
      expect(local).toHaveLength(2);
      expect(local.map(({id}: {id: number}) => id).sort())
        .toEqual(keyboards.map(({vendorProductId}) => vendorProductId).sort());
      expect(local.find(({id}: {id: number}) => id === vendorProductId)).toMatchObject({
        id: vendorProductId, source: sourcePath, version: 'v3', definition: source,
      });
      expect(() => assertNoDefinitionConflicts(local, [
        {id: vendorProductId - 1, source: 'upstream/other.json', version: 'v3'},
      ])).not.toThrow();
    });

    test.each(['v2', 'v3'])('rejects an upstream %s definition with the same VID/PID', (version) => {
      expect(() => assertNoDefinitionConflicts(getLocalDefinitions(), [
        {id: vendorProductId, source: `upstream/${version}/conflict.json`, version},
      ])).toThrow(`VID/PID conflict ${vendorProductId}`);
    });

    test.each(['v2', 'v3'])('rejects a second local %s definition with the same VID/PID', (version) => {
      expect(() => assertNoDefinitionConflicts([
        ...getLocalDefinitions(),
        {id: vendorProductId, source: `local/${version}/duplicate.json`, version},
      ], [])).toThrow(`Duplicate local VID/PID ${vendorProductId}`);
    });
  });

  describe(`${label} real VIA loading and matching with simulated browser/firmware`, () => {
    test('uses the real unsigned VID/PID matching and rejects another PID', async () => {
      await definitionStore.syncStore();
      expect(matching.getVendorProductId(vendorId, productId)).toBe(vendorProductId);
      authorizedDevices = [makeHIDDevice(productId), makeHIDDevice(0x006d)];
      const recognised = await matching.getRecognisedDevices(
        definitionStore.getSupportedIdsFromStore(),
      );
      expect(recognised).toHaveLength(1);
      expect(recognised[0].productId).toBe(productId);
      expect(requestDevice).not.toHaveBeenCalled();
    });

    test('loads the built-in JSON directly through the original definition store', async () => {
      await definitionStore.syncStore();
      expect(definitionStore.getDefinitionsFromStore()).toEqual({});
      expect(definitionStore.getSupportedIdsFromStore()[vendorProductId]).toEqual({v3: true});
      const [definition, version] = await definitionStore.getMissingDefinition({
        path: `simulated-${label}`, vendorId, productId, vendorProductId,
        productName: label === 'AIR68' ? 'RIE68' : source.name, protocol: 11, hasResolvedDefinition: false,
        requiredDefinitionVersion: 'v3',
      }, 'v3');
      expect(version).toBe('v3');
      expect(definition).toEqual(readJSON(generatedRelativePath));
      expect(requestedResources).toEqual([
        '/definitions/supported_kbs.json', `/definitions/${generatedRelativePath}`,
      ]);
    });

    test.each(['first authorization', 'already authorized'])(
      '%s: auto-selects device and loads all keymap layers without Design/import',
      async (mode) => {
        const fakeDevice = makeHIDDevice(productId);
        if (mode === 'already authorized') authorizedDevices = [fakeDevice];
        const store = newStore();
        await store.dispatch(connection.loadSupportedIds() as any);
        if (mode === 'first authorization') {
          // Startup has no authorized keyboard. The following dispatch represents
          // the existing Authorize device button; browser user activation itself
          // cannot be verified in this isolated test.
          await waitUntil(() => store.getState().devices.forceAuthorize);
          requestDevice.mockClear();
          requestedDevice = fakeDevice;
          await store.dispatch(connection.reloadConnectedDevices() as any);
        }
        await waitUntil(() => devices.getIsSelectedDeviceReady(store.getState() as any));
        const state = store.getState();
        expect(state.definitions.customDefinitions).toEqual({});
        expect(importedDefinitions).toHaveBeenCalledTimes(1);
        expect(devices.getSelectedConnectedDevice(state as any)?.vendorProductId)
          .toBe(vendorProductId);
        expect(definitions.getSelectedDefinition(state as any))
          .toEqual(readJSON(generatedRelativePath));
        expect(definitionNames.getSelectedDefinitionName(state as any)).toBe(displayName);
        const selected = devices.getSelectedConnectedDevice(state as any)!;
        expect(definitionNames.getConnectedDefinitionNames(state as any)(selected))
          .toBe(displayName);
        // Raw simulated firmware value 3 is decoded by the new three-bit schema;
        // this is not a migration or a write to an actual device.
        expect(definitions.getSelectedLayoutOptions(state as any))
          .toEqual(label === 'AIR68' ? [] : [0, 1, 1]);
        expect(keymaps.getLoadProgress(state as any)).toBe(1);
        expect(keymaps.getNumberOfLayers(state as any)).toBe(4);
        expect(readMatrix.mock.calls.map(([matrix, layer]) => [matrix, layer]))
          .toEqual([0, 1, 2, 3].map((layer) => [matrix, layer]));
        expect(state.errors.appErrors).toEqual([]);
        expect(requestedResources).toContain(`/definitions/${generatedRelativePath}`);
        expect(requestDevice).toHaveBeenCalledTimes(mode === 'first authorization' ? 1 : 0);
        if (mode === 'first authorization') {
          expect(requestDevice.mock.calls[0][0]).toMatchObject({
            filters: expect.arrayContaining([{usagePage: 0xff60, usage: 0x61}]),
          });
        }
      },
    );

    test('cancelling browser authorization leaves no selected device', async () => {
      const store = newStore();
      await store.dispatch(connection.loadSupportedIds() as any);
      await waitUntil(() => store.getState().devices.forceAuthorize);
      expect(requestDevice).toHaveBeenCalledTimes(1);
      expect(store.getState().devices.selectedDevicePath).toBeNull();
      expect(readMatrix).not.toHaveBeenCalled();
    });

    test('protocol 10 does not silently use a v3-only definition', async () => {
      protocol = 10;
      const fakeDevice = makeHIDDevice(productId);
      authorizedDevices = [fakeDevice];
      const store = newStore();
      await store.dispatch(connection.loadSupportedIds() as any);
      await waitUntil(() => label === 'AIR68'
        ? !!Object.keys(store.getState().devices.modelErrors).length
        : !!Object.keys(store.getState().devices.unresolvedDefinitionDevicePaths).length);
      expect(store.getState().devices.selectedDevicePath).toBeNull();
      if (label === 'AIR68') expect(requestedResources).not.toContain(`/definitions/v2/${vendorProductId}.json`);
      else expect(requestedResources).toContain(`/definitions/v2/${vendorProductId}.json`);
      expect(fakeDevice.forget).not.toHaveBeenCalled();
      expect(readMatrix).not.toHaveBeenCalled();
    });
  });
}

describe('AIR68 and Spacetime65 coexistence', () => {
  test('matches both authorized devices and switches their keymaps without mixing definitions', async () => {
    authorizedDevices = keyboards.map(({productId}) => makeHIDDevice(productId));
    const store = newStore();
    await store.dispatch(connection.loadSupportedIds() as any);
    await waitUntil(() => devices.getIsSelectedDeviceReady(store.getState() as any));
    expect(Object.values(devices.getConnectedDevices(store.getState() as any)))
      .toHaveLength(2);
    for (const keyboard of keyboards) {
      const connected = Object.values(devices.getConnectedDevices(store.getState() as any))
        .find((device) => device.vendorProductId === keyboard.vendorProductId)!;
      await store.dispatch(connection.selectConnectedDeviceByPath(connected.path) as any);
      await waitUntil(() =>
        devices.getIsSelectedDeviceReady(store.getState() as any) &&
        devices.getSelectedDevicePath(store.getState() as any) === connected.path,
      );
      const state = store.getState();
      expect(definitions.getSelectedDefinition(state as any))
        .toEqual(readJSON(keyboard.generatedRelativePath));
      expect(definitionNames.getSelectedDefinitionName(state as any))
        .toBe(keyboard.displayName);
      expect(keymaps.getSelectedRawLayers(state as any)).toHaveLength(4);
      expect(keymaps.getSelectedRawLayers(state as any)[0].keymap)
        .toHaveLength(keyboard.matrix.rows * keyboard.matrix.cols);
      expect(state.definitions.customDefinitions).toEqual({});
      expect(state.errors.appErrors).toEqual([]);
    }
    expect(requestDevice).not.toHaveBeenCalled();
  });

  test('uses the maintained Spacetime65 definition name only for its exact USB identity', () => {
    const rawName = 'Firmware USB product string';
    expect(getDeviceDisplayName({vendorId, productId: 0x00b1, productName: rawName}))
      .toBe('spacetime 65');
    expect(getDeviceDisplayName({vendorId, productId: 0x006c, productName: rawName}))
      .toBe(rawName);
    expect(getDeviceDisplayName({vendorId: 0xfffd, productId: 0x00b1, productName: rawName}))
      .toBe(rawName);
    expect(getDeviceDisplayName({vendorId, productId: 0x006d})).toBe('');
  });
});


// Keep the new-definition regression group independently runnable and countable with
// --test-name-pattern 'Spacetime65 20261020 regression'. No physical HID is used.
describe('Spacetime65 20261020 regression', () => {
  const keyboard = keyboards.find(({label}) => label === 'Spacetime65')!;
  const parsed = keyboardDefinitionV3ToVIADefinitionV3(keyboard.source);
  const legacyCodes = [
    'RGB_TOG', 'RGB_RMOD', 'RGB_MOD', 'RGB_HUD', 'RGB_HUI', 'RGB_SAD',
    'RGB_SAI', 'RGB_VAD', 'RGB_VAI', 'RGB_SPD', 'RGB_SPI', 'RGB_M_P',
    'RGB_M_B', 'RGB_M_R', 'RGB_M_SW', 'RGB_M_SN', 'RGB_M_K', 'RGB_M_X',
    'RGB_M_G',
  ];
  const matrixCodes = [
    'RM_TOGG', 'RM_NEXT', 'RM_PREV', 'RM_HUEU', 'RM_HUED', 'RM_SATU',
    'RM_SATD', 'RM_VALU', 'RM_VALD', 'RM_SPDU', 'RM_SPDD',
  ];

  test('resolves the RGB Matrix module to the existing Lighting category and catalog', async () => {
    const {categoriesForKeycodeModule, getKeycodes} = await import('../src/utils/key');
    expect(parsed.keycodes).toEqual([BuiltInKeycodeModule.QMKRGBMatrixKeycodes]);
    expect(categoriesForKeycodeModule(parsed.keycodes[0])).toEqual(['qmk_lighting']);
    const catalog = getKeycodes().find(({id}) => id === 'qmk_lighting')!;
    expect(catalog.label).toBe('Lighting');
    const available = catalog.keycodes.map(({code}) => code);
    expect(available).toEqual(expect.arrayContaining([...legacyCodes, ...matrixCodes]));
  });

  test.each([11, 12])('protocol %s keeps the existing legacy RGB keycode mapping', async (version) => {
    const {getQMKLightingKeycodes, getKeycodesForKeyboard} = await import('../src/utils/key');
    const lighting = getQMKLightingKeycodes(parsed, version).map(({code}) => code);
    expect(lighting).toEqual(legacyCodes);
    expect(lighting.some((code) => /^(BL_|RM_|UG_)/.test(code))).toBe(false);
    expect(getKeycodesForKeyboard(parsed, version).map(({code}) => code))
      .toEqual([...legacyCodes].sort());
  });

  test.each([13, 14])('protocol %s exposes RGB Matrix without unrelated lighting modules', async (version) => {
    const {getQMKLightingKeycodes, getKeycodesForKeyboard} = await import('../src/utils/key');
    const lighting = getQMKLightingKeycodes(parsed, version).map(({code}) => code);
    expect(lighting).toEqual(matrixCodes);
    expect(lighting.some((code) => /^(BL_|RGB_|UG_)/.test(code))).toBe(false);
    expect(getKeycodesForKeyboard(parsed, version).map(({code}) => code))
      .toEqual([...matrixCodes].sort());
  });

  test('preserves the device Lighting commands and all eight custom keycodes', () => {
    const generated = readJSON(keyboard.generatedRelativePath);
    expect(generated.menus).toEqual(keyboard.source.menus);
    expect(generated.menus).toHaveLength(1);
    const menu = generated.menus[0];
    expect(menu.label).toBe('Lighting');
    expect(menu.content[0].label).toBe('Backlight');
    const controls = menu.content[0].content;
    expect(controls.map(({content}: {content: unknown}) => content)).toEqual([
      ['id_qmk_rgb_matrix_brightness', 3, 1],
      ['id_qmk_rgb_matrix_effect', 3, 2],
      ['id_qmk_rgb_matrix_effect_speed', 3, 3],
      ['id_qmk_rgb_matrix_color', 3, 4],
    ]);
    expect(controls[0].options).toEqual([0, 200]);
    expect(controls[1].options).toHaveLength(21);
    expect(controls[1].options.map(([, value]: [string, number]) => value))
      .toEqual(Array.from({length: 21}, (_, index) => index));
    expect(controls[2].options).toEqual([0, 255]);
    expect(generated.customKeycodes).toEqual([
      'USB', 'BT_1', 'BT_2', 'BT_3', '2_4G', 'BT_VOL', 'N2FN', 'SW_OS1',
    ].map((name) => ({name, title: name, shortName: name})));
  });

  test('a changed definition hash refreshes built-ins while preserving user settings and unrelated storage', async () => {
    const originalSettings = structuredClone(definitionStore.getSettings());
    const sentinelKey = 'spacetime-test-unrelated-storage';
    storage.set(sentinelKey, 'preserve me');
    const device = {
      path: 'simulated-Spacetime65-cache', vendorId, productId: keyboard.productId,
      vendorProductId: keyboard.vendorProductId, productName: keyboard.displayName,
      protocol: 13, hasResolvedDefinition: false, requiredDefinitionVersion: 'v3' as const,
    };
    try {
      createNextState(originalSettings, (draft) => {
        draft.hostKeyboardLayout = 'keymap_de';
        draft.disableFastRemap = true;
        definitionStore.setSettings(draft);
      });
      const expectedSettings = structuredClone(definitionStore.getSettings());
      await definitionStore.syncStore();
      await definitionStore.getMissingDefinition(device, 'v3');
      expect(definitionStore.getDefinitionsFromStore()[keyboard.vendorProductId].v3)
        .toEqual(readJSON(keyboard.generatedRelativePath));

      requestedResources.length = 0;
      deploymentHash = createHash('sha256')
        .update(deploymentHash + ':definition-update').digest('hex');
      const newIndex = await definitionStore.syncStore();
      expect(newIndex.hash).toBe(deploymentHash);
      expect(definitionStore.getDefinitionsFromStore()).toEqual({});
      expect(requestedResources).toEqual(['/definitions/supported_kbs.json']);
      expect(definitionStore.getSettings()).toEqual(expectedSettings);

      const [fresh] = await definitionStore.getMissingDefinition(device, 'v3');
      expect(fresh).toEqual(readJSON(keyboard.generatedRelativePath));
      expect(fresh.layouts.labels).toEqual(['ISO Enter', 'Splite Left Shift', 'Splite Backspace']);
      expect(fresh.keycodes).toEqual([BuiltInKeycodeModule.QMKRGBMatrixKeycodes]);
      expect(requestedResources).toEqual([
        '/definitions/supported_kbs.json', '/definitions/v3/4294836401.json',
      ]);
      // The real store persists asynchronously; wait for its actual saved state.
      await waitUntil(() => {
        const persisted = JSON.parse(storage.get('via-app-store') || '{}');
        return persisted.definitionIndex?.hash === deploymentHash &&
          !!persisted.definitions?.[keyboard.vendorProductId]?.v3;
      });
      expect(JSON.parse(storage.get('via-app-store')!).settings).toEqual(expectedSettings);
      expect(storage.get(sentinelKey)).toBe('preserve me');
      expect(requestDevice).not.toHaveBeenCalled();
      expect(readMatrix).not.toHaveBeenCalled();
    } finally {
      createNextState(originalSettings, (draft) => definitionStore.setSettings(draft));
      await waitUntil(() =>
        JSON.parse(storage.get('via-app-store') || '{}').settings?.hostKeyboardLayout ===
          originalSettings.hostKeyboardLayout,
      );
      storage.delete(sentinelKey);
    }
  });
});

describe('DOS68 built resources and shared-ID discovery integration', () => {
  const createDOS = () => ({...makeHIDDevice(0x006c), productName: 'DOS 68'});
  test.each(['DOS only', 'AIR then DOS', 'DOS then AIR', 'two DOS instances'])('%s keeps device instances and definitions separate', async mode => {
    const air = makeHIDDevice(0x006c), dos = createDOS();
    authorizedDevices = mode === 'DOS only' ? [dos] : mode === 'AIR then DOS' ? [air, dos] : mode === 'DOS then AIR' ? [dos, air] : [dos, createDOS()];
    const store = newStore();
    await store.dispatch(connection.loadSupportedIds() as any);
    const connected = Object.values(devices.getConnectedDevices(store.getState() as any));
    expect(connected).toHaveLength(authorizedDevices.length);
    expect(new Set(connected.map(d => d.path)).size).toBe(authorizedDevices.length);
    for (const device of [...connected, connected[0]]) {
      await store.dispatch(connection.selectConnectedDeviceByPath(device.path) as any);
      const state = store.getState();
      expect(devices.getIsSelectedDeviceReady(state as any)).toBe(true);
      const isDOS = device.productName === 'DOS 68';
      expect(device.modelDefinitionId).toBe(isDOS ? 'morgrie-dos68' : 'morgrie-air68');
      expect(definitions.getSelectedDefinition(state as any)).toEqual(readJSON(isDOS ? 'models/morgrie-dos68-v3.json' : 'v3/4294836332.json'));
      expect(keymaps.getSelectedRawLayers(state as any)[0].keymap).toHaveLength(isDOS ? 80 : 75);
      expect(definitions.getSelectedLayoutOptions(state as any)).toEqual(isDOS ? [0, 1, 1] : []);
    }
    expect(requestedResources).toContain('/definitions/models/morgrie-dos68-v3.json');
  });
  test.each(['', 'rie68', 'RIE68 ', 'DOS68', 'DOS 68 ', 'dos 68'])('unknown name %j is blocked even with old numeric custom definition and force authorization', async productName => {
    const unknown = {...makeHIDDevice(0x006c), productName};
    importedDefinitions.mockImplementationOnce(async () => [[4294836332, {v3: readJSON('v3/4294836332.json')}] ]);
    authorizedDevices = [unknown];
    const store = newStore();
    store.dispatch(definitions.loadCustomDefinitions({definitions:[readJSON('v3/4294836332.json')],version:'v3'}));
    store.dispatch(devices.setForceAuthorize(true));
    await store.dispatch(connection.loadSupportedIds() as any);
    expect(readMatrix).not.toHaveBeenCalled();
    expect(devices.getSelectedConnectedDevice(store.getState() as any)).toBeNull();
    expect(Object.keys(store.getState().devices.modelErrors)).toHaveLength(1);
    expect(unknown.forget).not.toHaveBeenCalled();
    expect(requestedResources).not.toContain('/definitions/v3/4294836332.json');
  });
});

test('diagnostics identifies a loaded builtin and withholds release metadata for custom overrides', () => {
  const values = readJSON('models/morgrie-dos68-v3.json');
  const device = {path: 'usb-2', vendorId: 0xfffe, productId: 0x006c, productName: 'DOS 68',
    modelDefinitionId: 'morgrie-dos68', requiredDefinitionVersion: 'v3'};
  const entry = {'morgrie-dos68': {v3: values}};
  const state = {
    devices: {connectedDevicePaths: {'usb-2': device}, selectedDevicePath: 'usb-2'},
    definitions: {definitions: entry, customDefinitions: {}},
  };
  expect(definitions.getSelectedBuiltinDefinition(state as any)).toBe(values);
  expect(definitions.getSelectedBuiltinDefinition({...state,
    definitions: {definitions: entry, customDefinitions: entry},
  } as any)).toBeUndefined();
  expect(definitions.getSelectedBuiltinDefinition({...state,
    devices: {connectedDevicePaths: {}, selectedDevicePath: null},
  } as any)).toBeUndefined();
});
