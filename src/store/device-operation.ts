import type {ConnectedDevice} from 'src/types/types';
import {KeyboardAPI} from 'src/utils/keyboard-api';
import {getDefinitionForDevice} from './definitionsSlice';
import {getSelectedConnectedDevice} from './devicesSlice';
import type {RootState} from './index';

// Every async operation owns its device, definition and selection generation.
// The same predicate also travels with each transport queue entry.
export const createDeviceOperationContext = (
  getState: () => RootState,
  device: ConnectedDevice | null | undefined = getSelectedConnectedDevice(getState()),
) => {
  const state = getState();
  if (
    !device ||
    state.devices.selectedDevicePath !== device.path ||
    !state.devices.connectedDevicePaths[device.path]
  ) {
    return undefined;
  }
  const definition = getDefinitionForDevice(state, device);
  if (!definition) return undefined;
  const {path} = device;
  const generation = state.devices.selectionGeneration;
  const isCurrent = () => {
    const current = getState();
    const connected = current.devices.connectedDevicePaths[path];
    return (
      current.devices.selectedDevicePath === path &&
      current.devices.selectionGeneration === generation &&
      !!connected &&
      connected.protocol === device.protocol &&
      connected.requiredDefinitionVersion === device.requiredDefinitionVersion &&
      connected.modelDefinitionId === device.modelDefinitionId &&
      getDefinitionForDevice(current, connected) === definition
    );
  };
  const assertCurrent = () => {
    if (!isCurrent()) {
      throw new Error('The selected device changed. Start the operation again.');
    }
  };
  return {
    path,
    generation,
    device,
    definition,
    isCurrent,
    assertCurrent,
    api: new KeyboardAPI(path, isCurrent),
  };
};

export type DeviceOperationContext = NonNullable<
  ReturnType<typeof createDeviceOperationContext>
>;
