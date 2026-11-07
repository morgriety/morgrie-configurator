import registry from '../../definitions/model-registry.json';
import type {DefinitionVersion, DefinitionVersionMap} from '@the-via/reader';

export type DefinitionDictionary = Record<string, DefinitionVersionMap>;
export type ModelDeviceIdentity = {
  vendorId: number;
  productId: number;
  productName?: string;
  requiredDefinitionVersion?: DefinitionVersion;
  modelDefinitionId?: string;
};
export type ModelResolution =
  | {kind: 'legacy'}
  | {kind: 'model'; modelDefinitionId: string; resourcePath: string}
  | {kind: 'unresolved'; reason: 'unknown-product-name' | 'unsupported-definition-version' | 'model-binding-mismatch'};

// The compiled registry is the single source of identity. A network/cache failure
// must never turn a managed shared USB ID into the numeric AIR68 fallback.
export const resolveModelDefinition = (device: ModelDeviceIdentity): ModelResolution => {
  const candidates = registry.models.filter((model) =>
    model.vendorId === device.vendorId && model.productId === device.productId,
  );
  if (!candidates.length) return {kind: 'legacy'};
  const model = candidates.find((entry) => entry.productName === device.productName);
  if (!model) return {kind: 'unresolved', reason: 'unknown-product-name'};
  if (model.definitionVersion !== (device.requiredDefinitionVersion ?? 'v3')) {
    return {kind: 'unresolved', reason: 'unsupported-definition-version'};
  }
  if (device.modelDefinitionId && device.modelDefinitionId !== model.modelDefinitionId) {
    return {kind: 'unresolved', reason: 'model-binding-mismatch'};
  }
  return {kind: 'model', modelDefinitionId: model.modelDefinitionId, resourcePath: model.resourcePath};
};

export const getDefinitionKey = (device: ModelDeviceIdentity): string | undefined => {
  const resolution = resolveModelDefinition(device);
  if (resolution.kind === 'unresolved') return undefined;
  return resolution.kind === 'model'
    ? resolution.modelDefinitionId
    : String(device.vendorId * 65536 + device.productId);
};

export const definitionForDevice = (
  device: ModelDeviceIdentity,
  definitions?: DefinitionDictionary,
) => {
  const key = getDefinitionKey(device);
  return key === undefined ? undefined : definitions?.[key]?.[device.requiredDefinitionVersion ?? 'v3'];
};

// An unscoped imported shared-ID definition remains in its old numeric slot,
// preserved for explicit assignment but ignored by managed-device resolution.
export const getCustomDefinitionKey = (
  definition: {vendorProductId: number},
  version: DefinitionVersion,
  modelDefinitionId?: string,
): string => {
  if (!modelDefinitionId) return String(definition.vendorProductId);
  const model = registry.models.find((entry) => entry.modelDefinitionId === modelDefinitionId);
  if (!model || model.definitionVersion !== version ||
      model.vendorId * 65536 + model.productId !== definition.vendorProductId) {
    throw new Error('Custom definition does not match its model scope');
  }
  return model.modelDefinitionId;
};

export const isManagedVendorProductId = (vendorProductId: number): boolean =>
  registry.models.some((model) => model.vendorId * 65536 + model.productId === vendorProductId);

export const registeredModels = registry.models;
