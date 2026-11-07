import {isManagedVendorProductId} from './model-definitions';
const instanceKeys = new WeakMap<HIDDevice, string>();
let nextInstance = 0;
export function consoleDeviceKey(device: HIDDevice) {
  let key = instanceKeys.get(device);
  if (!key) { key = `console-instance:${++nextInstance}`; instanceKeys.set(device, key); }
  return key;
}
export function autoFollowConsoleDevice(
  devices: HIDDevice[],
  selected: {vendorId: number; productId: number},
) {
  // A configuration-interface match does not prove console-interface identity.
  if (isManagedVendorProductId(selected.vendorId * 65536 + selected.productId)) return undefined;
  const matches = devices.filter(d => d.vendorId === selected.vendorId && d.productId === selected.productId);
  return matches.length === 1 ? matches[0] : undefined;
}
