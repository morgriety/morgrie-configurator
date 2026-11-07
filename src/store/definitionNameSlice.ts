import {
  createDeviceOperationContext,
  type DeviceOperationContext,
} from './device-operation';
import {createSelector, createSlice, PayloadAction} from '@reduxjs/toolkit';
import type {ConnectedDevice} from '../types/types';
import {isDynamicDefinitionName, resolveDefinitionName} from '../utils/definition-name';
import type {AppThunk, RootState} from './index';
import {getSelectedDefinition, getDefinitionForDevice} from './definitionsSlice';
import {getSelectedDevicePath} from './devicesSlice';

type DefinitionNameState = {
  selectedOptionMap: Record<string, number>;
};

const initialState: DefinitionNameState = {
  selectedOptionMap: {},
};

const definitionNameSlice = createSlice({
  name: 'definitionName',
  initialState,
  reducers: {
    updateDefinitionNameOption: (
      state,
      action: PayloadAction<{devicePath: string; selectedOption: number}>,
    ) => {
      const {devicePath, selectedOption} = action.payload;
      state.selectedOptionMap[devicePath] = selectedOption;
    },
    clearDefinitionNameOption: (
      state,
      action: PayloadAction<{devicePath: string}>,
    ) => {
      delete state.selectedOptionMap[action.payload.devicePath];
    },
  },
});

export const {updateDefinitionNameOption, clearDefinitionNameOption} =
  definitionNameSlice.actions;

export default definitionNameSlice.reducer;

export const getDefinitionNameOptionMap = (state: RootState) =>
  state.definitionName.selectedOptionMap;

export const getSelectedDefinitionName = createSelector(
  getSelectedDefinition,
  getDefinitionNameOptionMap,
  getSelectedDevicePath,
  (definition, selectedOptionMap, devicePath) =>
    resolveDefinitionName(
      definition?.name,
      devicePath ? selectedOptionMap[devicePath] : undefined,
    ),
);

export const getConnectedDefinitionNames = createSelector(
  (state: RootState) => state,
  getDefinitionNameOptionMap,
  (state, selectedOptionMap) => (device: ConnectedDevice) => {
    const definition = getDefinitionForDevice(state, device);
    return resolveDefinitionName(
      definition?.name,
      selectedOptionMap[device.path],
    );
  },
);

export const loadDefinitionName =
  (connectedDevice: ConnectedDevice, operation?: DeviceOperationContext): AppThunk =>
    async (dispatch, getState) => {
      const context = operation ?? createDeviceOperationContext(getState, connectedDevice);
      if (!context?.isCurrent()) return;
      const {definition, api} = context;
      const name = definition?.name as unknown;

      dispatch(clearDefinitionNameOption({devicePath: connectedDevice.path}));

      if (!api || !isDynamicDefinitionName(name)) {
        return;
      }

      const [, channelId, ...command] = name.content;

      try {
        const result = await api.getCustomMenuValue([channelId, ...command], {
          reportErrors: false,
        });
        if (!context.isCurrent()) return;
        const selectedOption = result.slice(1)[0];

        if (Number.isInteger(selectedOption)) {
          dispatch(
            updateDefinitionNameOption({
              devicePath: connectedDevice.path,
              selectedOption,
            }),
          );
        }
      } catch {
        // Dynamic names are optional. Unsupported commands use the first option.
      }
    };
