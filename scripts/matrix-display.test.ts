import {beforeEach, expect, mock, test} from 'bun:test';
import {createContext, createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {keyboardDefinitionV3ToVIADefinitionV3} from '@the-via/reader';
import airSource from '../definitions/v3/morgrie/air68/Morgrie_Air68_via_v1_02_20250904.json';
import dosSource from '../definitions/models/morgrie/dos68/rkb68_via_v1_02_20261014.json';
import spacetimeSource from '../definitions/v3/morgrie/spacetime65/rkb65_via_v1_01_20261020.json';
import ordinaryDefinition from '../src/utils/test-keyboard-definition.json';

// Run in a separate Bun process. Render the actual Test component; only the
// state sources, input hooks and output renderers are isolated. This tests the
// state passed to visual keys and sound rows, not HID, polling or real hardware.
const definitions = {
  air: keyboardDefinitionV3ToVIADefinitionV3(airSource as any),
  dos: keyboardDefinitionV3ToVIADefinitionV3(dosSource as any),
  spacetime: keyboardDefinitionV3ToVIADefinitionV3(spacetimeSource as any),
};
let definition = definitions.air;
let keys = definition.layouts.keys;
let selectedDevice: {path: string; modelDefinitionId?: string; protocol: number} = {path: 'isolated-air', modelDefinitionId: 'morgrie-air68', protocol: 12};
let matrixEnabled = true;
let soundsEnabled = true;
let route = '/test';
let matrixStates: number[] = [];
let ordinaryStates: number[] = [];
let keycodes: number[] = [];
let keyboardProps: any;
let soundStates: number[][] | undefined;
let matrixCalls: any[][] = [];
let ordinaryCalls: boolean[] = [];
const forbidden = () => {throw Error('Side effects are forbidden in the display test');};
const inertAPI = Object.freeze({isolated: true});
const testContext = createContext([{clearTestKeys: forbidden}, forbidden]);
const KeyboardOutput = (props: any) => {keyboardProps = props; return null;};

mock.module('../src/store/hooks', () => ({
  useAppSelector: (select: (state?: unknown) => unknown) => select(),
  useAppDispatch: () => forbidden,
}));
mock.module('../src/store/definitionsSlice', () => ({
  getSelectedDefinition: () => definition,
  getSelectedKeyDefinitions: () => keys,
}));
mock.module('../src/store/devicesSlice', () => ({
  getSelectedConnectedDevice: () => selectedDevice,
  getSelectedKeyboardAPI: () => inertAPI,
}));
mock.module('../src/store/keymapSlice', () => ({
  getSelectedKeymap: () => keycodes,
  setLayer: forbidden,
}));
mock.module('../src/store/settingsSlice', () => ({
  getIsTestMatrixEnabled: () => matrixEnabled,
  getTestKeyboardSoundsSettings: () => ({isEnabled: soundsEnabled}),
  setTestMatrixEnabled: forbidden,
}));
mock.module('../src/utils/use-matrix-test', () => ({
  useMatrixTest: (...args: any[]) => {matrixCalls.push(args); return [matrixStates, forbidden];},
}));
mock.module('../src/utils/use-global-keys', () => ({
  useGlobalKeys: (enabled: boolean) => {ordinaryCalls.push(enabled); return [ordinaryStates, forbidden];},
}));
mock.module('../src/components/void/test-keyboard-sounds', () => ({
  TestKeyboardSounds: ({pressedKeys}: {pressedKeys: number[][]}) => {soundStates = pressedKeys; return null;},
  TestKeyboardSoundsMode: {WickiHayden: 0, Chromatic: 1, Random: 2},
}));
mock.module('../src/components/panes/test', () => ({TestContext: testContext}));
mock.module('../src/components/n-links/keyboard/configure', () => ({getKeyboardCanvas: () => KeyboardOutput}));
mock.module('../src/utils/device-store', () => ({getThemeFromStore: forbidden}));
mock.module('../src/utils/keyboard-api', () => ({KeyboardAPI: class {constructor() {forbidden();}}}));
mock.module('wouter', () => ({useLocation: () => [route, forbidden]}));

const {Test} = await import('../src/components/n-links/keyboard/test');
const {TestKeyState} = await import('../src/types/types');
const {getKeyboardRowPartitions} = await import('../src/utils/keyboard-rendering');
const {matrixKeycodes} = await import('../src/utils/key-event');
const {Initial, KeyDown, KeyUp} = TestKeyState;
const render = () => {
  keyboardProps = undefined;
  soundStates = undefined;
  renderToStaticMarkup(createElement(Test, {
    dimensions: {width: 1000, height: 400} as DOMRect, nDimension: '2D',
  }));
  expect(keyboardProps).toBeDefined();
  return keyboardProps;
};
const expectedSound = (visibleKeys = keys, states = matrixStates, cols = definition.matrix.cols) =>
  getKeyboardRowPartitions(visibleKeys).partitionedKeys.map(row =>
    row.map(key => states[key.row * cols + key.col]));

beforeEach(() => {
  definition = definitions.air;
  keys = definition.layouts.keys;
  selectedDevice = {path: 'isolated-air', modelDefinitionId: 'morgrie-air68', protocol: 12};
  matrixEnabled = true;
  soundsEnabled = true;
  route = '/test';
  matrixStates = Array(definition.matrix.rows * definition.matrix.cols).fill(Initial);
  ordinaryStates = Array(ordinaryDefinition.matrix.rows * ordinaryDefinition.matrix.cols).fill(Initial);
  keycodes = keys.map(() => 4); // Arbitrary KC_A: coordinates must not depend on Space keycode.
  matrixCalls = [];
  ordinaryCalls = [];
});

test('AIR68 scan index 66 does not alias the definition Space at index 65', () => {
  const spaceIndex = keys.findIndex(key => key.row === 4 && key.col === 5);
  expect(spaceIndex).toBe(61);
  expect(keys.some(key => key.row === 4 && key.col === 6)).toBe(false);
  for (const state of [Initial, KeyDown, KeyUp]) {
    matrixStates[66] = state;
    const original = [...matrixStates];
    const view = render();
    expect(view.pressedKeys[spaceIndex]).toBe(Initial);
    expect(view.pressedKeys.every((value: number) => value === Initial)).toBe(true);
    expect(soundStates?.flat().every(value => value === Initial)).toBe(true);
    expect(matrixStates).toEqual(original);
  }
});

test('AIR68 definition coordinate drives the same visible key and sound on press/release', () => {
  const spaceIndex = keys.findIndex(key => key.row === 4 && key.col === 5);
  for (const state of [Initial, KeyDown, KeyUp]) {
    matrixStates[65] = state;
    const view = render();
    expect(view.pressedKeys[spaceIndex]).toBe(state);
    expect(view.pressedKeys.filter((value: number) => value !== Initial)).toHaveLength(state === Initial ? 0 : 1);
    expect(soundStates).toEqual(expectedSound());
    expect(soundStates?.flat().filter(value => value === state)).toHaveLength(state === Initial ? keys.length : 1);
    expect(view.keys).toBe(keys);
    expect(view.definition).toBe(definition);
    expect(view.matrixKeycodes).toBe(keycodes);
    expect(matrixStates[66]).toBe(Initial);
    expect([keys[spaceIndex].row, keys[spaceIndex].col]).toEqual([4, 5]);
  }
  expect(matrixCalls.every(([enabled, api, device, def]) =>
    enabled && api === inertAPI && device === selectedDevice && def === definition)).toBe(true);
  expect(ordinaryCalls).toEqual([false, false, false]);
});

test.each(['dos', 'spacetime'] as const)('%s ANSI and split/ISO states follow the actual definition', model => {
  definition = definitions[model];
  selectedDevice = {...selectedDevice, path: 'isolated-' + model, modelDefinitionId: model === 'dos' ? 'morgrie-dos68' : undefined};
  for (const option of [0, 1]) {
    keys = definition.layouts.keys.concat(...Object.values(definition.layouts.optionKeys).map(choices => choices[option] ?? []));
    matrixStates = Array.from({length: definition.matrix.rows * definition.matrix.cols}, (_, index) => index % 3);
    keycodes = keys.map(() => 4);
    const view = render();
    expect(view.pressedKeys).toEqual(keys.map(key => matrixStates[key.row * definition.matrix.cols + key.col]));
    expect(soundStates).toEqual(expectedSound());
    expect(view.keys).toBe(keys);
    expect(view.matrixKeycodes).toBe(keycodes);
  }
});

test('ordinary tester retains its own layout, browser states and sound mapping', () => {
  matrixEnabled = false;
  matrixStates.fill(KeyDown);
  ordinaryStates = ordinaryStates.map((_, index) => index % 3);
  const view = render();
  expect(view.definition).toBe(ordinaryDefinition);
  expect(view.keys).toBe(ordinaryDefinition.layouts.keys);
  expect(view.pressedKeys).toBe(ordinaryStates);
  expect(view.matrixKeycodes).toBe(matrixKeycodes);
  expect(soundStates).toEqual(expectedSound(ordinaryDefinition.layouts.keys as any, ordinaryStates, ordinaryDefinition.matrix.cols));
  expect(matrixCalls[0][0]).toBe(false);
  expect(ordinaryCalls).toEqual([true]);
});

test('disabled sound output stays absent without changing visual key states', () => {
  soundsEnabled = false;
  matrixStates[0] = KeyDown;
  expect(render().pressedKeys[0]).toBe(KeyDown);
  expect(soundStates).toBeUndefined();
});

test('leaving the tester requests neither ordinary nor matrix input', () => {
  route = '/settings';
  render();
  expect(matrixCalls[0][0]).toBe(false);
  expect(ordinaryCalls).toEqual([false]);
});
