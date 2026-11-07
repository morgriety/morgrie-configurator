import {afterAll, beforeEach, expect, mock, test} from 'bun:test';
import {THEMES as readerThemes} from '@the-via/reader';
import type {RootState} from '../src/store';
import {THEMES} from '../src/utils/themes';

// Each load reconstructs the actual settings slice and persisted device store.
// The browser storage is memory-only. No renderer, browser or keyboard is opened.
const memory = new Map<string, string>();
const storageKey = 'via-app-store';
const localStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
  },
});
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: {documentElement: {style: {setProperty: () => {}}}},
});
mock.module('../src/components/void/test-keyboard-sounds', () => ({
  TestKeyboardSoundsMode: {WickiHayden: 1},
}));
mock.module('../src/utils/hid-keyboards', () => ({
  getVendorProductId: () => {throw new Error('Unexpected HID lookup');},
}));

beforeEach(() => memory.clear());
afterAll(() => {
  for (const [key, descriptor] of [
    ['localStorage', localStorageDescriptor],
    ['document', documentDescriptor],
  ] as const) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

function loadSettings() {
  delete require.cache[require.resolve('../src/utils/device-store')];
  delete require.cache[require.resolve('../src/store/settingsSlice')];
  const api: typeof import('../src/store/settingsSlice') = require('../src/store/settingsSlice');
  const settings = api.default(undefined, {type: '@@INIT'});
  return {api, settings, root: {settings} as RootState};
}

test('fresh settings select MORGRIE_LIGHT and retain the existing render and UI modes', () => {
  const {api, settings, root} = loadSettings();
  expect(api.getThemeName(root)).toBe('MORGRIE_LIGHT');
  expect(api.getSelectedTheme(root)).toBe(THEMES.MORGRIE_LIGHT);
  expect(settings.renderMode).toBe('2D');
  expect(settings.themeMode).toBe('dark');
  expect(memory.has(storageKey)).toBe(false);
});

test.each([undefined, 'unknown-theme'])('a missing or unavailable preference (%s) falls back without writing settings', themeName => {
  const snapshot = JSON.stringify({settings: {themeName, hostKeyboardLayout: 'keymap_de'}});
  memory.set(storageKey, snapshot);
  const {api, settings, root} = loadSettings();
  expect(api.getThemeName(root)).toBe('MORGRIE_LIGHT');
  expect(api.getSelectedTheme(root)).toBe(THEMES.MORGRIE_LIGHT);
  expect(settings.hostKeyboardLayout).toBe('keymap_de');
  expect(memory.get(storageKey)).toBe(snapshot);
});

test.each(['OLIVIA_DARK', 'OLIVE'] as const)('a saved VIA theme (%s) survives the new default', themeName => {
  const snapshot = JSON.stringify({settings: {themeName, renderMode: '3D'}});
  memory.set(storageKey, snapshot);
  const {api, settings, root} = loadSettings();
  expect(api.getThemeName(root)).toBe(themeName);
  expect(api.getSelectedTheme(root)).toBe(THEMES[themeName]);
  expect(settings.renderMode).toBe('3D');
  expect(memory.get(storageKey)).toBe(snapshot);
});

test('switching to the brand theme and back survives each reload and preserves other saved data', async () => {
  const saved = {definitionIndex: {hash: 'preserved'}, settings: {themeName: 'OLIVE', disableFastRemap: true}};
  memory.set(storageKey, JSON.stringify(saved));
  for (const name of ['MORGRIE_LIGHT', 'OLIVE'] as const) {
    const {api, settings} = loadSettings();
    api.default(settings, api.updateThemeName(name));
    // Store.set queues the actual localStorage write for the next event loop turn.
    await new Promise(resolve => setTimeout(resolve, 0));
    const reloaded = loadSettings();
    expect(reloaded.api.getThemeName(reloaded.root)).toBe(name);
    expect(reloaded.api.getSelectedTheme(reloaded.root)).toBe(THEMES[name]);
    expect(reloaded.settings.disableFastRemap).toBe(true);
    expect(JSON.parse(memory.get(storageKey)!).definitionIndex.hash).toBe('preserved');
  }
});

test('VIA reader palettes survive registration and the brand palette passes the real 3D conversion', () => {
  expect(THEMES).toMatchObject(readerThemes);
  const {api, root} = loadSettings();
  const palette = api.getSelectedTheme(root);
  expect(Object.keys(palette).sort()).toEqual(['accent', 'alpha', 'mod']);
  const converted = api.getSelectedSRGBTheme(root);
  for (const role of ['alpha', 'mod', 'accent'] as const) {
    expect(palette[role].c.toUpperCase()).toBe('#E9E5E2');
    expect(palette[role].t.toUpperCase()).toBe('#212121');
    expect(converted[role].c).toMatch(/^#[a-f\d]{6}$/i);
    expect(converted[role].t).toMatch(/^#[a-f\d]{6}$/i);
  }
});
