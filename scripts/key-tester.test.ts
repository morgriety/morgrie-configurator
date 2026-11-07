import {afterEach, beforeEach, expect, mock, test} from 'bun:test';
import {KeyboardValue} from '../src/utils/keyboard-values';

// Run this file in its own Bun process: React hooks and browser events are
// replaced by a deterministic effect harness. No DOM, USB, network or writes.
type Effect = {deps?: unknown[]; cleanup?: () => void};
type Slot = {value: any};
let active: HookHarness;
class HookHarness {
  slots: Slot[] = [];
  effects = new Map<number, Effect>();
  pending: {index: number; effect: () => void | (() => void); deps?: unknown[]}[] = [];
  cursor = 0;
  updates = 0;
  render<T>(fn: () => T): T {
    active = this;
    this.cursor = 0;
    this.pending = [];
    const value = fn();
    for (const item of this.pending) this.effects.get(item.index)?.cleanup?.();
    for (const item of this.pending) {
      const cleanup = item.effect();
      this.effects.set(item.index, {deps: item.deps, cleanup: cleanup || undefined});
    }
    return value;
  }
  unmount() {
    for (const effect of this.effects.values()) effect.cleanup?.();
    this.effects.clear();
  }
}
mock.module('react', () => ({
  useState: (initial: any) => {
    const harness = active, index = harness.cursor++;
    const slot = harness.slots[index] ??= {value: typeof initial === 'function' ? initial() : initial};
    return [slot.value, (next: any) => {
      slot.value = typeof next === 'function' ? next(slot.value) : next;
      harness.updates++;
    }];
  },
  useRef: (initial: any) => {
    const index = active.cursor++;
    return (active.slots[index] ??= {value: {current: initial}}).value;
  },
  useEffect: (effect: () => void | (() => void), deps?: unknown[]) => {
    const index = active.cursor++;
    const previous = active.effects.get(index);
    if (!previous || !deps || deps.some((dep, i) => !Object.is(dep, previous.deps?.[i]))) {
      active.pending.push({index, effect, deps});
    }
  },
}));
const dispatched: any[] = [];
const dispatch = (action: any) => dispatched.push(action);
mock.module('react-redux', () => ({useDispatch: () => dispatch}));
mock.module('../src/store/settingsSlice', () => ({
  setTestMatrixEnabled: (payload: boolean) => ({type: 'test/matrix', payload}),
}));
mock.module('../src/utils/keyboard-api', () => ({
  KeyboardValue,
  PROTOCOL_GAMMA: 9,
  KeyboardAPI: class {constructor() {throw new Error('Real API forbidden in isolated test');}},
}));
mock.module('../src/components/void/test-keyboard-sounds', () => ({
  TestKeyboardSoundsMode: {WickiHayden: 0, Chromatic: 1, Random: 2},
}));
const {useGlobalKeys} = await import('../src/utils/use-global-keys');
const {useMatrixTest} = await import('../src/utils/use-matrix-test');
const {getIndexByEvent} = await import('../src/utils/key-event');
const {TestKeyState} = await import('../src/types/types');

const listeners = new Map<string, Set<(event: any) => void>>();
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const windowFake = {
  addEventListener: (type: string, handler: (event: any) => void) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type)!.add(handler);
  },
  removeEventListener: (type: string, handler: (event: any) => void) => listeners.get(type)?.delete(handler),
};
const event = (code: string, repeat = false) => ({
  code, key: code, repeat, prevented: false,
  preventDefault() {this.prevented = true;},
});
const emit = (type: string, value = event('KeyA')) => {
  for (const handler of listeners.get(type) ?? []) handler(value);
  return value;
};
const count = (type: string) => listeners.get(type)?.size ?? 0;
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => {resolve = r;});
  return {promise, resolve};
};
const flush = async () => {for (let i = 0; i < 12; i++) await Promise.resolve();};
const definition = (rows = 2, cols = 10) => ({matrix: {rows, cols}} as any);
const device = (protocol = 12) => ({protocol, path: 'isolated-test-only'} as any);
class ReadOnlyAPI {
  calls: {command: number; payload: number[]; size: number}[] = [];
  pauses: ReturnType<typeof deferred<void>>[] = [];
  constructor(readonly responses: (number[] | Error | Promise<number[]>)[] = []) {}
  whileCurrent(_isActive: () => boolean) { return this; } // Queue guards are covered in transport-isolation.test.ts.
  async getKeyboardValue(command: number, payload: number[], size: number) {
    this.calls.push({command, payload, size});
    const response = await (this.responses.shift() ?? Array(size).fill(0));
    if (response instanceof Error) throw response;
    return response;
  }
  timeout(_ms: number) {
    const pause = deferred<void>();
    this.pauses.push(pause);
    return pause.promise;
  }
}
let harness: HookHarness;
beforeEach(() => {
  harness = new HookHarness();
  listeners.clear();
  dispatched.length = 0;
  Object.defineProperty(globalThis, 'window', {configurable: true, value: windowFake});
});
afterEach(() => {
  harness.unmount();
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else delete (globalThis as any).window;
});

test('normal test installs one listener pair and records press/release using existing key mapping', () => {
  harness.render(() => useGlobalKeys(true));
  expect([count('keydown'), count('keyup')]).toEqual([1, 1]);
  const down = emit('keydown', event('KeyA'));
  const index = getIndexByEvent(down as any);
  expect(index).toBeGreaterThanOrEqual(0);
  expect(harness.slots[0].value[index]).toBe(TestKeyState.KeyDown);
  expect(down.prevented).toBe(true);
  emit('keyup', event('KeyA'));
  expect(harness.slots[0].value[index]).toBe(TestKeyState.KeyUp);
});

test('normal test ignores repeated keydown and does not install duplicate listeners on rerender', () => {
  harness.render(() => useGlobalKeys(true));
  emit('keydown', event('KeyA', true));
  expect(harness.updates).toBe(0);
  harness.render(() => useGlobalKeys(true));
  expect([count('keydown'), count('keyup')]).toEqual([1, 1]);
});

test('normal mode disable and unmount remove listeners without consuming later key events', () => {
  harness.render(() => useGlobalKeys(true));
  harness.render(() => useGlobalKeys(false));
  expect([count('keydown'), count('keyup')]).toEqual([0, 0]);
  expect(emit('keydown').prevented).toBe(false);
  harness.render(() => useGlobalKeys(true));
  harness.unmount();
  expect([count('keydown'), count('keyup')]).toEqual([0, 0]);
});

test('normal clear state setter removes previous feedback', () => {
  const [, clear] = harness.render(() => useGlobalKeys(true));
  emit('keydown');
  clear([]);
  expect(harness.slots[0].value).toEqual([]);
});

test('inactive matrix mode makes no read and registers no keyboard listeners', async () => {
  const api = new ReadOnlyAPI();
  harness.render(() => useMatrixTest(false, api as any, device(), definition()));
  await flush();
  expect(api.calls).toEqual([]);
  expect([count('keydown'), count('keyup')]).toEqual([0, 0]);
});

test('matrix bytes decode row/column positions and retain triggered state on release', async () => {
  const api = new ReadOnlyAPI([[1, 1, 2, 0], [0, 0, 0, 0]]);
  harness.render(() => useMatrixTest(true, api as any, device(), definition()));
  await flush();
  expect(api.calls).toEqual([{command: KeyboardValue.SWITCH_MATRIX_STATE, payload: [0], size: 4}]);
  const pressed = harness.slots[0].value;
  expect(pressed).toHaveLength(20);
  expect(pressed.map((s: number, i: number) => s === TestKeyState.KeyDown ? i : -1).filter((i: number) => i >= 0)).toEqual([0, 8, 19]);
  api.pauses[0].resolve();
  await flush();
  expect([0, 8, 19].map(i => harness.slots[0].value[i])).toEqual(Array(3).fill(TestKeyState.KeyUp));
});

test('matrix protocol 11 retains legacy payload and later protocols chunk large matrices by row', async () => {
  const legacy = new ReadOnlyAPI();
  harness.render(() => useMatrixTest(true, legacy as any, device(11), definition()));
  await flush();
  expect(legacy.calls[0].payload).toEqual([]);
  harness.unmount();
  harness = new HookHarness();
  const modern = new ReadOnlyAPI();
  harness.render(() => useMatrixTest(true, modern as any, device(12), definition(30, 16)));
  await flush();
  expect(modern.calls).toEqual([
    {command: KeyboardValue.SWITCH_MATRIX_STATE, payload: [0], size: 28},
    {command: KeyboardValue.SWITCH_MATRIX_STATE, payload: [14], size: 28},
    {command: KeyboardValue.SWITCH_MATRIX_STATE, payload: [28], size: 4},
  ]);
});

test('matrix disable removes listeners and stops a polling cycle waiting at its normal pause', async () => {
  const api = new ReadOnlyAPI();
  const def = definition();
  harness.render(() => useMatrixTest(true, api as any, device(), def));
  await flush();
  expect(emit('keydown').prevented).toBe(true);
  expect(emit('keyup').prevented).toBe(true);
  harness.render(() => useMatrixTest(false, api as any, device(), def));
  expect([count('keydown'), count('keyup')]).toEqual([0, 0]);
  api.pauses[0].resolve();
  await flush();
  expect(api.calls).toHaveLength(1);
  expect(emit('keydown').prevented).toBe(false);
});

test('matrix unmount stops a paused cycle and removes both listeners', async () => {
  const api = new ReadOnlyAPI();
  harness.render(() => useMatrixTest(true, api as any, device(), definition()));
  await flush();
  harness.unmount();
  api.pauses[0].resolve();
  await flush();
  expect(api.calls).toHaveLength(1);
  expect([count('keydown'), count('keyup')]).toEqual([0, 0]);
});

test('matrix read errors request existing ordinary-test fallback without retrying', async () => {
  const api = new ReadOnlyAPI([new Error('isolated read failure')]);
  harness.render(() => useMatrixTest(true, api as any, device(), definition()));
  await flush();
  expect(dispatched).toEqual([{type: 'test/matrix', payload: false}]);
  expect(api.calls).toHaveLength(1);
  expect(api.pauses).toHaveLength(0);
});

test('normal Shift events with physical code or side location press and release separate keys', () => {
  harness.render(() => useGlobalKeys(true));
  for (const code of ['ShiftRight', '', 'Unidentified']) {
    const right = {...event(code), key: 'Shift', location: 2};
    const left = {...event(code === 'ShiftRight' ? 'ShiftLeft' : code), key: 'Shift', location: 1};
    expect(getIndexByEvent(right as any)).toBe(89);
    expect(getIndexByEvent(left as any)).toBe(78);
    emit('keydown', left);
    emit('keydown', right);
    emit('keyup', right);
    expect(harness.slots[0].value[89]).toBe(TestKeyState.KeyUp);
    expect(harness.slots[0].value[78]).toBe(TestKeyState.KeyDown);
    emit('keyup', left);
  }
  const unknown = {...event('Unidentified'), key: 'Shift', location: 0};
  expect(getIndexByEvent(unknown as any)).toBe(-1);
  emit('keydown', unknown);
  expect(harness.slots[0].value[-1]).toBeUndefined();
});

test('stale chunk response after stop/start cannot send another request or update new keys', async () => {
  const delayed = deferred<number[]>();
  const old = new ReadOnlyAPI([delayed.promise]);
  const next = new ReadOnlyAPI();
  const def = definition(30, 16);
  const target = device();
  harness.render(() => useMatrixTest(true, old as any, target, def));
  harness.render(() => useMatrixTest(false, old as any, target, def));
  harness.render(() => useMatrixTest(true, next as any, target, def));
  await flush();
  const updates = harness.updates;
  delayed.resolve(Array(28).fill(255));
  await flush();
  expect(old.calls).toHaveLength(1);
  expect(old.pauses).toHaveLength(0);
  expect(harness.updates).toBe(updates);
  expect(dispatched).toEqual([]);
});

test('a pending timer from a previous run never starts a second poller on rapid restart', async () => {
  const api = new ReadOnlyAPI();
  const def = definition(), target = device();
  harness.render(() => useMatrixTest(true, api as any, target, def));
  await flush();
  harness.render(() => useMatrixTest(false, api as any, target, def));
  harness.render(() => useMatrixTest(true, api as any, target, def));
  await flush();
  api.pauses[0].resolve();
  await flush();
  expect(api.calls).toHaveLength(2);
  api.pauses[1].resolve();
  await flush();
  expect(api.calls).toHaveLength(3);
});

test('rejection from a replaced device cannot turn off the new matrix session', async () => {
  const delayed = deferred<number[]>();
  const old = new ReadOnlyAPI([delayed.promise.then(() => {throw Error('disconnected');})]);
  const next = new ReadOnlyAPI();
  const def = definition();
  harness.render(() => useMatrixTest(true, old as any, device(), def));
  harness.render(() => useMatrixTest(true, next as any, {...device(), path: 'device-B'}, def));
  delayed.resolve([]);
  await flush();
  expect(dispatched).toEqual([]);
  next.pauses[0].resolve();
  await flush();
  expect(next.calls).toHaveLength(2);
});

test('unmount with pending matrix data cannot schedule or update state', async () => {
  const delayed = deferred<number[]>();
  const api = new ReadOnlyAPI([delayed.promise]);
  harness.render(() => useMatrixTest(true, api as any, device(), definition()));
  harness.unmount();
  const updates = harness.updates;
  delayed.resolve([1, 0, 0, 0]);
  await flush();
  expect(harness.updates).toBe(updates);
  expect(api.pauses).toHaveLength(0);
});

test('AIR68 definition-declared coordinates project synthetic frames, independent of layer', async () => {
  const {keyboardDefinitionV3ToVIADefinitionV3} = await import('@the-via/reader');
  const {default: source} = await import('../definitions/v3/morgrie/air68/Morgrie_Air68_via_v1_02_20250904.json');
  const def = keyboardDefinitionV3ToVIADefinitionV3(source as any);
  const keys = def.layouts.keys;
  const space = keys.find(key => key.w === 6.25)!;
  const rightShift = keys.find(key => key.row === 3 && key.col === 12)!;
  expect([keys.indexOf(space), space.row, space.col]).toEqual([61, 4, 5]);
  expect([keys.indexOf(rightShift), rightShift.w]).toEqual([55, 2]);
  const matrixIndex = (key: typeof space) => key.row * def.matrix.cols + key.col;
  expect([matrixIndex(space), matrixIndex(rightShift)]).toEqual([65, 57]);
  // Synthetic frames target the declared coordinates; this does not assert hardware scan wiring.
  const api = new ReadOnlyAPI([
    [0, 0, 0, 0, 0, 0, 0x10, 0, 0, 0],
    Array(10).fill(0),
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0x20],
    Array(10).fill(0),
  ]);
  harness.render(() => useMatrixTest(true, api as any, device(12), def));
  const {Initial, KeyDown, KeyUp} = TestKeyState;
  // Mirror Key Tester's matrix-to-visible-key projection; only the active key may go down.
  const expected = [[Initial, KeyDown], [Initial, KeyUp], [KeyDown, KeyUp], [KeyUp, KeyUp]];
  for (const [frame, states] of expected.entries()) {
    if (frame > 0) api.pauses[frame - 1].resolve();
    await flush();
    const projected = keys.map(key => harness.slots[0].value[matrixIndex(key)]);
    expect([projected[61], projected[55]]).toEqual(states);
    expect(projected.filter(state => state === KeyDown)).toHaveLength(frame % 2 === 0 ? 1 : 0);
  }
  expect(api.calls).toEqual(Array(4).fill({
    command: KeyboardValue.SWITCH_MATRIX_STATE, payload: [0], size: 10,
  }));
});


test('releasing a held key after Reset still shows a release, not a new press', async () => {
  const api = new ReadOnlyAPI([[0, 1, 0, 0], [0, 0, 0, 0]]);
  const [, reset] = harness.render(() => useMatrixTest(true, api as any, device(), definition()));
  await flush();
  reset([]);
  api.pauses[0].resolve();
  await flush();
  expect(harness.slots[0].value[0]).toBe(TestKeyState.KeyUp);
});

test('losing the current matrix target returns to normal mode once without stale reads', async () => {
  const delayed = deferred<number[]>();
  const api = new ReadOnlyAPI([delayed.promise]);
  harness.render(() => useMatrixTest(true, api as any, device(), definition()));
  harness.render(() => useMatrixTest(true));
  delayed.resolve([0, 1, 0, 0]);
  await flush();
  expect(dispatched).toEqual([{type: 'test/matrix', payload: false}]);
  expect(api.pauses).toHaveLength(0);
});

test('legacy matrix fits 30 payload bytes in a single report and never repeats the first block', async () => {
  const api = new ReadOnlyAPI();
  harness.render(() => useMatrixTest(true, api as any, device(11), definition(15, 16)));
  await flush();
  expect(api.calls).toEqual([{command: KeyboardValue.SWITCH_MATRIX_STATE, payload: [], size: 30}]);
  const tooLarge = new ReadOnlyAPI();
  harness.render(() => useMatrixTest(true, tooLarge as any, device(11), definition(16, 16)));
  await flush();
  expect(tooLarge.calls).toEqual([]);
  expect(dispatched).toEqual([{type: 'test/matrix', payload: false}]);
});

test('zero DOS68 reports do not highlight a key or trigger a fallback', async () => {
  const zero = Array(10).fill(0);
  const api = new ReadOnlyAPI([zero, zero]);
  harness.render(() => useMatrixTest(true, api as any, device(12), definition(5, 16)));
  await flush();
  api.pauses[0].resolve();
  await flush();
  expect(api.calls).toHaveLength(2);
  expect(api.calls[0]).toEqual({command: KeyboardValue.SWITCH_MATRIX_STATE, payload: [0], size: 10});
  expect(harness.slots[0].value).toEqual([]);
  expect(dispatched).toEqual([]);
});

// User-supplied event/payload values are replayed in isolation. Their physical
// key origin was not timestamped, so these cases must not infer a remapping.
test('reported generic Shift has no side even after an identified left Shift', () => {
  harness.render(() => useGlobalKeys(true));
  const left = {...event('ShiftLeft'), key: 'Shift', location: 1};
  const generic = {...event(''), key: 'Shift', location: 0};
  expect(getIndexByEvent(left as any)).toBe(78);
  expect(getIndexByEvent(generic as any)).toBe(-1);
  emit('keydown', left);
  const before = harness.updates;
  emit('keydown', generic);
  emit('keyup', generic);
  expect(harness.updates).toBe(before);
  expect(harness.slots[0].value[78]).toBe(TestKeyState.KeyDown);
  expect(harness.slots[0].value[89]).toBeUndefined();
  emit('keyup', left);
  const released = harness.updates;
  emit('keydown', generic);
  emit('keyup', generic);
  expect(harness.updates).toBe(released);
  expect(harness.slots[0].value[78]).toBe(TestKeyState.KeyUp);
  expect(harness.slots[0].value[89]).toBeUndefined();
});

test('reported AIR68 0x40 frame maps to row 4 column 6 without aliasing Space', async () => {
  const {keyboardDefinitionV3ToVIADefinitionV3} = await import('@the-via/reader');
  const {default: source} = await import('../definitions/v3/morgrie/air68/Morgrie_Air68_via_v1_02_20250904.json');
  const def = keyboardDefinitionV3ToVIADefinitionV3(source as any);
  const keys = def.layouts.keys;
  expect(def.matrix).toEqual({rows: 5, cols: 15});
  expect(keys.find(key => key.w === 6.25)).toMatchObject({row: 4, col: 5});
  expect(keys.some(key => key.row === 4 && key.col === 6)).toBe(false);
  // Only the 0x40 payload is from the report. The following zero frame is a
  // synthetic release to check state handling, not claimed hardware evidence.
  const api = new ReadOnlyAPI([
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0x40], Array(10).fill(0),
  ]);
  harness.render(() => useMatrixTest(true, api as any, device(12), def));
  await flush();
  const pressed = harness.slots[0].value;
  expect(pressed.flatMap((state: number, index: number) =>
    state === TestKeyState.KeyDown ? [index] : [])).toEqual([66]);
  expect(pressed[65]).toBe(TestKeyState.Initial);
  expect(keys.map(key => pressed[key.row * def.matrix.cols + key.col])
    .every(state => state === TestKeyState.Initial)).toBe(true);
  api.pauses[0].resolve();
  await flush();
  expect(harness.slots[0].value[66]).toBe(TestKeyState.KeyUp);
  expect(harness.slots[0].value[65]).toBe(TestKeyState.Initial);
  expect(dispatched).toEqual([]);
});
