import {
  createDeviceOperationContext,
  type DeviceOperationContext,
} from './device-operation';
import {createSelector, createSlice, PayloadAction} from '@reduxjs/toolkit';
import {
  commonMenus,
  isVIADefinitionV2,
  isVIADefinitionV3,
  isVIAMenu,
  DisplayLabel,
  VIAMenu,
} from '@the-via/reader';
import {evalExpr, parseExpr} from '@the-via/pelpi';
import {
  makeCustomMenu,
  makeCustomMenus,
} from 'src/components/panes/configure-panes/custom/menu-generator';
import {
  KeyboardAPI,
  UISyncCustomMenuCommandTarget,
  UISyncRequest,
  UISyncRequestType,
} from 'src/utils/keyboard-api';
import {isCustomMenuCommandContent} from 'src/utils/custom-menu';
import {
  collectRangeControls,
  decodeRangeValue,
  encodeRangeCommand,
  encodeRangeValue,
  resolveRangeChange,
} from 'src/utils/range-constraints';
import type {CommonMenusMap, ConnectedDevice} from '../types/types';
import {getSelectedDefinition} from './definitionsSlice';
import {getSelectedConnectedDevice, getSelectedDevicePath} from './devicesSlice';
import type {AppThunk, RootState} from './index';
import {getSelectedFirmwareVersion} from './firmwareSlice';

type CustomMenuData = {
  [commandName: string]: number[] | number[][];
};
type CustomMenuDataMap = {[devicePath: string]: CustomMenuData};

type MenusState = {
  customMenuDataMap: CustomMenuDataMap;
  commonMenusMap: CommonMenusMap;
  showKeyPainter: boolean;
};

type PendingCustomMenuSync = {
  context: DeviceOperationContext;
  isSyncing: boolean;
  syncAll: boolean;
  ids: Set<string>;
};

const pendingCustomMenuSyncs: Record<string, PendingCustomMenuSync> = {};

const initialState: MenusState = {
  customMenuDataMap: {},
  commonMenusMap: {},
  showKeyPainter: false,
};

const menusSlice = createSlice({
  name: 'menus',
  initialState,
  reducers: {
    updateShowKeyPainter: (state, action: PayloadAction<boolean>) => {
      state.showKeyPainter = action.payload;
    },
    updateSelectedCustomMenuData: (
      state,
      action: PayloadAction<{menuData: CustomMenuData; devicePath: string}>,
    ) => {
      const {devicePath, menuData} = action.payload;
      state.customMenuDataMap[devicePath] = menuData;
    },
    updateCommonMenus: (
      state,
      action: PayloadAction<{commonMenuMap: CommonMenusMap}>,
    ) => {
      const {commonMenuMap} = action.payload;
      state.commonMenusMap = commonMenuMap;
    },
    updateCustomMenuData: (state, action: PayloadAction<CustomMenuDataMap>) => {
      state.customMenuDataMap = {...state.customMenuDataMap, ...action.payload};
    },
  },
});

export const {
  updateShowKeyPainter,
  updateSelectedCustomMenuData,
  updateCustomMenuData,
} = menusSlice.actions;

export default menusSlice.reducer;

export const updateCustomMenuValue =
  (command: string, ...rest: number[]): AppThunk =>
    async (dispatch, getState) => {
      const state = getState();
      const connectedDevice = getSelectedConnectedDevice(state);
      const context = createDeviceOperationContext(getState, connectedDevice);
      if (!connectedDevice || !context) {
        return;
      }

      const menuData = getSelectedCustomMenuData(state);
      const commands = getCustomCommands(state);
      const data = {
        ...menuData,
        [command]: [...rest.slice(commands[command].length)],
      };
      const {path} = connectedDevice;
      dispatch(
        updateSelectedCustomMenuData({
          menuData: data,
          devicePath: path,
        }),
      );

      try {
        await context.api.setCustomMenuValue(...rest.slice(0));
        context.assertCurrent();
        await context.api.commitCustomMenu(rest[0]);
      } catch (error) {if (context.isCurrent()) throw error;}
    };

export const updateCustomMenuRangeValue =
  (command: string, requestedValue: number): AppThunk =>
    async (dispatch, getState) => {
      const state = getState();
      const connectedDevice = getSelectedConnectedDevice(state);
      const context = createDeviceOperationContext(getState, connectedDevice);
      const api = context?.api;
      const menuData = getSelectedCustomMenuData(state);
      const rangeControls = getCustomRangeControls(state);
      const control = rangeControls[command];

      if (!connectedDevice || !context || !api || !menuData || !control) {
        return;
      }

      const logicalValues = Object.entries(rangeControls).reduce<
        Record<string, number>
      >((values, [id, range]) => {
        const rawValue = menuData[id];
        if (Array.isArray(rawValue) && typeof rawValue[0] === 'number') {
          values[id] = decodeRangeValue(rawValue as number[], range.options[1]);
        }
        return values;
      }, {});
      const resolvedValues = resolveRangeChange(
        command,
        requestedValue,
        rangeControls,
        logicalValues,
      );
      const updates = Object.entries(resolvedValues).filter(
        ([id, value]) => logicalValues[id] !== value && rangeControls[id],
      );

      if (!updates.length) {
        return;
      }

      const updatedMenuData = {...menuData};
      updates.forEach(([id, value]) => {
        updatedMenuData[id] = encodeRangeValue(
          value,
          rangeControls[id].options[1],
        );
      });
      dispatch(
        updateSelectedCustomMenuData({
          menuData: updatedMenuData,
          devicePath: connectedDevice.path,
        }),
      );

      try {
        const channels = new Set<number>();
        for (const [id, value] of updates) {
          const command = encodeRangeCommand(
            rangeControls[id].content,
            value,
            rangeControls[id].options[1],
          );
          const channel = command[0];
          await api.setCustomMenuValue(...command);
          context.assertCurrent();
          channels.add(channel);
        }
        for (const channel of channels) {
          await api.commitCustomMenu(channel);
          context.assertCurrent();
        }
      } catch (error) {if (context.isCurrent()) throw error;}
    };

const readCustomMenuValues = async (
  api: KeyboardAPI,
  commands: Record<string, number[]>,
  ids?: string[],
): Promise<CustomMenuData> => {
  const idsToSync = (ids ?? Object.keys(commands)).filter((id) => commands[id]);
  const commandPromises = idsToSync.map((id) => ({
    id,
    promise: api.getCustomMenuValue(commands[id]),
  }));
  const results = await Promise.all(
    commandPromises.map(({promise}) => promise),
  );

  return commandPromises.reduce<CustomMenuData>(
    (res, {id}, idx) => ({
      ...res,
      [id]: results[idx].slice(1),
    }),
    {},
  );
};

const commandMatchesTarget = (
  command: number[],
  target: UISyncCustomMenuCommandTarget,
) => command[0] === target.channelId && command[1] === target.commandId;

const commandMatchesId = (command: number[], commandId: number) =>
  command[1] === commandId;

export const syncCustomMenuValues =
  (ids?: string[], operation?: DeviceOperationContext): AppThunk =>
    async (dispatch, getState) => {
      const context = operation ?? createDeviceOperationContext(getState);
      if (!context?.isCurrent()) return;
      const state = getState();
      const commands = getCustomCommands(state) as Record<string, number[]>;
      try {
        await context.api.waitForCommandQueueIdle();
        context.assertCurrent();
        const synced = await readCustomMenuValues(context.api, commands, ids);
        if (!context.isCurrent()) return;
        dispatch(updateSelectedCustomMenuData({
devicePath: context.path,
          menuData: {...getSelectedCustomMenuData(getState()), ...synced}
}));
      } catch (error) {if (context.isCurrent()) throw error;}
    };

const enqueueCustomMenuSync = (context: DeviceOperationContext, ids?: string[]) => {
  let pending = pendingCustomMenuSyncs[context.path];
  if (!pending || !pending.context.isCurrent()) {
    pending = pendingCustomMenuSyncs[context.path] = {context, isSyncing: false, syncAll: false, ids: new Set<string>()};
  }
  if (ids === undefined) {pending.syncAll = true; pending.ids.clear();}
  else if (!pending.syncAll) ids.forEach(id => pending.ids.add(id));
  return pending;
};

const runPendingCustomMenuSyncs = (devicePath: string): AppThunk => async dispatch => {
  const pending = pendingCustomMenuSyncs[devicePath];
  if (!pending || pending.isSyncing || !pending.context.isCurrent()) return;
  pending.isSyncing = true;
  try {
    while (pending.context.isCurrent() && (pending.syncAll || pending.ids.size)) {
      const ids = pending.syncAll ? undefined : Array.from(pending.ids);
      pending.syncAll = false; pending.ids.clear();
      await dispatch(syncCustomMenuValues(ids, pending.context));
    }
  } finally {
    pending.isSyncing = false;
    if (pendingCustomMenuSyncs[devicePath] === pending) delete pendingCustomMenuSyncs[devicePath];
  }
};

export const syncCustomMenuValuesFromRequest =
  (request: UISyncRequest, sourcePath?: string): AppThunk =>
    async (dispatch, getState) => {
      const context = createDeviceOperationContext(getState);
      if (!context || (sourcePath !== undefined && sourcePath !== context.path)) return;
      if (request.type === UISyncRequestType.CUSTOM_MENU_ALL) {
        enqueueCustomMenuSync(context);
        await dispatch(runPendingCustomMenuSyncs(context.path));
        return;
      }
      const commands = getCustomCommands(getState()) as Record<string, number[]>;
      const ids = Object.entries(commands).filter(([, command]) =>
        request.type === UISyncRequestType.CUSTOM_MENU_COMMANDS
          ? request.targets.some(target => commandMatchesTarget(command, target))
          : request.commandIds.some(id => commandMatchesId(command, id)),
      ).map(([id]) => id);
      if (ids.length) {enqueueCustomMenuSync(context, ids); await dispatch(runPendingCustomMenuSyncs(context.path));}
    };

// COMMON MENU IDENTIFIER RESOLVES INTO ACTUAL MODULE
type V3Menu = VIAMenu<DisplayLabel>;

const tryResolveCommonMenu = (id: V3Menu | string): V3Menu | V3Menu[] => {
  // Only convert to menu object if it is found in common menus, else return
  if (typeof id === 'string') {
    return commonMenus[id as keyof typeof commonMenus];
  }
  return id;
};

export const updateV3MenuData =
  (connectedDevice: ConnectedDevice, operation?: DeviceOperationContext): AppThunk =>
    async (dispatch, getState) => {
      const context = operation ?? createDeviceOperationContext(getState, connectedDevice);
      if (!context?.isCurrent()) return;
      const state = getState();
      const {definition, api} = context;

      if (!isVIADefinitionV3(definition)) {
        throw new Error('V3 menus are only compatible with V3 VIA definitions.');
      }
      const menus = getV3Menus(state);
      const firmwareVersion = getSelectedFirmwareVersion(state);
      const commands = menus.flatMap((menu) =>
        extractCommands(menu, firmwareVersion),
      );
      const {protocol, path} = connectedDevice;

      if (commands.length !== 0 && protocol >= 11) {
        let props = {} as CustomMenuData;
        const commandPromises = commands.map(([name, channelId, ...command]) => ({
          command: name,
          promise: api.getCustomMenuValue([channelId].concat(command)),
        }));
        const commandPromisesRes = await Promise.all(
          commandPromises.map((c) => c.promise),
        );
        if (!context.isCurrent()) return;
        props = commandPromises.reduce(
          ({res, ref}, n, idx) => ({
            ref,
            res: {...res, [n.command]: ref[idx].slice(1)},
          }),
          {res: props, ref: commandPromisesRes},
        ).res;

        // Update to detect instance of color-palette control and an li on a key
        const maxLedIndex = Math.max(
          ...definition.layouts.keys.map((key) => key.li ?? -1),
        );
        console.debug(maxLedIndex, 'maxLedIndex');

        if (maxLedIndex >= 0) {
          // Ask for PerKeyRGBValues -- hardcoded to 62
          const perKeyRGB = await api.getPerKeyRGBMatrix(
            Array(maxLedIndex + 1)
              .fill(0)
              .map((_, i) => i),
          );
          if (!context.isCurrent()) return;
          props.__perKeyRGB = perKeyRGB;
        }

        dispatch(
          updateSelectedCustomMenuData({
            devicePath: path,
            menuData: {
              ...props,
              ...(firmwareVersion !== undefined && {
                id_firmware_version: [firmwareVersion],
              }),
            },
          }),
        );
      }
    };

// Returns true if the showIf expression references only id_firmware_version
const isFirmwareOnlyExpr = (showIf: string): boolean => {
  try {
    const {state} = parseExpr(showIf);
    const keys = Object.keys(state);
    return (
      keys.length > 0 && keys.every((key) => key === 'id_firmware_version')
    );
  } catch {
    return false;
  }
};

// TODO: properly type the input and add proper type guards
const extractCommands = (
  menuOrControls: any,
  firmwareVersion?: number,
): any[] => {
  if (typeof menuOrControls === 'string') {
    return [];
  }
  // Prune firmware-gated branches early when firmware version is known
  if (
    firmwareVersion !== undefined &&
    'showIf' in menuOrControls &&
    typeof menuOrControls.showIf === 'string' &&
    isFirmwareOnlyExpr(menuOrControls.showIf) &&
    !evalExpr(menuOrControls.showIf, {id_firmware_version: [firmwareVersion]})
  ) {
    return [];
  }
  return 'type' in menuOrControls
    ? isCustomMenuCommandContent(menuOrControls.content)
      ? [menuOrControls.content]
      : []
    : 'content' in menuOrControls && typeof menuOrControls.content !== 'string'
      ? menuOrControls.content.flatMap((item: any) =>
        extractCommands(item, firmwareVersion),
      )
      : [];
};

export const getCommonMenusDataMap = (state: RootState) =>
  state.menus.commonMenusMap;

export const getShowKeyPainter = (state: RootState) =>
  state.menus.showKeyPainter;

export const getCustomMenuDataMap = (state: RootState) =>
  state.menus.customMenuDataMap;

export const getSelectedCustomMenuData = createSelector(
  getCustomMenuDataMap,
  getSelectedDevicePath,
  (map, path) => path && map[path],
);

export const getV3Menus = createSelector(
  getSelectedDefinition,
  (definition) => {
    if (!definition || !isVIADefinitionV3(definition)) {
      return [];
    }

    // TODO: handle Common menus (built ins in here too?)
    return (definition.menus || [])
      .flatMap(tryResolveCommonMenu)
      .map((menu, idx) =>
        isVIAMenu(menu) ? compileMenu('custom_menu', 3, menu, idx) : menu,
      );
  },
);

export const getV3MenuComponents = createSelector(
  getSelectedDefinition,
  (definition) => {
    if (!definition || !isVIADefinitionV3(definition)) {
      return [];
    }

    // TODO: handle Common menus (built ins in here too?)
    return (definition.menus || [])
      .flatMap(tryResolveCommonMenu)
      .map((menu: any, idx) =>
        isVIAMenu(menu)
          ? makeCustomMenu(compileMenu('custom_menu', 3, menu, idx), idx)
          : menu,
      ) as ReturnType<typeof makeCustomMenus>;
  },
);

export const getCustomCommands = createSelector(
  getSelectedDefinition,
  getV3Menus,
  getSelectedFirmwareVersion,
  (definition, v3Menus, firmwareVersion) => {
    if (!definition) {
      return [];
    }
    const menus = isVIADefinitionV2(definition)
      ? definition.customMenus
      : v3Menus;

    if (menus === undefined) {
      return [];
    }

    return menus
      .flatMap((menu: any) => extractCommands(menu, firmwareVersion))
      .reduce((p, n) => {
        return {
          ...p,
          [n[0]]: n.slice(1),
        };
      }, {});
  },
);

export const getCustomRangeControls = createSelector(
  getSelectedDefinition,
  getV3Menus,
  (definition, v3Menus) => {
    if (!definition) {
      return {};
    }
    const menus = isVIADefinitionV2(definition)
      ? definition.customMenus || []
      : v3Menus;
    return collectRangeControls(menus);
  },
);

const compileMenu = (partial: string, depth = 0, val: any, idx: number) => {
  return depth === 0
    ? val
    : {
      ...val,
      _id: `${partial}_${idx}`,
      content:
        val.label !== undefined
          ? typeof val.content === 'string'
            ? val.content
            : val.content.map((contentVal: any, contentIdx: number) =>
              compileMenu(
                `${partial}_${contentIdx}`,
                depth - 1,
                contentVal,
                idx,
              ),
            )
          : val.content.map((contentVal: any, contentIdx: number) =>
            compileMenu(`${partial}_${contentIdx}`, depth, contentVal, idx),
          ),
    };
};
