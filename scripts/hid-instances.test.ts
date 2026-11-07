import {expect, test} from 'bun:test';
import {HID} from '../src/shims/node-hid';
const devices: any[] = [];
const hidListeners: Record<string, Function> = {};
Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {hid: {
  getDevices: async () => devices, addEventListener: (name: string, fn: Function) => hidListeners[name] = fn,
}}});
let n = 0;
function fake(collections = [{usagePage: 0xff60, usage: 0x61}]) {
  const listeners: Record<string, Function> = {};
  const device = {vendorId: 65534, productId: 108, productName: 'DOS 68', collections, opened: false,
    open: async () => {device.opened = true;}, sendReport: async () => {sent++;},
    addEventListener: (name: string, fn: Function) => listeners[name] = fn,
    removeEventListener: (name: string) => delete listeners[name]};
  let sent = 0;
  return {device, listeners, sent: () => sent};
}
test('consumer interface excluded; same-model instances have different paths', async () => {
  const a=fake(), b=fake(), consumer=fake([{usagePage: 12, usage: 1}]);
  devices.splice(0, devices.length, a.device, consumer.device, b.device);
  const found=await HID.devices();
  expect(found).toHaveLength(2); expect(found[0].path).not.toBe(found[1].path);
});
test('another instance write timestamp cannot discard buffered response', async () => {
  const a=fake(), b=fake(); devices.splice(0, devices.length, a.device, b.device);
  const found=await HID.devices(); const apiA=new HID.HID(found[0].path), apiB=new HID.HID(found[1].path);
  await apiA.write([0, 2]); a.listeners.inputreport({data:new DataView(Uint8Array.from([2, 5]).buffer)});
  await new Promise(r=>setTimeout(r, 8)); await apiB.write([0, 3]);
  expect(await Promise.race([apiA.readP(), new Promise(r=>setTimeout(()=>r('discarded'),30))])).toEqual(Uint8Array.from([2,5]));
});
test('operation invalidated while HID opens cannot send', async () => {
  const a=fake(); let release!:()=>void;
  a.device.open=()=>new Promise<void>(r=>release=()=>{a.device.opened=true;r();});
  devices.splice(0,devices.length,a.device);
  const [found]=await HID.devices(); const api=new HID.HID(found.path);
  let current=true; const write=api.write([0,3],()=>{if(!current)throw Error('expired');});
  current=false; release();
  await expect(write).rejects.toThrow(); expect(a.sent()).toBe(0);
});
test('disconnect rejects pending read and reconnect creates a fresh instance', async () => {
  const a=fake(); devices.splice(0,devices.length,a.device);
  const [found]=await HID.devices(); const api=new HID.HID(found.path);
  const pending=api.readP().then(()=>false,()=>true);
  hidListeners.disconnect?.({device:a.device});
  expect(await Promise.race([pending,new Promise(r=>setTimeout(()=>r(false),30))])).toBe(true);
  const [next]=await HID.devices(); expect(next.path).not.toBe(found.path);
});

