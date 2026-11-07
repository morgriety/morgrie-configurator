import {
  createDeviceOperationContext,
  type DeviceOperationContext,
} from './device-operation';
import {createSelector, createSlice, PayloadAction} from '@reduxjs/toolkit';
import type {RootState, AppThunk} from './index';
import {getSelectedDevicePath, selectDevice} from './devicesSlice';
import {KeyboardValue} from 'src/utils/keyboard-values';
import {
  formatKeycodesVersion,
  KeycodesVersionProtocolError,
  MAXIMUM_SUPPORTED_KEYCODES_VERSION,
  MINIMUM_SUPPORTED_KEYCODES_VERSION,
  readKeycodesVersion,
  UnsupportedKeycodesVersionError,
} from 'src/utils/keycodes-version';
import type {ConnectedDevice} from '../types/types';
import {extractDeviceInfo, logKeyboardAPIError} from './errorsSlice';

type FirmwareVersionMap = {[devicePath: string]: number};
type KeycodesVersionMap = {[devicePath: string]: number};

type FirmwareState = {
  firmwareVersionMap: FirmwareVersionMap;
  keycodesVersionMap: KeycodesVersionMap;
};

const initialState: FirmwareState = {
  firmwareVersionMap: {},
  keycodesVersionMap: {},
};

export const firmwareSlice = createSlice({
  name: 'firmware',
  initialState,
  reducers: {
    updateFirmwareVersion: (
      state,
      action: PayloadAction<{devicePath: string; version?: number}>,
    ) => {
      const {devicePath, version} = action.payload;
      if (version === undefined) delete state.firmwareVersionMap[devicePath];
      else state.firmwareVersionMap[devicePath] = version;
    },
    updateKeycodesVersion: (
      state,
      action: PayloadAction<{devicePath: string; version: number}>,
    ) => {
      const {devicePath, version} = action.payload;
      state.keycodesVersionMap[devicePath] = version;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(selectDevice, (state, {payload}) => {
      if (payload) delete state.firmwareVersionMap[payload.path];
    });
  },
});

export const {updateFirmwareVersion, updateKeycodesVersion} =
  firmwareSlice.actions;

export default firmwareSlice.reducer;

// Selectors
export const getFirmwareVersionMap = (state: RootState) =>
  (state.firmware as FirmwareState).firmwareVersionMap;
export const getKeycodesVersionMap = (state: RootState) =>
  (state.firmware as FirmwareState).keycodesVersionMap;

export const getSelectedFirmwareVersion = createSelector(
  getFirmwareVersionMap,
  getSelectedDevicePath,
  (map, path) => (path ? map[path] : undefined),
);

export const getSelectedKeycodesVersion = createSelector(
  getKeycodesVersionMap,
  getSelectedDevicePath,
  (map, path) => (path ? map[path] : undefined),
);

export const loadKeycodesVersion =
  (connectedDevice: ConnectedDevice, operation?: DeviceOperationContext): AppThunk =>
    async (dispatch, getState) => {
      const context = operation ?? createDeviceOperationContext(getState, connectedDevice);
      if (!context?.isCurrent()) return;
      if (connectedDevice.protocol < 13) {
        return;
      }

      const {api} = context;
      let version: number;
      try {
        version = await readKeycodesVersion(api);
        if (!context.isCurrent()) return;
      } catch (error) {
        if (!context.isCurrent()) return;
        if (error instanceof KeycodesVersionProtocolError) {
          const details =
            error instanceof UnsupportedKeycodesVersionError
              ? `Device reports unsupported QMK keycode version ${formatKeycodesVersion(error.version)}. This version of VIA supports ${formatKeycodesVersion(MINIMUM_SUPPORTED_KEYCODES_VERSION)} through ${formatKeycodesVersion(MAXIMUM_SUPPORTED_KEYCODES_VERSION)}. Update VIA before assigning keycodes.`
              : `Device reports VIA protocol ${connectedDevice.protocol}, but ${error.message.toLowerCase()}. Firmware may contain incompatible VIA and QMK revisions.`;
          dispatch(
            logKeyboardAPIError({
              commandName: 'GET_KEYBOARD_VALUE / KEYCODES_VERSION',
              commandBytes: [0x02, KeyboardValue.KEYCODES_VERSION],
              responseBytes: [
                0x02,
                KeyboardValue.KEYCODES_VERSION,
                ...error.responseBytes,
              ],
              deviceInfo: extractDeviceInfo(connectedDevice),
              details,
            }),
          );
        }
        throw error;
      }
      dispatch(
        updateKeycodesVersion({devicePath: connectedDevice.path, version}),
      );
    };

// Thunk to load firmware version from device
export const loadFirmwareVersion =
  (connectedDevice: ConnectedDevice, operation?: DeviceOperationContext): AppThunk =>
    async (dispatch, getState) => {
      const context = operation ?? createDeviceOperationContext(getState, connectedDevice);
      if (!context?.isCurrent()) return;
      const {api, path} = context;
      dispatch(updateFirmwareVersion({devicePath: path}));

      try {
        const result = await api.getKeyboardValue(
          KeyboardValue.FIRMWARE_VERSION,
          [],
          4, // Read 4 bytes for 32-bit value
        );

        if (!context.isCurrent()) return;
        if (result.length !== 4 || result.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) return;
        const version = new DataView(Uint8Array.from(result).buffer).getUint32(0);

        dispatch(updateFirmwareVersion({devicePath: path, version}));
      } catch (e) {
        if (context.isCurrent()) console.error('Failed to load firmware version:', e);
      }
    };
