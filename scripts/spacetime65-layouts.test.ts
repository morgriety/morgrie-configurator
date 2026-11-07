/**
 * Software-only Spacetime65 layout regression tests. Run in their own process:
 * .\.tools\bun\bun-windows-x64\bun.exe test scripts/spacetime65-layouts.test.ts
 * The reader, definition/device reducers, selectors and bit packing are real.
 * Hardware, browser persistence and network boundaries throw if reached.
 * These fixtures do not represent a physically connected keyboard or prove
 * which layout encoding is installed in an existing device's firmware.
 */
import {describe, expect, mock, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {configureStore} from '@reduxjs/toolkit';
import {
  isKeyboardDefinitionV3,
  keyboardDefinitionV3ToVIADefinitionV3,
  type VIAKey,
} from '@the-via/reader';
import {
  bytesIntoNum,
  numIntoBytes,
  packBits,
  unpackBits,
} from '../src/utils/bit-pack';
import type {RootState} from '../src/store';
import type {ConnectedDevice} from '../src/types/types';

const forbiddenBoundary = () => {
  throw new Error('Layout tests must not access hardware, network or persistence');
};
const {KeyboardValue} = await import('../src/utils/keyboard-values');
mock.module('../src/utils/keyboard-api', () => ({
  KeyboardAPI: class {
    constructor() {
      forbiddenBoundary();
    }
  },
  KeyboardValue,
}));
mock.module('../src/utils/device-store', () => ({
  getMissingDefinition: forbiddenBoundary,
}));
mock.module('idb-keyval', () => ({
  entries: forbiddenBoundary,
  del: forbiddenBoundary,
  setMany: forbiddenBoundary,
  update: forbiddenBoundary,
}));

const devices = await import('../src/store/devicesSlice');
const definitions = await import('../src/store/definitionsSlice');
const source = JSON.parse(readFileSync(resolve(
  import.meta.dir,
  '../definitions/v3/morgrie/spacetime65/rkb65_via_v1_01_20261020.json',
), 'utf8'));
const definition = keyboardDefinitionV3ToVIADefinitionV3(source);
const device: ConnectedDevice = {
  path: 'software-only-spacetime65-layout-fixture',
  vendorId: 0xfffe,
  productId: 0x00b1,
  vendorProductId: 4294836401,
  productName: 'Software layout fixture; not physical hardware',
  protocol: 11,
  requiredDefinitionVersion: 'v3',
  hasResolvedDefinition: true,
};
type Options = [number, number, number];
const combinations: {name: string; options: Options}[] = [
  {name: '000', options: [0, 0, 0]},
  {name: '001', options: [0, 0, 1]},
  {name: '010', options: [0, 1, 0]},
  {name: '011', options: [0, 1, 1]},
  {name: '100', options: [1, 0, 0]},
  {name: '101', options: [1, 0, 1]},
  {name: '110', options: [1, 1, 0]},
  {name: '111', options: [1, 1, 1]},
];
function newStore(options?: Options) {
  const store = configureStore({
    reducer: {devices: devices.default, definitions: definitions.default},
  });
  store.dispatch(definitions.updateDefinitions({
    [device.vendorProductId]: {v3: definition},
  }));
  store.dispatch(devices.updateConnectedDevices({[device.path]: device}));
  store.dispatch(devices.selectDevice(device));
  if (options) {
    store.dispatch(definitions.updateLayoutOptions({[device.path]: options}));
  }
  return store;
}
const stateOf = (store: ReturnType<typeof newStore>) =>
  store.getState() as unknown as RootState;
const matrixId = (key: VIAKey) => `${key.row},${key.col}`;
const range = (last: number, first = 0) =>
  Array.from({length: last - first + 1}, (_, index) => index + first);

// Independent matrix inventory from the approved PCB layout. Empty matrix
// cells are intentional; a 5x16 electrical matrix does not imply 80 keys.
const baseMatrixRows = [
  [...range(12), 15],
  [...range(12), 15],
  [...range(11), 15],
  range(13, 2),
  [0, 1, 2, 6, 10, 11, 12, 13, 15],
];
function expectedMatrix([iso, shift, backspace]: Options) {
  return baseMatrixRows.flatMap((cols, row) => cols.map((col) => `${row},${col}`))
    .concat(iso ? ['2,13', '2,12'] : ['1,13', '2,13'])
    .concat(shift ? ['3,0', '3,1'] : ['3,0'])
    .concat(backspace ? ['0,13', '0,14'] : ['0,14'])
    .sort();
}

type Rect = [number, number, number, number];
const rectangles = (key: VIAKey): Rect[] => [
  [key.x, key.y, key.w, key.h],
  ...(key.w2 !== undefined && key.h2 !== undefined
    ? [[key.x + (key.x2 ?? 0), key.y + (key.y2 ?? 0), key.w2, key.h2] as Rect]
    : []),
];
const intersects = (a: Rect, b: Rect) =>
  Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]) > 1e-8 &&
  Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]) > 1e-8;
function keyAt(keys: VIAKey[], row: number, col: number) {
  const key = keys.find((candidate) => candidate.row === row && candidate.col === col);
  expect(key).toBeDefined();
  return key!;
}

describe('Spacetime65 20261020 effective layouts', () => {
  test('accepts the exact three-option v3 definition and its 16x5u envelope', () => {
    expect(isKeyboardDefinitionV3(source)).toBe(true);
    expect(definition.layouts.labels).toEqual([
      'ISO Enter', 'Splite Left Shift', 'Splite Backspace',
    ]);
    expect(definition.matrix).toEqual({rows: 5, cols: 16});
    expect(definition.layouts.keys).toHaveLength(62);
    expect([definition.layouts.width, definition.layouts.height]).toEqual([16, 5]);
  });

  test('defaults to three zero choices when no device layout map is present', () => {
    const state = stateOf(newStore());
    expect(definitions.getSelectedLayoutOptions(state)).toEqual([0, 0, 0]);
    expect(definitions.getSelectedKeyDefinitions(state).map(matrixId).sort())
      .toEqual(expectedMatrix([0, 0, 0]));
  });

  for (const {name, options} of combinations) {
    test(`${name}: selects the exact matrix inventory without duplicates or missing keys`, () => {
      const store = newStore(options);
      const state = stateOf(store);
      const keys = definitions.getSelectedKeyDefinitions(state);
      expect(definitions.getSelectedLayoutOptions(state)).toEqual(options);
      expect(keys).toHaveLength(66 + options[1] + options[2]);
      expect(keys.map(matrixId).sort()).toEqual(expectedMatrix(options));
      expect(new Set(keys.map(matrixId)).size).toBe(keys.length);
      expect(keys.filter((key) =>
        !Number.isInteger(key.row) || !Number.isInteger(key.col) ||
        key.row < 0 || key.row >= 5 || key.col < 0 || key.col >= 16,
      )).toEqual([]);
    });

    test(`${name}: preserves the intended optional shapes without inter-key overlap`, () => {
      const keys = definitions.getSelectedKeyDefinitions(stateOf(newStore(options)));
      const [iso, shift, backspace] = options;
      expect(rectangles(keyAt(keys, 2, 13))).toEqual(iso
        ? [[13.75, 1, 1.25, 2], [13.5, 1, 1.5, 1]]
        : [[12.75, 2, 2.25, 1]]);
      expect(rectangles(keyAt(keys, iso ? 2 : 1, iso ? 12 : 13)))
        .toEqual(iso ? [[12.75, 2, 1, 1]] : [[13.5, 1, 1.5, 1]]);
      expect(rectangles(keyAt(keys, 3, 0)))
        .toEqual([[0, 3, shift ? 1.25 : 2.25, 1]]);
      if (shift) {
        expect(rectangles(keyAt(keys, 3, 1))).toEqual([[1.25, 3, 1, 1]]);
      }
      expect(rectangles(keyAt(keys, 0, 14)))
        .toEqual([[backspace ? 14 : 13, 0, backspace ? 1 : 2, 1]]);
      if (backspace) {
        expect(rectangles(keyAt(keys, 0, 13))).toEqual([[13, 0, 1, 1]]);
      }
      const overlaps: string[][] = [];
      keys.forEach((key, index) => {
        // All supplied shapes are axis-aligned. Do not use an ISO key's
        // bounding box: its cutout is occupied by a separate valid key.
        expect(key.r).toBe(0);
        for (const [x, y, width, height] of rectangles(key)) {
          expect(width > 0 && height > 0 && x >= 0 && y >= 0 &&
            x + width <= 16 && y + height <= 5).toBe(true);
        }
        for (const other of keys.slice(index + 1)) {
          if (rectangles(key).some((a) => rectangles(other).some((b) => intersects(a, b)))) {
            overlaps.push([matrixId(key), matrixId(other)]);
          }
        }
      });
      expect(overlaps).toEqual([]);
    });

    test(`${name}: round-trips the unchanged three-bit wire encoding and selector state`, () => {
      const raw = packBits(options.map((choice) => [choice, 2]));
      expect(raw).toBe(options[0] * 4 + options[1] * 2 + options[2]);
      expect(numIntoBytes(raw)).toEqual([0, 0, 0, raw]);
      const decoded = unpackBits(bytesIntoNum(numIntoBytes(raw)), [2, 2, 2]);
      expect(decoded).toEqual(options);
      const store = newStore();
      store.dispatch(definitions.updateLayoutOptions({[device.path]: decoded}));
      expect(definitions.getSelectedLayoutOptions(stateOf(store))).toEqual(options);
      expect(definitions.getSelectedKeyDefinitions(stateOf(store)).map(matrixId).sort())
        .toEqual(expectedMatrix(options));
    });
  }
});

describe('Spacetime65 historical raw layout interpretation (no migration)', () => {
  const cases = [
    {raw: 0, old: [0, 0], current: [0, 0, 0]},
    {raw: 1, old: [0, 1], current: [0, 0, 1]},
    {raw: 2, old: [1, 0], current: [0, 1, 0]},
    {raw: 3, old: [1, 1], current: [0, 1, 1]},
  ];
  for (const entry of cases) {
    test(`raw ${entry.raw}: documents the old and current interpretation`, () => {
      expect(unpackBits(entry.raw, [2, 2])).toEqual(entry.old);
      expect(unpackBits(entry.raw, [2, 2, 2])).toEqual(entry.current);
      expect(packBits(entry.old.map((choice) => [choice, 2]))).toBe(entry.raw);
      expect(packBits(entry.current.map((choice) => [choice, 2]))).toBe(entry.raw);
    });
  }
});
