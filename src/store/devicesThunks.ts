// Connection orchestration owns a selection request; async stages never retarget it.
import {
  getDefinitionsFromStore,
  getSupportedIdsFromStore,
  syncStore,
} from '../utils/device-store';
import {getRecognisedDevices, getVendorProductId} from '../utils/hid-keyboards';
import {KeyboardAPI} from '../utils/keyboard-api';
import type {AppThunk} from './index';
import {
  reloadDefinitions,
  loadLayoutOptions,
  updateDefinitions,
  getDefinitions,
  loadStoredCustomDefinitions,
} from './definitionsSlice';
import {loadKeymapFromDevice} from './keymapSlice';
import {updateLightingData} from './lightingSlice';
import {loadMacros} from './macrosSlice';
import {updateV3MenuData} from './menusSlice';
import {
  type ModelErrors,
  updateModelErrors,
  beginDeviceScan,
  getConnectedDevices,
  getForceAuthorize,
  getSelectedDevicePath,
  getSupportedIds,
  selectDevice,
  markDeviceReady,
  setForceAuthorize,
  updateConnectedDevices,
  updateInvalidProtocolDevices,
  updateUnresolvedDefinitionDevices,
  updateSupportedIds,
} from './devicesSlice';
import type {
  AuthorizedDevice,
  AuthorizedDevices,
  ConnectedDevice,
  ConnectedDevices,
  Device,
} from 'src/types/types';
import {createRetry} from 'src/utils/retry';
import {extractDeviceInfo, logAppError} from './errorsSlice';
import {isAuthorizedDeviceConnected} from 'src/utils/type-predicates';
import {loadFirmwareVersion, loadKeycodesVersion} from './firmwareSlice';
import {loadDefinitionName} from './definitionNameSlice';
import {KeycodesVersionProtocolError} from 'src/utils/keycodes-version';
import {resolveModelDefinition} from 'src/utils/model-definitions';
import {createDeviceOperationContext} from './device-operation';

const modelErrorMessage = (reason: string) => ({
  'unknown-product-name': 'The USB product name is not recognized for this shared VID/PID. Configuration is disabled.',
  'unsupported-definition-version': 'This model requires a VIA v3 definition, but its reported protocol does not support it.',
  'model-binding-mismatch': 'The device identity does not match the selected model definition. Configuration is disabled.',
}[reason] ?? ('Device model is unresolved: ' + reason));

let activeRetry: ReturnType<typeof createRetry> | undefined;

export const selectConnectedDeviceByPath = (path: string): AppThunk => async (dispatch, getState) => {
  let connectedDevice = getConnectedDevices(getState())[path];
  if (!connectedDevice) {
    activeRetry?.cancel();
    dispatch(selectDevice(null));
    const generation = getState().devices.selectionGeneration;
    await dispatch(reloadConnectedDevices(false));
    if (getState().devices.selectionGeneration !== generation) return;
    connectedDevice = getConnectedDevices(getState())[path];
  }
  if (connectedDevice) await dispatch(selectConnectedDevice(connectedDevice));
};

export const selectConnectedDevice = (connectedDevice: ConnectedDevice): AppThunk => async (dispatch, getState) => {
  activeRetry?.cancel();
  // Record user intent before the first await, including keycode negotiation.
  dispatch(selectDevice(connectedDevice));
  const context = createDeviceOperationContext(getState, connectedDevice);
  if (!context) return;
  const retry = activeRetry = createRetry(8, 100);
  const deviceInfo = extractDeviceInfo(connectedDevice);
  const load = async () => {
    if (!context.isCurrent()) {retry.cancel(); return;}
    try {
      await dispatch(loadKeycodesVersion(connectedDevice, context));
      context.assertCurrent();
      await dispatch(loadMacros(connectedDevice, context));
      context.assertCurrent();
      await dispatch(loadLayoutOptions(context));
      context.assertCurrent();
      try {
        if (connectedDevice.protocol < 11) {
          await dispatch(updateLightingData(connectedDevice, context));
        } else {
          await dispatch(loadDefinitionName(connectedDevice, context));
          context.assertCurrent();
          await dispatch(loadFirmwareVersion(connectedDevice, context));
          context.assertCurrent();
          await dispatch(updateV3MenuData(connectedDevice, context));
        }
      } catch (error) {
        if (!context.isCurrent()) return;
        dispatch(logAppError({message: 'Loading lighting/menu data failed', deviceInfo}));
      }
      context.assertCurrent();
      await dispatch(loadKeymapFromDevice(connectedDevice, context));
      context.assertCurrent();
      dispatch(markDeviceReady({path: context.path, generation: context.generation}));
      retry.clear();
    } catch (error) {
      if (!context.isCurrent() || error instanceof KeycodesVersionProtocolError) {retry.cancel(); return;}
      if (retry.retriesLeft()) {
        dispatch(logAppError({message: 'Loading device failed - retrying', deviceInfo}));
        retry.retry(() => {if (context.isCurrent()) void load();});
      } else {
        // A failed instance must never clear another device or revive an old selection.
        dispatch(logAppError({message: 'All retries failed for attempting connection with device', deviceInfo}));
      }
    }
  };
  await load();
};

export const reloadConnectedDevices = (autoSelect = true): AppThunk => async (dispatch, getState) => {
  dispatch(beginDeviceScan());
  const state = getState();
  const scan = state.devices.scanGeneration;
  const isCurrent = () => getState().devices.scanGeneration === scan;
  const modelErrors: ModelErrors = {};
  const recognisedDevices = await getRecognisedDevices(getSupportedIds(state), getForceAuthorize(state), (device, reason) => {
    if (isCurrent()) {
      const message = modelErrorMessage(reason);
      modelErrors[device.path] = {device: {...extractDeviceInfo(device), path: device.path}, message};
      dispatch(logAppError({message, deviceInfo: extractDeviceInfo(device)}));
    }
  });
  if (!isCurrent()) return;
  const scanned = await Promise.all(recognisedDevices.map(async device => {
    try {return {device, protocol: await new KeyboardAPI(device.path, isCurrent).getProtocolVersion()};}
    catch {return {device, protocol: -1};}
  }));
  if (!isCurrent()) return;
  const invalid: Record<string, Device> = {};
  scanned.filter(({protocol}) => protocol === -1).forEach(({device}) => {
    invalid[device.path] = device;
    dispatch(logAppError({message: 'Received invalid protocol version from device', deviceInfo: extractDeviceInfo(device)}));
  });
  dispatch(updateInvalidProtocolDevices(invalid));
  const authorized: AuthorizedDevice[] = scanned.filter(({protocol}) => protocol !== -1).map(({device, protocol}) => {
    const authorizedDevice: AuthorizedDevice = {
      path: device.path, productId: device.productId, vendorId: device.vendorId, productName: device.productName,
      protocol, hasResolvedDefinition: false, requiredDefinitionVersion: protocol >= 11 ? 'v3' : 'v2',
      vendorProductId: getVendorProductId(device.vendorId, device.productId),
    };
    const model = resolveModelDefinition(authorizedDevice);
    if (model.kind === 'model') authorizedDevice.modelDefinitionId = model.modelDefinitionId;
    if (model.kind === 'unresolved') modelErrors[device.path] = {device: {...extractDeviceInfo(authorizedDevice), path: device.path}, message: modelErrorMessage(model.reason)};
    return authorizedDevice;
  });
  await dispatch(reloadDefinitions(authorized, isCurrent));
  if (!isCurrent()) return;
  const definitions = getDefinitions(getState());
  const connected: ConnectedDevices = {};
  const unresolved: AuthorizedDevices = {};
  authorized.forEach(device => {
    const model = resolveModelDefinition(device);
    if (model.kind !== 'unresolved' && isAuthorizedDeviceConnected(device, definitions)) {
      connected[device.path] = {...device, hasResolvedDefinition: true};
    } else if (model.kind === 'legacy') {
      unresolved[device.path] = device;
    } else if (!modelErrors[device.path]) {
      modelErrors[device.path] = {device: {...extractDeviceInfo(device), path: device.path}, message: 'The definition for this keyboard model could not be loaded. Configuration is disabled.'};
    }
  });
  dispatch(updateModelErrors(modelErrors));
  dispatch(updateUnresolvedDefinitionDevices(unresolved));
  dispatch(updateConnectedDevices(connected));
  const selectedPath = getSelectedDevicePath(getState());
  if (autoSelect && !selectedPath && Object.values(connected).length) {
    await dispatch(selectConnectedDevice(Object.values(connected)[0]));
  } else if (!Object.keys(connected).length) {
    activeRetry?.cancel();
    if (selectedPath) dispatch(selectDevice(null));
    dispatch(setForceAuthorize(true));
  }
};

export const loadSupportedIds = (): AppThunk => async dispatch => {
  await syncStore();
  dispatch(updateSupportedIds(getSupportedIdsFromStore()));
  dispatch(updateDefinitions(getDefinitionsFromStore()));
  await dispatch(loadStoredCustomDefinitions());
  await dispatch(reloadConnectedDevices());
};
