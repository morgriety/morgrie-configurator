import {
  createDeviceOperationContext,
  type DeviceOperationContext,
} from './device-operation';
import {createSelector, createSlice, PayloadAction} from '@reduxjs/toolkit';
import type {ConnectedDevice, DeviceLayerMap, Keymap, Layer} from '../types/types';
import type {AppThunk, RootState} from './index';
import {getSelectedDefinition, getSelectedKeyDefinitions} from './definitionsSlice';
import {getSelectedDevicePath, selectDevice} from './devicesSlice';

type KeymapState = {
  rawDeviceMap: DeviceLayerMap;
  numberOfLayers: Record<string, number>;
  selectedLayerIndex: number;
  selectedKey: number | null;
  configureKeyboardIsSelectable: boolean;
  selectedPaletteColor: [number, number];
};

const initialState: KeymapState = {
  rawDeviceMap: {},
  numberOfLayers: {},
  selectedLayerIndex: 0,
  selectedKey: null,
  configureKeyboardIsSelectable: false,
  selectedPaletteColor: [0, 0],
};

const keymapSlice = createSlice({
  name: 'keymap',
  initialState,
  reducers: {
    setSelectedPaletteColor: (
      state,
      action: PayloadAction<[number, number]>,
    ) => {
      state.selectedPaletteColor = action.payload;
    },
    setNumberOfLayers: (state, action: PayloadAction<{devicePath: string; count: number}>) => {
      state.numberOfLayers[action.payload.devicePath] = action.payload.count;
      state.rawDeviceMap[action.payload.devicePath] = Array.from({length: action.payload.count}, () => ({keymap: [], isLoaded: false}));
    },
    setConfigureKeyboardIsSelectable: (
      state,
      action: PayloadAction<boolean>,
    ) => {
      state.configureKeyboardIsSelectable = action.payload;
    },
    // Writes a single layer to the device layer map
    loadLayerSuccess: (
      state,
      action: PayloadAction<{
        layerIndex: number;
        keymap: Keymap;
        devicePath: string;
      }>,
    ) => {
      const {layerIndex, keymap, devicePath} = action.payload;
      state.rawDeviceMap[devicePath] =
        state.rawDeviceMap[devicePath] ||
        Array(state.numberOfLayers[devicePath] ?? 0).fill({
          keymap: [],
          isLoaded: false,
        });
      state.rawDeviceMap[devicePath][layerIndex] = {
        keymap,
        isLoaded: true,
      };
    },
    setLayer: (state, action: PayloadAction<number>) => {
      state.selectedLayerIndex = action.payload;
    },
    clearSelectedKey: (state) => {
      state.selectedKey = null;
    },
    updateSelectedKey: (state, action: PayloadAction<number | null>) => {
      state.selectedKey = action.payload;
    },
    saveKeymapSuccess: (
      state,
      action: PayloadAction<{layers: Layer[]; devicePath: string}>,
    ) => {
      const {layers, devicePath} = action.payload;
      state.rawDeviceMap[devicePath] = layers;
    },
    setKey: (
      state,
      action: PayloadAction<{
        devicePath: string;
        keymapIndex: number;
        layerIndex: number;
        value: number;
      }>,
    ) => {
      const {keymapIndex, value, devicePath, layerIndex} = action.payload;

      state.rawDeviceMap[devicePath][layerIndex].keymap[keymapIndex] =
        value;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(selectDevice, (state) => {
      state.selectedKey = null;
      state.selectedLayerIndex = 0;
    });
  },
});

export const {
  setNumberOfLayers,
  setLayer,
  loadLayerSuccess,
  clearSelectedKey,
  setKey,
  updateSelectedKey,
  saveKeymapSuccess,
  setConfigureKeyboardIsSelectable,
  setSelectedPaletteColor,
} = keymapSlice.actions;

export default keymapSlice.reducer;

export const loadKeymapFromDevice =
  (connectedDevice: ConnectedDevice, operation?: DeviceOperationContext): AppThunk =>
    async (dispatch, getState) => {
      const context = operation ?? createDeviceOperationContext(getState, connectedDevice);
      if (!context?.isCurrent()) return;
      const {api, path, definition} = context;
      try {
        const numberOfLayers = await api.getLayerCount();
        if (!context.isCurrent()) return;
        dispatch(setNumberOfLayers({devicePath: path, count: numberOfLayers}));
        for (let layerIndex = 0; layerIndex < numberOfLayers; layerIndex++) {
          context.assertCurrent();
          const keymap = await api.readRawMatrix(definition.matrix, layerIndex);
          if (!context.isCurrent()) return;
          dispatch(loadLayerSuccess({layerIndex, keymap, devicePath: path}));
        }
      } catch (error) {if (context.isCurrent()) throw error;}
    };

export const saveRawKeymapToDevice =
  (keymap: number[][], connectedDevice: ConnectedDevice, operation?: DeviceOperationContext): AppThunk =>
    async (dispatch, getState) => {
      const context = operation ?? createDeviceOperationContext(getState, connectedDevice);
      if (!context?.isCurrent()) return;
      try {
        await context.api.writeRawMatrix(context.definition.matrix, keymap);
        context.assertCurrent();
        const layers = keymap.map(layer => ({keymap: layer, isLoaded: true}));
        dispatch(saveKeymapSuccess({layers, devicePath: context.path}));
      } catch (error) {if (context.isCurrent() || operation) throw error;}
    };

export const updateKey =
  (keyIndex: number, value: number): AppThunk =>
    async (dispatch, getState) => {
      const state = getState();
      const context = createDeviceOperationContext(getState);
      const key = getSelectedKeyDefinitions(state)[keyIndex];
      if (!context || !key) return;
      const layerIndex = getSelectedLayerIndex(state);
      const {row, col} = key;
      try {
        await context.api.setKey(layerIndex, row, col, value);
        if (!context.isCurrent()) return;
        const keymapIndex = row * context.definition.matrix.cols + col;
        dispatch(setKey({keymapIndex, value, layerIndex, devicePath: context.path}));
      } catch (error) {if (context.isCurrent()) throw error;}
    };

export const getConfigureKeyboardIsSelectable = (state: RootState) =>
  state.keymap.configureKeyboardIsSelectable;
export const getSelectedKey = (state: RootState) => state.keymap.selectedKey;
export const getRawDeviceMap = (state: RootState) => state.keymap.rawDeviceMap;
export const getNumberOfLayers = (state: RootState) =>
  (state.devices.selectedDevicePath && state.keymap.numberOfLayers[state.devices.selectedDevicePath]) || 0;
export const getSelectedLayerIndex = (state: RootState) =>
  state.keymap.selectedLayerIndex;
export const getSelected256PaletteColor = (state: RootState) =>
  state.keymap.selectedPaletteColor;
export const getSelectedPaletteColor = createSelector(
  getSelected256PaletteColor,
  ([hue, sat]) => {
    return [(360 * hue) / 255, sat / 255] as [number, number];
  },
);

export const getSelectedRawLayers = createSelector(
  getRawDeviceMap,
  getSelectedDevicePath,
  (rawDeviceMap, devicePath) => (devicePath && rawDeviceMap[devicePath]) || [],
);

export const getLoadProgress = createSelector(
  getSelectedRawLayers,
  getNumberOfLayers,
  (layers, layerCount) =>
    layerCount > 0 ? layers.filter((layer) => layer.isLoaded).length / layerCount : 0,
);

export const getSelectedRawLayer = createSelector(
  getSelectedRawLayers,
  getSelectedLayerIndex,
  (deviceLayers, layerIndex) => deviceLayers && deviceLayers[layerIndex],
);

export const getSelectedKeymaps = createSelector(
  getSelectedKeyDefinitions,
  getSelectedDefinition,
  getSelectedRawLayers,
  (keys, definition, layers) => {
    if (definition && layers) {
      const rawKeymaps = layers.map((layer) => layer.keymap);
      const {
        matrix: {cols},
      } = definition;
      return rawKeymaps.map((keymap) =>
        keys.map(({row, col}) => keymap[row * cols + col]),
      );
    }
    return undefined;
  },
);

export const getSelectedKeymap = createSelector(
  getSelectedKeymaps,
  getSelectedLayerIndex,
  (deviceLayers, layerIndex) => deviceLayers && deviceLayers[layerIndex],
);
