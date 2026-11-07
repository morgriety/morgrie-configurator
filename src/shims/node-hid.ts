import type {
  AuthorizedDevice,
  ConnectedDevice,
  WebVIADevice,
} from '../types/types';

const lastWriteTimestamp: Record<string, number> = {};
const disconnectedPaths = new Set<string>();
const nativeListeners = new Map<string, {device: HIDDevice; handler: (event: HIDInputReportEvent) => void}>();
let monitoredHID: HID | undefined;
const monitorDisconnects = () => {
  if (monitoredHID === navigator.hid) return;
  monitoredHID = navigator.hid;
  navigator.hid.addEventListener?.('disconnect', ({device}) => {
    const path = (device as any).__path as string | undefined;
    if (!path) return;
    disconnectedPaths.add(path);
    delete (device as any).__path;
    const listener = nativeListeners.get(path);
    if (listener) listener.device.removeEventListener('inputreport', listener.handler);
    nativeListeners.delete(path);
    const error = new Error('HID device disconnected');
    (eventWaitBuffer[path] || []).splice(0).forEach((waiter) => waiter(undefined, error));
    globalBuffer[path] = [];
    inputReportHandlers[path] = [];
    delete lastWriteTimestamp[path];
  });
};
// This is a bit cray
const globalBuffer: {
  [path: string]: {currTime: number; message: Uint8Array}[];
} = {};
const eventWaitBuffer: {
  [path: string]: ((a?: Uint8Array, error?: Error) => void)[];
} = {};
type InputReportHandler = (message: Uint8Array) => boolean;
const inputReportHandlers: {
  [path: string]: InputReportHandler[];
} = {};
const filterHIDDevices = (devices: HIDDevice[]) =>
  devices.filter((device) =>
    device.collections?.some(
      (collection) =>
        collection.usage === 0x61 && collection.usagePage === 0xff60,
    ),
  );

export const QMK_CONSOLE_FILTER = {
  usagePage: 0xff31,
  usage: 0x74,
};

export const isQMKConsoleDevice = (device: HIDDevice) =>
  device.collections?.some(
    (collection) =>
      collection.usage === QMK_CONSOLE_FILTER.usage &&
      collection.usagePage === QMK_CONSOLE_FILTER.usagePage,
  ) ?? false;

const getVIAPathIdentifier = () =>
  (self.crypto && self.crypto.randomUUID && self.crypto.randomUUID()) ||
  `via-path:${Math.random()}`;

const tagDevice = (device: HIDDevice): WebVIADevice => {
  // This is super important in order to have a stable way to identify the same device
  // that was already scanned. It's a bit hacky but https://github.com/WICG/webhid/issues/7
  // ¯\_(ツ)_/¯
  const path = (device as any).__path || getVIAPathIdentifier();
  (device as any).__path = path;
  const HIDDevice = {
    _device: device,
    usage: 0x61,
    usagePage: 0xff60,
    interface: 0x0001,
    vendorId: device.vendorId ?? -1,
    productId: device.productId ?? -1,
    path,
    productName: device.productName,
  };
  return (ExtendedHID._cache[path] = HIDDevice);
};

// Attempt to forget device
export const tryForgetDevice = (device: ConnectedDevice | AuthorizedDevice) => {
  const cachedDevice = ExtendedHID._cache[device.path];
  if (cachedDevice) {
    return cachedDevice._device.forget();
  }
};

const ExtendedHID = {
  _cache: {} as {[key: string]: WebVIADevice},
  requestDevice: async () => {
    monitorDisconnects();
    const requestedDevice = await navigator.hid.requestDevice({
      filters: [
        {
          usagePage: 0xff60,
          usage: 0x61,
        },
        QMK_CONSOLE_FILTER,
      ],
    });
    const viaDevices = filterHIDDevices(requestedDevice);
    viaDevices.forEach(tagDevice);
    return viaDevices[0];
  },
  getFilteredDevices: async () => {
    monitorDisconnects();
    try {
      const hidDevices = filterHIDDevices(await navigator.hid.getDevices());
      return hidDevices;
    } catch (e) {
      return [];
    }
  },
  devices: async (requestAuthorize = false) => {
    let devices = await ExtendedHID.getFilteredDevices();
    // TODO: This is a hack to avoid spamming the requestDevices popup
    if (devices.length === 0 || requestAuthorize) {
      try {
        await ExtendedHID.requestDevice();
      } catch (e) {
        // The request seems to fail when the last authorized device is disconnected.
        return [];
      }
      devices = await ExtendedHID.getFilteredDevices();
    }
    return devices.map(tagDevice);
  },
  HID: class HID {
    _hidDevice?: WebVIADevice;
    interface: number = -1;
    vendorId: number = -1;
    productId: number = -1;
    productName: string = '';
    path: string = '';
    openPromise: Promise<void> = Promise.resolve();
    constructor(path: string) {
      this._hidDevice = ExtendedHID._cache[path];
      // TODO: seperate open attempt from constructor as it's async
      // Attempt to connect to the device

      if (this._hidDevice) {
        this.vendorId = this._hidDevice.vendorId;
        this.productId = this._hidDevice.productId;
        this.path = this._hidDevice.path;
        this.interface = this._hidDevice.interface;
        this.productName = this._hidDevice.productName;
        globalBuffer[this.path] = globalBuffer[this.path] || [];
        eventWaitBuffer[this.path] = eventWaitBuffer[this.path] || [];
        inputReportHandlers[this.path] = inputReportHandlers[this.path] || [];
        this.setupListeners();
        if (!this._hidDevice._device.opened) {
          this.open();
        }
      } else {
        throw new Error('Missing hid device in cache');
      }
    }
    async open() {
      if (this._hidDevice && !this._hidDevice._device.opened) {
        this.openPromise = this._hidDevice._device.open();
        this.setupListeners();
        await this.openPromise;
      }
      return Promise.resolve();
    }
    // Should we unsubscribe at some point of time
    setupListeners() {
      if (this._hidDevice && !nativeListeners.has(this.path)) {
        const handler = (e: HIDInputReportEvent) => {
          const message = new Uint8Array(e.data.buffer);
          const wasHandled = inputReportHandlers[this.path].some((handler) =>
            handler(message),
          );
          if (wasHandled) {
            return;
          }
          if (eventWaitBuffer[this.path].length !== 0) {
            // It should be impossible to have a handler in the buffer
            // that has a ts that happened after the current message
            // came in
            (eventWaitBuffer[this.path].shift() as any)(
              message,
            );
          } else {
            globalBuffer[this.path].push({
              currTime: Date.now(),
              message,
            });
          }
        };
        this._hidDevice._device.addEventListener('inputreport', handler);
        nativeListeners.set(this.path, {device: this._hidDevice._device, handler});
      }
    }

    addInputReportHandler(handler: InputReportHandler) {
      inputReportHandlers[this.path] = inputReportHandlers[this.path] || [];
      inputReportHandlers[this.path].push(handler);
      return () => {
        inputReportHandlers[this.path] = inputReportHandlers[this.path].filter(
          (registeredHandler) => registeredHandler !== handler,
        );
      };
    }

    read(fn: (err?: Error, data?: ArrayBuffer) => void) {
      if (disconnectedPaths.has(this.path)) {
        fn(new Error('HID device disconnected'));
        return;
      }
      this.fastForwardGlobalBuffer(lastWriteTimestamp[this.path] ?? 0);
      if (globalBuffer[this.path].length > 0) {
        // this should be a noop normally
        fn(undefined, globalBuffer[this.path].shift()?.message as any);
      } else {
        eventWaitBuffer[this.path].push((data, error) => fn(error, data));
      }
    }

    readP = promisify((arg: any) => this.read(arg));

    // The idea is discard any messages that have happened before the time a command was issued
    // since time-travel is not possible yet...
    fastForwardGlobalBuffer(time: number) {
      let messagesLeft = globalBuffer[this.path].length;
      while (messagesLeft) {
        messagesLeft--;
        // message in buffer happened before requested time
        if (globalBuffer[this.path][0].currTime < time) {
          globalBuffer[this.path].shift();
        } else {
          break;
        }
      }
    }

    async write(arr: number[], assertCurrent: () => void = () => {}) {
      assertCurrent();
      if (disconnectedPaths.has(this.path)) throw new Error('HID device disconnected');
      await this.openPromise;
      if (this._hidDevice && !this._hidDevice._device.opened) {
        await this.open();
      }
      assertCurrent();
      if (disconnectedPaths.has(this.path)) throw new Error('HID device disconnected');
      const data = new Uint8Array(arr.slice(1));
      lastWriteTimestamp[this.path] = Date.now();
      await this._hidDevice?._device.sendReport(0, data);
    }
  },
};

const promisify = (cb: Function) => () => {
  return new Promise((res, rej) => {
    cb((e: any, d: any) => {
      if (e) rej(e);
      else res(d);
    });
  });
};
export const HID = ExtendedHID;
