import {beforeEach, expect, mock, test} from 'bun:test';
import {configureStore} from '@reduxjs/toolkit';
import {keyboardDefinitionV3ToVIADefinitionV3} from '@the-via/reader';
import {KeyboardValue} from '../src/utils/keyboard-values';

// All I/O is an in-memory fake. No browser, network, USB or persistent store.
const calls: string[] = [];
const keyWrites: {path: string; layer: number; row: number; col: number; value: number}[] = [];
const replies = new Map<string, unknown>();
const deferred = <T,>() => {let resolve!: (value: T) => void; const promise = new Promise<T>(r => resolve = r); return {promise, resolve};};
class FakeAPI {
  constructor(readonly path: string, readonly current = () => true) {}
  async call(method: string, fallback: unknown) {
    if (!this.current()) throw new Error('Stale operation');
    calls.push(`${this.path}:${method}`);
    const answer = await (replies.get(`${this.path}:${method}`) ?? fallback);
    if (!this.current()) throw new Error('Stale operation');
    if (answer instanceof Error) throw answer;
    return answer as any;
  }
  getLayerCount = () => this.call('layers', 2);
  readRawMatrix = (_matrix: unknown, layer: number) => this.call(`matrix:${layer}`, [this.path === 'A' ? 4 : 5]);
  setKey = (layer: number, row: number, col: number, value: number) => {
    if (!this.current()) throw new Error('Stale operation');
    keyWrites.push({path: this.path, layer, row, col, value});
    return this.call('setKey', 0);
  };
  writeRawMatrix = () => this.call('writeMatrix', 0);
  getKeyboardValue = (command: number) => command === KeyboardValue.KEYCODES_VERSION ? this.call('keycodes', [0, 0, 0, 8]) : this.call('firmware', [0, 0, 0, this.path === 'A' ? 1 : 2]);
  getProtocolVersion = () => this.call('protocol', 11);
  getCustomMenuValue = (command: number[]) => this.call('menu', [command[0], this.path === 'A' ? 1 : 2]);
  setCustomMenuValue = () => this.call('menuWrite', 0);
  commitCustomMenu = () => this.call('menuCommit', 0);
  waitForCommandQueueIdle = () => this.call('idle', 0);
  getMacroBufferSize = () => this.call('macroBuffer', 64);
  getMacroCount = () => this.call('macroCount', 1);
}
mock.module('../src/utils/keyboard-api', () => ({KeyboardAPI: FakeAPI, KeyboardValue, UISyncRequestType: {CUSTOM_MENU_ALL: 0, CUSTOM_MENU_COMMANDS: 1}}));
mock.module('../src/utils/macro-api', () => ({
  isDelaySupported: () => true,
  getMacroAPI: (_protocol: number, _version: unknown, api: FakeAPI) => ({
    readRawKeycodeSequences: () => api.call('macros', [[api.path === 'A' ? 4 : 5]]),
    writeRawKeycodeSequences: () => api.call('writeMacros', 0),
  }),
}));
const definition = keyboardDefinitionV3ToVIADefinitionV3({name: 'Test fixture only', vendorId: '0xFFFE', productId: '0x006C', matrix: {rows: 1, cols: 1}, layouts: {keymap: [['0,0']]}, menus: [{label: 'Lighting', content: [{label: 'Settings', content: [{label: 'Level', type: 'range', options: [0, 255], content: ['level', 1, 1]}]}]}]} as any);
let currentDefinition = definition;
let discovered: any[] | Promise<any[]> = [];
let rejectedDevices: {device: any; reason: string}[] = [];
let availableDefinitions = true;
mock.module('../src/utils/device-store', () => ({getDefinitionsFromStore: () => ({}), getSupportedIdsFromStore: () => ({}), syncStore: async () => undefined}));
mock.module('../src/utils/hid-keyboards', () => ({getRecognisedDevices: async (_ids: unknown, _force: unknown, onUnresolved: any) => {rejectedDevices.forEach(({device, reason}) => onUnresolved?.(device, reason)); return await discovered;}, getVendorProductId: (vid: number, pid: number) => vid * 65536 + pid}));
mock.module('../src/components/panes/configure-panes/custom/menu-generator', () => ({makeCustomMenu: () => null, makeCustomMenus: () => []}));
mock.module('../src/store/definitionsSlice', () => ({
  getDefinitions: () => availableDefinitions ? ({4294836332: {v3: currentDefinition}, 'morgrie-air68': {v3: currentDefinition}, 'morgrie-dos68': {v3: currentDefinition}}) : {},
  reloadDefinitions: () => async () => undefined, loadLayoutOptions: () => async () => undefined, loadStoredCustomDefinitions: () => async () => undefined, updateDefinitions: () => ({type: 'test/definitions'}),
  getDefinitionForDevice: () => currentDefinition,
  getSelectedDefinition: () => currentDefinition,
  getSelectedKeyDefinitions: () => currentDefinition.layouts.keys,
}));
const devices = await import('../src/store/devicesSlice');
const keymaps = await import('../src/store/keymapSlice');
const macros = await import('../src/store/macrosSlice');
const firmware = await import('../src/store/firmwareSlice');
const menus = await import('../src/store/menusSlice');
const lighting = await import('../src/store/lightingSlice');
const names = await import('../src/store/definitionNameSlice');
const errors = await import('../src/store/errorsSlice');
const connections = await import('../src/store/devicesThunks');
const {createDeviceOperationContext} = await import('../src/store/device-operation');
const makeDevice = (path: string) => ({path, protocol: 11, vendorId: 0xfffe, productId: 0x006c, vendorProductId: 4294836332, requiredDefinitionVersion: 'v3', hasResolvedDefinition: true, productName: 'RIE68', modelDefinitionId: 'morgrie-air68'} as any);
const A = makeDevice('A'), B = makeDevice('B');
const newStore = () => {const store = configureStore({reducer: {devices: devices.default, keymap: keymaps.default, macros: macros.default, firmware: firmware.default, menus: menus.default, lighting: lighting.default, definitionName: names.default, errors: errors.default, definitions: (state = {definitions: {}, customDefinitions: {}}) => state}}); store.dispatch(devices.updateConnectedDevices({A, B})); store.dispatch(devices.selectDevice(A)); return store;};
beforeEach(() => {calls.length = 0; keyWrites.length = 0; replies.clear(); currentDefinition = definition; discovered = []; rejectedDevices = []; availableDefinitions = true;});

test('an explicitly stale target cannot read the newly selected device', async () => {
  const store = newStore(); store.dispatch(devices.selectDevice(B));
  await store.dispatch(keymaps.loadKeymapFromDevice(A) as any);
  expect(calls).toEqual([]);
  expect(store.getState().keymap.rawDeviceMap.A).toBeUndefined();
});
test('late firmware result cannot update an expired selection', async () => {
  const store = newStore(); const hold = deferred<number[]>(); replies.set('A:firmware', hold.promise);
  const pending = store.dispatch(firmware.loadFirmwareVersion(A) as any);
  store.dispatch(devices.selectDevice(B)); hold.resolve([0, 0, 0, 9]); await pending;
  expect(store.getState().firmware.firmwareVersionMap.A).toBeUndefined();
});
test('firmware read accepts exactly four big-endian bytes without signed overflow', async () => {
  const store = newStore();
  replies.set('A:firmware', [0x90, 0x12, 0x34, 0xab]);
  await store.dispatch(firmware.loadFirmwareVersion(A) as any);
  expect(firmware.getSelectedFirmwareVersion(store.getState() as any)).toBe(0x901234ab);
  expect(calls).toEqual(['A:firmware']);
});

test('new selection never shows a previous session version after an invalid or failed read', async () => {
  const store = newStore();
  await store.dispatch(firmware.loadFirmwareVersion(A) as any);
  expect(firmware.getSelectedFirmwareVersion(store.getState() as any)).toBe(1);
  store.dispatch(devices.selectDevice(B));
  expect(firmware.getSelectedFirmwareVersion(store.getState() as any)).toBeUndefined();
  store.dispatch(devices.selectDevice(A));
  expect(firmware.getSelectedFirmwareVersion(store.getState() as any)).toBeUndefined();
  for (const response of [[0, 0, 1], [0, 0, 0, 256], new Error('unsupported')]) {
    store.dispatch(firmware.updateFirmwareVersion({devicePath: 'A', version: 99}));
    replies.set('A:firmware', response);
    await store.dispatch(firmware.loadFirmwareVersion(A) as any);
    expect(firmware.getSelectedFirmwareVersion(store.getState() as any)).toBeUndefined();
  }
});

test('late macro read neither overwrites B nor starts further A commands', async () => {
  const store = newStore(); const hold = deferred<number[][]>(); replies.set('A:macros', hold.promise);
  const pending = store.dispatch(macros.loadMacros(A) as any);
  store.dispatch(devices.selectDevice(B)); await store.dispatch(macros.loadMacros(B) as any);
  hold.resolve([[4]]); await pending;
  expect(macros.getAST(store.getState() as any)).toEqual([[5]]);
  expect(calls).not.toContain('A:macroBuffer');
});
test('layer counts belong to the device, including identical VID/PID devices', async () => {
  const store = newStore(); replies.set('A:layers', 4);
  await store.dispatch(keymaps.loadKeymapFromDevice(A) as any);
  store.dispatch(devices.selectDevice(B)); await store.dispatch(keymaps.loadKeymapFromDevice(B) as any);
  store.dispatch(devices.selectDevice(A));
  expect(keymaps.getNumberOfLayers(store.getState() as any)).toBe(4);
});
test('key completion updates the layer that was sent, after UI layer changes', async () => {
  const store = newStore(); await store.dispatch(keymaps.loadKeymapFromDevice(A) as any);
  const hold = deferred<number>(); replies.set('A:setKey', hold.promise);
  const pending = store.dispatch(keymaps.updateKey(0, 42) as any);
  store.dispatch(keymaps.setLayer(1)); hold.resolve(0); await pending;
  expect(store.getState().keymap.rawDeviceMap.A[0].keymap).toEqual([42]);
  expect(store.getState().keymap.rawDeviceMap.A[1].keymap).toEqual([4]);
});
test('Save/Load with a captured stale device cannot write the new selected device', async () => {
  const store = newStore(); store.dispatch(devices.selectDevice(B));
  await store.dispatch(keymaps.saveRawKeymapToDevice([[4]], A) as any);
  await store.dispatch(macros.saveMacros(A, []) as any);
  expect(calls).toEqual([]);
});
test('retry cancellation prevents an already scheduled callback', async () => {
  const {createRetry} = await import('../src/utils/retry');
  const retry = createRetry(3, 5); let fired = false;
  retry.retry(() => {fired = true;}); retry.clear();
  await new Promise(r => setTimeout(r, 20)); expect(fired).toBe(false);
});

test('A to B to A expires the first A context, even with an identical path', async () => {
  const store = newStore(); const context = createDeviceOperationContext(store.getState as any, A)!;
  store.dispatch(devices.selectDevice(B)); store.dispatch(devices.selectDevice(A));
  expect(context.isCurrent()).toBe(false);
  await expect(context.api.getLayerCount()).rejects.toThrow('Stale');
  expect(calls).toEqual([]);
});
test('a replaced definition invalidates pending model-dependent work', async () => {
  const store = newStore(); const context = createDeviceOperationContext(store.getState as any, A)!;
  currentDefinition = {...definition, name: 'Replacement fixture'};
  expect(context.isCurrent()).toBe(false);
  await expect(context.api.getLayerCount()).rejects.toThrow('Stale');
});
test('newest selection wins while old keycode negotiation is delayed', async () => {
  const store = newStore(); const hold = deferred<number[]>(); replies.set('A:keycodes', hold.promise);
  const versionedA = {...A, protocol: 13}; store.dispatch(devices.updateConnectedDevices({A: versionedA, B}));
  const pending = store.dispatch(connections.selectConnectedDevice(versionedA) as any);
  await store.dispatch(connections.selectConnectedDevice(B) as any);
  hold.resolve([0, 0, 0, 8]); await pending;
  expect(store.getState().devices.selectedDevicePath).toBe('B');
  expect(devices.getIsSelectedDeviceReady(store.getState() as any)).toBe(true);
  expect(calls).not.toContain('A:macros');
});
test('disconnect invalidates delayed initialization without disturbing B', async () => {
  const store = newStore(); const hold = deferred<number[][]>(); replies.set('A:macros', hold.promise);
  const pending = store.dispatch(connections.selectConnectedDevice(A) as any);
  await Promise.resolve(); await Promise.resolve();
  store.dispatch(devices.disconnectDevice('A'));
  await store.dispatch(connections.selectConnectedDevice(B) as any);
  hold.resolve([[4]]); await pending;
  expect(store.getState().devices.selectedDevicePath).toBe('B');
  expect(devices.getIsSelectedDeviceReady(store.getState() as any)).toBe(true);
  expect(calls).not.toContain('A:macroBuffer');
});
test('bad protocol before a valid same-ID device does not shift its protocol', async () => {
  const store = newStore(); discovered = [{...A, path: 'bad'}, B]; replies.set('bad:protocol', -1);
  await store.dispatch(connections.reloadConnectedDevices(false) as any);
  expect(store.getState().devices.connectedDevicePaths.B.protocol).toBe(11);
  expect(store.getState().devices.connectedDevicePaths.B.modelDefinitionId).toBe('morgrie-air68');
  expect(store.getState().devices.invalidProtocolDevicePaths.bad).toBeDefined();
});
test('older scan results cannot replace the newest scan', async () => {
  const store = newStore(); const hold = deferred<any[]>(); discovered = hold.promise;
  const pending = store.dispatch(connections.reloadConnectedDevices(false) as any);
  discovered = [B]; await store.dispatch(connections.reloadConnectedDevices(false) as any);
  hold.resolve([A]); await pending;
  expect(Object.keys(store.getState().devices.connectedDevicePaths)).toEqual(['B']);
});
test('menu sync notification from A cannot query selected B', async () => {
  const store = newStore(); store.dispatch(devices.selectDevice(B));
  await store.dispatch(menus.syncCustomMenuValuesFromRequest({type: 0} as any, 'A') as any);
  expect(calls).toEqual([]);
});
test('a pending menu write cannot commit after selection changes', async () => {
  const store = newStore(); const hold = deferred<number>(); replies.set('A:menuWrite', hold.promise);
  const pending = store.dispatch(menus.updateCustomMenuValue('level', 1, 1, 22) as any);
  store.dispatch(devices.selectDevice(B)); hold.resolve(0); await pending;
  expect(calls).not.toContain('A:menuCommit'); expect(calls).not.toContain('B:menuCommit');
});
test('same-model instances preserve independent macros and capability flags', async () => {
  const store = newStore(); await store.dispatch(macros.loadMacros(A) as any);
  const oldB = {...B, protocol: 7}; store.dispatch(devices.updateConnectedDevices({A, B: oldB}));
  store.dispatch(devices.selectDevice(oldB)); await store.dispatch(macros.loadMacros(oldB) as any);
  expect(macros.getIsMacroFeatureSupported(store.getState() as any)).toBe(false);
  store.dispatch(devices.selectDevice(A));
  expect(macros.getIsMacroFeatureSupported(store.getState() as any)).toBe(true);
  expect(macros.getAST(store.getState() as any)).toEqual([[4]]);
});
test('reloading a lower layer count drops obsolete loaded layers', async () => {
  const store = newStore(); replies.set('A:layers', 4); await store.dispatch(keymaps.loadKeymapFromDevice(A) as any);
  replies.set('A:layers', 2); await store.dispatch(keymaps.loadKeymapFromDevice(A) as any);
  expect(keymaps.getSelectedRawLayers(store.getState() as any)).toHaveLength(2);
  expect(keymaps.getLoadProgress(store.getState() as any)).toBe(1);
});


test('unknown shared-ID descriptor is reported without any firmware query', async () => {
  const store = newStore(); rejectedDevices = [{device: {...A, productName: 'Unknown raw descriptor'}, reason: 'unknown-product-name'}];
  await store.dispatch(connections.reloadConnectedDevices(false) as any);
  expect(calls).toEqual([]);
  expect(devices.getModelErrorWarning(store.getState() as any)?.message).toContain('not recognized');
  expect(Object.keys(store.getState().devices.unresolvedDefinitionDevicePaths)).toEqual([]);
});
test('unsupported model protocol is blocked with a dedicated model error', async () => {
  const store = newStore(); discovered = [A]; replies.set('A:protocol', 10);
  await store.dispatch(connections.reloadConnectedDevices(false) as any);
  expect(calls).toEqual(['A:protocol']);
  expect(devices.getModelErrorWarning(store.getState() as any)?.message).toContain('requires a VIA v3');
  expect(Object.keys(store.getState().devices.connectedDevicePaths)).toEqual([]);
});
test('failed managed definition load does not use a numeric fallback', async () => {
  const store = newStore(); discovered = [A]; availableDefinitions = false;
  await store.dispatch(connections.reloadConnectedDevices(false) as any);
  expect(calls).toEqual(['A:protocol']);
  expect(devices.getModelErrorWarning(store.getState() as any)?.message).toContain('could not be loaded');
  expect(Object.keys(store.getState().devices.unresolvedDefinitionDevicePaths)).toEqual([]);
});
test('direct UI API is invalidated by an ABA selection', async () => {
  const store = newStore(); devices.setDeviceStateReader(store.getState as any);
  const api = devices.getSelectedKeyboardAPI(store.getState() as any)!;
  store.dispatch(devices.selectDevice(B)); store.dispatch(devices.selectDevice(A));
  await expect(api.getLayerCount()).rejects.toThrow('Stale');
  expect(calls).toEqual([]);
});


test('switching devices cancels a scheduled initialization retry', async () => {
  const store = newStore();
  replies.set('A:layers', new Error('Simulated transient read failure'));
  await store.dispatch(connections.selectConnectedDevice(A) as any);
  await store.dispatch(connections.selectConnectedDevice(B) as any);
  const oldCalls = calls.filter(call => call.startsWith('A:')).length;
  await new Promise(resolve => setTimeout(resolve, 140));
  expect(calls.filter(call => call.startsWith('A:'))).toHaveLength(oldCalls);
  expect(store.getState().devices.selectedDevicePath).toBe('B');
  expect(devices.getIsSelectedDeviceReady(store.getState() as any)).toBe(true);
});


test('an unchanged scan preserves the direct UI API and current key selection', () => {
  const store = newStore();
  devices.setDeviceStateReader(store.getState as any);
  const api = devices.getSelectedKeyboardAPI(store.getState() as any);
  store.dispatch(keymaps.updateSelectedKey(0));
  store.dispatch(devices.updateConnectedDevices({A: {...A}, B: {...B}}));
  expect(devices.getSelectedKeyboardAPI(store.getState() as any)).toBe(api);
  expect(keymaps.getSelectedKey(store.getState() as any)).toBe(0);
});

// Real AIR68 definition, fake I/O only: preserve the dynamic-keymap address
// independently of Matrix Test and the displayed keycode.
test.each([0, 1])('AIR68 Space keymap keeps (4,5) for read/write on layer %i', async (layer) => {
  const {default: source} = await import('../definitions/v3/morgrie/air68/Morgrie_Air68_via_v1_02_20250904.json');
  currentDefinition = keyboardDefinitionV3ToVIADefinitionV3(source as any);
  const spaceIndex = currentDefinition.layouts.keys.findIndex(key => key.row === 4 && key.col === 5);
  expect(spaceIndex).toBeGreaterThanOrEqual(0);
  expect(currentDefinition.layouts.keys[spaceIndex].w).toBe(6.25);
  const target = layer === 0 ? A : B;
  const store = newStore();
  store.dispatch(devices.selectDevice(target));
  const raw = Array(currentDefinition.matrix.rows * currentDefinition.matrix.cols).fill(0);
  // A non-Space code proves this is the physical key address, not KC_SPC matching.
  raw[65] = 4;
  raw[66] = 44;
  for (const index of [0, 1]) replies.set(target.path + ':matrix:' + index, [...raw]);
  await store.dispatch(keymaps.loadKeymapFromDevice(target) as any);
  store.dispatch(keymaps.setLayer(layer));
  expect(keymaps.getSelectedKeymap(store.getState() as any)?.[spaceIndex]).toBe(4);

  await store.dispatch(keymaps.updateKey(spaceIndex, 5) as any);
  expect(keyWrites).toEqual([{path: target.path, layer, row: 4, col: 5, value: 5}]);
  const layers = store.getState().keymap.rawDeviceMap[target.path];
  expect(layers[layer].keymap[65]).toBe(5);
  expect(layers[layer].keymap[66]).toBe(44);
  expect(layers[1 - layer].keymap[65]).toBe(4);
  expect(keymaps.getSelectedKeymap(store.getState() as any)?.[spaceIndex]).toBe(5);
  expect(calls.filter(call => call.endsWith(':setKey'))).toEqual([target.path + ':setKey']);
});
