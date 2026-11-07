import {createSelector, createSlice, PayloadAction} from '@reduxjs/toolkit';
import type {DefinitionVersion} from '@the-via/reader';
import {KeyboardAPI} from 'src/utils/keyboard-api';
import type {
  AuthorizedDevice,
  AuthorizedDevices,
  ConnectedDevice,
  ConnectedDevices,
  Device,
  DeviceInfo,
  VendorProductIdMap,
} from '../types/types';

import type {RootState} from './index';

export type ModelErrors = Record<string, {device: DeviceInfo & {path: string}; message: string}>;

type DevicesState = {
  modelErrors: ModelErrors;
  selectedDevicePath: string | null;
  selectionGeneration: number;
  scanGeneration: number;
  readyDevicePath: string | null;
  connectedDevicePaths: ConnectedDevices;
  unresolvedDefinitionDevicePaths: AuthorizedDevices;
  invalidProtocolDevicePaths: Record<string, Device>;
  supportedIds: VendorProductIdMap;
  forceAuthorize: boolean;
};

const initialState: DevicesState = {
  modelErrors: {},
  selectedDevicePath: null,
  selectionGeneration: 0,
  scanGeneration: 0,
  readyDevicePath: null,
  connectedDevicePaths: {},
  unresolvedDefinitionDevicePaths: {},
  invalidProtocolDevicePaths: {},
  supportedIds: {},
  forceAuthorize: false,
};

const deviceSlice = createSlice({
  name: 'devices',
  initialState,
  reducers: {
    // TODO: change to just pass the device path instead of the whole device
    selectDevice: (state, action: PayloadAction<ConnectedDevice | null>) => {
      state.readyDevicePath = null;
      state.selectionGeneration++;
      if (!action.payload) {
        state.selectedDevicePath = null;
      } else {
        state.selectedDevicePath = action.payload.path;
      }
    },
    markDeviceReady: (state, action: PayloadAction<{path: string; generation: number}>) => {
      if (state.selectedDevicePath === action.payload.path && state.selectionGeneration === action.payload.generation && state.connectedDevicePaths[action.payload.path]) {
        state.readyDevicePath = action.payload.path;
      }
    },
    updateModelErrors: (state, action: PayloadAction<ModelErrors>) => {state.modelErrors = action.payload;},
    dismissModelError: (state, action: PayloadAction<string>) => {delete state.modelErrors[action.payload];},
    beginDeviceScan: (state) => {state.scanGeneration++;},
    disconnectDevice: (state, action: PayloadAction<string>) => {
      const path = action.payload;
      delete state.connectedDevicePaths[path];
      delete state.unresolvedDefinitionDevicePaths[path];
      delete state.invalidProtocolDevicePaths[path];
      delete state.modelErrors[path];
      state.scanGeneration++;
      if (state.selectedDevicePath === path) {
        state.selectedDevicePath = null;
        state.readyDevicePath = null;
        state.selectionGeneration++;
      }
    },
    setForceAuthorize: (state, action: PayloadAction<boolean>) => {
      state.forceAuthorize = action.payload;
    },
    updateConnectedDevices: (
      state,
      action: PayloadAction<ConnectedDevices>,
    ) => {
      state.connectedDevicePaths = action.payload;
      if (state.selectedDevicePath && !action.payload[state.selectedDevicePath]) {
        state.selectedDevicePath = null;
        state.readyDevicePath = null;
        state.selectionGeneration++;
      }
    },
    updateUnresolvedDefinitionDevices: (
      state,
      action: PayloadAction<AuthorizedDevices>,
    ) => {
      state.unresolvedDefinitionDevicePaths = action.payload;
    },
    dismissUnresolvedDefinitionDevice: (
      state,
      action: PayloadAction<AuthorizedDevice>,
    ) => {
      delete state.unresolvedDefinitionDevicePaths[action.payload.path];
    },
    updateInvalidProtocolDevices: (
      state,
      action: PayloadAction<Record<string, Device>>,
    ) => {
      state.invalidProtocolDevicePaths = action.payload;
    },
    dismissInvalidProtocolDevice: (state, action: PayloadAction<Device>) => {
      delete state.invalidProtocolDevicePaths[action.payload.path];
    },
    clearAllDevices: (state) => {
      state.modelErrors = {};
      state.selectionGeneration++;
      state.scanGeneration++;
      state.selectedDevicePath = null;
      state.readyDevicePath = null;
      state.connectedDevicePaths = {};
      state.unresolvedDefinitionDevicePaths = {};
      state.invalidProtocolDevicePaths = {};
    },
    updateSupportedIds: (state, action: PayloadAction<VendorProductIdMap>) => {
      state.supportedIds = action.payload;
    },
    ensureSupportedIds: (
      state,
      action: PayloadAction<{productIds: number[]; version: DefinitionVersion}>,
    ) => {
      const {productIds, version} = action.payload;
      productIds.forEach((productId) => {
        state.supportedIds[productId] = state.supportedIds[productId] ?? {};
        // Side effect
        state.supportedIds[productId][version] = true;
      });
    },
  },
});

export const {
  clearAllDevices,
  beginDeviceScan,
  updateModelErrors,
  dismissModelError,
  disconnectDevice,
  selectDevice,
  markDeviceReady,
  updateConnectedDevices,
  updateUnresolvedDefinitionDevices,
  dismissUnresolvedDefinitionDevice,
  updateInvalidProtocolDevices,
  dismissInvalidProtocolDevice,
  updateSupportedIds,
  ensureSupportedIds,
  setForceAuthorize,
} = deviceSlice.actions;

export default deviceSlice.reducer;

export const getForceAuthorize = (state: RootState) =>
  state.devices.forceAuthorize;
export const getConnectedDevices = (state: RootState) =>
  state.devices.connectedDevicePaths;
export const getUnresolvedDefinitionDevices = (state: RootState) =>
  state.devices.unresolvedDefinitionDevicePaths;
export const getUnresolvedDefinitionDeviceWarning = createSelector(
  getUnresolvedDefinitionDevices,
  (devices) => Object.values(devices)[0],
);
export const getInvalidProtocolDevices = (state: RootState) =>
  state.devices.invalidProtocolDevicePaths;
export const getInvalidProtocolDeviceWarning = createSelector(
  getInvalidProtocolDevices,
  (devices) => Object.values(devices)[0],
);
export const getSelectedDevicePath = (state: RootState) =>
  state.devices.selectedDevicePath;
export const getIsSelectedDeviceReady = (state: RootState) =>
  state.devices.selectedDevicePath !== null &&
  state.devices.readyDevicePath === state.devices.selectedDevicePath;
export const getSupportedIds = (state: RootState) => state.devices.supportedIds;
export const getSelectedConnectedDevice = createSelector(
  getConnectedDevices,
  getSelectedDevicePath,
  (devices, path) => (path ? devices[path] : null),
);
// Registered once by the application store; operation thunks use their own getState.
let readDeviceState: (() => RootState) | undefined;
export const setDeviceStateReader = (reader: () => RootState) => {readDeviceState = reader;};
export const getSelectionGeneration = (state: RootState) => state.devices.selectionGeneration;
export const getSelectedKeyboardAPI = createSelector(
  getSelectedDevicePath,
  getSelectionGeneration,
  (state: RootState) => !!getSelectedConnectedDevice(state),
  (state: RootState) => getSelectedConnectedDevice(state)?.modelDefinitionId,
  (state: RootState) => getSelectedConnectedDevice(state)?.protocol,
  (state: RootState) => getSelectedConnectedDevice(state)?.requiredDefinitionVersion,
  (state: RootState) => state.definitions.definitions,
  (state: RootState) => state.definitions.customDefinitions,
  (path, generation, connected, modelId, protocol, version, definitions, customDefinitions) =>
    path && connected && new KeyboardAPI(path, () => {
      const state = readDeviceState?.();
      const devices = state?.devices;
      const current = devices?.connectedDevicePaths[path];
      return !!devices && !!current && devices.selectedDevicePath === path &&
        devices.selectionGeneration === generation &&
        current.modelDefinitionId === modelId && current.protocol === protocol &&
        current.requiredDefinitionVersion === version &&
        state?.definitions.definitions === definitions &&
        state?.definitions.customDefinitions === customDefinitions;
    }),
);

export const getModelErrorWarning = (state: RootState) => Object.values(state.devices.modelErrors)[0];
