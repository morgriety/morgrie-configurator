import {describe, expect, mock, test} from 'bun:test';
// Software fakes only: no hardware or native HID calls.
mock.module('../src/store/index', () => ({store: {dispatch: () => {}}}));
mock.module('../src/utils/command-logger', () => ({logCommand: () => {}}));
mock.module('../src/store/errorsSlice', () => ({extractDeviceInfo: () => ({}), getMessageFromError: String, logAppError: (x: unknown) => x, logKeyboardAPIError: (x: unknown) => x}));
const transports = new Map<string, any>();
mock.module('../src/utils/usb-hid', () => ({initAndConnectDevice: ({path}: {path: string}) => transports.get(path)}));
const {KeyboardAPI} = await import('../src/utils/keyboard-api');
const deferred = () => {let resolve!: (value?: any) => void; const promise = new Promise<any>(r => resolve = r); return {promise, resolve};};
function fake(path: string) {
  const reports: number[][] = [];
  let reply: number[] = [];
  const transport = {write: async (bytes: number[]) => {reports.push(bytes); reply = bytes.slice(1);}, readP: async () => Uint8Array.from(reply)};
  transports.set(path, transport);
  return {transport, reports};
}
describe('per-operation transport queue isolation', () => {
  test('invalidated queued operation never sends, while newer operation on same path works', async () => {
    const {transport, reports} = fake('queue-instance');
    const pending = deferred(); let first = true;
    transport.readP = async () => {if (first) {first = false; await pending.promise;} return Uint8Array.from(reports.at(-1)!.slice(1));};
    let current = true;
    const oldApi = new KeyboardAPI('queue-instance', () => current);
    const active = oldApi.hidCommand(0x02, [1]);
    const queued = oldApi.hidCommand(0x03, [2]).then(() => 'sent', () => 'cancelled');
    await Promise.resolve(); current = false;
    const latest = new KeyboardAPI('queue-instance', () => true).hidCommand(0x02, [3]);
    const activeResult = active.then(() => 'accepted', () => 'cancelled');
    pending.resolve();
    expect(await queued).toBe('cancelled');
    expect(await activeResult).toBe('cancelled');
    await latest;
    expect(reports.map(r => r.slice(1, 3))).toEqual([[2, 1], [2, 3]]);
  });
  test('batch stops before subsequent chunks after selection changes', async () => {
    const {transport, reports} = fake('batch-instance'); let current = true;
    transport.readP = async () => {current = false; return Uint8Array.from(reports.at(-1)!.slice(1));};
    const api = new KeyboardAPI('batch-instance', () => current);
    await expect(api.fastWriteRawMatrix([Array(40).fill(4)])).rejects.toThrow();
    expect(reports).toHaveLength(1);
  });
  test('two same-model instances retain independent queues', async () => {
    const a = fake('same-model-a'); const b = fake('same-model-b');
    await Promise.all([new KeyboardAPI('same-model-a', () => true).hidCommand(2, [1]), new KeyboardAPI('same-model-b', () => true).hidCommand(2, [2])]);
    expect(a.reports[0][2]).toBe(1); expect(b.reports[0][2]).toBe(2);
  });
});


test('cancelled matrix session never sends a queued read even on the same selected device', async () => {
  const {transport, reports} = fake('same-device-matrix-runs');
  const pending = deferred();
  let first = true;
  transport.readP = async () => {
    if (first) {
      first = false;
      await pending.promise;
    }
    return Uint8Array.from(reports.at(-1)!.slice(1));
  };
  let connected = true;
  const device = new KeyboardAPI('same-device-matrix-runs', () => connected);
  const priorCommand = device.getKeyboardValue(1, [], 4);
  let oldSessionActive = true;
  const old = device.whileCurrent(() => oldSessionActive);
  const stale = old.getKeyboardValue(3, [0], 10).catch(() => 'cancelled');
  oldSessionActive = false;
  const current = device.whileCurrent(() => true);
  const fresh = current.getKeyboardValue(3, [0], 10);
  pending.resolve();
  await priorCommand;
  expect(await stale).toBe('cancelled');
  expect(await fresh).toHaveLength(10);
  connected = false;
  await expect(current.getKeyboardValue(3, [0], 10)).rejects.toThrow();
  expect(reports.map(report => report.slice(1, 3))).toEqual([[2, 1], [2, 3]]);
});
