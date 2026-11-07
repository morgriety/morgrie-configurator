import {getDefinitionKey, isManagedVendorProductId, type ModelDeviceIdentity} from './model-definitions';

type BackupDevice = ModelDeviceIdentity & {vendorProductId: number};
export const getBackupModelId = (device: BackupDevice) =>
  device.modelDefinitionId ?? `via:${getDefinitionKey(device)}`;

export function assertBackupTarget(
  backup: {vendorProductId: number; modelDefinitionId?: string},
  device: BackupDevice,
) {
  if (backup.vendorProductId !== device.vendorProductId) {
    throw new Error('This backup belongs to a different keyboard.');
  }
  if (isManagedVendorProductId(device.vendorProductId) && !backup.modelDefinitionId) {
    throw new Error('This legacy shared-USB-ID backup has no verified model identity. It cannot be imported automatically; the backup has not been changed.');
  }
  if (backup.modelDefinitionId && backup.modelDefinitionId !== getBackupModelId(device)) {
    throw new Error('This backup belongs to a different keyboard model.');
  }
}

export async function runBoundImport<T>(
  operation: {assertCurrent(): void},
  read: () => Promise<T>,
  validate: (data: T) => void,
  steps: ((data: T) => Promise<unknown>)[],
) {
  operation.assertCurrent();
  const data = await read();
  operation.assertCurrent();
  validate(data);
  for (const step of steps) {
    operation.assertCurrent();
    await step(data);
    operation.assertCurrent();
  }
}

export function assertBackupEncoderShape(
  encoders: unknown,
  definition: {layouts: {keys: {ei?: number}[]; optionKeys: Record<string, Record<string, {ei?: number}[]>>}},
  layerCount: number,
) {
  if (encoders === undefined) return; // Preserve legacy backups without encoder data.
  const keys = [...definition.layouts.keys, ...Object.values(definition.layouts.optionKeys).flatMap(options => Object.values(options).flat())];
  const ids = keys.flatMap(key => key.ei === undefined ? [] : [key.ei]);
  const count = ids.length ? Math.max(...ids) + 1 : 0;
  if (!Array.isArray(encoders) || encoders.length !== count ||
      encoders.some(encoder => !Array.isArray(encoder) || encoder.length !== layerCount ||
        encoder.some(layer => !Array.isArray(layer) || layer.length !== 2))) {
    throw new Error('Could not import layout: encoder count or layer count does not match this keyboard.');
  }
}
