import {
  createDeviceOperationContext,
  type DeviceOperationContext,
} from './device-operation';
import {createSelector, createSlice, PayloadAction} from '@reduxjs/toolkit';
import {getMacroAPI, isDelaySupported} from 'src/utils/macro-api';
import {
  expressionToSequence,
  optimizedSequenceToRawSequence,
  rawSequenceToOptimizedSequence,
  sequenceToExpression,
} from 'src/utils/macro-api/macro-api.common';
import {RawKeycodeSequence} from 'src/utils/macro-api/types';
import type {ConnectedDevice} from '../types/types';
import {getSelectedConnectedDevice} from './devicesSlice';
import type {AppThunk, RootState} from './index';

type MacrosState = {
  ast: RawKeycodeSequence[];
  macroBufferSize: number;
  macroCount: number;
  isFeatureSupported: boolean;
};

const macrosInitialState: MacrosState = {
  ast: [],
  macroBufferSize: 0,
  macroCount: 0,
  isFeatureSupported: true,
};

const macrosSlice = createSlice({
  name: 'macros',
  initialState: {deviceMacros: {}} as {deviceMacros: Record<string, MacrosState>},
  reducers: {
    loadMacrosSuccess: (
      state,
      action: PayloadAction<{
        devicePath: string;
        ast: RawKeycodeSequence[];
        macroBufferSize: number;
        macroCount: number;
      }>,
    ) => {
      state.deviceMacros[action.payload.devicePath] = {...action.payload, isFeatureSupported: true};
    },
    saveMacrosSuccess: (
      state,
      action: PayloadAction<{devicePath: string; ast: RawKeycodeSequence[]}>,
    ) => {
      state.deviceMacros[action.payload.devicePath] = {...macrosInitialState, ...state.deviceMacros[action.payload.devicePath], ast: action.payload.ast};
    },
    setMacrosNotSupported: (state, action: PayloadAction<string>) => {
      state.deviceMacros[action.payload] = {...macrosInitialState, isFeatureSupported: false};
    },
  },
});

export const {loadMacrosSuccess, saveMacrosSuccess, setMacrosNotSupported} =
  macrosSlice.actions;

export default macrosSlice.reducer;

export const loadMacros =
  (connectedDevice: ConnectedDevice, operation?: DeviceOperationContext): AppThunk =>
    async (dispatch, getState) => {
      const context = operation ?? createDeviceOperationContext(getState, connectedDevice);
      if (!context?.isCurrent()) return;
      const {api, path, device} = context;
      if (device.protocol < 8) {dispatch(setMacrosNotSupported(path)); return;}
      try {
        const version = getState().firmware.keycodesVersionMap[path];
        const macroApi = getMacroAPI(device.protocol, version, api);
        if (!macroApi) {dispatch(setMacrosNotSupported(path)); return;}
        const ast = await macroApi.readRawKeycodeSequences();
        context.assertCurrent();
        const macroBufferSize = await api.getMacroBufferSize();
        context.assertCurrent();
        const macroCount = await api.getMacroCount();
        if (!context.isCurrent()) return;
        dispatch(loadMacrosSuccess({devicePath: path, ast, macroBufferSize, macroCount}));
      } catch {if (context.isCurrent()) dispatch(setMacrosNotSupported(path));}
    };

export const saveMacros =
  (connectedDevice: ConnectedDevice, macros: string[], operation?: DeviceOperationContext): AppThunk =>
    async (dispatch, getState) => {
      const context = operation ?? createDeviceOperationContext(getState, connectedDevice);
      if (!context?.isCurrent()) return;
      const {api, path, device} = context;
      const version = getState().firmware.keycodesVersionMap[path];
      const macroApi = getMacroAPI(device.protocol, version, api);
      if (!macroApi) return;
      const sequences = macros.map(expression => optimizedSequenceToRawSequence(expressionToSequence(expression)));
      try {
        await macroApi.writeRawKeycodeSequences(sequences);
        context.assertCurrent();
        dispatch(saveMacrosSuccess({devicePath: path, ast: sequences}));
      } catch (error) {if (context.isCurrent() || operation) throw error;}
    };

export const getSelectedMacros = (state: RootState) =>
  (state.devices.selectedDevicePath && state.macros.deviceMacros[state.devices.selectedDevicePath]) || macrosInitialState;
export const getIsMacroFeatureSupported = (state: RootState) => getSelectedMacros(state).isFeatureSupported;
export const getAST = (state: RootState) => getSelectedMacros(state).ast;
export const getMacroBufferSize = (state: RootState) => getSelectedMacros(state).macroBufferSize;
export const getMacroCount = (state: RootState) => getSelectedMacros(state).macroCount;

export const getExpressions = createSelector(getAST, (sequences) =>
  sequences.map((sequence) => {
    const optimizedSequence = rawSequenceToOptimizedSequence(sequence);
    const expression = sequenceToExpression(optimizedSequence);
    return expression;
  }),
);

export const getIsDelaySupported = createSelector(
  getSelectedConnectedDevice,
  (device) => !!device && isDelaySupported(device.protocol),
);
