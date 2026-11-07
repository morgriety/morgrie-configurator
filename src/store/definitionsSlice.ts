import {createSelector, createSlice, PayloadAction} from '@reduxjs/toolkit';
import type {
  AuthorizedDevice,
  AuthorizedDevices,
  ConnectedDevices,
} from '../types/types';
import {
  bytesIntoNum,
  numIntoBytes,
  packBits,
  unpackBits,
} from '../utils/bit-pack';
import {KeyboardValue} from '../utils/keyboard-api';
import type {
  DefinitionVersion,
  DefinitionVersionMap,
  VIADefinitionV2,
  VIADefinitionV3,
  VIAKey,
} from '@the-via/reader';
import type {AppThunk, RootState} from './index';
import {
  getSelectedDevicePath,
  getSelectedConnectedDevice,
  ensureSupportedIds,
  getSelectedKeyboardAPI,
} from './devicesSlice';
import {getMissingDefinition} from 'src/utils/device-store';
import {definitionForDevice, getDefinitionKey, getCustomDefinitionKey, registeredModels, type DefinitionDictionary} from 'src/utils/model-definitions';
import {createDeviceOperationContext, type DeviceOperationContext} from './device-operation';
import type {ConnectedDevice} from 'src/types/types';
import {getBasicKeyDict} from 'src/utils/key-to-byte/dictionary-store';
import {getByteToKey} from 'src/utils/key';
import {del, entries, setMany, update} from 'idb-keyval';
import {extractDeviceInfo, logAppError} from './errorsSlice';
import {getSelectedKeycodesVersion} from './firmwareSlice';

type LayoutOption = number;
type LayoutOptionsMap = {[devicePath: string]: LayoutOption[] | null}; // TODO: is this null valid?

// TODO: should we use some redux local storage action instead of our custom via-app-store/device-store caching for definitions?
type DefinitionsState = {
  definitions: DefinitionDictionary;
  customDefinitions: DefinitionDictionary;
  layoutOptionsMap: LayoutOptionsMap;
};

const initialState: DefinitionsState = {
  definitions: {},
  customDefinitions: {},
  layoutOptionsMap: {},
};

const definitionsSlice = createSlice({
  name: 'definitions',
  initialState,
  reducers: {
    updateDefinitions: (state, action: PayloadAction<DefinitionDictionary>) => {
      state.definitions = {...state.definitions, ...action.payload};
    },
    loadInitialCustomDefinitions: (
      state,
      action: PayloadAction<DefinitionDictionary>,
    ) => {
      state.customDefinitions = action.payload;
    },
    unloadCustomDefinition: (
      state,
      action: PayloadAction<{
        id: number | string;
        version: DefinitionVersion;
      }>,
    ) => {
      const {version, id} = action.payload;
      const definitionEntry = state.customDefinitions[id];
      if (Object.keys(definitionEntry).length === 1) {
        delete state.customDefinitions[id];
        del(id);
      } else {
        delete definitionEntry[version];
        update(id, (d) => {
          delete d[version];
          return d;
        });
      }
      state.customDefinitions = {...state.customDefinitions};
    },
    loadCustomDefinitions: (
      state,
      action: PayloadAction<{
        definitions: (VIADefinitionV2 | VIADefinitionV3)[];
        version: DefinitionVersion;
        modelDefinitionId?: string;
      }>,
    ) => {
      const {version, definitions, modelDefinitionId} = action.payload;
      definitions.forEach((definition) => {
        const key = getCustomDefinitionKey(definition, version, modelDefinitionId);
        const definitionEntry = state.customDefinitions[key] ?? {};
        if (version === 'v2') {
          definitionEntry[version] = definition as VIADefinitionV2;
        } else {
          definitionEntry[version] = definition as VIADefinitionV3;
        }
        state.customDefinitions[key] = definitionEntry;
      });
    },
    updateLayoutOptions: (state, action: PayloadAction<LayoutOptionsMap>) => {
      state.layoutOptionsMap = {...state.layoutOptionsMap, ...action.payload};
    },
  },
});

export const {
  loadCustomDefinitions,
  loadInitialCustomDefinitions,
  updateDefinitions,
  unloadCustomDefinition,
  updateLayoutOptions,
} = definitionsSlice.actions;

export default definitionsSlice.reducer;

export const getBaseDefinitions = (state: RootState) =>
  state.definitions.definitions;
export const getCustomDefinitions = (state: RootState) =>
  state.definitions.customDefinitions;
export const getLayoutOptionsMap = (state: RootState) =>
  state.definitions.layoutOptionsMap;

export const getDefinitions = createSelector(
  getBaseDefinitions,
  getCustomDefinitions,
  (definitions, customDefinitions) => {
    return Object.entries(customDefinitions).reduce(
      (p, [id, definitionMap]) => {
        return {...p, [id]: {...p[id], ...definitionMap}};
      },
      definitions,
    );
  },
);

export const getDefinitionForDevice = (
  state: RootState,
  device: AuthorizedDevice | ConnectedDevice | null | undefined,
) => device ? definitionForDevice(device, getDefinitions(state)) : undefined;

export const getSelectedDefinition = createSelector(
  getDefinitions,
  getSelectedConnectedDevice,
  (definitions, connectedDevice) =>
    connectedDevice ? definitionForDevice(connectedDevice, definitions) : undefined,
);

// Imported definitions may override an identical USB ID and even identical bytes.
// Only definitions selected from the built-in dictionary have build provenance.
export const getSelectedBuiltinDefinition = createSelector(
  getBaseDefinitions,
  getCustomDefinitions,
  getSelectedConnectedDevice,
  (builtins, custom, device) =>
    device && !definitionForDevice(device, custom)
      ? definitionForDevice(device, builtins)
      : undefined,
);

export const getBasicKeyToByte = createSelector(
  getSelectedConnectedDevice,
  getSelectedKeycodesVersion,
  (connectedDevice, keycodesVersion) => {
    const basicKeyToByte = getBasicKeyDict(
      connectedDevice ? connectedDevice.protocol : 0,
      keycodesVersion,
    );
    return {basicKeyToByte, byteToKey: getByteToKey(basicKeyToByte)};
  },
);

export const getSelectedLayoutOptions = createSelector(
  getSelectedDefinition,
  getLayoutOptionsMap,
  getSelectedDevicePath,
  (definition, map, path) =>
    (path && map[path]) ||
    (definition &&
      definition.layouts.labels &&
      definition.layouts.labels.map((_) => 0)) ||
    [],
);

export const getSelectedOptionKeys = createSelector(
  getSelectedLayoutOptions,
  getSelectedDefinition,
  (layoutOptions, definition) =>
    (definition
      ? layoutOptions.flatMap(
          (option, idx) =>
            (definition.layouts.optionKeys[idx] &&
              definition.layouts.optionKeys[idx][option]) ||
            [],
        )
      : []) as VIAKey[],
);

export const getSelectedKeyDefinitions = createSelector(
  getSelectedDefinition,
  getSelectedOptionKeys,
  (definition, optionKeys) => {
    if (definition && optionKeys) {
      return definition.layouts.keys.concat(optionKeys);
    }
    return [];
  },
);

export const updateLayoutOption =
  (index: number, val: number, operation?: DeviceOperationContext): AppThunk =>
  async (dispatch, getState) => {
    const context = operation ?? createDeviceOperationContext(getState);
    if (!context || !context.isCurrent()) return;
    const {definition, api, path} = context;
    if (!definition.layouts.labels) return;
    const optionsNums = definition.layouts.labels.map((label) =>
      Array.isArray(label) ? label.slice(1).length : 2,
    );
    if (!Number.isInteger(index) || index < 0 || index >= optionsNums.length ||
        !Number.isInteger(val) || val < 0 || val >= optionsNums[index]) return;
    const options = [...(getLayoutOptionsMap(getState())[path] ?? optionsNums.map(() => 0))];
    options[index] = val;
    const bytes = numIntoBytes(packBits(options.map((option, idx) => [option, optionsNums[idx]])));
    try {
      await api.setKeyboardValue(KeyboardValue.LAYOUT_OPTIONS, ...bytes);
      if (!context.isCurrent()) return;
      dispatch(updateLayoutOptions({[path]: options}));
    } catch {
      console.warn('Setting layout option command not working');
    }
  };

export const storeCustomDefinitions =
  ({
    definitions,
    version,
    modelDefinitionId,
  }: {
    definitions: (VIADefinitionV2 | VIADefinitionV3)[];
    version: DefinitionVersion;
    modelDefinitionId?: string;
  }): AppThunk =>
  async (dispatch, getState) => {
    try {
      const allCustomDefinitions = getCustomDefinitions(getState());
      const entries = definitions.map((definition) => {
        const key = getCustomDefinitionKey(definition, version, modelDefinitionId);
        return [
          modelDefinitionId ? key : definition.vendorProductId,
          {
            ...allCustomDefinitions[key],
            [version]: definition,
          },
        ] as [IDBValidKey, DefinitionVersionMap];
      });
      return setMany(entries);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

export const loadStoredCustomDefinitions =
  (): AppThunk => async (dispatch, getState) => {
    try {
      const dictionaryEntries: [string, DefinitionVersionMap][] =
        await entries();
      const keyboardDictionary = dictionaryEntries
        .filter(([key]) => {
          return ['string', 'number'].includes(typeof key);
        })
        .reduce((p, n) => {
          return {...p, [n[0]]: n[1]};
        }, {} as DefinitionDictionary);
      // Each entry should be in the form of [id, {v2:..., v3:...}]
      dispatch(loadInitialCustomDefinitions(keyboardDictionary));

      const [v2Ids, v3Ids] = dictionaryEntries.reduce(
        ([v2Ids, v3Ids], [entryId, definitionVersionMap]) => {
          const model = registeredModels.find((entry) => entry.modelDefinitionId === String(entryId));
          const id = model ? model.vendorId * 65536 + model.productId : Number(entryId);
          if (!Number.isSafeInteger(id) || id < 0 || id > 0xffffffff) return [v2Ids, v3Ids];
          return [
            definitionVersionMap.v2 ? [...v2Ids, id] : v2Ids,
            definitionVersionMap.v3 ? [...v3Ids, id] : v3Ids,
          ];
        },
        [[] as number[], [] as number[]],
      );

      dispatch(ensureSupportedIds({productIds: v2Ids, version: 'v2'}));
      dispatch(ensureSupportedIds({productIds: v3Ids, version: 'v3'}));
    } catch (e) {
      console.error(e);
    }
  };
export const loadLayoutOptions = (operation?: DeviceOperationContext): AppThunk =>
  async (dispatch, getState) => {
    const context = operation ?? createDeviceOperationContext(getState);
    if (!context || !context.isCurrent()) return;
    const {definition, api, path} = context;
    if (!definition.layouts.labels) return;
    try {
      const res = await api.getKeyboardValue(KeyboardValue.LAYOUT_OPTIONS, [], 4);
      if (!context.isCurrent()) return;
      const options = unpackBits(bytesIntoNum(res), definition.layouts.labels.map((label) =>
        Array.isArray(label) ? label.slice(1).length : 2,
      ));
      dispatch(updateLayoutOptions({[path]: options}));
    } catch {
      console.warn('Getting layout options command not working');
    }
  };

// Take a list of authorized devices and attempt to resolve any missing definitions
export const reloadDefinitions =
  (authorizedDevices: AuthorizedDevice[], isCurrent: () => boolean = () => true): AppThunk =>
  async (dispatch, getState) => {
    if (!isCurrent()) return;
    const state = getState();
    const definitions = getDefinitions(state);
    const missingDevicesToFetchDefinitions = authorizedDevices.filter((device) =>
      getDefinitionKey(device) !== undefined && !definitionForDevice(device, definitions),
    );
    const missingDefinitionsSettledPromises = await Promise.allSettled(
      missingDevicesToFetchDefinitions.map((device) =>
        getMissingDefinition(device, device.requiredDefinitionVersion),
      ),
    );

    // A superseded scan may populate the model cache, but cannot replace the
    // current Redux definition instance or invalidate its operation context.
    if (!isCurrent()) return;

    // Error Reporting
    missingDefinitionsSettledPromises.forEach((settledPromise, i) => {
      const device = missingDevicesToFetchDefinitions[i];
      if (settledPromise.status === 'rejected') {
        const deviceInfo = extractDeviceInfo(device);
        dispatch(
          logAppError({
            message: `Fetching ${device.requiredDefinitionVersion} definition failed`,
            deviceInfo,
          }),
        );
      }
    });

    const missingDefinitions = missingDefinitionsSettledPromises.flatMap((result, index) => {
      if (result.status !== 'fulfilled') return [];
      const key = getDefinitionKey(missingDevicesToFetchDefinitions[index]);
      return key === undefined ? [] : [{key, definition: result.value[0], version: result.value[1]}];
    });
    if (!missingDefinitions.length) return;
    dispatch(updateDefinitions(missingDefinitions.reduce<DefinitionDictionary>(
      (all, {key, definition, version}) => ({...all, [key]: {...all[key], [version]: definition}}),
      getBaseDefinitions(getState()),
    )));
  };
