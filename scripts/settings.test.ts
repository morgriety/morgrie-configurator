import {afterAll, beforeEach, expect, mock, test} from 'bun:test';

// Run in a separate Bun process, like the other store tests. The real reducer,
// device-store and Store use only this in-memory storage and DOM. No browser,
// HID, user preferences, network or device writes are accessed.
const savedGlobals = new Map<string, PropertyDescriptor | undefined>();
const savedPreferences = {
  showConsoleTab: true,
  disableFastRemap: true,
  ShowSliderValuesMode: 'Slider & Input Field',
  renderMode: '3D',
  themeMode: 'light',
  themeName: 'OLIVE',
  hostKeyboardLayout: 'keymap_de',
  macroEditor: {smartOptimizeEnabled: false, recordDelaysEnabled: true, tapEnterAtEOMEnabled: true},
  testKeyboardSoundsSettings: {isEnabled: false, volume: 35, waveform: 'triangle', mode: 1, transpose: 4},
};
const cachedDefinitions = {'morgrie-air68': {v3: {name: 'isolated cached definition'}}};
const memory = new Map<string, string>([
  ['via-app-store', JSON.stringify({
    definitionIndex: {hash: 'isolated-definition-hash'},
    definitions: cachedDefinitions,
    settings: savedPreferences,
  })],
  ['unrelated-user-data', 'preserved'],
]);
const storageWrites: string[] = [];
const cssWrites = new Map<string, string>();
const dataset: Record<string, string> = {};
function replaceGlobal(name: string, value: unknown) {
  savedGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, {configurable: true, value});
}
replaceGlobal('localStorage', {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => {storageWrites.push(key); memory.set(key, value);},
  removeItem: () => {throw new Error('Unexpected storage removal');},
  clear: () => {throw new Error('Unexpected storage clear');},
});
replaceGlobal('document', {
  createElement: () => ({getContext: () => null}),
  documentElement: {dataset, style: {setProperty: (key: string, value: string) => cssWrites.set(key, value)}},
});
replaceGlobal('window', {});
replaceGlobal('fetch', () => {throw new Error('Network forbidden in isolated settings tests');});
mock.module('../src/components/void/test-keyboard-sounds', () => ({
  TestKeyboardSoundsMode: {Random: 0, WickiHayden: 1, Chromatic: 2},
}));
mock.module('../src/utils/hid-keyboards', () => ({
  getVendorProductId: (vendorId: number, productId: number) => vendorId * 65536 + productId,
}));
mock.module('../src/utils/keyboard-rendering', () => ({makeSRGBTheme: (theme: unknown) => theme}));
const settings = await import('../src/store/settingsSlice');
const {getSettings} = await import('../src/utils/device-store');
const {THEMES} = await import('../src/utils/themes');
const reducer = settings.default;
const initial = () => reducer(undefined, {type: '@@isolated/init'});
const root = (state = initial()) => ({settings: state} as any);
const settleStorage = () => new Promise<void>(resolve => setTimeout(resolve, 10));
const persisted = () => JSON.parse(memory.get('via-app-store')!);

beforeEach(async () => {
  await settleStorage();
  storageWrites.length = 0;
  cssWrites.clear();
  for (const key of Object.keys(dataset)) delete dataset[key];
});
afterAll(async () => {
  await settleStorage();
  for (const [name, descriptor] of savedGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete (globalThis as any)[name];
  }
});

test('initialization preserves saved preferences and keeps missing Design tab setting disabled', () => {
  expect(initial()).toMatchObject(savedPreferences);
  expect(settings.getShowDesignTab(root())).toBe(false);
  expect(settings.getShowConsoleTab(root())).toBe(true);
  expect(settings.getHostKeyboardLayout(root())).toBe('keymap_de');
  expect(storageWrites).toEqual([]);
});

test('reading selectors and an unrelated action do not persist or reset preferences', () => {
  const before = initial();
  expect(reducer(before, {type: 'devices/selectedChanged'})).toBe(before);
  expect(settings.getDisableFastRemap(root(before))).toBe(true);
  expect(settings.getThemeMode(root(before))).toBe('light');
  expect(settings.getThemeName(root(before))).toBe('OLIVE');
  expect(settings.getSelectedTheme(root(before))).toBe(THEMES.OLIVE);
  expect(storageWrites).toEqual([]);
});

test('no-WebGL fallback changes presentation without overwriting saved 3D and slider preferences', () => {
  const state = initial();
  expect(settings.getRenderMode(root(state))).toBe('2D');
  expect(settings.getShowSliderValuesMode(root(state))).toBe('Slider Only');
  expect(state.renderMode).toBe('3D');
  expect(state.ShowSliderValuesMode).toBe('Slider & Input Field');
  expect(storageWrites).toEqual([]);
});

test('Fast Remap persistence retains other preferences, model cache and unrelated storage', async () => {
  const before = initial();
  const next = reducer(before, settings.toggleFastRemap());
  await settleStorage();
  expect(next).toEqual({...before, disableFastRemap: false});
  expect(getSettings()).toEqual(next);
  expect(persisted().settings).toEqual(next);
  expect(persisted().definitions).toEqual(cachedDefinitions);
  expect(persisted().definitionIndex.hash).toBe('isolated-definition-hash');
  expect(memory.get('unrelated-user-data')).toBe('preserved');
  expect(storageWrites).toEqual(['via-app-store']);
});

test('Console visibility persists without enabling Design or changing rendering and input settings', async () => {
  const before = initial();
  const next = reducer(before, settings.toggleConsoleTab());
  await settleStorage();
  expect(next).toEqual({...before, showConsoleTab: false});
  expect(persisted().settings.showDesignTab).toBe(false);
  expect(persisted().settings).toEqual(next);
});

test('theme changes preserve preferences and limit CSS updates to existing keycap theme variables', async () => {
  const before = initial();
  const themed = reducer(before, settings.updateThemeName('OLIVIA_DARK'));
  const next = reducer(themed, settings.toggleThemeMode());
  await settleStorage();
  expect(next).toEqual({...before, themeName: 'OLIVIA_DARK', themeMode: 'dark'});
  expect(dataset.themeMode).toBe('dark');
  expect([...cssWrites.keys()].sort()).toEqual(['--color_accent', '--color_inside-accent']);
  expect(cssWrites.get('--color_accent')).toBe(THEMES.OLIVIA_DARK.accent.c);
  expect(persisted().settings).toEqual(next);
});

test('render and slider updates persist only their chosen values', async () => {
  const before = initial();
  const next = reducer(
    reducer(before, settings.updateRenderMode('2D')),
    settings.updateShowSliderValuesMode('Slider & Show Value'),
  );
  await settleStorage();
  expect(next).toEqual({...before, renderMode: '2D', ShowSliderValuesMode: 'Slider & Show Value'});
  expect(persisted().settings).toEqual(next);
  expect(next.showDesignTab).toBe(false);
});

test('partial editor and test-sound updates retain sibling settings and host layout', async () => {
  const before = initial();
  const next = reducer(
    reducer(before, settings.setMacroEditorSettings({recordDelaysEnabled: false})),
    settings.setTestKeyboardSoundsSettings({volume: 50}),
  );
  await settleStorage();
  expect(next.macroEditor).toEqual({...before.macroEditor, recordDelaysEnabled: false});
  expect(next.testKeyboardSoundsSettings).toEqual({...before.testKeyboardSoundsSettings, volume: 50});
  expect(next.hostKeyboardLayout).toBe('keymap_de');
  expect(persisted().settings).toEqual(next);
});

test('transient tester and confirmation flags do not persist or enable Design', async () => {
  let state = initial();
  state = reducer(state, settings.setTestMatrixEnabled(true));
  state = reducer(state, settings.enableGlobalHotKeys());
  state = reducer(state, settings.setShowDesignTabConfirmationNotice(true));
  await settleStorage();
  expect(state.isTestMatrixEnabled).toBe(true);
  expect(state.allowGlobalHotKeys).toBe(true);
  expect(state.showDesignTabConfirmationNotice).toBe(true);
  expect(state.showDesignTab).toBe(false);
  expect(storageWrites).toEqual([]);
});